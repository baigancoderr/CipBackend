// controllers/planController.js
const User = require('../../models/User');
const Plan = require('../../models/Plan');
const Investment = require('../../models/Investment');
const mongoose = require("mongoose");
const { successResponse, errorResponse } = require('../../utils/responses');
const {
  distributeDirectReferral,
} = require("../../services/referralIncomeDistributionService");
const {
  distributeLevelIncome,
} = require("../../services/levelIncomeDistributionService");
const redisClient = require("../../config/redisClient");

// ==================== Generate Unique Plan ID ====================
const generateUniquePlanId = async () => {
  let planId;
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    planId = `SGNPlan${String(counter).padStart(5, "0")}`;

    // Check Redis cache
    const cached = await redisClient.get(`planId:${planId}`);
    if (cached) {
      counter++;
      continue;
    }

    // Check database
    const exists = await Plan.findOne({ plan_id: planId });
    if (!exists) {
      await redisClient.set(`planId:${planId}`, "taken", { EX: 3600 });
      isUnique = true;
    } else {
      counter++;
    }

    if (counter > 99999) {
      throw new Error("Unable to generate unique plan ID after max attempts");
    }
  }
  return planId;
};

// ==================== Register Plan ====================
const registerPlan = async (req, res) => {
  try {
    let planData = { ...req.body };

    // Remove unwanted fields
    delete planData._id;

    // ==================== SANITIZE BASIC DATA ====================
    const sanitized = {
      plan_name: planData.plan_name,
      slug: planData.slug,
      image: planData.image,
      investment_amount: planData.investment_amount || 0,
      quantity: planData.quantity || 0,
      details: planData.details,
      total_buyer: planData.total_buyer || 0,
      total_investment: planData.total_investment || 0,
      freeTokenValue: Number(planData.freeTokenValue) || 0,
      created_by: req.user.id,
    };

    // ==================== REFERRAL INCOME (Max 7 Levels) ====================
    sanitized.referralIncome = [];
    if (planData.referralIncome && Array.isArray(planData.referralIncome)) {
      const refLevels = [];

      for (const lvl of planData.referralIncome) {
        if (
          typeof lvl.level === 'number' &&
          lvl.level >= 1 && lvl.level <= 7 &&
          ['fixed', 'percentage'].includes(lvl.commissionType) &&
          typeof lvl.value === 'number' && lvl.value >= 0
        ) {
          if (lvl.commissionType === 'percentage' && lvl.value > 100) {
            throw new Error(`Referral Level ${lvl.level} percentage cannot exceed 100`);
          }
          refLevels.push({
            level: lvl.level,
            commissionType: lvl.commissionType,
            value: lvl.value
          });
        }
      }

      // Duplicate level check
      const levelNums = refLevels.map(l => l.level);
      if (new Set(levelNums).size !== levelNums.length) {
        throw new Error('Duplicate levels not allowed in Referral Income');
      }

      refLevels.sort((a, b) => a.level - b.level);
      sanitized.referralIncome = refLevels;
    }

    // ==================== LEVEL INCOME (Max 25 Levels + minDirects) ====================
    sanitized.levelIncome = [];
    if (planData.levelIncome && Array.isArray(planData.levelIncome)) {
      const levLevels = [];

      for (const lvl of planData.levelIncome) {
        if (
          typeof lvl.level === 'number' &&
          lvl.level >= 1 && lvl.level <= 25 &&
          ['fixed', 'percentage'].includes(lvl.commissionType) &&
          typeof lvl.value === 'number' && lvl.value >= 0 &&
          // ✅ NEW: minDirects support
          (typeof lvl.minDirects === 'number' || typeof lvl.minDirects === 'undefined') &&
          (lvl.minDirects === undefined || lvl.minDirects >= 0)
        ) {
          if (lvl.commissionType === 'percentage' && lvl.value > 100) {
            throw new Error(`Level Income Level ${lvl.level} percentage cannot exceed 100`);
          }

          levLevels.push({
            level: lvl.level,
            commissionType: lvl.commissionType,
            value: lvl.value,
            minDirects: typeof lvl.minDirects === 'number' ? lvl.minDirects : 0   // default to 0 if not sent
          });
        }
      }

      // Duplicate level check
      const levelNums = levLevels.map(l => l.level);
      if (new Set(levelNums).size !== levelNums.length) {
        throw new Error('Duplicate levels not allowed in Level Income');
      }

      levLevels.sort((a, b) => a.level - b.level);
      sanitized.levelIncome = levLevels;
    }

    // Auto-generate plan_id and slug
    sanitized.plan_id = await generateUniquePlanId();

    if (!sanitized.slug && sanitized.plan_name) {
      sanitized.slug = sanitized.plan_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const plan = new Plan(sanitized);
    await plan.save();

    res.status(201).json(successResponse('Plan registered successfully with Referral & Level Income', plan));
  } catch (error) {
    console.error("Register Plan Error:", error);
    res.status(500).json(errorResponse(error.message || "Failed to register plan"));
  }
};

// ==================== Get All Plans ====================
const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find().lean();
    res.status(200).json(successResponse('All plans retrieved successfully', plans));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Get Plan by Plan ID ====================
const getPlanById = async (req, res) => {
  try {
    const { planId } = req.params; // Custom plan_id

    const plan = await Plan.findOne({ plan_id: planId }).lean();
    if (!plan) {
      return res.status(404).json(errorResponse('Plan not found'));
    }

    res.status(200).json(successResponse('Plan retrieved successfully', plan));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Update Plan ====================
const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params; // Custom plan_id
    const updateData = req.body;

    const oldPlan = await Plan.findOne({ plan_id: planId });
    if (!oldPlan) {
      return res.status(404).json(errorResponse('Plan not found'));
    }

    const updatedPlan = await Plan.findOneAndUpdate(
      { plan_id: planId },
      updateData,
      { new: true, runValidators: true }
    );

    // Log changes (assuming PlanLog model exists)
    const changes = {};
    Object.keys(updateData).forEach(key => {
      if (JSON.stringify(oldPlan[key]) !== JSON.stringify(updateData[key])) {
        changes[key] = { old: oldPlan[key], new: updateData[key] };
      }
    });



    res.status(200).json(successResponse('Plan updated successfully', updatedPlan));
  } catch (error) {
    console.error('Update Plan Error:', error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Delete Plan ====================
const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params; // Custom plan_id

    const plan = await Plan.findOne({ plan_id: planId });
    if (!plan) {
      return res.status(404).json(errorResponse('Plan not found'));
    }

    await Plan.deleteOne({ plan_id: planId });



    res.status(200).json(successResponse('Plan deleted successfully'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Get Plan Logs ====================
const getPlanLogs = async (req, res) => {
  try {
    const { planId } = req.params;
    const query = planId ? { plan_id: planId } : {};

    const logs = await PlanLog.find(query)
      .populate('changed_by', 'email username')
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json(successResponse('Plan logs retrieved successfully', logs));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== SINGLE FUNCTION: Update Investment Status ====================
const updateInvestmentStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { investmentId } = req.params;
    const { action, note } = req.body;

    if (!action || !["approve", "disapprove"].includes(action)) {
      await session.abortTransaction();
      return res.status(400).json(errorResponse('Invalid action. Must be "approve" or "disapprove"'));
    }

    const investment = await Investment.findById(investmentId).session(session);
    if (!investment || investment.status !== "PENDING") {
      await session.abortTransaction();
      return res.status(400).json(errorResponse('Invalid or already processed request'));
    }

    const currentUserId = req.user?.id;

    if (action === "approve") {
      const plan = await Plan.findOne({ plan_id: investment.productId }).session(session);
      if (!plan || plan.quantity < investment.quantity) {
        await session.abortTransaction();
        return res.status(400).json(errorResponse("Insufficient quantity now"));
      }

      const user = await User.findOne({ user_id: investment.user_id }).session(session);
      if (!user) {
        await session.abortTransaction();
        throw new Error("User not found");
      }

      // Update Investment
      investment.status = "ACTIVE";
      investment.approvedBy = currentUserId;
      investment.approvedAt = new Date();
      investment.approvalNote = note?.trim() || "Approved without note";
      await investment.save({ session });

      // Plan update
      plan.quantity -= investment.quantity;
      plan.total_investment = Number(plan.total_investment || 0) + investment.amount;

      const isNewInvestor = (await Investment.countDocuments({
        user_id: user.user_id,
        productId: investment.productId,
        status: "ACTIVE"
      }).session(session)) === 1;

      if (isNewInvestor) {
        plan.total_buyer = Number(plan.total_buyer || 0) + 1;
      }
      await plan.save({ session });

      // User stats
      user.totalSelfInvestment += investment.amount;
      user.pv_self += investment.amount / 10;

      // ==================== NEW: Stake Token Logic ====================
      if (plan.freeTokenValue && plan.freeTokenValue > 0) {
        // Current Token Price (change this according to your logic - Redis, DB, or API)
        const currentTokenPrice = 0.5;   // ← Example: 1 StakeToken = ₹0.5 (update as per live price)

        const stakeTokensToAdd = plan.freeTokenValue / currentTokenPrice;

        user.stakeTokens = (user.stakeTokens || 0) + stakeTokensToAdd;

        console.log(`[StakeToken] Added ${stakeTokensToAdd.toFixed(2)} StakeTokens to user ${user.user_id} (FreeTokenValue: ₹${plan.freeTokenValue})`);
      }

      await user.save({ session });

      // Income distribution
      await distributeDirectReferral(user.user_id, investment.amount, investment.productId, { session });
      await distributeLevelIncome(user.user_id, investment.amount, investment.productId, { session });

    } else if (action === "disapprove") {
      investment.status = "REJECTED";
      investment.rejectedBy = currentUserId;
      investment.rejectedAt = new Date();
      investment.rejectionReason = note?.trim() || "No reason provided";
      await investment.save({ session });
    }

    await session.commitTransaction();

    const message = action === "approve"
      ? "Investment approved & completed successfully"
      : "Investment rejected successfully";

    res.status(200).json(successResponse(message, investment));

  } catch (error) {
    await session.abortTransaction();
    console.error("Update Investment Status Error:", error);
    res.status(500).json(errorResponse(error.message || "Failed to update investment status"));
  } finally {
    session.endSession();
  }
};

const addPointsToUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user_id, loyalty_points = 0, shopping_points = 0, note } = req.body;

    console.log("Add Points Request:", { user_id, loyalty_points, shopping_points, note });

    // Validation
    if (!user_id) {
      await session.abortTransaction();
      return res.status(400).json(errorResponse("user_id is required"));
    }

    if (Number(loyalty_points) <= 0 && Number(shopping_points) <= 0) {
      await session.abortTransaction();
      return res.status(400).json(errorResponse("At least one of loyalty_points or shopping_points must be greater than 0"));
    }

    const user = await User.findOne({ user_id }).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json(errorResponse("User not found"));
    }

    // Add points (increment)
    const addedLoyalty = Number(loyalty_points) || 0;
    const addedShopping = Number(shopping_points) || 0;

    user.loyalty_points = (user.loyalty_points || 0) + addedLoyalty;
    user.shopping_points = (user.shopping_points || 0) + addedShopping;

    await user.save({ session });

    await session.commitTransaction();

    res.status(200).json(
      successResponse("Points added successfully", {
        user_id: user.user_id,
        name: user.name || "N/A",
        added: {
          loyalty_points: addedLoyalty,
          shopping_points: addedShopping,
        },
        current: {
          loyalty_points: user.loyalty_points,
          shopping_points: user.shopping_points,
        },
        note: note || "Added by Admin",
      })
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Add Points Error:", error);
    res.status(500).json(errorResponse(error.message || "Failed to add points"));
  } finally {
    session.endSession();
  }
};

module.exports = {
  registerPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  getPlanLogs,
  addPointsToUser,
  updateInvestmentStatus
};