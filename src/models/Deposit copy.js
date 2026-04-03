const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user_id: { type: String, required: true },
  amount: { type: Number, required: true },
  walletType: { type: String, enum: ['principal', 'my', 'deposit'], required: true },
  
  currencyType: { type: String, enum: ['USDT', 'EMGT'], default: 'USDT' },
  transactionHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Deposit', depositSchema);