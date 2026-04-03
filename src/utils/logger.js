const winston = require("winston");

// Configure Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/app.log" }),
    new winston.transports.Console(),
  ],
});

// Fallback to console if Winston fails
logger.on("error", (error) => {
  console.error("Winston logger error:", error);
});

module.exports = logger;