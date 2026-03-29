#!/usr/bin/env node

/**
 * SMS Testing Script
 * Tests different SMS modes: console, email, twilio
 */

require('dotenv').config();
const { sendBookingConfirmation } = require('../utils/smsService');

// Test booking details
const testBooking = {
  id: 12345,
  outlet: 'KL',
  service: 'Haircut',
  date: '08/07/2025',
  time: '14:30',
  staff_name: 'Ahmad',
  price: 25.00
};

const testPhoneNumber = '+601173130476';

async function testSMS() {
  console.log('=== SMS Service Test ===');
  console.log(`Current SMS_MODE: ${process.env.SMS_MODE || 'not set'}`);
  console.log(`Testing with phone: ${testPhoneNumber}`);
  console.log('');

  try {
    const result = await sendBookingConfirmation(testBooking, testPhoneNumber);
    console.log('SMS Result:', result);
    
    if (result.success) {
      console.log('✅ SMS sending successful!');
    } else {
      console.log('❌ SMS sending failed:', result.error || result.message);
    }
  } catch (error) {
    console.error('❌ SMS test failed:', error.message);
  }
}

// Instructions
console.log('SMS Testing Instructions:');
console.log('1. For console mode: SMS_MODE=console');
console.log('2. For email mode: SMS_MODE=email');
console.log('3. For Twilio mode: SMS_MODE=twilio (requires valid Twilio number)');
console.log('');

// Run test
testSMS();
