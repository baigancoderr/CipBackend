const cron = require("node-cron");
const Deposit = require("../../models/Deposit") 
const { distributeDailyROI } = require("../../services/roiIncomeDistributionService");
const {checkBalanceAndProcess, updateLivePriceInDB} = require("../../services/autoProcessDepositService");

// Setup daily cron for ROI distribution (runs every day at midnight, e.g., 00:00)
cron.schedule("*/5 * * * *", async () => {
    // cron.schedule("*/2 * * * *", async () => {
  console.log("Running daily ROI distribution cron job...");
  try {
    await distributeDailyROI();
    await checkBalanceAndProcess();
    await updateLivePriceInDB();
    console.log("Daily ROI and Binary Income distribution completed.");
  } catch (error) {
    console.error("Error in daily ROI cron job:", error);
  }
});



console.log("Cron jobs scheduled successfully.");





// =======================================
// ✅ EXPIRE OLD DEPOSITS CRON
// Every 1 minute
// =======================================

cron.schedule("* * * * *", async () => {
  try {
    console.log("⏰ Running deposit expiry cron...");

    const result = await Deposit.updateMany(
      {
        status: { $in: ["initiated", "pending"] },
        expiresAt: { $lt: new Date() },
      },
      {
        $set: {
          status: "expired",
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Expired deposits updated: ${result.modifiedCount}`);
    }

  } catch (error) {
    console.error("❌ Deposit expiry cron error:", error.message);
  }
});
