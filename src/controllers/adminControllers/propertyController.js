// controllers/propertyController.js
const Property = require('../../models/Plan');
const PropertyLog = require('../../models/PropertyLog');
const { successResponse, errorResponse } = require('../../utils/responses');
const redisClient = require("../../config/redisClient");

// ==================== Generate Unique Property ID ====================
const generateUniquePropertyId = async () => {
  let propertyId;
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    propertyId = `URWAProp${String(counter).padStart(5, "0")}`;

    // Check Redis cache
    const cached = await redisClient.get(`propertyId:${propertyId}`);
    if (cached) {
      counter++;
      continue;
    }

    // Check database
    const exists = await Property.findOne({ property_id: propertyId });
    if (!exists) {
      await redisClient.set(`propertyId:${propertyId}`, "taken", { EX: 3600 });
      isUnique = true;
    } else {
      counter++;
    }

    if (counter > 99999) {
      throw new Error("Unable to generate unique property ID after max attempts");
    }
  }
  return propertyId;
};

// ==================== Register Property ====================
const registerProperty = async (req, res) => {
  try {
    let propertyData = { ...req.body };

    // Remove unwanted fields
    delete propertyData._id;

    const category = propertyData.category;
    if (!category) {
      return res.status(400).json(errorResponse("Category is required (READY_MADE / UNDER_CONSTRUCTION / TOKENIZED)"));
    }

    const totalPropertyValue = propertyData.property_total_area * propertyData.property_per_sqft_price_usd;

    const totalTokenSupply = Math.floor(totalPropertyValue / (propertyData.tokenPrice)) || 0;

    // ==================== SANITIZE DATA - Only keep relevant fields ====================
    const sanitized = {
      // Common fields (always allowed)
      title: propertyData.title,
      slug: propertyData.slug,
      category: propertyData.category,
      location: propertyData.location,
      description: propertyData.description,
      images: Array.isArray(propertyData.images) ? propertyData.images : [],
      image: propertyData.image || (Array.isArray(propertyData.images) ? propertyData.images[0] : null),
      chain: propertyData.chain,
      tokenPrice: propertyData.tokenPrice || 0,
      property_total_value_usd: totalPropertyValue,
      property_per_sqft_price_usd: propertyData.property_per_sqft_price_usd || 0,
      property_total_area: propertyData.property_total_area || 0,
      property_totalAvailableArea: propertyData.property_totalAvailableArea || 0,
      total_tokens_supply: totalTokenSupply,
      available_tokens_supply: totalTokenSupply,
      sold_tokens_supply: 0,
      min_invest: propertyData.min_invest || 0,
      beds: propertyData.beds || 0,
      baths: propertyData.baths || 0,
      overview: propertyData.overview || {},
      marketplace: propertyData.marketplace || {},
      documents: Array.isArray(propertyData.documents) ? propertyData.documents : [],
      rental_percentage: propertyData.rental_percentage || 0,
      risk_level: propertyData.risk_level || "Medium Risk",
      status: propertyData.status || "AVAILABLE",
      created_by: req.user.id,
    };

    // Reset all category-specific fields to null/0 first
    sanitized.amenities = null;
    sanitized.financials = null;
    sanitized.gallery = null;
    sanitized.deal = null;
    sanitized.partner = null;

    sanitized.construction = null;
    sanitized.construction_stage = null;
    sanitized.expectedCompletion = null;
    sanitized.projectCompletion = null;
    sanitized.StartDate = null;
    sanitized.Enddate = null;
    sanitized.structure = null;
    sanitized.exit = null;
    sanitized.overallprogress = 0;
    sanitized.sidebar = null;
    sanitized.tabs = null;
    sanitized.keyFeatures = null;
    sanitized.benefits = null;

    // Fill only the fields that belong to the selected category
    switch (category) {
      case "READY_MADE":
        sanitized.amenities = Array.isArray(propertyData.amenities) ? propertyData.amenities : [];
        sanitized.financials = propertyData.financials || null;
        sanitized.gallery = Array.isArray(propertyData.gallery) ? propertyData.gallery : sanitized.images;
        sanitized.deal = propertyData.deal || null;
        sanitized.partner = propertyData.partner || null;
        break;

      case "UNDER_CONSTRUCTION":
        sanitized.construction = propertyData.construction || null;
        sanitized.construction_stage = propertyData.construction_stage || null;
        sanitized.projectCompletion = propertyData.projectCompletion || null;
        sanitized.StartDate = propertyData.StartDate || null;
        sanitized.Enddate = propertyData.Enddate || null;
        sanitized.structure = propertyData.structure || null;
        sanitized.exit = propertyData.exit || "Withdraw after completion";
        sanitized.overallprogress = Number(propertyData.overallprogress) || 0;
        sanitized.sidebar = propertyData.sidebar || null;
        sanitized.tabs = propertyData.tabs || null;
        sanitized.keyFeatures = Array.isArray(propertyData.keyFeatures) ? propertyData.keyFeatures : [];
        sanitized.benefits = Array.isArray(propertyData.benefits) ? propertyData.benefits : [];
        break;

      case "TOKENIZED":
        // You can extend this later (same as READY_MADE + blockchain fields)
        sanitized.amenities = Array.isArray(propertyData.amenities) ? propertyData.amenities : [];
        sanitized.financials = propertyData.financials || null;
        sanitized.gallery = Array.isArray(propertyData.gallery) ? propertyData.gallery : sanitized.images;
        sanitized.deal = propertyData.deal || null;
        break;

      default:
        return res.status(400).json(errorResponse("Invalid category"));
    }

    // Auto-generate property_id and slug
    sanitized.property_id = await generateUniquePropertyId();

    if (!sanitized.slug && sanitized.title) {
      sanitized.slug = sanitized.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const property = new Property(sanitized);
    await property.save();

    // Log creation
    await PropertyLog.create({
      property_id: property.property_id,
      action: 'create',
      changed_by: req.user.id,
      changes: sanitized,
    });

    res.status(201).json(successResponse('Property registered successfully', property));
  } catch (error) {
    console.error("Register Property Error:", error);
    res.status(500).json(errorResponse(error.message || "Failed to register property"));
  }
};

// ==================== Get All Properties ====================
const getAllProperties = async (req, res) => {
  try {
    const properties = await Property.find().lean();
    res.status(200).json(successResponse('All properties retrieved successfully', properties));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Get Property by Property ID ====================
const getPropertyById = async (req, res) => {
  try {
    const { propertyId } = req.params; // Custom property_id

    const property = await Property.findOne({ property_id: propertyId }).lean();
    if (!property) {
      return res.status(404).json(errorResponse('Property not found'));
    }

    res.status(200).json(successResponse('Property retrieved successfully', property));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Update Property ====================
const updateProperty = async (req, res) => {
  try {
    const { propertyId } = req.params; // Custom property_id
    const updateData = req.body;

    const oldProperty = await Property.findOne({ property_id: propertyId });
    if (!oldProperty) {
      return res.status(404).json(errorResponse('Property not found'));
    }

    // Ensure images and documents are arrays (from frontend JSON)
    updateData.images = updateData.images || [];
    updateData.documents = updateData.documents || [];

    const updatedProperty = await Property.findOneAndUpdate(
      { property_id: propertyId },
      updateData,
      { new: true, runValidators: true }
    );

    // Log changes
    const changes = {};
    Object.keys(updateData).forEach(key => {
      if (JSON.stringify(oldProperty[key]) !== JSON.stringify(updateData[key])) {
        changes[key] = { old: oldProperty[key], new: updateData[key] };
      }
    });

    await PropertyLog.create({
      property_id: oldProperty.property_id,
      action: 'update',
      changed_by: req.user.id,
      changes,
    });

    res.status(200).json(successResponse('Property updated successfully', updatedProperty));
  } catch (error) {
    console.error('Update Property Error:', error);
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Delete Property ====================
const deleteProperty = async (req, res) => {
  try {
    const { propertyId } = req.params; // Custom property_id

    const property = await Property.findOne({ property_id: propertyId });
    if (!property) {
      return res.status(404).json(errorResponse('Property not found'));
    }

    await Property.deleteOne({ property_id: propertyId });

    // Log deletion
    await PropertyLog.create({
      property_id: property.property_id,
      action: 'delete',
      changed_by: req.user.id,
      changes: property.toObject(),
    });

    res.status(200).json(successResponse('Property deleted successfully'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==================== Get Property Logs ====================
const getPropertyLogs = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const query = propertyId ? { property_id: propertyId } : {};

    const logs = await PropertyLog.find(query)
      .populate('changed_by', 'email username')
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json(successResponse('Property logs retrieved successfully', logs));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

module.exports = {
  registerProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  getPropertyLogs
};