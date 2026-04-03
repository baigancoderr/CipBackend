const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user_id: { type: String, required: true },

  amount: { type: Number, required: true },

  currency: { type: String, default: "USDT" },

  depositAddress: { type: String, required: true },

  transactionHash: { type: String, default: null },

  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Deposit", depositSchema);