const User = require("../../models/User");
const KYC = require("../../models/KYC");
const { successResponse, errorResponse } = require("../../utils/responses");

// ==================== SUBMIT KYC - ONE TIME ONLY ====================
const submitKYC = async (req, res) => {
  try {
    const {
      firstNameAsPerID,
      lastNameAsPerID,
      DateOfBirth,
      Address,
      governmentIdType,
      governmentIdNumber,
      governmentIdFront,
      governmentIdBack,
      signatureImage,
    } = req.body;

    // Validation
    if (!firstNameAsPerID || !lastNameAsPerID) {
      return res.status(400).json(errorResponse("First Name and Last Name as per ID are required"));
    }
    if (!governmentIdType || !governmentIdNumber) {
      return res.status(400).json(errorResponse("Government ID Type and Number are required"));
    }
    if (!governmentIdFront) {
      return res.status(400).json(errorResponse("Government ID Front is required"));
    }
    if (!signatureImage) {
      return res.status(400).json(errorResponse("Signature image is required"));
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // Existing KYC check (same as before)
    const existingKYC = await KYC.findOne({ user: user._id });
    if (existingKYC) {
      if (existingKYC.status === "pending") {
        return res.status(400).json(errorResponse("KYC is already submitted and under review"));
      }
      if (existingKYC.status === "approved") {
        return res.status(400).json(errorResponse("KYC is already approved. You cannot submit again."));
      }
    }

    // Create KYC with Pinata URLs
    const newKYC = new KYC({
      user: user._id,
      submittedBy: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      firstNameAsPerID,
      lastNameAsPerID,
      dateOfBirthAsPerID: DateOfBirth ? new Date(DateOfBirth) : undefined,
      addressAsPerID: Address || undefined,
      governmentIdType,
      governmentIdNumber,
      governmentIdFront,      // ← now URL string from frontend
      governmentIdBack,       // ← optional URL
      signatureImage,         // ← URL string
      status: "pending",
    });

    await newKYC.save();

    user.kyc = newKYC._id;
    user.kycStatus = "pending";
    await user.save();

    res.status(200).json(
      successResponse("KYC submitted successfully. Waiting for admin approval", {
        kycId: newKYC._id,
        governmentIdFront,
        governmentIdBack,
        signatureImage,
        submittedAt: newKYC.submittedAt,
      })
    );
  } catch (error) {
    console.error("Submit KYC Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getMyKYC = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    // Use reference stored on User model (safest when multiple KYC records exist)
    let kyc = null;
    if (user.kyc) {
      kyc = await KYC.findById(user.kyc)
        .select("-__v")
        .lean();
    }

    if (!kyc) {
      return res.status(200).json(
        successResponse("No KYC submitted yet", { hasKYC: false })
      );
    }

    res.status(200).json(
      successResponse("KYC details retrieved successfully", {
        hasKYC: true,
        kyc: {
          kycId: kyc._id,
          status: kyc.status,
          firstNameAsPerID: kyc.firstNameAsPerID,
          lastNameAsPerID: kyc.lastNameAsPerID,
          dateOfBirthAsPerID: kyc.dateOfBirthAsPerID,
          addressAsPerID: kyc.addressAsPerID,
          governmentIdType: kyc.governmentIdType,
          governmentIdNumber: kyc.governmentIdNumber,
          governmentIdFront: kyc.governmentIdFront,
          governmentIdBack: kyc.governmentIdBack,
          signatureImage: kyc.signatureImage,
          submittedAt: kyc.submittedAt,
          verifiedAt: kyc.verifiedAt,
          rejectionReason: kyc.rejectionReason,
        },
      })
    );
  } catch (error) {
    console.error("Get My KYC Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== GET ALL KYC (For Admin) ====================
const getAllKYC = async (req, res) => {
  try {
    const { 
      status, 
      user_id, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10 
    } = req.query;

    const matchQuery = {};

    if (status) matchQuery.status = status;
    if (user_id) matchQuery["submittedBy.user_id"] = user_id;

    if (startDate || endDate) {
      matchQuery.submittedAt = {};
      if (startDate) matchQuery.submittedAt.$gte = new Date(startDate);
      if (endDate) matchQuery.submittedAt.$lte = new Date(endDate);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const kycList = await KYC.find(matchQuery)
      .populate("user", "user_id first_name last_name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalRecords = await KYC.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const formattedList = kycList.map((item, index) => ({
      sr: skip + index + 1,
      ...item,
    }));

    res.status(200).json(
      successResponse("KYC records retrieved successfully", {
        history: formattedList,
        currentPage: pageNum,
        totalPages,
        totalRecords,
        appliedFilters: {
          status: status || null,
          user_id: user_id || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      })
    );
  } catch (error) {
    console.error("Get All KYC Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== VERIFY KYC (Admin Only) ====================
const verifyKYC = async (req, res) => {
  try {
    const { kycId, status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json(errorResponse("Status must be approved or rejected"));
    }

    const kyc = await KYC.findById(kycId).populate("user");
    if (!kyc) return res.status(404).json(errorResponse("KYC record not found"));

    if (kyc.status === "approved") {
      return res.status(400).json(errorResponse("KYC is already approved. Cannot change status."));
    }

    kyc.status = status;
    kyc.verifiedAt = new Date();
    kyc.verifiedBy = req.user.id;

    if (status === "rejected") {
      kyc.rejectionReason = rejectionReason || "KYC rejected by admin";
    }

    await kyc.save();

    const user = kyc.user;
    user.kycStatus = status;
    await user.save();

    res.status(200).json(
      successResponse(`KYC ${status} successfully`, {
        user_id: user.user_id,
        kycId: kyc._id,
        status: kyc.status,
        firstNameAsPerID: kyc.firstNameAsPerID,
        lastNameAsPerID: kyc.lastNameAsPerID,
      })
    );
  } catch (error) {
    console.error("Verify KYC Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

const getMyKYCHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const kycList = await KYC.find({ user: req.user.id })
      .select("-__v")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalRecords = await KYC.countDocuments({ user: req.user.id });
    const totalPages = Math.ceil(totalRecords / limitNum);

    const formattedList = kycList.map((item, index) => ({
      sr: skip + index + 1,
      kycId: item._id,
      status: item.status,
      rejectionReason: item.rejectionReason || null,
      firstNameAsPerID: item.firstNameAsPerID,
      lastNameAsPerID: item.lastNameAsPerID,
      governmentIdType: item.governmentIdType,
      governmentIdNumber: item.governmentIdNumber,
      governmentIdFront: item.governmentIdFront,
      governmentIdBack: item.governmentIdBack,
      signatureImage: item.signatureImage,
      submittedAt: item.submittedAt,
      verifiedAt: item.verifiedAt,
    }));

    res.status(200).json(
      successResponse("Your complete KYC history retrieved successfully", {
        hasKYC: totalRecords > 0,
        history: formattedList,
        currentPage: pageNum,
        totalPages,
        totalRecords,
      })
    );
  } catch (error) {
    console.error("Get My KYC History Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  submitKYC,
  getMyKYC, 
 getMyKYCHistory,      
  getAllKYC,
  verifyKYC,
};