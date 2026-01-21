const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "db.ruzentra.com",
  user: "ruzentra_huukbarber",
  password: "huukbarber02@",
  database: "ruzentra_huukbarber", // Replace with your actual DB name if different
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the pool connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to the database pool");
    connection.release();
  } catch (err) {
    console.error("Error connecting to the database:", err.message);
  }
})();

module.exports = pool;
