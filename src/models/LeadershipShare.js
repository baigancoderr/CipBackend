const mongoose = require("mongoose");

const leadershipShareSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  user_id: {
    type: String,
    required: true,
  },
  month: {
    type: String,
    required: true, // "2026-02"
  },
  rankQualified: {
    type: String,
    enum: ["SILVER", "GOLD", "PLATINUM", "DIAMOND", "CROWN/ROYAL"],
  },
  shares: {
    type: Number,
    required: true,
    default: 0,
  },
  selfBusiness: Number,
  directActive: Number,
  binaryVolume: Number,
  leftPV: Number,
  rightPV: Number,
  assignedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("LeadershipShare", leadershipShareSchema);