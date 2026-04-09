const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, telegramId: user.telegramId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Generate Unique User ID
const generateUniqueId = async () => {
  let id;
  let exists = true;

  while (exists) {
    id = "CPR" + Math.random().toString(36).substring(2, 8).toUpperCase();
    exists = await User.findOne({ userId: id });
  }
  return id;
};

// Telegram Login / Register
const telegramLogin = async (req, res) => {
  try {
    const { telegramId, name, username, referralCode } = req.body;

    if (!telegramId || !name) {
      return res.status(400).json({
        success: false,
        message: "telegramId and name are required",
      });
    }

    // Check if user already exists → Direct Login
    let user = await User.findOne({ telegramId });

    if (user) {
      const token = generateToken(user);
      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user,
      });
    }

    // New User Registration
    const userCount = await User.countDocuments();
    let finalReferral = null;
    let refUser = null;

    if (userCount === 0) {
      // First user in system
      finalReferral = "SYSTEM";
    } else {
      if (!referralCode) {
        return res.status(400).json({
          success: false,
          message: "Referral code is required",
        });
      }

      if (!/^CPR[A-Z0-9]{6}$/.test(referralCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code format",
        });
      }

      refUser = await User.findOne({ referralCode });

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

    // Generate unique ID
    const uniqueId = await generateUniqueId();

    // Create new user
    user = await User.create({
      telegramId,
      name: name.trim(),
      username: username || "",
      userId: uniqueId,
      referralCode: uniqueId,
      referredBy: finalReferral,
      walletBalance: 0,
      totalReferrals: 0,
      referralEarnings: 0,
      totalInvested: 0,
      dailyIncome: 0,
      activePackage: 0,
      role: "user",
    });

    // Give referral bonus to referrer
    if (refUser) {
      refUser.totalReferrals += 1;
      refUser.referralEarnings += 10;
      await refUser.save();
    }

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user,
    });

  } catch (error) {
    console.error("Telegram Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

module.exports = { telegramLogin };