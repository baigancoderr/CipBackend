const mongoose = require("mongoose");

const depositCallbackLogSchema = new mongoose.Schema({
  rawData: Object,          // 🔥 full payload (MOST IMPORTANT)

  address_in: String,
  address_out: String,

  txid: String,
  amount: Number,
  value_coin: String,

  confirmations: Number,
  coin: String,
  network: String,

  fee: String,
  pending: String,

  status: String,           // success / failed / pending / duplicate / error
  message: String,

  ip: String,
  method: String,
  headers: Object

}, { timestamps: true });

// 🔥 Index for performance
depositCallbackLogSchema.index({ txid: 1 });
depositCallbackLogSchema.index({ address_in: 1 });

const DepositCallbackLog = mongoose.model("DepositCallbackLog", depositCallbackLogSchema);

module.exports = DepositCallbackLog;