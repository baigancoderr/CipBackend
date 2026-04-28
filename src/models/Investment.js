const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {

    userId: {
      type: String,
      required: true,
    },

    investmentId: {
      type: String,
      required: true,
      unique: true,
    },

    amount: {
      type: Number,
      required: true, // fiat amount (USDC/SGN value)
    },

    // ====================== TOKEN FIELDS (NEW) ======================
    tokensReceived: {
      type: Number,
      required: true, // amount / current SGN price
    },

    sgnPriceAtInvestment: {
      type: Number,
      required: true, // SGN price jab investment hua tha
    },

    // ====================== RETURN IN FIAT ======================
    totalReturn: {
      type: Number,
      required: true, // amount * 1.1 (fiat me)
    },

    totalDays: {
      type: Number,
      default: 700,
    },

    dailyIncome: {
      type: Number,
      required: true, // totalReturn / 700 (fiat me)
    },

    claimedTokens: {
      type: Number,
      default: 0, // kitne tokens claim ho chuke hain
    },

    // ====================== RETURN IN TOKEN (NEW) ======================
    totalReturnTokens: {
      type: Number,
      required: true, // tokensReceived * 1.1
    },

    dailyIncomeTokens: {
      type: Number,
      required: true, // totalReturnTokens / 700
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
      enum: ["PENDING", "active", "completed", "rejected"], // ← PENDING bhi add kiya
      default: "PENDING",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", investmentSchema);