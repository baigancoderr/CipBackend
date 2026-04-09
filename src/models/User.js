const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      default: "",
    },

    userId: {
      type: String,
      unique: true,
      required: true,
    },

    referralCode: {
      type: String,
      unique: true,
      required: true,
    },

    referredBy: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Wallet & Earnings
    walletBalance: {
      type: Number,
      default: 0,
    },

    totalInvested: {
      type: Number,
      default: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    referralEarnings: {
      type: Number,
      default: 0,
    },

    dailyIncome: {
      type: Number,
      default: 0,
    },

    activePackage: {
      type: Number,
      default: 0,
    },

    totalReferrals: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Generate userId and referralCode before saving (if not provided)
userSchema.pre("save", async function (next) {
  if (!this.userId) {
    this.userId = "CPR" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  if (!this.referralCode) {
    this.referralCode = this.userId; // Use same as userId for simplicity
  }
  next();
});

module.exports = mongoose.model("User", userSchema);