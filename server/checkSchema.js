const mysql = require("mysql");

const connection = mysql.createConnection({
  host: "localhost", // Update with your hostname if different
  user: "root", // Update with your database username
  password: "", // Update with your database password
  database: "huuk", // Ensure this matches your database name
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
