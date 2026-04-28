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
  getStakingProfits,
  approveWithdrawal,
  getWithdrawals,
  getAllInvestmentReport,
  getDailyRoiHistory,
  getReferralIncomeReport,
  getTransferReport,
  getTransactionHistoryAdmin,
  getAdminLoginLog,
  updateAdminEmailPassword,
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

router.get("/history/transfer-report", authMiddleware(["admin"]), getTransferReport);

/////////////////

//Report

router.get("/report/get-rank-achivement-report", authMiddleware(["admin"]), getRankAchievementHistory);

// KYC Verification Route (Admin Only)

router.post("/kyc/verify", authMiddleware(["admin"]), verifyKYC);
router.get("/kyc/history", authMiddleware(["admin"]), getAllKYC);

// Admin User Update Route (Admin Only)
router.put("/user/profile/update", authMiddleware(["admin"]), adminUpdateUserDetails);



router.get("/staking-profits", authMiddleware(["admin"]), getStakingProfits);
router.post(
  "/user/withdrawal/approve",
  authMiddleware(["admin"]),
  approveWithdrawal
);
router.get("/user/withdrawals", authMiddleware(["admin"]), getWithdrawals);


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
