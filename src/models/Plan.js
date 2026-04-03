// models/Plan.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    plan_id: { type: String, required: true, unique: true },
    plan_name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true, lowercase: true },
    image: { type: String, trim: true }, // Featured image URL
    investment_amount: { type: Number, required: true, min: 0 },
    freeTokenValue: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    details: { type: String, trim: true },
    total_buyer: { type: Number, default: 0, min: 0 },
    total_investment: { type: Number, default: 0, min: 0 },
    // Inside your Plan Schema (after other fields)
    referralIncome: [
      {
        level: {
          type: Number,
          required: true,
          min: 1,
          max: 7,
        },
        commissionType: {
          type: String,
          enum: ["fixed", "percentage"],
          required: true,
        },
        value: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    levelIncome: [
      {
        level: {
          type: Number,
          required: true,
          min: 1,
          max: 25,
        },
        commissionType: {
          type: String,
          enum: ["fixed", "percentage"],
          required: true,
        },
        value: {
          type: Number,
          required: true,
          min: 0,
        },
        minDirects: {
          type: Number,
          required: true,
          min: 0,
          default: 0,
        },
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
planSchema.index({ slug: 1 });

module.exports = mongoose.model("Plan", planSchema);
