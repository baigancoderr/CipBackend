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

// ✅ Telegram Login / Register
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

    // ✅ Existing user (LOGIN)
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
      const token = jwt.sign(
        { id: existingUser._id, telegramId: existingUser.telegramId },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: existingUser,
      });
    }

    // 🔢 Total users count
    const userCount = await User.countDocuments();

    let refUser = null;
    let finalReferral = null;

    // 🟢 FIRST USER
    if (userCount === 0) {
      finalReferral = "SYSTEM";
    } 
    
    // 🟡 OTHER USERS
    else {
      // ❌ Referral required
      if (!referralCode) {
        return res.status(400).json({
          success: false,
          message: "Referral code is required",
        });
      }

      // ❌ Format validation
      if (!/^CPR[A-Z0-9]{6}$/.test(referralCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code format",
        });
      }

      // 🔍 Find ref user
      refUser = await User.findOne({ referralCode });

      // ❌ Invalid referral
      if (!refUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code",
        });
      }

      // ❌ Self referral block
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

    // 🆕 Create user
    const user = await User.create({
      telegramId,
      name,
      username: username || "",

      userId: uniqueId,
      referralCode: uniqueId,
      referredBy: finalReferral,

      walletBalance: 0,
      totalReferrals: 0,
      referralEarnings: 0,
      totalInvested: 0,
    });

    // 🎯 Referral reward
    if (refUser) {
      refUser.totalReferrals += 1;
      refUser.referralEarnings += 10;
      await refUser.save();
    }

    // 🔐 Token
    const token = jwt.sign(
      { id: user._id, telegramId: user.telegramId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user,
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