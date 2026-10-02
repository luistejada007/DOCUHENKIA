const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const database = require("../database");
const trashStore = require("../trashStore");

const foldersPath = path.join(__dirname, "..", "data", "folders.json");
const documentsPath = path.join(__dirname, "..", "data", "documents.json");
const availableRoles = ["Administrador", "Editor", "Revisor", "Visualizador"];

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function writeFolders(folders) {
  fs.writeFileSync(foldersPath, JSON.stringify(folders, null, 2));
}

function isShared(value) {
  return value !== false && value !== "false";
}

function isVisibleToUser(folder, userId, role) {
  const ownerId = folder.ownerId ?? folder.owner_user_id;
  const shared = folder.isShared ?? folder.is_shared;
  const allowedRoles = folder.accessRoles ?? folder.access_roles ?? availableRoles;
  const hiddenFor = folder.hiddenFor || [];
  const roleCanView = role === "Administrador" || allowedRoles.includes(role);
  return (Number(ownerId) === userId || (isShared(shared) && roleCanView))
    && !hiddenFor.some(id => Number(id) === userId);
}

exports.list = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;

  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query(
        `SELECT f.id, f.name, f.created_at AS "createdAt", f.is_shared AS "isShared",
            f.access_roles AS "accessRoles", COUNT(d.id)::int AS "documentCount"
         FROM folders f
         LEFT JOIN documents d ON d.folder_id = f.id AND (d.is_shared = TRUE OR d.owner_user_id = $1)
         WHERE (f.owner_user_id = $1 OR (f.is_shared = TRUE AND ($3 = 'Administrador' OR $2 = ANY(f.access_roles))))
           AND NOT EXISTS (
             SELECT 1 FROM hidden_folders h WHERE h.folder_id = f.id AND h.user_id = $1
           )
         GROUP BY f.id ORDER BY f.name`,
        [userId, role, role]
      );
      return res.json(rows);
    } catch (error) {
      return next(error);
    }
  }

  const folders = readJSON(foldersPath).sort((a, b) => a.name.localeCompare(b.name));
  const documents = readJSON(documentsPath);
  const visibleFolders = folders.filter(folder => isVisibleToUser(folder, userId, role));
  const counts = documents.reduce((result, document) => {
    if (document.folderId && (isShared(document.isShared) || Number(document.ownerId) === userId)) {
      result[document.folderId] = (result[document.folderId] || 0) + 1;
    }
    return result;
  }, {});

  res.json(visibleFolders.map(folder => ({ ...folder, documentCount: counts[folder.id] || 0 })));
};

exports.create = async (req, res, next) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "El nombre de la carpeta es obligatorio" });
  if (name.length > 80) return res.status(400).json({ error: "El nombre es demasiado largo" });

  const shared = isShared(req.body?.isShared);
  const ownerId = Number(req.sessionUser.id);
  const accessRoles = shared
    ? (Array.isArray(req.body?.accessRoles) ? [...new Set(req.body.accessRoles)] : availableRoles)
    : [];
  if (shared && (!accessRoles.length || accessRoles.some(role => !availableRoles.includes(role)))) {
    return res.status(400).json({ error: "Selecciona al menos un rol válido para ver la carpeta" });
  }

  if (database.isConfigured) {
    try {
      const folder = {
        id: uuidv4(),
        name,
        createdAt: new Date().toISOString(),
        isShared: shared,
        accessRoles,
      };
      await database.pool.query(
        `INSERT INTO folders (id, name, created_at, owner_user_id, is_shared, access_roles)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [folder.id, folder.name, folder.createdAt, ownerId, shared, accessRoles]
      );
      return res.status(201).json({ ...folder, documentCount: 0 });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ya existe una carpeta con ese nombre y visibilidad" });
      }
      return next(error);
    }
  }

  const folders = readJSON(foldersPath);
  if (folders.some(folder => folder.name.toLowerCase() === name.toLowerCase()
    && isShared(folder.isShared) === shared
    && Number(folder.ownerId) === ownerId)) {
    return res.status(409).json({ error: "Ya existe una carpeta con ese nombre y visibilidad" });
  }

  const folder = {
    id: uuidv4(),
    name,
    createdAt: new Date().toISOString(),
    ownerId,
    isShared: shared,
    accessRoles,
    hiddenFor: [],
  };
  folders.push(folder);
  writeFolders(folders);
  res.status(201).json({ ...folder, documentCount: 0 });
};

exports.remove = async (req, res, next) => {
  const scope = req.body?.scope || "me";
  if (!["me", "all"].includes(scope)) {
    return res.status(400).json({ error: "El alcance de eliminación no es válido" });
  }

  const userId = Number(req.sessionUser.id);
  const role = req.sessionUser.role;
  const isAdmin = role === "Administrador";
  if (scope === "all" && !isAdmin) {
    return res.status(403).json({ error: "Solo un administrador puede eliminar una carpeta para todos" });
  }

  if (database.isConfigured) {
    let client;
    let transactionStarted = false;
    try {
      client = await database.pool.connect();
      await client.query("BEGIN");
      transactionStarted = true;

      const { rows: folders } = await client.query(
        `SELECT f.* FROM folders f
         WHERE f.id = $1
           AND (f.owner_user_id = $2 OR (f.is_shared = TRUE AND ($4 = 'Administrador' OR $3 = ANY(f.access_roles))))
           AND NOT EXISTS (
             SELECT 1 FROM hidden_folders h WHERE h.folder_id = f.id AND h.user_id = $2
           )
         FOR UPDATE`,
        [req.params.id, userId, role, role]
      );
      if (!folders.length) return res.status(404).json({ error: "Carpeta no encontrada" });

      if (scope === "me") {
        const batchId = uuidv4();
        const deletedByName = req.sessionUser.name || req.sessionUser.email || String(userId);
        const { rows: documents } = await client.query(
          "SELECT * FROM documents WHERE folder_id = $1", [req.params.id]
        );
        const entries = [
          trashStore.createEntry({
            itemType: "folder",
            itemId: folders[0].id,
            batchId,
            name: folders[0].name,
            audience: "personal",
            ownerId: folders[0].owner_user_id,
            deletedById: userId,
            deletedByName,
            payload: folders[0],
          }),
          ...documents.map(document => trashStore.createEntry({
            itemType: "document",
            itemId: document.id,
            batchId,
            name: document.name,
            folderId: document.folder_id,
            audience: "personal",
            ownerId: document.owner_user_id,
            deletedById: userId,
            deletedByName,
            payload: document,
          })),
        ];
        for (const entry of entries) await trashStore.insertEntry(client, entry);
        await client.query(
          "INSERT INTO hidden_folders (folder_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [req.params.id, userId]
        );
        await client.query("COMMIT");
        transactionStarted = false;
        return res.json({ message: "Carpeta eliminada de tu vista", scope: "me", deletedDocumentIds: [] });
      }

      const { rows: sharedFolders } = await client.query(
        "SELECT * FROM folders WHERE lower(name) = lower($1) AND is_shared = TRUE FOR UPDATE",
        [folders[0].name]
      );
      if (!sharedFolders.length) {
        return res.status(409).json({ error: "No hay carpetas compartidas con ese nombre; las carpetas personales se conservaron" });
      }
      const sharedFolderIds = sharedFolders.map(folder => folder.id);
      const { rows: documents } = await client.query(
        "SELECT id, stored_name FROM documents WHERE folder_id = ANY($1::text[])", [sharedFolderIds]
      );
      const { rows: documentRows } = await client.query(
        "SELECT * FROM documents WHERE folder_id = ANY($1::text[])", [sharedFolderIds]
      );
      const batchId = uuidv4();
      const deletedByName = req.sessionUser.name || req.sessionUser.email || String(userId);
      const entries = [
        ...sharedFolders.map(folder => trashStore.createEntry({
          itemType: "folder",
          itemId: folder.id,
          batchId,
          name: folder.name,
          audience: "global",
          ownerId: folder.owner_user_id,
          deletedById: userId,
          deletedByName,
          payload: folder,
        })),
        ...documentRows.map(document => trashStore.createEntry({
          itemType: "document",
          itemId: document.id,
          batchId,
          name: document.name,
          folderId: document.folder_id,
          audience: "global",
          ownerId: document.owner_user_id,
          deletedById: userId,
          deletedByName,
          payload: document,
        })),
      ];
      for (const entry of entries) await trashStore.insertEntry(client, entry);
      await client.query("DELETE FROM documents WHERE folder_id = ANY($1::text[])", [sharedFolderIds]);
      await client.query("DELETE FROM folders WHERE id = ANY($1::text[])", [sharedFolderIds]);
      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        message: "Carpeta eliminada correctamente",
        scope: "all",
        deletedFolderIds: sharedFolderIds,
        deletedDocumentIds: documentRows.map(document => document.id),
      });
    } catch (error) {
      return next(error);
    } finally {
      if (client) {
        if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    }
  }

  const folders = readJSON(foldersPath);
  const index = folders.findIndex(folder => folder.id === req.params.id);
  if (index === -1 || !isVisibleToUser(folders[index], userId, role)) {
    return res.status(404).json({ error: "Carpeta no encontrada" });
  }

  if (scope === "me") {
    const batchId = uuidv4();
    const deletedByName = req.sessionUser.name || req.sessionUser.email || String(userId);
    const documents = readJSON(documentsPath).filter(document => document.folderId === req.params.id);
    const entries = [
      trashStore.createEntry({
        itemType: "folder",
        itemId: folders[index].id,
        batchId,
        name: folders[index].name,
        audience: "personal",
        ownerId: folders[index].ownerId,
        deletedById: userId,
        deletedByName,
        payload: folders[index],
      }),
      ...documents.map(document => trashStore.createEntry({
        itemType: "document",
        itemId: document.id,
        batchId,
        name: document.name,
        folderId: document.folderId,
        audience: "personal",
        ownerId: document.ownerId,
        deletedById: userId,
        deletedByName,
        payload: document,
      })),
    ];
    const trash = trashStore.readTrash();
    trashStore.writeTrash([...trash, ...entries]);
    folders[index] = {
      ...folders[index],
      hiddenFor: [...new Set([...(folders[index].hiddenFor || []), userId])],
    };
    writeFolders(folders);
    return res.json({ message: "Carpeta eliminada de tu vista", scope: "me", deletedDocumentIds: [] });
  }

  const folderName = folders[index].name.toLocaleLowerCase();
  const sharedFolderIds = new Set(folders
    .filter(folder => folder.name.toLocaleLowerCase() === folderName && isShared(folder.isShared))
    .map(folder => folder.id));
  if (!sharedFolderIds.size) {
    return res.status(409).json({ error: "No hay carpetas compartidas con ese nombre; las carpetas personales se conservaron" });
  }

  const documents = readJSON(documentsPath);
  const folderDocuments = documents.filter(document => sharedFolderIds.has(document.folderId));
  const batchId = uuidv4();
  const deletedByName = req.sessionUser.name || req.sessionUser.email || String(userId);
  const deletedFolders = folders.filter(folder => sharedFolderIds.has(folder.id));
  const entries = [
    ...deletedFolders.map(folder => trashStore.createEntry({
      itemType: "folder",
      itemId: folder.id,
      batchId,
      name: folder.name,
      audience: "global",
      ownerId: folder.ownerId,
      deletedById: userId,
      deletedByName,
      payload: folder,
    })),
    ...folderDocuments.map(document => trashStore.createEntry({
      itemType: "document",
      itemId: document.id,
      batchId,
      name: document.name,
      folderId: document.folderId,
      audience: "global",
      ownerId: document.ownerId,
      deletedById: userId,
      deletedByName,
      payload: document,
    })),
  ];
  trashStore.writeTrash([...trashStore.readTrash(), ...entries]);
  fs.writeFileSync(documentsPath, JSON.stringify(
    documents.filter(document => !sharedFolderIds.has(document.folderId)), null, 2
  ));
  writeFolders(folders.filter(folder => !sharedFolderIds.has(folder.id)));
  res.json({
    message: "Carpeta eliminada correctamente",
    scope: "all",
    deletedFolderIds: [...sharedFolderIds],
    deletedDocumentIds: folderDocuments.map(document => document.id),
  });
};