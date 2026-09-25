const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const documentRoutes = require("./routes/documents");
const folderRoutes = require("./routes/folders");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 3001;

const uploadsDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const frontendDir = path.join(__dirname, "..", "frontend");
const frontendDistDir = path.join(frontendDir, "dist");

for (const dir of [uploadsDir, dataDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const dbFile = path.join(dataDir, "documents.json");
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "[]");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.use("/uploads", express.static(uploadsDir));
app.use("/api/auth", authRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/users", usersRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "DOCUHENKIA" });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta de API no encontrada" });
});

const frontendServeDir = fs.existsSync(frontendDistDir) ? frontendDistDir : frontendDir;
app.use(express.static(frontendServeDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendServeDir, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Error interno del servidor"
  });
});

app.listen(PORT, () => {
  console.log(`DOCUHENKIA ejecutándose en http://localhost:${PORT}`);
});
