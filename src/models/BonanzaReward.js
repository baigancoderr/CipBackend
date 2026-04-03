const mongoose = require("mongoose");

const bonanzaRewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rank: { type: String, required: true },
  rewardAmount: { type: Number, required: true },
  totalDownlineInvestment: { type: Number, required: true },
  weakestLegInvestment: { type: Number, required: true },
  distributionDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BonanzaReward", bonanzaRewardSchema);