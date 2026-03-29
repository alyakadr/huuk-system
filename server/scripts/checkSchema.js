require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require("mysql");

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "huuk",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
    return;
  }

  console.log("Connected as id", connection.threadId);

  const tables = ["slot_reservations", "users", "outlets", "services", "bookings"];

  tables.forEach((table) => {
    connection.query(`DESCRIBE ${table}`, (error, results) => {
      if (error) {
        console.error(`Error describing table ${table}:`, error.message);
      } else {
        console.log(`Schema for table ${table}:`);
        console.table(results);
      }
    });
  });

  connection.end();
});
