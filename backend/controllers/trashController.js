const fs = require("fs");
const path = require("path");
const database = require("../database");
const trashStore = require("../trashStore");

const uploadsDir = path.join(__dirname, "..", "uploads");
const foldersPath = path.join(__dirname, "..", "data", "folders.json");
const documentsPath = path.join(__dirname, "..", "data", "documents.json");

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function writeJSON(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function isAdmin(req) {
  return req.sessionUser?.role === "Administrador";
}

function canAccessTrashItem(item, req) {
  return isAdmin(req)
    || (item.audience === "personal" && Number(item.deletedById ?? item.deleted_by_user_id) === Number(req.sessionUser.id));
}

function publicTrashItem(item) {
  const payload = item.payload || {};
  return {
    id: item.id,
    itemId: item.itemId ?? item.item_id,
    itemType: item.itemType ?? item.item_type,
    batchId: item.batchId ?? item.batch_id,
    name: item.name,
    folderId: item.folderId ?? item.folder_id ?? null,
    audience: item.audience,
    ownerId: item.ownerId ?? item.owner_user_id ?? null,
    deletedById: item.deletedById ?? item.deleted_by_user_id,
    deletedByName: item.deletedByName ?? item.deleted_by_name,
    deletedAt: item.deletedAt ?? item.deleted_at,
    documentType: payload.document_type || payload.documentType || null,
    mimeType: payload.mime_type || payload.mimeType || null,
    size: Number(payload.size || 0),
    previewUrl: (item.itemType ?? item.item_type) === "document" ? `/api/trash/${item.id}/preview` : null,
  };
}

function storedNameFromPayload(payload) {
  return payload?.stored_name || payload?.storedName || null;
}

function removeStoredFiles(storedNames) {
  for (const storedName of storedNames) {
    if (!storedName) continue;
    const filePath = path.join(uploadsDir, path.basename(storedName));
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error("No se pudo eliminar el archivo de la papelera:", error.message);
    }
  }
}

function isPrivateOwnedItem(item) {
  const payload = item.payload || {};
  const ownerId = item.ownerId ?? item.owner_user_id ?? payload.ownerId ?? payload.owner_user_id;
  const deletedById = item.deletedById ?? item.deleted_by_user_id;
  const isShared = payload.isShared ?? payload.is_shared;
  return item.audience === "personal"
    && ownerId != null
    && Number(ownerId) === Number(deletedById)
    && (isShared === false || isShared === "false");
}

async function purgePrivateDatabaseContent(client, items) {
  const storedNames = [];
  const privateFolders = items.filter(item =>
    (item.itemType ?? item.item_type) === "folder" && isPrivateOwnedItem(item)
  );

  for (const item of privateFolders) {
    const ownerId = item.ownerId ?? item.owner_user_id ?? item.payload?.ownerId ?? item.payload?.owner_user_id;
    const { rows: documents } = await client.query(
      `DELETE FROM documents
       WHERE folder_id = $1 AND owner_user_id = $2 AND is_shared = FALSE
       RETURNING id, stored_name`,
      [item.itemId ?? item.item_id, ownerId]
    );
    storedNames.push(...documents.map(document => document.stored_name));
    if (documents.length) {
      await client.query(
        "DELETE FROM hidden_documents WHERE document_id = ANY($1::text[])",
        [documents.map(document => document.id)]
      );
    }
    await client.query(
      "UPDATE documents SET folder_id = NULL WHERE folder_id = $1",
      [item.itemId ?? item.item_id]
    );
    await client.query(
      "DELETE FROM folders WHERE id = $1 AND owner_user_id = $2 AND is_shared = FALSE",
      [item.itemId ?? item.item_id, ownerId]
    );
  }

  const privateDocuments = items.filter(item =>
    (item.itemType ?? item.item_type) === "document" && isPrivateOwnedItem(item)
  );
  for (const item of privateDocuments) {
    const ownerId = item.ownerId ?? item.owner_user_id ?? item.payload?.ownerId ?? item.payload?.owner_user_id;
    const { rows } = await client.query(
      `DELETE FROM documents
       WHERE id = $1 AND owner_user_id = $2 AND is_shared = FALSE
       RETURNING id, stored_name`,
      [item.itemId ?? item.item_id, ownerId]
    );
    storedNames.push(...rows.map(document => document.stored_name));
    if (rows.length) {
      await client.query("DELETE FROM hidden_documents WHERE document_id = $1", [rows[0].id]);
    }
  }

  return storedNames;
}

function purgePrivateJSONContent(items) {
  const folders = readJSON(foldersPath);
  const documents = readJSON(documentsPath);
  const privateFolders = items.filter(item => item.itemType === "folder" && isPrivateOwnedItem(item));
  const privateFolderIds = new Set(privateFolders.map(item => item.itemId));
  const privateFolderOwners = new Map(privateFolders.map(item => [item.itemId, Number(
    item.ownerId ?? item.payload?.ownerId
  )]));
  const privateDocumentIds = new Set(items
    .filter(item => item.itemType === "document" && isPrivateOwnedItem(item))
    .map(item => item.itemId));

  for (const document of documents) {
    const folderOwner = privateFolderOwners.get(document.folderId);
    if (folderOwner != null
      && Number(document.ownerId) === folderOwner
      && document.isShared === false) {
      privateDocumentIds.add(document.id);
    }
  }

  const removedDocuments = documents.filter(document => privateDocumentIds.has(document.id));
  const storedNames = removedDocuments.map(document => document.storedName || document.stored_name);
  writeJSON(documentsPath, documents
    .filter(document => !privateDocumentIds.has(document.id))
    .map(document => privateFolderIds.has(document.folderId) ? { ...document, folderId: null } : document));
  writeJSON(foldersPath, folders.filter(folder => !privateFolderIds.has(folder.id)));
  return storedNames;
}

async function restoreDatabasePayload(client, item) {
  const payload = item.payload;
  if (item.item_type === "folder") {
    await client.query(
      `INSERT INTO folders (id, name, created_at, owner_user_id, is_shared, access_roles)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [payload.id, payload.name, payload.created_at, payload.owner_user_id, payload.is_shared, payload.access_roles || []]
    );
    return;
  }

  await client.query(
    `INSERT INTO documents (id, name, stored_name, mime_type, size, folder_id, document_type, is_shared, owner_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [payload.id, payload.name, payload.stored_name, payload.mime_type, payload.size, payload.folder_id,
      payload.document_type || "Sin clasificar", payload.is_shared, payload.owner_user_id, payload.created_at]
  );
}

exports.list = async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (database.isConfigured) {
    try {
      const query = isAdmin(req)
        ? "SELECT * FROM trash_items ORDER BY deleted_at DESC"
        : "SELECT * FROM trash_items WHERE audience = 'personal' AND deleted_by_user_id = $1 ORDER BY deleted_at DESC";
      const values = isAdmin(req) ? [] : [Number(req.sessionUser.id)];
      const { rows } = await database.pool.query(query, values);
      return res.json(rows.map(publicTrashItem));
    } catch (error) {
      return next(error);
    }
  }

  const items = trashStore.readTrash().filter(item => canAccessTrashItem(item, req));
  res.json(items.sort((left, right) => new Date(right.deletedAt) - new Date(left.deletedAt)).map(publicTrashItem));
};

exports.preview = async (req, res, next) => {
  let item;
  if (database.isConfigured) {
    try {
      const { rows } = await database.pool.query("SELECT * FROM trash_items WHERE id = $1", [req.params.id]);
      item = rows[0] || null;
    } catch (error) {
      return next(error);
    }
  } else {
    item = trashStore.readTrash().find(entry => entry.id === req.params.id) || null;
  }

  if (!item || !canAccessTrashItem(item, req) || (item.itemType ?? item.item_type) !== "document") {
    return res.status(404).json({ error: "Archivo de papelera no encontrado" });
  }
  const filePath = path.join(uploadsDir, path.basename(storedNameFromPayload(item.payload) || ""));
  if (!storedNameFromPayload(item.payload) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Archivo físico no encontrado" });
  }
  res.sendFile(filePath);
};

exports.restore = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  if (database.isConfigured) {
    let client;
    let transactionStarted = false;
    try {
      client = await database.pool.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      const { rows } = await client.query("SELECT * FROM trash_items WHERE id = $1 FOR UPDATE", [req.body?.id]);
      const item = rows[0];
      if (!item || !canAccessTrashItem(item, req)) {
        return res.status(404).json({ error: "Elemento de papelera no encontrado" });
      }

      const { rows: batch } = await client.query(
        `SELECT * FROM trash_items WHERE batch_id = $1
         AND ($2 = TRUE OR (audience = 'personal' AND deleted_by_user_id = $3))
         ORDER BY CASE WHEN item_type = 'folder' THEN 0 ELSE 1 END`,
        [item.batch_id, isAdmin(req), userId]
      );
      const restoresBatch = item.item_type === "folder" || batch.some(entry => entry.item_type === "folder");
      const itemsToRestore = restoresBatch ? batch : [item];
      const personalUserId = Number(item.deleted_by_user_id || userId);

      if (item.audience === "personal") {
        for (const entry of itemsToRestore) {
          if (entry.item_type === "folder") {
            await client.query("DELETE FROM hidden_folders WHERE folder_id = $1 AND user_id = $2", [entry.item_id, personalUserId]);
          } else {
            await client.query("DELETE FROM hidden_documents WHERE document_id = $1 AND user_id = $2", [entry.item_id, personalUserId]);
          }
        }
      } else {
        for (const entry of itemsToRestore) await restoreDatabasePayload(client, entry);
      }

      const trashIds = itemsToRestore.map(entry => entry.id);
      await client.query("DELETE FROM trash_items WHERE id = ANY($1::text[])", [trashIds]);
      await client.query("COMMIT");
      transactionStarted = false;
      return res.json({ message: "Elemento restaurado", restoredCount: itemsToRestore.length });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "No se puede restaurar porque ya existe una carpeta con ese nombre" });
      }
      return next(error);
    } finally {
      if (client) {
        if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    }
  }

  const trash = trashStore.readTrash();
  const index = trash.findIndex(entry => entry.id === req.body?.id && canAccessTrashItem(entry, req));
  if (index === -1) return res.status(404).json({ error: "Elemento de papelera no encontrado" });
  const item = trash[index];
  const batch = trash.filter(entry => entry.batchId === item.batchId && canAccessTrashItem(entry, req));
  const restoresBatch = item.itemType === "folder" || batch.some(entry => entry.itemType === "folder");
  const itemsToRestore = restoresBatch ? batch : [item];
  const personalUserId = Number(item.deletedById || userId);

  if (item.audience === "personal") {
    const folders = readJSON(foldersPath);
    const docs = readJSON(documentsPath);
    const folderIds = new Set(itemsToRestore.filter(entry => entry.itemType === "folder").map(entry => entry.itemId));
    const docIds = new Set(itemsToRestore.filter(entry => entry.itemType === "document").map(entry => entry.itemId));
    writeJSON(foldersPath, folders.map(folder => folderIds.has(folder.id)
      ? { ...folder, hiddenFor: (folder.hiddenFor || []).filter(id => Number(id) !== personalUserId) }
      : folder));
    writeJSON(documentsPath, docs.map(doc => docIds.has(doc.id)
      ? { ...doc, hiddenFor: (doc.hiddenFor || []).filter(id => Number(id) !== personalUserId) }
      : doc));
  } else {
    const folders = readJSON(foldersPath);
    const docs = readJSON(documentsPath);
    const folderItems = itemsToRestore.filter(entry => entry.itemType === "folder");
    const docItems = itemsToRestore.filter(entry => entry.itemType === "document");
    folderItems.forEach(entry => { if (!folders.some(folder => folder.id === entry.itemId)) folders.push(entry.payload); });
    docItems.forEach(entry => { if (!docs.some(doc => doc.id === entry.itemId)) docs.push(entry.payload); });
    writeJSON(foldersPath, folders);
    writeJSON(documentsPath, docs);
  }

  const restoredIds = new Set(itemsToRestore.map(entry => entry.id));
  trashStore.writeTrash(trash.filter(entry => !restoredIds.has(entry.id)));
  res.json({ message: "Elemento restaurado", restoredCount: itemsToRestore.length });
};

exports.destroy = async (req, res, next) => {
  if (database.isConfigured) {
    let client;
    let transactionStarted = false;
    let itemsToDelete = [];
    let privateStoredNames = [];
    try {
      client = await database.pool.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      const { rows: selectedRows } = await client.query(
        "SELECT * FROM trash_items WHERE id = $1 FOR UPDATE",
        [req.params.id]
      );
      const selected = selectedRows[0];
      if (!selected || !canAccessTrashItem(selected, req)) {
        return res.status(404).json({ error: "Elemento de papelera no encontrado" });
      }

      const { rows: batch } = await client.query(
        `SELECT * FROM trash_items WHERE batch_id = $1
         AND ($2 = TRUE OR (audience = 'personal' AND deleted_by_user_id = $3))
         FOR UPDATE`,
        [selected.batch_id, isAdmin(req), Number(req.sessionUser.id)]
      );
      const deletesBatch = selected.item_type === "folder";
      itemsToDelete = deletesBatch ? batch : [selected];
      privateStoredNames = await purgePrivateDatabaseContent(client, itemsToDelete);
      const ids = itemsToDelete.map(item => item.id);
      await client.query("DELETE FROM trash_items WHERE id = ANY($1::text[])", [ids]);
      await client.query("COMMIT");
      transactionStarted = false;
      removeStoredFiles([...privateStoredNames, ...itemsToDelete
        .filter(item => item.audience === "global" && item.item_type === "document")
        .map(item => storedNameFromPayload(item.payload))]);
      return res.json({ message: "Elemento eliminado definitivamente", deletedCount: itemsToDelete.length });
    } catch (error) {
      return next(error);
    } finally {
      if (client) {
        if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    }
  }

  const trash = trashStore.readTrash();
  const selected = trash.find(item => item.id === req.params.id && canAccessTrashItem(item, req));
  if (!selected) return res.status(404).json({ error: "Elemento de papelera no encontrado" });
  const batch = trash.filter(item => item.batchId === selected.batchId && canAccessTrashItem(item, req));
  const deletesBatch = selected.itemType === "folder";
  const itemsToDelete = deletesBatch ? batch : [selected];
  const privateStoredNames = purgePrivateJSONContent(itemsToDelete);
  removeStoredFiles([...privateStoredNames, ...itemsToDelete
    .filter(item => item.audience === "global" && item.itemType === "document")
    .map(item => storedNameFromPayload(item.payload))]);
  const deletedIds = new Set(itemsToDelete.map(item => item.id));
  trashStore.writeTrash(trash.filter(item => !deletedIds.has(item.id)));
  return res.json({ message: "Elemento eliminado definitivamente", deletedCount: itemsToDelete.length });
};

exports.empty = async (req, res, next) => {
  const userId = Number(req.sessionUser.id);
  if (database.isConfigured) {
    try {
      const client = await database.pool.connect();
      let items;
      let privateStoredNames = [];
      try {
        await client.query("BEGIN");
        const query = isAdmin(req)
          ? "SELECT * FROM trash_items FOR UPDATE"
          : "SELECT * FROM trash_items WHERE audience = 'personal' AND deleted_by_user_id = $1 FOR UPDATE";
        const values = isAdmin(req) ? [] : [userId];
        items = (await client.query(query, values)).rows;
        privateStoredNames = await purgePrivateDatabaseContent(client, items);
        const ids = items.map(item => item.id);
        if (ids.length) await client.query("DELETE FROM trash_items WHERE id = ANY($1::text[])", [ids]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      removeStoredFiles([...privateStoredNames, ...(isAdmin(req)
        ? items.filter(item => item.audience === "global" && item.item_type === "document")
          .map(item => storedNameFromPayload(item.payload))
        : [])]);
      return res.json({ message: "Papelera vaciada", deletedCount: items.length });
    } catch (error) {
      return next(error);
    }
  }

  const trash = trashStore.readTrash();
  const items = trash.filter(item => canAccessTrashItem(item, req));
  const privateStoredNames = purgePrivateJSONContent(items);
  removeStoredFiles([...privateStoredNames, ...(isAdmin(req)
    ? items.filter(item => item.audience === "global" && item.itemType === "document")
      .map(item => storedNameFromPayload(item.payload))
    : [])]);
  const itemIds = new Set(items.map(item => item.id));
  trashStore.writeTrash(trash.filter(item => !itemIds.has(item.id)));
  res.json({ message: "Papelera vaciada", deletedCount: items.length });
};