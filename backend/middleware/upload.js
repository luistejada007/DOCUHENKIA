const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const allowed = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (allowed.has(file.mimetype)) return cb(null, true);
  cb(new Error("Tipo de archivo no permitido"));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});
