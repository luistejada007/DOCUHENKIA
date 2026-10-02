const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const controller = require("../controllers/documentsController");

router.get("/", controller.list);
router.post("/upload", upload.array("documents", 10), controller.upload);
router.get("/:id/preview", controller.preview);
router.get("/:id/download", controller.download);
router.get("/:id", controller.getOne);
router.delete("/:id", controller.remove);

module.exports = router;
