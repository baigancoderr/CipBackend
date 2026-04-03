const mongoose = require("mongoose");

const rankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    user_id: { type: String, required: true },
    name: { type: String, required: true },
    requiredDirects: { type: Number, required: true },
    requiredPV: { type: Number, required: true },
    dailyCap: { type: Number, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RankUpdateHistory", rankSchema);
