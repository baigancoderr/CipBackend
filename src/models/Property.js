// models/Property.js
const mongoose = require("mongoose");

const blockchainSchema = new mongoose.Schema({
  network: { type: String, trim: true },
  smartContract: { type: String, trim: true },
  totalSupply: { type: String },
});

const overviewSchema = new mongoose.Schema({
  about: { type: String, trim: true },
  blockchain: blockchainSchema,
  amenities: [{ type: String, trim: true }],
});

const listingSchema = new mongoose.Schema({
  seller: { type: String },
  tokens: { type: Number, min: 1 },
  price: { type: Number, min: 0 },
});

const marketplaceSchema = new mongoose.Schema({
  listings: [listingSchema],
});

const documentSchema = new mongoose.Schema({
  title: { type: String, trim: true, required: true },   // Changed from 'name'
  type: { type: String, trim: true },
  link: { type: String, trim: true },                    // kept for backward compatibility
  url: { type: String, trim: true },                     // added for frontend convenience
});

const financialMetricSchema = new mongoose.Schema({
  annualYield: { type: Number, min: 0 },
  rentalIncome: { type: Number, min: 0 },
  valueGrowth: { type: Number, min: 0 },
});

const financialBreakdownSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  value: { type: Number, min: 0 },
  max: { type: Number, min: 0 },
});

const financialsSchema = new mongoose.Schema({
  metrics: financialMetricSchema,
  breakdown: [financialBreakdownSchema],
});

const partnerSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  verified: { type: Boolean, default: false },
});

const teamMemberSchema = new mongoose.Schema({
  role: { type: String, trim: true },
  name: { type: String, trim: true },
  color: { type: String },
  bgcolor: { type: String },
  icon: { type: String },
});

const milestoneSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  status: { type: String, trim: true },
  desc: { type: String, trim: true },
  target: { type: String },
  progress: { type: Number, min: 0, max: 100 },
});

const calculatorSchema = new mongoose.Schema({
  minInvestment: { type: String },
  expectedReturn: { type: String },
  lockIn: { type: String },
});

const keyFeatureSchema = new mongoose.Schema({
  icon: { type: String },
  title: { type: String, trim: true },
  desc: { type: String, trim: true },
  bg: { type: String },
  color: { type: String },
  monincome: { type: String },
});

const benefitSchema = new mongoose.Schema({
  icon: { type: String },
  title: { type: String, trim: true },
  desc: { type: String, trim: true },
  bg: { type: String },
  iconBg: { type: String },
  iconColor: { type: String },
});

const sidebarSchema = new mongoose.Schema({
  totalValue: { type: String },
  minInv: { type: String },
  expectedROI: { type: String },
  duration: { type: String },
  completion: { type: String },
  progress: { type: Number, min: 0, max: 100 },
  funprogress: { type: Number, min: 0, max: 100 },
  investors: { type: Number, min: 0 },
  raised: { type: String },
});

const tabsOverviewSchema = new mongoose.Schema({
  about: { type: String, trim: true },
  details: {
    beds: { type: Number, min: 0 },
    baths: { type: Number, min: 0 },
  },
  team: [teamMemberSchema],
  amenities: [{ type: String, trim: true }],
});

const tabsSchema = new mongoose.Schema({
  overview: tabsOverviewSchema,
  milestones: [milestoneSchema],
  calculator: calculatorSchema,
  documents: [{ type: String }], // array of document titles/IDs
});

const propertySchema = new mongoose.Schema(
  {
    property_id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true, lowercase: true },
    category: {
      type: String,
      enum: ["READY_MADE", "UNDER_CONSTRUCTION", "TOKENIZED"],
      required: true,
    },
    location: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    images: [{ type: String }],
    image: { type: String }, // featured image
    gallery: [{ type: String }], // READY_MADE specific

    chain: { type: String },
    tokenPrice: { type: Number, min: 0 },
    property_total_value_usd: { type: Number, required: true, min: 0 },
    property_per_sqft_price_usd: { type: Number, required: true, min: 0 },
    property_total_area: { type: Number, required: true, min: 0 },
    property_totalAreaPurchased: { type: Number, min: 0 },
    property_totalAvailableArea: { type: Number, required: true, min: 0 },
    property_total_buyers: { type: Number, min: 0 },

    //tokenized specific
    total_tokens_supply: { type: Number, min: 0 },
    available_tokens_supply: { type: Number, min: 0 },
    sold_tokens_supply: { type: Number, min: 0 },

    min_invest: { type: Number, min: 0 },
    beds: { type: Number, min: 0 },
    baths: { type: Number, min: 0 },

    risk_level: { type: String, required: true },
    status: {
      type: String,
      enum: ["COMING_SOON", "AVAILABLE", "SOLD_OUT", "COMPLETED"],
      required: true,
    },
    rental_percentage: { type: Number, required: true, min: 0, max: 100 },

    // Shared
    overview: overviewSchema,
    marketplace: marketplaceSchema,
    documents: [documentSchema],
    financials: financialsSchema,
    partner: partnerSchema,

    // READY_MADE specific
    deal: { type: String },

    // UNDER_CONSTRUCTION specific (added missing fields)
    construction: { type: String },
    construction_stage: { type: String },
    projectCompletion: { type: String },        // ← Added
    StartDate: { type: String },
    Enddate: { type: String },
    structure: { type: String },                // ← Added
    exit: { type: String },                     // ← Added
    overallprogress: { type: Number, min: 0, max: 100 },

    sidebar: sidebarSchema,
    tabs: tabsSchema,
    keyFeatures: [keyFeatureSchema],
    benefits: [benefitSchema],

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
propertySchema.index({ slug: 1 });
propertySchema.index({ category: 1, status: 1 });
propertySchema.index({ "documents.title": 1 });

module.exports = mongoose.model("Property", propertySchema);