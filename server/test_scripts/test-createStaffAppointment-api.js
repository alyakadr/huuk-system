const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test data for valid users (adjust these IDs based on your actual database)
const VALID_USERS = {
    MANAGER: { id: 19, role: 'manager' },
    STAFF: { id: 36, role: 'staff' }
};

// Generate JWT token for testing
function generateToken(userId, role = 'staff') {
    return jwt.sign(
        { userId: userId, role: role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// Test cases
const testCases = [
    {
        name: 'Valid booking creation - Manager',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            time: '10:00',
            customer_name: 'John Doe',
            phone_number: '+1234567890'
        },
        expectedStatus: 201
    },
    {
        name: 'Valid booking creation - Staff',
        user: VALID_USERS.STAFF,
        data: {
            service_id: 2,
            staff_id: 36,
            date: '2025-07-25',
            time: '11:00',
            customer_name: 'Jane Smith',
            phone_number: '+0987654321'
        },
        expectedStatus: 201
    },
    {
        name: 'Missing required field - service_id',
        user: VALID_USERS.MANAGER,
        data: {
            staff_id: 36,
            date: '2025-07-25',
            time: '12:00',
            customer_name: 'Test User',
            phone_number: '+1111111111'
        },
        expectedStatus: 400
    },
    {
        name: 'Missing required field - staff_id',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            date: '2025-07-25',
            time: '13:00',
            customer_name: 'Test User',
            phone_number: '+2222222222'
        },
        expectedStatus: 400
    },
    {
        name: 'Missing required field - date',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            time: '14:00',
            customer_name: 'Test User',
            phone_number: '+3333333333'
        },
        expectedStatus: 400
    },
    {
        name: 'Missing required field - time',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            customer_name: 'Test User',
            phone_number: '+4444444444'
        },
        expectedStatus: 400
    },
    {
        name: 'Missing required field - customer_name',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            time: '15:00',
            phone_number: '+5555555555'
        },
        expectedStatus: 400
    },
    {
        name: 'Missing required field - phone_number',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            time: '16:00',
            customer_name: 'Test User'
        },
        expectedStatus: 400
    },
    {
        name: 'Invalid date format',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: 'invalid-date',
            time: '17:00',
            customer_name: 'Test User',
            phone_number: '+6666666666'
        },
        expectedStatus: 400
    },
    {
        name: 'Past date',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2020-01-01',
            time: '18:00',
            customer_name: 'Test User',
            phone_number: '+7777777777'
        },
        expectedStatus: 400
    },
    {
        name: 'Invalid time format',
        user: VALID_USERS.MANAGER,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            time: 'invalid-time',
            customer_name: 'Test User',
            phone_number: '+8888888888'
        },
        expectedStatus: 400
    },
    {
        name: 'No authorization token',
        user: null,
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            time: '19:00',
            customer_name: 'Test User',
            phone_number: '+9999999999'
        },
        expectedStatus: 401
    },
    {
        name: 'Invalid JWT token',
        user: { id: 999, role: 'staff', invalidToken: true },
        data: {
            service_id: 1,
            staff_id: 36,
            date: '2025-07-25',
            time: '20:00',
            customer_name: 'Test User',
            phone_number: '+1010101010'
        },
        expectedStatus: 401
    }
];

// Run a single test case
async function runTestCase(testCase) {
    console.log(`\n🧪 Running test: ${testCase.name}`);
    console.log('📝 Test data:', JSON.stringify(testCase.data, null, 2));

    try {
        const headers = {};
        
        if (testCase.user) {
            if (testCase.user.invalidToken) {
                headers['Authorization'] = 'Bearer invalid-token-here';
            } else {
                const token = generateToken(testCase.user.id, testCase.user.role);
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await axios.post(
            `${BASE_URL}/api/bookings/staff/appointment`,
            testCase.data,
            { 
                headers,
                timeout: 10000 
            }
        );

        console.log(`✅ Response Status: ${response.status}`);
        console.log('📤 Response Data:', JSON.stringify(response.data, null, 2));

        if (response.status === testCase.expectedStatus) {
            console.log(`✅ PASS: Expected status ${testCase.expectedStatus}, got ${response.status}`);
            return { success: true, testCase: testCase.name };
        } else {
            console.log(`❌ FAIL: Expected status ${testCase.expectedStatus}, got ${response.status}`);
            return { success: false, testCase: testCase.name, reason: `Status mismatch` };
        }

    } catch (error) {
        const status = error.response?.status || 'Network Error';
        const errorData = error.response?.data || error.message;
        
        console.log(`📤 Error Status: ${status}`);
        console.log('📤 Error Data:', JSON.stringify(errorData, null, 2));

        if (status === testCase.expectedStatus) {
            console.log(`✅ PASS: Expected status ${testCase.expectedStatus}, got ${status}`);
            return { success: true, testCase: testCase.name };
        } else {
            console.log(`❌ FAIL: Expected status ${testCase.expectedStatus}, got ${status}`);
            return { success: false, testCase: testCase.name, reason: `Status mismatch` };
        }
    }
}

// Check if server is running
async function checkServerHealth() {
    try {
        console.log('🔍 Checking if server is running...');
        const response = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
        console.log('✅ Server is running and healthy');
        return true;
    } catch (error) {
        console.log('❌ Server is not responding. Please make sure the server is running on port 5000');
        console.log('💡 Start the server with: npm start');
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting createStaffAppointment API Tests');
    console.log('=' .repeat(60));

    // Check server health first
    const serverRunning = await checkServerHealth();
    if (!serverRunning) {
        process.exit(1);
    }

    const results = [];
    
    for (const testCase of testCases) {
        const result = await runTestCase(testCase);
        results.push(result);
        
        // Add a small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`  - ${result.testCase}: ${result.reason || 'Unknown error'}`);
        });
    }

    console.log('\n🏁 Tests completed!');
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Handle script termination
process.on('SIGINT', () => {
    console.log('\n⏹️  Tests interrupted by user');
    process.exit(1);
});

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('💥 Fatal error running tests:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, runTestCase, generateToken };
