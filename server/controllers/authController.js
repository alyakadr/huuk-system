const User = require("../models/User");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

// Sign-Up Controller
exports.signUp = async (req, res) => {
  const { email, password, userType, fullname, outlet, username } = req.body;

  if (userType === "staff" || userType === "manager") {
    if (!outlet) return res.status(400).json({ message: "Outlet is required for staff." });

    try {
      const exists = await User.countDocuments({ username, role: { $in: ["staff", "manager"] } });
      if (exists) return res.status(400).json({ message: "Username is already taken for staff." });

      const hashed = await bcrypt.hash(password, 10);
      await User.create({ email: email?.toLowerCase(), password: hashed, role: userType, fullname, outlet, username, isApproved: 0 });
      return res.status(200).json({ message: `Sign-up successful for ${userType}!` });
    } catch (err) {
      console.error("Error during user creation:", err);
      return res.status(500).json({ message: "Error during sign-up." });
    }
  } else if (userType === "customer") {
    try {
      const hashed = await bcrypt.hash(password, 10);
      await User.create({ email: email?.toLowerCase(), password: hashed, role: "customer", fullname, username, isApproved: 0 });
      return res.status(200).json({ message: "Sign-up successful for customer!" });
    } catch (err) {
      console.error("Error during user creation:", err);
      return res.status(500).json({ message: "Error during sign-up." });
    }
  } else {
    return res.status(400).json({ message: "Invalid user type. Must be 'staff', 'manager', or 'customer'." });
  }
};

// Sign-In Controller
exports.signIn = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email?.toLowerCase() }).lean();
    if (!user) return res.status(400).json({ message: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

    if (!user.isApproved) return res.status(400).json({ message: "Please wait for manager approval." });

    const responseUser = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      fullname: user.fullname,
      token: user.token || "",
    };
    res.status(200).json({ success: true, user: responseUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed." });
  }
};

// Check if username exists
exports.checkUsernameExists = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username }).lean();
    res.json({ exists: !!user });
  } catch (err) {
    console.error("Error checking username:", err);
    res.status(500).json({ message: "Error checking username." });
  }
};
