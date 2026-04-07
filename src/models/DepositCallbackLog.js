const mongoose = require("mongoose");

const depositCallbackLogSchema = new mongoose.Schema({
  rawData: Object,
  address_in: String,
  txid: String,
  amount: Number,
  confirmations: Number,
  network: String,
  status: String,
  message: String,
}, { timestamps: true });

// 🔥 Index (important for scaling)
depositCallbackLogSchema.index({ txid: 1 });
depositCallbackLogSchema.index({ address_in: 1 });

const DepositCallbackLog = mongoose.model("DepositCallbackLog", depositCallbackLogSchema);

module.exports = DepositCallbackLog;