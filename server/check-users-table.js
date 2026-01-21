const mysql = require("mysql2/promise");

async function checkUsersTable() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "huuk"
    });

    console.log("Connected to database");

    // Check users table structure
    const [columns] = await connection.execute("DESCRIBE users");
    
    console.log("\n📋 Users table structure:");
    console.table(columns);
    
    // Check bookings table structure
    const [bookingColumns] = await connection.execute("DESCRIBE bookings");
    
    console.log("\n📋 Bookings table structure:");
    console.table(bookingColumns);
    
  } catch (error) {
    console.error("Error checking tables:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUsersTable();
