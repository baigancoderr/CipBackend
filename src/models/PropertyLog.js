// models/PropertyLog.js
const mongoose = require('mongoose');

const propertyLogSchema = new mongoose.Schema({
  property_id: { type: String, required: true },
  action: { type: String, enum: ['create', 'update', 'delete'], required: true },
  changed_by: { type: String, ref: 'Admin', required: true },
  changes: { type: Object }, // JSON of changes (old/new values for update)
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PropertyLog', propertyLogSchema);