const jwt = require('jsonwebtoken');

const payload = {
  userId: 1,
  role: 'staff'  // or 'admin' depending on your needs
};

const secret = 'mySuperSecretKey123!@#';
const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log('Generated JWT token:');
console.log(token);
