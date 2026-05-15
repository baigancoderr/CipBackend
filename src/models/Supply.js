const mongoose = require('mongoose');

const supplySchema = new mongoose.Schema({
  currencyType: { 
    type: String, 
    enum: ['SGN'], 
    required: true, 
    unique: true 
  },

  totalSupply: { 
    type: Number, 
    default: 0 
  },

  burnSupply: { 
    type: Number, 
    default: 0 
  },

  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
});

supplySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

supplySchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = mongoose.model('Supply', supplySchema);