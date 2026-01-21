// Test file to verify timezone handling and filtering logic
// Run this with: node test_timezone_filtering.js

// Mock moment for testing
const moment = require('moment');

// Copy the extractDateOnly function from StaffAppointments.js
const extractDateOnly = (dateValue) => {
  if (!dateValue) return null;
  
  try {
    // Handle different date formats
    if (typeof dateValue === 'string') {
      // If it's already a simple date string (YYYY-MM-DD), return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      
      // If it contains 'T' (ISO timestamp), extract date part
      if (dateValue.includes('T')) {
        return dateValue.split('T')[0];
      }
      
      // Handle other date string formats
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
    
    // Handle Date objects
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }
    
    // Handle timestamp numbers
    if (typeof dateValue === 'number') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  } catch (error) {
    console.warn('Date extraction failed for:', dateValue, error);
  }
  
  return null;
};

// Test the filtering logic
const getFilteredAppointments = (appointments, selectedDate) => {
  if (!appointments || appointments.length === 0) {
    return [];
  }

  // Determine target date
  const targetDate = selectedDate || moment().format('YYYY-MM-DD');
  
  // Filter appointments for the target date
  const filtered = appointments.filter(appointment => {
    if (!appointment || !appointment.booking_date) {
      return false;
    }
    
    const appointmentDate = extractDateOnly(appointment.booking_date);
    return appointmentDate === targetDate;
  });
  
  return filtered;
};

// Test data - simulating the problematic scenario from your logs
const testAppointments = [
  {
    id: 1,
    booking_date: '2025-07-14T16:00:00.000Z', // UTC timestamp
    customer_name: 'John Doe',
    start_time: '10:00'
  },
  {
    id: 2,
    booking_date: '2025-07-16T08:00:00.000Z', // UTC timestamp
    customer_name: 'Jane Smith',
    start_time: '14:30'
  },
  {
    id: 3,
    booking_date: '2025-07-17T12:00:00.000Z', // UTC timestamp
    customer_name: 'Bob Johnson',
    start_time: '16:00'
  },
  {
    id: 4,
    booking_date: '2025-07-16', // Simple date string
    customer_name: 'Alice Brown',
    start_time: '11:00'
  },
  {
    id: 5,
    booking_date: new Date('2025-07-17'), // Date object
    customer_name: 'Charlie Wilson',
    start_time: '15:30'
  }
];

console.log('=== TIMEZONE FILTERING TEST ===\n');

// Test 1: Extract dates from different formats
console.log('1. Testing date extraction:');
testAppointments.forEach(apt => {
  const extractedDate = extractDateOnly(apt.booking_date);
  console.log(`   ID ${apt.id}: ${apt.booking_date} → ${extractedDate}`);
});

console.log('\n2. Testing filtering for specific dates:');

// Test 2: Filter for July 14, 2025
const july14Results = getFilteredAppointments(testAppointments, '2025-07-14');
console.log(`   July 14, 2025: ${july14Results.length} appointments`);
july14Results.forEach(apt => {
  console.log(`     - ${apt.customer_name} (${apt.start_time})`);
});

// Test 3: Filter for July 16, 2025
const july16Results = getFilteredAppointments(testAppointments, '2025-07-16');
console.log(`   July 16, 2025: ${july16Results.length} appointments`);
july16Results.forEach(apt => {
  console.log(`     - ${apt.customer_name} (${apt.start_time})`);
});

// Test 4: Filter for July 17, 2025
const july17Results = getFilteredAppointments(testAppointments, '2025-07-17');
console.log(`   July 17, 2025: ${july17Results.length} appointments`);
july17Results.forEach(apt => {
  console.log(`     - ${apt.customer_name} (${apt.start_time})`);
});

// Test 5: Filter for today (no selectedDate)
const todayResults = getFilteredAppointments(testAppointments, null);
const today = moment().format('YYYY-MM-DD');
console.log(`   Today (${today}): ${todayResults.length} appointments`);
todayResults.forEach(apt => {
  console.log(`     - ${apt.customer_name} (${apt.start_time})`);
});

console.log('\n3. Testing edge cases:');

// Test 6: Empty appointments array
const emptyResults = getFilteredAppointments([], '2025-07-16');
console.log(`   Empty array: ${emptyResults.length} appointments`);

// Test 7: Invalid date formats
const invalidAppointments = [
  { id: 1, booking_date: null, customer_name: 'Test 1' },
  { id: 2, booking_date: '', customer_name: 'Test 2' },
  { id: 3, booking_date: 'invalid-date', customer_name: 'Test 3' },
  { id: 4, booking_date: '2025-07-16T10:00:00.000Z', customer_name: 'Valid Test' }
];

const invalidResults = getFilteredAppointments(invalidAppointments, '2025-07-16');
console.log(`   Invalid dates handled: ${invalidResults.length} appointments`);
invalidResults.forEach(apt => {
  console.log(`     - ${apt.customer_name}`);
});

console.log('\n=== TEST COMPLETE ===');
console.log('Expected behavior:');
console.log('- UTC timestamps should be correctly extracted to YYYY-MM-DD format');
console.log('- Simple date strings should pass through unchanged');
console.log('- Date objects should be converted to YYYY-MM-DD format');
console.log('- Invalid dates should be filtered out');
console.log('- Filtering should work regardless of timezone differences');
