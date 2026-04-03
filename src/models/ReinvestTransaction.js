const mongoose = require("mongoose");

const reinvestTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  stakeId: {
    type: String,
    required: true,
    comment: "Old stake ID (from which reinvestment happened)",
  },
  newStakeId: {
    type: String,
    required: true,
    unique: true,
    comment: "New stake ID created after reinvestment",
  },
  amount: { type: Number, required: true },
  packageStartDate: { type: Date, required: true },
  packageEndDate: { type: Date, required: true },
  lockingPeriodDays: { type: Number, required: true },
  walletType: { type: String, default: "deposit" },
  currencyType: { type: String, default: "USDT" },
  transactionDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed",
  },
  remark: { type: String, default: "Reinvested" },
  createdAt: { type: Date, default: Date.now },
});

// Indexes for fast queries
reinvestTransactionSchema.index({ userId: 1, transactionDate: -1 });
reinvestTransactionSchema.index({ stakeId: 1 });
reinvestTransactionSchema.index({ newStakeId: 1 });

module.exports = mongoose.model("ReinvestTransaction", reinvestTransactionSchema);