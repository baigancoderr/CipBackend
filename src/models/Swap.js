const mongoose = require("mongoose");

const swapSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  swapId: {
    type: String,
    unique: true,
    required: true,
  },
  fromWallet: {
    type: String,
    enum: ["referral", "roi"],
    required: true,
  },
  toWallet: {
    type: String,
    default: "deposit",
  },
  fromAmount: {
    type: Number,
    required: true,
  },
  toAmount: {
    type: Number,
    required: true,
  },
  priceUsed: {           // only filled when swapping from ROI wallet
    type: Number,
  },
  status: {
    type: String,
    enum: ["completed"],
    default: "completed",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Swap", swapSchema);