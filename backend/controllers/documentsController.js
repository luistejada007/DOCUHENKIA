const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const dbPath = path.join(__dirname, "..", "data", "documents.json");
const uploadsDir = path.join(__dirname, "..", "uploads");
const foldersPath = path.join(__dirname, "..", "data", "folders.json");

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
  return {
    ...doc,
    previewUrl: `/uploads/${doc.storedName}`
  };
}

exports.list = (req, res) => {
  const docs = readDB()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicDocument);

  res.json(docs);
};

exports.upload = (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: "No se recibieron archivos" });
  }

  const db = readDB();
  const folderId = String(req.body?.folderId || "").trim() || null;
  if (folderId && !readFolders().some(folder => folder.id === folderId)) {
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
      createdAt: new Date().toISOString()
    };
    db.push(doc);
    return publicDocument(doc);
  });

  writeDB(db);
  res.status(201).json(created);
};

exports.getOne = (req, res) => {
  const doc = readDB().find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  res.json(publicDocument(doc));
};

exports.download = (req, res) => {
  const doc = readDB().find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  const filePath = path.join(uploadsDir, doc.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Archivo físico no encontrado" });
  }

  res.download(filePath, doc.name);
};

exports.remove = (req, res) => {
  const db = readDB();
  const index = db.findIndex(d => d.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Documento no encontrado" });
  }

  const [doc] = db.splice(index, 1);
  const filePath = path.join(uploadsDir, doc.storedName);

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeDB(db);

  res.json({ message: "Documento eliminado correctamente" });
};
