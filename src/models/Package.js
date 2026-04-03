const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  packageId: { type: String, required: true, unique: true },
  investment: { type: Number, required: true },
  dailyROI: { type: Number, required: true },
  lockingPeriodDays: { type: Number, required: true },
  tokenConversionLockUntil: { type: Date, default: null },
});



module.exports = mongoose.model('Package', packageSchema);