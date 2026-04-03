const jwt = require("jsonwebtoken");
const Admin = require("../../models/Admin");
const redisClient = require("../../config/redisClient");
const AdminLoginLog = require("../../models/AdminLoginLog");
const { sendEmail } = require("../../services/emailService");
const { saveOTP, verifyOTP } = require("../../services/otpService");
const { successResponse, errorResponse } = require("../../utils/responses");
const config = require("../../config/envConfig");

const projectName = process.env.PROJECT_NAME || "UrbanRWA";

const signup = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json(errorResponse("Missing required fields"));
    }

    const existingCount = await Admin.countDocuments({});
    if (existingCount > 0) {
      return res
        .status(400)
        .json(errorResponse("Only one admin account is allowed"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json(errorResponse("Invalid email format"));
    }

    const existingAdmin = await Admin.findOne({ $or: [{ email }] });
    if (existingAdmin) {
      return res.status(400).json(errorResponse("Email already exists"));
    }

    // Set default referredBy and referralCode to 'admin123'
    const admin = new Admin({
      email,
      password,
      referredBy: "admin123",
      referralCode: "admin123",
    });
    await admin.save();

    const otp = await saveOTP(email, "signup");
    await sendEmail(
      email,
      `${projectName} Signup Verification`,
      "signup_verification",
      { otp },
    );

    res
      .status(201)
      .json(successResponse("Admin registered. Please verify OTP", { email }));
  } catch (error) {
    res
      .status(500)
      .json(errorResponse(error.message || "Internal server error"));
  }
};

const verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json(errorResponse("Missing email or OTP"));
    }

    await verifyOTP(email, otp, "signup");
    await Admin.updateOne({ email }, { isEmailVerified: true });
    res.status(200).json(successResponse("Email verified successfully"));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

const login = async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    const normalizedEmail = (email || "").toLowerCase();
    if (!normalizedEmail || !password || !otp) {
      return res
        .status(400)
        .json(errorResponse("Missing email, password, or OTP"));
    }

    // Check admin existence in Redis and MongoDB
    const userKey = `admin:email:${normalizedEmail}`;
    const cachedAdmin = await redisClient.get(userKey);
    let adminData;
    let admin;
    if (cachedAdmin) {
      try {
        adminData = JSON.parse(cachedAdmin);
      } catch (err) {
        adminData = { exists: cachedAdmin === "exists" };
      }
    }

    if (!adminData || !adminData.exists) {
      admin = await Admin.findOne({ email: normalizedEmail });
      if (!admin) {
        return res.status(401).json(errorResponse("Invalid credentials"));
      }
      adminData = { exists: true, isEmailVerified: admin.isEmailVerified };
      await redisClient.set(userKey, JSON.stringify(adminData), { EX: 3600 });
    }

    if (!admin) {
      admin = await Admin.findOne({ email: normalizedEmail });
    }

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json(errorResponse("Invalid credentials"));
    }

    if (!adminData.isEmailVerified) {
      return res.status(403).json(errorResponse("Email not verified"));
    }

    // Verify OTP
    try {
      await verifyOTP(normalizedEmail, otp, "login");
    } catch (error) {
      if (error.message === "Invalid OTP") {
        return res.status(400).json(errorResponse("Invalid OTP"));
      }
      if (error.message === "OTP expired") {
        return res.status(400).json(errorResponse("OTP expired"));
      }
      throw error;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // Enhanced IP address detection
    let ipAddress = req.headers["x-forwarded-for"];
    if (ipAddress) {
      ipAddress = ipAddress.split(",")[0].trim();
    } else {
      ipAddress = req.ip || req.connection.remoteAddress || "Unknown";
    }

    // Store admin login data
    await new AdminLoginLog({
      adminId: admin._id,
      ipAddress,
    }).save();

    res
      .status(200)
      .json(successResponse("Login successful", { token, role: "admin" }));
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json(errorResponse(error.message));
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(errorResponse("Missing email"));
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json(errorResponse("Admin not found"));
    }

    const otp = await saveOTP(email, "reset");
    await sendEmail(email, `${projectName} Password Reset`, "password_reset", {
      otp,
    });

    res.status(200).json(successResponse("OTP sent to email"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

const resendOTP = async (req, res) => {
  try {
    const { email, purpose } = req.body;
    const normalizedEmail = (email || "").toLowerCase();
    const clientIP = req.ip;

    // Early validation
    if (!normalizedEmail || !purpose) {
      return res.status(400).json(errorResponse("Missing email or purpose"));
    }
    const validPurposes = ["signup", "reset", "login"];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json(errorResponse("Invalid purpose"));
    }

    // Rate-limiting with Redis
    const rateLimitKey = `otp:resend:${normalizedEmail}:${purpose}:${clientIP}`;
    const resendCount = await redisClient.get(rateLimitKey);
    if (resendCount && parseInt(resendCount) >= 20) {
      return res
        .status(429)
        .json(
          errorResponse(
            "Too many OTP resend attempts. Please try again later.",
          ),
        );
    }

    // Check user existence (Redis first)
    const userKey = `user:email:${normalizedEmail}`;
    const cachedUser = await redisClient.get(userKey);

    // If not in Redis, check MongoDB
    let user = null;
    if (!cachedUser) {
      console.log("Fetching user from MongoDB for OTP resend");
      console.log("Normalized Email:", normalizedEmail);
      user = await Admin.findOne({ email: normalizedEmail }).lean();
      console.log("User fetched from MongoDB for OTP resend:", user);
      if (!user) {
        return res.status(404).json(errorResponse("Admin not found"));
      }
      // Cache user existence
      await redisClient.set(userKey, "exists", { EX: 3600 });
    }

    // Additional validation using cachedUser or user
    const userData = cachedUser
      ? { isEmailVerified: false, role: "user" }
      : user; // Fallback for Redis-only check
    if (purpose === "signup" && userData.isEmailVerified) {
      return res.status(400).json(errorResponse("Email already verified"));
    }
    if (purpose === "reset" && userData.role !== "user") {
      return res
        .status(403)
        .json(errorResponse("Password reset not allowed for this user"));
    }

    // Generate and save OTP
    const otp = await saveOTP(normalizedEmail, purpose);

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
      await sendEmail(normalizedEmail, subject, template, { otp });
    } catch (err) {
      console.error(`Failed to send ${purpose} OTP email:`, err.message);
      throw new Error("Failed to send OTP email");
    }

    // Increment rate-limit counter
    await Promise.all([
      redisClient.incr(rateLimitKey),
      redisClient.expire(rateLimitKey, 3600),
    ]);

    // res.status(200).json(successResponse(`New OTP sent for ${purpose}`));
    res.status(200).json(successResponse(`New OTP sent for ${purpose}`)); // Include OTP in response for testing (remove in production))
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    res.status(500).json(errorResponse(error.message));
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json(errorResponse("Missing email, OTP, or new password"));
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json(errorResponse("Password must be at least 6 characters long"));
    }

    await verifyOTP(email, otp, "reset");
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json(errorResponse("Admin not found"));
    }

    admin.password = newPassword;
    await admin.save();
    res.status(200).json(successResponse("Password reset successfully"));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

module.exports = {
  signup,
  verifySignupOTP,
  login,
  forgotPassword,
  resendOTP,
  resetPassword,
};
