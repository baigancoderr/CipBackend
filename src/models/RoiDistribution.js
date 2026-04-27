const mongoose = require("mongoose");

const roiDistributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_id: { type: String, required: true },
  amount: { type: Number, required: true }, // ROI amount distributed
  distributionDate: { type: Date, required: true, default: Date.now },
  dailyROI: { type: Number, required: true }, // Daily ROI percentage
  stakeAmount: { type: Number, required: true }, // Original stake amount
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("RoiDistribution", roiDistributionSchema);