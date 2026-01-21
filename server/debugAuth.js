const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./config/database');

// Debug JWT token validation
async function debugJWTAuth() {
    console.log('=== JWT Authentication Debug ===\n');
    
    // First, let's check if we can find the JWT secret
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'; // Common fallback
    console.log('JWT Secret being used:', jwtSecret ? 'SET' : 'NOT SET');
    
    try {
        // Get a staff user from database to test with
        const [staffUsers] = await db.execute(`
            SELECT id, email, password, role, outlet_id 
            FROM users 
            WHERE role IN ('staff', 'manager') 
            LIMIT 1
        `);
        
        if (staffUsers.length === 0) {
            console.log('No staff/manager users found in database');
            return;
        }
        
        const testUser = staffUsers[0];
        console.log('Test user found:', {
            id: testUser.id,
            email: testUser.email,
            role: testUser.role,
            outlet_id: testUser.outlet_id
        });
        
        // Create a test JWT token for this user
        const testToken = jwt.sign(
            { 
                userId: testUser.id,
                role: testUser.role,
                outlet_id: testUser.outlet_id
            },
            jwtSecret,
            { expiresIn: '24h' }
        );
        
        console.log('Generated test token:', testToken);
        
        // Now try to verify the token
        try {
            const decoded = jwt.verify(testToken, jwtSecret);
            console.log('Token verification successful:', decoded);
            
            // Test the specific booking authorization for user ID 19
            if (testUser.id === 19) {
                console.log('\nTesting booking authorization for user 19:');
                const [bookings] = await db.execute(`
                    SELECT id, staff_id, date, time, status
                    FROM bookings 
                    WHERE id = 108 AND staff_id = ?
                `, [testUser.id]);
                
                console.log('Booking 108 authorization check:', bookings.length > 0 ? 'AUTHORIZED' : 'NOT AUTHORIZED');
                if (bookings.length > 0) {
                    console.log('Booking details:', bookings[0]);
                }
            }
            
        } catch (verifyError) {
            console.log('Token verification failed:', verifyError.message);
        }
        
    } catch (error) {
        console.error('Database error:', error);
    }
}

// Test the authentication middleware logic
async function testAuthMiddleware() {
    console.log('\n=== Authentication Middleware Test ===\n');
    
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    
    // Simulate the middleware logic
    const simulateAuth = (token) => {
        try {
            if (!token) {
                return { success: false, error: 'No token provided' };
            }
            
            // Remove Bearer prefix if present
            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            
            const decoded = jwt.verify(cleanToken, jwtSecret);
            return { 
                success: true, 
                userId: decoded.userId,
                role: decoded.role,
                outlet_id: decoded.outlet_id
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    // Test with different token formats
    console.log('Testing middleware simulation...');
    
    // Get a test user
    const [users] = await db.execute('SELECT id, role, outlet_id FROM users WHERE id = 19');
    if (users.length > 0) {
        const user = users[0];
        const testToken = jwt.sign(
            { 
                userId: user.id,
                role: user.role,
                outlet_id: user.outlet_id
            },
            jwtSecret,
            { expiresIn: '24h' }
        );
        
        console.log('Testing with Bearer token...');
        const bearerResult = simulateAuth(`Bearer ${testToken}`);
        console.log('Bearer token result:', bearerResult);
        
        console.log('Testing with raw token...');
        const rawResult = simulateAuth(testToken);
        console.log('Raw token result:', rawResult);
    }
}

// Check database connection and run tests
async function runDebug() {
    try {
        console.log('Testing database connection...');
        await db.execute('SELECT 1');
        console.log('Database connection: OK\n');
        
        await debugJWTAuth();
        await testAuthMiddleware();
        
    } catch (error) {
        console.error('Debug script error:', error);
    } finally {
        process.exit(0);
    }
}

runDebug();
