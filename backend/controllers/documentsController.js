const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const database = require("../database");
const trashStore = require("../trashStore");

const dbPath = path.join(__dirname, "..", "data", "documents.json");
const uploadsDir = path.join(__dirname, "..", "uploads");
const foldersPath = path.join(__dirname, "..", "data", "folders.json");
const documentTypes = new Set(["Arquitectura", "Información técnica", "Manual"]);
const visibleDocumentSql = `
  (d.is_shared = TRUE OR d.owner_user_id = $1)
  AND (
    d.folder_id IS NULL OR (
      f.id IS NOT NULL
      AND (f.owner_user_id = $1 OR (f.is_shared = TRUE AND ($2 = 'Administrador' OR $2 = ANY(f.access_roles))))
      AND NOT EXISTS (
        SELECT 1 FROM hidden_folders h WHERE h.folder_id = f.id AND h.user_id = $1
      )
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM hidden_documents h WHERE h.document_id = d.id AND h.user_id = $1
  )`;

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return [];
  }
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function readFolders() {
  try {
    return JSON.parse(fs.readFileSync(foldersPath, "utf8"));
  } catch {
    return [];
  }
}

function publicDocument(doc) {
  const { ownerId, hiddenFor, ...publicData } = doc;
  return {
    ...publicData,
    isShared: doc.isShared !== false,
    previewUrl: `/api/documents/${doc.id}/preview`
  };
}

function documentFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: Number(row.size),
    folderId: row.folder_id,
    documentType: row.document_type || "Sin clasificar",
    ownerId: row.owner_user_id,
    isShared: row.is_shared !== false,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function isDocumentVisible(doc, userId, role, folders = readFolders()) {
  const shared = doc.isShared !== false;
  const owned = Number(doc.ownerId) === userId;
  if (!shared && !owned) return false;
  if (!doc.folderId) return true;

  const folder = folders.find(item => item.id === doc.folderId);
  if (!folder) return false;
  const folderOwnerId = folder.ownerId ?? folder.owner_user_id;
  const allowedRoles = folder.accessRoles ?? folder.access_roles ?? ["Administrador", "Editor", "Revisor", "Visualizador"];
  const folderShared = folder.isShared ?? folder.is_shared;
  const roleCanView = role === "Administrador" || allowedRoles.includes(role);
  return (Number(folderOwnerId) === userId || (folderShared !== false && roleCanView))
    && !(folder.hiddenFor || []).some(id => Number(id) === userId)
    && !(doc.hiddenFor || []).some(id => Number(id) === userId);
}

exports.list = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query(
        `SELECT d.* FROM documents d
         LEFT JOIN folders f ON f.id = d.folder_id
         WHERE ${visibleDocumentSql}
         ORDER BY d.created_at DESC`,
        [userId, role]
      );
      return res.json(rows.map(documentFromRow).map(publicDocument));
    } catch (error) {
      return next(error);
    }
  }

  const docs = readDB()
    .filter(doc => isDocumentVisible(doc, userId, role))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicDocument);

  res.json(docs);
};

exports.upload = async (req, res, next) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: "No se recibieron archivos" });
  }

  const folderId = String(req.body?.folderId || "").trim() || null;
  const documentType = String(req.body?.documentType || "").trim();
  const isShared = req.body?.isShared === undefined || req.body.isShared === "true";
  const ownerId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  if (!documentTypes.has(documentType)) {
    for (const file of req.files) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
    return res.status(400).json({ error: "Selecciona un tipo de documentación válido" });
  }

  if (database.isConfigured) {
    let client;
    let transactionStarted = false;
    try {
      client = await database.pool.connect();
      await client.query("BEGIN");
      transactionStarted = true;

      if (folderId) {
        const { rows } = await client.query(
          `SELECT f.id FROM folders f
           WHERE f.id = $1
             AND (f.owner_user_id = $2 OR (f.is_shared = TRUE AND ($3 = 'Administrador' OR $3 = ANY(f.access_roles))))
             AND NOT EXISTS (
               SELECT 1 FROM hidden_folders h WHERE h.folder_id = f.id AND h.user_id = $2
             )
           FOR KEY SHARE`,
          [folderId, ownerId, role]
        );
        if (!rows.length) {
          await client.query("ROLLBACK");
          transactionStarted = false;
          for (const file of req.files) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          }
          return res.status(400).json({ error: "La carpeta seleccionada no existe" });
        }
      }

      const created = [];
      for (const file of req.files) {
        const document = {
          id: uuidv4(),
          name: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          folderId,
          documentType,
          ownerId,
          isShared,
          createdAt: new Date().toISOString(),
        };
        await client.query(
          `INSERT INTO documents (id, name, stored_name, mime_type, size, folder_id, document_type, is_shared, owner_user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [document.id, document.name, document.storedName, document.mimeType, document.size,
            document.folderId, document.documentType, document.isShared, document.ownerId, document.createdAt]
        );
        created.push(publicDocument(document));
      }
      await client.query("COMMIT");
      transactionStarted = false;
      return res.status(201).json(created);
    } catch (error) {
      if (client && transactionStarted) await client.query("ROLLBACK");
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return next(error);
    } finally {
      if (client) client.release();
    }
  }

  const db = readDB();
  const folders = readFolders();
  if (folderId && !folders.some(folder => folder.id === folderId
    && isDocumentVisible({ folderId, ownerId, isShared: true }, ownerId, role, folders))) {
    return res.status(400).json({ error: "La carpeta seleccionada no existe" });
  }

  const created = req.files.map(file => {
    const doc = {
      id: uuidv4(),
      name: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      folderId,
      documentType,
      ownerId,
      isShared,
      createdAt: new Date().toISOString()
    };
    db.push(doc);
    return publicDocument(doc);
  });

  writeDB(db);
  res.status(201).json(created);
};

exports.getOne = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query(
        `SELECT d.* FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
         WHERE d.id = $3 AND ${visibleDocumentSql}`,
        [userId, role, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: "Documento no encontrado" });
      return res.json(publicDocument(documentFromRow(rows[0])));
    } catch (error) {
      return next(error);
    }
  }

  const docs = readDB();
  const doc = docs.find(d => d.id === req.params.id && isDocumentVisible(d, userId, role));
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  res.json(publicDocument(doc));
};

exports.download = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  let doc;
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query(
        `SELECT d.* FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
         WHERE d.id = $3 AND ${visibleDocumentSql}`,
        [userId, role, req.params.id]
      );
      doc = rows.length ? documentFromRow(rows[0]) : null;
    } catch (error) {
      return next(error);
    }
  } else {
    doc = readDB().find(d => d.id === req.params.id && isDocumentVisible(d, userId, role));
  }

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  const filePath = path.join(uploadsDir, doc.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Archivo físico no encontrado" });
  }

  res.download(filePath, doc.name);
};

exports.preview = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  let doc;
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query(
        `SELECT d.* FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
         WHERE d.id = $3 AND ${visibleDocumentSql}`,
        [userId, role, req.params.id]
      );
      doc = rows.length ? documentFromRow(rows[0]) : null;
    } catch (error) {
      return next(error);
    }
  } else {
    doc = readDB().find(d => d.id === req.params.id && isDocumentVisible(d, userId, role));
  }

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  const filePath = path.join(uploadsDir, doc.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo físico no encontrado" });
  res.sendFile(filePath);
};

exports.remove = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  const deletedByName = req.sessionUser.name || req.sessionUser.email || String(userId);
  const audience = role === "Administrador" ? "global" : "personal";
  if (database.isConfigured) {
    let client;
    let transactionStarted = false;
    try {
      client = await database.pool.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      const { rows } = await client.query(
        `SELECT d.* FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
         WHERE d.id = $3 AND ${visibleDocumentSql}`,
        [userId, role, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: "Documento no encontrado" });
      const row = rows[0];
      const batchId = uuidv4();
      const entry = trashStore.createEntry({
        itemType: "document",
        itemId: row.id,
        batchId,
        name: row.name,
        folderId: row.folder_id,
        audience,
        ownerId: row.owner_user_id,
        deletedById: userId,
        deletedByName,
        payload: row,
      });
      await trashStore.insertEntry(client, entry);
      if (audience === "global") {
        await client.query("DELETE FROM documents WHERE id = $1", [row.id]);
      } else {
        await client.query(
          "INSERT INTO hidden_documents (document_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [row.id, userId]
        );
      }
      await client.query("COMMIT");
      transactionStarted = false;
      return res.json({ message: "Documento movido a la papelera", scope: audience, deletedDocumentIds: [row.id] });
    } catch (error) {
      return next(error);
    } finally {
      if (client) {
        if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    }
  }

  const db = readDB();
  const index = db.findIndex(d => d.id === req.params.id && isDocumentVisible(d, userId, role));

  if (index === -1) {
    return res.status(404).json({ error: "Documento no encontrado" });
  }

  const doc = db[index];
  const entry = trashStore.createEntry({
    itemType: "document",
    itemId: doc.id,
    batchId: uuidv4(),
    name: doc.name,
    folderId: doc.folderId,
    audience,
    ownerId: doc.ownerId,
    deletedById: userId,
    deletedByName,
    payload: doc,
  });
  if (audience === "global") db.splice(index, 1);
  else db[index] = { ...doc, hiddenFor: [...new Set([...(doc.hiddenFor || []), userId])] };
  trashStore.writeTrash([...trashStore.readTrash(), entry]);
  writeDB(db);

  res.json({ message: "Documento movido a la papelera", scope: audience, deletedDocumentIds: [doc.id] });
};
