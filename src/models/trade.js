const { int, real, sqliteTable, text } = require("drizzle-orm/sqlite-core");

const arbitrageTable = sqliteTable("arbitrage", {
  id: int("id").primaryKey().notNull(),
  exBuy: text("exBuy").notNull(),
  buyPrice: real("buyPrice").notNull(),
  exSell: text("exSell").notNull(),
  sellPrice: real("sellPrice").notNull(),
  ticker: text("ticker").notNull(),
  amountBuy: real("amountBuy").notNull(),
  amountSell: real("amountSell").notNull(),
  profit: real("profit").notNull(),
  withdrawalFees: real("withdrawalFees").notNull(),
  profitAfterFees: real("profitAfterFees").notNull(),
  profitPercentage: real("profitPercentage").notNull(),
  profitPercentageAfterFees: real("profitPercentageAfterFees").notNull(),
  tradedAt: int("tradedAt").notNull(),
});

const balanceTable = sqliteTable("balance", {
  id: int("id").primaryKey().notNull(),
  amount: real("amount").notNull(),
  deposit: real("deposit"),
  withdrawal: real("withdrawal"),
  updated_at: int("updated_at").notNull(),
});

const profitWithdrawalTable = sqliteTable("profitwithdrawal", {
  id: int("id").primaryKey().notNull(),
  amount: real("amount").notNull(),
  created_at: int("created_at").notNull(),
});

module.exports = {
  arbitrageTable,
  balanceTable,
  profitWithdrawalTable,
};
