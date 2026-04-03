const { config } = require("dotenv");
const { drizzle } = require("drizzle-orm/libsql");

config({ path: ".env" }); // or .env.local

const tradeDb = drizzle({
  connection: {
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});

module.exports = { tradeDb };
