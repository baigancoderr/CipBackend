const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  amount: { type: Number, required: true },
  creditedAmount: { type: Number, default: 0 },   // ✅ ADD THIS

  currency: { type: String, default: "USDT" },
  network: { type: String, required: true },

  depositAddress: { type: String, required: true },

  // transactionHash: { type: String, default: null },
  transactionHash: {
  type: String,
  unique: true,
  sparse: true
},

  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Deposit", depositSchema);