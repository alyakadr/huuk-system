const pool = require('./config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function diagnoseIssue() {
  let connection;
  try {
    console.log('=== DIAGNOSIS START ===');
    connection = await pool.getConnection();
    
    // Check if user ID 1 exists
    console.log('1. Checking if user ID 1 exists...');
    const [user] = await connection.query('SELECT id, username, role, outlet_id, isApproved FROM users WHERE id = 1');
    if (user.length > 0) {
      console.log('✅ User ID 1 found:', user[0]);
    } else {
      console.log('❌ User ID 1 not found');
      // Find any staff users
      const [staffUsers] = await connection.query('SELECT id, username, role, outlet_id, isApproved FROM users WHERE role IN ("staff", "manager") LIMIT 5');
      console.log('Available staff/manager users:', staffUsers);
    }
    
    // Check if service ID 1 exists
    console.log('\n2. Checking if service ID 1 exists...');
    const [service] = await connection.query('SELECT id, name, duration, price FROM services WHERE id = 1');
    if (service.length > 0) {
      console.log('✅ Service ID 1 found:', service[0]);
    } else {
      console.log('❌ Service ID 1 not found');
      // Find any services
      const [services] = await connection.query('SELECT id, name, duration, price FROM services LIMIT 5');
      console.log('Available services:', services);
    }
    
    // Check JWT token verification
    console.log('\n3. Testing JWT token verification...');
    const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwicm9sZSI6InN0YWZmIiwiaWF0IjoxNzUyOTgzMDYzLCJleHAiOjE3NTI5ODY2NjN9.mVwXM3oGtS56dCibBgrV7ihAhco2g6CdqXJHfGgNYrQ";
    try {
      const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
      console.log('✅ JWT token is valid:', decoded);
      
      // Check if the user from token exists
      const [tokenUser] = await connection.query('SELECT id, username, role FROM users WHERE id = ?', [decoded.userId]);
      if (tokenUser.length > 0) {
        console.log('✅ User from token exists:', tokenUser[0]);
      } else {
        console.log('❌ User from token does not exist in database');
      }
      
    } catch (jwtError) {
      console.log('❌ JWT token is invalid:', jwtError.message);
    }
    
    // Check if date format is acceptable
    console.log('\n4. Testing date/time validation...');
    const testDate = '2025-01-21';
    const testTime = '10:00';
    const slotStart = new Date(`${testDate}T${testTime}Z`);
    const operatingStart = new Date(`${testDate}T10:00:00Z`);
    const operatingEnd = new Date(`${testDate}T21:00:00Z`);
    
    console.log('Slot start:', slotStart.toISOString());
    console.log('Operating hours:', operatingStart.toISOString(), '-', operatingEnd.toISOString());
    console.log('Is slot within operating hours?', slotStart >= operatingStart && slotStart <= operatingEnd);
    
    console.log('\n=== DIAGNOSIS COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  } finally {
    if (connection) connection.release();
  }
}

diagnoseIssue();
