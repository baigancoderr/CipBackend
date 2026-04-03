const User = require("../models/User");
const Investment = require("../models/Investment"); // Updated to Investment for turnover
const LeadershipBonus = require("../models/LeadershipBonus"); // New model for logging bonuses


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
// Helper to get first day of previous month
function getPreviousMonthStart() {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return previousMonth;
}

// Helper to get end of previous month
function getPreviousMonthEnd() {
  const now = new Date();
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return previousMonthEnd;
}

// Monthly leadership bonus distribution (run via cron on 1st of each month)
async function distributeLeadershipBonus() {
  const monthStart = getPreviousMonthStart();
  const monthEnd = getPreviousMonthEnd();
  console.log(`Distributing leadership bonus for period: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

  // Step 1: Calculate total turnover (assuming from completed investments overall)
  const totalTurnover = await Investment.aggregate([
    {
      $match: {
        status: "ACTIVE",
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_usd" } } },
  ]).then((result) => result[0]?.total || 0);

  const leadershipPool = totalTurnover * 0.05; // 5% pool
  console.log(`Total turnover: $${totalTurnover}, Leadership pool: $${leadershipPool}`);

  if (leadershipPool <= 0) {
    console.log("No pool to distribute.");
    return;
  }

  // Step 2: Find all qualified leaders and their shares
  const qualifiedLeaders = [];
  const users = await User.find({ totalSelfInvestment: { $gt: 0 } }); // Active users

  for (const user of users) {
    await determineMonthlyRank(user.user_id); // Apply maintenance if needed
    const updatedUser = await User.findOne({ user_id: user.user_id }); // Re-fetch after potential update
    const rank = updatedUser.rank;
    const shares = getSharesForRank(rank);
    if (shares > 0) {
      qualifiedLeaders.push({ userId: updatedUser._id, user_id: updatedUser.user_id, rank, shares });
    }
  }

  const totalShares = qualifiedLeaders.reduce((sum, leader) => sum + leader.shares, 0);
  console.log(`Total qualified leaders: ${qualifiedLeaders.length}, Total shares: ${totalShares}`);

  if (totalShares === 0) {
    console.log("No qualified leaders.");
    return;
  }

  // Step 3: Distribute bonus and log
  for (const leader of qualifiedLeaders) {
    const bonusAmount = (leader.shares / totalShares) * leadershipPool;

    // Credit to user's wallet (e.g., myWallet)
    const updatedUser = await User.findById(leader.userId);
    updatedUser.myWallet.amount += bonusAmount;
    updatedUser.totalLeadershipRewards += bonusAmount;
    updatedUser.totalAllRewards += bonusAmount;
    await updatedUser.save();

    // Log the bonus
    await LeadershipBonus.create({
      userId: leader.userId,
      user_id: leader.user_id,
      month: monthStart,
      rank: leader.rank,
      shares: leader.shares,
      turnover: totalTurnover,
      poolAmount: leadershipPool,
      totalShares,
      bonusAmount,
    });

    console.log(`Credited $${bonusAmount} leadership bonus to user ${leader.user_id} (${leader.rank})`);
  }
}

// Helper to determine rank for a user and apply maintenance (using cumulative metrics)
async function determineMonthlyRank(userIdStr) {
  const user = await User.findOne({ user_id: userIdStr });
  if (!user) return "Starter";

  const pvSelf = user.pv_self || 0;
  const directActive = await User.countDocuments({
    referredBy: user.referralCode,
    totalSelfInvestment: { $gt: 0 },
  });
  const left_pv = await calculateLegInvestment(userIdStr, 'left') / 10; // Assuming PV = investment / 10
  const right_pv = await calculateLegInvestment(userIdStr, 'right') / 10;
  const team_pv = left_pv + right_pv;
  const maxLeg_pv = Math.max(left_pv, right_pv);
  const strongLegRule =
    team_pv > 0 ? (maxLeg_pv / team_pv <= 0.6 ? team_pv : team_pv * 0.6) : 0;

  // Function to check if qualifies for a specific rank
  const qualifiesForRank = (rank) => {
    const requirements = {
      "CROWN/ROYAL": { pvSelf: 250, directActive: 8, strongLegRule: 10000, left: 4000, right: 4000 },
      "Diamond": { pvSelf: 100, directActive: 6, strongLegRule: 3000, left: 1200, right: 1200 },
      "Platinum": { pvSelf: 50, directActive: 5, strongLegRule: 1000, left: 400, right: 400 },
      "Gold": { pvSelf: 25, directActive: 4, strongLegRule: 300, left: 120, right: 120 },
      "Silver": { pvSelf: 10, directActive: 3, strongLegRule: 100, left: 40, right: 40 },
      "Bronze": { pvSelf: 5, directActive: 2, strongLegRule: 0, left: 0, right: 0 },
      "Starter": { pvSelf: 0, directActive: 0, strongLegRule: 0, left: 0, right: 0 },
    };
    const req = requirements[rank];
    return (
      pvSelf >= req.pvSelf &&
      directActive >= req.directActive &&
      strongLegRule >= req.strongLegRule &&
      left_pv >= req.left &&
      right_pv >= req.right
    );
  };

  let currentRank = user.rank || "Starter";

  // Maintenance: If not qualify for current, downgrade to next lower
  const nextLower = {
    "CROWN/ROYAL": "Diamond",
    "Diamond": "Platinum",
    "Platinum": "Gold",
    "Gold": "Silver",
    "Silver": "Bronze",
    "Bronze": "Starter",
    "Starter": "Starter",
  };

  if (!qualifiesForRank(currentRank)) {
    const newRank = nextLower[currentRank];
    user.rank = newRank;
    await user.save();
    console.log(`User ${user.user_id} rank downgraded from ${currentRank} to ${newRank}`);
  }

  return user.rank;
}

// Helper to get shares for rank
function getSharesForRank(rank) {
  const shares = {
    "Silver": 1,
    "Gold": 2,
    "Platinum": 4,
    "Diamond": 8,
    "CROWN/ROYAL": 16,
  };
  return shares[rank] || 0;
}

// Helper to get current month total investment turnover
async function getCurrentMonthTurnover() {
  const monthStart = getCurrentMonthStart();
  const monthEnd = getCurrentMonthEnd();

  const totalTurnover = await Investment.aggregate([
    {
      $match: {
        status: "ACTIVE",
        createdAt: { $gte: monthStart, $lte: monthEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_usd" } } },
  ]).then((result) => result[0]?.total || 0);

  console.log(`Current month turnover: $${totalTurnover}`);
  return totalTurnover;
}

// Helper to get a specific user's current month investment turnover
async function getUserCurrentMonthTurnover(userIdStr) {
  const user = await User.findOne({ user_id: userIdStr });
  if (!user) return 0;

  const monthStart = getCurrentMonthStart();
  const monthEnd = getCurrentMonthEnd();

  const userTurnover = await Investment.aggregate([
    {
      $match: {
        user_id: userIdStr,
        status: "ACTIVE",
        createdAt: { $gte: monthStart, $lte: monthEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_usd" } } },
  ]).then((result) => result[0]?.total || 0);

  console.log(`User ${userIdStr} current month turnover: $${userTurnover}`);
  return userTurnover;
}

module.exports = {
  distributeLeadershipBonus,
  getCurrentMonthTurnover,
  getUserCurrentMonthTurnover,
};