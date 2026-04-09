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

// ✅ Telegram Login / Register - Final Correct Version
const telegramLogin = async (req, res) => {
  try {
    const { telegramId, name, username, referralCode } = req.body;

    if (!telegramId || !name) {
      return res.status(400).json({ success: false, message: "telegramId and name are required" });
    }

    // Existing user login
    let user = await User.findOne({ telegramId });
    if (user) {
      const token = generateToken(user);
      return res.status(200).json({ success: true, message: "Login successful", token, user });
    }

    const userCount = await User.countDocuments();
    let finalReferral = null;
    let refUser = null;

    // First user in the system
    if (userCount === 0) {
      finalReferral = "SYSTEM";
    } 
    // All other new users
    else {
      if (!referralCode || !referralCode.trim()) {
        return res.status(400).json({ success: false, message: "Referral code is required" });
      }

      if (!/^CPR[A-Z0-9]{6}$/.test(referralCode.trim())) {
        return res.status(400).json({ success: false, message: "Invalid referral code format" });
      }

      refUser = await User.findOne({ referralCode: referralCode.trim() });

      if (!refUser) {
        return res.status(400).json({ success: false, message: "Invalid referral code" });
      }

      if (refUser.telegramId === telegramId) {
        return res.status(400).json({ success: false, message: "You cannot use your own referral code" });
      }

      finalReferral = referralCode.trim();
    }

    const uniqueId = await generateUniqueId();

    // Create user (All users are normal "user" role)
    user = await User.create({
      telegramId,
      name: name.trim(),
      username: username || "",
      userId: uniqueId,
      referralCode: uniqueId,
      referredBy: finalReferral,
      role: "user",                    // Everyone is normal user
      walletBalance: 0,
      totalReferrals: 0,
      referralEarnings: 0,
      totalInvested: 0,
      dailyIncome: 0,
      activePackage: 0,
    });

    // Give referral bonus to referrer (works for everyone including first user)
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { telegramLogin };