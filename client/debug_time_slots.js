const axios = require('axios');

// Test the time slots API endpoint directly
async function testTimeSlotsAPI() {
  try {
    console.log('🔍 Testing Time Slots API...\n');
    
    // Test parameters (you may need to adjust these based on your actual data)
    const testParams = {
      date: '2025-01-15', // tomorrow
      outlet_id: 1,      // adjust based on your outlets
      service_id: 1,     // adjust based on your services
      staff_id: 1        // adjust based on your staff
    };
    
    console.log('📋 Test parameters:', testParams);
    
    // First, test without authentication to see what happens
    console.log('\n1. Testing without authentication...');
    try {
      const response1 = await axios.get('http://localhost:5000/api/bookings/available-slots', {
        params: testParams
      });
      console.log('✅ Response without auth:', response1.data);
    } catch (error) {
      console.log('❌ Error without auth:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Test outlets endpoint
    console.log('\n2. Testing outlets endpoint...');
    try {
      const outletsResponse = await axios.get('http://localhost:5000/api/bookings/outlets');
      console.log('✅ Available outlets:', outletsResponse.data.length, 'outlets');
      console.log('First 3 outlets:', outletsResponse.data.slice(0, 3));
    } catch (error) {
      console.log('❌ Outlets error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Test services endpoint
    console.log('\n3. Testing services endpoint...');
    try {
      const servicesResponse = await axios.get('http://localhost:5000/api/bookings/services');
      console.log('✅ Available services:', servicesResponse.data.length, 'services');
      console.log('First 3 services:', servicesResponse.data.slice(0, 3));
    } catch (error) {
      console.log('❌ Services error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Test staff endpoint
    console.log('\n4. Testing staff endpoint...');
    try {
      const staffResponse = await axios.get('http://localhost:5000/api/bookings/available-staff', {
        params: { outlet_id: testParams.outlet_id, date: testParams.date }
      });
      console.log('✅ Available staff:', staffResponse.data.length, 'staff members');
      console.log('First 3 staff:', staffResponse.data.slice(0, 3));
    } catch (error) {
      console.log('❌ Staff error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    console.log('\n🏁 Test completed!');
    console.log('\n📝 DIAGNOSIS:');
    console.log('If you see "401 Unauthorized" errors, you need to be logged in first.');
    console.log('If endpoints return empty arrays, check your database data.');
    console.log('If time slots are empty but other endpoints work, check your staff schedules.');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

// Run the test
testTimeSlotsAPI();
