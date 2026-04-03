const User = require("../models/User");
const Package = require("../models/Package");
const moment = require("moment");
const config = require("../config/envConfig"); // Assuming config is available

const calculateDailyROI = async (userId) => {
  const user = await User.findById(userId).populate("package");
  if (!user || !user.package || user.principalWallet.amount === 0) return;

  const now = moment();
  if (now.day() === 0 || now.day() === 6) return; // Skip weekends

  const dailyProfit = user.principalWallet.amount * (user.package.dailyROI / 100);
  const maxCap = config.CAP * (user.totalSelfInvestment || 0); // Cap at 2x totalSelfInvestment
  const currentWalletAmount = user.myWallet.amount || 0;
  let netProfit = dailyProfit;

  

  // Check if adding netProfit would exceed the 2x cap
  const newWalletAmount = currentWalletAmount + netProfit;
  if (newWalletAmount > maxCap) {
    netProfit = Math.max(0, maxCap - currentWalletAmount);
  }

  if (netProfit > 0) {
    user.myWallet.amount = currentWalletAmount + netProfit;
    await user.save();
    console.log(
      `Daily ROI calculated for user ${userId}: Added $${netProfit.toFixed(2)}, new balance: $${user.myWallet.amount.toFixed(2)}, cap: $${maxCap.toFixed(2)}`
    );
  } else {
    console.log(
      `Daily ROI for user ${userId} capped at 0, cap limit (${maxCap.toFixed(2)}) reached, current balance: $${currentWalletAmount.toFixed(2)}`
    );
  }
};

module.exports = { calculateDailyROI };