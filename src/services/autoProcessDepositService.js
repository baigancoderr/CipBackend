const cron = require("node-cron");
const ethers = require("ethers");
const mongoose = require('mongoose');
const Price = require('../models/Price');
const Supply = require('../models/Supply');
const config = require("../config/envConfig");
const crypto = require("crypto");
require("dotenv").config();

// ================== CONFIG ==================
const RPC_URL = "https://mainnet.base.org";  //mainnet base RPC URL daalna hai
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MONITOR_WALLET = "0xc09406EB47781b039129e4a0F7DCE5B12d33Cf12";
// const DISTRIBUTOR_ADDRESS = "0x590bA25539653281Cd18E9eb5BeDa988441C810A"; // Aapka latest contract
const DISTRIBUTOR_ADDRESS = "0xC7877ceD93f48777d14A9cC2A577dC4f95B31fa2";
const POOL_ADDRESS = "0x5100eBE2e02b20FC92CA9339CFDD1C109a16186e";
const CIP_TOKEN_ADDRESS = "0xA02ecbdab079AC207455E8553a75D1e5E4c33115";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";



const decryptPrivateKey = (encryptedPrivateKey, encryptionKey) => {
  try {
    // Ensure inputs are provided
    if (!encryptedPrivateKey || !encryptionKey) {
      throw new Error("Missing encrypted private key or encryption key");
    }

    // Split the encrypted string into iv, salt, and encrypted components
    const [ivHex, saltHex, encryptedHex] = encryptedPrivateKey.split(":");

    if (!ivHex || !saltHex || !encryptedHex) {
      throw new Error("Invalid encrypted private key format");
    }

    // Convert hex strings back to Buffers
    const iv = Buffer.from(ivHex, "hex");
    const salt = Buffer.from(saltHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    // Validate buffer lengths
    if (iv.length !== 16) {
      throw new Error("Invalid IV length");
    }
    if (salt.length < 8) {
      throw new Error("Invalid salt length");
    }
    if (encrypted.length === 0) {
      throw new Error("Empty encrypted data");
    }

    // Derive the same key using PBKDF2
    const key = crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");

    // Create decipher
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    // Decrypt
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

const OWNER_PRIVATE_KEY = decryptPrivateKey(config.ENCRYPTED_PRIVATE_KEY, config.ENCRYPTION_KEY);

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);



// ABIs
const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const DISTRIBUTOR_ABI = [
  {
    "inputs": [
      { "name": "user", "type": "address" },
      { "name": "amount", "type": "uint256" },
      {"name" : "tokenAmount", "type": "uint256"}
    ],
    "name": "processDeposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const CIP_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"   
];

const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
const distributorContract = new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, provider);
const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
const cipContract = new ethers.Contract(CIP_TOKEN_ADDRESS, CIP_ABI, provider);

async function getTotalSupply() {
  try {
    const totalSupplyRaw = await cipContract.totalSupply();
    // 18 decimals assume kiye hain (standard ERC-20)
    const totalSupply = ethers.utils.formatUnits(totalSupplyRaw, 18);


    const burnSupply = 100000000 - Number(totalSupply); // Assuming 100 million total supply for calculation
    
    console.log(`📊 CIP Total burn Supply: ${Number(burnSupply).toLocaleString()} CIP`);
    return { burnSupply: parseFloat(burnSupply), totalSupply: parseFloat(totalSupply) };
  } catch (error) {
    console.error("❌ Error fetching CIP Total Burn Supply:", error.message);
    return { burnSupply: 0, totalSupply: 0 };
  }
}

async function getLiveTokenPrice() {
  try {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // Convert ethers.BigNumber → native BigInt
    const sqrtPriceX96BI = BigInt(sqrtPriceX96.toString());

    // 2^192
    const Q192 = BigInt(2) ** BigInt(192);

    const priceBig = (sqrtPriceX96BI * sqrtPriceX96BI * BigInt(10 ** 6)) / Q192;
    const priceInCIP = Number(priceBig) / 10**18;
    const priceInUSDC = 1 / priceInCIP;

    console.log(`📊 Live Price: 1 CIP = ${priceInUSDC.toFixed(6)} USDC`);
    return priceInUSDC;
  } catch (error) {
    console.error("❌ Error fetching live price:", error.message);
    if (error.stack) console.error(error.stack);
    return 0;
  }
}

async function updateLivePriceInDB() {
  try {
    const livePrice = await getLiveTokenPrice();
    const totalSupply = await getTotalSupply();

    if (!livePrice || livePrice <= 0) {
      console.warn(`[${new Date().toLocaleString()}] ⚠️ Invalid price received, skipping DB update`);
      return null;
    }

    // Use findOneAndUpdate with upsert → creates document if it doesn't exist
    const result = await Price.findOneAndUpdate(
      { currencyType: 'SGN' },                    // ← 'SGN' because you are storing CIP/SGN price in USDC
      {
        price: parseFloat(livePrice.toFixed(8)),  // Store with high precision
        updatedAt: new Date()
      },
      {
        upsert: true,   // Create if not exists
        new: true       // Return the updated document
      }
    );

    // 2. Supply model update (total + burn)
    const supplyResult = await Supply.findOneAndUpdate(
      { currencyType: 'SGN' },
      {
        totalSupply: totalSupply.totalSupply || 0,
        burnSupply: totalSupply.burnSupply || 0,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Live Price saved to MongoDB → 1 SGN = ${livePrice.toFixed(6)} USDC | UpdatedAt: ${result.updatedAt}`);
    return result;

  } catch (error) {
    console.error("❌ Error saving live price to database:", error.message);
    if (error.stack) console.error(error.stack);
    return null;
  }
}

async function checkBalanceAndProcess() {
  try {
    const balance = await usdcContract.balanceOf(MONITOR_WALLET);
    const balanceInUSDC = ethers.utils.formatUnits(balance, 6);

    console.log(`[${new Date().toLocaleString()}] Wallet USDC Balance: ${balanceInUSDC} USDC`);

    if (balance.eq(0)) {
      console.log("No USDC found. Waiting for next cycle...");
      return;
    }

    // ================== LIVE PRICE ==================
    const livePrice = await getLiveTokenPrice();
    if (livePrice <= 0) {
      console.error("❌ Could not fetch live price. Skipping deposit.");
      return;
    }

    // ================== 60% FOR LIQUIDITY ==================
    const liquidityUSDC = balance.mul(60).div(100);

    // ================== CALCULATE CIPERA TOKEN AMOUNT ==================
    const usdcForLiquidity = Number(ethers.utils.formatUnits(liquidityUSDC, 6));
    const cipAmountFloat = usdcForLiquidity / livePrice;
    const tokenAmount = ethers.utils.parseUnits(cipAmountFloat.toFixed(10), 18);

    console.log(`📊 Calculated for deposit:
    → USDC Received     : ${balanceInUSDC}
    → Liquidity USDC    : ${ethers.utils.formatUnits(liquidityUSDC, 6)}
    → CIPERA Price      : ${livePrice.toFixed(8)} USDC
    → CIPERA to add     : ${ethers.utils.formatUnits(tokenAmount, 18)}`);

    // ================== APPROVE IF NEEDED ==================
    const currentAllowance = await usdcContract.allowance(MONITOR_WALLET, DISTRIBUTOR_ADDRESS);
    const signedUSDC = usdcContract.connect(wallet);
    const signedDistributor = distributorContract.connect(wallet);

    console.log(wallet.address, DISTRIBUTOR_ADDRESS);

    if (currentAllowance.lt(balance)) {
      console.log("🔄 Approving USDC...");
      const approveTx = await signedUSDC.approve(DISTRIBUTOR_ADDRESS, ethers.constants.MaxUint256);
      await approveTx.wait();
      console.log("✅ Approve Success!");
    }

    // ================== CALL PROCESS DEPOSIT WITH 3 PARAMETERS ==================
    console.log(`🚀 Calling processDeposit...`);

   const gasEstimate = await signedDistributor.estimateGas.processDeposit(MONITOR_WALLET, balance , tokenAmount);
    const gasPrice = await provider.getGasPrice();

    const tx = await signedDistributor.processDeposit(
      MONITOR_WALLET,
      balance,
      tokenAmount,
      {
      gasLimit: gasEstimate.mul(130).div(100),   // 30% buffer
      gasPrice,
      }
    );

    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`🎉 SUCCESS! Tx Hash: ${receipt.transactionHash}`);

  } catch (error) {
    console.error("❌ Error in auto process deposit:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.transaction) console.error("Transaction Data:", error.transaction);
  }
}







module.exports = {
  checkBalanceAndProcess,
  getTotalSupply,
  getLiveTokenPrice,
  updateLivePriceInDB
};