const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const extensionsByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "uploads"),
    filename: (req, file, callback) => {
      callback(null, `${uuidv4()}${extensionsByMimeType[file.mimetype] || ""}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    if (extensionsByMimeType[file.mimetype]) return callback(null, true);
    const error = new Error("Usa una imagen PNG, JPG, WEBP o GIF");
    error.status = 400;
    callback(error);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

module.exports = (req, res, next) => {
  upload.single("avatar")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      error.status = 400;
      error.message = "La imagen debe pesar menos de 5 MB";
    }
    next(error);
  });
};