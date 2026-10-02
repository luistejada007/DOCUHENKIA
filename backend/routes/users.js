const express = require("express");
const router = express.Router();
const controller = require("../controllers/usersController");
const sessionAuth = require("../middleware/sessionAuth");
const avatarUpload = require("../middleware/avatarUpload");

router.use(sessionAuth.requireActiveUser);
router.get("/", controller.list);
router.get("/activity", sessionAuth.requireAdmin, controller.activity);
router.post("/", sessionAuth.requireAdmin, controller.create);
router.get("/:id/avatar", controller.getAvatar);
router.post("/:id/avatar", sessionAuth.authorizeUserUpdate, avatarUpload, controller.updateAvatar);
router.get("/:id", controller.getById);
router.put("/:id", sessionAuth.authorizeUserUpdate, controller.update);
router.delete("/:id", sessionAuth.requireAdmin, controller.remove);

module.exports = router;
