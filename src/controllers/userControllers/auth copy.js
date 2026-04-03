const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const Admin = require("../../models/Admin");
const OTP = require("../../models/OTP");
const { v4: uuidv4 } = require("uuid");
const { saveOTP, verifyOTP } = require("../../services/otpService");
const { sendEmail } = require("../../services/emailService");
const { successResponse, errorResponse } = require("../../utils/responses");
const redisClient = require("../../config/redisClient");

const projectName = process.env.PROJECT_NAME || "UrbanRWA";

const randomString = (length) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
};

const generateUniqueUsername = async () => {
  const count = await User.countDocuments();

  const counter = count + 1;
  const username = `SGN${String(counter).padStart(5, "0")}`;

  const cachedUser = await redisClient.get(`username:${username}`);
  // if (cachedUser) {
  //   throw new Error("Sequential username already taken");
  // }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    throw new Error("Sequential username already taken");
  }

  await redisClient.set(`username:${username}`, "taken", { EX: 3600 });
  return username;
};

const LEVEL_PERCENTAGES = [
  2.2, 1.3, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2, 0.2, 0.2, 0.15,
  0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
];

// Helper function to fix broken references in a user's left/right
async function fixBrokenRefs(user) {
  if (user.left) {
    const leftChild = await User.findOne({ user_id: user.left });
    if (!leftChild) {
      console.log(`Fixing broken left ref for user ${user.user_id}`);
      user.left = null;
    }
  }
  if (user.right) {
    const rightChild = await User.findOne({ user_id: user.right });
    if (!rightChild) {
      console.log(`Fixing broken right ref for user ${user.user_id}`);
      user.right = null;
    }
  }
  await user.save();
}

const signup = async (req, res) => {
  try {
    let {
      sponsor_id,
      first_name,
      last_name,
      country,
      email,
      mobile_number,
      password,
      repeat_password,
      walletAddress,
    } = req.body;

    if (
      !first_name ||
      !last_name ||
      !country ||
      !email ||
      !password ||
      !repeat_password
    ) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    if (password !== repeat_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const userCount = await User.countDocuments();

    let isAdmin = false;
    let generatedUserId;
    let sponsor = null;
    let parentId;

    if (userCount === 0) {
      // Creating the admin user, ignore provided sponsor_id if any
      isAdmin = true;
      generatedUserId = "SGN00001";
      sponsor_id = null; // or ""
      // No parent
    } else {
      if (!sponsor_id) {
        sponsor_id = "SGN00001";
      }

      sponsor = await User.findOne({ user_id: sponsor_id });
      if (!sponsor) {
        return res.status(400).json({ message: "Invalid sponsor ID" });
      }

      if (!sponsor.isEmailVerified) {
        return res
          .status(400)
          .json({ message: "Sponsor's email is not verified" });
      }

      parentId = sponsor.user_id;

      generatedUserId = await generateUniqueUsername();
    }

    const referralCode = generatedUserId;
    const referredBy = sponsor ? sponsor_id : null;

    const userData = {
      user_id: generatedUserId,
      username: generatedUserId,
      sponsor_id,
      first_name,
      last_name,
      country,
      email: email.toLowerCase(),
      mobile_number,
      password,
      walletAddress: walletAddress || "NA",
      referralCode,
      referredBy,
      isEmailVerified: false,
      verified: false,
      role: "user",
    };

    if (isAdmin) {
      userData.isAdmin = true;
      userData.level = 0;
    } else {
      userData.parent = parentId;
    }
    console.log("Creating user with data:", userData);
    const user = await User.create(userData);

    if (!isAdmin) {
      // Update rank for sponsor (since direct count changed)
      await updateRank(sponsor.user_id);
    }

    // Automatically send signup verification OTP
    const otp = await saveOTP(email, "signup");
    sendEmail(
      email,
      `${projectName} Signup Verification`,
      "signup_verification",
      { otp },
    ).catch((err) => console.error("Email sending failed:", err));

    // Cache user email
    await redisClient.set(`user:email:${email}`, "exists", { EX: 3600 });

    // Send login credentials via email
    sendEmail(email, `${projectName} Account Created`, "account_created", {
      user_id: user.user_id,
      password,
    }).catch((err) =>
      console.error("Email sending failed for credentials:", err),
    );

    const message = isAdmin
      ? "Admin signup successful. Verification OTP sent to your email"
      : "Signup successful. Verification OTP and credentials sent to your email";

    return res.status(201).json({
      message,
      user_id: user.user_id,
      referralCode,
      username: user.username,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Function to update user rank based on conditions
async function updateRank(userUserId) {
  const user = await User.findOne({ user_id: userUserId });
  if (!user || !user.verified) return; // Assume "Active" means verified

  const directCount = await User.countDocuments({ sponsor_id: userUserId });
  const pvSelf = user.pv_self || 0; // Assume pv_self is a field in User model, default 0

  let newRank = "Starter";
  let newCap = 100;

  if (directCount >= 6 && pvSelf >= 100) {
    newRank = "Diamond";
    newCap = 5000;
  } else if (directCount >= 5 && pvSelf >= 50) {
    newRank = "Platinum";
    newCap = 2500;
  } else if (directCount >= 4 && pvSelf >= 20) {
    newRank = "Gold";
    newCap = 1000;
  } else if (directCount >= 3 && pvSelf >= 10) {
    newRank = "Silver";
    newCap = 500;
  } else if (directCount >= 2 && pvSelf >= 5) {
    newRank = "Bronze";
    newCap = 250;
  } else if (directCount >= 1) {
    newRank = "Starter";
    newCap = 100;
  }

  if (newRank !== user.rank || newCap !== user.binary_daily_cap) {
    await User.updateOne(
      { user_id: userUserId },
      { rank: newRank, binary_daily_cap: newCap },
    );
  }
}

const verifySignupOTP = async (req, res) => {
  try {
    const { user_id, otp } = req.body;
    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }
    await verifyOTP(user.email, otp, "signup");
    await User.updateOne({ user_id }, { isEmailVerified: true });
    res.status(200).json(successResponse("Email verified successfully"));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

// const verifySignupOTP = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const DEFAULT_OTP = process.env.DEFAULT_OTP || "123456"; // Configurable default OTP

//     // Check if provided OTP matches the default OTP
//     if (otp === DEFAULT_OTP) {
//       await User.updateOne({ email }, { isEmailVerified: true });
//       return res.status(200).json(successResponse("Email verified successfully using default OTP"));
//     }

//     // Proceed with regular OTP verification
//     await verifyOTP(email, otp, "signup");
//     await User.updateOne({ email }, { isEmailVerified: true });
//     res.status(200).json(successResponse("Email verified successfully"));
//   } catch (error) {
//     res.status(400).json(errorResponse(error.message));
//   }
// };

const login = async (req, res) => {
  try {
    const { user_id, password, otp } = req.body;

    // Check user existence
    const cachedUser = await redisClient.get(`user:user_id:${user_id}`);
    let user;
    if (cachedUser) {
      user = await User.findOne({ user_id });
    } else {
      user = await User.findOne({ user_id });
      if (user) {
        await redisClient.set(`user:user_id:${user_id}`, "exists", {
          EX: 3600,
        });
      }
    }

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json(errorResponse("Invalid credentials"));
    }

    if (!user.isEmailVerified) {
      return res.status(403).json(errorResponse("Email not verified"));
    }

    // Verify OTP
    try {
      await verifyOTP(user.email, otp, "login");
    } catch (error) {
      if (error.message === "Invalid OTP") {
        return res.status(400).json(errorResponse("Invalid OTP"));
      }
      if (error.message === "OTP expired") {
        return res.status(400).json(errorResponse("OTP expired"));
      }
      throw error; // Re-throw unexpected errors
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res
      .status(200)
      .json(successResponse("Login successful", { token, role: user.role }));
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { user_id } = req.body;
    const cachedUser = await redisClient.get(`user:user_id:${user_id}`);
    let user;
    if (cachedUser) {
      user = await User.findOne({ user_id, role: "user" });
    } else {
      user = await User.findOne({ user_id, role: "user" });
      if (user) {
        await redisClient.set(`user:user_id:${user_id}`, "exists", {
          EX: 3600,
        });
      }
    }

    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    const otp = await saveOTP(user.email, "reset");
    await sendEmail(
      user.email,
      `${projectName} Password Reset`,
      "password_reset",
      { otp },
    );

    res.status(200).json(successResponse("OTP sent to email"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const resetPassword = async (req, res) => {
  try {
    const { user_id, otp, newPassword } = req.body;
    const user = await User.findOne({ user_id, role: "user" });
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }
    await verifyOTP(user.email, otp, "reset");
    user.password = newPassword;
    await user.save();
    res.status(200).json(successResponse("Password reset successfully"));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

const resendOTP = async (req, res) => {
  try {
    const { user_id, purpose } = req.body;
    const clientIP = req.ip;

    // Early validation
    if (!user_id || !purpose) {
      return res.status(400).json(errorResponse("Missing user_id or purpose"));
    }
    const validPurposes = ["signup", "reset", "login"];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json(errorResponse("Invalid purpose"));
    }

    // Rate-limiting with Redis
    const rateLimitKey = `otp:resend:${user_id}:${purpose}:${clientIP}`;
    const resendCount = await redisClient.get(rateLimitKey);
    if (resendCount && parseInt(resendCount) >= 30) {
      return res
        .status(429)
        .json(
          errorResponse(
            "Too many OTP resend attempts. Please try again later.",
          ),
        );
    }

    // Check user existence (Redis first)
    const userKey = `user:user_id:${user_id}`;
    const cachedUser = await redisClient.get(userKey);

    // If not in Redis, check MongoDB
    let user = null;
    if (!cachedUser) {
      user = await User.findOne({ user_id }).lean();
      if (!user) {
        return res.status(404).json(errorResponse("User not found"));
      }
      // Cache user existence
      await redisClient.set(userKey, "exists", { EX: 3600 });
    } else {
      user = await User.findOne({ user_id }).lean();
    }

    // Additional validation using user
    if (purpose === "signup" && user.isEmailVerified) {
      return res.status(400).json(errorResponse("Email already verified"));
    }
    if (purpose === "reset" && user.role !== "user") {
      return res
        .status(403)
        .json(errorResponse("Password reset not allowed for this user"));
    }

    // Generate and save OTP
    const otp = await saveOTP(user.email, purpose);

    // Email configuration
    const emailConfig = {
      signup: {
        subject: `${projectName} Signup Verification`,
        template: "signup_verification",
      },
      reset: {
        subject: `${projectName} Password Reset`,
        template: "password_reset",
      },
      login: {
        subject: `${projectName} Login Verification`,
        template: "login_verification",
      },
    };
    const { subject, template } = emailConfig[purpose];

    // Send email (single attempt for speed)
    try {
      await sendEmail(user.email, subject, template, { otp });
    } catch (err) {
      console.error(`Failed to send ${purpose} OTP email:`, err.message);
      throw new Error("Failed to send OTP email");
    }

    // Increment rate-limit counter
    await Promise.all([
      redisClient.incr(rateLimitKey),
      redisClient.expire(rateLimitKey, 3600),
    ]);

    res.status(200).json(successResponse(`New OTP sent for ${purpose}`));
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  signup,
  verifySignupOTP,
  login,
  forgotPassword,
  resetPassword,
  resendOTP,
};
