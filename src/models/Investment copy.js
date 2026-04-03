// models/Investment.js
const mongoose = require('mongoose');

// models/Investment.js mein ye fields add kar do
const investmentSchema = new mongoose.Schema({
  // ... purane fields
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    user_id: { type: String, required: true },
  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "REJECTED"],
    default: "PENDING"
  },

  productId: { type: String },           // ya plan_id
  quantity: { type: Number, required: true },
  amount: { type: Number, required: true }, // amount_usd

  transactionHash: { type: String, required: true },
  walletAddress: { type: String, required: true },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  approvedAt: Date,
  approvalNote: String,           // ← reason/note for approve

  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rejectedAt: Date,
  rejectionReason: String,

  // agar chaho to
  paymentMethod: { type: String, default: "CRYPTO" },
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);