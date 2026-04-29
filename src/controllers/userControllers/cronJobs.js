const cron = require("node-cron"); 
const { distributeDailyROI } = require("../../services/roiIncomeDistributionService");
const {checkBalanceAndProcess, updateLivePriceInDB} = require("../../services/autoProcessDepositService");

// Setup daily cron for ROI distribution (runs every day at midnight, e.g., 00:00)
cron.schedule("*/1 * * * *", async () => {
    // cron.schedule("*/2 * * * *", async () => {
  console.log("Running daily ROI distribution cron job...");
  try {
    // await distributeDailyROI();
    // await checkBalanceAndProcess();
    // await updateLivePriceInDB();
    console.log("Daily ROI and Binary Income distribution completed.");
  } catch (error) {
    console.error("Error in daily ROI cron job:", error);
  }
});



console.log("Cron jobs scheduled successfully.");