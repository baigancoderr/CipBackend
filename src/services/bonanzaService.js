const User = require('../models/User');
const Transaction = require('../models/Transaction');
const moment = require('moment');

const bonanzaRanks = [
  { name: 'Silver - V1', roi: 0.10, target: 10000 },
  { name: 'Gold', roi: 0.20, target: 30000 },
  { name: 'Platinum', roi: 0.30, target: 60000 },
  { name: 'Emerald', roi: 0.40, target: 125000 },
  { name: 'Diamond', roi: 0.50, target: 150000 },
  { name: 'Double Diamond', roi: 0.60, target: 500000 },
  { name: 'Black Diamond', roi: 0.70, target: 750000 },
  { name: 'Double Diamond (2)', roi: 0.80, target: 1000000 },
  { name: 'Vice Chancellor Club', roi: 0.90, target: 1500000 },
  { name: 'Chairman Club', roi: 1.00, target: 3000000 },
];

const calculateBonanzaReward = async (userId) => {
  const user = await User.findById(userId).populate('referrals');
  if (!user) return;

  const totalVolume = await Referral.aggregate([
    { $match: { referrerId: user._id } },
    { $group: { _id: null, total: { $sum: '$investmentAmount' } } },
  ]).then(res => res[0]?.total || 0);

  const rank = bonanzaRanks.find(r => totalVolume >= r.target);
  if (!rank) return;

  const totalReward = totalVolume * rank.roi;
  const dailyReward = totalReward / 270;
  const netDailyReward = dailyReward;

  user.myWallet.amount += netDailyReward;
  await user.save();

  await Transaction.create({
    userId,
    type: 'bonanza',
    amount: netDailyReward,
    walletType: 'my',
    status: 'completed',
  });
};

module.exports = { calculateBonanzaReward };