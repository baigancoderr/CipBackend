// controllers/depositController.js
const User = require('../../models/User');
const Deposit = require('../../models/Deposit');
const axios = require('axios');
const { successResponse, errorResponse } = require('../../utils/responses');

// Environment variables (add to your .env)
const FINTOLITE_BASE_URL = 'https://apiv2.fintolite.com';
const CALLBACK_URL = 'https://backendapi.urbanrwa.io/user/deposit/callback'; 
// const CALLBACK_URL = 'https://testbackendapi.urbanrwa.io/user/deposit/callback'; 
// const CALLBACK_URL = 'https://aetherswift-paymentgateway-callback.onrender.com/callback'; 

// ==================== 1. Create Payment & Get QR Code ====================
const createQrDeposit = async (req, res) => {
  try {
    const { amount_usd, currency } = req.body;
    const userId = req.user.id;

    if (!currency || !['USDT', 'URWA'].includes(currency)) {
      return res.status(400).json(errorResponse('Invalid currency. Must be USDT or URWA'));
    }

    if (!amount_usd || amount_usd < 1) {
      return res.status(400).json(errorResponse('Minimum deposit amount is $1'));
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json(errorResponse('User not found'));

    const walletAddress = '0x9045Dd36a8B60F4419Ca8110a9761068BA677Eaa'; // client
    // const walletAddress = '0x6349e9d6BFd356e91a95F66770d2781f8c836B96'; // client

    // Create pending deposit first to get _id
    const newDeposit = await Deposit.create({
      userId: user._id,
      user_id: user.user_id,
      amount: amount_usd,
      currency: currency,
      transactionHash: 'N/A',
      walletType: 'deposit',
      paymentId: 'N/A', // Will update if needed
      status: 'pending',
      transactionType: 'qr_deposit',
      walletAddress: walletAddress // Temporary, update if needed
    });

    const payload = {
      address: walletAddress,
      blockchain: 'bsc',
      currency: currency,
      callback_url: `${CALLBACK_URL}?depositId=${newDeposit._id}`,
      post: 1
    };

    const response = await axios.get(`${FINTOLITE_BASE_URL}/payment/create`, { params: payload });

    if (!response.data || !response.data.address_in) {
      await Deposit.deleteOne({ _id: newDeposit._id }); // Cleanup on failure
      return res.status(500).json(errorResponse('Failed to create payment session'));
    }

    // Update deposit with payment details
    newDeposit.paymentId = response.data.paymentId || 'N/A';
    newDeposit.walletAddress = response.data.address_in;
    await newDeposit.save();

    res.status(200).json(successResponse('QR Code generated successfully', {
      address_in: response.data.address_in,
      amount: amount_usd,
      address: walletAddress
    }));
  } catch (error) {
    console.error('QR Deposit Error:', error.response?.data || error.message);
    res.status(500).json(errorResponse('Payment initiation failed'));
  }
};

// ==================== 2. Callback from Fintolite (Webhook) ====================
const paymentCallback = async (req, res) => {
  try {
    const data = req.body.data; // Base64 encoded data

    if (!data) return res.status(400).json({ message: 'No data received' });

    // Decode base64
    const decoded = Buffer.from(data, 'base64').toString();
    const paymentInfo = JSON.parse(decoded);

     console.log('Callback data:', paymentInfo);

    const {
      depositId,
      paymentId,
      status,
      transaction_hash,
      sent_amount,
      value,
      fee,
      address_in
    } = paymentInfo;

    if (status !== 'confirmed' && status !== 'completed') {
      return res.status(200).json({ message: 'Payment not confirmed yet' });
    }

    const deposit = await Deposit.findById(depositId);
    console.log('Deposit record:', deposit);
    if (!deposit || deposit.status !== 'pending') {
      return res.status(200).json({ message: 'Deposit already processed or invalid' });
    }

    const userRecord = await User.findById(deposit.userId);
    if (!userRecord) return res.status(404).json({ message: 'User not found' });

    // Parse values as numbers safely
    const parsedSentAmount = Number(sent_amount) || 0;
    const parsedFee = Number(fee) || 0;
    const parsedValue = Number(value) || 0;

    const amountToCredit = parsedSentAmount + parsedFee || parsedValue;

    if (isNaN(amountToCredit)) {
      throw new Error('Invalid amount to credit: NaN detected');
    }

    // Credit user deposit wallet
    userRecord.depositWallet.amount += amountToCredit;
    await userRecord.save();

    // Update deposit record
    deposit.status = 'completed';
    deposit.amount = amountToCredit;
    deposit.transactionHash = transaction_hash;
    deposit.fee = fee;
    deposit.amountReceived = amountToCredit;
    await deposit.save();

    console.log(`✅ Deposit successful: $${amountToCredit} credited to user ${userRecord.user_id}`);

    res.status(200).json({ message: 'Callback received successfully' });
  } catch (error) {
    console.error('Callback Error:', error.message);
    res.status(500).json({ message: 'Callback processing failed' });
  }
};

module.exports = { createQrDeposit, paymentCallback };