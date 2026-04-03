require('dotenv').config();
const { Web3, WebSocketProvider } = require('web3');
const web3 = new Web3(new WebSocketProvider('wss://bsc-ws-node.binance.org:443'));

const verifySignature = async (walletAddress, signature, message) => {
  try {
    const recoveredAddress = web3.eth.accounts.recover(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    return false;
  }
};

module.exports = { verifySignature };