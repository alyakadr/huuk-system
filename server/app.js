require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const phoneAuthRoutes = require("./routes/phoneAuthRoutes");
const userRoutes = require("./routes/userRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const customerRoutes = require("./routes/customerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhook");
const staffRoutes = require("./routes/staffRoutes");
const { startCronJobs } = require("./utils/cron");
const paymentPollingService = require("./services/paymentPollingService");
const { getStripeClient } = require("./utils/stripeClient");
const path = require("path");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const buildAllowedOrigins = () => {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [
    ...configuredOrigins,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
};

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  const allowedOrigins = buildAllowedOrigins();
  return allowedOrigins.some((allowedOrigin) =>
    allowedOrigin.endsWith("*")
      ? origin.startsWith(allowedOrigin.slice(0, -1))
      : origin === allowedOrigin,
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  },
});
const port = process.env.PORT || 5000;

const mongoose = require("./config/db");

app.set("socketio", io);

global.socketio = io;

io.on("connection", (socket) => {
  console.log("WebSocket client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("WebSocket client disconnected:", socket.id);
  });
});

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

const authenticateManager = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.error("No token provided in request");
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "manager") {
      console.error("Access denied: User role is not manager", {
        user: decoded,
      });
      return res
        .status(403)
        .json({ message: "Access denied: Manager role required" });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Invalid token:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Webhook route must come before body-parsing middleware
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhookRoutes,
);

// Debug route to confirm webhook endpoint
app.post(
  "/api/stripe/webhook/test",
  express.raw({ type: "application/json" }),
  (req, res) => {
    console.log("Webhook test route hit:", {
      headers: req.headers,
      body: req.body ? req.body.toString() : "No body",
      timestamp: new Date().toISOString(),
    });
    res.json({ message: "Test webhook received" });
  },
);

// Apply CORS for API routes and handle browser preflight requests.
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Body parsing for non-webhook routes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health check endpoint for Railway (without database dependency)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "HUUK System API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    port: process.env.PORT || 5000,
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: "1.0.0",
  });
});

app.get("/health/db", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Mongoose not connected");
    }
    await mongoose.connection.db.admin().command({ ping: 1 });
    res.json({
      status: "healthy",
      database: "connected",
      name: mongoose.connection.name,
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

app.use(
  "/Uploads",
  express.static(path.join(__dirname, "Uploads"), { fallthrough: true }),
);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/phone-auth", phoneAuthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/users", attendanceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/staff", staffRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/", (req, res) => {
  console.log("Received POST to /:", {
    headers: req.headers,
    body: req.body ? req.body.toString() : "No body",
  });
  res.status(404).json({ message: "Root route not found" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res
    .status(500)
    .json({ message: "Internal server error", detail: err.message });
});

app.use((req, res) => {
  console.error(`404: Route not found - ${req.method} ${req.url}`);
  res.status(404).json({ message: "Route not found" });
});

startCronJobs();

if (getStripeClient().stripe) {
  paymentPollingService.start();
  console.log("💳 Payment polling service started");
} else {
  console.warn("⚠️ Stripe key invalid or missing, payment polling disabled");
}

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
