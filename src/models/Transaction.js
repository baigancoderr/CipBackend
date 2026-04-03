const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'stake', 'referral', 'bonanza', 'withdrawal', 'swap'], required: true },
  amount: { type: Number, required: true },
  walletType: { type: String, enum: ['principal', 'my'], required: true },
  currencyType: { type: String, enum: ['USDT', 'EMGT'], default: 'USDT' }, // New field
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  swapDetails: { type: Object, default: null }, // For swap transactions
});

module.exports = mongoose.model('Transaction', transactionSchema);