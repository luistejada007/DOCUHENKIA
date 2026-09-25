const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const foldersPath = path.join(__dirname, "..", "data", "folders.json");
const documentsPath = path.join(__dirname, "..", "data", "documents.json");

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

exports.list = (req, res) => {
  const folders = readJSON(foldersPath).sort((a, b) => a.name.localeCompare(b.name));
  const documents = readJSON(documentsPath);
  const counts = documents.reduce((result, document) => {
    if (document.folderId) result[document.folderId] = (result[document.folderId] || 0) + 1;
    return result;
  }, {});

  res.json(folders.map(folder => ({ ...folder, documentCount: counts[folder.id] || 0 })));
};

exports.create = (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "El nombre de la carpeta es obligatorio" });
  if (name.length > 80) return res.status(400).json({ error: "El nombre es demasiado largo" });

  const folders = readJSON(foldersPath);
  if (folders.some(folder => folder.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "Ya existe una carpeta con ese nombre" });
  }

  const folder = { id: uuidv4(), name, createdAt: new Date().toISOString() };
  folders.push(folder);
  writeFolders(folders);
  res.status(201).json({ ...folder, documentCount: 0 });
};

exports.remove = (req, res) => {
  const folders = readJSON(foldersPath);
  const index = folders.findIndex(folder => folder.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Carpeta no encontrada" });

  const documents = readJSON(documentsPath);
  if (documents.some(document => document.folderId === req.params.id)) {
    return res.status(409).json({ error: "La carpeta contiene documentos. Muévelos o elimínalos antes de borrarla" });
  }

  folders.splice(index, 1);
  writeFolders(folders);
  res.json({ message: "Carpeta eliminada correctamente" });
};
