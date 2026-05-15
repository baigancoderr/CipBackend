const Price = require("../../models/Price");
const Supply = require("../../models/Supply");

const getPublicLivePrice = async (req, res) => {
  try {
    const sgnPriceDoc = await Price.findOne({ currencyType: "SGN" });

    const sgnPrice = sgnPriceDoc?.price || 0;

    return res.status(200).json({
      success: true,
      token: "CIP",
      symbol: "CIP",
      price: parseFloat(sgnPrice.toFixed(6)),
      updatedAt: sgnPriceDoc?.updatedAt || null,
    });
  } catch (error) {
    console.error("Public Live Price Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch live price",
    });
  }
};





const getPublicSupply = async (req, res) => {
  try {
    const supplyDoc = await Supply.findOne({ currencyType: "SGN" });

    return res.status(200).json({
      success: true,
      token: "CIP",
      symbol: "CIP",

      totalSupply: supplyDoc?.totalSupply || 0,
      burnSupply: supplyDoc?.burnSupply || 0,

      updatedAt: supplyDoc?.updatedAt || null,
    });
  } catch (error) {
    console.error("Public Supply Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch supply data",
    });
  }
};



module.exports = {
  getPublicLivePrice,
  getPublicSupply,
};