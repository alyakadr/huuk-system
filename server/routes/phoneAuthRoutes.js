const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const {
  requestOTP,
  verifyOTPAndAuth,
  updateProfile,
  getProfile,
  checkPhoneExists,
} = require("../controllers/phoneAuthController");
const authenticateToken = require("../middlewares/authMiddleware");

const phoneOtpWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const phoneOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

const phoneAuthReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Public routes (no authentication required)
router.post("/request-otp", phoneOtpWriteLimiter, requestOTP);
router.post("/verify-otp", phoneOtpVerifyLimiter, verifyOTPAndAuth);
router.get(
  "/check-phone/:phone_number",
  phoneAuthReadLimiter,
  checkPhoneExists,
);

// Protected routes (authentication required)
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

module.exports = router;
