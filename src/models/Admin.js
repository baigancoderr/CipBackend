const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  password: { type: String, required: true },
  walletAddress: { type: String, unique: true },
  referredBy: { type: String, default: 'admin123' },
  referralCode: { type: String, default: 'admin123' },
  isEmailVerified: { type: Boolean, default: false },
  swapFeeCollected: { type: Number, default: 0 },
  transactionFeeCollected: { type: Number, default: 0 },
  role: { type: String, enum: ["admin"], default: "admin" },
});

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare passwords
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);