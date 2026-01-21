const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "huuk",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the pool connection (non-blocking)
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to the database pool successfully");
    connection.release();
  } catch (err) {
    console.error("Warning: Database connection failed:", err.message);
    console.log("App will continue running, but database features may not work");
  }
})();

module.exports = pool;
