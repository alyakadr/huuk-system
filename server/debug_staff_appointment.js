const jwt = require('jsonwebtoken');
require('dotenv').config();

// Test JWT token creation for debugging
function createTestToken(userId, role) {
  const payload = {
    userId: userId,
    role: role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET);
  console.log('Generated test token:', token);
  console.log('Token payload:', jwt.decode(token));
  return token;
}

// Create a test token for staff role
const testToken = createTestToken('1', 'staff');

console.log('\n=== TESTING TOKEN ===');
console.log('JWT_SECRET from env:', process.env.JWT_SECRET);
console.log('Test token created:', testToken);

// Test token verification
try {
  const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
  console.log('Token verification successful:', decoded);
} catch (error) {
  console.error('Token verification failed:', error.message);
}

// Test request payload
const testPayload = {
  service_id: 1,
  staff_id: 1,
  date: '2025-01-21',
  time: '10:00',
  customer_name: 'Test Customer',
  phone_number: '+60123456789'
};

console.log('\n=== TEST PAYLOAD ===');
console.log(JSON.stringify(testPayload, null, 2));

// Test individual field validation
const requiredFields = ['service_id', 'staff_id', 'date', 'time', 'customer_name'];
console.log('\n=== FIELD VALIDATION ===');
requiredFields.forEach(field => {
  const value = testPayload[field];
  console.log(`${field}: ${value !== undefined && value !== null && value !== '' ? 'PRESENT' : 'MISSING'} (${typeof value})`);
});
