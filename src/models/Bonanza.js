const mongoose = require('mongoose');

const bonanzaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  walletType: { type: String, enum: ['principal', 'my'], required: true },
  currencyType: { type: String, enum: ['USDT', 'EMGT'], default: 'USDT' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bonanza', bonanzaSchema);