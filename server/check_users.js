const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'huuk'
    });

    console.log('🔌 Connected to database...');

    const [users] = await connection.execute(
      'SELECT id, fullname, email, role FROM users WHERE role = "customer" LIMIT 5'
    );
    
    console.log('👥 Available customer users:');
    users.forEach(u => {
      console.log(`  ID: ${u.id}, Name: ${u.fullname}, Email: ${u.email}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUsers();
