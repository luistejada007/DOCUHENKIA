const fs = require("fs");
const path = require("path");
const database = require("./database");
const trashStore = require("./trashStore");

const RETENTION_DAYS = 30;
const uploadsDir = path.join(__dirname, "uploads");

function removeGlobalFiles(items) {
  for (const item of items) {
    if (item.audience !== "global" || (item.itemType ?? item.item_type) !== "document") continue;
    const payload = item.payload || {};
    const storedName = payload.stored_name || payload.storedName;
    if (!storedName) continue;
    const filePath = path.join(uploadsDir, path.basename(storedName));
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`No se pudo eliminar el archivo vencido ${path.basename(storedName)}:`, error.message);
    }
  }
}

async function purgeExpiredTrash() {
  if (database.isConfigured) {
    const { rows } = await database.pool.query(
      "DELETE FROM trash_items WHERE deleted_at <= NOW() - ($1 * INTERVAL '1 day') RETURNING audience, item_type, payload",
      [RETENTION_DAYS]
    );
    removeGlobalFiles(rows);
    return rows.length;
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const trash = trashStore.readTrash();
  const expired = trash.filter(item => {
    const deletedAt = Date.parse(item.deletedAt);
    return Number.isFinite(deletedAt) && deletedAt <= cutoff;
  });
  if (!expired.length) return 0;

  const expiredIds = new Set(expired.map(item => item.id));
  trashStore.writeTrash(trash.filter(item => !expiredIds.has(item.id)));
  removeGlobalFiles(expired);
  return expired.length;
}

module.exports = { purgeExpiredTrash, RETENTION_DAYS };