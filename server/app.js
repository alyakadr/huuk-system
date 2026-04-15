require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { getRawAccessTokenFromRequest } = require("./utils/authCookies");
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
const verifyToken = require("./middlewares/authMiddleware");

app.set("socketio", io);

global.socketio = io;
global.io = io;

io.use((socket, next) => {
  try {
    const authToken =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.headers?.authorization === "string" &&
      socket.handshake.headers.authorization.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.slice(7).trim()
        : null);
    if (!authToken) {
      next();
      return;
    }
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    const uid = decoded.userId;
    if (uid) {
      socket.join(`user:${String(uid)}`);
      if (decoded.role === "staff" || decoded.role === "manager") {
        socket.join("internal_staff");
      }
      if (decoded.role === "manager") {
        socket.join("role:manager");
      }
    }
  } catch {
    // Expired or invalid token: still allow connection (no private rooms)
  }
  next();
});

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
  const token = getRawAccessTokenFromRequest(req);
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

// Debug route to confirm webhook endpoint (disabled in production unless explicitly enabled)
if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_STRIPE_WEBHOOK_TEST === "true"
) {
  app.post(
    "/api/stripe/webhook/test",
    express.raw({ type: "application/json" }),
    (req, res) => {
      if (process.env.NODE_ENV === "production") {
        const secret = process.env.STRIPE_WEBHOOK_TEST_SECRET;
        if (!secret || req.headers["x-webhook-test-secret"] !== secret) {
          return res.status(404).json({ message: "Not found" });
        }
      }
      console.log("Webhook test route hit:", {
        timestamp: new Date().toISOString(),
      });
      res.json({ message: "Test webhook received" });
    },
  );
}

// Apply CORS for API routes and handle browser preflight requests.
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(cookieParser());

// Body parsing for non-webhook routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Ensure 5xx responses never leak internal implementation details.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === "object") {
      const sanitized = { ...body };
      delete sanitized.detail;
      delete sanitized.error;
      return originalJson(sanitized);
    }
    return originalJson(body);
  };
  next();
});

// Health check endpoint for Railway (without database dependency)
app.get("/", (req, res) => {
  const payload = {
    status: "ok",
    message: "HUUK System API is running",
    timestamp: new Date().toISOString(),
  };
  if (process.env.NODE_ENV !== "production") {
    Object.assign(payload, {
      environment: process.env.NODE_ENV || "development",
      port: process.env.PORT || 5000,
    });
  }
  res.json(payload);
});

app.get("/health", (req, res) => {
  const payload = {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
  if (process.env.NODE_ENV !== "production") {
    Object.assign(payload, {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: "1.0.0",
    });
  }
  res.json(payload);
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
      ...(process.env.NODE_ENV !== "production"
        ? { name: mongoose.connection.name }
        : {}),
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

const uploadsRoot = path.join(__dirname, "Uploads");
const attendanceUploadDir = path.join(uploadsRoot, "attendance");
const profilePicturesDir = path.join(uploadsRoot, "profile_pictures");

app.get("/Uploads/attendance/:filename", verifyToken, async (req, res) => {
  const { filename } = req.params;
  if (!filename || /[/\\]/.test(filename) || filename.includes("..")) {
    return res.status(400).json({ message: "Invalid filename" });
  }
  const absFile = path.resolve(attendanceUploadDir, filename);
  if (!absFile.startsWith(path.resolve(attendanceUploadDir))) {
    return res.status(400).json({ message: "Invalid path" });
  }
  try {
    const Attendance = require("./models/attendance");
    const rel = `/Uploads/attendance/${filename}`;
    const record = await Attendance.findOne({ document_path: rel }).lean();
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }
    if (req.role === "manager") {
      return res.sendFile(absFile);
    }
    if (
      req.role === "staff" &&
      record.staff_id.toString() === req.userId
    ) {
      return res.sendFile(absFile);
    }
    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error("Attendance file serve error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

app.use("/Uploads/profile_pictures", express.static(profilePicturesDir));

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
  res.status(500).json({ message: "Internal server error" });
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
