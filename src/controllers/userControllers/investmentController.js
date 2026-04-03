const Investment = require("../../models/Investment");
const Plan = require("../../models/Plan");
const User = require("../../models/User");
const { successResponse, errorResponse } = require("../../utils/responses");
const {
  distributeDirectReferral,
} = require("../../services/referralIncomeDistributionService");
const {
  distributeLevelIncome,
} = require("../../services/levelIncomeDistributionService");
const mongoose = require("mongoose");

// ====================== USER SIDE ======================
const investInPlan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, transactionHash, walletAddress } = req.body;
    const urId = req.user.id;

    // Validation
    if (!productId || !quantity || !transactionHash || !walletAddress) {
      return res.status(400).json(errorResponse("productId, quantity, transactionHash and walletAddress are required"));
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json(errorResponse("Quantity must be a positive integer"));
    }

    const plan = await Plan.findOne({ plan_id: productId }).session(session);
    if (!plan) {
      await session.abortTransaction();
      return res.status(404).json(errorResponse("Plan not found"));
    }

    if (plan.quantity < quantity) {
      await session.abortTransaction();
      return res.status(400).json(errorResponse(`Only ${plan.quantity} units available in this plan`));
    }

    // ✅ Amount automatically set according to quantity
    const amount = quantity * Number(plan.investment_amount);

    const user = await User.findById(urId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json(errorResponse("User not found"));
    }

    const investment = new Investment({
      userId: user._id,           // agar model mein hai
      user_id: user.user_id,
      productId,
      quantity,
      amount,                     // ← Auto calculated
      transactionHash,
      walletAddress,
      status: "PENDING",
    });

    await investment.save({ session });
    await session.commitTransaction();

    res.status(201).json(
      successResponse("Investment request submitted successfully. Waiting for admin approval.", {
        requestId: investment._id,
        productId,
        quantity,
        calculatedAmount: amount,   // frontend ko exact amount dikhaane ke liye
        status: "PENDING"
      })
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Investment request error:", error);
    res.status(500).json(errorResponse(error.message));
  } finally {
    session.endSession();
  }
};

// ====================== ADMIN SIDE ======================

// Get all pending requests
const getPendingInvestments = async (req, res) => {
  try {
    const pending = await Investment.find({ status: "PENDING" })
      .populate("user_id", "user_id name email")
      .sort({ createdAt: -1 });

    res.status(200).json(successResponse("Pending investments", pending));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

////////////////////

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

const getListedPlans = async (req, res) => {
  try {
    // Fetch all plans with quantity > 0 (assuming "listed" means available for investment)
    const listedPlans = await Plan.find({
      quantity: { $gt: 0 },
    }).lean();

    if (!listedPlans.length) {
      return res.status(404).json(errorResponse("No listed plans found"));
    }

    res
      .status(200)
      .json(
        successResponse(
          "Listed plans retrieved successfully",
          listedPlans,
        ),
      );
  } catch (error) {
    console.error("Error fetching listed plans:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  getPendingInvestments,
  investInPlan,
  getUserInvestments,
  getListedPlans,
};