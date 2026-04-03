const User = require('../../models/User'); 
const { errorResponse, successResponse } = require('../../utils/responses'); 
const speakeasy = require("speakeasy"); 
const { decrypt } = require('../userControllers/2faController'); 

// Define rank to binary cap mapping (adjust as per your business logic)
const RANK_BINARY_CAP_MAPPING = {
  "Starter": 100,  
  "Bronze": 250,   
  "Silver": 500,   
  "Gold": 1000,    
  "Platinum": 2500, 
  "Diamond": 5000, 
  "Crown/Royal": 10000,     
    
};

const adminUpdateUserDetails = async (req, res) => {
  try {
      if (req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Admin access required"));
    }


    const { user_id, new_rank, new_sponsor_id } = req.body;

    if (!user_id) {
      return res.status(400).json(errorResponse("user_id is required"));
    }

    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Update rank and automatically update binary cap if not overridden
    if (new_rank) {
      if (!RANK_BINARY_CAP_MAPPING[new_rank]) {
        return res.status(400).json(errorResponse("Invalid rank provided"));
      }
      user.rank = new_rank;
       user.binary_daily_cap = RANK_BINARY_CAP_MAPPING[new_rank];
    }

    // Update sponsor_id and automatically sync parent and referredBy
    if (new_sponsor_id) {
      user.sponsor_id = new_sponsor_id;
      user.parent = new_sponsor_id;
      user.referredBy = new_sponsor_id;
    }

    await user.save();

    res.status(200).json(successResponse("User updated successfully", { user }));
  } catch (error) {
    console.error("Admin update error:", error);
    res.status(500).json(errorResponse(error.message));
  }
};

// Export the function
module.exports = { adminUpdateUserDetails };