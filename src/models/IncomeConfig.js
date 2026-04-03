// models/IncomeConfig.js
const mongoose = require("mongoose");

const incomeConfigSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["directReferral", "level"],
    required: true,
  },
  level: {
    type: Number,
    required: function () {
      return this.type === "level";
    },
    min: 1,
    max: 24, // Assuming up to 24 levels
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
  },
  minDirects: {
    type: Number,
    required: function () {
      return this.type === "level";
    },
    min: 0,
  },
}, { timestamps: true });

// Ensure unique levels for 'level' type
incomeConfigSchema.index({ type: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("IncomeConfig", incomeConfigSchema);