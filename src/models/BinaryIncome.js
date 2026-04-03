// models/BinaryIncome.js
const mongoose = require("mongoose");

const binaryIncomeSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    user_id: { type: String, required: true },
    leftChildInvestment: { type: Number, required: true },
    rightChildInvestment: { type: Number, required: true },
    leftCarryForward: { type: Number, default: 0 },
    rightCarryForward: { type: Number, default: 0 },
    previousLeftCarry: {
      type: Number,
      default: 0,
    },

    previousRightCarry: {
      type: Number,
      default: 0,
    },
    binaryPercentage: { type: Number, required: true },
    matches: { type: Number, required: true },
    amount: { type: Number, required: true },
    distributionDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BinaryIncome", binaryIncomeSchema);
