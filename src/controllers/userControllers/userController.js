const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const Admin = require("../../models/Admin");
const Package = require("../../models/Package");
const Deposit = require("../../models/Deposit");
const Price = require("../../models/Price");
const Withdrawal = require("../../models/Withdrawal");
const Stake = require("../../models/Stake");
const RoiDistribution = require("../../models/RoiDistribution");
const LevelPlan = require("../../models/LevelPlan");
const ReferralReward = require("../../models/Referral");
const LevelReward = require("../../models/LevelIncome");
const KYC = require("../../models/KYC");
const Swap = require("../../models/Swap");
const crypto = require("crypto");
const { ethers, parseUnits } = require("ethers");
const TransferTransaction = require("../../models/TransferTransaction");
const ReinvestTransaction = require("../../models/ReinvestTransaction");
const { sendEmail, sendSupportEmails } = require("../../services/emailService");
const {
  verifyTransactionHash,
} = require("../../services/verifyTransactionHash");
const Support = require("../../models/supportEmail");
const { saveOTP, verifyOTP } = require("../../services/otpService");
const { verifySignature } = require("../../services/web3Service");
const { successResponse, errorResponse } = require("../../utils/responses");
const { v4: uuidv4 } = require("uuid");
const config = require("../../config/envConfig");
const moment = require("moment-timezone");
const redisClient = require("../../config/redisClient");
const logger = require("../../utils/logger");
const Investment = require("../../models/Investment");
const DepositCallbackLog = require("../../models/DepositCallbackLog");

const axios = require("axios");

// Helper function to calculate total downline investment
const calculateDownlineInvestment = async (referralCode) => {
  const users = await User.find({ referredBy: referralCode });
  let totalInvestment = 0;
  for (const u of users) {
    totalInvestment += u.totalSelfInvestment || 0;
    const subInvestment = await calculateDownlineInvestment(u.referralCode);
    totalInvestment += subInvestment;
  }
  return totalInvestment;
};

// Helper function to get all downline user IDs
const calculateDownlineUsers = async (referralCode) => {
  const downlineUsers = [];
  const queue = [referralCode];
  const visited = new Set();

  while (queue.length > 0) {
    const currentReferralCode = queue.shift();
    if (visited.has(currentReferralCode)) continue;
    visited.add(currentReferralCode);

    const users = await User.find({ referredBy: currentReferralCode }).select(
      "_id referralCode sponsor_id",
    );
    for (const user of users) {
      downlineUsers.push(user._id);
      queue.push(user.referralCode);
    }
  }

  return downlineUsers;
};

// const getDashboard = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id).select(
//       "first_name username shopping_points loyalty_points rank walletAddress myWallet depositWallet emgtWallet principalWallet referralWallet binary_daily_cap totalSelfInvestment totalAllRewards totalReferralRewards totalBinaryRewards totalLeadershipRewards totalLevelRewards totalTokenizedInvestment totalReadyInvestment totalUnderconstructionInvestment email referralCode leadershipShares",
//     );
//     if (!user) return res.status(404).json(errorResponse("User not found"));

//     // User Details
//     const firstName = user.first_name || "User";
//     const userName = user.username;
//     const referralCode = user.referralCode;

//     // Wallet Balances
//     const myWallet = user.myWallet?.amount || 0;
//     const depositWallet = user.depositWallet?.amount || 0;
//     const totalInvestment = user.totalSelfInvestment || 0;
//     const principalWallet = user.principalWallet?.amount || 0;
//     const emgtWallet = user.emgtWallet?.amount || 0;
//     const referralWallet = user.referralWallet?.amount || 0;
//     const totalWalletBalance =
//       myWallet + depositWallet + principalWallet + referralWallet;
//     const userRank = user.rank || "Bronze";
//     // All Type of reward

//     const totalAllRewards = user.totalAllRewards || 0;
//     const roiRewards = await RoiDistribution.find({ userId: user._id });
//     const referralRewards = await ReferralReward.find({ referrerId: user._id });
//     const levelRewards = await LevelReward.find({ userId: user._id });
//     const totalShoppingPoint = user.shopping_points || 0;
//     const totalLoyaltyPoints = user.loyalty_points || 0;

//     const totalEarningWithoutCap = Number(
//       roiRewards + referralRewards + levelRewards,
//     ).toFixed(2);

//     // Profit Tracker
//     const stakes = await Stake.find({ userId: user._id, status: "completed" });
//     const investment = stakes.reduce((sum, stake) => sum + stake.amount, 0);

//     // Incomes
//     const roiIncome = await RoiDistribution.aggregate([
//       { $match: { userId: user._id } },
//       { $group: { _id: null, total: { $sum: "$amount" } } },
//     ]).then((result) => result[0]?.total || 0);

//     const referralIncome = user.totalReferralRewards || 0;
//     const levelIncomeReward = user.totalLevelRewards || 0;

//     // Calculate total earnings
//     const earning = roiIncome + referralIncome + levelIncomeReward;
//     const earningWithoutCap = roiIncome + levelIncomeReward;

//     // Daily and Monthly Income
//     const dailyIncome = await Promise.all([
//       ReferralReward.aggregate([
//         {
//           $match: {
//             referrerId: user._id,
//             createdAt: { $gte: moment().startOf("day").toDate() },
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$earned" } } },
//       ]).then((result) => result[0]?.total || 0),
//       RoiDistribution.aggregate([
//         {
//           $match: {
//             userId: user._id,
//             distributionDate: { $gte: moment().startOf("day").toDate() },
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$amount" } } },
//       ]).then((result) => result[0]?.total || 0),
//       LevelReward.aggregate([
//         {
//           $match: {
//             userId: user._id,
//             distributionDate: { $gte: moment().startOf("day").toDate() },
//             status: "completed",
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$rewardAmount" } } },
//       ]).then((result) => result[0]?.total || 0),
//     ]).then(
//       ([referralDaily, roiDaily, levelDaily]) =>
//         referralDaily + roiDaily + levelDaily,
//     );

//     const monthlyIncome = await Promise.all([
//       ReferralReward.aggregate([
//         {
//           $match: {
//             referrerId: user._id,
//             createdAt: { $gte: moment().startOf("month").toDate() },
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$earned" } } },
//       ]).then((result) => result[0]?.total || 0),
//       RoiDistribution.aggregate([
//         {
//           $match: {
//             userId: user._id,
//             distributionDate: { $gte: moment().startOf("month").toDate() },
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$amount" } } },
//       ]).then((result) => result[0]?.total || 0),
//       LevelReward.aggregate([
//         {
//           $match: {
//             userId: user._id,
//             distributionDate: { $gte: moment().startOf("month").toDate() },
//             status: "completed",
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$rewardAmount" } } },
//       ]).then((result) => result[0]?.total || 0),
//     ]).then(
//       ([referralMonthly, roiMonthly, levelMonthly]) =>
//         referralMonthly + roiMonthly + levelMonthly,
//     );

//     const earningTimes =
//       earningWithoutCap > 0 && investment > 0
//         ? (earningWithoutCap / investment).toFixed(2)
//         : "0.00";
//     // Calculate remaining ROI

//     // Team Business Overview
//     const directUsers = await User.find({
//       referredBy: user.referralCode,
//     }).select("_id");
//     const directBusiness = await Deposit.aggregate([
//       {
//         $match: {
//           userId: { $in: directUsers.map((u) => u._id) },
//           status: "completed",
//         },
//       },
//       { $group: { _id: null, total: { $sum: "$amount" } } },
//     ]).then((result) => result[0]?.total || 0);

//     const totalTeamBusiness = await calculateDownlineInvestment(
//       user.referralCode,
//     );
//     const todayTeamBusiness = await Deposit.aggregate([
//       {
//         $match: {
//           userId: {
//             $in: await User.find({ referredBy: user.referralCode }).distinct(
//               "_id",
//             ),
//           },
//           createdAt: { $gte: moment().startOf("day").toDate() },
//         },
//       },
//       { $group: { _id: null, total: { $sum: "$amount" } } },
//     ]).then((result) => result[0]?.total || 0);

//     // Team Stats
//     const myDirect = directUsers.length;
//     const totalTeam = (await calculateDownlineUsers(user.referralCode)).length;
//     const indirect = totalTeam - myDirect;

//     const totalWithdraw = await Withdrawal.aggregate([
//       { $match: { userId: user._id, status: "completed" } },
//       { $group: { _id: null, total: { $sum: "$amount" } } },
//     ]).then((result) => result[0]?.total || 0);

//     const tokenPriceDoc = await Price.findOne({ currencyType: "SGN" }).lean();
//     const tokenPriceValue = tokenPriceDoc ? tokenPriceDoc.price : 0;

//     // Latest Level Income Details
//     const latestLevelReward = await LevelReward.findOne({
//       userId: user._id,
//       status: "completed",
//     })
//       .sort({ distributionDate: -1 })
//       .lean();
//     const latestLevelRank = latestLevelReward ? latestLevelReward.rank : "None";
//     const latestLevelRewardAmount = latestLevelReward
//       ? latestLevelReward.rewardAmount
//       : 0;
//     const latestTeamTotalRoi = latestLevelReward
//       ? latestLevelReward.teamTotalRoiRewardDistributed
//       : 0;
//     const latestStrongLegInvestment = latestLevelReward
//       ? latestLevelReward.stronglegInvestment
//       : 0;
//     const latestWeakestLegInvestment = latestLevelReward
//       ? latestLevelReward.weakestLegInvestment
//       : 0;
//     const latestTotalTeamInvestment = latestLevelReward
//       ? latestLevelReward.totalTeamInvestment
//       : 0;

//     res.status(200).json(
//       successResponse("Dashboard data retrieved", {
//         firstName,
//         userName,
//         referralCode,
//         walletAddress: user.walletAddress,
//         wallets: {
//           totalAllRewards: `$${totalAllRewards.toFixed(2)}`,
//           myWallet: `$${myWallet.toFixed(2)}`,
//           depositWallet: `$${depositWallet.toFixed(2)}`,
//           totalInvestment: `$${totalInvestment.toFixed(2)}`,
//           emgtWallet: `${emgtWallet.toFixed(2)}`,
//           referralWallet: `$${referralWallet.toFixed(2)}`,
//           principalWallet: `$${principalWallet.toFixed(2)}`,
//           totalWalletBalance: `$${totalWalletBalance.toFixed(2)}`,
//           totalLevelRewards: `$${levelIncomeReward.toFixed(2)}`,
//           latestLevelReward: `$${latestLevelRewardAmount.toFixed(2)}`,
//           totalShoppingPoint: `${totalShoppingPoint.toFixed(2)}`,
//           totalLoyaltyPoints: `${totalLoyaltyPoints.toFixed(2)}`,
//           latestLevelRank,
//         },
//         profitTracker: {
//           investment: `$${investment.toFixed(2)}`,
//           earning: `$${earning.toFixed(2)}`,
//           earningWithoutCap: `$${earningWithoutCap.toFixed(2)}`,
//           earningTimes: `${earningTimes}X`,
//         },
//         teamBusiness: {
//           directBusiness: `$${directBusiness.toFixed(2)}`,
//           totalTeamBusiness: `$${totalTeamBusiness.toFixed(2)}`,
//           todayTeamBusiness: `$${todayTeamBusiness.toFixed(2)}`,
//         },
//         incomes: {
//           roiIncome: `$${roiIncome.toFixed(2)}`,
//           referralIncome: `$${referralIncome.toFixed(2)}`,
//           totalLevelRewards: `$${levelIncomeReward.toFixed(2)}`,
//           dailyIncome: `$${dailyIncome.toFixed(2)}`,
//           monthlyIncome: `$${monthlyIncome.toFixed(2)}`,
//         },
//         transactions: {
//           totalEarning: `$${earning.toFixed(2)}`,
//           totalWithdraw: `${totalWithdraw.toFixed(2)}`,
//         },
//         teamStats: {
//           totalTeam,
//           myDirect,
//           indirect,
//         },
//         tokenOverview: {
//           price: `${tokenPriceValue.toFixed(2)}`,
//         },
//         referralLink: `${process.env.WEBSITE_URL}/user/signup?referral=${user.referralCode}`,
//         userEmail: user.email,
//         userRank: userRank,
//         levelIncomeDetails: latestLevelReward
//           ? {
//               rank: latestLevelRank,
//               rewardAmount: `$${latestLevelRewardAmount.toFixed(2)}`,
//               teamTotalRoi: `$${latestTeamTotalRoi.toFixed(2)}`,
//               strongLegInvestment: `$${latestStrongLegInvestment.toFixed(2)}`,
//               weakestLegInvestment: `$${latestWeakestLegInvestment.toFixed(2)}`,
//               totalTeamInvestment: `$${latestTotalTeamInvestment.toFixed(2)}`,
//               distributionDate: moment(
//                 latestLevelReward.distributionDate,
//               ).format("YYYY-MM-DD HH:mm:ss"),
//             }
//           : null,
//       }),
//     );
//   } catch (error) {
//     console.error("Error in getDashboard:", error);
//     res.status(500).json(errorResponse(error.message));
//   }
// };

const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "userId name username referralCode walletBalance totalInvested totalEarnings referralEarnings dailyIncome activePackage isActive"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔥 REAL-TIME referral count
    const totalReferrals = await User.countDocuments({
      referredBy: user.referralCode,
    });

    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      user: {
        userId: user.userId,
        name: user.name,
        username: user.username,
        referralCode: user.referralCode,
        isActive: user.isActive,
      },
      dashboard: {
        stats: [
          { title: "LIVE PRICE", value: "$0.12" },
          { title: "TOTAL DEPOSIT", value: `$${user.totalInvested.toFixed(2)}` },
          { title: "WALLET BALANCE", value: `$${user.walletBalance.toFixed(2)}` },
          { title: "TOTAL EARNINGS", value: `$${user.totalEarnings.toFixed(2)}` },
          { title: "ACTIVE PACKAGE", value: `${user.activePackage}` },
          { title: "TEAM", value: `${totalReferrals}` }, // ✅ dynamic
        ],
        profitTracker: {
          totalInvested: user.totalInvested,
          totalEarnings: user.totalEarnings,
          dailyIncome: user.dailyIncome,
        },
        teamStats: {
          totalReferrals, // ✅ dynamic
          referralEarnings: user.referralEarnings,
        },
        referralLink: `https://t.me/cipera_bot?startapp=${user.referralCode}`,
        tokenPrice: 0.12,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
};

const getUserStakedPlans = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));
    // Fetch all stakes for the user
    const stakes = await Stake.find({ userId: user._id })
      .populate("package", "name investment lockingPeriodDays")
      .sort({ createdAt: -1 })
      .lean();

    const stakedPlans = stakes
      .filter((stake) => stake.package)
      .map((stake) => {
        const lockingPeriodEnd = moment(stake.packageEndDate);
        const isLockingPeriodActive = moment().isBefore(lockingPeriodEnd);
        return {
          stakeId: stake.stakeId,
          amount: stake.amount,
          packageName: stake.package.name,
          investment: stake.package.investment,
          dailyROI: stake.dailyROI || 0,
          dailyROIAmount: stake.dailyROIAmount || 0,
          lockingPeriodDays: stake.package.lockingPeriodDays,
          createdAt: stake.createdAt,
          startDate: stake.packageStartDate,
          lockUntil: lockingPeriodEnd.toDate(),
          isLockingPeriodActive,
          status: stake.status,
          isSwapped: stake.isSwapped || false,
          isReinvested: stake.isReinvested || false,
          isTransferred: stake.isTransferredToPrincipalWallet || false,
        };
      });
    res.status(200).json(
      successResponse("Staked plans retrieved successfully", {
        stakedPlans,
        totalStakedAmount: stakedPlans.reduce(
          (sum, plan) => sum + plan.amount,
          0,
        ),
        totalStakes: stakedPlans.length,
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Get All Package Details
const getAllPackageDetails = async (req, res) => {
  try {
    const packages = await Package.find().sort({ investment: 1 }).lean();

    res.status(200).json(successResponse("All packages retrieved", packages));
  } catch (error) {
    console.error("Error fetching all package details:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const decryptPrivateKey = (encryptedPrivateKey, encryptionKey) => {
  try {
    // Ensure inputs are provided
    if (!encryptedPrivateKey || !encryptionKey) {
      throw new Error("Missing encrypted private key or encryption key");
    }

    // Split the encrypted string into iv, salt, and encrypted components
    const [ivHex, saltHex, encryptedHex] = encryptedPrivateKey.split(":");

    if (!ivHex || !saltHex || !encryptedHex) {
      throw new Error("Invalid encrypted private key format");
    }

    // Convert hex strings back to Buffers
    const iv = Buffer.from(ivHex, "hex");
    const salt = Buffer.from(saltHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    // Validate buffer lengths
    if (iv.length !== 16) {
      throw new Error("Invalid IV length");
    }
    if (salt.length < 8) {
      throw new Error("Invalid salt length");
    }
    if (encrypted.length === 0) {
      throw new Error("Empty encrypted data");
    }

    // Derive the same key using PBKDF2
    const key = crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");

    // Create decipher
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    // Decrypt
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

const requestWithdrawalOtp = async (req, res) => {
  const { walletType, amount, currencyType } = req.body;

  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const walletMap = {
      principal: "principalWallet",
      my: "myWallet",
      deposit: "depositWallet",
      referral: "referralWallet",
    };
    const walletObj = walletMap[walletType];
    if (!walletObj) throw new Error("Invalid wallet type");
    if (user[walletObj].amount < amount) {
      throw new Error(`Insufficient funds in ${walletType} Wallet`);
    }

    const MIN_WITHDRAWAL_AMOUNT = config.MIN_WITHDRAWAL_AMOUNT || 1;
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new Error(
        `Withdrawal amount must be at least $${MIN_WITHDRAWAL_AMOUNT}`,
      );
    }

    const TRANSACTION_CHARGE = ["my", "referral"].includes(walletType)
      ? config.TRANSACTION_CHARGE || 10
      : 0;
    const adminDeduction = Number(
      ((amount * TRANSACTION_CHARGE) / 100).toFixed(4),
    );
    const netAmount = Number((amount - adminDeduction).toFixed(2));
    if (netAmount <= 0)
      throw new Error("Net withdrawal amount must be greater than 0");

    const walletAddress = user.walletAddress;
    if (!walletAddress || walletAddress === "NA") {
      throw new Error("Set wallet address first");
    }

    const otp = await saveOTP(user.email, "withdrawal");

    const requestId = uuidv4();
    await redisClient.set(
      `withdrawal:${requestId}`,
      JSON.stringify({
        userId,
        walletType,
        amount,
        currencyType,
        walletAddress,
        otp,
      }),
      { EX: 600 }, // 10-minute TTL
    );

    const email = user.email;
    const username = user.username;

    sendEmail(email, "Withdrawal Confirmation OTP", "withdrawal-otp", {
      username,
      email,
      amount,
      walletAddress,
      otp,
      validity: "10 minutes",
    }).catch((err) => console.error("Email sending failed:", err));

    // Send email with OTP and wallet address

    return res
      .status(200)
      .json(successResponse("OTP sent successfully", { requestId }));
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
};

const withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let withdrawal = null;
  let adminDeduction = 0;

  try {
    const { walletType, amount, currencyType = "USDT", otp } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).session(session);

    if (!user) {
      throw new Error("User not found");
    }

    // Validate OTP
    await verifyOTP(user.email, otp, "withdrawal");
    logger.info(`OTP verified for user ${userId} for withdrawal request.`);

    // Check if wallet address is not set or is "NA"
    if (!user.walletAddress || user.walletAddress === "NA") {
      throw new Error("Set wallet address first");
    }

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    // Minimum withdrawal amount (e.g., $1)
    const MIN_WITHDRAWAL_AMOUNT = config.MIN_WITHDRAWAL_AMOUNT;
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new Error(
        `Withdrawal amount must be at least $${MIN_WITHDRAWAL_AMOUNT}`,
      );
    }

    // Wallet mapping
    const walletMap = {
      principal: "principalWallet",
      my: "myWallet",
      deposit: "depositWallet",
      referral: "referralWallet",
    };

    if (!walletMap[walletType]) {
      throw new Error("Invalid wallet type");
    }

    // Determine the wallet field and check balance
    const walletObj = walletMap[walletType];
    const wallet = user[walletObj];
    if (!wallet || wallet.amount < amount) {
      throw new Error(
        `Insufficient funds in ${
          walletType.charAt(0).toUpperCase() + walletType.slice(1)
        } Wallet`,
      );
    }

    // Apply transaction charge: 10% for my and referral wallets, 0% for others
    const TRANSACTION_CHARGE = ["my", "referral"].includes(walletType)
      ? config.TRANSACTION_CHARGE || 10
      : 0;
    adminDeduction = Number(((amount * TRANSACTION_CHARGE) / 100).toFixed(4));
    const netAmount = Number((amount - adminDeduction).toFixed(2));

    // Ensure netAmount is positive
    if (netAmount <= 0) {
      throw new Error(
        "Net withdrawal amount after charges must be greater than 0",
      );
    }

    // Deduct the full amount from the user's wallet
    user[walletObj].amount = Number((wallet.amount - amount).toFixed(2));

    // Update admin's transactionFeeCollected if a fee was applied
    if (adminDeduction > 0) {
      const adminCacheKey = `admin:admin123`;
      let admin;
      const cachedAdmin = await redisClient.get(adminCacheKey).catch((err) => {
        console.warn(`Redis get error for ${adminCacheKey}:`, err.message);
        return null;
      });

      if (cachedAdmin) {
        admin = JSON.parse(cachedAdmin);
      } else {
        admin = await Admin.findOne({ referralCode: "admin123" }).session(
          session,
        );
        if (admin) {
          await redisClient
            .set(adminCacheKey, JSON.stringify(admin), "EX", 3600)
            .catch((err) => {
              console.warn(
                `Redis set error for ${adminCacheKey}:`,
                err.message,
              );
            });
        }
      }

      if (admin) {
        admin.transactionFeeCollected = Number(
          ((admin.transactionFeeCollected || 0) + adminDeduction).toFixed(2),
        );
        await Admin.updateOne(
          { referralCode: "admin123" },
          { transactionFeeCollected: admin.transactionFeeCollected },
          { session },
        );
      } else {
        console.warn("Admin not found for updating transactionFeeCollected");
      }
    }

    // Create a withdrawal request with pending status
    withdrawal = await Withdrawal.create(
      [
        {
          userId: user._id,
          amount,
          actualPayAmount: netAmount,
          withdrawalFee: adminDeduction,
          withdrawalFeePercentage: TRANSACTION_CHARGE,
          walletType,
          currencyType,
          status: "pending",
          walletAddress: user.walletAddress,
          requestedAmount: amount,
        },
      ],
      { session },
    );

    // Save user changes
    await User.updateOne(
      { _id: user._id },
      { [walletObj]: user[walletObj] },
      { session },
    );

    // Check if withdrawal amount is ≤ 500 USDT for automatic processing
    const AUTO_WITHDRAWAL_LIMIT = config.AUTO_WITHDRAWAL_LIMIT;
    if (netAmount <= AUTO_WITHDRAWAL_LIMIT) {
      const encryptionKey = config.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error("ENCRYPTION_KEY is not defined");
      }
      if (!config.ENCRYPTED_PRIVATE_KEY) {
        throw new Error("ENCRYPTED_PRIVATE_KEY is not defined");
      }
      privateKey = decryptPrivateKey(
        config.ENCRYPTED_PRIVATE_KEY,
        encryptionKey,
      );

      const provider = new ethers.providers.JsonRpcProvider(config.BSC_RPC_URL);
      const walletSigner = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        config.WITHDRAW_CONTRACT_ADDRESS,
        config.WITHDRAW_CONTRACT_ABI,
        walletSigner,
      );

      const usdtContract = new ethers.Contract(
        config.USDT_CONTRACT_ADDRESS, // Replace with USDT contract address
        config.USDT_CONTRACT_ABI, // Replace with USDT ABI
        provider,
      );
      const contractBalance = await usdtContract.balanceOf(
        config.WITHDRAW_CONTRACT_ADDRESS,
      );

      const decimals = 18; // For USDT; adjust if needed
      const amountWei = ethers.utils.parseUnits(netAmount.toString(), decimals);

      if (!amountWei || isNaN(amountWei.toString())) {
        throw new Error("Invalid amount in Wei");
      }

      if (contractBalance.lt(amountWei)) {
        throw new Error(
          `Contract has insufficient USDT balance: ${ethers.utils.formatUnits(
            contractBalance,
            18,
          )} USDT available, ${netAmount} USDT required`,
        );
      }

      // Send transaction to contract's userWithdraw function
      const tx = await contract.userWithdraw(user.walletAddress, amountWei);
      const receipt = await tx.wait();
      // Update withdrawal status to completed
      await Withdrawal.updateOne(
        { _id: withdrawal[0]._id },
        { status: "completed", transactionHash: tx.hash },
        { session },
      );

      // Commit the database transaction after blockchain success
      await session.commitTransaction();

      // Update user cache after successful withdrawal
      user[walletObj].amount = Number(user[walletObj].amount.toFixed(2));

      res.status(200).json(
        successResponse("Withdrawal completed successfully", {
          withdrawalId: withdrawal[0]._id,
          requestedAmount: amount,
          netAmount,
          transactionCharge: adminDeduction,
          currencyType,
          walletType,
          status: "completed",
          walletAddress: user.walletAddress,
          txHash: tx.hash,
        }),
      );

      console.log(
        `Automatic withdrawal completed for user ${
          user._id
        }: requested $${amount.toFixed(4)}, ` +
          `net $${netAmount.toFixed(4)}, charge $${adminDeduction.toFixed(
            4,
          )} ` +
          `from ${walletType} wallet, txHash: ${tx.hash}`,
      );
    } else {
      // For amounts > 500 USDT, commit transaction and keep withdrawal pending
      await session.commitTransaction();

      // Update user cache after pending withdrawal
      user[walletObj].amount = Number(user[walletObj].amount.toFixed(2));

      res.status(200).json(
        successResponse(
          "Withdrawal request submitted and pending admin approval",
          {
            withdrawalId: withdrawal[0]._id,
            requestedAmount: amount,
            netAmount,
            transactionCharge: adminDeduction,
            currencyType,
            walletType,
            status: "pending",
            walletAddress: user.walletAddress,
          },
        ),
      );

      console.log(
        `Withdrawal request pending for user ${
          user._id
        }: requested $${amount.toFixed(4)}, ` +
          `net $${netAmount.toFixed(4)}, charge $${adminDeduction.toFixed(
            4,
          )} ` +
          `from ${walletType} wallet`,
      );
    }
  } catch (error) {
    // Abort transaction only if it hasn't been committed
    await session.abortTransaction();

    // Handle blockchain transaction errors and revert changes
    // if (
    //   error.code === "INSUFFICIENT_FUNDS" ||
    //   error.code === "NETWORK_ERROR" ||
    //   error.message.includes("transaction failed")
    // ) {
    //   // Revert user wallet balance
    //   const userUpdate = await User.findById(req.user.id);

    //   if (userUpdate && walletMap[req.body.walletType]) {
    //     const walletObj = walletMap[req.body.walletType];
    //     userUpdate[walletObj].amount = Number(
    //       (userUpdate[walletObj].amount + req.body.amount).toFixed(2)
    //     );
    //     await userUpdate.save();

    //     // Update user cache after reversion
    //     await redisClient.set(`user:${req.user.id}`, JSON.stringify(userUpdate), 'EX', 3600).catch((err) => {
    //       console.warn(`Redis set error for user:${req.user.id}:`, err.message);
    //     });
    //   }

    //   // Revert admin fee if deducted
    //   if (adminDeduction > 0) {
    //     const adminUpdate = await Admin.findOne({ referralCode: "admin123" });
    //     if (adminUpdate) {
    //       adminUpdate.transactionFeeCollected = Number(
    //         (adminUpdate.transactionFeeCollected - adminDeduction).toFixed(2)
    //       );
    //       await adminUpdate.save();

    //       // Update admin cache after reversion
    //       await redisClient.set(`admin:admin123`, JSON.stringify(adminUpdate), 'EX', 3600).catch((err) => {
    //         console.warn(`Redis set error for admin:admin123:`, err.message);
    //       });
    //     }
    //   }

    //   // Update withdrawal to failed
    //   if (withdrawal && withdrawal[0]) {
    //     await Withdrawal.updateOne(
    //       { _id: withdrawal[0]._id },
    //       { status: "failed", error: error.message }
    //     );
    //   }

    //   return res
    //     .status(500)
    //     .json(errorResponse("Withdrawal transaction failed; balance restored"));
    // }

    logger.error(
      `Error in withdraw for user ${req.user.id} from ${req.body.walletType} wallet:`,
      error.message,
      error.stack,
    );
    res.status(500).json(errorResponse(error.message));
  } finally {
    session.endSession();
  }
};

// Get withdrawal history for all users (admin only)
const getWithdrawalHistory = async (req, res) => {
  try {
    console.log("Fetching withdrawal history..."); // Debug log
    const withdrawals = await Withdrawal.find({ userId: req.user.id })
      .populate("userId", "-password") // Populate user details, exclude password
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    if (!withdrawals || withdrawals.length === 0) {
      console.log("No withdrawal records found");
      return res.status(404).json(errorResponse("No withdrawal records found"));
    }

    console.log("Withdrawals fetched:", withdrawals.length); // Debug log

    res.status(200).json(
      successResponse("Withdrawal history retrieved successfully", {
        withdrawals,
      }),
    );
  } catch (error) {
    console.error("Error in getWithdrawalHistory:", error); // Debug log
    res.status(500).json(errorResponse(error.message));
  }
};

const getReport = async (req, res) => {
  try {
    const { type } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    let transactions;
    switch (type) {
      case "deposit":
        transactions = await Deposit.find({ userId: user._id }).sort({
          createdAt: -1,
        });
        break;
      case "withdraw":
        transactions = await Withdrawal.find({ userId: user._id }).sort({
          createdAt: -1,
        });
        break;
      case "swap":
        transactions = await Swap.find({ userId: user._id }).sort({
          createdAt: -1,
        });
        break;
      case "referral":
        transactions = await ReferralReward.find({ referrerId: user._id }).sort(
          {
            createdAt: -1,
          },
        );
        break;
      case "bonanza":
        transactions = [];
        break;
      default:
        return res.status(404).json(errorResponse("Invalid report type"));
    }

    res
      .status(200)
      .json(successResponse(`Report for ${type}`, { transactions }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const getWalletDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "principalWallet myWallet emgtWallet depositWallet referralWallet totalSelfInvestment walletAddress",
    );
    if (!user) return res.status(404).json(errorResponse("User not found"));

    const teamInvestment = await calculateDownlineInvestment(user.referralCode);

    res.status(200).json(
      successResponse("Wallet details retrieved", {
        walletAddress: user.walletAddress || "NA",
        principalWallet: user.principalWallet?.amount || 0,
        myWallet: user.myWallet?.amount || 0,
        emgtWallet: user.emgtWallet?.amount || 0,
        depositWallet: user.depositWallet?.amount || 0,
        referralWallet: user.referralWallet?.amount || 0,
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const getInvestments = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("package");
    if (!user) return res.status(404).json(errorResponse("User not found"));

    const teamInvestment = await calculateDownlineInvestment(user.referralCode);

    const investments = user.package ? [user.package] : [];
    res.status(200).json(
      successResponse("Investments retrieved", {
        selfInvestment: user.totalSelfInvestment, // Use totalSelfInvestment
        teamInvestment, // Use updated downline investment
        investments,
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const swapDepositToToken = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json(errorResponse("Invalid amount"));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Check sufficient balance in depositWallet
    if (user.depositWallet.amount < amount) {
      return res
        .status(400)
        .json(errorResponse("Insufficient balance in deposit wallet"));
    }

    // Deduct from depositWallet
    user.depositWallet.amount -= amount;

    // Convert to token (assuming 1:1 conversion rate for simplicity; adjust if needed)
    const tokenPrice = await Price.findOne({ currencyType: "URWA" });
    if (!tokenPrice) {
      return res.status(500).json(errorResponse("Token price not available"));
    }

    const swapFeePercentage = 0.02;
    const swapFee = amount * swapFeePercentage;
    const netUsdtAmount = amount - swapFee;
    const tokenAmount = netUsdtAmount / tokenPrice.price; // Or apply conversion: amount * conversionRate

    // Add to emgtWallet (assuming it's the token wallet)
    user.emgtWallet.amount += tokenAmount;

    await user.save();

    const swap = new Swap({
      userId: user._id,
      user_id: user.user_id,
      usdtAmount: amount,
      emgtAmount: tokenAmount,
      tokenPrice: tokenPrice.price,
      swapFee: swapFee,
      walletType: "deposit",
      status: "completed",
      swapDetails: { originalAmount: amount, fee: swapFee, tokenAmount },
    });
    await swap.save();

    res.status(200).json(
      successResponse("Deposit swapped to token successfully", {
        swappedAmount: amount,
        tokenAmount,
        newDepositBalance: user.depositWallet.amount,
        newEmgtBalance: user.emgtWallet.amount,
      }),
    );
  } catch (error) {
    console.error("Error in swapDepositToToken:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getSwaps = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    // Fetch swaps with population and sorting
    const swaps = await Swap.find({ userId: user._id })
      .populate("userId", "email") // Populate user email for reference
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .lean();

    res
      .status(200)
      .json(successResponse("Swaps retrieved successfully", swaps));
  } catch (error) {
    console.error("Error fetching swaps:", error);
    res
      .status(500)
      .json(errorResponse("An error occurred while fetching swaps"));
  }
};

// Referral data

const getReferralData = async (req, res) => {
  try {
    const {
      level,
      startDate,
      endDate,
      directOnly,
      search,
      page = 1,
      limit = 10,
    } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // BFS to fetch downline users by referral levels
    const levelData = {};
    const queue = [];

    const directUsers = await User.find({
      referredBy: user.referralCode,
    }).lean();
    directUsers.forEach((u) => queue.push({ user: u, level: 1 }));

    while (queue.length > 0) {
      const { user, level: lvl } = queue.shift(); // ✅ Fixed destructuring

      if (!levelData[lvl]) {
        levelData[lvl] = [];
      }

      levelData[lvl].push({
        id: user._id,
        userName: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        level: lvl, // ✅ Level is now correctly set
        plan: user.package?.name,
        joinDate: user.createdAt,
        selfInvestment: user.totalSelfInvestment || 0,
        leftTeamInvestment: user.leftLegInvestment || 0,
        rightTeamInvestment: user.rightLegInvestment || 0,
      });

      const downlineUsers = await User.find({
        referredBy: user.referralCode,
      }).lean();
      downlineUsers.forEach((d) => queue.push({ user: d, level: lvl + 1 }));
    }

    // Apply filters
    let filteredLevelData = levelData;

    if (directOnly === "true") {
      filteredLevelData = { 1: levelData[1] || [] };
    } else if (level) {
      const targetLevel = parseInt(level);
      filteredLevelData = { [targetLevel]: levelData[targetLevel] || [] };
    }

    // Date filter
    if (startDate || endDate) {
      const start = startDate
        ? moment(startDate).startOf("day").toDate()
        : null;
      const end = endDate ? moment(endDate).endOf("day").toDate() : null;

      for (const lvl in filteredLevelData) {
        filteredLevelData[lvl] = filteredLevelData[lvl].filter((u) => {
          const joinDate = new Date(u.joinDate);
          return (!start || joinDate >= start) && (!end || joinDate <= end);
        });
      }
    }

    // Flatten for search & pagination
    let allUsers = [];
    for (const lvl in filteredLevelData) {
      filteredLevelData[lvl].forEach((u) => {
        allUsers.push({ ...u }); // level is already correct
      });
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter(
        (u) =>
          (u.firstName && u.firstName.toLowerCase().includes(searchLower)) ||
          (u.lastName && u.lastName.toLowerCase().includes(searchLower)) ||
          (u.email && u.email.toLowerCase().includes(searchLower)) ||
          (u.userName && u.userName.toLowerCase().includes(searchLower)),
      );
    }

    // Sort: by level → joinDate
    allUsers.sort(
      (a, b) =>
        a.level - b.level || new Date(a.joinDate) - new Date(b.joinDate),
    );

    // Pagination
    const total = allUsers.length;
    const paginatedUsers = allUsers.slice((page - 1) * limit, page * limit);

    const formattedData = paginatedUsers.map((u, index) => ({
      sr: (page - 1) * limit + index + 1,
      ...u,
    }));

    res.status(200).json(
      successResponse("Referral data retrieved", {
        selfInvestment: user.totalSelfInvestment || 0,
        data: formattedData,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching referral data:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// const getTeamTreeView = async (req, res) => {
//   try {
//     // Validate user ID
//     if (!req.user?.id) {
//       return res.status(400).json(errorResponse("Invalid user ID"));
//     }

//     // Fetch the authenticated user
//     const authUser = await User.findById(req.user.id).lean(); // Use lean for performance
//     if (!authUser) {
//       return res.status(404).json(errorResponse("User not found"));
//     }

//     const { userId, count = 1, search = "" } = req.query;
//     const targetUserId = userId || authUser.user_id;

//     // Fetch the target user
//     const targetUser = await User.findOne({ user_id: targetUserId })
//       .lean()
//       .select(
//         "user_id sponsor_id username totalSelfInvestment",
//       );
//     if (!targetUser) {
//       return res.status(404).json(errorResponse("User not found"));
//     }

//     // Recursive function to build the tree up to the specified count (depth)
//     const buildTree = async (userUserId, remainingCount, search = "") => {
//       const u = await User.findOne({ user_id: userUserId })
//         .lean()
//         .select(
//           "user_id sponsor_id username totalSelfInvestment first_name last_name email",
//         );
//       if (!u) return null;

//       const lowerSearch = search.toLowerCase();
//       const matches =
//         !search ||
//         u.username.toLowerCase().includes(lowerSearch) ||
//         u.first_name.toLowerCase().includes(lowerSearch) ||
//         u.last_name.toLowerCase().includes(lowerSearch) ||
//         u.email.toLowerCase().includes(lowerSearch);

//       let children = [];
//       if (remainingCount > 1) {
//         const directChildren = await User.find({ parent: userUserId })
//           .lean()
//           .select(
//             "user_id sponsor_id username totalSelfInvestment first_name last_name email",
//           );
//         const childrenPromises = directChildren.map((child) =>
//           buildTree(child.user_id, remainingCount - 1, search)
//         );
//         children = (await Promise.all(childrenPromises)).filter(Boolean);
//       }

//       if (!matches && children.length === 0) {
//         return null;
//       }

//       let teamInvestment = 0;

//       children.forEach((child) => {
//         teamInvestment +=
//           child.selfInvestment + child.teamInvestment;
//       });

//       const node = {
//         user_id: u.user_id,
//         username: u.username || "Unknown",
//         firstName: u.first_name || "N/A",
//         lastName: u.last_name || "N/A",
//         email: u.email || "N/A",
//         sponsorId: u.sponsor_id || null,
//         selfInvestment: u.totalSelfInvestment || 0,
//         teamInvestment,
//         children,
//       };

//       return node;
//     };

//     // Build the tree
//     const tree = await buildTree(targetUserId, parseInt(count), search);

//     if (!tree) {
//       return res.status(404).json(errorResponse("Tree not found"));
//     }

//     // Format response
//     res.status(200).json(
//       successResponse("Team tree view retrieved", {
//         selfInvestment: targetUser.totalSelfInvestment || 0,
//         teamInvestment: tree.teamInvestment || 0,
//         data: [tree],
//       }),
//     );
//   } catch (error) {
//     // Log error for debugging
//     console.error("Error in getTeamTreeView:", error);
//     res.status(500).json(errorResponse("Internal server error"));
//   }
// };


const getTeamTreeView = async (req, res) => {
  try {
    const { userId, search = "" } = req.query;

    // 🔍 Logged-in user
    const authUser = await User.findById(req.user.id).select(
      "userId referralCode totalInvested name username email"
    );

    if (!authUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const targetUserId = userId || authUser.userId;

    // 🔍 Target user
    const targetUser = await User.findOne({ userId: targetUserId })
      .select("userId referralCode totalInvested name username email")
      .lean();

    if (!targetUser) {
      return res.status(404).json({
        status: "error",
        message: "Target user not found",
      });
    }

    // 🔥 Dynamic direct referrals (MAIN USER)
    const directReferrals = await User.countDocuments({
      referredBy: targetUser.referralCode,
    });

    // 🔁 Recursive Tree Builder
    const buildTree = async (parentReferralCode, level = 1) => {
      const children = await User.find({
        referredBy: parentReferralCode,
      })
        .select("userId username name email totalInvested referralCode")
        .lean();

      if (!children.length) return [];

      const result = await Promise.all(
        children.map(async (child) => {
          // 🔁 recursion
          const subChildren = await buildTree(child.referralCode, level + 1);

          // 🔥 child direct referrals
          const childDirectReferrals = await User.countDocuments({
            referredBy: child.referralCode,
          });

          // 🔥 team investment
          const teamInvestment = subChildren.reduce(
            (sum, c) => sum + (c.selfInvestment + c.teamInvestment),
            0
          );

          return {
            id: child._id,
            userId: child.userId,
            name: child.name,
            username: child.username,
            email: child.email,
            referralCode: child.referralCode,

            selfInvestment: child.totalInvested || 0,
            teamInvestment,
            directReferrals: childDirectReferrals, // ✅ added

            level,
            children: subChildren,
          };
        })
      );

      return result;
    };

    // 🌳 Build tree
    let treeChildren = await buildTree(targetUser.referralCode);

    // 🔍 Search filter
    if (search) {
      const keyword = search.toLowerCase();

      const filterTree = (nodes) => {
        return nodes
          .map((node) => {
            const match =
              node.username?.toLowerCase().includes(keyword) ||
              node.name?.toLowerCase().includes(keyword) ||
              node.email?.toLowerCase().includes(keyword);

            const filteredChildren = filterTree(node.children || []);

            if (match || filteredChildren.length) {
              return {
                ...node,
                children: filteredChildren,
              };
            }

            return null;
          })
          .filter(Boolean);
      };

      treeChildren = filterTree(treeChildren);
    }

    // 🔥 Total team investment
    const totalTeamInvestment = treeChildren.reduce(
      (sum, node) =>
        sum + node.selfInvestment + node.teamInvestment,
      0
    );

    // ✅ FINAL RESPONSE
    return res.status(200).json({
      status: "success",
      message: "Team tree fetched successfully",
      data: {
        selfInvestment: targetUser.totalInvested || 0,
        teamInvestment: totalTeamInvestment,
        directReferrals, // ✅ main user count

        tree: [
          {
            id: targetUser._id,
            userId: targetUser.userId,
            name: targetUser.name,
            username: targetUser.username,
            email: targetUser.email,
            referralCode: targetUser.referralCode,

            selfInvestment: targetUser.totalInvested || 0,
            teamInvestment: totalTeamInvestment,
            directReferrals, // ✅ add here also

            level: 0,
            children: treeChildren,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Team Tree Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};





const getLevelWiseIncome = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // Build query for referrals
    const query = { referrerId: user._id };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate)
        query.createdAt.$gte = moment(startDate).startOf("day").toDate();
      if (endDate) query.createdAt.$lte = moment(endDate).endOf("day").toDate();
    }

    // Fetch all referrals for the user
    const referrals = await ReferralReward.find(query)
      .populate("referredId", "email username") // Include username for better identification
      .lean();

    // Group referrals by level and calculate income
    const levelWiseIncome = referrals.reduce((acc, ref) => {
      const level = ref.level || 1; // Default to level 1 if undefined
      if (!acc[level]) {
        acc[level] = {
          totalIncome: 0,
          referralCount: 0,
          referrals: [],
          rewardPlan: {}, // Placeholder for reward plan per level
        };
      }
      acc[level].totalIncome += ref.earned || 0;
      acc[level].referralCount += 1;
      acc[level].referrals.push({
        id: ref.referredId?._id,
        name: ref.referredId?.username || ref.referredId?.email,
        level: ref.level,
        earned: ref.earned || 0,
        joinDate: ref.createdAt,
        stakeData: {
          amount: ref.stakeAmount || 0, // Assume stakeAmount if stored in Referral
          stakeId: ref.stakeId || "N/A", // Assume stakeId if stored
          status: ref.stakeStatus || "N/A", // Assume stakeStatus if stored
        },
      });
      // Add sample reward plan (replace with actual logic)
      acc[level].rewardPlan = {
        percentage: level * 5, // Example: 5% for level 1, 10% for level 2, etc.
        description: `Level ${level} Referral Reward`,
      };
      return acc;
    }, {});

    // Format result with serial numbers
    const formattedData = Object.keys(levelWiseIncome).reduce((acc, level) => {
      acc[level] = {
        totalIncome: levelWiseIncome[level].totalIncome.toFixed(2),
        level: level,
        referralCount: levelWiseIncome[level].referralCount,
        rewardPlan: levelWiseIncome[level].rewardPlan,
        referrals: levelWiseIncome[level].referrals.map((ref, index) => ({
          sr: index + 1,
          ...ref,
        })),
      };
      return acc;
    }, {});

    // Calculate total team investment
    const teamInvestment = await calculateDownlineInvestment(user.referralCode);

    res.status(200).json(
      successResponse("Level-wise referral income retrieved", {
        selfInvestment: user.totalSelfInvestment || 0,
        teamInvestment: teamInvestment.toFixed(2) || 0,
        data: formattedData,
        timestamp: moment().toISOString(), // Add current timestamp
      }),
    );
  } catch (error) {
    console.error("Error fetching level-wise income:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Get Direct Team API
// const getDirectTeam = async (req, res) => {
//   try {
//     const { startDate, endDate, page = 1, limit = 10, level } = req.query;
//     const user = await User.findById(req.user.id).select(
//       "referralCode totalSelfInvestment",
//     );
//     if (!user) {
//       return res.status(404).json(errorResponse("User not found"));
//     }

//     // Validate level parameter (direct team is typically level 1)
//     const targetLevel = level ? parseInt(level, 10) : 1;
//     if (targetLevel !== 1) {
//       return res
//         .status(400)
//         .json(errorResponse("Direct team is only available for level 1"));
//     }

//     // Build query for direct referrals
//     const query = { referredBy: user.referralCode };
//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate)
//         query.createdAt.$gte = moment(startDate).startOf("day").toDate();
//       if (endDate) query.createdAt.$lte = moment(endDate).endOf("day").toDate();
//     }

//     // Calculate pagination
//     const pageNum = parseInt(page, 10);
//     const limitNum = parseInt(limit, 10);
//     const skip = (pageNum - 1) * limitNum;

//     // Fetch direct referrals with pagination
//     const directReferrals = await User.find(query)
//       .populate("package", "name investment")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     // Fetch total count for pagination
//     const totalDirectReferrals = await User.countDocuments(query);

//     // Map direct referrals to include additional details
//     const directTeam = await Promise.all(
//       directReferrals.map(async (u, index) => {
//         const teamInvestment = await calculateDownlineInvestment(
//           u.referralCode,
//         );
//         return {
//           sr: skip + index + 1, // Serial number for pagination
//           id: u._id,
//           userName: u.username || u.email.split("@")[0],
//           email: u.email,
//           level: 1, // Direct referrals are always level 1
//           plan: u.package?.name || "N/A",
//           selfInvestment: u.totalSelfInvestment || 0,
//           teamInvestment,
//           joinDate: u.createdAt,
//         };
//       }),
//     );

//     res.status(200).json(
//       successResponse("Direct team retrieved successfully", {
//         selfInvestment: user.totalSelfInvestment || 0,
//         directTeam,
//         pagination: {
//           total: totalDirectReferrals,
//           page: pageNum,
//           limit: limitNum,
//           totalPages: Math.ceil(totalDirectReferrals / limitNum),
//         },
//       }),
//     );
//   } catch (error) {
//     console.error("Error fetching direct team:", error);
//     res.status(500).json(errorResponse(error.message));
//   }
// };


const getDirectTeam = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // 🔍 Logged-in user
    const user = await User.findById(req.user.id).select(
      "referralCode totalInvested"
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // 📄 Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 👇 Direct referrals only
    const query = { referredBy: user.referralCode };

    const directUsers = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await User.countDocuments(query);

    // 🧾 Format response
    const directTeam = directUsers.map((u, index) => ({
      sr: skip + index + 1,
      id: u._id,
      name: u.name,
      username: u.username,
      userId: u.userId,
      referralCode: u.referralCode,
      walletBalance: u.walletBalance,
      totalInvested: u.totalInvested,
      totalReferrals: u.totalReferrals,
      isActive: u.isActive,
      joinDate: u.createdAt,
    }));

    return res.status(200).json({
      status: "success",
      message: "Direct team fetched successfully",
      data: {
        selfInvestment: user.totalInvested || 0,
        directTeam,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Direct Team Error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get Indirect Team API
// const getIndirectTeam = async (req, res) => {
//   try {
//     const { startDate, endDate, page = 1, limit = 10, level } = req.query;
//     const user = await User.findById(req.user.id).select(
//       "referralCode totalSelfInvestment",
//     );
//     if (!user) {
//       return res.status(404).json(errorResponse("User not found"));
//     }

//     // Fetch direct referrals to start building the indirect team
//     const directReferrals = await User.find({ referredBy: user.referralCode })
//       .select("referralCode")
//       .lean();

//     if (!directReferrals.length) {
//       return res.status(404).json(errorResponse("No direct referrals found"));
//     }

//     // Recursive function to fetch indirect team
//     const getIndirectTeamRecursively = async (
//       referralCodes,
//       currentLevel = 1,
//       levelData = {},
//     ) => {
//       if (!referralCodes.length) return levelData;

//       const users = await User.find({
//         referredBy: { $in: referralCodes },
//       })
//         .populate("package", "name investment")
//         .lean();

//       if (!users.length) return levelData;

//       if (!levelData[currentLevel]) {
//         levelData[currentLevel] = [];
//       }

//       const nextLevelReferralCodes = [];
//       for (const u of users) {
//         levelData[currentLevel].push({
//           id: u._id,
//           userName: u.username || u.email.split("@")[0],
//           email: u.email,
//           plan: u.package?.name || "N/A",
//           selfInvestment: u.totalSelfInvestment || 0,
//           teamInvestment: await calculateDownlineInvestment(u.referralCode),
//           joinDate: u.createdAt,
//         });
//         nextLevelReferralCodes.push(u.referralCode);
//       }

//       // Recursively fetch next level
//       await getIndirectTeamRecursively(
//         nextLevelReferralCodes,
//         currentLevel + 1,
//         levelData,
//       );
//       return levelData;
//     };

//     // Fetch indirect team data
//     let indirectTeamData = await getIndirectTeamRecursively(
//       directReferrals.map((u) => u.referralCode),
//       1,
//     );

//     // Filter by specific level if provided
//     if (level) {
//       const targetLevel = parseInt(level, 10);
//       if (targetLevel < 1) {
//         return res.status(400).json(errorResponse("Level must be at least 1"));
//       }
//       indirectTeamData = { [targetLevel]: indirectTeamData[targetLevel] || [] };
//     }

//     // Apply date filtering
//     if (startDate || endDate) {
//       const start = startDate
//         ? moment(startDate).startOf("day").toDate()
//         : null;
//       const end = endDate ? moment(endDate).endOf("day").toDate() : null;
//       for (const lvl in indirectTeamData) {
//         indirectTeamData[lvl] = indirectTeamData[lvl].filter((user) => {
//           const joinDate = new Date(user.joinDate);
//           return (!start || joinDate >= start) && (!end || joinDate <= end);
//         });
//       }
//     }

//     // Apply pagination
//     const pageNum = parseInt(page, 10);
//     const limitNum = parseInt(limit, 10);
//     const skip = (pageNum - 1) * limitNum;

//     // Flatten data for pagination
//     const allIndirectUsers = Object.values(indirectTeamData)
//       .flat()
//       .sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate));

//     const totalIndirectUsers = allIndirectUsers.length;
//     const paginatedIndirectUsers = allIndirectUsers.slice(
//       skip,
//       skip + limitNum,
//     );

//     // Add serial numbers
//     const indirectTeam = paginatedIndirectUsers.map((user, index) => ({
//       sr: skip + index + 1,
//       ...user,
//     }));

//     // Calculate total team investment
//     const teamInvestment = await calculateDownlineInvestment(user.referralCode);

//     if (!indirectTeam.length) {
//       return res
//         .status(404)
//         .json(errorResponse("No indirect team members found"));
//     }

//     res.status(200).json(
//       successResponse("Indirect team retrieved successfully", {
//         selfInvestment: user.totalSelfInvestment || 0,
//         teamInvestment,
//         indirectTeam,
//         pagination: {
//           total: totalIndirectUsers,
//           page: pageNum,
//           limit: limitNum,
//           totalPages: Math.ceil(totalIndirectUsers / limitNum),
//         },
//       }),
//     );
//   } catch (error) {
//     console.error("Error fetching indirect team:", error);
//     res.status(500).json(errorResponse(error.message));
//   }
// };

const getIndirectTeam = async (req, res) => {
  try {
    const { page = 1, limit = 10, level } = req.query;

    // 🔍 Logged-in user
    const user = await User.findById(req.user.id).select(
      "referralCode totalInvested"
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 🔥 Step 1: Get direct referrals
    const directReferrals = await User.find({
      referredBy: user.referralCode,
    }).select("referralCode");

    if (!directReferrals.length) {
      return res.status(200).json({
        status: "success",
        message: "No indirect team found",
        data: {
          selfInvestment: user.totalInvested || 0,
          indirectTeam: [],
          pagination: {
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        },
      });
    }

    // 🔁 Recursive fetch
    const getDownline = async (codes, currentLevel = 1, result = []) => {
      if (!codes.length) return result;

      const users = await User.find({
        referredBy: { $in: codes },
      }).lean();

      if (!users.length) return result;

      let nextCodes = [];

      for (let u of users) {
        result.push({
          ...u,
          level: currentLevel,
        });
        nextCodes.push(u.referralCode);
      }

      return getDownline(nextCodes, currentLevel + 1, result);
    };

    let allIndirectUsers = await getDownline(
      directReferrals.map((u) => u.referralCode)
    );

    // 🎯 Filter by level (optional)
    if (level) {
      const lvl = parseInt(level);
      allIndirectUsers = allIndirectUsers.filter(
        (u) => u.level === lvl
      );
    }

    // 📊 Sort latest first
    allIndirectUsers.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const total = allIndirectUsers.length;

    // 📄 Pagination
    const paginated = allIndirectUsers.slice(skip, skip + limitNum);

    // 🧾 Format like direct team
    const indirectTeam = paginated.map((u, index) => ({
      sr: skip + index + 1,
      id: u._id,
      name: u.name,
      username: u.username,
      userId: u.userId,
      referralCode: u.referralCode,
      walletBalance: u.walletBalance,
      totalInvested: u.totalInvested,
      totalReferrals: u.totalReferrals,
      isActive: u.isActive,
      joinDate: u.createdAt,
      level: u.level, // 🔥 important
    }));

    return res.status(200).json({
      status: "success",
      message: "Indirect team fetched successfully",
      data: {
        selfInvestment: user.totalInvested || 0,
        indirectTeam,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Indirect Team Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//end referral data

const getDailyROI = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // Build query for ROI distributions
    const query = { userId: user._id };
    if (startDate || endDate) {
      query.distributionDate = {};
      if (startDate)
        query.distributionDate.$gte = moment(startDate).startOf("day").toDate();
      if (endDate)
        query.distributionDate.$lte = moment(endDate).endOf("day").toDate();
    }

    const total = await RoiDistribution.countDocuments(query);
    const distributions = await RoiDistribution.find(query)
      .sort({ distributionDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const formattedData = distributions.map((dist, index) => ({
      sr: (page - 1) * limit + index + 1,
      planName: dist.planName,
      stakeId: dist.stakeId,
      amount: dist.amount,
      dailyROI: dist.dailyROI,
      dailyROIPercentage: dist.dailyROIPercentage,
      stakeAmount: dist.stakeAmount,
      distributionDate: dist.distributionDate,
    }));

    // Calculate total team investment
    const teamInvestment = await calculateDownlineInvestment(user.referralCode);

    res.status(200).json(
      successResponse("Daily ROI data retrieved", {
        selfInvestment: user.totalSelfInvestment || 0,
        teamInvestment,
        data: formattedData,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching daily ROI:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getReferralIncome = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, status } = req.query;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // Build query
    const query = { userId: user._id };

    // Status filter (default: completed)
    if (status) {
      query.status = status;
    } else {
      query.status = "completed"; // keep your original default
    }

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {}; // or distributionDate if your model has it
      if (startDate) {
        query.createdAt.$gte = moment(startDate).startOf("day").toDate();
      }
      if (endDate) {
        query.createdAt.$lte = moment(endDate).endOf("day").toDate();
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch paginated records
    const referrals = await ReferralReward.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Total Referral Income (sum of filtered records)
    const totalReferralIncome = await ReferralReward.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((res) => res[0]?.total || 0);

    // Total records for pagination
    const totalRecords = await ReferralReward.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / Number(limit));

    // Add serial number (global per page)
    const formattedReferrals = referrals.map((ref, index) => ({
      sr: skip + index + 1,
      ...ref,
    }));

    res.status(200).json(
      successResponse("Referral income retrieved successfully", {
        selfInvestment: user.totalSelfInvestment || 0,
        teamInvestment: await calculateDownlineInvestment(user.referralCode),
        referralCount: totalRecords, // Total across all pages
        totalReferralIncome,
        referrals: formattedReferrals,
        pagination: {
          total: totalRecords,
          page: Number(page),
          limit: Number(limit),
          totalPages,
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching referral income:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getLevelIncomeReward = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    const user = await User.findById(req.user.id).select(
      "totalSelfInvestment referralCode email name",
    );
    if (!user || !user.email) {
      return res
        .status(404)
        .json(errorResponse("User not found or email not available"));
    }

    // Build query
    const query = { userId: user._id };
    if (startDate || endDate) {
      query.distributionDate = {};
      if (startDate)
        query.distributionDate.$gte = moment(startDate).startOf("day").toDate();
      if (endDate)
        query.distributionDate.$lte = moment(endDate).endOf("day").toDate();
    }

    // Fetch all records for this user (with date filter)
    const rewards = await LevelReward.find(query)
      .sort({ distributionDate: -1 })
      .lean();

    // Group by date
    const dailyRewards = rewards.reduce((acc, reward) => {
      const date = moment(reward.distributionDate).format("YYYY-MM-DD");
      if (!acc[date]) {
        acc[date] = { totalRewardAmount: 0, records: [] };
      }
      acc[date].totalRewardAmount += reward.amount || 0;
      acc[date].records.push({
        level: reward.level,
        rank: `Level ${reward.level}`,
        investmentAmount: reward.investmentAmount,
        rewardAmount: reward.amount,
        fromUserId: reward.fromUserId,
        user_id: reward.user_id,
        distributionDate: reward.distributionDate,
      });
      return acc;
    }, {});

    // Flatten all records with global SR
    const sortedDates = Object.keys(dailyRewards).sort((a, b) =>
      b.localeCompare(a),
    ); // newest first

    let allFlatRecords = [];
    let globalSrCounter = 1;

    sortedDates.forEach((date) => {
      dailyRewards[date].records.forEach((record) => {
        allFlatRecords.push({
          date,
          sr: globalSrCounter++,
          ...record,
        });
      });
    });

    // === Pagination ===
    const totalRecords = allFlatRecords.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedFlatRecords = allFlatRecords.slice(
      skip,
      skip + Number(limit),
    );

    // Re-group only paginated records back by date
    const paginatedDaily = paginatedFlatRecords.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = { totalRewardAmount: 0, records: [] };
      }
      acc[date].totalRewardAmount += item.rewardAmount || 0;
      acc[date].records.push({
        sr: item.sr,
        level: item.level,
        rank: item.rank,
        investmentAmount: item.investmentAmount,
        rewardAmount: item.rewardAmount,
        fromUserId: item.fromUserId,
        user_id: item.user_id,
        distributionDate: item.distributionDate,
      });
      return acc;
    }, {});

    // Final formatted data (grouped by date)
    const formattedData = Object.keys(paginatedDaily).reduce((acc, date) => {
      acc[date] = {
        totalRewardAmount: paginatedDaily[date].totalRewardAmount,
        recordCount: paginatedDaily[date].records.length,
        records: paginatedDaily[date].records,
      };
      return acc;
    }, {});

    // Calculate team investment
    const teamInvestment = await calculateDownlineInvestment(user.referralCode);

    // Level Plan mapping
    const levelPlans = await LevelPlan.find().lean();
    const levelPlanMap = levelPlans.reduce((map, plan) => {
      map[plan.name] = plan;
      return map;
    }, {});

    // Add level plan details
    Object.keys(formattedData).forEach((date) => {
      formattedData[date].records = formattedData[date].records.map(
        (record) => ({
          ...record,
        }),
      );
    });

    res.status(200).json(
      successResponse("Level income rewards retrieved", {
        selfInvestment: user.totalSelfInvestment || 0,
        teamInvestment,
        data: formattedData,
        pagination: {
          total: totalRecords,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalRecords / Number(limit)),
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching level income rewards:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getTransactionHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    const deposits = await Deposit.find({ userId: user._id }).sort({
      createdAt: -1,
    });
    const withdrawals = await Withdrawal.find({ userId: user._id }).sort({
      createdAt: -1,
    });
    const swaps = await Swap.find({ userId: user._id }).sort({ createdAt: -1 });
    const stakes = await Stake.find({ userId: user._id }).sort({
      createdAt: -1,
    });
    const transactions = [
      ...deposits,
      ...withdrawals,
      ...swaps,
      ...stakes,
    ].sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json(
      successResponse("Transaction history retrieved", {
        selfInvestment: user.totalSelfInvestment, // Use totalSelfInvestment
        teamInvestment: await calculateDownlineInvestment(user.referralCode), // Use updated downline investment
        transactions,
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    // 🔥 Dynamic referral count
    const totalReferrals = await User.countDocuments({
      referredBy: user.referralCode,
    });

    res.status(200).json({
      success: true,
      user,
      totalReferrals, // ✅ dynamic value
    });

  } catch (error) {
    console.error("Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};



const CreateInvestment = async (req, res) => {
  try {
    const { telegramId, amount } = req.body;

    // ❗ Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 💰 Balance check
    if (user.walletBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // 💸 Deduct balance
    user.walletBalance -= amount;
    user.totalInvested += amount;
    await user.save();

    // 🔥 CALCULATION
    const totalReturn = amount * 1.1; // 110%
    const totalDays = 700;
    const dailyIncome = totalReturn / totalDays;

    // 📅 End Date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + totalDays);

    // 🆕 Save investment
    const investment = await Investment.create({
      userId: user.userId,
      amount,
      totalReturn,
      dailyIncome,
      totalDays,
      endDate,
    });

    res.json({
      success: true,
      message: "Investment successful",
      investment,
    });

  } catch (error) {
    console.error("Investment Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};








const updateUserProfilePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Update password if provided
    let passwordChanged = false;
    if (newPassword) {
      if (!currentPassword) {
        return res
          .status(400)
          .json(
            errorResponse("Current password is required to update password"),
          );
      }

      const isMatch = await user.comparePassword(currentPassword);
      console.log("Password Match Result:", isMatch);
      if (!isMatch) {
        return res
          .status(401)
          .json(errorResponse("Current password is incorrect"));
      }

      // Set the new password (plain text) and let the pre-save middleware hash it
      user.password = newPassword;
      passwordChanged = true;
    }

    user.updatedAt = new Date(); // Update timestamp
    await user.save();

    // Invalidate old token and return new token if password changed
    let newToken = req.headers.authorization?.split(" ")[1]; // Existing token
    if (passwordChanged) {
      newToken = jwt.sign(
        { id: user._id, role: user.role },
        config.JWT_SECRET,
        { expiresIn: "1h" },
      );
      res.setHeader("X-New-Token", newToken); // Send new token in header
    }

    res.status(200).json(
      successResponse("User profile updated successfully", {
        profile: {
          updatedAt: user.updatedAt,
        },
        token: passwordChanged ? newToken : undefined,
      }),
    );
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Get All Level Plans
const getAllLevelPlans = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (page < 1 || limit < 1) {
      return res
        .status(400)
        .json(errorResponse("Page and limit must be positive integers"));
    }

    const skip = (page - 1) * limit;

    const levelPlans = await LevelPlan.find()
      .sort({ roi: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await LevelPlan.countDocuments();

    if (!levelPlans.length) {
      return res.status(404).json(errorResponse("No level plans found"));
    }

    res.status(200).json(
      successResponse("All level plans retrieved successfully", {
        levelPlans,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching all level plans:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const sendSupportEmail = async (req, res) => {
  try {
    const { subject, message, name, email, phone } = req.body;

    // Early input validation
    if (!subject || !message) {
      return res
        .status(400)
        .json(errorResponse("Subject and message are required"));
    }

    // Fetch authenticated user (cached or from DB)
    const userCacheKey = `user:${req.user.id}`;
    let user = await redisClient.get(userCacheKey);
    if (user) {
      user = JSON.parse(user);
    } else {
      user = await User.findById(req.user.id).select("email username").lean();
      if (user) {
        await redisClient.set(userCacheKey, JSON.stringify(user), { EX: 3600 });
      }
    }

    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Use authenticated user's email if no email is provided
    const userEmail = email || user.email;
    const username = user.username || user.email.split("@")[0];

    // Rate limiting using Redis
    const rateLimitKey = `supportEmail:${req.user.id}`;
    const emailCount = await redisClient.get(rateLimitKey);
    const maxEmailsPerHour = 5; // Limit to 5 emails per hour

    if (emailCount && parseInt(emailCount, 10) >= maxEmailsPerHour) {
      return res
        .status(429)
        .json(
          errorResponse(
            "Too many support emails sent. Please try again later.",
          ),
        );
    }

    // Generate unique ticketId
    const ticketId = `TICKET-${uuidv4().slice(0, 8)}`;

    // Create support ticket
    const supportTicket = await Support.create({
      ticketId,
      username,
      userEmail,
      name: name || "",
      email: userEmail,
      phone: phone || "",
      subject,
      message,
      status: "open",
      createdAt: new Date(),
    });

    // Increment email count with 1-hour expiry
    await redisClient.set(rateLimitKey, parseInt(emailCount || 0) + 1, {
      EX: 3600,
    });

    // Send email asynchronously (non-blocking)
    sendSupportEmails(
      "support@embot.co",
      `Support Request from EMBOT.CO User: ${subject}`,
      "support-request",
      {
        ticketId,
        username,
        userEmail,
        name: name || "",
        email: userEmail,
        phone: phone || "",
        subject,
        message,
        timestamp: moment()
          .tz("Asia/Kolkata")
          .format("HH:mm:ss A, DD MMMM YYYY"),
      },
    ).catch((err) => {
      console.error(`Error sending support email for ticket ${ticketId}:`, {
        message: err.message,
        stack: err.stack,
      });
    });

    res.status(200).json(
      successResponse("Support ticket created and email sent successfully", {
        ticketId,
      }),
    );
  } catch (error) {
    console.error(`Error sending support email for user ${req.user?.id}:`, {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(errorResponse(`Validation failed: ${errors.join(", ")}`));
    }

    res
      .status(500)
      .json(
        errorResponse("Failed to send support email. Please try again later."),
      );
  }
};

const contactFormEmail = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Input validation
    if (!subject || !message) {
      return res
        .status(400)
        .json({ error: "Subject and message are required" });
    }
    if (!email && !req.email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Use authenticated user's email if no email is provided
    const userEmail = email || req.email;

    // Rate limiting using Redis
    const rateLimitKey = `supportEmail:${userEmail}`;
    const emailCount = await redisClient.get(rateLimitKey);
    const maxEmailsPerHour = 10;

    if (emailCount && parseInt(emailCount, 10) >= maxEmailsPerHour) {
      return res.status(429).json({
        error: "Too many support emails sent. Please try again later.",
      });
    }

    // Increment email count with 1-hour expiry
    await redisClient.set(
      rateLimitKey,
      emailCount ? parseInt(emailCount, 10) + 1 : 1,
      { EX: 3600 },
    );

    // Send email asynchronously
    try {
      await sendSupportEmails(
        "support@embot.co",
        `Support Request from EMBOT.CO User: ${subject}`,
        "contact-form-email",
        {
          userEmail,
          name: name || "Anonymous",
          email: userEmail,
          phone: phone || "Not provided",
          subject,
          message,
          timestamp: moment()
            .tz("Asia/Kolkata")
            .format("HH:mm:ss A, DD MMMM YYYY"),
        },
      );
    } catch (emailError) {
      console.error(`Error sending support email for ${userEmail}:`, {
        message: emailError.message,
        stack: emailError.stack,
      });
      // Optionally return a failure response instead of silent logging
      return res.status(500).json({
        error: "Failed to send support email. Please try again later.",
      });
    }

    return res
      .status(200)
      .json({ message: "Support ticket created and email sent successfully" });
  } catch (error) {
    console.error(
      `Error processing support email for user ${req.user?.id || "unknown"}:`,
      {
        message: error.message,
        stack: error.stack,
        body: req.body,
      },
    );

    return res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

const logout = async (req, res) => {
  try {
    res.status(200).json(successResponse("Logout successful"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};





// Gouri Code



// const NETWORK_CONFIG = {
//   // Web20 / ETH USDT (Ethereum Mainnet)
//   WEB20_USDT: {
//     coin: "USDT",
//     wallet: process.env.EVM_WALLET,
//     url: "https://api.cryptapi.io/erc20/usdt/create/"
//   },

//   // Base USDT
//   BASE_USDT: {
//     coin: "USDT",
//     wallet: process.env.EVM_WALLET,
//     url: "https://api.cryptapi.io/base/usdt/create/"
//   },

//   // Base USDC
//   BASE_USDC: {
//     coin: "USDC",
//     wallet: process.env.EVM_WALLET,
//     url: "https://api.cryptapi.io/base/usdc/create/"
//   },

//   // Polygon USDT
//   POLYGON_USDT: {
//     coin: "USDT",
//     wallet: process.env.EVM_WALLET,
//     url: "https://api.cryptapi.io/polygon/usdt/create/"
//   }
// };

// const createDeposit = async (req, res) => {
//   try {
//     const { userId, amount, network } = req.body;

//     if (!userId) {
//       return res.status(400).json({ success: false, message: "userId required" });
//     }

//     const user = await User.findOne({ userId });
//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     const config = NETWORK_CONFIG[network];

//     if (!config) {
//       return res.status(400).json({ success: false, message: "Invalid network" });
//     }

//     if (!config.wallet) {
//       return res.status(500).json({
//         success: false,
//         message: `${network} wallet not configured`
//       });
//     }

//     const callbackUrl = `${process.env.BASE_URL}/user/deposit/callback?secret=${process.env.CRYPTAPI_SECRET}`;

//     const response = await axios.get(config.url, {
//       params: {
//         address: config.wallet,
//         callback: callbackUrl,
//         order_id: userId,
//       }
//     });

//     const deposit = await Deposit.create({
//       userId: user._id,
//       depositAddress: response.data.address_in,
//       amount,
//       coin: config.coin,
//       network,
//       status: "pending"
//     });

//     res.json({
//       success: true,
//       data: response.data,
//       depositId: deposit._id
//     });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({
//       success: false,
//       message: "Deposit failed"
//     });
//   }
// };

const NETWORK_CONFIG = {
  WEB20_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/erc20/usdt/create/"
  },

  BASE_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/base/usdt/create/"
  },

  BASE_USDC: {
    coin: "USDC",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/base/usdc/create/"
  },

  POLYGON_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/polygon/usdt/create/"
  },
  BEP20_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,       
    url: "https://api.cryptapi.io/bep20/usdt/create/"
  }
};

const createDeposit = async (req, res) => {
  try {
    const { userId, amount, network } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const config = NETWORK_CONFIG[network];
    if (!config) {
      return res.status(400).json({ success: false, message: `Invalid network: ${network}` });
    }

    if (!config.wallet) {
      return res.status(500).json({ success: false, message: `${network} wallet not configured` });
    }

    const callbackUrl = `${process.env.BASE_URL}/user/deposit/callback?secret=${process.env.CRYPTAPI_SECRET}`;

    console.log(`Creating ${network} deposit for user ${userId}`);

    const response = await axios.get(config.url, {
      params: {
        address: config.wallet,
        callback: callbackUrl,
        order_id: userId,
        multi_token: 1,        
        json: 1,
      }
    });

    // for error
    if (response.data?.status === "error" || !response.data?.address_in) {
      const errMsg = response.data?.message || response.data?.error || "CryptAPI error";
      console.error("CryptAPI Error:", response.data);
      return res.status(400).json({ success: false, message: errMsg });
    }

    const deposit = await Deposit.create({
      userId: user._id,
      depositAddress: response.data.address_in,
      amount: Number(amount),
      coin: config.coin,
      network,
      status: "pending"
    });

    res.json({
      success: true,
      data: response.data,
      depositId: deposit._id
    });

  } catch (err) {
    console.error("Full Deposit Error:", err.response?.data || err.message);
    
    let message = "Deposit failed";
    if (err.response?.data?.message) {
      message = err.response.data.message;
    } else if (err.message) {
      message = err.message;
    }

    res.status(500).json({ success: false, message });
  }
};



// const depositCallback = async (req, res) => {
//   try {
//     console.log("🔔 Callback Hit");

//     // 🔥 Handle BOTH: GET (CryptAPI) + POST (testing)
//     const data = Object.keys(req.query).length ? req.query : req.body;

//     const {
//       address_in,
//       value,
//       txid,
//       confirmations,
//       secret
//     } = data;

//     console.log("📥 Incoming Data:", {
//       address_in,
//       value,
//       txid,
//       confirmations,
//       secret
//     });

//     // 🔐 1. Secret Validation
//     if (secret !== process.env.CRYPTAPI_SECRET) {
//       console.log("❌ Invalid secret");
//       return res.send("Invalid secret");
//     }

//     // 💰 2. Amount Validation
//     const amount = parseFloat(value);
//     if (isNaN(amount) || amount <= 0) {
//       console.log("❌ Invalid amount:", value);
//       return res.send("Invalid amount");
//     }

//     // ⛓️ 3. Confirmation Check (SAFE ≥ 2)
//     if (!confirmations || Number(confirmations) < 2) {
//       console.log("⏳ Waiting for confirmations:", confirmations);
//       return res.send("Waiting for confirmations");
//     }

//     // 🔍 4. Find Deposit
//     const deposit = await Deposit.findOne({
//       depositAddress: address_in
//     });

//     if (!deposit) {
//       console.log("⚠️ Deposit not found");
//       return res.send("Deposit not found");
//     }

//     // 🔁 5. Prevent Duplicate Credit
//     if (deposit.status === "completed") {
//       console.log("⚠️ Already processed");
//       return res.send("Already processed");
//     }

//     // 👤 6. Find User
//     const user = await User.findById(deposit.userId);
//     if (!user) {
//       console.log("❌ User not found");
//       return res.send("User not found");
//     }

//     // 💰 7. Credit Wallet
//     user.wallet = (user.wallet || 0) + amount;
//     await user.save();

//     // 🧾 8. Update Deposit
//     deposit.status = "completed";
//     deposit.transactionHash = txid;
//     deposit.creditedAmount = amount;
//     deposit.confirmations = Number(confirmations);
//     deposit.completedAt = new Date();

//     await deposit.save();

//     console.log("✅ Deposit SUCCESS:", {
//       userId: user._id,
//       amount,
//       txid,
//       network: deposit.network
//     });

//     // ✅ IMPORTANT (CryptAPI needs OK)
//     return res.send("OK");

//   } catch (error) {
//     console.error("❌ Callback Error:", error);
//     return res.send("Error");
//   }
// };




const logCallback = async ({
  req,
  data,
  status = "pending",
  message = "",
  network = ""
}) => {
  try {
    await DepositCallbackLog.create({
      rawData: data,

      address_in: data.address_in,
      address_out: data.address_out,

      txid: data.txid,
      amount: parseFloat(data.value || 0),
      value_coin: data.value_coin,

      confirmations: Number(data.confirmations || 0),
      coin: data.coin,
      network,

      fee: data.fee,
      pending: data.pending,

      status,
      message,

      // 🔥 Extra Debug Info
      ip: req?.ip,
      method: req?.method,
      headers: req?.headers
    });

  } catch (err) {
    console.error("❌ Log save failed:", err.message);
  }
};




const depositCallback = async (req, res) => {
  try {
    console.log("🔔 Callback Hit");

    // 🔥 FULL RAW DATA (NO LOSS)
    const fullData = {
      ...req.query,
      ...req.body
    };

    console.log("📦 FULL DATA:", fullData);

    const {
      address_in,
      value,
      txid,
      confirmations,
      secret
    } = fullData;

    // 🔐 Secret Check
    if (secret !== process.env.CRYPTAPI_SECRET) {
      await logCallback({
        req,
        data: fullData,
        status: "failed",
        message: "Invalid secret"
      });
      return res.send("Invalid secret");
    }

    // 💰 Amount Check
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      await logCallback({
        req,
        data: fullData,
        status: "failed",
        message: "Invalid amount"
      });
      return res.send("Invalid amount");
    }

    // ⛓️ Confirmation Check
    if (!confirmations || Number(confirmations) < 2) {
      await logCallback({
        req,
        data: fullData,
        status: "pending",
        message: "Waiting confirmations"
      });
      return res.send("Waiting for confirmations");
    }

    // 🔍 Find Deposit
    const deposit = await Deposit.findOne({
      depositAddress: address_in
    });

    if (!deposit) {
      await logCallback({
        req,
        data: fullData,
        status: "failed",
        message: "Deposit not found"
      });
      return res.send("Deposit not found");
    }

    // 🔁 Duplicate Protection
    if (deposit.status === "completed") {
      await logCallback({
        req,
        data: fullData,
        status: "duplicate",
        message: "Already processed",
        network: deposit.network
      });
      return res.send("Already processed");
    }

    // 👤 Find User
    const user = await User.findById(deposit.userId);
    if (!user) {
      await logCallback({
        req,
        data: fullData,
        status: "failed",
        message: "User not found",
        network: deposit.network
      });
      return res.send("User not found");
    }

    // 💸 OPTIONAL: Prevent duplicate TXID
    const existingTx = await Deposit.findOne({ transactionHash: txid });
    if (existingTx) {
      await logCallback({
        req,
        data: fullData,
        status: "duplicate",
        message: "Duplicate TXID",
        network: deposit.network
      });
      return res.send("Duplicate TX");
    }

    // 💰 Credit Wallet
    user.wallet = (user.wallet || 0) + amount;
    await user.save();

    // 🧾 Update Deposit
    deposit.status = "completed";
    deposit.transactionHash = txid;
    deposit.creditedAmount = amount;
    deposit.confirmations = Number(confirmations);
    deposit.completedAt = new Date();

    await deposit.save();

    // ✅ SUCCESS LOG
    await logCallback({
      req,
      data: fullData,
      status: "success",
      message: "Deposit credited",
      network: deposit.network
    });

    console.log("✅ Deposit SUCCESS:", {
      userId: user._id,
      amount,
      txid
    });

    return res.send("OK");

  } catch (error) {
    console.error("❌ Callback Error:", error);

    await logCallback({
      req,
      data: {
        ...req.query,
        ...req.body
      },
      status: "error",
      message: error.message
    });

    return res.send("Error");
  }
};











module.exports = {
  getUserStakedPlans,
  getAllPackageDetails,
  requestWithdrawalOtp,
  withdraw,
  getWithdrawalHistory,
  getDashboard,
  getWalletDetails,
  getInvestments,
  swapDepositToToken,
  getSwaps,
  getDailyROI,
  getLevelIncomeReward,
  getReferralIncome,
  getTransactionHistory,
  getUserProfile,
  updateUserProfilePassword,
  getReport,
  getTeamTreeView,

  getReferralData,
  getTeamTreeView,
  getLevelWiseIncome,

  getDirectTeam,
  getIndirectTeam,

  getAllLevelPlans,

  sendSupportEmail,
  contactFormEmail,
  logout,
  CreateInvestment,
  createDeposit,
  depositCallback,
  

};
