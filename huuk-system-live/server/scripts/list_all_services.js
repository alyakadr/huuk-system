const pool = require('../config/db');

async function listAllServices() {
  try {
    const [rows] = await pool.query('SELECT id, name, duration FROM services ORDER BY name');
    if (rows.length === 0) {
      console.log('No services found.');
      return;
    }
    console.log('All services:');
    rows.forEach(service => {
      console.log(`ID: ${service.id} | Name: ${service.name} | Duration: ${service.duration}`);
    });
  } catch (err) {
    console.error('Error fetching services:', err.message);
  } finally {
    pool.end();
  }
}

listAllServices(); 