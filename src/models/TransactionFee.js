const mongoose = require('mongoose');

const TransactionFeeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currencyType: { type: String, default: 'USDT', enum: ['USDT', 'EMGT'] },
  withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Withdrawal' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("TransactionFee", TransactionFeeSchema);