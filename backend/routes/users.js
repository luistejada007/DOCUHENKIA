const express = require("express");
const router = express.Router();
const controller = require("../controllers/usersController");

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);

module.exports = router;
