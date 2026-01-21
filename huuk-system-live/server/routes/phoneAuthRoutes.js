const express = require('express');
const router = express.Router();
const {
  requestOTP,
  verifyOTPAndAuth,
  updateProfile,
  getProfile,
  checkPhoneExists,
} = require('../controllers/phoneAuthController');
const authenticateToken = require('../middlewares/authMiddleware');

// Public routes (no authentication required)
router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTPAndAuth);
router.get('/check-phone/:phone_number', checkPhoneExists);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

module.exports = router;
