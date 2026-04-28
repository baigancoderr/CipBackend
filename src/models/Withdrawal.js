const mongoose = require("mongoose");
const { withdraw } = require("../controllers/userControllers/userController");
const { unique } = require("drizzle-orm/gel-core");

const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  actualPayAmount: { type: Number, required: true },
  withdrawalFee: { type: Number, required: true },
  withdrawalFeePercentage: { type: Number, required: true },
  walletType: { type: String, enum: ["deposit", "referral", "roi"], required: true },
  currencyType: { type: String, enum: ["USDC", "CIP"], default: "USDC" },
  status: { type: String, enum: ["pending", "completed", "rejected"], default: "pending" },
  walletAddress: { type: String, required: true },
  transactionHash: { type: String, unique: true }, 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);