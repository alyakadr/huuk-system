const pool = require('../config/db');

async function updateDuration() {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, duration FROM services WHERE LOWER(name) LIKE '%coloring black hair%'"
    );
    if (rows.length === 0) {
      console.log('No service found with name containing "Coloring Black Hair"');
      return;
    }
    const service = rows[0];
    console.log('Before update:', service);
    const [result] = await pool.query(
      'UPDATE services SET duration = ? WHERE id = ?',
      [90, service.id]
    );
    if (result.affectedRows > 0) {
      const [updated] = await pool.query('SELECT id, name, duration FROM services WHERE id = ?', [service.id]);
      console.log('After update:', updated[0]);
      console.log('Duration updated successfully!');
    } else {
      console.log('Update failed.');
    }
  } catch (err) {
    console.error('Error updating duration:', err.message);
  } finally {
    pool.end();
  }
}

updateDuration(); 