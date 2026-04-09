const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 🔐 Telegram login
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
    },

    referralCode: {
      type: String,
      unique: true,
    },

    role: {
  type: String,
  enum: ["user", "admin"],
  default: "user",
},

    referredBy: {
      type: String,
      default: null,
    },

    totalReferrals: {
      type: Number,
      default: 0,
    },

    referralEarnings: {
      type: Number,
      default: 0,
    },

    // 💰 Wallet
    walletAddress: {
      type: String,
      default: "",
    },

    walletBalance: {
      type: Number,
      default: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    // 📦 Investment
    totalInvested: {
      type: Number,
      default: 0,
    },

    activePackage: {
      type: Number,
      default: 0,
    },

    dailyIncome: {
      type: Number,
      default: 0,
    },



    // 🟢 Status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);