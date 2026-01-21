const { db } = require("../models/userModel");
const moment = require("moment");
const pool = require("../config/db");

// Check if the username exists
exports.checkUsernameExists = (req, res) => {
  const { username } = req.params;

  const query = "SELECT * FROM users WHERE username = ?";
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Error checking username:", err);
      return res
        .status(500)
        .json({ message: "Server error during username check." });
    }

    if (results.length > 0) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });
  });
};

// Check if the email exists
exports.checkEmailExists = (req, res) => {
  const { email } = req.body;

  const query = "SELECT * FROM users WHERE email = ?";
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error("Error checking email:", err);
      return res
        .status(500)
        .json({ message: "Server error during email check." });
    }

    if (results.length > 0) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });
  });
};

// Create new user (this logic might be in authController.js, but can be moved to userController.js)
exports.createUser = (req, res) => {
  const { email, password, fullname, username, userType, outlet } = req.body;

  const query =
    "INSERT INTO users (email, password, fullname, username, role, outlet) VALUES (?, ?, ?, ?, ?, ?)";

  db.query(
    query,
    [email, password, fullname, username, userType, outlet],
    (err, result) => {
      if (err) {
        console.error("Error creating user:", err);
        return res.status(500).json({ message: "Error creating user." });
      }

      res.status(201).json({
        message: "User created successfully.",
      });
    }
  );
};

// Get total number of customers
exports.getTotalCustomersAll = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer'"
    );
    console.log("Fetched total customers:", results[0].count);
    res.json({ count: results[0].count });
  } catch (err) {
    console.error("Error fetching total customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get total number of customers up to yesterday
exports.getTotalCustomersUpToYesterday = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND created_at < ?",
      [yesterday]
    );
    console.log("Fetched customers up to yesterday:", results[0].count);
    res.json({ count: results[0].count });
  } catch (err) {
    console.error("Error fetching customers up to yesterday:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get list of all customers
exports.getCustomerList = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT id, fullname, username, email, created_at FROM users WHERE role = 'customer'"
    );
    console.log("Fetched customer list:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching customer list:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
};
