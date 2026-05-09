const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  amount: { type: Number, required: true },
  creditedAmount: { type: Number, default: 0 },   // ✅ ADD THIS

  // currency: { type: String, default: "USDT" },
  currency: { type: String, required: true },
  network: { type: String, required: true },

  // depositAddress: { type: String, required: true },
  depositAddress: { type: String, required: false },

  // transactionHash: { type: String, default: null },
  transactionHash: {
  type: String,
  unique: true,
  sparse: true
},



  expiresAt: {
  type: Date,
},

status: {
  type: String,
  enum: [
    "initiated",
    "pending",
    "processing",
    "completed",
    "failed",
    "expired",
    "late_completed",
  ],
  default: "initiated",
},

  uuid: {
    type: String,
    index: true
  }, 
callbackUrl: { type: String }, 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Deposit", depositSchema);