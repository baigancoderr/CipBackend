const express = require("express");
const router = express.Router();
const {
  signup,
  verifySignupOTP,
  login,
  forgotPassword,
  resendOTP,
  resetPassword,
} = require("../controllers/adminControllers/auth");
const {
  getAdminDashboard,
  getAllUsers,
  adminLoginAsUser,
  updateUserStatus,
  updateUserWalletAddress,
  getWalletUpdateLogs,
  depositToWallet,
  getAllDeposits,
  setTokenPrice,
  getAdminReport,
  createBonanzaPlan,
  getAllBonanzaPlans,
  updateBonanzaPlan,
  deleteBonanzaPlan,
  getStakingProfits,
  approveWithdrawal,
  getWithdrawals,
  adminManageStake,
  getAllInvestmentReport,
  getDailyRoiHistory,
  getLevelIncomeHistory,
  getReferralIncomeReport,
  getBinaryIncomeReport,
  getLeadershipShareReport,
  getLeadershipIncomeReport,
  getBonanzaRewardsReport,
  getSwapReport,
  getReinvestReport,
  getTransferReport,
  getTransactionHistoryAdmin,
  getAdminLoginLog,
  updateAdminEmailPassword,
  createLevelPlan,
  getAllLevelPlans,
  updateLevelPlan,
  deleteLevelPlan,
  getAllLevelIncomeRewards,
  getRankAchievementHistory,
  adminLogout,
} = require("../controllers/adminControllers/adminController");

const {verifyKYC, getAllKYC} = require("../controllers/userControllers/kycController");
const {adminUpdateUserDetails} = require("../controllers/adminControllers/userUpdateController");

const multer = require('multer');
const authMiddleware = require("../middleware/authMiddleware");

router.post("/auth/signup", signup);
router.post("/auth/verify-otp", verifySignupOTP);
router.post("/auth/login", login);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/resend-otp", resendOTP);
router.post("/auth/reset-password", resetPassword);

// Admin Dashboard Routes (Requires Admin Role)
router.get("/dashboard", authMiddleware(["admin"]), getAdminDashboard);
router.get("/users", authMiddleware(["admin"]), getAllUsers);
router.post("/admin/login-as-user", authMiddleware(["admin"]), adminLoginAsUser);
router.put(
  "/user/update-status/:id",
  authMiddleware(["admin"]),
  updateUserStatus
);
router.post("/user/deposit", authMiddleware(["admin"]), depositToWallet);
router.get("/user/deposits", authMiddleware(["admin"]), getAllDeposits);

router.post("/set-price", authMiddleware(["admin"]), setTokenPrice);
router.get("/report", authMiddleware(["admin"]), getAdminReport);

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/property_images'); // Folder to save images
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Unique filename
  }
});
const upload = multer({ storage });



// All Income and Reward and history (Admin Only)

router.get("/history/user-investment-history", authMiddleware(["admin"]), getAllInvestmentReport);
router.get("/history/daily-roi-history", authMiddleware(["admin"]), getDailyRoiHistory);
router.get(
  "/history/referral-income-history",
  authMiddleware(["admin"]),
  getReferralIncomeReport
);
router.get("/history/level-income-history", authMiddleware(["admin"]), getLevelIncomeHistory);
router.get(
  "/history/binary-income-history",
  authMiddleware(["admin"]),
  getBinaryIncomeReport
);
router.get(
  "/history/leadership-share-history",
  authMiddleware(["admin"]),
  getLeadershipShareReport
);
router.get(
  "/history/leadership-income-history",
  authMiddleware(["admin"]),
  getLeadershipIncomeReport
);
router.get(
  "/history/bonanza-rewards",
  authMiddleware(["admin"]),
  getBonanzaRewardsReport
);

router.get("/history/swap-report", authMiddleware(["admin"]), getSwapReport);
router.get("/history/reinvest-report", authMiddleware(["admin"]), getReinvestReport);
router.get("/history/transfer-report", authMiddleware(["admin"]), getTransferReport);

/////////////////

//Report

router.get("/report/get-rank-achivement-report", authMiddleware(["admin"]), getRankAchievementHistory);

// KYC Verification Route (Admin Only)

router.post("/kyc/verify", authMiddleware(["admin"]), verifyKYC);
router.get("/kyc/history", authMiddleware(["admin"]), getAllKYC);

// Admin User Update Route (Admin Only)
router.put("/user/profile/update", authMiddleware(["admin"]), adminUpdateUserDetails);

router.post(
  "/bonanza-plan/create",
  authMiddleware(["admin"]),
  createBonanzaPlan
);
router.get("/bonanza-plans", authMiddleware(["admin"]), getAllBonanzaPlans);
router.put(
  "/bonanza-plan/update/:id",
  authMiddleware(["admin"]),
  updateBonanzaPlan
);
router.delete(
  "/bonanza-plan/delete/:id",
  authMiddleware(["admin"]),
  deleteBonanzaPlan
);

router.post("/level-plan/create", authMiddleware(["admin"]), createLevelPlan);
router.get("/level-plans", authMiddleware(["admin"]), getAllLevelPlans);
router.put(
  "/level-plan/update/:id",
  authMiddleware(["admin"]),
  updateLevelPlan
);
router.delete(
  "/level-plan/delete/:id",
  authMiddleware(["admin"]),
  deleteLevelPlan
);
router.get(
  "/level-income-rewards",
  authMiddleware(["admin"]),
  getAllLevelIncomeRewards
);

router.get("/staking-profits", authMiddleware(["admin"]), getStakingProfits);
router.post(
  "/user/withdrawal/approve",
  authMiddleware(["admin"]),
  approveWithdrawal
);
router.get("/user/withdrawals", authMiddleware(["admin"]), getWithdrawals);

router.post("/stake/stake-manage", authMiddleware(["admin"]), adminManageStake);





router.get(
  "/transaction-history",
  authMiddleware(["admin"]),
  getTransactionHistoryAdmin
);
router.get("/login-log", authMiddleware(["admin"]), getAdminLoginLog);
router.put(
  "/update-email-password",
  authMiddleware(["admin"]),
  updateAdminEmailPassword
);

router.put(
  "/user/update-wallet-address",
  authMiddleware(["admin"]),
  updateUserWalletAddress
);
router.get(
  "/wallet-update-logs",
  authMiddleware(["admin"]),
  getWalletUpdateLogs
);
router.post("/logout", authMiddleware(["admin"]), adminLogout);


module.exports = router;
