require("dotenv").config();
const moment = require("moment-timezone");
const nodemailer = require("nodemailer");
const fs = require("fs").promises;
const path = require("path");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_HOST_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendEmail = async (to, subject, templateName, data = {}) => {
  try {
    if (!to || !subject || !templateName) {
      throw new Error(
        "Missing required email parameters (to, subject, templateName)"
      );
    }

    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      `${templateName}.html`
    );
    let html = await fs.readFile(templatePath, "utf-8");

    html = html.replace("[OTP]", data.otp || "N/A");
    html = html.replace("{{username}}", data.username || "User");
    html = html.replace("{{userEmail}}", data.email || "N/A");
    html = html.replace("{{tempPassword}}", data.tempPassword || "N/A");
    html = html.replace("{{adminEmail}}", data.adminEmail || "N/A");
    html = html.replace("{{oldWalletAddress}}", data.oldWalletAddress || "N/A");
    html = html.replace("{{newWalletAddress}}", data.newWalletAddress || "N/A");

    html = html.replace("{{adminEmail}}", data.adminEmail || "support@embot.co");

    html = html.replace("{{amount}}", data.amount || "N/A");
    html = html.replace("{{otp}}", data.otp || "N/A");
    html = html.replace("{{walletAddress}}", data.walletAddress || "N/A");

    html = html.replace("{{user_id}}", data.user_id || "N/A");
    html = html.replace("{{password}}", data.password || "N/A");

    html = html.replace("{{timestamp}}", data.timestamp || moment().tz("Asia/Kolkata").format("HH:mm:ss A, DD MMMM YYYY"));

    html = html.replace(/{{projectName}}/g, process.env.PROJECT_NAME || "urbanrwa.io");
    html = html.replace(/{{supportEmail}}/g, process.env.SUPPORT_EMAIL || "support@urbanrwa.io");
    html = html.replace(/{{websiteLink}}/g, process.env.WEBSITE_URL || "https://urbanrwa.io");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    console.log("Message sent: %s", info.messageId);
    return {
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const sendSupportEmails = async (to, subject, templateName, data = {}) => {
  try {
    if (!to || !subject || !templateName) {
      throw new Error("Missing required email parameters (to, subject, templateName)");
    }

    const templatePath = path.join(__dirname, "..", "templates", `${templateName}.html`);
    let html;
    try {
      html = await fs.readFile(templatePath, "utf-8");
    } catch (fileError) {
      throw new Error(`Template file not found or unreadable: ${templatePath} - ${fileError.message}`);
    }

    // Replace multiple placeholders with data values
    html = html.replace("{{ticketId}}", data.ticketId || "N/A");
    html = html.replace("{{username}}", data.username || "Unknown User");
    html = html.replace("{{userEmail}}", data.userEmail || "N/A");
    html = html.replace("{{name}}", data.name || "N/A");
    html = html.replace("{{phone}}", data.phone || "N/A");
    html = html.replace("{{email}}", data.email || "N/A");
    html = html.replace("{{subject}}", data.subject || "No Subject");
    html = html.replace("{{message}}", data.message || "No Message");
    html = html.replace("{{timestamp}}", data.timestamp || moment().tz("Asia/Kolkata").format("HH:mm:ss A, DD MMMM YYYY"));

    html = html.replace(/{{projectName}}/g, process.env.PROJECT_NAME || "urbanrwa.io");
    html = html.replace(/{{supportEmail}}/g, process.env.SUPPORT_EMAIL || "support@urbanrwa.io");
    html = html.replace(/{{websiteLink}}/g, process.env.WEBSITE_URL || "https://urbanrwa.io");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    console.log("Message sent: %s", info.messageId);
    return {
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = { sendEmail, sendSupportEmails };
