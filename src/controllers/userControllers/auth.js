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

// ✅ Telegram Login / Register (Final Updated Version)
const telegramLogin = async (req, res) => {
  try {
    const { telegramId, name, username, referralCode } = req.body;

    // ❗ Validation
    if (!telegramId || !name) {
      return res.status(400).json({
        success: false,
        message: "telegramId and name required",
      });
    }

    // ====================== EXISTING USER CHECK ======================
    // Sirf active users ko consider karo
    const existingUser = await User.findOne({ telegramId, isActive: true });

   if (existingUser) {
  const token = generateToken(existingUser);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: existingUser,
    isNewUser: false, // 🔥 ADD THIS
  });
}

    // ====================== NEW USER REGISTRATION ======================
    // Agar user nahi mila ya inactive hai → Naya account banao

   // Count active users
const userCount = await User.countDocuments({ isActive: true });

let refUser = null;
let finalReferral = null;

// ✅ FIRST USER
if (userCount === 0) {
  finalReferral = "SYSTEM";
} 
// ✅ OTHER USERS
else {
  if (!referralCode) {
    return res.status(200).json({
      success: false,
      isNewUser: true,
      message: "Referral required",
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

  if (refUser.telegramId === telegramId) {
    return res.status(400).json({
      success: false,
      message: "You cannot use your own referral code",
    });
  }

  finalReferral = referralCode;
}

    // 🔥 Generate Unique ID
    const uniqueId = await generateUniqueId();

    // 🆕 Create new user
    const user = await User.create({
      telegramId,
      name,
      username: username || "",

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
      isActive: true,           // ✅ Important
    });

    // 🎯 Referral reward to parent
    if (refUser) {
      refUser.totalReferrals += 1;
      // refUser.referralEarnings += 10;
      await refUser.save();
    }

    // 🔐 Generate Token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user,
       isNewUser: true,
    });

  } catch (error) {
    console.error("Telegram Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  telegramLogin,
};