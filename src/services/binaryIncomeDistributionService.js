const User = require("../models/User");
const BinaryIncome = require("../models/BinaryIncome"); 
const RankUpdateHistory = require("../models/RankUpdateHistory"); 

async function calculateSubtreeInvestment(userId) {
  const user = await User.findOne({ user_id: userId }).select('totalSelfInvestment left right');
  if (!user) return 0;

  let total = user.totalSelfInvestment || 0;

  if (user.left) {
    total += await calculateSubtreeInvestment(user.left);
  }

  if (user.right) {
    total += await calculateSubtreeInvestment(user.right);
  }

  return total;
}

async function calculateLegInvestment(userId, leg) {
  const user = await User.findOne({ user_id: userId }).select('left right');
  if (!user) return 0;

  const childId = leg === 'left' ? user.left : user.right;
  if (!childId) return 0;

  return await calculateSubtreeInvestment(childId);
}

// Helper to distribute binary income (one-time per investment, match based on totals)
async function distributeBinaryIncome(investorId, amount) {
  console.log("Deprecated: Binary income is now distributed daily via cron job.");
  return;
}

// Helper to calculate binary match for a user
async function calculateBinaryMatch(user) {
  const PAYOUT_PERCENTAGE = 0.1; // 10% of weaker leg increment

  // Check qualification: at least 3 direct active referrals
const leftDirects = await User.countDocuments({
    referredBy: user.referralCode,
    position: "left",
    totalSelfInvestment: { $gt: 0 }
  });

  const rightDirects = await User.countDocuments({
    referredBy: user.referralCode,
    position: "right",
    totalSelfInvestment: { $gt: 0 }
  });

  const totalDirectActive = leftDirects + rightDirects;

  if (totalDirectActive < 3 || leftDirects < 1 || rightDirects < 1) {
    // console.log(`No binary for ${user.user_id}: ${leftDirects} left + ${rightDirects} right (need 2:1 minimum)`);
    return;
  }

  const left = user.leftLegInvestment || 0;
  const right = user.rightLegInvestment || 0;

  console.log(`Match calc for user ${user.user_id}: initial left=${left}, right=${right}`);

  const current_match = Math.min(left, right);

  if (current_match <= 0) {
    console.log('No binary payout: no new match');
    return;
  }

  const binaryIncome = current_match * PAYOUT_PERCENTAGE;

  console.log(`Payable match: ${current_match}, Binary income calculated: ${binaryIncome}`);

  // Apply daily cap based on rank - use user's binary_daily_cap field
  const dailyCap = user.binary_daily_cap || 100;
  const earned = user.binary_daily_earned || 0;
  const cappedIncome = Math.min(binaryIncome, dailyCap - earned);
  console.log(`Daily cap: ${dailyCap}, already earned: ${earned}, capped income: ${cappedIncome}`);

  // Credit the capped income
  user.myWallet.amount += cappedIncome;
  user.totalBinaryRewards += cappedIncome;
  user.totalAllRewards += cappedIncome;
  user.binary_daily_earned = earned + cappedIncome;

  // Store previous carry forwards (for logging or display)
  user.previousLeftCarry = user.leftCarryForward || 0;
  user.previousRightCarry = user.rightCarryForward || 0;

  // Flush the full match volume (use or lose if cap hit)
  if (left < right) {
    user.leftLegInvestment = 0;
    user.rightLegInvestment -= current_match;
  } else if (right < left) {
    user.rightLegInvestment = 0;
    user.leftLegInvestment -= current_match;
  } else {
    user.leftLegInvestment = 0;
    user.rightLegInvestment = 0;
  }

  // Update carry forwards to reflect remaining after flush
  user.leftCarryForward = user.leftLegInvestment;
  user.rightCarryForward = user.rightLegInvestment;

  await user.save();

  console.log(`Credited ${cappedIncome} to user ${user.user_id}`);

  // Log binary income
  await BinaryIncome.create({
    userId: user._id,
    user_id: user.user_id,
    leftChildInvestment: left,
    rightChildInvestment: right,
    leftCarryForward: user.leftCarryForward,
    rightCarryForward: user.rightCarryForward,
    previousLeftCarry: user.previousLeftCarry,
    previousRightCarry: user.previousRightCarry,
    binaryPercentage: 10, // Assuming percentage value
    matches: current_match, // Full match flushed
    amount: cappedIncome,
  });
}

// Helper to update user rank
async function calculateBinaryMatch(user) {
  const PAYOUT_PERCENTAGE = 0.1; // 10% of weaker leg increment

  // Check qualification: at least 3 direct active referrals
  const directActive = await User.countDocuments({
    referredBy: user.referralCode,
    totalSelfInvestment: { $gt: 0 },
  });

  if (directActive < 3) {
    console.log(`No binary payout for user ${user.user_id}: insufficient direct actives (${directActive} < 3)`);
    return;
  }

  const left = user.leftLegInvestment || 0;
  const right = user.rightLegInvestment || 0;

  console.log(`Match calc for user ${user.user_id}: initial left=${left}, right=${right}`);

  const current_match = Math.min(left, right);

  if (current_match <= 0) {
    console.log('No binary payout: no new match');
    return;
  }

  const binaryIncome = current_match * PAYOUT_PERCENTAGE;

  console.log(`Payable match: ${current_match}, Binary income calculated: ${binaryIncome}`);

  // Apply daily cap based on rank - use user's binary_daily_cap field
  const dailyCap = user.binary_daily_cap || 100;
  const earned = user.binary_daily_earned || 0;
  const cappedIncome = Math.min(binaryIncome, dailyCap - earned);
  console.log(`Daily cap: ${dailyCap}, already earned: ${earned}, capped income: ${cappedIncome}`);

  // Credit the capped income
  user.myWallet.amount += cappedIncome;
  user.totalBinaryRewards += cappedIncome;
  user.totalAllRewards += cappedIncome;
  user.binary_daily_earned = earned + cappedIncome;

  // Store previous carry forwards (for logging or display)
  user.previousLeftCarry = user.leftCarryForward || 0;
  user.previousRightCarry = user.rightCarryForward || 0;

  // Flush the full match volume (use or lose if cap hit)
  if (left < right) {
    user.leftLegInvestment = 0;
    user.rightLegInvestment -= current_match;
  } else if (right < left) {
    user.rightLegInvestment = 0;
    user.leftLegInvestment -= current_match;
  } else {
    user.leftLegInvestment = 0;
    user.rightLegInvestment = 0;
  }

  // Update carry forwards to reflect remaining after flush
  user.leftCarryForward = user.leftLegInvestment;
  user.rightCarryForward = user.rightLegInvestment;

  await user.save();

  console.log(`Credited ${cappedIncome} to user ${user.user_id}`);

  // Log binary income
  await BinaryIncome.create({
    userId: user._id,
    user_id: user.user_id,
    leftChildInvestment: left,
    rightChildInvestment: right,
    leftCarryForward: user.leftCarryForward,
    rightCarryForward: user.rightCarryForward,
    previousLeftCarry: user.previousLeftCarry,
    previousRightCarry: user.previousRightCarry,
    binaryPercentage: 10, // Assuming percentage value
    matches: current_match, // Full match flushed
    amount: cappedIncome,
  });
}

// Helper to update user rank
// Helper to update user rank
async function updateUserRank(sponsorUserIdStr) {
  console.log("Start rank update for sponsor:", sponsorUserIdStr);
  if (!sponsorUserIdStr) return; // No sponsor
  console.log("Fetching sponsor for user_id:", sponsorUserIdStr);

  const sponsor = await User.findOne({ user_id: sponsorUserIdStr });
  if (!sponsor) {
    console.warn(`Sponsor not found for user_id: ${sponsorUserIdStr}`);
    return;
  }
  console.log(`Sponsor found: ${sponsor.user_id}, calculating rank...`);

  const selfInvestment = sponsor.totalSelfInvestment || 0;
  const directActive = await User.countDocuments({
    referredBy: sponsor.referralCode,
    totalSelfInvestment: { $gt: 0 },
  });
  const left_investment = await calculateLegInvestment(sponsorUserIdStr, 'left');
  const right_investment = await calculateLegInvestment(sponsorUserIdStr, 'right');
  const teamInvestment = left_investment + right_investment;
  const maxLegInvestment = Math.max(left_investment, right_investment);
  const strongLegRule =
    teamInvestment > 0 ? (maxLegInvestment / teamInvestment <= 0.6 ? teamInvestment : teamInvestment * 0.6) : 0; // Max 60% from one leg
console.log(`Rank calc for ${sponsor.user_id}: selfInvestment=${selfInvestment}, directActive=${directActive}, left=${left_investment}, right=${right_investment}, strongLegRule=${strongLegRule}`);
  let newRank = "Starter";

  // Rank qualification logic (add all ranks as needed)
  if (
    selfInvestment >= 250 &&
    directActive >= 8 &&
    strongLegRule >= 10000 &&
    left_investment >= 4000 &&
    right_investment >= 4000
  ) {
    newRank = "CROWN/ROYAL";
  } else if (
    selfInvestment >= 100 &&
    directActive >= 6 &&
    strongLegRule >= 3000 &&
    left_investment >= 1200 &&
    right_investment >= 1200
  ) {
    newRank = "Diamond";
  } else if (
    selfInvestment >= 50 &&
    directActive >= 5 &&
    strongLegRule >= 1000 &&
    left_investment >= 400 &&
    right_investment >= 400
  ) {
    newRank = "Platinum";
  } else if (
    selfInvestment >= 25 &&
    directActive >= 4 &&
    strongLegRule >= 300 &&
    left_investment >= 120 &&
    right_investment >= 120
  ) {
    newRank = "Gold";
  } else if (
    selfInvestment >= 10 &&
    directActive >= 3 &&
    strongLegRule >= 100 &&
    left_investment >= 40 &&
    right_investment >= 40
  ) {
    newRank = "Silver";
  } else if (selfInvestment >= 5 && directActive >= 2) {
    newRank = "Bronze";
  }

  console.log(`Calculated rank for user ${sponsor.user_id}: ${newRank} (current: ${sponsor.rank})`);

  if (sponsor.rank !== newRank) {
    sponsor.rank = newRank;
    console.log(`User ${sponsor.user_id} rank updated to ${newRank}`);
    const requirements = {
      Starter: { requiredDirects: 1, requiredPV: 0 },
      Bronze: { requiredDirects: 2, requiredPV: 5 },
      Silver: { requiredDirects: 3, requiredPV: 10 },
      Gold: { requiredDirects: 4, requiredPV: 20 },
      Platinum: { requiredDirects: 5, requiredPV: 50 },
      Diamond: { requiredDirects: 6, requiredPV: 100 },
      "CROWN/ROYAL": { requiredDirects: 8, requiredPV: 250 },
    };
    const caps = {
      Starter: 100,
      Bronze: 250,
      Silver: 500,
      Gold: 1000,
      Platinum: 2500,
      Diamond: 5000,
      "CROWN/ROYAL": 999999, // High number instead of Infinity for DB safety
    };
    await RankUpdateHistory.create({
      userId: sponsor._id,
      user_id: sponsor.user_id,
      name: newRank,
      requiredDirects: requirements[newRank].requiredDirects,
      requiredPV: requirements[newRank].requiredPV,
      dailyCap: caps[newRank],
    });
  }


  // Set binary_daily_cap based on new rank
  const caps = {
    Starter: 100,
    Bronze: 250,
    Silver: 500,
    Gold: 1000,
    Platinum: 2500,
    Diamond: 5000,
    "CROWN/ROYAL": 999999, // High number instead of Infinity for DB safety
  };
  sponsor.binary_daily_cap = caps[newRank] || 100;

  console.log(`Setting binary daily cap for user ${sponsor.user_id} to ${caps[newRank] || 100}`);
  await sponsor.save();
}

async function dailyBinaryPayout() {
  // Reset daily earned for all users
  await User.updateMany({}, { $set: { binary_daily_earned: 0 } });

  // Fetch all users (optimize with filters if needed, e.g., { $or: [{ totalSelfInvestment: { $gt: 0 } }, { leftLegInvestment: { $gt: 0 } }, { rightLegInvestment: { $gt: 0 } }] })
  const users = await User.find({});

  for (const user of users) {
    await updateUserRank(user.user_id);

    // Re-fetch user after potential rank update
    const updatedUser = await User.findOne({ user_id: user.user_id });
    if (updatedUser) {
      await calculateBinaryMatch(updatedUser);
    }
  }
}

module.exports = {
  calculateLegInvestment,
  distributeBinaryIncome,
  calculateBinaryMatch,
  updateUserRank,
  dailyBinaryPayout,
};