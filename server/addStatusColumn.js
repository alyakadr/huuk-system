const db = require('./config/db');

async function addStatusColumn() {
  try {
    console.log('Adding status column to slot_reservations table...');
    
    // Add the status column as ENUM with default value 'reserved'
    const alterQuery = `
      ALTER TABLE slot_reservations 
      ADD COLUMN status ENUM('reserved', 'expired', 'released') NOT NULL DEFAULT 'reserved'
    `;
    
    await db.query(alterQuery);
    console.log('Successfully added status column to slot_reservations table');
    
    // Verify the column was added
    const [schema] = await db.query('DESCRIBE slot_reservations');
    console.log('Updated schema for slot_reservations:');
    console.table(schema);
    
  } catch (error) {
    console.error('Error adding status column:', error);
  } finally {
    process.exit(0);
  }
}

addStatusColumn();
