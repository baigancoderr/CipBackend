const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  currencyType: { type: String, enum: ['USDT', 'SGN'], required: true, unique: true },
  price: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Price', priceSchema);