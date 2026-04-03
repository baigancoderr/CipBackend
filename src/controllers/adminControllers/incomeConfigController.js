// controllers/incomeConfigController.js
const IncomeConfig = require("../../models/IncomeConfig");
const { successResponse, errorResponse } = require("../../utils/responses");



// Create a new income config (admin only)
const createIncomeConfig = async (req, res) => {
  try {
    const { type, level, percentage, minDirects } = req.body;

    // Validation
    if (type === "level" && (!level || typeof minDirects !== "number")) {
      return res.status(400).json(errorResponse("Level and minDirects are required for level type"));
    }
    if (type === "directReferral" && (level || minDirects)) {
      return res.status(400).json(errorResponse("Level and minDirects should not be provided for directReferral type"));
    }

    const newConfig = new IncomeConfig({ type, level, percentage, minDirects });
    await newConfig.save();

    res.status(201).json(successResponse("Income config created successfully", newConfig));
  } catch (error) {
    console.error("Error creating income config:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Get all income configs
const getAllIncomeConfigs = async (req, res) => {
  try {
    const configs = await IncomeConfig.find().sort({ type: 1, level: 1 });
    res.status(200).json(successResponse("Income configs retrieved successfully", configs));
  } catch (error) {
    console.error("Error retrieving income configs:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Get a single income config by ID
const getIncomeConfigById = async (req, res) => {
  try {
    const config = await IncomeConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json(errorResponse("Income config not found"));
    }
    res.status(200).json(successResponse("Income config retrieved successfully", config));
  } catch (error) {
    console.error("Error retrieving income config:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Update an income config by ID (admin only)
const updateIncomeConfig = async (req, res) => {
  try {
    const { percentage, minDirects } = req.body;
    const config = await IncomeConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json(errorResponse("Income config not found"));
    }

    // Validation for updates
    if (config.type === "level" && typeof minDirects !== "undefined" && typeof minDirects !== "number") {
      return res.status(400).json(errorResponse("minDirects must be a number for level type"));
    }
    if (config.type === "directReferral" && typeof minDirects !== "undefined") {
      return res.status(400).json(errorResponse("minDirects should not be updated for directReferral type"));
    }

    if (typeof percentage !== "undefined") config.percentage = percentage;
    if (typeof minDirects !== "undefined") config.minDirects = minDirects;

    await config.save();

    res.status(200).json(successResponse("Income config updated successfully", config));
  } catch (error) {
    console.error("Error updating income config:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Delete an income config by ID (admin only)
const deleteIncomeConfig = async (req, res) => {
  try {
    const config = await IncomeConfig.findByIdAndDelete(req.params.id);
    if (!config) {
      return res.status(404).json(errorResponse("Income config not found"));
    }
    res.status(200).json(successResponse("Income config deleted successfully"));
  } catch (error) {
    console.error("Error deleting income config:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  createIncomeConfig,
  getAllIncomeConfigs,
  getIncomeConfigById,
  updateIncomeConfig,
  deleteIncomeConfig,
};