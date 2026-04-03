const mongoose = require("mongoose");

const walletUpdateLogSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  oldWalletAddress: {
    type: String,
    required: true,
  },
  newWalletAddress: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
    required: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("WalletUpdateLog", walletUpdateLogSchema);