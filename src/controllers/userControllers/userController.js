const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const Admin = require("../../models/Admin");
const Deposit = require("../../models/Deposit");
const Price = require("../../models/Price");
const Withdrawal = require("../../models/Withdrawal");
const RoiDistribution = require("../../models/RoiDistribution");
const Referral = require("../../models/Referral");
const KYC = require("../../models/KYC");
const crypto = require("crypto");
const { ethers, parseUnits } = require("ethers");
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

const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "userId name username referralCode walletBalance totalInvested totalEarnings referralEarnings dailyIncomeisActive wallets",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Ensure referralCode exists
    if (!user.referralCode) {
      user.referralCode = `CPR${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await user.save();
    }

    // ====================== LIVE SGN PRICE ======================
    const sgnPriceDoc = await Price.findOne({ currencyType: "SGN" });
    const sgnPrice = sgnPriceDoc?.price || 0.0;

    
    // ====================== ROI TOKENS → USD CONVERSION ======================
    // const roiTokens = user.wallets?.roi?.amount || 0;
    // const roiEarningsUsd = parseFloat((roiTokens * sgnPrice).toFixed(2));


    const roiTokens = user.wallets?.roi?.amount || 0; // CIP
const roiEarningsUsd = parseFloat((roiTokens * sgnPrice).toFixed(2)); // USD

    const referralEarningsUsd =
      user.wallets?.referral?.amount || user.referralEarnings || 0;

    // Total Earnings in USD (Correct Calculation)
    const totalEarningsUsd = parseFloat(
      (referralEarningsUsd + roiEarningsUsd).toFixed(2),
    );

    // ====================== USER COUNTS ======================
const totalUsers = await User.countDocuments({});
const activeUsers = await User.countDocuments({ isActive: true });

    // ====================== TOKEN SALE STATS ======================
    const saleStats = await Investment.aggregate([
      {
        $match: {
          status: "active",
        },
      },
      {
        $group: {
          _id: null,

      

          totalSoldTokens: {
            $sum: "$tokensReceived",
          },
        },
      },
    ]);

    // const totalSaleUsd = saleStats[0]?.totalSaleUsd || 0;
    const totalSoldTokens = saleStats[0]?.totalSoldTokens || 0;

    // ====================== RECENT 5 INVESTMENTS ======================
    const recentInvestments = await Investment.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "amount tokensReceived totalReturnTokens dailyIncomeTokens status createdAt",
      )
      .lean();

    // ====================== DIRECT REFERRALS ======================
    const directReferrals = await User.countDocuments({
      referredBy: user.referralCode,
      isActive: true,
    });

    // Referral Link
    const referralLink = `https://t.me/cipera_bot?startapp=${user.referralCode}`;

    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",

      user: {
        userId: user.userId,
        name: user.name || "User",
        username: user.username || "",
        isActive: user.isActive,
      },

      dashboard: {
        stats: [
          {
            title: "LIVE PRICE (CIP)",
            value: `$${sgnPrice.toFixed(4)}`,
          },
          {
            title: "TOTAL DEPOSIT",
            value: `$${(user.wallets?.deposit?.amount || user.totalInvested || 0).toFixed(2)}`,
          },
          {
            title: "WALLET BALANCE",
            value: `$${(user.walletBalance || 0).toFixed(2)}`,
          },
          {
            title: "TOTAL EARNINGS",
            value: `$${totalEarningsUsd.toFixed(2)}`, // ← Corrected
          },
          {
            title: "REFERRAL EARNINGS",
            value: `$${referralEarningsUsd.toFixed(2)}`,
          },
          {
            title: "ROI EARNINGS",
            value: `$${roiEarningsUsd.toFixed(2)}`, // ← Now in USD
          },
 {
            title: "ROI (CIP) EARNINGS",
            value: `${roiTokens.toFixed(2)}`, // ← Now in cIP
          },

          {
            title: "ACTIVE PACKAGE",
            value: user.activePackage || "None",
          },
          {
            title: "DIRECT TEAM",
            value: directReferrals.toString(),
          },
          {
  title: "TOTAL USERS",
  value: totalUsers.toString(),
},
{
  title: "ACTIVE USERS",
  value: activeUsers.toString(),
},
{
  title: "TOKENS SOLD",
  value: `${totalSoldTokens.toFixed(2)} CIP`,
},
// {
//   title: "BURNED TOKENS",
//   value: `${totalSaleUsd.toFixed(2)}`,
// },


        ],

        profitTracker: {
          totalInvested: user.totalInvested || 0,
          totalEarnings: totalEarningsUsd, // ← Corrected
          dailyIncome: user.dailyIncome || 0,
         roiBalance: roiTokens, // CIP token
roiBalanceUsd: roiEarningsUsd, // USD converted
          referralBalance: referralEarningsUsd,
        },

        teamStats: {
          totalReferrals: directReferrals,
          referralEarnings: referralEarningsUsd,
        },

        // 🔥 Latest 5 Investments
        recentInvestments: recentInvestments.map((inv) => ({
          amount: inv.amount,
          tokensReceived: inv.tokensReceived,
          totalReturnTokens: inv.totalReturnTokens,
          dailyIncomeTokens: inv.dailyIncomeTokens,
          status: inv.status,
          date: inv.createdAt,
        })),

        referralLink,
        tokenPrice: sgnPrice,
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
  const { walletType, amount, } = req.body;

  console.log(
    `Withdrawal OTP request: userId=${req.user.id}, walletType=${walletType}, amount=${amount}`,
  ); // Debug log

  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    //check user mail id exist or not
    if (!user.email) {
      throw new Error("Email not found. Please set your email before requesting withdrawal.");
    }

    const walletMap = {
      deposit: "deposit",
      referral: "referral",
      roi: "roi",
    };

    const walletKey = walletMap[walletType];
    if (!walletKey) throw new Error("Invalid wallet type");

    // Safe check for nested wallet
    const walletBalance = user.wallets?.[walletKey]?.amount || 0;

    if (walletBalance < amount) {
      throw new Error(`Insufficient funds in ${walletType} Wallet`);
    }

    const MIN_WITHDRAWAL_AMOUNT = config.MIN_WITHDRAWAL_AMOUNT || 1;
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new Error(
        `Withdrawal amount must be at least $${MIN_WITHDRAWAL_AMOUNT}`,
      );
    }

    const TRANSACTION_CHARGE = ["roi", "referral"].includes(walletType)
      ? config.TRANSACTION_CHARGE || 5
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

    const currencyType = walletType === "roi" ? "CIP" : "USDC";

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
    const { walletType, amount, otp } = req.body;
    const userId = req.user.id;

    console.log(
      `Withdrawal request: userId=${userId}, walletType=${walletType}, amount=${amount}}`,
    );

    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    // Validate OTP
    await verifyOTP(user.email, otp, "withdrawal");
    logger.info(`OTP verified for user ${userId} for withdrawal request.`);

    if (!user.walletAddress || user.walletAddress === "NA") {
      throw new Error("Set wallet address first");
    }

    if (!ethers.utils.isAddress(user.walletAddress)) {
      throw new Error("Invalid wallet address format. Please enter a valid Base wallet address");
    }
    
    if (!amount || amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    const MIN_WITHDRAWAL_AMOUNT = config.MIN_WITHDRAWAL_AMOUNT;
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new Error(`Withdrawal amount must be at least $${MIN_WITHDRAWAL_AMOUNT}`);
    }

    const walletMap = {
      deposit: "deposit",
      referral: "referral",
      roi: "roi",
    };

    const walletKey = walletMap[walletType];
    if (!walletKey) throw new Error("Invalid wallet type");

    // Safe nested wallet
    user.wallets = user.wallets || {};
    user.wallets[walletKey] = user.wallets[walletKey] || { amount: 0 };

    const wallet = user.wallets[walletKey];

    if (wallet.amount < amount) {
      throw new Error(`Insufficient funds in ${walletType} Wallet`);
    }

    // Transaction charge
    const TRANSACTION_CHARGE = ["roi", "referral"].includes(walletType)
      ? config.TRANSACTION_CHARGE || 5
      : 0;

    adminDeduction = Number(((amount * TRANSACTION_CHARGE) / 100).toFixed(4));
    const netAmount = Number((amount - adminDeduction).toFixed(2));

    if (netAmount <= 0) {
      throw new Error("Net withdrawal amount after charges must be greater than 0");
    }

    // Deduct amount
    wallet.amount = Number((wallet.amount - amount).toFixed(2));

    // Update admin fee
    if (adminDeduction > 0) {
      const adminCacheKey = `admin:admin123`;
      let admin = null;

      const cachedAdmin = await redisClient.get(adminCacheKey).catch(() => null);
      if (cachedAdmin) admin = JSON.parse(cachedAdmin);
      else {
        admin = await Admin.findOne({ referralCode: "admin123" }).session(session);
        if (admin) {
          await redisClient.set(adminCacheKey, JSON.stringify(admin), "EX", 3600).catch(() => {});
        }
      }

      if (admin) {
        admin.transactionFeeCollected = Number(
          ((admin.transactionFeeCollected || 0) + adminDeduction).toFixed(2)
        );
        await Admin.updateOne(
          { referralCode: "admin123" },
          { transactionFeeCollected: admin.transactionFeeCollected },
          { session }
        );
      }
    }

    const currencyType = walletType === "roi" ? "CIP" : "USDC";

    // Create withdrawal (single document - safer)
    withdrawal = await new Withdrawal({
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
    }).save({ session });

    // Save user wallet changes
    await user.save({ session });

    // ====================== AUTO WITHDRAWAL ======================
    const AUTO_WITHDRAWAL_LIMIT = config.AUTO_WITHDRAWAL_LIMIT || 500;
    if (netAmount <= AUTO_WITHDRAWAL_LIMIT) {
      if (!config.ENCRYPTION_KEY || !config.ENCRYPTED_PRIVATE_KEY) {
        throw new Error("Encryption keys not configured");
      }

      const privateKey = decryptPrivateKey(config.ENCRYPTED_PRIVATE_KEY, config.ENCRYPTION_KEY);

      const provider = new ethers.providers.JsonRpcProvider(config.BSC_RPC_URL);
      const walletSigner = new ethers.Wallet(privateKey, provider);

      const contract = new ethers.Contract(
        config.WITHDRAW_CONTRACT_ADDRESS,
        config.WITHDRAW_CONTRACT_ABI,
        walletSigner
      );

      // ================== DYNAMIC TOKEN CONFIG ==================
      let tokenAddress, tokenABI, decimals;

      if (walletType === "roi") {
        tokenAddress = config.CIP_CONTRACT_ADDRESS;
        tokenABI = config.CIP_CONTRACT_ABI;
        decimals = 18; // CIP token decimals
      } else if (currencyType === "USDC") {
        tokenAddress = config.USDT_CONTRACT_ADDRESS; // or USDC_CONTRACT_ADDRESS
        tokenABI = config.USDT_CONTRACT_ABI;
        decimals = 6; // USDC on Base/Sepolia
      } else {
        throw new Error(`Unsupported currencyType: ${currencyType}`);
      }

      // ←←← THIS WAS THE SOURCE OF THE ERROR
      if (!tokenAddress || !tokenABI) {
        throw new Error(`Missing config for ${currencyType} (CIP/USDC contract address or ABI)`);
      }

      const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);

      const contractBalance = await tokenContract.balanceOf(config.WITHDRAW_CONTRACT_ADDRESS);
      const amountWei = ethers.utils.parseUnits(netAmount.toString(), decimals);

      if (contractBalance.lt(amountWei)) {
        throw new Error(
          `Contract has insufficient ${currencyType} balance. Available: ${ethers.utils.formatUnits(
            contractBalance,
            decimals
          )} ${currencyType}, Required: ${netAmount}`
        );
      }

      // Call correct function
      let tx;
      if (walletType === "roi") {
        tx = await contract.userWithdrawCIP(user.walletAddress, amountWei);
      } else if (currencyType === "USDC") {
        tx = await contract.userWithdrawUSDC(user.walletAddress, amountWei);
      }

      await tx.wait();

      // Mark as completed
      await Withdrawal.updateOne(
        { _id: withdrawal._id },
        { status: "completed", transactionHash: tx.hash },
        { session }
      );

      await session.commitTransaction();

      res.status(200).json(
        successResponse("Withdrawal completed", {
          withdrawalId: withdrawal._id,
          requestedAmount: amount,
          netAmount,
          transactionCharge: adminDeduction,
          currencyType,
          walletType,
          status: "completed",
          walletAddress: user.walletAddress,
          txHash: tx.hash,
        })
      );

      console.log(`✅ Auto ${currencyType} withdrawal completed for user ${user._id}, tx: ${tx.hash}`);
    } else {
      await session.commitTransaction();

      res.status(200).json(
        successResponse("Withdrawal request submitted and pending admin approval", {
          withdrawalId: withdrawal._id,
          requestedAmount: amount,
          netAmount,
          transactionCharge: adminDeduction,
          currencyType,
          walletType,
          status: "pending",
          walletAddress: user.walletAddress,
        })
      );

      console.log(`📌 ${currencyType} withdrawal request pending for user ${user._id}`);
    }
  } catch (error) {
    await session.abortTransaction();

    logger.error(
      `Error in withdraw for user ${req.user.id} from ${req.body.walletType} wallet:`,
      error.message,
      error.stack
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
      "userId referralCode totalInvested",
    );

    if (!authUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const targetUserId = userId || authUser.userId;

    // 🔍 Target user
    const targetUser = await User.findOne({ userId: targetUserId }).lean();

    if (!targetUser) {
      return res.status(404).json({
        status: "error",
        message: "Target user not found",
      });
    }

    // 🔁 Recursive Tree Builder (Optimized)
    const buildTree = async (parentUserId, level = 1) => {
      const children = await User.find({ referredBy: parentUserId })
        .lean()
        .select("userId username name email totalInvested referralCode");

      if (!children.length) return [];

      const result = await Promise.all(
        children.map(async (child) => {
          const subChildren = await buildTree(child.referralCode, level + 1);

          // 🔥 Calculate team investment
          const teamInvestment = subChildren.reduce(
            (sum, c) => sum + (c.selfInvestment + c.teamInvestment),
            0,
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
            level,
            children: subChildren,
          };
        }),
      );

      return result;
    };

    // 🌳 Build tree
    let treeChildren = await buildTree(targetUser.referralCode);

    // 🔍 Search filter (optional)
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

    // 🔥 Calculate total team investment
    const totalTeamInvestment = treeChildren.reduce(
      (sum, node) => sum + node.selfInvestment + node.teamInvestment,
      0,
    );

    return res.status(200).json({
      status: "success",
      message: "Team tree fetched successfully",
      data: {
        selfInvestment: targetUser.totalInvested || 0,
        teamInvestment: totalTeamInvestment,
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

const getDirectTeam = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // 🔍 Logged-in user
    const user = await User.findById(req.user.id).select(
      "referralCode totalInvested",
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

const getIndirectTeam = async (req, res) => {
  try {
    const { page = 1, limit = 10, level } = req.query;

    // 🔍 Logged-in user
    const user = await User.findById(req.user.id).select(
      "referralCode totalInvested",
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
      directReferrals.map((u) => u.referralCode),
    );

    // 🎯 Filter by level (optional)
    if (level) {
      const lvl = parseInt(level);
      allIndirectUsers = allIndirectUsers.filter((u) => u.level === lvl);
    }

    // 📊 Sort latest first
    allIndirectUsers.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
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
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Build query for ROI distributions
    const query = { userId: user._id }; // ← New schema mein userId (ObjectId) use kar rahe hain

    if (startDate || endDate) {
      query.distributionDate = {};
      if (startDate) {
        query.distributionDate.$gte = moment(startDate).startOf("day").toDate();
      }
      if (endDate) {
        query.distributionDate.$lte = moment(endDate).endOf("day").toDate();
      }
    }

    // Total count for pagination
    const total = await RoiDistribution.countDocuments(query);

    // Fetch distributions
    const distributions = await RoiDistribution.find(query)
      .sort({ distributionDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Format data according to new schema
    const formattedData = distributions.map((dist, index) => ({
      sr: (page - 1) * limit + index + 1,
      investmentId: dist.investmentId,
      amount: dist.amount, // daily ROI tokens
      totalTokens: dist.totalTokens, // total tokens from this investment
      dailyROI: dist.dailyROI, // daily ROI percentage
      stakeAmount: dist.stakeAmount,
      distributionDate: dist.distributionDate,
    }));

    // Calculate total team investment (old logic rakha hai)
    const teamInvestment = await calculateDownlineInvestment(user.referralCode);

    res.status(200).json(
      successResponse("Daily ROI data retrieved successfully", {
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
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Build query
    const query = { userId: user._id };

    if (status) {
      query.status = status;
    } else {
      query.status = "completed";
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = moment(startDate).startOf("day").toDate();
      }
      if (endDate) {
        query.createdAt.$lte = moment(endDate).endOf("day").toDate();
      }
    }

    console.log("🔍 Referral Query:", JSON.stringify(query)); // ← Debugging

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch data
    const referrals = await Referral.find(query) // ← Changed to Referral
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Total income
    const totalReferralIncome = await Referral.aggregate([
      // ← Changed to Referral
      { $match: query },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((res) => res[0]?.total || 0);

    // Total records
    const totalRecords = await Referral.countDocuments(query); // ← Changed to Referral

    console.log(
      `📊 Found ${totalRecords} referral records for user ${user.userId}`,
    );

    const formattedReferrals = referrals.map((ref, index) => ({
      sr: skip + index + 1,
      level: ref.level,
      referredId: ref.referredId,
      investmentAmount: ref.investmentAmount,
      commissionAmount: ref.amount,
      status: ref.status,
      investmentId: ref.investmentId,
      date: ref.createdAt,
    }));

    res.status(200).json(
      successResponse("Referral income retrieved successfully", {
        selfInvestment: user.totalSelfInvestment || 0,
        teamInvestment: await calculateDownlineInvestment(
          user.referralCode,
        ).catch(() => 0),
        referralCount: totalRecords,
        totalReferralIncome: parseFloat(totalReferralIncome.toFixed(2)),
        referrals: formattedReferrals,
        pagination: {
          total: totalRecords,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalRecords / Number(limit)),
        },
      }),
    );
  } catch (error) {
    console.error("❌ Error fetching referral income:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // token se aa raha hai

    const user = await User.findById(userId);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
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

const NETWORK_CONFIG = {
  WEB20_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/erc20/usdt/create/",
  },

  BASE_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/base/usdt/create/",
  },

  BASE_USDC: {
    coin: "USDC",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/base/usdc/create/",
  },

  POLYGON_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/polygon/usdt/create/",
  },
  BEP20_USDT: {
    coin: "USDT",
    wallet: process.env.EVM_WALLET,
    url: "https://api.cryptapi.io/bep20/usdt/create/",
  },
};

const createDeposit = async (req, res) => {
  try {
    const { userId, amount, network } = req.body;

    // 🔐 Validation
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId required" });
    }

    if (!amount || Number(amount) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid amount required" });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const config = NETWORK_CONFIG[network];
    if (!config || !config.wallet) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid network" });
    }

    console.log(`🚀 Creating deposit for ${userId}`);
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000);

    // 🧾 Step 1: Create deposit
 const deposit = await Deposit.create({
  userId: user._id,
  amount: Number(amount),
  currency: config.coin,
  network,
  status: "initiated",
  expiresAt: expiryTime,
});

    // 🔔 Callback URL (IMPORTANT)
    const callbackUrl = `${process.env.BASE_URL}/user/deposit/callback?secret=${process.env.CRYPTAPI_SECRET}&order_id=${deposit._id}`;

    // 🌍 CryptAPI call
    const response = await axios.get(config.url, {
      params: {
        address: config.wallet,
        callback: callbackUrl,
        order_id: deposit._id.toString(),
        multi_token: 1,
        json: 1,
      },
    });

    const data = response.data;

    console.log("🌍 CryptAPI Response:", data);

    if (data?.status === "error" || !data?.address_in) {
      await Deposit.findByIdAndDelete(deposit._id);
      return res.status(400).json({
        success: false,
        message: data?.message || "CryptAPI error",
      });
    }

    // 🧾 Update deposit
    deposit.depositAddress = data.address_in;
    deposit.callbackUrl = callbackUrl;
    deposit.uuid = data.uuid || null; // save uuid if exists
    deposit.status = "pending";

    await deposit.save();

    console.log("✅ Deposit Created:", {
      depositId: deposit._id,
      uuid: deposit.uuid,
    });

  return res.json({
  success: true,
  depositId: deposit._id,
  deposit: {
    address: data.address_in,
    coin: config.coin,
    network,
    amount: Number(amount),
    expiresAt: deposit.expiresAt,
  },
});



  } catch (err) {
    console.error("❌ Deposit Error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ?callBack

const depositCallback = async (req, res) => {
  try {
    console.log("🔔 Callback Hit");

    const data = {
      ...req.query,
      ...req.body,
    };

    console.log("📦 FULL DATA:", data);

    const {
      uuid,
      order_id,
      value,
      value_coin,
      txid,
      txid_in,
      confirmations,
      secret,
    } = data;

    const finalTxid = txid_in || txid;
    const finalAmount = parseFloat(value_coin || value);

    // 🔐 Secret check
    if (secret !== process.env.CRYPTAPI_SECRET) {
      return res.send("Invalid secret");
    }

    let deposit = null;

    // ✅ 1. Try UUID
    if (uuid) {
      deposit = await Deposit.findOne({ uuid });
    }

    // ✅ 2. Fallback order_id
    if (!deposit && order_id && mongoose.Types.ObjectId.isValid(order_id)) {
      deposit = await Deposit.findById(order_id);
      if (deposit) {
        console.log("🔁 Fallback used: order_id");
      }
    }

    if (!deposit) {
      console.log("❌ Deposit not found:", { uuid, order_id });
      return res.send("Deposit not found");
    }

    // ⏰ Auto mark expired after 30 min

const isLatePayment =
  deposit.expiresAt &&
  new Date() > deposit.expiresAt;

if (isLatePayment) {
  console.log("⚠️ Late payment received");
}

    console.log("✅ MATCHED DEPOSIT:", {
      uuid: deposit.uuid,
      order_id: deposit._id,
    });

    // ✅ Already completed
   if (
  deposit.status === "completed" ||
  deposit.status === "late_completed"
) {
  return res.send("Already processed");
}
    // 💰 Amount check
    if (isNaN(finalAmount) || finalAmount <= 0) {
      return res.send("Invalid amount");
    }

    // ⛓️ Confirmations
    if (!confirmations || Number(confirmations) < 2) {
      return res.send("Waiting confirmations");
    }

    // ❗ TXID check
    if (!finalTxid) {
      return res.send("Waiting TXID");
    }

    // 🔁 Duplicate TX check
    const existingTx = await Deposit.findOne({
      transactionHash: finalTxid,
    });

    if (existingTx) {
      return res.send("Duplicate TX");
    }

    // 🔒 ATOMIC LOCK (IMPORTANT)
  const lockedDeposit = await Deposit.findOneAndUpdate(
  {
    _id: deposit._id,
    status: {
      $nin: ["completed", "late_completed"],
    },
  },
  { status: "processing" },
  { new: true },
);

    if (!lockedDeposit) {
      return res.send("Already processed");
    }

    // 👤 User
    const user = await User.findById(deposit.userId);
    if (!user) {
      deposit.status = "failed";
      await deposit.save();
      return res.send("User not found");
    }

    // 💸 Credit wallet
    if (!user.wallets) user.wallets = {};
    if (!user.wallets.deposit) user.wallets.deposit = { amount: 0 };

    user.wallets.deposit.amount += finalAmount;
    await user.save();

    // 🧾 Final update
    deposit.status = isLatePayment
  ? "late_completed"
  : "completed";
    deposit.transactionHash = finalTxid;
    deposit.creditedAmount = finalAmount;
    deposit.confirmations = Number(confirmations);
    deposit.completedAt = new Date();

    await deposit.save();

    console.log("✅ Deposit SUCCESS:", {
      userId: user._id,
      credited: finalAmount,
      txid: finalTxid,
    });

    return res.send("OK");
  } catch (error) {
    console.error("❌ Callback Error:", error.message);
    return res.send("Error handled");
  }
};

const getDeposits = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    let { page = 1, startDate, endDate } = req.query;

    page = parseInt(page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // 🔍 Build filter
    const filter = {
      userId: userId,
    };

    // 📅 Date filter (optional)
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // 📊 Total count
    const total = await Deposit.countDocuments(filter);

    // 📦 Fetch deposits
    const deposits = await Deposit.find(filter)
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
      deposits,
    });
  } catch (error) {
    console.error("❌ Get Deposits Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const logCallback = async ({
  req,
  data,
  status = "pending",
  message = "",
  network = "",
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
      headers: req?.headers,
    });
  } catch (err) {
    console.error("❌ Log save failed:", err.message);
  }
};

// Update Walter if already Connected
const updateWallet = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    // ✅ JWT se user identify
    const userId = req.user.id || req.user._id;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address required",
      });
    }

    // ✅ isActive bhi check (tera middleware match kare)
    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true },
      { walletAddress },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    res.status(200).json({
      success: true,
      message: "Wallet updated successfully",
      user,
    });
  } catch (error) {
    console.error("Wallet update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ADD Wallet If user is coming First Time
const addWalletFirstTime = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const userId = req.user.id || req.user._id;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address required",
      });
    }

    // ✅ user find karo
    const user = await User.findOne({ _id: userId, isActive: true });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ❌ Agar already wallet hai
    if (user.walletAddress && user.walletAddress !== "") {
      return res.status(400).json({
        success: false,
        message: "Wallet already added, use update API",
      });
    }

    // ✅ First time save
    user.walletAddress = walletAddress;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Wallet added successfully",
      user,
    });
  } catch (error) {
    console.error("Add wallet error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id || req.user._id;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    // ✅ Check if email already used by another user
const existingUser = await User.findOne({
  email: email.toLowerCase(),
  _id: { $ne: userId },
});    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered with another account",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true },
      { email: email.toLowerCase() },
      { new: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or inactive" });
    }

    res.status(200).json({
      success: true,
      message: "Email updated successfully",
      user,
    });
  } catch (error) {
    console.error("Email update error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const addEmailFirstTime = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id || req.user._id;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    // ✅ Check if email already used by any user
const existingUser = await User.findOne({
  email: email.toLowerCase(),
  _id: { $ne: userId },
});
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered with another account",
      });
    }

    const user = await User.findOne({ _id: userId, isActive: true });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.email && user.email !== "") {
      return res.status(400).json({
        success: false,
        message: "Email already added, use update instead",
      });
    }

    user.email = email.toLowerCase();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email added successfully",
      user,
    });
  } catch (error) {
    console.error("Add email error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  requestWithdrawalOtp,
  withdraw,
  getWithdrawalHistory,
  getDashboard,
  getWalletDetails,
  getDailyROI,
  getReferralIncome,
  getUserProfile,
  updateUserProfilePassword,
  getReport,
  getTeamTreeView,

  getReferralData,
  getTeamTreeView,
  getLevelWiseIncome,

  getDirectTeam,
  getIndirectTeam,

  sendSupportEmail,
  contactFormEmail,
  logout,
  CreateInvestment,
  createDeposit,
  depositCallback,
  updateWallet,
  addWalletFirstTime,
  getDeposits,
  addEmailFirstTime,
  updateEmail,
  decryptPrivateKey,
};
