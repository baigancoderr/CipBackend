// models/MarketplaceListing.js
const mongoose = require('mongoose');

const marketplaceListingSchema = new mongoose.Schema({
  seller_id: { type: String, ref: 'User', required: true },
  property_id: { type: String, ref: 'Property', required: true },
  investment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment' },
  token_id: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  total_price: { type: Number, required: true },
  listing_type: { type: String, enum: ['READY_SHARE', 'TOKEN'], required: true },
  status: { type: String, enum: ['OPEN', 'SOLD', 'CANCELLED'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('MarketplaceListing', marketplaceListingSchema);