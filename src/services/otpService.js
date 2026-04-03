const OTP = require('../models/OTP');
const redisClient = require('../config/redisClient');



const saveOTP = async (email, purpose) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  const normalizedEmail = email.toLowerCase();

  // Delete existing OTPs for the same email and purpose
  await OTP.deleteMany({ email: normalizedEmail, type: purpose });
  await redisClient.del(`otp:${normalizedEmail}:${purpose}`);

  // Create new OTP document
  const otpDoc = new OTP({
    email: normalizedEmail,
    otp,
    type: purpose,
    expiresAt,
  });

  // Save to MongoDB and Redis concurrently
  await Promise.all([
    otpDoc.save(),
    redisClient.set(`otp:${normalizedEmail}:${purpose}`, otp, { EX: 600 }), // 10 minutes
  ]);

  console.log(`OTP saved for ${normalizedEmail} with purpose ${purpose}: ${otp}`);
  return otp;
};

const verifyOTP = async (email, otp, purpose) => {
  const normalizedEmail = email.toLowerCase();
  const redisKey = `otp:${normalizedEmail}:${purpose}`;

  // Check Redis first
  const storedOTPRedis = await redisClient.get(redisKey);
  if (storedOTPRedis && storedOTPRedis === otp) {
    await Promise.all([
      redisClient.del(redisKey),
      OTP.deleteOne({ email: normalizedEmail, type: purpose, otp }),
    ]);
    return;
  }

  // Check MongoDB
  const otpDoc = await OTP.findOne({ email: normalizedEmail, type: purpose, otp });
  if (!otpDoc) {
    throw new Error("Invalid OTP");
  }
  if (otpDoc.expiresAt < new Date()) {
    throw new Error("OTP expired");
  }

  // Clean up after successful verification
  await Promise.all([
    redisClient.del(redisKey),
    OTP.deleteOne({ _id: otpDoc._id }),
  ]);
};

module.exports = {saveOTP, verifyOTP };