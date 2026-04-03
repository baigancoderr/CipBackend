const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    totalReturn: {
      type: Number, // amount * 1.1
      required: true,
    },

    dailyIncome: {
      type: Number, // totalReturn / 700
      required: true,
    },

    totalDays: {
      type: Number,
      default: 700,
    },

    claimedDays: {
      type: Number,
      default: 0,
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
    },

    lastClaimedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", investmentSchema);