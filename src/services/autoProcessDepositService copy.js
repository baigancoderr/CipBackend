const cron = require("node-cron");
const ethers = require("ethers");
const mongoose = require('mongoose');
const Price = require('../models/Price');
const config = require("../config/envConfig");
const crypto = require("crypto");
require("dotenv").config();

// ================== CONFIG ==================
const RPC_URL = "https://sepolia.base.org";
const USDC_ADDRESS = "0x6422C1A6a50E710Ee9321A8069b845597618cfba";
const MONITOR_WALLET = "0x42EC3cf99Bbc169C1d22c70339b5625A993CC033";
const DISTRIBUTOR_ADDRESS = "0x79253197F42Cf34C51D5B91a837CA8bB62fa9BCA"; // Aapka latest contract
const POOL_ADDRESS = "0x0bCDA542F423b31b511CEb47967d6759125E0204";


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

const OWNER_PRIVATE_KEY = decryptPrivateKey(config.OWNER_PRIVATE_KEY, config.ENCRYPTION_KEY);

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
      { "name": "amount", "type": "uint256" }
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

const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
const distributorContract = new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, provider);
const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

async function getLiveTokenPrice() {
  try {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // Convert ethers.BigNumber → native BigInt
    const sqrtPriceX96BI = BigInt(sqrtPriceX96.toString());

    // 2^192
    const Q192 = BigInt(2) ** BigInt(192);

    const priceBig = (sqrtPriceX96BI * sqrtPriceX96BI * BigInt(10 ** 18)) / Q192;
    const priceInUSDC = Number(priceBig) / 1_000_000;

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

    // ================== CHECK CURRENT ALLOWANCE ==================
    const currentAllowance = await usdcContract.allowance(MONITOR_WALLET, DISTRIBUTOR_ADDRESS);
    console.log(`Current Allowance: ${ethers.utils.formatUnits(currentAllowance, 6)} USDC`);

    const signedUSDC = usdcContract.connect(wallet);
    const signedDistributor = distributorContract.connect(wallet);

    // Agar allowance kam hai to automatic approve kar do
    if (currentAllowance.lt(balance)) {
      console.log("🔄 Allowance insufficient → Sending MAX Approve...");

      const approveTx = await signedUSDC.approve(
        DISTRIBUTOR_ADDRESS,
        ethers.constants.MaxUint256,   // Unlimited approve
        { gasLimit: 80000 }
      );

      await approveTx.wait();
      console.log("✅ Approve Success! Tx:", approveTx.hash);
    }

    // ================== NOW CALL PROCESS DEPOSIT ==================
    console.log(`✅ Processing ${balanceInUSDC} USDC...`);

    const gasEstimate = await signedDistributor.estimateGas.processDeposit(MONITOR_WALLET, balance);
    const gasPrice = await provider.getGasPrice();

    const tx = await signedDistributor.processDeposit(MONITOR_WALLET, balance, {
      gasLimit: gasEstimate.mul(130).div(100),   // 30% buffer
      gasPrice,
    });

    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log("🎉 ProcessDeposit SUCCESS! Tx Hash:", receipt.transactionHash);

  } catch (error) {
    console.error("❌ Error in auto process deposit:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.transaction) console.error("Transaction Data:", error.transaction);
  }
}

async function getTotalSupply() {
  try {
    const totalSupplyRaw = await cipContract.totalSupply();
    // 18 decimals assume kiye hain (standard ERC-20)
    const totalSupply = ethers.utils.formatUnits(totalSupplyRaw, 18);
    
    console.log(`📊 CIP Total Supply: ${Number(totalSupply).toLocaleString()} CIP`);
    return parseFloat(totalSupply);
  } catch (error) {
    console.error("❌ Error fetching CIP Total Supply:", error.message);
    return 0;
  }
}



module.exports = {
  checkBalanceAndProcess,
  getTotalSupply,
  getLiveTokenPrice,
  updateLivePriceInDB
};