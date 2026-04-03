const User = require("../models/User");
const Investment = require("../models/Investment");
const LeadershipShare = require("../models/LeadershipShare");
const LeadershipBonus = require("../models/LeadershipBonus");

// ====================== DATE HELPERS ======================
function getTargetMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);        // Current Month (Testing)
  // Production (1st of every month): return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function getTargetMonthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getTargetMonthString() {
  return getTargetMonthStart().toISOString().slice(0, 7);
}

// ====================== GUARD FUNCTIONS ======================
async function isSharesAlreadyAssigned(month) {
  const count = await LeadershipShare.countDocuments({ month });
  return count > 0;
}

async function isBonusAlreadyDistributed(month) {
  const count = await LeadershipBonus.countDocuments({ month });
  return count > 0;
}

// ====================== MONTHLY CALCULATION HELPERS ======================
async function getMonthlySelfPV(userId, start, end) {
  const result = await Investment.aggregate([
    { $match: { user_id: userId, status: "ACTIVE", createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$amount_usd" } } }
  ]);
  return result[0]?.total || 0;
}

async function getMonthlyDirectActive(referralCode, start, end) {
  const result = await Investment.aggregate([
    { $match: { status: "ACTIVE", createdAt: { $gte: start, $lte: end } } },
    {
      $lookup: { from: "users", localField: "user_id", foreignField: "user_id", as: "userDoc" }
    },
    { $unwind: "$userDoc" },
    { $match: { "userDoc.referredBy": referralCode } },
    { $group: { _id: "$user_id" } },
    { $count: "count" }
  ]);
  return result[0]?.count || 0;
}

async function calculateMonthlySubtreeInvestment(userId, start, end) {
  let total = await getMonthlySelfPV(userId, start, end);
  const user = await User.findOne({ user_id: userId }).select("left right");
  if (!user) return total;

  if (user.left) total += await calculateMonthlySubtreeInvestment(user.left, start, end);
  if (user.right) total += await calculateMonthlySubtreeInvestment(user.right, start, end);
  return total;
}

async function calculateMonthlyLegInvestment(userId, leg, start, end) {
  const user = await User.findOne({ user_id: userId }).select("left right");
  if (!user) return 0;
  const childId = leg === "left" ? user.left : user.right;
  if (!childId) return 0;
  return await calculateMonthlySubtreeInvestment(childId, start, end);
}

// ====================== STEP 1: ASSIGN MONTHLY SHARES (Only Once) ======================
async function assignMonthlyLeadershipShares() {
  const month = getTargetMonthString();

  if (await isSharesAlreadyAssigned(month)) {
    console.log(`⚠️ Shares already assigned for ${month}. Skipping...`);
    return;
  }

  console.log(`🚀 [STEP 1] Assigning Leadership Shares for ${month}`);

  const start = getTargetMonthStart();
  const end = getTargetMonthEnd();

  const users = await User.find({ totalSelfInvestment: { $gt: 0 } }).select("_id user_id referralCode");

  let totalQualified = 0;

  for (const user of users) {
    const detail = await calculateUserMonthlyLeadershipDetail(user.user_id, start, end);

    if (detail.shares > 0) {
      // Create Share Record
      await LeadershipShare.create({
        userId: user._id,
        user_id: user.user_id,
        month,
        rankQualified: detail.rank,
        shares: detail.shares,
        selfBusiness: detail.selfPV,
        selfPV: detail.selfPV,
        directActive: detail.directActive,
        binaryVolume: detail.binaryVolume,
        leftPV: detail.leftPV,
        rightPV: detail.rightPV,
        assignedAt: new Date()
      });

      // Add shares in User table
      await User.findByIdAndUpdate(user._id, {
        $inc: { leadershipShares: detail.shares }
      });

      totalQualified++;
      console.log(`✅ Shares Assigned → ${user.user_id} | ${detail.rank} | +${detail.shares}`);
    }
  }

  console.log(`🎯 [STEP 1] Share Assignment Completed for ${month}! Qualified: ${totalQualified}`);
}

// ====================== STEP 2: DISTRIBUTE LEADERSHIP INCOME (Only Once) ======================
async function distributeMonthlyLeadershipIncome() {
  const month = getTargetMonthString();

  console.log(`💰 [STEP 2] Checking Leadership Income for ${month}`);

  if (!(await isSharesAlreadyAssigned(month))) {
    console.log(`❌ No shares assigned for ${month}. Run assignMonthlyLeadershipShares() first!`);
    return;
  }

  if (await isBonusAlreadyDistributed(month)) {
    console.log(`⚠️ Bonus already distributed for ${month}. Skipping...`);
    return;
  }

  console.log(`✅ Starting bonus distribution for ${month}`);

  const totalTurnover = await getTargetMonthCompanyTurnover();
  const leadershipPool = totalTurnover * 0.05;

  if (leadershipPool <= 0) {
    console.log("❌ No pool to distribute.");
    return;
  }

  const shareRecords = await LeadershipShare.find({ month });
  const totalShares = shareRecords.reduce((sum, r) => sum + r.shares, 0);
  const perShareValue = leadershipPool / totalShares;

  for (const record of shareRecords) {
    const bonusAmount = record.shares * perShareValue;

    // Credit wallet & deduct shares
    await User.findByIdAndUpdate(record.userId, {
      $inc: {
        "myWallet.amount": bonusAmount,
        totalRankRewards: bonusAmount,
        totalAllRewards: bonusAmount,
        leadershipShares: -record.shares
      }
    });

    await LeadershipBonus.create({
      userId: record.userId,
      user_id: record.user_id,
      month,
      rank: record.rankQualified,
      shares: record.shares,
      turnover: totalTurnover,
      poolAmount: leadershipPool,
      totalShares,
      perShareValue: Number(perShareValue.toFixed(2)),
      bonusAmount: Number(bonusAmount.toFixed(2)),
      distributionDate: new Date()
    });

    console.log(`✅ Paid $${bonusAmount.toFixed(2)} → ${record.user_id} (${record.rankQualified}) | Shares reduced`);
  }

  console.log(`🎉 [STEP 2] Leadership Bonus Distribution Completed for ${month}!`);
}

// ====================== QUALIFICATION ======================
async function calculateUserMonthlyLeadershipDetail(userId, start, end) {
  const user = await User.findOne({ user_id: userId }).select("referralCode");
  if (!user) return { shares: 0 };

  const selfInvest = await getMonthlySelfPV(userId, start, end);
  const selfPV = selfInvest / 10;

  if (selfPV < 10) return { shares: 0 };

  const directActive = await getMonthlyDirectActive(user.referralCode, start, end);
  const leftPV = (await calculateMonthlyLegInvestment(userId, "left", start, end)) / 10;
  const rightPV = (await calculateMonthlyLegInvestment(userId, "right", start, end)) / 10;
  const binaryVolume = leftPV + rightPV;

  const qualifications = [
    { rank: "CROWN/ROYAL", self: 250, direct: 8,  binary: 10000, left: 4000, right: 4000, shares: 16 },
    { rank: "DIAMOND",     self: 100, direct: 6,  binary: 3000,  left: 1200, right: 1200, shares: 8 },
    { rank: "PLATINUM",    self: 50,  direct: 5,  binary: 1000,  left: 400,  right: 400,  shares: 4 },
    { rank: "GOLD",        self: 25,  direct: 4,  binary: 300,   left: 120,  right: 120,  shares: 2 },
    { rank: "SILVER",      self: 10,  direct: 3,  binary: 100,   left: 40,   right: 40,   shares: 1 }
  ];

  for (const q of qualifications) {
    if (
      selfPV >= q.self &&
      directActive >= q.direct &&
      binaryVolume >= q.binary &&
      leftPV >= q.left &&
      rightPV >= q.right
    ) {
      return { rank: q.rank, shares: q.shares, selfPV, directActive, binaryVolume, leftPV, rightPV };
    }
  }
  return { shares: 0 };
}

async function getTargetMonthCompanyTurnover() {
  const start = getTargetMonthStart();
  const end = getTargetMonthEnd();

  const result = await Investment.aggregate([
    { $match: { status: "ACTIVE", createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$amount_usd" } } }
  ]);
  return result[0]?.total || 0;
}

// ====================== RECOMMENDED CRON FUNCTION ======================
async function runMonthlyLeadershipProcess() {
  console.log("🔄 Starting Full Monthly Leadership Process...");
  await assignMonthlyLeadershipShares();
  await distributeMonthlyLeadershipIncome();
  console.log("✅ Full Monthly Leadership Process Completed!");
}

module.exports = {
  assignMonthlyLeadershipShares,
  distributeMonthlyLeadershipIncome,
  runMonthlyLeadershipProcess
};