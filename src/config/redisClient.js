const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD, // Add if authentication is required
  tls: process.env.REDIS_TLS === "true" ? {} : undefined, // Enable TLS if needed
  connectTimeout: 30000, // Increase timeout to 30 seconds
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message, {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    stack: err.stack,
  });
});

redisClient.on("connect", () => {
  console.log("Redis Client connected successfully");
});

redisClient.on("end", () => {
  console.log("Redis Client connection ended");
});

(async () => {
  try {
    await redisClient.connect();
    console.log("Redis Client initialized successfully");
  } catch (err) {
    console.error("Failed to initialize Redis Client:", err.message, {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      stack: err.stack,
    });
  }
})();

module.exports = redisClient;