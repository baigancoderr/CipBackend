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

    // 🆕 Save investment
    const investment = await Investment.create({
      userId: user.userId,
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
        "Investment request submitted successfully",
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
    // First, verify the user by finding their record using the authenticated user's ID (_id)
    const user = await User.findById(req.user.id).select("user_id");
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    console.log(`Fetching investments for user ID: ${user.user_id}`);

    // Extract query parameters for pagination and filtering
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // Build the query object
    const query = { user_id: user.user_id };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get total count for pagination
    const total = await Investment.countDocuments(query);

    // Fetch paginated investments
    const investments = await Investment.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json(
      successResponse("User investments retrieved", {
        investments,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      }),
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  investInPlan,
  getUserInvestments,
};
