const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Snapshot of user's profile at the time of submission
    submittedBy: {
      user_id: { type: String, required: true },
      first_name: { type: String, required: true },
      last_name: { type: String, required: true },
    },

    // Details AS PER GOVERNMENT ID (matches current frontend)
    firstNameAsPerID: { type: String, required: true },
    lastNameAsPerID: { type: String, required: true },
    dateOfBirthAsPerID: { type: Date },

    // Changed to String to match frontend (Address) and backend payload
    addressAsPerID: { type: String },

    // Government ID Proof (IPFS URLs from Pinata)
    governmentIdFront: { type: String, required: true },
    governmentIdBack: { type: String },
    signatureImage: { type: String, required: true },

    governmentIdType: {
      type: String,
      required: true,
      enum: [
        "Government_ID",
        "Passport",
        "DrivingLicense",
        "Voter_ID",
        "Other",
      ],
    },
    governmentIdNumber: { type: String, required: true },

    // For any additional documents in future
    kycDocuments: [{ type: String }],

    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Admin & Timestamp fields
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

// Useful indexes
kycSchema.index({ user: 1, status: 1 });
kycSchema.index({ submittedAt: -1 });

module.exports = mongoose.model("KYC", kycSchema);