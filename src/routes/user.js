const express = require("express");
const router = express.Router();
// const { telegramLogin ,getMe } = require("../controllers/userControllers/auth");
const {
  getMe,
  webRegisterOrLogin,
} = require("../controllers/userControllers/auth1");

const {
  getDashboard,
  getWalletDetails,
  getDailyROI,
  getUserProfile,
  updateUserProfilePassword,
  requestWithdrawalOtp,
  withdraw,
  getWithdrawalHistory,
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
  updateWallet,
  addWalletFirstTime,
  getDeposits,
  updateEmail,
  addEmailFirstTime
} = require("../controllers/userControllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  investInPlan,
  getUserInvestments,
  getUserOverview,
} = require("../controllers/userControllers/investmentController");

const {
  createQrDeposit,
  paymentCallback,
} = require("../controllers/userControllers/depositController");
const {
  submitKYC,
  getMyKYC,
  getMyKYCHistory,
} = require("../controllers/userControllers/kycController");
const {
  sendWalletUpdateOTP,
  updateWalletAddress,
} = require("../controllers/userControllers/walletAddressController");
const {
  get2FAStatus,
  generate2FA,
  verify2FA,
  disable2FA,
} = require("../controllers/userControllers/2faController");

// Swap Controller
const { swapToDeposit, getMySwapHistory  } = require("../controllers/userControllers/swapController");



router.options("/contactformmail", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": req.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  });
  res.sendStatus(200);
});

// 🔥 Telegram Login
// router.post("/telegram-login", telegramLogin);
router.post("/web-register", webRegisterOrLogin);

router.get("/me", authMiddleware(), getMe);

// 👤 Profileee
// router.get("/profile/:telegramId", getUserProfile);
router.get("/profile", authMiddleware(), getUserProfile);

// const { CreateInvestment, claimDailyROI } = require("../controllers/userControllers/investmentController");

router.post("/CreateInvestment", CreateInvestment);
// router.post("/claim", claimDailyROI);

// User Action Routes (Requires Authentication

// User routes
router.post("/deposit/qr", authMiddleware(["user"]), createQrDeposit);

// Public callback route (Fintolite will call this)
// router.post('/deposit/callback', paymentCallback);

// Sidebar Menu Routes (Requires Authentication)
router.get("/dashboard", authMiddleware(["user"]), getDashboard);
router.get("/wallet", authMiddleware(["user"]), getWalletDetails);

// Property Investment Routes (User)
router.post("/plan/invest", authMiddleware(["user"]), investInPlan);
router.get("/investments", authMiddleware(["user"]), getUserInvestments);
router.get("/overview", authMiddleware(["user"]), getUserOverview);

//KYC Route
router.post("/submit-kyc", authMiddleware(["user"]), submitKYC);
router.get("/get-kyc", authMiddleware(["user"]), getMyKYC);
router.get("/get-kyc-history", authMiddleware(["user"]), getMyKYCHistory);

// 2FA Routes
router.get("/2fa/status", authMiddleware(["user"]), get2FAStatus);

router.post("/2fa/generate", authMiddleware(["user"]), generate2FA);
router.post("/2fa/verify", authMiddleware(["user"]), verify2FA);
router.post("/2fa/disable", authMiddleware(["user"]), disable2FA);

// Withdrawal Routes
router.post(
  "/request-withdrawal-otp",
  authMiddleware(["user"]),
  requestWithdrawalOtp,
);
router.post("/withdraw", authMiddleware(["user"]), withdraw);
router.get(
  "/withdrawal-history",
  authMiddleware(["user"]),
  getWithdrawalHistory,
);

// Swap Routes
router.post("/swap-to-deposit", authMiddleware(["user"]), swapToDeposit);
router.get("/swap-history", authMiddleware(["user"]), getMySwapHistory);

// Wallet Address Update Routes
router.post(
  "/wallet/send-update-otp",
  authMiddleware(["user"]),
  sendWalletUpdateOTP,
);
router.post(
  "/wallet/update-address",
  authMiddleware(["user"]),
  updateWalletAddress,
);

// Add Wallet Routes
router.post("/add-wallet", authMiddleware(), addWalletFirstTime);
router.put("/update-wallet", authMiddleware(["user"]), updateWallet);


router.post("/add-email", authMiddleware(), addEmailFirstTime);
router.put("/update-email", authMiddleware(["user"]), updateEmail);


router.get("/team-tree-view", authMiddleware(["user"]), getTeamTreeView);
router.get(
  "/referral-level-wise-team",
  authMiddleware(["user"]),
  getReferralData,
);

router.get("/direct-team", authMiddleware(["user"]), getDirectTeam);
router.get("/indirect-team", authMiddleware(["user"]), getIndirectTeam);

router.get("/daily-roi", authMiddleware(["user"]), getDailyROI);
router.get("/referral-income", authMiddleware(["user"]), getReferralIncome);
router.get("/level-wise-income", authMiddleware(["user"]), getLevelWiseIncome);

// router.get("/profile", authMiddleware(["user"]), getUserProfile);
router.put(
  "/profile/update-user-password",
  authMiddleware(["user"]),
  updateUserProfilePassword,
);

router.post("/sendsupportemail", authMiddleware(["user"]), sendSupportEmail);
router.post("/contactformmail", contactFormEmail);

router.post("/logout", authMiddleware(["user"]), logout);

// 💸 Create deposit
// router.post("/deposit/create", createDeposit);
router.post("/deposit/create", authMiddleware(["user"]), createDeposit);
router.get("/deposit-history", authMiddleware(["user"]), getDeposits);

// 🔁 Callback (IMPORTANT)

router.get("/deposit/callback", depositCallback);
router.post("/deposit/callback", depositCallback); // 👈 for testing

module.exports = router;
