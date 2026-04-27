const Investment = require("../models/Investment");
const User = require("../models/User");
const RoiDistribution = require("../models/RoiDistribution");

async function distributeDailyROI() {
  try {
    const now = new Date();

    // Find all ACTIVE investments that are still within their period
    const activeInvestments = await Investment.find({
      status: "active",
      endDate: { $gt: now },
    });

    console.log(`[Daily ROI] Found ${activeInvestments.length} active investments to process`);

    for (const investment of activeInvestments) {
      // Get user
      const user = await User.findOne({ userId: investment.userId });
      if (!user) {
        console.log(`[Daily ROI] User not found for investment ${investment._id}`);
        continue;
      }

      // Calculate today's ROI (in tokens)
      const dailyTokens = investment.dailyIncomeTokens || 0;

      // ====================== CREDIT TO ROI WALLET ======================
      user.wallets = user.wallets || { roi: { amount: 0 } };
      user.wallets.roi.amount = (user.wallets.roi.amount || 0) + dailyTokens;

      console.log(`[Daily ROI] Crediting ${dailyTokens.toFixed(8)} tokens to user ${user.userId} (Investment: ${investment._id})`);

      // Update total earnings
      user.totalEarnings = (user.totalEarnings || 0) + dailyTokens;

      await user.save();

      // ====================== UPDATE INVESTMENT ======================
      investment.claimedDays += 1;
      investment.lastClaimedAt = now;

      // If fully claimed → mark as completed
      if (investment.claimedDays >= investment.totalDays) {
        investment.status = "completed";
      }

      await investment.save();

      // ====================== LOG ROI DISTRIBUTION ======================
      await RoiDistribution.create({
        userId: user._id,
        user_id: user.userId,
        investmentId: investment._id,           // reference to this investment
        amount: dailyTokens,                    // tokens received today
        dailyROI: investment.dailyIncomeTokens, // for reference
        stakeAmount: investment.amount,         // original investment amount
        date: now,
      });

      console.log(`✅ Daily ROI credited: ${dailyTokens.toFixed(8)} tokens → User ${user.userId} (Investment: ${investment._id})`);
    }

    console.log(`[Daily ROI] Distribution completed successfully`);
  } catch (error) {
    console.error("❌ Error distributing daily ROI:", error);
  }
}

module.exports = {
  distributeDailyROI,
};