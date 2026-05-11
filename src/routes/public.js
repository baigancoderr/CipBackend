const express = require("express");
const router = express.Router();
const {
  getPublicLivePrice,
} = require("../controllers/publicControllers/publicContoller");

router.get("/live-price", getPublicLivePrice);

module.exports = router;    