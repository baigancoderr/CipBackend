const Investment = require("../models/Investment");
const Property = require("../models/Property");
const User = require("../models/User");
const RoiDistribution = require("../models/RoiDistribution"); 


async function distributeDailyROI() {
  try {
    const now = new Date();
    const activeInvestments = await Investment.find({ status: "ACTIVE" });
    const DEFAULT_RENTAL_PERCENTAGE = 4;

    for (const investment of activeInvestments) {
      const user = await User.findOne({ user_id: investment.user_id });
      if (!user) continue;

      const property = await Property.findOne({ property_id: investment.property_id });
      if (!property) continue;

      // Check if investment is still within 25 months from creation date
      const investmentStart = new Date(investment.createdAt);
      const endDate = new Date(investmentStart);
      endDate.setMonth(endDate.getMonth() + 25); // Add 25 months
      if (now > endDate) {
        // Stop ROI after 25 months: Update status to expired or inactive
        investment.status = "EXPIRED";
        await investment.save();
        continue; // Skip distribution
      }

      // Use property's rental_percentage if available, else default
      const rentalPercentage = property.rental_percentage || DEFAULT_RENTAL_PERCENTAGE;

      // Fetch monthly rate from property's rental_percentage (monthly %)
      const monthlyRate = rentalPercentage / 100; // e.g., 4% -> 0.04

      const workingDaysInMonth = 30; // Approx. working days in a month
      const dailyRate = monthlyRate / workingDaysInMonth; // Daily portion on working days

      // Use full invested amount for effective ROI calculation
      const effectiveAmount = investment.amount_usd;

      // Calculate daily income
      const dailyIncome = effectiveAmount * dailyRate;
      const dailyROIPercent = dailyRate * 100; // Percentage for logging

      // Credit to myWallet
      user.myWallet.amount += dailyIncome;
      user.totalRoiRewards += dailyIncome;
      user.totalAllRewards += dailyIncome;
      await user.save();

      console.log(`Daily ROI of ${dailyIncome} credited to user ${user.user_id} for investment ${investment._id}`);

      // Log ROI income using RoiDistribution
      await RoiDistribution.create({
        userId: user._id,
        user_id: user.user_id,
        stakeId: investment.property_id, // Assuming Investment is Stake model
        amount: dailyIncome,
        dailyROI: dailyROIPercent,
        stakeAmount: investment.amount_usd,
      });

      // Optional: Update next_payout_date to tomorrow
      investment.next_payout_date = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await investment.save();
    }
  } catch (error) {
    console.error("Error distributing daily ROI:", error);
  }
}

module.exports = {
  distributeDailyROI,
};