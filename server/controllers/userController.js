const User = require("../models/User");
const bcrypt = require("bcryptjs");
const moment = require("moment");

// Check if the username exists
exports.checkUsernameExists = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username }).lean();
    res.json({ exists: !!user });
  } catch (err) {
    console.error("Error checking username:", err);
    res.status(500).json({ message: "Server error during username check." });
  }
};

// Check if the email exists
exports.checkEmailExists = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email?.toLowerCase() }).lean();
    res.json({ exists: !!user });
  } catch (err) {
    console.error("Error checking email:", err);
    res.status(500).json({ message: "Server error during email check." });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  const { email, password, fullname, username, userType, outlet } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email: email?.toLowerCase(), password: hashed, fullname, username, role: userType, outlet });
    res.status(201).json({ message: "User created successfully." });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Error creating user." });
  }
};

// Get total number of customers
exports.getTotalCustomersAll = async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "customer" });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching total customers:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get total number of customers up to yesterday
exports.getTotalCustomersUpToYesterday = async (req, res) => {
  try {
    const yesterday = moment().subtract(1, "days").endOf("day").toDate();
    const count = await User.countDocuments({ role: "customer", createdAt: { $lt: yesterday } });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching customers up to yesterday:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get list of all customers
exports.getCustomerList = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" })
      .select("_id fullname username email createdAt")
      .lean();
    res.json(customers.map((c) => ({ ...c, id: c._id.toString() })));
  } catch (err) {
    console.error("Error fetching customer list:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
