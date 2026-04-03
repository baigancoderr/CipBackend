// models/LevelIncome.js
const mongoose = require("mongoose");

const levelIncomeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    user_id: { type: String, required: true },
    fromUserId: { type: String, ref: "User", required: true },
    level: { type: Number, required: true },
    investmentAmount: { type: Number, required: true },
    amount: { type: Number, required: true },
    distributionDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LevelIncome", levelIncomeSchema);
