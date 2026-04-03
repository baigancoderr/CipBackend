const User = require("../models/User");
const LevelIncome = require("../models/LevelIncome");
const Plan = require("../models/Plan");

// ====================== LEVEL INCOME DISTRIBUTION (Fully from Plan) ======================
async function distributeLevelIncome(investorId, amount, productId, options = {}) {
  const { session } = options;

  console.log(`[LevelIncome] Starting distribution for investor: ${investorId} | Plan: ${productId} | Amount: ${amount}`);

  // 1. Find investor
  const investor = await User.findOne({ user_id: investorId }).session(session || null);
  if (!investor || !investor.referredBy) {
    console.log(`[LevelIncome] No referrer found for ${investorId}`);
    return;
  }

  // 2. Fetch plan-specific level income rules (commission + minDirects)
  const plan = await Plan.findOne({ plan_id: productId }).session(session || null);
  if (!plan || !plan.levelIncome || !Array.isArray(plan.levelIncome)) {
    console.log(`[LevelIncome] No levelIncome configuration found in plan ${productId}`);
    return;
  }

  let currentReferralCode = investor.referredBy;
  let level = 1;

  while (currentReferralCode && level <= plan.levelIncome.length) {
    const currentUser = await User.findOne({ referralCode: currentReferralCode })
      .session(session || null);

    if (!currentUser) {
      console.log(`[LevelIncome] Upline not found at level ${level}`);
      break;
    }

    // Get full config from Plan (commission + minDirects)
    const levelConfig = plan.levelIncome.find(item => item.level === level);
    if (!levelConfig) {
      console.log(`[LevelIncome] Level ${level} configuration not found in this plan`);
      break;
    }

    const directCount = await User.countDocuments({ referredBy: currentUser.referralCode })
      .session(session || null);

    const meetsMinDirects = directCount >= levelConfig.minDirects;

    // Prevent duplicate payment
    const existingIncome = await LevelIncome.findOne({
      userId: currentUser._id,
      fromUserId: investorId,
      level,
    }).session(session || null);

    if (meetsMinDirects && !existingIncome) {
      // Calculate income (percentage or fixed)
      let levelIncome = 0;

      if (levelConfig.commissionType === "percentage") {
        levelIncome = amount * (levelConfig.value / 100);
      } else if (levelConfig.commissionType === "fixed") {
        levelIncome = levelConfig.value;
      }

      if (levelIncome <= 0) {
        console.log(`[LevelIncome] Commission amount is zero or invalid at level ${level}`);
      } else {
        // Credit to user's wallet
        currentUser.myWallet = currentUser.myWallet || { amount: 0 };
        currentUser.myWallet.amount += levelIncome;
        currentUser.totalLevelRewards = (currentUser.totalLevelRewards || 0) + levelIncome;
        currentUser.totalAllRewards = (currentUser.totalAllRewards || 0) + levelIncome;

        await currentUser.save({ session: session || null });

        // Log in LevelIncome collection
        await LevelIncome.create([{
          userId: currentUser._id,
          user_id: currentUser.user_id,
          fromUserId: investorId,
          level,
          investmentAmount: amount,
          amount: levelIncome,
          planId: productId,
          commissionType: levelConfig.commissionType,
          commissionValue: levelConfig.value,
          minDirectsRequired: levelConfig.minDirects,
          status: "completed",
        }], { session: session || null });

        console.log(`✅ Level ${level} income of ₹${levelIncome} credited to ${currentUser.user_id} (minDirects: ${levelConfig.minDirects})`);
      }
    } else if (existingIncome) {
      console.log(`[LevelIncome] Already paid for level ${level} (${currentUser.user_id})`);
    } else {
      console.log(`[LevelIncome] Skipped level ${level} (${currentUser.user_id}) → Qualification failed (directs=${directCount}, need=${levelConfig.minDirects})`);
    }

    // Always continue to next upline
    currentReferralCode = currentUser.referredBy;
    level++;
  }

  console.log(`[LevelIncome] Distribution completed for investor ${investorId}`);
}

module.exports = { distributeLevelIncome };