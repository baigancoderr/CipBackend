// models/Referral.js
const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    investmentId: {
      type: String,
      ref: "Investment",
      required: true,
    },
    referrerId: { type: String, ref: "User", required: true },
    referredId: { type: String, ref: "User", required: true },
    level: { type: Number, required: true },
    investmentAmount: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "completed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", referralSchema);
