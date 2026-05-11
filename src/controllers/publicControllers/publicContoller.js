const Price = require("../../models/Price");

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

module.exports = {
  getPublicLivePrice,
};