const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const trashPath = path.join(__dirname, "data", "trash.json");

function readTrash() {
  try {
    return JSON.parse(fs.readFileSync(trashPath, "utf8"));
  } catch {
    return [];
  }
}

function writeTrash(items) {
  fs.writeFileSync(trashPath, JSON.stringify(items, null, 2));
}

function createEntry({ itemType, itemId, batchId, name, folderId, audience, ownerId, deletedById, deletedByName, payload }) {
  return {
    id: uuidv4(),
    itemType,
    itemId,
    batchId,
    name,
    folderId: folderId || null,
    audience,
    ownerId: ownerId || null,
    deletedById,
    deletedByName,
    deletedAt: new Date().toISOString(),
    payload,
  };
}

async function insertEntry(client, item) {
  await client.query(
    `INSERT INTO trash_items
       (id, item_type, item_id, batch_id, name, folder_id, audience, owner_user_id, deleted_by_user_id, deleted_by_name, deleted_at, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [item.id, item.itemType, item.itemId, item.batchId, item.name, item.folderId, item.audience,
      item.ownerId, item.deletedById, item.deletedByName, item.deletedAt, JSON.stringify(item.payload)]
  );
}

module.exports = { readTrash, writeTrash, createEntry, insertEntry };