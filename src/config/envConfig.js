require('dotenv').config();
// const WITHDRAW_CONTRACT_ABI = require('./withdrawAbi_mainnet').WITHDRAW_CONTRACT_ABI;
// const USDT_CONTRACT_ABI = require('./usdtAbi_mainnet').USDT_CONTRACT_ABI;

const WITHDRAW_CONTRACT_ABI = require('./withdrawAbi_testnet').WITHDRAW_CONTRACT_ABI;
const USDT_CONTRACT_ABI = require('./usdtAbi_testnet').USDT_CONTRACT_ABI;
const CIP_CONTRACT_ABI = require('./cipAbi_testnet').CIP_CONTRACT_ABI;

const config = {
  PORT: Number(process.env.PORT) || 5000, 
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret', 
  EMAIL_USER: process.env.EMAIL_USER || 'default@example.com', 
  EMAIL_PASS: process.env.EMAIL_PASS || 'default-password',
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://default-rpc-url.com',
  SWAP_CHARGE: Number(process.env.SWAP_CHARGE) || 5, 
  TRANSACTION_CHARGE: Number(process.env.TRANSACTION_CHARGE) || 10, 
  DEFAULT_ADMIN_REFERRAL: process.env.DEFAULT_ADMIN_REFERRAL || 'ADMIN_123',
  CAP: Number(process.env.CAP) || 2,
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.example.com',
  EMAIL_HOST_PORT: Number(process.env.EMAIL_HOST_PORT) || 465,
  EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
  EMAIL_FROM: process.env.EMAIL_FROM || 'no-reply@example.com',
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://default-rpc-url.com',
  USDT_CONTRACT_ADDRESS: process.env.USDT_CONTRACT_ADDRESS || '',
  CIP_CONTRACT_ADDRESS: process.env.CIP_CONTRACT_ADDRESS || '',

  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '',
  WITHDRAW_CONTRACT_ADDRESS: process.env.WITHDRAW_CONTRACT_ADDRESS || '',
  WITHDRAW_CONTRACT_ABI,
  USDT_CONTRACT_ABI,
  CIP_CONTRACT_ABI,
  OWNER_PRIVATE_KEY: process.env.OWNER_PRIVATE_KEY || '',
  ENCRYPTED_PRIVATE_KEY: process.env.ENCRYPTED_PRIVATE_KEY,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  MIN_WITHDRAWAL_AMOUNT: 5,
  AUTO_WITHDRAWAL_LIMIT: 500,

};

if (isNaN(config.PORT) || config.PORT <= 0 || config.PORT > 65535) {
  throw new Error('Invalid PORT in environment variables');
}
if (!config.MONGO_URI || typeof config.MONGO_URI !== 'string') {
  throw new Error('Invalid MONGO_URI in environment variables');
}
if (!config.JWT_SECRET || typeof config.JWT_SECRET !== 'string') {
  throw new Error('Invalid JWT_SECRET in environment variables');
}
if (!config.EMAIL_USER || typeof config.EMAIL_USER !== 'string') {
  throw new Error('Invalid EMAIL_USER in environment variables');
}
if (!config.EMAIL_PASS || typeof config.EMAIL_PASS !== 'string') {
  throw new Error('Invalid EMAIL_PASS in environment variables');
}
if (!config.BSC_RPC_URL || typeof config.BSC_RPC_URL !== 'string') {
  throw new Error('Invalid BSC_RPC_URL in environment variables');
}
if (isNaN(config.SWAP_CHARGE) || config.SWAP_CHARGE < 0 || config.SWAP_CHARGE > 100) {
  throw new Error('Invalid SWAP_CHARGE in environment variables (must be 0-100%)');
}
if (isNaN(config.TRANSACTION_CHARGE) || config.TRANSACTION_CHARGE < 0 || config.TRANSACTION_CHARGE > 100) {
  throw new Error('Invalid TRANSACTION_CHARGE in environment variables (must be 0-100%)');
}

module.exports = config;