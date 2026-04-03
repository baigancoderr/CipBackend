const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");
const User = require("../../models/User");
const { successResponse, errorResponse } = require("../../utils/responses");

// ==================== ENCRYPTION CONFIG ====================
const ENCRYPTION_KEY = process.env.TWOFA_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error("❌ ERROR: TWOFA_ENCRYPTION_KEY must be a 64-character hex string in .env");
  process.exit(1); // Stop server if key is missing
}

const IV_LENGTH = 16;

// ==================== ENCRYPT / DECRYPT (Backward Compatible) ====================
const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decrypt = (text) => {
  if (!text) return null;

  // Legacy support: If no ":" → it's old plain secret (before encryption)
  if (!text.includes(":")) {
    console.log("🔄 Using legacy plain 2FA secret (one-time migration recommended)");
    return text;
  }

  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");

    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("Decryption failed:", err.message);
    throw new Error("Failed to decrypt 2FA secret");
  }
};

// ==================== GET 2FA STATUS ====================
const get2FAStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("twoFactorEnabled");
    if (!user) return res.status(404).json(errorResponse("User not found"));

    res.status(200).json(
      successResponse("2FA status retrieved successfully", {
        enabled: user.twoFactorEnabled,
      })
    );
  } catch (error) {
    console.error("Get 2FA Status Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== GENERATE 2FA ====================
const generate2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse("User not found"));

    if (user.twoFactorEnabled) {
      return res.status(400).json(errorResponse("2FA is already enabled"));
    }

    const secret = speakeasy.generateSecret({
      name: `UrbanRWA (${user.email || user.user_id})`,
      length: 20,
    });

    // Always encrypt new secret
    const encryptedSecret = encrypt(secret.base32);
    user.twoFactorSecret = encryptedSecret;
    await user.save();

    const otpauthUrl = secret.otpauth_url;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.status(200).json(
      successResponse("Scan this QR code in Google Authenticator / Authy", {
        secret: secret.base32,   // Only shown once for manual entry
        qrCode: qrCodeDataUrl,
        otpauthUrl,
      })
    );
  } catch (error) {
    console.error("Generate 2FA Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== VERIFY & ENABLE 2FA ====================
const verify2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json(errorResponse("Valid 6-digit code is required"));
    }

    const user = await User.findById(req.user.id).select("+twoFactorSecret");
    if (!user) return res.status(404).json(errorResponse("User not found"));

    if (!user.twoFactorSecret) {
      return res.status(400).json(errorResponse("Please generate 2FA first"));
    }

    const decryptedSecret = decrypt(user.twoFactorSecret);

    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json(errorResponse("Invalid code. Please try again"));
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.status(200).json(successResponse("2FA enabled successfully! 🎉"));
  } catch (error) {
    console.error("Verify 2FA Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== DISABLE 2FA ====================
const disable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json(errorResponse("Valid 6-digit code is required to disable 2FA"));
    }

    const user = await User.findById(req.user.id).select("+twoFactorSecret twoFactorEnabled");
    if (!user) return res.status(404).json(errorResponse("User not found"));

    if (!user.twoFactorEnabled) {
      return res.status(400).json(errorResponse("2FA is not enabled"));
    }

    const decryptedSecret = decrypt(user.twoFactorSecret);

    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json(errorResponse("Invalid code"));
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.status(200).json(successResponse("2FA disabled successfully"));
  } catch (error) {
    console.error("Disable 2FA Error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  decrypt,
  get2FAStatus,
  generate2FA,
  verify2FA,
  disable2FA,
};