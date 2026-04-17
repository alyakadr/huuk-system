const User = require("../models/User");
const PhoneOTP = require("../models/PhoneOTP");
const {
  generateOTP,
  sendOTP,
  formatPhoneNumber,
} = require("../utils/smsService");
const { setAccessAndRefreshCookiesForUser } = require("../utils/authSession");

// Request OTP for phone number
exports.requestOTP = async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ message: "Phone number is required" });

    const formattedPhone = formatPhoneNumber(phone_number);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PhoneOTP.findOneAndUpdate(
      { phone_number: formattedPhone },
      { phone_number: formattedPhone, otp_code: otp, expires_at: expiresAt },
      { upsert: true, new: true }
    );

    await sendOTP(formattedPhone, otp);

    res.status(200).json({ message: "OTP sent successfully", phone_number: formattedPhone });
  } catch (error) {
    console.error("Error in requestOTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Verify OTP and sign up/sign in customer
exports.verifyOTPAndAuth = async (req, res) => {
  try {
    const { phone_number, otp, fullname } = req.body;
    if (!phone_number || !otp) return res.status(400).json({ message: "Phone number and OTP are required" });

    const formattedPhone = formatPhoneNumber(phone_number);

    const record = await PhoneOTP.findOne({
      phone_number: formattedPhone,
      otp_code: otp,
      expires_at: { $gt: new Date() },
    });

    if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });
    await PhoneOTP.deleteOne({ phone_number: formattedPhone });

    const existingUser = await User.findOne({ phone_number: formattedPhone }).lean();

    if (existingUser) {
      const accessToken = await setAccessAndRefreshCookiesForUser(
        res,
        existingUser,
        {
          userId: existingUser._id.toString(),
          role: existingUser.role,
          phone_number: existingUser.phone_number,
        },
        "1h",
      );
      return res.status(200).json({
        success: true,
        token: accessToken,
        user: {
          id: existingUser._id.toString(),
          phone_number: existingUser.phone_number,
          email: existingUser.email,
          role: existingUser.role,
          fullname: existingUser.fullname,
        },
        message: "Sign in successful",
      });
    }

    if (!fullname) return res.status(400).json({ message: "Full name is required for new users" });

    const newUser = await User.create({ phone_number: formattedPhone, role: "customer", fullname, isApproved: 1 });
    const accessToken = await setAccessAndRefreshCookiesForUser(
      res,
      newUser,
      {
        userId: newUser._id.toString(),
        role: "customer",
        phone_number: formattedPhone,
      },
      "1h",
    );

    res.status(201).json({
      success: true,
      token: accessToken,
      user: {
        id: newUser._id.toString(),
        phone_number: formattedPhone,
        email: null,
        role: "customer",
        fullname,
      },
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Error in verifyOTPAndAuth:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update customer profile
exports.updateProfile = async (req, res) => {
  try {
    const { email, fullname } = req.body;
    const userId = req.userId;

    if (!email && !fullname) return res.status(400).json({ message: "At least one field is required" });

    const updates = {};
    if (email) updates.email = email;
    if (fullname) updates.fullname = fullname;

    const result = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!result) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Profile updated successfully", updated_fields: Object.keys(updates) });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("_id phone_number email fullname role").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      id: user._id.toString(),
      phone_number: user.phone_number,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
    });
  } catch (error) {
    console.error("Error in getProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if phone number exists
exports.checkPhoneExists = async (req, res) => {
  try {
    const { phone_number } = req.params;
    if (!phone_number) return res.status(400).json({ message: "Phone number is required" });

    const formattedPhone = formatPhoneNumber(phone_number);
    const user = await User.findOne({ phone_number: formattedPhone }).lean();

    res.status(200).json({ exists: !!user, requires_signup: !user });
  } catch (error) {
    console.error("Error in checkPhoneExists:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  requestOTP: exports.requestOTP,
  verifyOTPAndAuth: exports.verifyOTPAndAuth,
  updateProfile: exports.updateProfile,
  getProfile: exports.getProfile,
  checkPhoneExists: exports.checkPhoneExists,
};
