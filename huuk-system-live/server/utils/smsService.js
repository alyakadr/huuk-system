const twilio = require('twilio');

// Check if Twilio configuration is available
const isConfigured = () => {
  return !!(process.env.TWILIO_ACCOUNT_SID && 
            process.env.TWILIO_AUTH_TOKEN && 
            process.env.TWILIO_PHONE_NUMBER);
};

// Initialize Twilio client only if properly configured
let client = null;
if (isConfigured()) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio SMS service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error.message);
  }
} else {
  console.warn('Twilio SMS service not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env file');
}

// Character limit for SMS (160 chars for single SMS, but considering encoding issues, use 150)
const SMS_CHAR_LIMIT = 150;

/**
 * Split long messages into multiple SMS parts if they exceed character limit
 * @param {string} message - The message to split
 * @returns {Array<string>} Array of message parts
 */
const splitMessage = (message) => {
  if (message.length <= SMS_CHAR_LIMIT) {
    return [message];
  }

  const parts = [];
  const words = message.split(' ');
  let currentPart = '';

  for (const word of words) {
    const testPart = currentPart ? `${currentPart} ${word}` : word;
    
    if (testPart.length <= SMS_CHAR_LIMIT) {
      currentPart = testPart;
    } else {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = word;
      } else {
        // Single word is too long, we need to truncate it
        parts.push(word.substring(0, SMS_CHAR_LIMIT));
        currentPart = '';
      }
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts;
};

/**
 * Send SMS to a phone number
 * @param {string} phoneNumber - Phone number in E.164 format
 * @param {string} message - Message to send
 * @returns {Promise<Object>} SMS send result
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    // Development mode: Just log SMS instead of sending
    if (process.env.NODE_ENV === 'development' || process.env.SMS_MODE === 'console') {
      console.log('=== SMS WOULD BE SENT ===');
      console.log(`To: ${phoneNumber}`);
      console.log(`Message: ${message}`);
      console.log('========================');
      return { 
        success: true, 
        message: 'SMS logged to console (development mode)',
        parts: 1 
      };
    }
    
    // If SMS service is disabled or has limitations, still log the attempt
    if (process.env.SMS_DISABLED === 'true') {
      console.log(`SMS service disabled. Would send to ${phoneNumber}: ${message}`);
      return { 
        success: true, 
        message: 'SMS service disabled but booking confirmed',
        parts: 1 
      };
    }

    // TextBelt mode: Send SMS via TextBelt API (free alternative)
    if (process.env.SMS_MODE === 'textbelt') {
      const { sendViaTextBelt } = require('./freeSmsService');
      console.log('Sending SMS via TextBelt API');
      return await sendViaTextBelt(phoneNumber, message);
    }

    // Email gateway mode: Send SMS via email (free alternative)
    if (process.env.SMS_MODE === 'email') {
      const { sendSMSViaEmail } = require('./freeSmsService');
      const carrier = process.env.SMS_CARRIER || null;
      console.log(`Sending SMS via email gateway (carrier: ${carrier || 'all'})`);
      return await sendSMSViaEmail(phoneNumber, message, carrier);
    }

    // Check if Twilio is configured
    if (!isConfigured()) {
      console.warn(`SMS not sent to ${phoneNumber}: Twilio not configured`);
      console.warn(`Message would have been: ${message}`);
      return { 
        success: false, 
        error: 'SMS service not configured', 
        message: 'Twilio credentials not provided',
        parts: 1 
      };
    }

    if (!client) {
      throw new Error('Twilio client not initialized');
    }

    // Check if 'To' and 'From' numbers are the same
    const formattedToNumber = formatPhoneNumber(phoneNumber);
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (formattedToNumber === fromNumber) {
      console.error(`SMS Error: 'To' and 'From' numbers are the same: ${formattedToNumber}`);
      console.error('Please ensure TWILIO_PHONE_NUMBER is set to a valid Twilio number, not a customer number');
      return { 
        success: false, 
        error: 'Invalid phone number configuration', 
        message: 'To and From numbers cannot be the same',
        parts: 1 
      };
    }

    const messageParts = splitMessage(message);
    const results = [];

    for (let i = 0; i < messageParts.length; i++) {
      const part = messageParts[i];
      const partMessage = messageParts.length > 1 
        ? `(${i + 1}/${messageParts.length}) ${part}` 
        : part;

      const result = await client.messages.create({
        body: partMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      results.push(result);
      
      // Add small delay between parts to ensure they arrive in order
      if (i < messageParts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`SMS sent successfully to ${phoneNumber}. Parts: ${messageParts.length}`);
    return { success: true, results, parts: messageParts.length };
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    
    // More specific error handling
    if (error.code === 20003) {
      console.error('Twilio authentication failed - check ACCOUNT_SID and AUTH_TOKEN');
    } else if (error.code === 21608) {
      console.error('Invalid phone number format');
    } else if (error.code === 21211) {
      console.error('Invalid "To" phone number');
    } else if (error.code === 21266) {
      console.error('Twilio Error 21266: "To" and "From" numbers cannot be the same');
      console.error('Please ensure TWILIO_PHONE_NUMBER is set to a valid Twilio number, not a customer number');
    } else if (error.code === 21622) {
      console.error('Twilio Error 21622: Trial account limitation - only verified numbers can receive SMS');
      console.error('This is a Twilio trial account limitation, not a system error');
      return { 
        success: false, 
        error: 'SMS service limitation', 
        message: 'SMS not sent due to trial account restrictions, but booking is confirmed',
        parts: 1 
      };
    } else if (error.message && error.message.includes('trial')) {
      console.error('Twilio trial account limitation:', error.message);
      return { 
        success: false, 
        error: 'SMS service limitation', 
        message: 'SMS not sent due to trial account restrictions, but booking is confirmed',
        parts: 1 
      };
    }
    
    throw error;
  }
};

/**
 * Generate a 6-digit OTP
 * @returns {string} OTP code
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Format phone number to E.164 format (assumes Malaysian numbers)
 * @param {string} phoneNumber - Phone number
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digits
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If starts with 60, it's already in international format
  if (cleaned.startsWith('60')) {
    return `+${cleaned}`;
  }
  
  // If starts with 0, remove it and add +60
  if (cleaned.startsWith('0')) {
    return `+60${cleaned.substring(1)}`;
  }
  
  // If it's just the number without country code, add +60
  if (cleaned.length >= 9 && cleaned.length <= 10) {
    return `+60${cleaned}`;
  }
  
  // If none of the above, assume it needs +60
  return `+60${cleaned}`;
};

/**
 * Send OTP SMS
 * @param {string} phoneNumber - Phone number
 * @param {string} otp - OTP code
 * @returns {Promise<Object>} SMS send result
 */
const sendOTP = async (phoneNumber, otp) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const message = `Your Huuk System verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;
  
  return await sendSMS(formattedPhone, message);
};

/**
 * Send booking confirmation SMS
 * @param {Object} bookingDetails - Booking details
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} SMS send result
 */
const sendBookingConfirmation = async (bookingDetails, phoneNumber) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const message = `Booking confirmed! ${bookingDetails.service} at ${bookingDetails.outlet} on ${bookingDetails.date} ${bookingDetails.time}. Staff: ${bookingDetails.staff_name}. Total: RM${bookingDetails.price}. Ref: #${bookingDetails.id}`;
  
  return await sendSMS(formattedPhone, message);
};

/**
 * Send appointment reminder SMS
 * @param {Object} bookingDetails - Booking details
 * @param {string} phoneNumber - Phone number
 * @param {string} reminderType - Type of reminder ('24h' or '1h')
 * @returns {Promise<Object>} SMS send result
 */
const sendAppointmentReminder = async (bookingDetails, phoneNumber, reminderType) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const timeMessage = reminderType === '24h' ? 'tomorrow' : 'in 1 hour';
  const message = `Reminder: You have an appointment ${timeMessage} - ${bookingDetails.service} at ${bookingDetails.outlet} on ${bookingDetails.date} ${bookingDetails.time}. Staff: ${bookingDetails.staff_name}. Ref: #${bookingDetails.id}`;
  
  return await sendSMS(formattedPhone, message);
};

/**
 * Send cancellation SMS
 * @param {Object} bookingDetails - Booking details
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} SMS send result
 */
const sendCancellationSMS = async (bookingDetails, phoneNumber) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const message = `Your appointment has been cancelled - ${bookingDetails.service} at ${bookingDetails.outlet} on ${bookingDetails.date} ${bookingDetails.time}. Ref: #${bookingDetails.id}. To reschedule, please contact us or book online.`;
  
  return await sendSMS(formattedPhone, message);
};

/**
 * Send missed appointment SMS
 * @param {Object} bookingDetails - Booking details
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} SMS send result
 */
const sendMissedAppointmentSMS = async (bookingDetails, phoneNumber) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const message = `You missed your appointment - ${bookingDetails.service} at ${bookingDetails.outlet} on ${bookingDetails.date} ${bookingDetails.time}. Ref: #${bookingDetails.id}. To reschedule, please contact us or book online.`;
  
  return await sendSMS(formattedPhone, message);
};

/**
 * Send reschedule confirmation SMS
 * @param {Object} bookingDetails - Booking details
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} SMS send result
 */
const sendRescheduleConfirmationSMS = async (bookingDetails, phoneNumber) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const message = `Appointment rescheduled! ${bookingDetails.service} at ${bookingDetails.outlet} on ${bookingDetails.date} ${bookingDetails.time}. Staff: ${bookingDetails.staff_name}. Total: RM${bookingDetails.price}. Ref: #${bookingDetails.id}`;
  
  return await sendSMS(formattedPhone, message);
};

/**
 * Test SMS delivery (for system testing)
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} SMS send result
 */
const sendTestSMS = async (phoneNumber) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const message = 'Test message from Huuk System. SMS notifications are working correctly.';
  
  return await sendSMS(formattedPhone, message);
};

module.exports = {
  sendSMS,
  generateOTP,
  formatPhoneNumber,
  sendOTP,
  sendBookingConfirmation,
  sendAppointmentReminder,
  sendCancellationSMS,
  sendMissedAppointmentSMS,
  sendRescheduleConfirmationSMS,
  sendTestSMS,
  splitMessage
};
