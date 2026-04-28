const Investment = require("../../models/Investment");
const User = require("../../models/User");
const Price = require("../../models/Price");
const { successResponse, errorResponse } = require("../../utils/responses");
const {
  distributeReferralIncome,
} = require("../../services/referralIncomeDistributionService");
const mongoose = require("mongoose");

// ====================== USER SIDE ======================
const investInPlan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { telegramId, amount } = req.body;
    const urId = req.user.id;

    // Validation
    if (!telegramId || !amount) {
      return res
        .status(400)
        .json(errorResponse("telegramId and amount are required"));
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

    // 📊 Get current SGN price
    const sgnPriceDoc = await Price.findOne({ currencyType: "SGN" });
    if (!sgnPriceDoc) {
      return res.status(500).json(errorResponse("SGN price not found"));
    }

    const sgnPrice = sgnPriceDoc.price;
    const tokensReceived = parseFloat((amount / sgnPrice).toFixed(8));

    const totalReturn = tokensReceived * 1.1;
    const totalReturnTokens = parseFloat((tokensReceived * 1.1).toFixed(8));

    const dailyIncome = totalReturn / 700;
    const dailyIncomeTokens = totalReturnTokens / 700;

    const totalDays = 700;

    // 📅 End Date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + totalDays);

    const purchaseId = `INV${Date.now()}`;

    // 🆕 Generate unique investment ID
    const investmentId = `INV${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // 🆕 Save investment
    const investment = await Investment.create({
      userId: user.userId,
      investmentId,
      amount,
      tokensReceived,
      sgnPriceAtInvestment: sgnPrice,
      totalReturn,
      dailyIncome,
      totalReturnTokens,
      dailyIncomeTokens,
      totalDays,
      endDate,
      status: "active",
    });

    await distributeReferralIncome(
      user.userId, 
      amount, 
      "SGN_DIRECT_INVEST",           // productId placeholder (for logging)
      { session }
    );

    await session.commitTransaction();

    res.status(201).json(
      successResponse(
        "Investment successfully",
        {
          investmentId: investment._id,
          amount: investment.amount,
          totalReturn: investment.totalReturn,
        },
      ),
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Investment request error:", error);
    res.status(500).json(errorResponse(error.message));
  } finally {
    session.endSession();
  }
};

const getUserInvestments = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("userId");
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    const query = { userId: user.userId };

    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // 1. Paginated investments
    const investments = await Investment.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // 2. Totals using aggregation (efficient)
    const totals = await Investment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalInvestedAmount: { $sum: "$amount" },
          totalReturnTokens: { $sum: "$totalReturnTokens" },
          totalClaimedTokens: {
            $sum: {
              $multiply: ["$claimedDays", "$dailyIncomeTokens"]
            }
          }
        }
      }
    ]);

    const summary = totals[0] || {
      totalInvestedAmount: 0,
      totalReturnTokens: 0,
      totalClaimedTokens: 0,
    };

    const totalCount = await Investment.countDocuments(query);

    res.status(200).json(
      successResponse("User investments retrieved successfully", {
        investments,
        summary: {
          totalInvestedAmount: parseFloat(summary.totalInvestedAmount.toFixed(2)),
          totalReturnTokens: parseFloat(summary.totalReturnTokens.toFixed(8)),
          totalClaimedTokens: parseFloat(summary.totalClaimedTokens.toFixed(8)),
        },
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / limit),
        },
      })
    );
  } catch (error) {
    console.error("Get user investments error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  investInPlan,
  getUserInvestments,
};
