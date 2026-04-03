const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../../models/User");
const Package = require("../../models/Package");
const ReinvestTransaction = require("../../models/ReinvestTransaction");
const TransferTransaction = require("../../models/TransferTransaction");
const BonanzaPlan = require("../../models/BonanzaPlan");
const BonanzaReward = require("../../models/BonanzaReward");
const RoiDistribution = require("../../models/RoiDistribution");
const Referral = require("../../models/Referral");
const LevelIncome = require("../../models/LevelIncome");
const BinaryIncome = require("../../models/BinaryIncome");
const LeadershipShare = require("../../models/LeadershipShare");
const LeadershipBonus = require("../../models/LeadershipBonus");
const Deposit = require("../../models/Deposit");
const Withdrawal = require("../../models/Withdrawal");
const Stake = require("../../models/Stake");
const RankUpdateHistory = require("../../models/RankUpdateHistory");
const Investment = require("../../models/Investment");
const Swap = require("../../models/Swap");
const Price = require("../../models/Price");
const AdminLoginLog = require("../../models/AdminLoginLog");
const WalletUpdateLog = require("../../models/WalletUpdateLog");
const SupportTicket = require("../../models/supportEmail");
const LevelPlan = require("../../models/LevelPlan");
const LevelReward = require("../../models/LevelIncome");
const { sendEmail } = require("../../services/emailService");
const { saveOTP, verifyOTP } = require("../../services/otpService");
const { verifySignature } = require("../../services/web3Service");
const { calculateReferralIncome } = require("../../services/referralIncomeDistributionService");
const { successResponse, errorResponse } = require("../../utils/responses");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const config = require("../../config/envConfig");
const Admin = require("../../models/Admin");
const redisClient = require("../../config/redisClient");
const ethers = require("ethers");

// Admin Dashboard Endpoints

// Get admin dashboard data
const getAdminDashboard = async (req, res) => {
  try {
    // Ensure the user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Admin access required"));
    }

    // Total users (excluding admins)
    const totalUsers = await User.countDocuments({ role: "user" });

    // Total inactive users (users with isEmailVerified: false)
    const totalInactiveUsers = await User.countDocuments({
      role: "user",
      isEmailVerified: false,
    });

    // Total user investment (sum of totalSelfInvestment for all users)
    const totalUserInvestment = await User.aggregate([
      { $match: { role: "user" } },
      { $group: { _id: null, total: { $sum: "$totalSelfInvestment" } } },
    ]).then((result) => result[0]?.total || 0);

    // Total plan stake number (count of Stake records)
    const totalPlanStakeNumber = await Stake.countDocuments();

    // Total user balance (sum of all wallet amounts across users)
    const totalUserBalance = await User.aggregate([
      { $match: { role: "user" } },
      {
        $project: {
          totalWallet: {
            $add: [
              "$principalWallet.amount",
              "$depositWallet.amount",
              "$myWallet.amount",
              "$referralWallet.amount",
            ],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalWallet" } } },
    ]).then((result) => result[0]?.total || 0);

    const totalUserMyWalletBalance = await User.aggregate([
      { $match: { role: "user" } },
      {
        $project: {
          totalWallet: {
            $add: ["$myWallet.amount"],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalWallet" } } },
    ]).then((result) => result[0]?.total || 0);

    const totalUserEMGTWalletBalance = await User.aggregate([
      { $match: { role: "user" } },
      {
        $project: {
          totalWallet: {
            $add: ["$emgtWallet.amount"],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalWallet" } } },
    ]).then((result) => result[0]?.total || 0);

    // Total user principal balance (sum of all principal wallet amounts)
    const totalUserPrincipalWalletBalance = await User.aggregate([
      { $match: { role: "user" } },
      {
        $project: {
          totalWallet: {
            $add: ["$principalWallet.amount"],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalWallet" } } },
    ]).then((result) => result[0]?.total || 0);

    const totalUserReferralWalletBalance = await User.aggregate([
      { $match: { role: "user" } },
      {
        $project: {
          totalWallet: {
            $add: ["$referralWallet.amount"],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalWallet" } } },
    ]).then((result) => result[0]?.total || 0);

    // Total withdraw amount (sum of all Withdrawal amounts)
    const totalWithdrawAmount = await Withdrawal.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((result) => result[0]?.total || 0);

    // Total withdraw done (sum of completed Withdrawal amounts)
    const totalWithdrawDone = await Withdrawal.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((result) => result[0]?.total || 0);

    // Total team (total users excluding admins)
    const totalTeam = totalUsers;

    // Total admin direct (users with referral code 'admin123')
    const totalAdminDirect = await User.countDocuments({
      referredBy: "admin123",
    });

    // Total admin indirect (users whose referredBy is not 'admin123')
    const totalAdminIndirect = await User.countDocuments({
      role: "user",
      referredBy: { $ne: "admin123" },
    });

    // Total swap charge collected (sum of swap fees from Swap records)
    const totalSwapChargeCollected = await Swap.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$swapDetails.fee",
          },
        },
      },
    ]).then((result) => result[0]?.total || 0);

    const totalTransactionChargeCollected = await Withdrawal.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$withdrawalFee",
          },
        },
      },
    ]).then((result) => result[0]?.total || 0);

    const totalSwapedAmount = await Swap.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$swapDetails.originalAmount",
          },
        },
      },
    ]).then((result) => result[0]?.total || 0);

    const totalRoiDistributed = await RoiDistribution.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]).then((result) => result[0]?.total || 0);

    const totalReferralRewardDistributed = await Referral.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]).then((result) => result[0]?.total || 0);

    const totalLevelRewardDistributed = await LevelReward.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]).then((result) => result[0]?.total || 0);

    const totalShoppingPoint = await User.aggregate([
        { $group: { _id: null, total: { $sum: "$shopping_points" } } },
      ]).then((result) => result[0]?.total || 0);

      // Total shares distributed
      const totalLoyaltyPoints = await User.aggregate([
        { $group: { _id: null, total: { $sum: "$loyalty_points" } } },
      ]).then((result) => result[0]?.total || 0);

    const emgtTokenPrice = await Price.findOne({ currencyType: "SGN" }).select(
      "price",
    );


    // Fetch 5 latest transactions (Deposit, Withdrawal requests, and Stake)
    const latestDeposits = await Deposit.find()
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();
    const latestWithdrawals = await Withdrawal.find()
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();
    const latestStakes = await Stake.find()
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    // Combine and sort all transactions, then take the top 5
    const allTransactions = [
      ...latestDeposits.map((d) => ({ ...d, type: "deposit" })),
      ...latestWithdrawals.map((w) => ({ ...w, type: "withdrawal" })),
      ...latestStakes.map((s) => ({ ...s, type: "stake" })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Fetch 5 latest user registrations
    const latestUsers = await User.find({ role: "user" })
      .select("userId username referralCode referredBy email createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json(
      successResponse("Admin dashboard data retrieved successfully", {
        totalUsers,
        totalInactiveUsers,
        totalUserInvestment,
        totalPlanStakeNumber,
        totalUserBalance,
        totalUserMyWalletBalance,
        totalUserEMGTWalletBalance,
        totalUserPrincipalWalletBalance,
        totalUserReferralWalletBalance,
        totalWithdrawAmount,
        totalWithdrawDone,
        totalTeam,
        totalAdminDirect,
        totalAdminIndirect,
        totalSwapChargeCollected,
        totalShoppingPoint,
        totalLoyaltyPoints,
        totalTransactionChargeCollected,
        totalRoiDistributed,
        totalReferralRewardDistributed,
        totalLevelRewardDistributed,
        totalSwapedAmount,
        emgtTokenPrice,
        latestTransactions: allTransactions,
        latestUsers,
      }),
    );
  } catch (error) {
    console.error("Error in getAdminDashboard:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all users with all data including password
const getAllUsers = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, search, user_id } = req.query;

    const matchQuery = { role: "user" };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Exact match by user_id if provided
    if (user_id) {
      matchQuery.user_id = user_id; // Assuming 'user_id' is a field in User schema
    }

    // Search option: partial match on username, email, or user_id
    if (search) {
      matchQuery.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { user_id: { $regex: search, $options: "i" } }, // Assuming 'user_id' is searchable
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.find(matchQuery)
      .select("-__v")
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalUsers = await User.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalUsers / Number(limit));

    res.status(200).json(
      successResponse("Users retrieved successfully", {
        users: users.map((user) => ({
          ...user,
        })),
        currentPage: Number(page),
        totalPages,
        totalUsers,
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Update user status (withdraw, roi, bonanza, block)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      withdrawEnabled,
      roiEnabled,
      bonanzaEnabled,
      levelEnabled,
      isBlocked,
    } = req.body;

    if (
      withdrawEnabled === undefined &&
      roiEnabled === undefined &&
      bonanzaEnabled === undefined &&
      levelEnabled === undefined &&
      isBlocked === undefined
    ) {
      return res
        .status(400)
        .json(errorResponse("At least one field must be provided for update"));
    }

    const updateFields = {};
    if (withdrawEnabled !== undefined)
      updateFields.withdrawEnabled = !!withdrawEnabled;
    if (roiEnabled !== undefined) updateFields.roiEnabled = !!roiEnabled;
    if (bonanzaEnabled !== undefined)
      updateFields.bonanzaEnabled = !!bonanzaEnabled;
    if (levelEnabled !== undefined) updateFields.levelEnabled = !!levelEnabled;
    if (isBlocked !== undefined) updateFields.isBlocked = !!isBlocked;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).select("-__v");

    res
      .status(200)
      .json(successResponse("User status updated successfully", { user }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Deposit amount to user wallet and log in Deposit table with auto-generated transactionHash
const depositToWallet = async (req, res) => {
  try {
    const { userId, walletType, amount, currencyType } = req.body;

    // Validate input
    if (!userId || !walletType || amount === undefined) {
      return res
        .status(400)
        .json(errorResponse("userId, walletType, and amount are required"));
    }

    if (amount <= 0) {
      return res
        .status(400)
        .json(errorResponse("Amount must be a positive number"));
    }

    const validWalletTypes = ["principal", "my", "deposit"];
    if (!validWalletTypes.includes(walletType)) {
      return res
        .status(400)
        .json(
          errorResponse(
            "Invalid walletType. Must be one of: principal, my, deposit",
          ),
        );
    }

    const validCurrencyTypes = ["USDT"];
    if (currencyType && !validCurrencyTypes.includes(currencyType)) {
      return res
        .status(400)
        .json(
          errorResponse("Invalid currencyType. Must be one of: USDT, URWA"),
        );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ user_id: userId }).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json(errorResponse("User not found"));
      }

      const adminId = req.user.id;
      const timestamp = Date.now().toString();
      const randomStr = crypto.randomBytes(4).toString("hex");
      const transactionHash = `ADMIN_${adminId}_USER_${userId}_TIME_${timestamp}_RAND_${randomStr}`;

      const walletMap = {
        principal: "principalWallet",
        my: "myWallet",
        deposit: "depositWallet",
      };
      const walletKey = walletMap[walletType];
      if (!user[walletKey]) {
        return res
          .status(400)
          .json(
            errorResponse(
              `Wallet type ${walletType} not supported in user model`,
            ),
          );
      }

      user[walletKey].amount = (user[walletKey].amount || 0) + amount;
      await user.save({ session });

      const deposit = new Deposit({
        userId: user._id,
        user_id: user.user_id,
        walletType,
        amount,
        currencyType: currencyType || "USDT",
        transactionHash,
        status: "completed",
      });
      await deposit.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Exclude password from user response
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(200).json(
        successResponse("Amount deposited successfully", {
          user: userResponse,
          deposit,
        }),
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all deposit reports
const getAllDeposits = async (req, res) => {
  try {
    console.log("Fetching deposits..."); // Debug log
    const deposits = await Deposit.find()
      .populate("userId") // Populate user details
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    // Transform deposits to exclude password from userId
    const sanitizedDeposits = deposits.map((deposit) => {
      const depositObj = deposit.toObject(); // Convert deposit to plain object
      if (depositObj.userId && typeof depositObj.userId === "object") {
        const userObj = depositObj.userId; // Already a plain object, no need for toObject()
        delete userObj.password; // Exclude password from user object
        depositObj.userId = userObj;
      }
      return depositObj;
    });

    res.status(200).json(
      successResponse("Deposit reports retrieved successfully", {
        deposits: sanitizedDeposits,
      }),
    );
  } catch (error) {
    console.error("Error in getAllDeposits:", error); // Debug log
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all Bonanza Reward history
const getBonanzaRewardHistory = async (req, res) => {
  try {
    console.log("Fetching Bonanza Reward history..."); // Debug log
    const bonanzaRewards = await BonanzaReward.find()
      .populate("userId")
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    // Transform to exclude password
    const sanitizedBonanzaRewards = bonanzaRewards.map((reward) => {
      const rewardObj = reward.toObject();
      if (rewardObj.userId && typeof rewardObj.userId === "object") {
        const userObj = rewardObj.userId;
        delete userObj.password; // Exclude password
        rewardObj.userId = userObj;
      }
      return rewardObj;
    });

    res.status(200).json(
      successResponse("Bonanza Reward history retrieved successfully", {
        bonanzaRewards: sanitizedBonanzaRewards,
      }),
    );
  } catch (error) {
    console.error("Error in getBonanzaRewardHistory:", error); // Debug log
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all ROI Distribution history
const getRoiDistributionHistory = async (req, res) => {
  try {
    console.log("Fetching ROI Distribution history..."); // Debug log
    const roiDistributions = await RoiDistribution.find()
      .populate("userId")
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    // Transform to exclude password
    const sanitizedRoiDistributions = roiDistributions.map((dist) => {
      const distObj = dist.toObject();
      if (distObj.userId && typeof distObj.userId === "object") {
        const userObj = distObj.userId;
        delete userObj.password; // Exclude password
        distObj.userId = userObj;
      }
      return distObj;
    });

    res.status(200).json(
      successResponse("ROI Distribution history retrieved successfully", {
        roiDistributions: sanitizedRoiDistributions,
      }),
    );
  } catch (error) {
    console.error("Error in getRoiDistributionHistory:", error); // Debug log
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all Referral history
const getReferralHistory = async (req, res) => {
  try {
    console.log("Fetching Referral history..."); // Debug log
    const referrals = await Referral.find()
      .populate("referrerId referredId")
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    // Transform to exclude password
    const sanitizedReferrals = referrals.map((ref) => {
      const refObj = ref.toObject();
      if (refObj.referrerId && typeof refObj.referrerId === "object") {
        const referrerObj = refObj.referrerId;
        delete referrerObj.password; // Exclude password
        refObj.referrerId = referrerObj;
      }
      if (refObj.referredId && typeof refObj.referredId === "object") {
        const referredObj = refObj.referredId;
        delete referredObj.password; // Exclude password
        refObj.referredId = referredObj;
      }
      return refObj;
    });

    res.status(200).json(
      successResponse("Referral history retrieved successfully", {
        referrals: sanitizedReferrals,
      }),
    );
  } catch (error) {
    console.error("Error in getReferralHistory:", error); // Debug log
    res.status(500).json(errorResponse(error.message));
  }
};

// Set Price
const setTokenPrice = async (req, res) => {
  try {
    const { currencyType, price } = req.body;
    if (!currencyType || !price || !["USDT", "SGN"].includes(currencyType)) {
      return res
        .status(400)
        .json(errorResponse("Invalid currency type or price"));
    }

    // Update or create price record
    await Price.findOneAndUpdate(
      { currencyType },
      { price, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    res
      .status(200)
      .json(successResponse(`Price for ${currencyType} set to ${price}`));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Report (Generic for admin)
const getAdminReport = async (req, res) => {
  try {
    const { type } = req.query; // e.g., 'usersDeposit', 'investments', 'withdrawals', 'swap'
    let reportData;

    switch (type) {
      case "usersDeposit":
        reportData = await Deposit.aggregate([
          { $group: { _id: "$userId", total: { $sum: "$amount" } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { userEmail: "$user.email", totalAmount: "$total" } },
        ]);
        break;
      case "investments":
        reportData = await Stake.aggregate([
          { $group: { _id: "$userId", total: { $sum: "$amount" } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { userEmail: "$user.email", totalInvestment: "$total" } },
        ]).concat(
          await Swap.aggregate([
            { $group: { _id: "$userId", total: { $sum: "$amount" } } },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            {
              $project: { userEmail: "$user.email", totalInvestment: "$total" },
            },
          ]),
        );
        break;
      case "withdrawals":
        reportData = await Withdrawal.aggregate([
          { $group: { _id: "$userId", total: { $sum: "$amount" } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { userEmail: "$user.email", totalWithdrawn: "$total" } },
        ]);
        break;
      case "swap":
        reportData = await Swap.aggregate([
          { $group: { _id: "$userId", total: { $sum: "$amount" } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { userEmail: "$user.email", totalSwapped: "$total" } },
        ]);
        break;
      default:
        return res.status(400).json(errorResponse("Invalid report type"));
    }

    res.status(200).json(successResponse(`Report for ${type}`, { reportData }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Investment Management
// Package Management (CRUD Operations)
const createPackage = async (req, res) => {
  try {
    const {
      name,
      investment,
      dailyROI,
      lockingPeriodDays,
      tokenConversionLockUntil,
    } = req.body;

    // Validation: Check for required fields
    if (!name || !investment || !dailyROI || !lockingPeriodDays) {
      return res
        .status(400)
        .json(errorResponse("Invalid or missing package details"));
    }

    // Validation: Ensure name is a non-empty string
    if (typeof name !== "string" || name.trim().length === 0) {
      return res
        .status(400)
        .json(errorResponse("Package name must be a non-empty string"));
    }

    // Validation: Ensure numeric fields are valid numbers and positive
    if (
      isNaN(investment) ||
      isNaN(dailyROI) ||
      isNaN(lockingPeriodDays) ||
      investment <= 0 ||
      dailyROI < 0 ||
      lockingPeriodDays <= 0
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            "Investment, dailyROI, and lockingPeriodDays must be positive numbers",
          ),
        );
    }

    // Validation: Check if tokenConversionLockUntil is a valid date (if provided)
    let parsedDate = null;
    if (tokenConversionLockUntil) {
      parsedDate = new Date(tokenConversionLockUntil);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json(errorResponse("Invalid tokenConversionLockUntil date format"));
      }
    }

    const packageId = `PKG-${uuidv4().slice(0, 8)}`; // Generate unique packageId

    const newPackage = new Package({
      name: name.trim(), // Sanitize name by trimming whitespace
      packageId,
      investment,
      dailyROI,
      lockingPeriodDays,
      tokenConversionLockUntil: parsedDate,
    });

    await newPackage.save();
    res
      .status(201)
      .json(successResponse("Package created successfully", newPackage));
  } catch (error) {
    res
      .status(500)
      .json(errorResponse(`Failed to create package: ${error.message}`));
  }
};

const getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find().sort({ investment: 1 }).lean();

    res
      .status(200)
      .json(successResponse("All packages retrieved", { packages }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      investment,
      dailyROI,
      lockingPeriodDays,
      tokenConversionLockUntil,
    } = req.body;

    // Validate required fields
    if (
      !id ||
      !name ||
      investment === undefined ||
      dailyROI === undefined ||
      lockingPeriodDays === undefined
    ) {
      return res
        .status(400)
        .json(errorResponse("Invalid or missing package details"));
    }

    // Convert and validate numeric fields
    const parsedInvestment = parseFloat(investment);
    const parsedDailyROI = parseFloat(dailyROI);
    const parsedLockingPeriodDays = parseInt(lockingPeriodDays, 10);

    if (isNaN(parsedInvestment) || parsedInvestment <= 0) {
      return res.status(400).json(errorResponse("Invalid investment amount"));
    }
    if (isNaN(parsedDailyROI) || parsedDailyROI < 0 || parsedDailyROI > 100) {
      return res
        .status(400)
        .json(errorResponse("Invalid daily ROI (must be between 0 and 100)"));
    }
    if (isNaN(parsedLockingPeriodDays) || parsedLockingPeriodDays <= 0) {
      return res.status(400).json(errorResponse("Invalid locking period days"));
    }

    const lockUntilDate = tokenConversionLockUntil
      ? new Date(tokenConversionLockUntil)
      : null;
    if (tokenConversionLockUntil && isNaN(lockUntilDate.getTime())) {
      return res
        .status(400)
        .json(errorResponse("Invalid token conversion lock until date"));
    }

    const updatedPackage = await Package.findByIdAndUpdate(
      id,
      {
        name,
        investment: parsedInvestment,
        dailyROI: parsedDailyROI,
        lockingPeriodDays: parsedLockingPeriodDays,
        tokenConversionLockUntil: lockUntilDate,
      },
      { new: true, runValidators: true },
    );

    if (!updatedPackage)
      return res.status(404).json(errorResponse("Package not found"));
    res
      .status(200)
      .json(successResponse("Package updated successfully", updatedPackage));
  } catch (error) {
    console.error("Error updating package:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json(errorResponse("Package ID is required"));

    const package = await Package.findById(id);
    if (!package)
      return res.status(404).json(errorResponse("Package not found"));

    const associatedUsers = await User.find({ package: package._id });
    if (associatedUsers.length > 0) {
      return res
        .status(400)
        .json(errorResponse("Cannot delete package with associated users"));
    }

    const deletedPackage = await Package.findByIdAndDelete(id);
    if (!deletedPackage)
      return res.status(404).json(errorResponse("Failed to delete package"));

    res.status(200).json(
      successResponse("Package deleted successfully", {
        _id: deletedPackage._id,
      }),
    );
  } catch (error) {
    console.error("Error deleting package:", error);
    res
      .status(500)
      .json(errorResponse("An error occurred while deleting the package"));
  }
};

// Bonanza Plan Management (CRUD Operations)
const createBonanzaPlan = async (req, res) => {
  try {
    const { name, roi, minDirect, target } = req.body;
    if (!name || !roi || !minDirect || !target) {
      return res
        .status(400)
        .json(errorResponse("Invalid or missing bonanza plan details"));
    }

    const newBonanzaPlan = new BonanzaPlan({
      name,
      roi,
      minDirect,
      target,
    });

    await newBonanzaPlan.save();
    res
      .status(201)
      .json(
        successResponse("Bonanza plan created successfully", newBonanzaPlan),
      );
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json(errorResponse("Bonanza plan name must be unique"));
    }
    res.status(500).json(errorResponse(error.message));
  }
};

const getAllBonanzaPlans = async (req, res) => {
  try {
    const bonanzaPlans = await BonanzaPlan.find();
    res
      .status(200)
      .json(successResponse("All bonanza plans retrieved", { bonanzaPlans }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const updateBonanzaPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, roi, minDirect, target } = req.body;
    if (
      !id ||
      !name ||
      roi === undefined ||
      minDirect === undefined ||
      target === undefined
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            "Invalid or missing bonanza plan details (name, roi, minDirect, and target are required)",
          ),
        );
    }

    const parsedRoi = parseFloat(roi);
    const parsedMinDirect = parseInt(minDirect);
    const parsedTarget = parseFloat(target);
    if (isNaN(parsedRoi) || parsedRoi < 0 || parsedRoi > 100) {
      return res
        .status(400)
        .json(errorResponse("ROI must be a number between 0 and 100"));
    }
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      return res
        .status(400)
        .json(errorResponse("Target must be a positive number"));
    }

    const updatedBonanzaPlan = await BonanzaPlan.findByIdAndUpdate(
      id,
      {
        name,
        roi: parsedRoi,
        minDirect: parsedMinDirect,
        target: parsedTarget,
      },
      { new: true, runValidators: true },
    );

    res
      .status(200)
      .json(
        successResponse(
          "Bonanza plan updated successfully",
          updatedBonanzaPlan,
        ),
      );
  } catch (error) {
    console.error("Error updating bonanza plan:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json(errorResponse("Bonanza plan name must be unique"));
    }
    res
      .status(500)
      .json(errorResponse("An error occurred while updating the bonanza plan"));
  }
};

const deleteBonanzaPlan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json(errorResponse("Bonanza plan ID is required"));

    const bonanzaPlan = await BonanzaPlan.findById(id);
    if (!bonanzaPlan)
      return res.status(404).json(errorResponse("Bonanza plan not found"));

    const associatedUsers = await User.find({ bonanzaPlan: bonanzaPlan._id });
    if (associatedUsers.length > 0) {
      return res
        .status(400)
        .json(
          errorResponse("Cannot delete bonanza plan with associated users"),
        );
    }

    const deletedBonanzaPlan = await BonanzaPlan.findByIdAndDelete(id);
    if (!deletedBonanzaPlan)
      return res
        .status(404)
        .json(errorResponse("Failed to delete bonanza plan"));

    res.status(200).json(
      successResponse("Bonanza plan deleted successfully", {
        _id: deletedBonanzaPlan._id,
      }),
    );
  } catch (error) {
    console.error("Error deleting bonanza plan:", error);
    res
      .status(500)
      .json(errorResponse("An error occurred while deleting the bonanza plan"));
  }
};

const getStakingProfits = async (req, res) => {
  try {
    const profits = await Stake.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$userId", totalProfit: { $sum: "$amount" } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $project: { userEmail: "$user.email", totalProfit: 1 } },
    ]);
    res
      .status(200)
      .json(successResponse("Staking profits retrieved", { profits }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Admin function to approve or reject withdrawal (new function)
// const approveWithdrawal = async (req, res) => {
//   try {
//     const { withdrawalId, action } = req.body; // action can be "approve" or "reject"
//     if (!withdrawalId || !["approve", "reject"].includes(action)) {
//       return res
//         .status(400)
//         .json(
//           errorResponse(
//             "withdrawalId and valid action (approve/reject) are required"
//           )
//         );
//     }

//     // Check if user is admin
//     if (!req.user || req.user.role !== "admin") {
//       return res.status(403).json(errorResponse("Admin access required"));
//     }

//     const withdrawal = await Withdrawal.findById(withdrawalId);
//     if (!withdrawal) {
//       return res
//         .status(404)
//         .json(errorResponse("Withdrawal request not found"));
//     }

//     // Ensure withdrawal is in pending state
//     if (withdrawal.status !== "pending") {
//       return res
//         .status(400)
//         .json(
//           errorResponse(
//             "Withdrawal can only be approved or rejected if pending"
//           )
//         );
//     }

//     const user = await User.findById(withdrawal.userId).select(
//       "email depositWallet emgtWallet myWallet referralWallet"
//     );
//     if (!user) {
//       return res.status(404).json(errorResponse("User not found"));
//     }

//     const walletMap = {
//       deposit: "depositWallet",
//       emgt: "emgtWallet",
//       my: "myWallet",
//       referral: "referralWallet",
//     };
//     const walletKey = walletMap[withdrawal.walletType];
//     if (!walletKey) {
//       return res.status(400).json(errorResponse("Invalid wallet type"));
//     }

//     const amount = withdrawal.amount;

//     if (action === "approve") {
//       // Update withdrawal status to completed
//       withdrawal.status = "completed";
//       // Optionally generate a transaction hash (similar to approveWithdrawal)
//       const transactionHash = crypto
//         .createHash("sha256")
//         .update(
//           `${req.user.id}_${withdrawalId}_${moment().unix()}_${crypto
//             .randomBytes(4)
//             .toString("hex")}`
//         )
//         .digest("hex");
//       withdrawal.transactionHash = transactionHash;
//       await withdrawal.save();

//       // No wallet adjustment needed as amount was already deducted
//     } else if (action === "reject") {
//       // Update withdrawal status to rejected
//       withdrawal.status = "rejected";
//       withdrawal.transactionHash = null;
//       await withdrawal.save();

//       // Refund the amount to the requested wallet
//       user[walletKey].amount = (user[walletKey].amount || 0) + amount;
//       await user.save();
//     }

//     res.status(200).json(
//       successResponse(`Withdrawal ${action}ed successfully`, {
//         withdrawalId: withdrawal._id,
//         status: withdrawal.status,
//         transactionHash: withdrawal.transactionHash || null,
//         amountRefunded: action === "reject" ? amount : 0,
//       })
//     );
//   } catch (error) {
//     console.error("Error in adminApproveWithdrawalRequest:", error);
//     res
//       .status(500)
//       .json(errorResponse(error.message || "Internal server error"));
//   }
// };

const decryptPrivateKey = (encryptedPrivateKey, encryptionKey) => {
  try {
    if (!encryptedPrivateKey || !encryptionKey) {
      throw new Error("Missing encrypted private key or encryption key");
    }

    const [ivHex, saltHex, encryptedHex] = encryptedPrivateKey.split(":");

    if (!ivHex || !saltHex || !encryptedHex) {
      throw new Error("Invalid encrypted private key format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const salt = Buffer.from(saltHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    if (iv.length !== 16) {
      throw new Error("Invalid IV length");
    }
    if (salt.length < 8) {
      throw new Error("Invalid salt length");
    }
    if (encrypted.length === 0) {
      throw new Error("Empty encrypted data");
    }

    const key = crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

// Admin function to approve or reject withdrawal
const approveWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const { withdrawalId, action } = req.body;

  try {
    if (!withdrawalId || !["approve", "reject"].includes(action)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          errorResponse(
            "withdrawalId and valid action (approve/reject) are required",
          ),
        );
    }

    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json(errorResponse("Admin access required"));
    }

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json(errorResponse("Withdrawal request not found"));
    }

    if (withdrawal.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          errorResponse(
            "Withdrawal can only be approved or rejected if pending",
          ),
        );
    }

    const user = await User.findById(withdrawal.userId)
      .select(
        "email depositWallet emgtWallet myWallet referralWallet principalWallet walletAddress",
      )
      .session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json(errorResponse("User not found"));
    }

    const walletMap = {
      principal: "principalWallet",
      deposit: "depositWallet",
      emgt: "emgtWallet",
      my: "myWallet",
      referral: "referralWallet",
    };
    const walletKey = walletMap[withdrawal.walletType];
    if (!walletKey) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json(errorResponse("Invalid wallet type"));
    }

    const amount = withdrawal.amount;
    const netAmount = withdrawal.actualPayAmount;

    if (action === "approve") {
      // Initialize provider
      const provider = new ethers.providers.JsonRpcProvider(config.BSC_RPC_URL);
      try {
        await provider.getBlockNumber(); // Test provider connection
        console.log("Provider connected successfully");
      } catch (err) {
        throw new Error(`Provider connection failed: ${err.message}`);
      }

      // Check USDT contract balance
      const usdtContract = new ethers.Contract(
        config.USDT_CONTRACT_ADDRESS, // USDT contract address
        config.USDT_CONTRACT_ABI, // ERC20 ABI
        provider,
      );
      let contractBalanceWei;
      try {
        contractBalanceWei = await usdtContract.balanceOf(
          config.WITHDRAW_CONTRACT_ADDRESS,
        );
        console.log(
          "USDT Contract Balance (Wei):",
          contractBalanceWei.toString(),
        );
      } catch (err) {
        throw new Error(
          `Failed to fetch USDT contract balance: ${err.message}`,
        );
      }

      // Convert netAmount to Wei (USDT has 6 decimals on BSC)
      const decimals = 18;
      let amountWei;
      try {
        amountWei = ethers.utils.parseUnits(netAmount.toString(), decimals);
        console.log("Amount in Wei:", amountWei.toString());
      } catch (err) {
        throw new Error(
          `Invalid amount format: ${netAmount}, error: ${err.message}`,
        );
      }

      // Check if contract has sufficient balance
      if (contractBalanceWei.lt(amountWei)) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json(
            errorResponse("Insufficient USDT contract balance for withdrawal"),
          );
      }

      // Validate user wallet address
      if (!ethers.utils.isAddress(user.walletAddress)) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json(
            errorResponse(`Invalid user wallet address: ${user.walletAddress}`),
          );
      }

      const encryptionKey = config.ENCRYPTION_KEY;
      const encryptedPrivateKey = config.ENCRYPTED_PRIVATE_KEY;
      if (!encryptionKey) {
        throw new Error("ENCRYPTION_KEY is not defined");
      }
      if (!encryptedPrivateKey) {
        throw new Error("ENCRYPTED_PRIVATE_KEY is not defined");
      }
      try {
        privateKey = decryptPrivateKey(encryptedPrivateKey, encryptionKey);
        console.log("Private key decrypted successfully");
      } catch (err) {
        throw new Error(`Failed to decrypt private key: ${err.message}`);
      }

      // Validate private key format
      if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error(
          `Invalid private key format: ${
            privateKey.slice(0, 6) + "..." + privateKey.slice(-4)
          }`,
        );
      }

      // Initialize wallet signer
      let walletSigner;
      try {
        walletSigner = new ethers.Wallet(privateKey, provider);
        console.log("Wallet Signer Address:", walletSigner.address);
      } catch (err) {
        throw new Error(`Failed to initialize wallet signer: ${err.message}`);
      }

      const contract = new ethers.Contract(
        config.WITHDRAW_CONTRACT_ADDRESS,
        config.WITHDRAW_CONTRACT_ABI,
        walletSigner,
      );

      const gasPrice = await provider.getGasPrice();
      const gasEstimate = await contract.estimateGas
        .userWithdraw(user.walletAddress, amountWei)
        .catch((err) => {
          throw new Error(`Gas estimation failed: ${err.message}`);
        });
      const gasCost = gasEstimate.mul(gasPrice);
      const walletBalance = await provider.getBalance(walletSigner.address);

      if (walletBalance.lt(gasCost)) {
        throw new Error(
          `Insufficient BNB for gas: have ${ethers.utils.formatEther(
            walletBalance,
          )} BNB, need ${ethers.utils.formatEther(gasCost)} BNB`,
        );
      }

      let tx;
      try {
        tx = await contract.userWithdraw(user.walletAddress, amountWei, {
          gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
          gasPrice,
        });
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt.transactionHash);
      } catch (err) {
        throw new Error(`Transaction failed: ${err.reason || err.message}`);
      }

      try {
        receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt.transactionHash);
      } catch (err) {
        throw new Error(`Transaction confirmation failed: ${err.message}`);
      }

      // Update withdrawal status to completed
      await Withdrawal.updateOne(
        { _id: withdrawalId },
        { status: "completed", transactionHash: tx.hash },
        { session },
      );

      // Commit the database transaction
      await session.commitTransaction();

      // Update withdrawal cache
      const withdrawalCacheKey = `withdrawal:${withdrawalId}`;
      withdrawal.status = "completed";
      withdrawal.txHash = tx.hash;
      await redisClient
        .set(withdrawalCacheKey, JSON.stringify(withdrawal), "EX", 3600)
        .catch((err) => {
          console.warn(
            `Redis set error for ${withdrawalCacheKey}:`,
            err.message,
          );
        });

      res.status(200).json(
        successResponse("Withdrawal approved and completed", {
          withdrawalId: withdrawal._id,
          status: "completed",
          txHash: tx.hash,
          amount: netAmount,
          walletAddress: user.walletAddress,
        }),
      );

      console.log(
        `Withdrawal approved for user ${withdrawal.userId}: ` +
          `net $${netAmount.toFixed(4)}, txHash: ${tx.hash}`,
      );
    } else if (action === "reject") {
      // Refund the amount to the requested wallet
      user[walletKey].amount = Number(
        ((user[walletKey].amount || 0) + amount).toFixed(2),
      );
      await User.updateOne(
        { _id: user._id },
        { [walletKey]: user[walletKey] },
        { session },
      );

      // Update withdrawal status to rejected
      await Withdrawal.updateOne(
        { _id: withdrawalId },
        { status: "rejected", txHash: null },
        { session },
      );

      // Commit the database transaction
      await session.commitTransaction();

      // Update user cache
      const userCacheKey = `user:${user._id}`;
      await redisClient
        .set(userCacheKey, JSON.stringify(user), "EX", 3600)
        .catch((err) => {
          console.warn(`Redis set error for ${userCacheKey}:`, err.message);
        });

      // Update withdrawal cache
      const withdrawalCacheKey = `withdrawal:${withdrawalId}`;
      withdrawal.status = "rejected";
      withdrawal.txHash = null;
      await redisClient
        .set(withdrawalCacheKey, JSON.stringify(withdrawal), "EX", 3600)
        .catch((err) => {
          console.warn(
            `Redis set error for ${withdrawalCacheKey}:`,
            err.message,
          );
        });

      res.status(200).json(
        successResponse("Withdrawal rejected and amount refunded", {
          withdrawalId: withdrawal._id,
          status: "rejected",
          amountRefunded: amount,
          walletType: withdrawal.walletType,
        }),
      );

      console.log(
        `Withdrawal rejected for user ${withdrawal.userId}: ` +
          `refunded $${amount.toFixed(4)} to ${withdrawal.walletType} wallet`,
      );
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in approveWithdrawal:", {
      message: error.message,
      stack: error.stack,
    });
    const withdrawalCacheKey = `withdrawal:${withdrawalId}`;
    if (
      error.code === "INSUFFICIENT_FUNDS" ||
      error.code === "NETWORK_ERROR" ||
      error.message.includes("transaction failed") ||
      error.message.includes("Invalid private key") ||
      error.message.includes("Gas estimation failed")
    ) {
      await Withdrawal.updateOne(
        { _id: withdrawalId },
        { status: "failed", error: error.message },
      );

      await redisClient
        .set(
          withdrawalCacheKey,
          JSON.stringify({ status: "failed", error: error.message }),
          "EX",
          3600,
        )
        .catch((err) => {
          console.warn(
            `Redis set error for ${withdrawalCacheKey}:`,
            err.message,
          );
        });

      res
        .status(500)
        .json(errorResponse(`Withdrawal transaction failed: ${error.message}`));
    } else {
      res
        .status(500)
        .json(errorResponse(`Error in approveWithdrawal: ${error.message}`));
    }
  } finally {
    session.endSession();
  }
};

// Payout Management
const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate("userId", "email")
      .sort({ createdAt: -1 });
    res
      .status(200)
      .json(successResponse("Withdrawals retrieved", { withdrawals }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Admin manage stake
const adminManageStake = async (req, res) => {
  try {
    const { userId, stakeId, action } = req.body; // action can be 'swap', 'reinvest', or 'transfer'
    if (!userId || !stakeId || !action) {
      return res
        .status(400)
        .json(errorResponse("Missing userId, stakeId, or action"));
    }

    const user = await User.findById(userId).populate(
      "package",
      "lockingPeriodDays",
    );
    if (!user) return res.status(404).json(errorResponse("User not found"));

    const stake = await Stake.findOne({ stakeId, userId: user._id });
    if (!stake) return res.status(404).json(errorResponse("Stake not found"));

    if (!user.package)
      return res.status(404).json(errorResponse("No active package found"));

    // Calculate locking period end based on stake creation and package locking period
    const lockingPeriodEnd = moment(stake.createdAt).add(
      user.package.lockingPeriodDays,
      "days",
    );
    const isLockingPeriodActive = moment().isBefore(lockingPeriodEnd);

    const amount = stake.amount;
    let updated = false;

    switch (action) {
      case "swap":
        if (isLockingPeriodActive && stake.isSwapped) {
          return res
            .status(400)
            .json(errorResponse("Swap action has already been performed"));
        }
        if (!isLockingPeriodActive && stake.isSwapped) {
          return res
            .status(400)
            .json(errorResponse("Swap action has already been performed"));
        }
        const swapFee = amount * config.SWAP_CHARGE;
        const tokenAmount = amount - swapFee;
        user.emgtWallet.amount = (user.emgtWallet.amount || 0) + tokenAmount;
        await Swap.create({
          userId: user._id,
          amount: tokenAmount,
          walletType: "emgt",
          currencyType: "EMGT",
          status: "completed",
          swapDetails: { originalAmount: amount, fee: swapFee, tokenAmount },
        });
        stake.isSwapped = true;
        updated = true;
        break;

      case "reinvest":
        if (isLockingPeriodActive) {
          return res
            .status(400)
            .json(
              errorResponse(
                "Reinvestment is not allowed during locking period",
              ),
            );
        }
        if (stake.isTransferredToPrincipalWallet) {
          return res
            .status(400)
            .json(
              errorResponse(
                "Cannot reinvest after transferring to principal wallet",
              ),
            );
        }
        const package = await Package.findOne({ investment: amount });
        if (!package)
          return res
            .status(400)
            .json(errorResponse("No matching package found for reinvestment"));

        // Create new stake for reinvestment
        const newStake = await Stake.create({
          userId: user._id,
          stakeId: `STK-${uuidv4().slice(0, 8)}`,
          amount,
          walletType: "deposit",
          currencyType: "USDT",
          status: "completed",
        });

        // Update lockUntil for the deposit wallet without deducting balance
        user.depositWallet.lockUntil = moment()
          .add(package.lockingPeriodDays, "days")
          .toDate();

        // Log reinvest transaction
        await ReinvestTransaction.create({
          userId: user._id,
          stakeId: stake.stakeId,
          amount,
          walletType: "deposit",
          lockingPeriodDays: package.lockingPeriodDays,
          newStakeId: newStake.stakeId,
        });

        user.totalSelfInvestment += amount;
        stake.isReinvested = true;
        updated = true;
        break;

      case "transfer":
        if (isLockingPeriodActive) {
          return res
            .status(400)
            .json(
              errorResponse("Transfer is not allowed during locking period"),
            );
        }
        if (stake.isTransferredToPrincipalWallet) {
          return res
            .status(400)
            .json(errorResponse("Transfer action has already been performed"));
        }
        if (stake.isSwapped) {
          return res
            .status(400)
            .json(errorResponse("Cannot transfer after swapping"));
        }
        user.principalWallet.amount =
          (user.principalWallet.amount || 0) + amount;
        await TransferTransaction.create({
          userId: user._id,
          stakeId: stake.stakeId,
          amount,
          walletType: "principal",
        });

        stake.isTransferredToPrincipalWallet = true;
        updated = true;
        break;

      default:
        return res.status(400).json(errorResponse("Invalid action"));
    }

    if (updated) {
      await stake.save();
      await user.save();
      res.status(200).json(
        successResponse(`${action} action completed`, {
          amount,
          stakeId: stake.stakeId,
        }),
      );
    }
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Admin get all stakes
const getAllInvestmentReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10, 
      user_id   // ← NEW: Search by user_id
    } = req.query;

    const matchQuery = {};

    // Date filter
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // User ID filter
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated investments
    let investments = await Investment.find(matchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 🔥 Add Sr. No. (serial number)
    investments = investments.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    const totalInvestments = await Investment.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalInvestments / limitNum);

    res.status(200).json(
      successResponse("All investments retrieved successfully", {
        totalInvestments,
        history: investments,
        currentPage: pageNum,
        totalPages,
        totalRecords: totalInvestments,   // for consistency with other endpoints
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get All Investment Report Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Income Management
const getDailyRoiHistory = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10, 
      user_id 
    } = req.query;

    const matchQuery = {};

    // Date filter
    if (startDate || endDate) {
      matchQuery.distributionDate = {};
      if (startDate) matchQuery.distributionDate.$gte = new Date(startDate);
      if (endDate) matchQuery.distributionDate.$lte = new Date(endDate);
    }

    // User ID filter
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated history
    let roiHistory = await RoiDistribution.find(matchQuery)
      .sort({ distributionDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 🔥 Add Serial Number (Sr. No.)
    roiHistory = roiHistory.map((item, index) => ({
      sr: skip + index + 1,   // Global serial number
      ...item
    }));

    // Total ROI for filtered records
    const totalRoiResult = await RoiDistribution.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRoi = totalRoiResult[0]?.total || 0;

    const totalRecords = await RoiDistribution.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("Daily ROI history retrieved", {
        totalRoi,
        history: roiHistory,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Daily ROI History Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getLevelIncomeHistory = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10, 
      user_id   // ← NEW: Search by user_id
    } = req.query;

    const matchQuery = {};

    // Date filter (createdAt)
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // 🔥 User ID filter
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated history
    let levelHistory = await LevelIncome.find(matchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("user_id") // Optional: keeps your original populate
      .lean();

    // 🔥 Add Sr. No. (Global serial number with pagination)
    levelHistory = levelHistory.map((item, index) => ({
      sr: skip + index + 1,
      ...item
    }));

    // Total Level Income for filtered records
    const totalLevelResult = await LevelIncome.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalLevelIncome = totalLevelResult[0]?.total || 0;

    const totalRecords = await LevelIncome.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("Level income history retrieved", {
        totalLevelIncome,
        history: levelHistory,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Level Income History Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getReferralIncomeReport = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, user_id } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();   // or userId if your schema uses ObjectId reference
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let referrals = await Referral.find(matchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "email user_id")
      .lean();

    // Add Sr. No.
    referrals = referrals.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    const totalReferralResult = await Referral.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalReferralIncome = totalReferralResult[0]?.total || 0;

    const totalRecords = await Referral.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("Referral income report retrieved", {
        totalReferralIncome,
        history: referrals,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Referral Income Report Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getBinaryIncomeReport = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, user_id } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.distributionDate = {};
      if (startDate) matchQuery.distributionDate.$gte = new Date(startDate);
      if (endDate) matchQuery.distributionDate.$lte = new Date(endDate);
    }
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let binaryHistory = await BinaryIncome.find(matchQuery)
      .sort({ distributionDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "email user_id")
      .lean();

    binaryHistory = binaryHistory.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    const totalBinaryResult = await BinaryIncome.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalBinaryIncome = totalBinaryResult[0]?.total || 0;

    const totalRecords = await BinaryIncome.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("Binary income report retrieved", {
        totalBinaryIncome,
        history: binaryHistory,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Binary Income Report Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getLeadershipShareReport = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, user_id } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.assignedAt = {};
      if (startDate) matchQuery.assignedAt.$gte = new Date(startDate);
      if (endDate) matchQuery.assignedAt.$lte = new Date(endDate);
    }
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let shareHistory = await LeadershipShare.find(matchQuery)
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "email user_id username first_name last_name")
      .lean();

    // Add Sr. No.
    shareHistory = shareHistory.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    // Total Shares
    const totalSharesResult = await LeadershipShare.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$shares" } } },
    ]);
    const totalShares = totalSharesResult[0]?.total || 0;

    const totalRecords = await LeadershipShare.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    // Keep your clean formatted response + sr
    const formattedHistory = shareHistory.map((item) => ({
      sr: item.sr,                    // ← Added
      _id: item._id,
      user_id: item.user_id,
      email: item.userId?.email || null,
      username: item.userId?.username || null,
      month: item.month,
      rankQualified: item.rankQualified,
      shares: item.shares,
      selfBusiness: item.selfBusiness || 0,
      directActive: item.directActive || 0,
      binaryVolume: item.binaryVolume || 0,
      leftPV: item.leftPV || 0,
      rightPV: item.rightPV || 0,
      assignedAt: item.assignedAt,
    }));

    res.status(200).json(
      successResponse("Leadership share report retrieved successfully", {
        totalShares,
        history: formattedHistory,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Leadership Share Report Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getLeadershipIncomeReport = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, user_id } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.month = {};
      if (startDate) matchQuery.month.$gte = new Date(startDate);
      if (endDate) matchQuery.month.$lte = new Date(endDate);
    }
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let leadershipHistory = await LeadershipBonus.find(matchQuery)
      .sort({ month: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "email user_id")
      .lean();

    leadershipHistory = leadershipHistory.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    const totalLeadershipResult = await LeadershipBonus.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$bonusAmount" } } },
    ]);
    const totalLeadershipIncome = totalLeadershipResult[0]?.total || 0;

    const totalRecords = await LeadershipBonus.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("Leadership income report retrieved", {
        totalLeadershipIncome,
        history: leadershipHistory,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Leadership Income Report Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getBonanzaRewardsReport = async (req, res) => {
  try {
    // Placeholder: Requires Bonanza model
    const rewards = [];
    res
      .status(200)
      .json(successResponse("Bonanza rewards report retrieved", { rewards }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// Swap Management
const getSwapReport = async (req, res) => {
  try {
    // Ensure admin access
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json(errorResponse("Unauthorized: Admin access required"));
    }

    const {
      userId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json(errorResponse("Invalid page number"));
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res
        .status(400)
        .json(errorResponse("Invalid limit, must be between 1 and 100"));
    }
    const skip = (pageNum - 1) * limitNum;

    // Build query object
    const query = {};
    if (userId) {
      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        return res.status(400).json(errorResponse("Invalid userId format"));
      }
      query.userId = userId;
    }
    if (status) {
      const validStatuses = ["pending", "completed", "rejected", "failed"];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json(errorResponse("Invalid status value"));
      }
      query.status = status.toLowerCase();
    }

    // Handle date range filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = moment(startDate)
          .tz("Asia/Kolkata")
          .startOf("day")
          .toDate();
      }
      if (endDate) {
        query.createdAt.$lte = moment(endDate)
          .tz("Asia/Kolkata")
          .endOf("day")
          .toDate();
      }
    }

    // Fetch swaps with population and sorting
    const swaps = await Swap.find(query)
      .populate("userId", "email") // Populate user email
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Count total documents for pagination
    const totalCount = await Swap.countDocuments(query);

    res.status(200).json(
      successResponse("Swaps retrieved successfully", {
        swaps,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum),
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching swaps:", error);
    res
      .status(500)
      .json(errorResponse("An error occurred while fetching swaps"));
  }
};

const getReinvestReport = async (req, res) => {
  try {
    // Ensure admin access
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json(errorResponse("Unauthorized: Admin access required"));
    }

    const {
      userId,
      status = "completed",
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Validate pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json(errorResponse("Invalid page number"));
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res
        .status(400)
        .json(errorResponse("Invalid limit, must be between 1 and 100"));
    }
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};
    if (userId) {
      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        return res.status(400).json(errorResponse("Invalid userId format"));
      }
      query.userId = userId;
    }
    if (status) {
      const validStatuses = ["pending", "completed", "failed"];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json(errorResponse("Invalid status value"));
      }
      query.status = status.toLowerCase();
    }

    // Date range filter
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) {
        query.transactionDate.$gte = moment(startDate)
          .tz("Asia/Kolkata")
          .startOf("day")
          .toDate();
      }
      if (endDate) {
        query.transactionDate.$lte = moment(endDate)
          .tz("Asia/Kolkata")
          .endOf("day")
          .toDate();
      }
    }

    // Fetch reinvestments
    const reinvestments = await ReinvestTransaction.find(query)
      .populate("userId", "email username")
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await ReinvestTransaction.countDocuments(query);

    // Format response
    const formatted = reinvestments.map((tx, index) => ({
      sr: skip + index + 1,
      _id: tx._id,
      user: {
        id: tx.userId?._id || tx.userId,
        email: tx.userId?.email || "N/A",
        username:
          tx.userId?.username || tx.userId?.email?.split("@")[0] || "Unknown",
      },
      oldStakeId: tx.stakeId,
      newStakeId: tx.newStakeId,
      amount: tx.amount,
      lockingPeriodDays: tx.lockingPeriodDays,
      transactionDate: moment(tx.transactionDate)
        .tz("Asia/Kolkata")
        .format("DD MMM YYYY, hh:mm A"),
      status: tx.status,
      remark: tx.remark,
    }));

    res.status(200).json(
      successResponse("Reinvestment report retrieved successfully", {
        reinvestments: formatted,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum),
        },
      }),
    );
  } catch (error) {
    console.error("Error in getReinvestReport:", error);
    res.status(500).json(errorResponse("Failed to fetch reinvestment report"));
  }
};

const getTransferReport = async (req, res) => {
  try {
    // Ensure admin access
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json(errorResponse("Unauthorized: Admin access required"));
    }

    const {
      userId,
      walletType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Validate pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json(errorResponse("Invalid page number"));
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res
        .status(400)
        .json(errorResponse("Invalid limit, must be between 1 and 100"));
    }
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};
    if (userId) {
      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        return res.status(400).json(errorResponse("Invalid userId format"));
      }
      query.userId = userId;
    }
    if (walletType) {
      const validTypes = ["principal", "my", "deposit", "referral", "emgt"];
      if (!validTypes.includes(walletType.toLowerCase())) {
        return res.status(400).json(errorResponse("Invalid walletType"));
      }
      query.toWallet = walletType.toLowerCase(); // assuming toWallet field
    }

    // Date filter
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) {
        query.transactionDate.$gte = moment(startDate)
          .tz("Asia/Kolkata")
          .startOf("day")
          .toDate();
      }
      if (endDate) {
        query.transactionDate.$lte = moment(endDate)
          .tz("Asia/Kolkata")
          .endOf("day")
          .toDate();
      }
    }

    // Fetch transfers
    const transfers = await TransferTransaction.find(query)
      .populate("userId", "email username")
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await TransferTransaction.countDocuments(query);

    const formatted = transfers.map((tx, index) => ({
      sr: skip + index + 1,
      _id: tx._id,
      user: {
        id: tx.userId?._id || tx.userId,
        email: tx.userId?.email || "N/A",
        username: tx.userId?.username || "Unknown",
      },
      stakeId: tx.stakeId,
      amount: tx.amount,
      fromWallet: tx.fromWallet || "deposit",
      toWallet: tx.toWallet || "principal",
      currencyType: tx.currencyType,
      transactionDate: moment(tx.transactionDate)
        .tz("Asia/Kolkata")
        .format("DD MMM YYYY, hh:mm A"),
      status: tx.status,
      remark: tx.remark,
    }));

    res.status(200).json(
      successResponse("Transfer report retrieved successfully", {
        transfers: formatted,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum),
        },
      }),
    );
  } catch (error) {
    console.error("Error in getTransferReport:", error);
    res.status(500).json(errorResponse("Failed to fetch transfer report"));
  }
};

// Platform Settings
const getTransactionHistoryAdmin = async (req, res) => {
  try {
    const deposits = await Deposit.find().populate("userId", "email");
    const withdrawals = await Withdrawal.find().populate("userId", "email");
    const swaps = await Swap.find().populate("userId", "email");
    const stakes = await Stake.find().populate("userId", "email");
    const transactions = [...deposits, ...withdrawals, ...swaps, ...stakes];
    res
      .status(200)
      .json(successResponse("Transaction history retrieved", { transactions }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const getAdminLoginLog = async (req, res) => {
  try {
    const adminId = req.user.id; // Assuming auth middleware sets req.user.id
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const loginLogs = await AdminLoginLog.find({ adminId })
      .select("ipAddress loginTime logoutTime")
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AdminLoginLog.countDocuments({ adminId });

    res.status(200).json(
      successResponse("Admin login logs retrieved successfully", {
        loginLogs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const getRankAchievementHistory = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10, 
      user_id   // ← NEW: Optional filter by user_id
    } = req.query;

    const matchQuery = {};

    // Date filter
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // User ID filter
    if (user_id) {
      matchQuery.user_id = user_id.toString().trim();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated data with selected fields
    let rankHistories = await RankUpdateHistory.find(matchQuery)
      .select("name user_id requiredDirects requiredPV dailyCap createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 🔥 Add Sr. No.
    rankHistories = rankHistories.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    const totalRecords = await RankUpdateHistory.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("Rank achievement history retrieved successfully", {
        history: rankHistories,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get Rank Achievement History Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const updateAdminEmailPassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    console.log("Request Body:", req.body); // Log incoming data for debugging

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json(errorResponse("Admin not found"));
    }
    console.log("Fetched Admin:", admin); // Log fetched admin for debugging

    // Update email if provided
    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json(errorResponse("Email cannot be empty"));
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json(errorResponse("Invalid email format"));
      }
      const existingAdmin = await Admin.findOne({
        email: email.toLowerCase(),
        _id: { $ne: admin._id },
      });
      if (existingAdmin) {
        return res.status(400).json(errorResponse("Email is already in use"));
      }
      admin.email = email.toLowerCase();
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

      console.log("Current Password Input:", currentPassword);
      console.log("Stored Password Hash:", admin.password);
      const isMatch = await admin.comparePassword(currentPassword);
      console.log("Password Match Result:", isMatch);
      if (!isMatch) {
        return res
          .status(401)
          .json(errorResponse("Current password is incorrect"));
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json(errorResponse("Password must be at least 6 characters long"));
      }

      // Set the new password (plain text) and let the pre-save middleware hash it
      admin.password = newPassword;
      passwordChanged = true;
    }

    // Check if any fields were updated
    if (email === undefined && !newPassword) {
      return res
        .status(400)
        .json(errorResponse("No valid fields provided for update"));
    }

    admin.updatedAt = new Date(); // Update timestamp
    await admin.save();
    console.log("Updated Admin:", admin); // Log updated admin for debugging

    // Invalidate old token and return new token if password changed
    let newToken = req.headers.authorization?.split(" ")[1]; // Existing token
    if (passwordChanged) {
      newToken = jwt.sign({ id: admin._id, role: "admin" }, config.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.setHeader("X-New-Token", newToken); // Send new token in header
    }

    res.status(200).json(
      successResponse("Admin profile updated successfully", {
        profile: {
          email: admin.email,
          walletAddress: admin.walletAddress,
          updatedAt: admin.updatedAt,
        },
        token: passwordChanged ? newToken : undefined,
      }),
    );
  } catch (error) {
    console.error("Error in updateAdminProfile:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Create Level Plan
const createLevelPlan = async (req, res) => {
  try {
    const { name, roi, strongLeg, weakLeg, target } = req.body;

    // Validate required fields
    if (
      !name ||
      roi === undefined ||
      strongLeg === undefined ||
      weakLeg === undefined ||
      target === undefined
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            "All fields (name, roi, strongLeg, weakLeg, target) are required",
          ),
        );
    }

    // Validate numeric fields
    if (isNaN(roi) || roi < 0 || roi > 100) {
      return res
        .status(400)
        .json(errorResponse("ROI must be a number between 0 and 100"));
    }
    if (isNaN(strongLeg) || strongLeg <= 0) {
      return res
        .status(400)
        .json(errorResponse("Strong leg must be a positive number"));
    }
    if (isNaN(weakLeg) || weakLeg <= 0) {
      return res
        .status(400)
        .json(errorResponse("Weak leg must be a positive number"));
    }
    if (isNaN(target) || target <= 0) {
      return res
        .status(400)
        .json(errorResponse("Target must be a positive number"));
    }

    const newLevelPlan = new LevelPlan({
      name,
      roi,
      strongLeg,
      weakLeg,
      target,
    });

    await newLevelPlan.save();
    res
      .status(201)
      .json(successResponse("Level plan created successfully", newLevelPlan));
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json(errorResponse("Level plan name must be unique"));
    }
    res.status(500).json(errorResponse(error.message));
  }
};

const getAllLevelPlans = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const levelPlans = await LevelPlan.find()
      .sort({ roi: 1 }) // Sort by roi (percentage) in ascending order (low to high)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await LevelPlan.countDocuments();

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
    res.status(500).json(errorResponse(error.message));
  }
};

// Update Level Plan
const updateLevelPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, roi, strongLeg, weakLeg, target } = req.body;

    if (
      !id ||
      !name ||
      roi === undefined ||
      strongLeg === undefined ||
      weakLeg === undefined ||
      target === undefined
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            "ID and all fields (name, roi, strongLeg, weakLeg, target) are required",
          ),
        );
    }

    // Validate numeric fields
    if (isNaN(roi) || roi < 0 || roi > 100) {
      return res
        .status(400)
        .json(errorResponse("ROI must be a number between 0 and 100"));
    }
    if (isNaN(strongLeg) || strongLeg <= 0) {
      return res
        .status(400)
        .json(errorResponse("Strong leg must be a positive number"));
    }
    if (isNaN(weakLeg) || weakLeg <= 0) {
      return res
        .status(400)
        .json(errorResponse("Weak leg must be a positive number"));
    }
    if (isNaN(target) || target <= 0) {
      return res
        .status(400)
        .json(errorResponse("Target must be a positive number"));
    }

    const updatedLevelPlan = await LevelPlan.findByIdAndUpdate(
      id,
      { name, roi, strongLeg, weakLeg, target },
      { new: true, runValidators: true },
    );

    if (!updatedLevelPlan) {
      return res.status(404).json(errorResponse("Level plan not found"));
    }

    res
      .status(200)
      .json(
        successResponse("Level plan updated successfully", updatedLevelPlan),
      );
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json(errorResponse("Level plan name must be unique"));
    }
    res.status(500).json(errorResponse(error.message));
  }
};

// Delete Level Plan
const deleteLevelPlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(errorResponse("ID is required"));
    }

    const levelPlan = await LevelPlan.findById(id);
    if (!levelPlan) {
      return res.status(404).json(errorResponse("Level plan not found"));
    }

    await LevelPlan.findByIdAndDelete(id);
    res
      .status(200)
      .json(successResponse("Level plan deleted successfully", { _id: id }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const getAllLevelIncomeRewards = async (req, res) => {
  try {
    // Extract query parameters
    const { startDate, endDate, userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query for Level rewards
    const query = {};
    if (userId) {
      query.userId = mongoose.Types.ObjectId(userId); // Validate userId as ObjectId
    }
    if (startDate || endDate) {
      query.distributionDate = {};
      if (startDate)
        query.distributionDate.$gte = moment(startDate).startOf("day").toDate();
      if (endDate)
        query.distributionDate.$lte = moment(endDate).endOf("day").toDate();
    }

    // Fetch all Level rewards with pagination
    const rewards = await LevelReward.find(query)
      .sort({ distributionDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch user details for all relevant users
    const userIds = [
      ...new Set(rewards.map((reward) => reward.userId.toString())),
    ];
    const users = await User.find({ _id: { $in: userIds } })
      .select("totalSelfInvestment referralCode email username")
      .lean();

    // Create user map for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = {
        userId: user._id.toString(),
        email: user.email || "N/A",
        referralCode: user.referralCode || "N/A",
        username: user.username || user.email.split("@")[0],
        totalSelfInvestment: user.totalSelfInvestment || 0,
      };
      return map;
    }, {});

    // Flatten rewards into a single array with user details
    const flattenedRewards = rewards.map((reward, index) => {
      const userId = reward.userId.toString();
      return {
        sr: skip + index + 1, // Global serial number based on pagination
        userId: userMap[userId]?.userId || userId,
        username: userMap[userId]?.username || "N/A",
        rank: reward.rank,
        rewardAmount: reward.rewardAmount,
        teamTotalRoiRewardDistributed: reward.teamTotalRoiRewardDistributed,
        totalTeamInvestment: reward.totalTeamInvestment,
        stronglegInvestment: reward.stronglegInvestment,
        weakestLegInvestment: reward.weakestLegInvestment,
        distributionDate: reward.distributionDate,
        status: reward.status,
      };
    });

    // Fetch associated LevelPlan details
    const levelPlans = await LevelPlan.find().lean();
    const levelPlanMap = levelPlans.reduce((map, plan) => {
      map[plan.name] = plan;
      return map;
    }, {});

    // Enhance records with LevelPlan details
    const enhancedRewards = flattenedRewards.map((record) => ({
      ...record,
      levelPlan: levelPlanMap[record.rank] || {
        name: "N/A",
        roi: 0,
        strongLeg: 0,
        weakLeg: 0,
        target: 0,
      },
    }));

    // Calculate total count for pagination
    const total = await LevelReward.countDocuments(query);

    res.status(200).json(
      successResponse("All level income rewards retrieved", {
        data: enhancedRewards,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching level income rewards:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const updateUserWalletAddress = async (req, res) => {
  try {
    // Ensure the requester is an admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Admin access required"));
    }

    const { userId, newWalletAddress, ticketId, notes } = req.body;
    if (!userId || !newWalletAddress || !ticketId) {
      return res
        .status(400)
        .json(
          errorResponse("userId, newWalletAddress, and ticketId are required"),
        );
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json(errorResponse("Invalid userId format"));
    }

    // Validate wallet address
    if (!ethers.utils.isAddress(newWalletAddress)) {
      return res
        .status(400)
        .json(errorResponse("Invalid wallet address format"));
    }

    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    let transactionCommitted = false;

    try {
      // Find the user
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json(errorResponse("User not found"));
      }

      // Check if new wallet address is same as current
      if (
        user.walletAddress &&
        user.walletAddress.toLowerCase() === newWalletAddress.toLowerCase()
      ) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json(
            errorResponse(
              "No change: This wallet address is already used by this user",
            ),
          );
      }

      // Validate ticketId exists
      const ticket = await SupportTicket.findOne({
        ticketId: ticketId,
      }).session(session);
      if (!ticket) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json(errorResponse("Ticket not found"));
      }

      // Store the old wallet address
      const oldWalletAddress = user.walletAddress || "N/A";

      // Update the user's wallet address
      user.walletAddress = newWalletAddress;
      await user.save({ session });

      // Log the wallet address update
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.ip ||
        "Unknown";
      const walletUpdateLog = new WalletUpdateLog({
        ticketId,
        adminId: req.user.id,
        userId: user._id,
        oldWalletAddress,
        newWalletAddress,
        notes: notes || "",
        ipAddress,
        updatedAt: new Date(),
      });
      await walletUpdateLog.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      transactionCommitted = true;

      // Send email notification (outside transaction to avoid affecting DB operations)
      const emailSubject = "Your Wallet Address Has Been Updated";
      const emailData = {
        ticketId: ticket._id,
        username: user.username,
        email: user.email,
        oldWalletAddress,
        newWalletAddress,
        timestamp: moment()
          .tz("Asia/Kolkata")
          .format("HH:mm:ss A, DD MMMM YYYY"),
      };

      try {
        await sendEmail(
          user.email,
          emailSubject,
          "walletUpdateEmail",
          emailData,
        );
      } catch (emailError) {
        console.warn("Failed to send wallet update email:", emailError.message);
        // Log the email failure but don't affect the response
      }

      // Update user cache
      const userCacheKey = `user:${user._id}`;
      await redisClient
        .set(userCacheKey, JSON.stringify(user), "EX", 3600)
        .catch((err) => {
          console.warn(`Redis set error for ${userCacheKey}:`, err.message);
        });

      // Log the action
      console.log(
        `Wallet address updated for user ${user._id} by admin ${req.user.id}: ` +
          `Old: ${oldWalletAddress}, New: ${newWalletAddress}`,
      );

      res.status(200).json(
        successResponse("User wallet address updated successfully", {
          userId: user._id,
          email: user.email,
          oldWalletAddress,
          newWalletAddress,
          ticketId,
        }),
      );
    } catch (error) {
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error in updateUserWalletAddress:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all wallet update logs
const getWalletUpdateLogs = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Admin access required"));
    }

    const walletUpdateLogs = await WalletUpdateLog.find()
      .populate("userId", "username email")
      .populate("adminId", "username")
      .lean()
      .sort({ updatedAt: -1 });

    res.status(200).json(
      successResponse("Wallet update logs retrieved successfully", {
        walletUpdateLogs,
      }),
    );
  } catch (error) {
    console.error("Error in getWalletUpdateLogs:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const adminLoginAsUser = async (req, res) => {
  try {
    // Ensure the requester is an admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Admin access required"));
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json(errorResponse("userId is required"));
    }

    // Find the user by userId or email
    const user = await User.findOne({
      $or: [{ user_id: userId }],
    }).select("_id user_id email role isEmailVerified");

    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    if (user.role === "admin") {
      return res
        .status(400)
        .json(errorResponse("Cannot impersonate an admin account"));
    }

    if (!user.isEmailVerified) {
      return res
        .status(403)
        .json(errorResponse("User's email is not verified"));
    }

    // Generate JWT token for direct impersonation without password/OTP
    const token = jwt.sign(
      { id: user._id, role: user.role, impersonatedBy: req.user.id },
      config.JWT_SECRET,
      { expiresIn: "1h" } // Short-lived token
    );

    // Log the admin's action in AdminLoginLog
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      "Unknown";
    await AdminLoginLog.create({
      adminId: req.user.id,
      ipAddress,
      loginTime: new Date(),
      action: "impersonate_user",
      details: {
        impersonatedUserId: user._id,
        impersonatedUserEmail: user.email,
      },
    });

    // Prepare response with dashboard URL for new tab
    const redirectUrl = `${process.env.FRONTEND_URL}/user/dashboard?token=${token}`;
    res.status(200).json(
      successResponse("Successfully prepared to login as user", {
        token,
        redirectUrl,
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
        },
      })
    );
  } catch (error) {
    console.error("Error in adminLoginAsUser:", error);
    res
      .status(500)
      .json(errorResponse(error.message || "Internal server error"));
  }
};

// Logout (Admin)
const adminLogout = async (req, res) => {
  try {
    res.status(200).json(successResponse("Logout successful"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  getAdminDashboard,
  getAllUsers,
  adminLoginAsUser,
  updateUserStatus,
  updateUserWalletAddress,
  getWalletUpdateLogs,
  depositToWallet,
  getAllDeposits,
  setTokenPrice,
  getAdminReport,
  createPackage,
  getAllPackages,
  updatePackage,
  deletePackage,
  createBonanzaPlan,
  getAllBonanzaPlans,
  updateBonanzaPlan,
  deleteBonanzaPlan,
  getStakingProfits,
  approveWithdrawal,
  getWithdrawals,

  adminManageStake,
  getAllInvestmentReport,
  getDailyRoiHistory,
  getReferralIncomeReport,
  getLevelIncomeHistory,
  getBinaryIncomeReport,
  getLeadershipShareReport,
  getLeadershipIncomeReport,
  getBonanzaRewardsReport,
  getSwapReport,
  getReinvestReport,
  getTransferReport,
  getTransactionHistoryAdmin,
  getAdminLoginLog,
  updateAdminEmailPassword,
  createLevelPlan,
  getAllLevelPlans,
  updateLevelPlan,
  deleteLevelPlan,
  getAllLevelIncomeRewards,
  getRankAchievementHistory,
  adminLogout,
};
