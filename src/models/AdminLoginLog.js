const mongoose = require("mongoose");

const adminLoginLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
 ref: "Admin",
    required: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  loginTime: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

module.exports = mongoose.model("AdminLoginLog", adminLoginLogSchema);