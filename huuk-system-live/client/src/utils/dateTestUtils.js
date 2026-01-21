// Date Testing Utility to verify fixes
// Run this in browser console to test date calculations

export const testDateCalculations = () => {
  console.log('=== DATE CALCULATION TEST ===');
  
  // Test current week calculation
  const weekStart = new Date(2025, 6, 20); // July 20, 2025 (Sunday)
  console.log('Week start:', weekStart.toDateString());
  
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dates = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    
    // Fixed date formatting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;
    
    const dateObj = {
      date: localDateString,
      display: `${dayNames[date.getDay()]} ${date.getDate()}`,
      fullDate: date,
    };
    dates.push(dateObj);
    console.log(`Day ${i}: ${dateObj.display} -> ${dateObj.date}`);
  }
  
  console.log('Final dates array:', dates);
  
  // Test booking date extraction
  console.log('\n=== BOOKING DATE EXTRACTION TEST ===');
  
  const testBookings = [
    { date: '2025-07-18T16:00:00.000Z', customer: 'Test 1' },
    { date: '2025-07-19T16:00:00.000Z', customer: 'Test 2' },
    { date: '2025-07-20', customer: 'Test 3' },
  ];
  
  testBookings.forEach(booking => {
    let bookingDateOnly;
    if (booking.date.includes('T')) {
      bookingDateOnly = booking.date.split('T')[0];
    } else {
      bookingDateOnly = booking.date;
    }
    console.log(`Original: ${booking.date} -> Extracted: ${bookingDateOnly}`);
  });
  
  // Test daily view filtering for July 20, 2025
  console.log('\n=== DAILY FILTER TEST FOR 2025-07-20 ===');
  const selectedDate = '2025-07-20';
  
  testBookings.forEach(booking => {
    let bookingDateOnly = booking.date.includes('T') 
      ? booking.date.split('T')[0] 
      : booking.date;
    
    const matches = bookingDateOnly === selectedDate;
    console.log(`${booking.customer}: ${bookingDateOnly} === ${selectedDate} = ${matches}`);
  });
  
  return {
    weekDates: dates,
    testBookings,
    selectedDate
  };
};

// Test API endpoint construction
export const testAPIEndpoints = () => {
  console.log('=== API ENDPOINT TEST ===');
  
  const API_BASE_URL = 'http://localhost:5000/api';
  const currentDate = new Date(2025, 6, 20); // July 20, 2025
  
  // Format date for API
  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Test weekly range
  const weekStart = new Date(2025, 6, 20); // July 20, 2025
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDates.push(formatDateForAPI(date));
  }
  
  const startDate = weekDates[0];
  const endDate = weekDates[6];
  
  console.log('Week range:', `${startDate} to ${endDate}`);
  console.log('Bookings API:', `${API_BASE_URL}/bookings/staff/bookings?startDate=${startDate}&endDate=${endDate}`);
  console.log('Services API:', `${API_BASE_URL}/users/services`);
  
  return {
    startDate,
    endDate,
    bookingsAPI: `${API_BASE_URL}/bookings/staff/bookings?startDate=${startDate}&endDate=${endDate}`,
    servicesAPI: `${API_BASE_URL}/users/services`
  };
};

// Browser console helper
window.testBookingDates = testDateCalculations;
window.testAPIEndpoints = testAPIEndpoints;

console.log('Date testing utilities loaded. Run testBookingDates() or testAPIEndpoints() in console.');
