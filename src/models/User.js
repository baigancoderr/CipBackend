const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 🔐 Telegram login
    telegramId: {
      type: String,
      required: true,
      unique: true,
    },


    email: {
  type: String,
 
  sparse: true,   
  lowercase: true,
  trim: true,
  default: null   
},



// telegramId: {
//     type: String,
//     sparse: true,         
//     unique: true,          
//   },

  // For Web users
  // email: {
  //   type: String,
  //   sparse: true,
  //   unique: true,
  //   lowercase: true,
  //   trim: true,
  // },








    name: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      default: "",
    },

    userId: {
      type: String,
      unique: true,
    },

    referralCode: {
      type: String,
      unique: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    referredBy: {
      type: String,
      default: null,
    },

    // totalReferrals: {
    //   type: Number,
    //   default: 0,
    // },

    referralEarnings: {
      type: Number,
      default: 0,
    },

    // 💰 Wallet
    walletAddress: {
      type: String,
      default: "",
    },

    walletBalance: {
      type: Number,
      default: 0,
    },


      wallets: {
      referral: {
        amount: { type: Number, default: 0 },
      },
      roi: {
        amount: { type: Number, default: 0 },
      },
       deposit: {
    amount: { type: Number, default: 0 },   
  },
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    // 📦 Investment
    totalInvested: {
      type: Number,
      default: 0,
    },

    activePackage: {
      type: Number,
      default: 0,
    },

    dailyIncome: {
      type: Number,
      default: 0,
    },

    // 🟢 Status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ====================== DELETE HOOKS (isActive ke hisaab se) ======================

// Case 1: Jab findByIdAndDelete() ya findOneAndDelete use hota hai
userSchema.pre("findOneAndDelete", async function (next) {
  try {
    const docToDelete = await this.model.findOne(this.getFilter());

    if (docToDelete && docToDelete.referredBy && docToDelete.referredBy !== "SYSTEM") {
      await this.model.updateOne(
        { referralCode: docToDelete.referredBy },
        { $inc: { totalReferrals: -1 } }
      );
      console.log(`✅ Referral count decreased for: ${docToDelete.referredBy} (User: ${docToDelete.userId})`);
    }
    next();
  } catch (error) {
    console.error("❌ Error in findOneAndDelete hook:", error);
    next(error);
  }
});

// Case 2: Document level deleteOne ke liye (backup)
userSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  try {
    if (this.referredBy && this.referredBy !== "SYSTEM") {
      await mongoose.model("User").updateOne(
        { referralCode: this.referredBy },
        { $inc: { totalReferrals: -1 } }
      );
      console.log(`✅ Referral count decreased for: ${this.referredBy} (User: ${this.userId})`);
    }
    next();
  } catch (error) {
    console.error("❌ Error in deleteOne hook:", error);
    next(error);
  }
});

// ====================== IMPORTANT QUERY MIDDLEWARE ======================
// Yeh ensure karega ki inactive users normal queries mein na aaye

userSchema.pre(/^find/, function (next) {
  this.where({ isActive: true });
  next();
});

module.exports = mongoose.model("User", userSchema);