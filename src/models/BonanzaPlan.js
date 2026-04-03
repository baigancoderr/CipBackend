const mongoose = require('mongoose');

const bonanzaPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  roi: { type: Number, required: true },
  minDirect: { type: Number, required: true },
  target: { type: Number, required: true },
});

module.exports = mongoose.model('BonanzaPlan', bonanzaPlanSchema);