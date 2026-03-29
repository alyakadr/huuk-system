const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    phone_number: { type: String, trim: true },
    password: { type: String },
    role: { type: String, enum: ["staff", "manager", "customer"], required: true },
    fullname: { type: String, trim: true },
    username: { type: String, trim: true },
    outlet: { type: String },
    outlet_id: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet" },
    profile_picture: { type: String, default: "/Uploads/profile_pictures/default.jpg" },
    isApproved: { type: Number, default: 0 },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
