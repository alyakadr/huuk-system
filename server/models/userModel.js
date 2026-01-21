const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "huuk",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Successfully connected to MySQL");
  }
});

const createUser = (
  email,
  password,
  userType,
  fullname,
  outlet,
  username,
  callback
) => {
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return callback(err);
    db.query(
      "INSERT INTO users (email, password, role, fullname, outlet, username, isApproved) VALUES (?, ?, ?, ?, ?, ?, 0)",
      [email, hashedPassword, userType, fullname, outlet, username],
      callback
    );
  });
};

// Create customer with phone number (no password required)
const createCustomerWithPhone = (
  phoneNumber,
  fullname,
  callback
) => {
  db.query(
    "INSERT INTO users (phone_number, role, fullname, isApproved) VALUES (?, 'customer', ?, 1)",
    [phoneNumber, fullname],
    callback
  );
};

// Find user by phone number
const findUserByPhone = (phoneNumber, callback) => {
  db.query("SELECT * FROM users WHERE phone_number = ?", [phoneNumber], (err, results) => {
    if (err) return callback(err);
    if (results.length > 0) return callback(null, results[0]);
    return callback(null, null);
  });
};

// Store OTP for phone verification
const storeOTP = (phoneNumber, otp, callback) => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  db.query(
    "INSERT INTO phone_otps (phone_number, otp_code, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?",
    [phoneNumber, otp, expiresAt, otp, expiresAt],
    callback
  );
};

// Verify OTP
const verifyOTP = (phoneNumber, otp, callback) => {
  db.query(
    "SELECT * FROM phone_otps WHERE phone_number = ? AND otp_code = ? AND expires_at > NOW()",
    [phoneNumber, otp],
    (err, results) => {
      if (err) return callback(err);
      if (results.length > 0) {
        // Delete the used OTP
        db.query(
          "DELETE FROM phone_otps WHERE phone_number = ?",
          [phoneNumber],
          (deleteErr) => {
            if (deleteErr) console.error('Error deleting OTP:', deleteErr);
            callback(null, true);
          }
        );
      } else {
        callback(null, false);
      }
    }
  );
};

// Clean expired OTPs
const cleanExpiredOTPs = () => {
  db.query("DELETE FROM phone_otps WHERE expires_at <= NOW()", (err) => {
    if (err) console.error('Error cleaning expired OTPs:', err);
  });
};

// Update user profile (add email later)
const updateUserProfile = (userId, updates, callback) => {
  const allowedFields = ['email', 'fullname'];
  const fields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });
  
  if (fields.length === 0) {
    return callback(new Error('No valid fields to update'));
  }
  
  values.push(userId);
  const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
  
  db.query(query, values, callback);
};

const checkUsernameExists = (username, callback) => {
  const query =
    "SELECT COUNT(*) AS count FROM users WHERE username = ? AND role IN ('staff', 'manager')";
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Error checking username:", err);
      return callback(err);
    }
    callback(null, results[0].count > 0);
  });
};

const findUserByEmail = (email, callback) => {
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return callback(err);
    if (results.length > 0) return callback(null, results[0]);
    return callback(null, null);
  });
};

const findUserByEmailAndPassword = (email, password, callback) => {
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) {
      return callback(null, null);
    }
    bcrypt.compare(password, results[0].password, (err, isMatch) => {
      if (err) return callback(err);
      if (isMatch) {
        callback(null, results[0]);
      } else {
        callback(null, null);
      }
    });
  });
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
