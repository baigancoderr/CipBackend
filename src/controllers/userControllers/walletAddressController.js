const User = require("../../models/User");
const WalletAddress = require("../../models/WalletAddress");
const { successResponse, errorResponse } = require("../../utils/responses");
const { saveOTP, verifyOTP } = require('../../services/otpService');
const { sendEmail } = require("../../services/emailService");

const projectName = process.env.PROJECT_NAME || "URWA";

// ==================== 1. SEND OTP FOR WALLET ADDRESS UPDATE ====================
const sendWalletUpdateOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));
    const otp = await saveOTP(user.email, "wallet_update");

    await sendEmail(
      user.email,
      `${projectName} - Wallet Address Update OTP`,
      "wallet_update_otp",
      {
        projectName,
        name: `${user.first_name} ${user.last_name}`,
        otp: otp
      }
    );

    console.log(`[Wallet OTP Sent] ${user.email} → ${otp}`);

    res.status(200).json(
      successResponse("OTP sent successfully to your registered email for wallet address update")
    );
  } catch (error) {
    console.error("Send Wallet Update OTP Error:", error.message);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== 2. UPDATE WALLET ADDRESS — ONE TIME ONLY (Fixed with verifyOTP) ====================
// ==================== 2. UPDATE WALLET ADDRESS — ONE TIME ONLY ====================
const updateWalletAddress = async (req, res) => {
  try {
    const { otp, walletAddress, remark } = req.body;

    if (!otp || !walletAddress) {
      return res.status(400).json(errorResponse("otp and walletAddress are required"));
    }

    if (!walletAddress.startsWith("0x") || walletAddress.length < 42) {
      return res.status(400).json(errorResponse("Invalid wallet address format (must start with 0x)"));
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // Verify OTP
    try {
      await verifyOTP(user.email, otp, "wallet_update");
    } catch (otpError) {
      if (otpError.message === "Invalid OTP") {
        return res.status(400).json(errorResponse("Invalid OTP. Please check and try again."));
      }
      if (otpError.message === "OTP expired") {
        return res.status(400).json(errorResponse("OTP expired. Please request a new OTP."));
      }
      return res.status(400).json(errorResponse(otpError.message));
    }

    // 🔥 Special Logic as per your requirement
    const currentWallet = (user.walletAddress || "").trim();

    // Allow update only if current value is "NA", empty, or not a valid wallet
    const isFirstUpdate = currentWallet === "" || 
                         currentWallet.toUpperCase() === "NA" || 
                         !currentWallet.startsWith("0x");

    if (!isFirstUpdate) {
      return res.status(400).json(errorResponse("Wallet address can be updated only once. It has already been set."));
    }

    // Update wallet address
    user.walletAddress = walletAddress.trim();
    await user.save();

    // Save history
    const walletHistory = new WalletAddress({
      user: user._id,
      user_id: user.user_id,
      walletAddress: user.walletAddress,
      updatedBy: user._id,
      remark: remark || "First time wallet address update via OTP",
    });

    await walletHistory.save();

    res.status(200).json(
      successResponse("Wallet address updated successfully (This is a one-time update)", {
        user_id: user.user_id,
        previousWallet: currentWallet || "NA",
        newWalletAddress: user.walletAddress,
        updatedAt: new Date(),
        note: "You cannot update wallet address again in future"
      })
    );
  } catch (error) {
    console.error("Update Wallet Address Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== 3. GET MY WALLET ADDRESS ====================
const getMyWalletAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("user_id walletAddress");

    if (!user) return res.status(404).json(errorResponse("User not found"));

    const latestHistory = await WalletAddress.findOne({ user: user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(
      successResponse("Wallet address retrieved successfully", {
        user_id: user.user_id,
        currentWalletAddress: user.walletAddress || null,
        isUpdated: !!(user.walletAddress && user.walletAddress.trim() !== ""),
        lastUpdated: latestHistory ? latestHistory.createdAt : null,
        totalUpdates: await WalletAddress.countDocuments({ user: user._id }),
      })
    );
  } catch (error) {
    console.error("Get My Wallet Address Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== 4. GET ALL WALLET ADDRESSES (Admin Only) ====================
const getAllWalletAddresses = async (req, res) => {
  try {
    const { user_id, startDate, endDate, page = 1, limit = 20 } = req.query;

    const matchQuery = {};

    if (user_id) matchQuery.user_id = user_id;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const walletList = await WalletAddress.find(matchQuery)
      .populate("user", "first_name last_name email")
      .populate("updatedBy", "user_id first_name last_name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const formattedList = walletList.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    const totalRecords = await WalletAddress.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.status(200).json(
      successResponse("All wallet addresses retrieved successfully", {
        history: formattedList,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get All Wallet Addresses Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  sendWalletUpdateOTP,
  updateWalletAddress,
  getMyWalletAddress,
  getAllWalletAddresses,
};