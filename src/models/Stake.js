const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stakeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stakeId: { 
    type: String, 
    required: true, 
    unique: true, 
    default: () => `STK-${uuidv4().slice(0, 8)}`
  },
  userName: { type: String, required: true },
  package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
  packageName: { type: String, required: true },
  packageStartDate: { type: Date },
  packageEndDate: { type: Date},
  dailyROI: { type: Number, required: true },
  dailyROIAmount: { type: Number, required: true },
  amount: { type: Number, required: true },
  walletType: { type: String, enum: ['principal', 'my', 'deposit', 'emgt'], required: true },
  currencyType: { type: String, enum: ['USDT', 'EMGT'], default: 'USDT' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'reinvested' , 'stopped' , 'inactive', 'active', 'swapped', 'transfer'], default: 'pending' },
  remark: { type: String, default: '' },
  isSwapped: { type: Boolean, default: false },
  isReinvested: { type: Boolean, default: false },
  isTransferredToPrincipalWallet: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  reInvestDate: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
reinvestCount: { type: Number, default: 0 }

});

// Ensure indexes for performance
stakeSchema.index({ userId: 1 });
stakeSchema.index({ stakeId: 1 });

// Pre-save hook to ensure stakeId uniqueness
stakeSchema.pre('save', async function(next) {
  if (this.isNew) {
    let isUnique = false;
    let attempt = 0;
    const maxAttempts = 5;

    while (!isUnique && attempt < maxAttempts) {
      try {
        const existingStake = await this.constructor.findOne({ stakeId: this.stakeId });
        if (!existingStake) {
          isUnique = true;
        } else {
          this.stakeId = `STK-${uuidv4().slice(0, 8)}`;
          attempt++;
        }
      } catch (error) {
        return next(new Error(`Failed to verify stakeId uniqueness: ${error.message}`));
      }
    }

    if (!isUnique) {
      return next(new Error(`Unable to generate a unique stakeId after ${maxAttempts} attempts`));
    }
  }
  next();
});

module.exports = mongoose.model('Stake', stakeSchema);