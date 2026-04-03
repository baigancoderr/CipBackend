const { ethers } = require("ethers");
const config = require("../config/envConfig");

// Ethers Configuration
const provider = new ethers.providers.JsonRpcProvider(config.BSC_RPC_URL);
const usdtAddress = config.USDT_CONTRACT_ADDRESS.toLowerCase(); // BEP20USDT contract address
const usdtABI = [
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const usdtContract = new ethers.Contract(usdtAddress, usdtABI, provider);

// Presale Contract Configuration
const depositContractAddress = config.CONTRACT_ADDRESS.toLowerCase();
const depositABI = [
  "function deposit(uint256 amount) external", // Hypothetical deposit function
  "event Deposit(address indexed user, uint256 amount, bytes32 transactionHash)" // Adjust based on actual event
  // Add other functions/events from your presale contract ABI
];
const presaleContract = new ethers.Contract(depositContractAddress, depositABI, provider);

// Function to Verify USDT Deposit Transaction
async function verifyTransactionHash(transactionHash, userAddress, expectedAmountUSDT) {
  try {
    // Input validation
    if (!ethers.utils.isAddress(userAddress)) {
      return { isValid: false, message: "Invalid user address" };
    }
    if (typeof expectedAmountUSDT !== "number" || expectedAmountUSDT <= 0) {
      return { isValid: false, message: "Invalid amount" };
    }

    // Fetch transaction and receipt
    const tx = await provider.getTransaction(transactionHash);
    if (!tx) {
      return { isValid: false, message: "Transaction hash not found" };
    }

    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      return { isValid: false, message: "Transaction not mined yet" };
    }

    // Check if the transaction targets the deposit contract
    if (tx.to.toLowerCase() !== depositContractAddress) {
      return { isValid: false, message: "Transaction does not target the deposit contract" };
    }

    // Decode the transaction input data using presale ABI
    const depositInterface = new ethers.utils.Interface(depositABI);
    const decodedInput = depositInterface.parseTransaction({ data: tx.data, value: tx.value });

    if (!decodedInput || decodedInput.name !== "deposit") {
      return { isValid: false, message: "Transaction is not a deposit call" };
    }

    // Verify the amount
    const depositAmountInWei = ethers.utils.parseUnits(expectedAmountUSDT.toString(), await usdtContract.decimals());
    if (decodedInput.args[0].toString() !== depositAmountInWei.toString()) {
      return { isValid: false, message: "Deposit amount mismatch" };
    }

    // Verify the sender (userAddress)
    if (tx.from.toLowerCase() !== userAddress.toLowerCase()) {
      return { isValid: false, message: "Sender address mismatch" };
    }

    // Check transaction status
    if (receipt.status !== 1) {
      return { isValid: false, message: "Transaction failed on-chain" };
    }

    // Verify deposit-related events
    let depositEventFound = false;
    let transferEventFound = false;

    for (const log of receipt.logs) {
      try {
        // Check for Deposit event from presale contract
        const presaleParsedLog = presaleContract.interface.parseLog(log);
        if (presaleParsedLog.name === "Deposit" && 
            presaleParsedLog.args.user.toLowerCase() === userAddress.toLowerCase() && 
            presaleParsedLog.args.amount.toString() === depositAmountInWei.toString()) {
          depositEventFound = true;
        }
      } catch (e) {
        // Ignore parsing errors for presale events
      }

      try {
        // Check for Transfer event from USDT contract
        const usdtParsedLog = usdtContract.interface.parseLog(log);
        if (usdtParsedLog.name === "Transfer" && 
            usdtParsedLog.args.from.toLowerCase() === userAddress.toLowerCase() && 
            usdtParsedLog.args.to.toLowerCase() === depositContractAddress && 
            usdtParsedLog.args.value.toString() === depositAmountInWei.toString()) {
          transferEventFound = true;
        }
      } catch (e) {
        // Ignore parsing errors for USDT events
      }
    }

    if (!depositEventFound && !transferEventFound) {
      return { isValid: false, message: "No matching deposit or transfer event found" };
    }

    return { isValid: true, message: "USDT deposit verified successfully" };
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return { isValid: false, message: "Error verifying transaction" };
  }
}

module.exports = { verifyTransactionHash };