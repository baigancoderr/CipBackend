const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./src/config/db");
const userRoutes = require("./src/routes/user");
const adminRoutes = require("./src/routes/admin");

require("./src/controllers/userControllers/cronJobs");

dotenv.config();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
    
       "http://localhost:5173",
       "http://localhost:5174",
      "https://web.telegram.org",

      "https://t.me/cipera_bot/direct",
      "https://t.me/cipera_bot",
      "https://t.me",

      "https://telegram-cipera.vercel.app/"    
     
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// app.use(cors());


// Connect to MongoDB
connectDB();

// app.use((req, res, next) => {
//   console.log("Incoming request...");
//   next();
// });

// Routes
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
