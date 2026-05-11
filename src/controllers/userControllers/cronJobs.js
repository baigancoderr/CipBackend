const cron = require("node-cron");
const Deposit = require("../../models/Deposit") 
const { distributeDailyROI } = require("../../services/roiIncomeDistributionService");
const {checkBalanceAndProcess, updateLivePriceInDB} = require("../../services/autoProcessDepositService");

// Setup daily cron for ROI distribution at 12:00 AM every day
cron.schedule("0 0 * * *", async () => {
  console.log("Running daily ROI distribution cron job...");
  try {
    await distributeDailyROI();
    console.log("Daily ROI Income distribution completed.");
  } catch (error) {
    console.error("Error in daily ROI cron job:", error);
  }
});

// run every 1 minute to check balance and update live price in DB

cron.schedule(" */5 * * * * *", async () => {    
  console.log("Running balance check and live price update cron job...");
  try {
    await checkBalanceAndProcess();
    await updateLivePriceInDB();
    console.log("Balance check and live price update completed.");
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
