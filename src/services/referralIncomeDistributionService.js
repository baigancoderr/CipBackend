const User = require("../models/User");
const Referral = require("../models/Referral");

// ====================== REFERRAL COMMISSION DISTRIBUTION (Fixed 15% - 5 Levels) ======================
async function distributeReferralIncome(investorId, amount, productId, options = {}) {
  const { session } = options;

  console.log(`[Referral Income] Processing for investor: ${investorId} | Plan: ${productId} | Amount: ₹${amount}`);

  if (!amount || amount <= 0) {
    console.log("[Referral Income] Invalid investment amount");
    return;
  }

  // Fixed 15% referral commission structure
  const levelPercentages = [0, 7, 3, 2, 2, 1]; // index 1 = Level 1, index 5 = Level 5

  let currentUserId = investorId;
  let level = 1;
  let totalDistributed = 0;

  while (level <= 5) {
    // Get current investor in chain
    const currentInvestor = await User.findOne({ user_id: currentUserId }).session(session || null);
    if (!currentInvestor || !currentInvestor.referredBy) {
      console.log(`[Referral Income] Level ${level}: No further referrer found`);
      break;
    }

    // Get sponsor (referrer)
    const sponsor = await User.findOne({ referralCode: currentInvestor.referredBy }).session(session || null);
    if (!sponsor) {
      console.log(`[Referral Income] Level ${level}: Sponsor not found`);
      break;
    }

    const commissionPercent = levelPercentages[level];
    const commissionAmount = parseFloat((amount * (commissionPercent / 100)).toFixed(2));

    if (commissionAmount > 0) {
      // Credit to sponsor's wallet
      sponsor.referralWallet = sponsor.referralWallet || { amount: 0 };
      sponsor.referralWallet.amount += commissionAmount;

      sponsor.totalReferralRewards = (sponsor.totalReferralRewards || 0) + commissionAmount;
      sponsor.totalAllRewards = (sponsor.totalAllRewards || 0) + commissionAmount;

      await sponsor.save({ session: session || null });

      // Log in Referral collection
      await Referral.create(
        [{
          userId: sponsor._id,
          referrerId: sponsor.user_id,
          referredId: investorId,
          investmentAmount: amount,
          amount: commissionAmount,
          level: level,
          status: "completed",
          planId: productId,
          commissionType: "percentage",
          commissionValue: commissionPercent,
        }],
        { session: session || null }
      );

      totalDistributed += commissionAmount;
      console.log(`✅ Level ${level} (${commissionPercent}%) → ₹${commissionAmount} credited to ${sponsor.user_id}`);
    }

    // Move up the referral chain
    currentUserId = sponsor.user_id;
    level++;
  }

  console.log(`[Referral Income] Total Distributed: ₹${totalDistributed.toFixed(2)} (15% of investment)`);
}

module.exports = {
  distributeReferralIncome,
};