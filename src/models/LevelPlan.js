const mongoose = require('mongoose');

const levelPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  roi: { type: Number, required: true },
  strongLeg: { type: Number, required: true },
  weakLeg: { type: Number, required: true },
  target: { type: Number, required: true },
});

module.exports = mongoose.model('LevelPlan', levelPlanSchema);