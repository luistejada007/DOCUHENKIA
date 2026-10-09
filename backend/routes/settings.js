const express = require("express");
const controller = require("../controllers/settingsController");
const sessionAuth = require("../middleware/sessionAuth");

const router = express.Router();

router.use(sessionAuth.requireActiveUser);
router.get("/", controller.get);
router.get("/events", controller.events);
router.put("/theme", sessionAuth.requireAdmin, controller.updateTheme);
router.post("/announcements", sessionAuth.requireAdmin, controller.createAnnouncement);
router.delete("/announcements/:id", sessionAuth.requireAdmin, controller.deleteAnnouncement);

module.exports = router;