const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { testConnection } = require("./config/supabase");

// Import new multi-tenant routes
const authRoutes = require("./routes/auth");
const organizationRoutes = require("./routes/organizations");
const clientRoutes = require("./routes/clients");

// Import error handling middleware
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

//security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

//rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

//CORS config
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id"],
  })
);

//body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

//logging middleware
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));

  // debug middleware for development
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Headers:`, {
      authorization: req.headers.authorization ? "Present" : "Missing",
      contentType: req.headers["content-type"],
    });
    next();
  });
} else {
  app.use(morgan("combined"));
}

// health check endpoint
app.get("/health", async (req, res) => {
  try {
    const supabaseConnected = await testConnection();

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: require("../package.json").version,
      services: {
        supabase: supabaseConnected ? "connected" : "disconnected",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// API routes - Multi-tenant architecture
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/clients", clientRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Invoice Management Tool API",
    version: require("../package.json").version,
    docs: "/api/docs",
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

//graceful shutdown (signal from Docker or process manager)
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

//CTRL + C in terminal
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

const startServer = async () => {
  try {
    //test supabase connection on startup
    console.log("Testing Supabase connection...");
    const connected = await testConnection();

    if (!connected && process.env.NODE_ENV === "production") {
      console.error("Failed to connect to Supabase in production mode");
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
