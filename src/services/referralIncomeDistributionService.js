const User = require("../models/User");
const Referral = require("../models/Referral");
const Plan = require("../models/Plan");

// ====================== DIRECT REFERRAL DISTRIBUTION ======================
async function distributeDirectReferral(investorId, amount, productId, options = {}) {
  const { session } = options;

  console.log(`[Direct Referral] Processing for investor: ${investorId} | Plan: ${productId} | Amount: ${amount}`);

  // 1. Find investor & sponsor
  const investor = await User.findOne({ user_id: investorId }).session(session || null);
  if (!investor || !investor.referredBy) {
    console.log(`[Direct Referral] No referrer found for ${investorId}`);
    return;
  }

  const sponsor = await User.findOne({ referralCode: investor.referredBy }).session(session || null);
  if (!sponsor) {
    console.log(`[Direct Referral] Sponsor not found`);
    return;
  }

  // 2. Prevent duplicate direct income for same referral + same investment
  // const existingReferral = await Referral.findOne({
  //   referrerId: sponsor.user_id,
  //   referredId: investorId,
  //   level: 1,
  // }).session(session || null);

  // if (existingReferral) {
  //   console.log(`[Direct Referral] Already processed for this sponsor-referred pair`);
  //   return;
  // }

  // 3. Fetch plan-specific referral rules
  const plan = await Plan.findOne({ plan_id: productId }).session(session || null);
  if (!plan || !plan.referralIncome || !Array.isArray(plan.referralIncome)) {
    console.log(`[Direct Referral] No referralIncome configuration found in plan ${productId}`);
    return;
  }

  // 4. Get direct referral config (Level 1)
  const directConfig = plan.referralIncome.find(item => item.level === 1);
  if (!directConfig) {
    console.log(`[Direct Referral] Level 1 (Direct) not configured in this plan`);
    return;
  }

  // 5. Calculate commission (supports both percentage & fixed)
  let directIncome = 0;

  if (directConfig.commissionType === "percentage") {
    directIncome = amount * (directConfig.value / 100);
  } else if (directConfig.commissionType === "fixed") {
    directIncome = directConfig.value;
  }

  if (directIncome <= 0) {
    console.log(`[Direct Referral] Commission amount is zero or invalid`);
    return;
  }

  // 6. Credit income to sponsor
  sponsor.referralWallet = sponsor.referralWallet || { amount: 0 };
  sponsor.referralWallet.amount += directIncome;
  sponsor.totalReferralRewards = (sponsor.totalReferralRewards || 0) + directIncome;
  sponsor.totalAllRewards = (sponsor.totalAllRewards || 0) + directIncome;

  await sponsor.save({ session: session || null });

  console.log(`✅ Direct referral income of ₹${directIncome} credited to ${sponsor.user_id}`);

  // 7. Log in Referral collection
  await Referral.create([{
    userId: sponsor._id,
    referrerId: sponsor.user_id,
    referredId: investorId,
    investmentAmount: amount,
    amount: directIncome,
    level: 1,
    status: "completed",
    planId: productId,
    commissionType: directConfig.commissionType,
    commissionValue: directConfig.value,
  }], { session: session || null });
}

module.exports = {
  distributeDirectReferral,
};