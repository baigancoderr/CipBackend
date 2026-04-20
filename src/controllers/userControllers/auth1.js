
// New version without Telegram code:


const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// 🔥 Unique ID Generator
const generateUniqueId = async () => {
  let id;
  let exists = true;

  while (exists) {
    id = "CPR" + Math.random().toString(36).substring(2, 8).toUpperCase();
    exists = await User.findOne({ userId: id });
  }
  return id;
};

// 🔐 Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      telegramId: user.telegramId,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ====================== WEB REGISTER / LOGIN ======================
const webRegisterOrLogin = async (req, res) => {
  try {
    const { name, email, referralCode } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and Email are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase(), isActive: true });

    if (existingUser) {
      const token = generateToken(existingUser);
      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: existingUser,
        isNewUser: false,
      });
    }

    // Count active users
    const userCount = await User.countDocuments({ isActive: true });

    let finalReferral = null;
    let refUser = null;

    // First user gets SYSTEM referral
    if (userCount === 0) {
      finalReferral = "SYSTEM";
    } 
    // Other users need valid referral
    else {
      if (!referralCode) {
        return res.status(200).json({
          success: false,
          isNewUser: true,
          message: "Referral code is required",
        });
      }

      if (!/^CPR[A-Z0-9]{6}$/.test(referralCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code format",
        });
      }

      refUser = await User.findOne({ referralCode, isActive: true });

      if (!refUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code",
        });
      }

      finalReferral = referralCode;
    }

    // Generate unique ID
    const uniqueId = await generateUniqueId();

    // Create new user
    const user = await User.create({
      email: email.toLowerCase(),
      telegramId: null,           // Web user - no telegram
      name: name.trim(),
      username: "",
      userId: uniqueId,
      referralCode: uniqueId,
      referredBy: finalReferral,

      walletBalance: 0,
      wallets: {
        referral: { amount: 1000 },
        roi: { amount: 1000 },
      },
      totalReferrals: 0,
      referralEarnings: 0,
      totalInvested: 0,
      activePackage: 0,
      dailyIncome: 0,

      role: "user",
      isActive: true,
    });

    // Give referral count to parent
    if (refUser) {
      refUser.totalReferrals += 1;
      await refUser.save();
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user,
      isNewUser: true,
    });

  } catch (error) {
    console.error("Web Register/Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ====================== GET ME (Keep Same) ======================
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  webRegisterOrLogin,   // ← Only Web
  getMe,
};