const cron = require("node-cron"); 
const { distributeDailyROI } = require("../../services/roiIncomeDistributionService");
const {dailyBinaryPayout} = require("../../services/binaryIncomeDistributionService");
const {runMonthlyLeadershipProcess} = require("../../services/leadershipIncomeDistributionService");

// Setup daily cron for ROI distribution (runs every day at midnight, e.g., 00:00)
cron.schedule("0 0 * * *", async () => {
    // cron.schedule("*/2 * * * *", async () => {
  console.log("Running daily ROI distribution cron job...");
  try {
    await distributeDailyROI();
    await dailyBinaryPayout();
    console.log("Daily ROI and Binary Income distribution completed.");
  } catch (error) {
    console.error("Error in daily ROI cron job:", error);
  }
});

cron.schedule("0 1 * * *", async () => {
    // cron.schedule("*/5 * * * *", async () => {
  console.log("Running daily Leadership Bonus distribution cron job..."); 
  try {
    await runMonthlyLeadershipProcess(); 
    console.log("Daily Leadership Bonus distribution completed.");
  } catch (error) {
    console.error("Error in daily Leadership Bonus cron job:", error);
  }
});

console.log("Cron jobs scheduled successfully.");