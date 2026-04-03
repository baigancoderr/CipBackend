const mongoose = require("mongoose");

const swapSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_id: { type: String, required: true },
  usdtAmount: { type: Number, required: true },
  emgtAmount: { type: Number, required: true },
  tokenPrice: { type: Number, required: true },
  swapFee: { type: Number, required: true },
  walletType: {
    type: String,
    enum: ["deposit"],
    required: true,
  },
  currencyType: { type: String, enum: ["USDT", "URWA"], default: "URWA" }, // Default to EMGT for swaps
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  swapDetails: { type: Object, default: null }, // For original amount, fee, token amount
  remark: { type: String, default: "Swapped" },
});

module.exports = mongoose.model("Swap", swapSchema);
