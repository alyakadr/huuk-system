const bcrypt = require("bcryptjs");
const User = require("./User");
const PhoneOTP = require("./PhoneOTP");

const createUser = async (email, password, userType, fullname, outlet, username, callback) => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role: userType,
      fullname,
      outlet,
      username,
      isApproved: 0,
    });
    const result = await user.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

const createCustomerWithPhone = async (phoneNumber, fullname, callback) => {
  try {
    const user = new User({ phone_number: phoneNumber, role: "customer", fullname, isApproved: 1 });
    const result = await user.save();
    callback(null, { insertId: result._id });
  } catch (err) {
    callback(err);
  }
};

const findUserByPhone = async (phoneNumber, callback) => {
  try {
    const user = await User.findOne({ phone_number: phoneNumber }).lean();
    if (user) user.id = user._id.toString();
    callback(null, user || null);
  } catch (err) {
    callback(err);
  }
};

const storeOTP = async (phoneNumber, otp, callback) => {
  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await PhoneOTP.findOneAndUpdate(
      { phone_number: phoneNumber },
      { phone_number: phoneNumber, otp_code: otp, expires_at: expiresAt },
      { upsert: true, new: true }
    );
    callback(null);
  } catch (err) {
    callback(err);
  }
};

const verifyOTP = async (phoneNumber, otp, callback) => {
  try {
    const record = await PhoneOTP.findOne({
      phone_number: phoneNumber,
      otp_code: otp,
      expires_at: { $gt: new Date() },
    });
    if (record) {
      await PhoneOTP.deleteOne({ phone_number: phoneNumber });
      callback(null, true);
    } else {
      callback(null, false);
    }
  } catch (err) {
    callback(err);
  }
};

const cleanExpiredOTPs = async () => {
  try {
    await PhoneOTP.deleteMany({ expires_at: { $lte: new Date() } });
  } catch (err) {
    console.error("Error cleaning expired OTPs:", err);
  }
};

const updateUserProfile = async (userId, updates, callback) => {
  try {
    const allowedFields = ["email", "fullname"];
    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });
    if (Object.keys(filteredUpdates).length === 0) {
      return callback(new Error("No valid fields to update"));
    }
    const result = await User.findByIdAndUpdate(userId, filteredUpdates, { new: true });
    if (!result) return callback(null, { affectedRows: 0 });
    callback(null, { affectedRows: 1 });
  } catch (err) {
    callback(err);
  }
};

const checkUsernameExists = async (username, callback) => {
  try {
    const count = await User.countDocuments({ username, role: { $in: ["staff", "manager"] } });
    callback(null, count > 0);
  } catch (err) {
    callback(err);
  }
};

const findUserByEmail = async (email, callback) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    if (user) user.id = user._id.toString();
    callback(null, user || null);
  } catch (err) {
    callback(err);
  }
};

const findUserByEmailAndPassword = async (email, password, callback) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    if (!user) return callback(null, null);
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      user.id = user._id.toString();
      callback(null, user);
    } else {
      callback(null, null);
    }
  } catch (err) {
    callback(err);
  }
};

// Compatibility shim: expose a db-like object for legacy code that uses db.query
const db = {
  query: async (sql, params, callback) => {
    console.warn("Legacy db.query() called. Migrate this to Mongoose directly.");
    if (typeof callback === "function") callback(new Error("db.query not supported in MongoDB mode"), null);
  },
};

module.exports = {
  db,
  createUser,
  createCustomerWithPhone,
  checkUsernameExists,
  findUserByEmail,
  findUserByEmailAndPassword,
  findUserByPhone,
  storeOTP,
  verifyOTP,
  cleanExpiredOTPs,
  updateUserProfile,
};
