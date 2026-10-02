const express = require("express");
const controller = require("../controllers/trashController");

const router = express.Router();

router.get("/", controller.list);
router.post("/restore", controller.restore);
router.delete("/", controller.empty);
router.delete("/:id", controller.destroy);
router.get("/:id/preview", controller.preview);

module.exports = router;