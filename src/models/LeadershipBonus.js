const mongoose = require("mongoose");

const leadershipBonusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_id: { type: String, required: true },
  month: { type: Date, required: true }, 
  rank: { type: String, required: true },
  shares: { type: Number, required: true },
  turnover: { type: Number, required: true },
  poolAmount: { type: Number, required: true },
  totalShares: { type: Number, required: true },
  bonusAmount: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model("LeadershipBonus", leadershipBonusSchema);