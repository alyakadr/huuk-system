const mongoose = require("mongoose");

const phoneOTPSchema = new mongoose.Schema(
  {
    phone_number: { type: String, required: true, unique: true },
    otp_code: { type: String, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhoneOTP", phoneOTPSchema);
