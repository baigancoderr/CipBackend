const User = require("../../models/User");
const Price = require("../../models/Price");
const Swap = require("../../models/Swap");          // ← New
const { successResponse, errorResponse } = require("../../utils/responses");
const mongoose = require("mongoose");

// ====================== SWAP WALLET TO DEPOSIT ======================
const swapToDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { walletType, amount } = req.body;
    const userId = req.user.id;

    if (!walletType || !["referral", "roi"].includes(walletType)) {
      return res.status(400).json(errorResponse("Invalid walletType. Allowed: referral or roi"));
    }
    if (!amount || amount <= 0) {
      return res.status(400).json(errorResponse("Amount must be greater than 0"));
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    user.wallets = user.wallets || {};
    user.wallets.deposit = user.wallets.deposit || { amount: 0 };
    user.wallets.referral = user.wallets.referral || { amount: 0 };
    user.wallets.roi = user.wallets.roi || { amount: 0 };

    let swappedAmountUSD = 0;
    let priceUsed = null;

    if (walletType === "referral") {
      if (user.wallets.referral.amount < amount) {
        return res.status(400).json(errorResponse("Insufficient balance in referral wallet"));
      }
      user.wallets.referral.amount = Number((user.wallets.referral.amount - amount).toFixed(2));
      swappedAmountUSD = Number(amount.toFixed(2));

    } else if (walletType === "roi") {
      if (user.wallets.roi.amount < amount) {
        return res.status(400).json(errorResponse("Insufficient balance in ROI wallet"));
      }

      const sgnPriceDoc = await Price.findOne({ currencyType: "SGN" }).session(session);
      if (!sgnPriceDoc || !sgnPriceDoc.price) {
        return res.status(500).json(errorResponse("SGN price not found"));
      }

      priceUsed = sgnPriceDoc.price;
      swappedAmountUSD = Number((amount * priceUsed).toFixed(2));

      user.wallets.roi.amount = Number((user.wallets.roi.amount - amount).toFixed(8));
    }

    // ====================== 2% FEE ======================

const feePercentage = 2;

const feeAmount = Number(
  ((swappedAmountUSD * feePercentage) / 100).toFixed(2)
);

const finalAmount = Number(
  (swappedAmountUSD - feeAmount).toFixed(2)
);

    // Add to deposit wallet
user.wallets.deposit.amount = Number(
  (user.wallets.deposit.amount + finalAmount).toFixed(2)
);
    // Save user
    await user.save({ session });

    // ====================== SAVE SWAP HISTORY ======================
    const swapId = `SWP${Date.now()}${Math.floor(Math.random() * 1000)}`;

   await Swap.create([{
  userId: user.userId || user._id,
  swapId,
  fromWallet: walletType,
  toWallet: "deposit",

  fromAmount: amount,

  // before fee
  toAmount: swappedAmountUSD,

  // fee details
  feePercentage,
  feeAmount,

  // after fee
  finalAmount,

  priceUsed,
  status: "completed",
}], { session });

    await session.commitTransaction();

    res.status(200).json(
      successResponse("Wallet swapped to deposit", {
        swapId,
        swappedFrom: walletType,
        fromAmount: amount,
       toAmount: swappedAmountUSD,
feePercentage,
feeAmount,
finalAmount,
        priceUsed,
        currentDepositBalance: user.wallets.deposit.amount,
      })
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Swap to deposit error:", error);
    res.status(500).json(errorResponse(error.message));
  } finally {
    session.endSession();
  }
};

// ====================== GET MY SWAP HISTORY (User Side) ======================
const getMySwapHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    const { page = 1, limit = 10, fromWallet, startDate, endDate } = req.query;

    const query = { userId: user.userId };

    if (fromWallet) query.fromWallet = fromWallet;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const swaps = await Swap.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await Swap.countDocuments(query);

    res.status(200).json(
      successResponse("My swap history retrieved successfully", {
        swaps,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / limit),
        },
      })
    );
  } catch (error) {
    console.error("Get my swap history error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ====================== GET ALL USERS SWAP HISTORY (Admin Side) ======================
const getAllSwapHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, fromWallet, startDate, endDate } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (fromWallet) query.fromWallet = fromWallet;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const swaps = await Swap.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await Swap.countDocuments(query);

    // ====================== TOTAL FEE COLLECTION ======================

const feeResult = await Swap.aggregate([
  {
    $match: query
  },
  {
    $group: {
      _id: null,
      totalFeeCollected: {
        $sum: "$feeAmount"
      }
    }
  }
]);

const totalFeeCollected =
  feeResult[0]?.totalFeeCollected || 0;

   res.status(200).json(
  successResponse("All users swap history retrieved successfully", {
    swaps,

    pagination: {
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    },

    // ======================
    // TOTAL FEE COLLECTED
    // ======================

    totalFeeCollected: Number(
      totalFeeCollected.toFixed(2)
    ),

  })
);
  } catch (error) {
    console.error("Get all swap history error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};




module.exports = {
  swapToDeposit,
  getMySwapHistory,     // ← For logged-in user
  getAllSwapHistory,    // ← For Admin
};