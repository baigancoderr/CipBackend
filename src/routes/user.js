const express = require("express");
const router = express.Router();
const { telegramLogin } = require("../controllers/userControllers/auth");

const {
  getUserStakedPlans,
  getAllPackageDetails,
  requestWithdrawalOtp,
  withdraw,
  getWithdrawalHistory,
  getDashboard,
  getWalletDetails,
  getInvestments,
  swapDepositToToken,
  getSwaps,
  getDailyROI,
  getLevelIncomeReward,
  getTransactionHistory,
  getUserProfile,
updateUserProfilePassword,
  getAllLevelPlans,
  getReferralIncome,
  getReferralData,
  getTeamTreeView,
  getLevelWiseIncome,
  getDirectTeam,
  getIndirectTeam,
sendSupportEmail,
contactFormEmail,
  logout,
  CreateInvestment,
   createDeposit,
  depositCallback,
} = require("../controllers/userControllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { investInPlan, getUserInvestments, getListedPlans } = require("../controllers/userControllers/investmentController");

const { createQrDeposit, paymentCallback } = require('../controllers/userControllers/depositController');
const { submitKYC, getMyKYC, getMyKYCHistory } = require("../controllers/userControllers/kycController");
const { sendWalletUpdateOTP, updateWalletAddress } = require("../controllers/userControllers/walletAddressController");
const {
  get2FAStatus,
  generate2FA,
  verify2FA,
  disable2FA,
} = require("../controllers/userControllers/2faController");

router.options("/contactformmail", (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': req.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.sendStatus(200);
});

// router.post("/auth/signup", signup);
// router.post("/auth/verify-otp", verifySignupOTP);
// router.post("/auth/login", login);
// router.post("/auth/forgot-password", forgotPassword);
// router.post("/auth/reset-password", resetPassword);
// router.post("/auth/resend-otp", resendOTP);

// 🔥 Telegram Login
router.post("/telegram-login", telegramLogin);

// 👤 Profile
router.get("/profile/:telegramId", getUserProfile);

// const { CreateInvestment, claimDailyROI } = require("../controllers/userControllers/investmentController");

router.post("/CreateInvestment", CreateInvestment);
// router.post("/claim", claimDailyROI);

// User Action Routes (Requires Authentication

// User routes
router.post('/deposit/qr', authMiddleware(['user']), createQrDeposit);

// Public callback route (Fintolite will call this)
router.post('/deposit/callback', paymentCallback);

router.post("/request-withdrawal-otp", authMiddleware(["user"]), requestWithdrawalOtp);
router.post("/withdraw", authMiddleware(["user"]), withdraw);
router.get(
  "/withdrawal-history",
  authMiddleware(["user"]),
  getWithdrawalHistory
);

//Stake
router.get("/stake/userPlans", authMiddleware(["user"]), getUserStakedPlans);
router.get(
  "/package/allDetails",
  authMiddleware(["user"]),
  getAllPackageDetails
);

// Sidebar Menu Routes (Requires Authentication)
router.get("/dashboard", authMiddleware(["user"]), getDashboard);
router.get("/wallet", authMiddleware(["user"]), getWalletDetails);

// Property Investment Routes (User)
router.post('/plan/invest', authMiddleware(["user"]), investInPlan);
router.get('/investments', authMiddleware(["user"]), getUserInvestments);
router.get('/plan/listed', authMiddleware(["user"]), getListedPlans);

// Swap Routes (User)
router.post("/swap/deposit-to-token", authMiddleware(["user"]), swapDepositToToken);
router.get("/swaps", authMiddleware(["user"]), getSwaps);

//KYC Route
router.post("/submit-kyc", authMiddleware(["user"]), submitKYC);
router.get("/get-kyc", authMiddleware(["user"]), getMyKYC);
router.get("/get-kyc-history", authMiddleware(["user"]), getMyKYCHistory);

// 2FA Routes
router.get("/2fa/status", authMiddleware(["user"]), get2FAStatus);
router.post("/2fa/generate", authMiddleware(["user"]), generate2FA);
router.post("/2fa/verify", authMiddleware(["user"]), verify2FA);
router.post("/2fa/disable", authMiddleware(["user"]), disable2FA);

// Wallet Address Update Routes
router.post("/wallet/send-update-otp", authMiddleware(["user"]), sendWalletUpdateOTP);
router.post("/wallet/update-address", authMiddleware(["user"]), updateWalletAddress);


router.get("/team-tree-view", authMiddleware(["user"]), getTeamTreeView);
router.get(
  "/referral-level-wise-team",
  authMiddleware(["user"]),
  getReferralData
);

router.get("/direct-team", authMiddleware(["user"]), getDirectTeam);
router.get("/indirect-team", authMiddleware(["user"]), getIndirectTeam);

router.get("/daily-roi", authMiddleware(["user"]), getDailyROI);
router.get("/referral-income", authMiddleware(["user"]), getReferralIncome);
router.get("/level-wise-income", authMiddleware(["user"]), getLevelWiseIncome);
router.get(
  "/level-income-reward",
  authMiddleware(["user"]),
  getLevelIncomeReward
);

router.get("/level-plans", authMiddleware(["user"]), getAllLevelPlans);



router.get(
  "/transaction-history",
  authMiddleware(["user"]),
  getTransactionHistory
);

// router.get("/profile", authMiddleware(["user"]), getUserProfile);
router.put("/profile/update-user-password", authMiddleware(["user"]), updateUserProfilePassword);

router.post("/sendsupportemail", authMiddleware(["user"]), sendSupportEmail);
router.post("/contactformmail", contactFormEmail);

router.post("/logout", authMiddleware(["user"]), logout);



// 💸 Create deposit
router.post("/deposit/create", createDeposit);

// 🔁 Callback (IMPORTANT)
router.post("/deposit/callback", (req, res) => {
  console.log("BODY:", req.body);
  res.json(req.body);
});

module.exports = router;
