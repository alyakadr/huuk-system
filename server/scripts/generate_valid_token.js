const jwt = require('jsonwebtoken');
require('dotenv').config();

// Create test tokens for actual users that exist in the database
function createTestToken(userId, role) {
  const payload = {
    userId: userId,
    role: role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET);
}

console.log('=== GENERATING VALID TOKENS ===');

// Create tokens for existing users
const staffToken = createTestToken('36', 'staff'); // JohnP1
const managerToken = createTestToken('19', 'manager'); // Yaya

console.log('\nStaff Token (User ID 36 - JohnP1):');
console.log(staffToken);

console.log('\nManager Token (User ID 19 - Yaya):');
console.log(managerToken);

// Verify tokens
console.log('\n=== VERIFICATION ===');
try {
  const staffDecoded = jwt.verify(staffToken, process.env.JWT_SECRET);
  console.log('Staff token verified:', staffDecoded);
} catch (error) {
  console.error('Staff token verification failed:', error.message);
}

try {
  const managerDecoded = jwt.verify(managerToken, process.env.JWT_SECRET);
  console.log('Manager token verified:', managerDecoded);
} catch (error) {
  console.error('Manager token verification failed:', error.message);
}
