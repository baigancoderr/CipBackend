const mongoose = require('mongoose');

const walletAddressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    user_id: {
      type: String,
      required: true,
      index: true,
    },

    walletAddress: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    remark: {
      type: String,
    },
  },
  { 
    timestamps: true   
  }
);

walletAddressSchema.index({ user: 1, createdAt: -1 });
walletAddressSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('WalletAddress', walletAddressSchema);