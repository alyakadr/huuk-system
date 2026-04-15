const express = require("express");
const path = require("path");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Service = require("../models/Service");
const Outlet = require("../models/Outlet");
const { profilePictureUpload } = require("../middlewares/uploadMiddleware");
const {
  toProfilePayload,
  resolveProfilePictureFile,
} = require("../utils/userResponse");
const verifyToken = require("../middlewares/authMiddleware");
const {
  setCustomerAuthCookie,
  setStaffAuthCookie,
} = require("../utils/authCookies");
const {
  PASSWORD_POLICY_MESSAGE,
  isPasswordValid,
} = require("../utils/passwordPolicy");
const { formatPhoneNumber } = require("../utils/smsService");
const { emitToInternalStaff } = require("../utils/socketEmit");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not set");
  process.exit(1);
}

const serverRoot = path.join(__dirname, "..");

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const authReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

router.post("/auth/signup", authWriteLimiter, async (req, res) => {
  const { email, password, userType, fullname, outlet, username } = req.body;
  if (!email || !password || !userType || !fullname || !username) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (userType !== "customer") {
    return res.status(400).json({
      message:
        "Staff and manager accounts must register through the staff signup flow.",
    });
  }
  if (!isPasswordValid(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }
  try {
    const emailExists = await User.countDocuments({
      email: email.toLowerCase(),
    });
    if (emailExists > 0)
      return res.status(400).json({ message: "Email already registered" });

    const usernameExists = await User.countDocuments({ username });
    if (usernameExists > 0) {
      return res.status(400).json({ message: "Username already taken" });
    }
    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      email: email.toLowerCase(),
      password: hashed,
      role: "customer",
      fullname,
      outlet: outlet || "N/A",
      username,
      isApproved: 1,
      status: "approved",
    });
    res.json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Sign-up error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/auth/signin", authWriteLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.isApproved !== 1) {
      return res.status(403).json({
        message: "Account pending approval by manager",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, fullname: user.fullname },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    if (user.role === "customer") {
      setCustomerAuthCookie(res, token);
    } else {
      setStaffAuthCookie(res, token);
    }
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        outlet: user.outlet,
        fullname: user.fullname,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Signin error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/all-approvals", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const users = await User.find({ role: { $in: ["staff", "manager"] } })
      .select("_id fullname username email outlet createdAt isApproved")
      .sort({ isApproved: 1, createdAt: -1 })
      .lean();
    res.json(
      users.map((u) => ({
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        outlet: u.outlet,
        createdAt: u.createdAt,
        status:
          u.isApproved === 1
            ? "approved"
            : u.isApproved === 0
              ? "pending"
              : "rejected",
      })),
    );
  } catch (err) {
    console.error("Error fetching approvals:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/update-status/:id", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  const userId = req.params.id;
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  try {
    const isApproved = status === "approved" ? 1 : 0;
    const result = await User.findByIdAndUpdate(userId, { status, isApproved });
    if (!result) return res.status(404).json({ message: "User not found" });
    const io = req.app.get("socketio");
    emitToInternalStaff(io, "pendingStaffUpdate", {
      action: status === "approved" ? "remove" : "update",
      userId,
      status,
    });
    res.json({ message: `User ${status} successfully` });
  } catch (err) {
    console.error("Error updating status:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/pending-approval", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const users = await User.find({
      isApproved: 0,
      role: { $in: ["staff", "manager"] },
    })
      .select("_id fullname username email outlet createdAt")
      .lean();
    res.json(
      users.map((u) => ({
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        outlet: u.outlet,
        createdAt: u.createdAt,
        status: "pending",
      })),
    );
  } catch (err) {
    console.error("Error fetching pending approvals:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/approve/:id", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  const userId = req.params.id;
  try {
    const result = await User.findByIdAndUpdate(userId, {
      isApproved: 1,
      status: "approved",
    });
    if (!result) return res.status(404).json({ message: "User not found" });
    const io = req.app.get("socketio");
    emitToInternalStaff(io, "pendingStaffUpdate", { action: "remove", userId });
    res.json({ message: "User approved" });
  } catch (err) {
    console.error("Error approving user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/list", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const users = await User.find({
      isApproved: 1,
      role: { $in: ["staff", "manager"] },
    })
      .select("_id fullname username email role outlet createdAt")
      .sort({ fullname: 1 })
      .lean();
    res.json(
      users.map((u) => ({
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        role: u.role,
        outlet: u.outlet,
        createdAt: u.createdAt,
        status: "approved",
      })),
    );
  } catch (err) {
    console.error("Error fetching user list:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/checkUsername", authReadLimiter, async (req, res) => {
  const { username, userType } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username required" });
  }
  try {
    const count = await User.countDocuments({
      username,
      role: { $in: ["staff", "manager"] },
    });
    if (count > 0 && (userType === "staff" || userType === "manager")) {
      return res.json({ exists: true });
    }
    res.json({ exists: false });
  } catch (err) {
    console.error("Error checking username:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/check-username/:username", authReadLimiter, async (req, res) => {
  const username = req.params.username;
  try {
    const count = await User.countDocuments({ username });
    res.json({ exists: count > 0 });
  } catch (err) {
    console.error("Error checking username:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/checkEmail", authReadLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }
  try {
    const count = await User.countDocuments({ email: email.toLowerCase() });
    res.json({ exists: count > 0 });
  } catch (err) {
    console.error("Error checking email:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/change-password/:id", verifyToken, async (req, res) => {
  const userIdParam = req.params.id;
  if (userIdParam !== req.userId) {
    return res
      .status(403)
      .json({ message: "Cannot change another user's password" });
  }
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Both passwords required" });
  }
  if (!isPasswordValid(newPassword)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }
  try {
    const user = await User.findById(userIdParam).select("password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password incorrect" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error updating password:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userObjectId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(toProfilePayload(user, serverRoot));
  } catch (err) {
    console.error("Error fetching profile:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch(
  "/update-profile/:id",
  verifyToken,
  (req, res, next) => {
    profilePictureUpload.single("profile_picture")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File too large. Maximum size is 5MB." });
        }
        return res
          .status(400)
          .json({ message: "File upload error: " + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const { address, phone_number } = req.body;
    const profile_picture = req.file
      ? `/Uploads/profile_pictures/${req.file.filename}`
      : null;
    const profileIdFromParams = req.params.id;

    if (profileIdFromParams !== req.userId) {
      return res.status(403).json({ message: "User ID mismatch" });
    }

    try {
      const updates = {
        address: address || undefined,
        phone_number: phone_number || undefined,
      };
      if (profile_picture) {
        updates.profile_picture = profile_picture;
      }
      const user = await User.findByIdAndUpdate(profileIdFromParams, updates, {
        new: true,
        runValidators: true,
      }).lean();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(toProfilePayload(user, serverRoot));
    } catch (err) {
      console.error("Error updating profile:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.get("/staffs", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const staff = await User.find({ role: "staff", isApproved: 1 })
      .select("_id fullname username email phone_number profile_picture outlet")
      .sort({ fullname: 1 })
      .lean();
    const payload = staff.map((u) => {
      const row = {
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        phone_number: u.phone_number,
        profile_picture: resolveProfilePictureFile(u, serverRoot),
        outlet: u.outlet,
        status: "approved",
      };
      return row;
    });
    res.json(payload);
  } catch (err) {
    console.error("Error fetching staff list:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/outlets", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const fromUsers = await User.distinct("outlet", {
      outlet: { $nin: [null, ""] },
    });
    const fromDb = await Outlet.find({}).select("name").lean();
    const names = new Set([
      ...fromUsers.filter(Boolean),
      ...fromDb.map((o) => o.name),
    ]);
    const outlets = [...names].sort();
    res.json({ outlets });
  } catch (err) {
    console.error("Error fetching outlets:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/test-search", async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : "";
  if (!query) {
    return res.status(400).json({ message: "Search query required" });
  }
  res.json({
    message: "Test search endpoint working",
    query,
    clients: [],
    appointments: [],
    services: [],
  });
});

router.get("/search", verifyToken, async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : "";
  if (!query) {
    return res.status(400).json({ message: "Search query required" });
  }
  res.json({
    message: "Search endpoint working",
    query,
    clients: [],
    appointments: [],
    services: [],
  });
});

function mapServiceRow(s) {
  return {
    id: s._id.toString(),
    name: s.name,
    duration: s.duration,
    price: s.price,
  };
}

router.get("/services", verifyToken, async (req, res) => {
  try {
    const { maxDuration } = req.query;
    let services = await Service.find({}).sort({ name: 1 }).lean();
    let list = services.map(mapServiceRow);
    if (maxDuration) {
      const maxDur = parseInt(maxDuration, 10);
      list = list.filter((svc) => svc.duration <= maxDur);
    }
    res.json(list);
  } catch (err) {
    console.error("Error fetching services:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/services/available", verifyToken, async (req, res) => {
  try {
    const { maxDuration } = req.query;
    const services = await Service.find({}).sort({ name: 1 }).lean();
    let list = services.map(mapServiceRow);
    if (maxDuration) {
      const maxDur = parseInt(maxDuration, 10);
      list = list.filter((svc) => svc.duration <= maxDur);
    }
    res.json(list);
  } catch (err) {
    console.error("Error fetching available services:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/by-phone/:phoneNumber", verifyToken, async (req, res) => {
  const { phoneNumber } = req.params;
  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (req.role === "customer") {
      const self = await User.findById(req.userObjectId)
        .select("phone_number")
        .lean();
      const selfPhone = self?.phone_number
        ? formatPhoneNumber(self.phone_number)
        : null;
      if (!selfPhone || selfPhone !== formattedPhone) {
        return res.status(403).json({ message: "Forbidden" });
      }
    } else if (req.role !== "staff" && req.role !== "manager") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await User.findOne({ phone_number: formattedPhone })
      .sort({ createdAt: -1 })
      .lean();
    if (!user) {
      return res.json({ user: null });
    }
    res.json({
      user: {
        id: user._id.toString(),
        name: user.fullname,
        email: user.email,
        phone: user.phone_number,
        role: user.role,
        created_at: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Error fetching user by phone:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/validate-token", authReadLimiter, verifyToken, (req, res) => {
  res.json({ valid: true, userId: req.userId, role: req.role });
});

module.exports = router;
