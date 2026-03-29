require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const payload = {
  userId: 1,
  role: 'staff'  // or 'admin' depending on your needs
};

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET environment variable is not set.');
  process.exit(1);
}
const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log('Generated JWT token:');
console.log(token);
