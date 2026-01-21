// Token debugging utility
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5000/api';
const TOKEN_TYPES = ['staff_token', 'customer_token', 'token'];

// Check if running in browser or Node.js
const isBrowser = typeof window !== 'undefined';

// Function to get tokens from localStorage or from command line args
const getTokens = () => {
  const tokens = {};
  
  if (isBrowser) {
    // Browser environment
    TOKEN_TYPES.forEach(tokenType => {
      const token = localStorage.getItem(tokenType);
      if (token) {
        tokens[tokenType] = token;
      }
    });
  } else {
    // Node.js environment - get token from command line args
    const args = process.argv.slice(2);
    if (args.length >= 2) {
      const tokenType = args[0];
      const tokenValue = args[1];
      tokens[tokenType] = tokenValue;
    }
  }
  
  return tokens;
};

// Function to decode JWT token without verification
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return { error: 'Invalid token format' };
  }
};

// Function to validate token against server
const validateToken = async (tokenType, token) => {
  try {
    const response = await axios.get(`${API_URL}/users/validate-token`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return {
      valid: true,
      serverResponse: response.data
    };
  } catch (error) {
    return {
      valid: false,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    };
  }
};

// Main function to check tokens
const checkTokens = async () => {
  const tokens = getTokens();
  console.log('Available tokens:', Object.keys(tokens));
  
  for (const [tokenType, token] of Object.entries(tokens)) {
    console.log(`\n=== Checking ${tokenType} ===`);
    
    // Decode token locally
    const decoded = decodeToken(token);
    console.log('Decoded payload:', decoded);
    
    // Calculate expiration
    if (decoded.exp) {
      const expirationDate = new Date(decoded.exp * 1000);
      const now = new Date();
      const isExpired = now > expirationDate;
      
      console.log('Expiration:', expirationDate.toLocaleString());
      console.log('Current time:', now.toLocaleString());
      console.log('Status:', isExpired ? 'EXPIRED' : 'VALID');
      console.log('Time remaining:', isExpired ? 'EXPIRED' : `${Math.floor((expirationDate - now) / 1000 / 60)} minutes`);
    }
    
    // Validate against server
    console.log('\nValidating with server...');
    const validationResult = await validateToken(tokenType, token);
    console.log('Server validation result:', validationResult);
  }
};

// Run the check
if (isBrowser) {
  // In browser, expose as global function
  window.checkTokens = checkTokens;
  console.log('Token check utility loaded. Run checkTokens() to validate tokens.');
} else {
  // In Node.js, run immediately
  checkTokens().catch(error => {
    console.error('Error:', error.message);
  });
}

// Export for module usage
module.exports = { checkTokens, decodeToken, validateToken };
