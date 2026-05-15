const express = require("express");
const router = express.Router();
const {
  getPublicLivePrice,
    getPublicSupply,
} = require("../controllers/publicControllers/publicContoller");

router.get("/live-price", getPublicLivePrice);

// Supply
router.get("/supply", getPublicSupply);

module.exports = router;    