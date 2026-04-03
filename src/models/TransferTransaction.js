const mongoose = require("mongoose");

const transferTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  stakeId: { type: String, required: true, ref: "Stake" },
  amount: { type: Number, required: true },
  transactionDate: { type: Date, required: true, default: Date.now },
  walletType: { type: String, required: true, default: "principal" }, // Destination wallet
  currencyType: { type: String, required: true, default: "USDT" },
  status: { type: String, required: true, default: "completed" },
  createdAt: { type: Date, default: Date.now },
  remark: { type: String, default: "Transferred" },
});

module.exports = mongoose.model("TransferTransaction", transferTransactionSchema);