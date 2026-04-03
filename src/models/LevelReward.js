const mongoose = require("mongoose");

const levelRewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rank: { type: String, required: true },
  rewardAmount: { type: Number, required: true },
  teamTotalRoiRewardDistributed: { type: Number, required: true },
  totalTeamInvestment: { type: Number, required: true },
  stronglegInvestment: { type: Number, required: true },
  weakestLegInvestment: { type: Number, required: true },
  distributionDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ["pending", "completed", "stopped"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("LevelReward", levelRewardSchema);