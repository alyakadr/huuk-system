// Test script to verify time normalization function

// Normalize time to HH:MM format
const normalizeTime = (time) => {
  if (!time) return "";
  
  // If it's already in HH:MM format, return as is
  if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  
  // If it's HH:MM:SS format, extract HH:MM
  if (typeof time === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time.substring(0, 5);
  }
  
  // If it's a different format, try to parse and format
  try {
    const date = new Date(`1970-01-01T${time}`);
    return date.toTimeString().substring(0, 5);
  } catch (error) {
    console.warn('Failed to normalize time:', time);
    return time;
  }
};

// Test cases
const testCases = [
  '17:30',
  '17:30:00',
  '09:45',
  '09:45:00',
  '21:15',
  '21:15:00'
];

console.log('=== TIME NORMALIZATION TEST ===');
testCases.forEach(time => {
  const normalized = normalizeTime(time);
  console.log(`${time} -> ${normalized}`);
});

// Test availability check
const availableSlots = ['16:45', '17:30', '19:15', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30'];
const selectedTime = '17:30';

const normalizedSelectedTime = normalizeTime(selectedTime);
const normalizedAvailableSlots = availableSlots.map(slot => normalizeTime(slot));

console.log('\n=== AVAILABILITY CHECK TEST ===');
console.log('Selected time:', selectedTime);
console.log('Normalized selected time:', normalizedSelectedTime);
console.log('Available slots:', availableSlots);
console.log('Normalized available slots:', normalizedAvailableSlots);
console.log('Is available?', normalizedAvailableSlots.includes(normalizedSelectedTime));
