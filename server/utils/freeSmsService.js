const nodemailer = require('nodemailer');
const axios = require('axios');

// SMS email gateways - trying multiple approaches
// Note: Email-to-SMS gateways are experimental and success depends on carrier support
const SMS_EMAIL_GATEWAYS = {
  // Malaysian carriers (experimental)
  'maxis': '@maxis.com.my',
  'celcom': '@celcom.com.my', 
  'digi': '@digi.com.my',
  'umobile': '@u.com.my',
  'hotlink': '@hotlink.com.my',
  'tunetalk': '@tunetalk.com',
  'redone': '@redone.com.my',
  
  // International SMS gateways (more likely to work)
  'textbelt': '@txt.textbelt.com',
  'email2sms': '@email2sms.com',
  'smsemail': '@sms.email.com',
  
  // Backup generic gateways
  'generic1': '@sms.gateway.com',
  'generic2': '@txt.gateway.com'
};

// Create transporter using existing Gmail config
const createTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.error('Gmail credentials not configured');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
};

/**
 * Send SMS using TextBelt free API (1 free SMS per day per number)
 * @param {string} phoneNumber - Phone number
 * @param {string} message - SMS message
 * @returns {Promise<Object>} SMS send result
 */
const sendViaTextBelt = async (phoneNumber, message) => {
  try {
    // Add timeout to prevent hanging
    const response = await axios.post('https://textbelt.com/text', {
      phone: phoneNumber,
      message: message,
      key: 'textbelt' // Free quota key
    }, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log(`✅ SMS sent via TextBelt to ${phoneNumber}`);
      return { 
        success: true, 
        provider: 'textbelt', 
        data: response.data,
        message: 'SMS sent successfully via TextBelt'
      };
    } else {
      console.error('❌ TextBelt SMS failed:', response.data.error);
      
      // Handle specific TextBelt errors
      let errorMessage = response.data.error;
      if (response.data.error && response.data.error.includes('quota')) {
        errorMessage = 'TextBelt daily quota exceeded (1 free SMS per day)';
        console.warn('⚠️ TextBelt quota exceeded. Consider upgrading to paid plan or configuring alternative SMS provider.');
      }
      
      return { 
        success: false, 
        error: response.data.error,
        provider: 'textbelt',
        message: `TextBelt error: ${errorMessage}`
      };
    }
  } catch (error) {
    console.error('❌ TextBelt API error:', error.message);
    
    // Handle specific error types
    let errorMessage = 'Unknown TextBelt error';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'TextBelt request timed out';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'TextBelt service unavailable';
    } else if (error.response) {
      errorMessage = `TextBelt server error: ${error.response.status}`;
    } else {
      errorMessage = error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      provider: 'textbelt',
      message: `Failed to send SMS via TextBelt: ${errorMessage}`
    };
  }
};

/**
 * Send SMS via email gateway (free alternative)
 * @param {string} phoneNumber - Phone number 
 * @param {string} message - SMS message
 * @param {string} carrier - Carrier name (optional)
 * @returns {Promise<Object>} SMS send result
 */
const sendSMSViaEmail = async (phoneNumber, message, carrier = null) => {
  try {
    // Try TextBelt first (more reliable, 1 free SMS per day)
    console.log('Trying TextBelt API first...');
    const textbeltResult = await sendViaTextBelt(phoneNumber, message);
    if (textbeltResult.success) {
      return textbeltResult;
    }
    
    console.log('TextBelt failed, trying email gateways...');
    
    const transporter = createTransporter();
    if (!transporter) {
      return {
        success: false,
        error: 'Email transporter not configured',
        message: 'Gmail credentials required for SMS via email'
      };
    }

    // Extract phone number without country code and formatting
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const localNumber = cleanNumber.startsWith('60') ? 
      cleanNumber.substring(2) : cleanNumber;

    // If carrier specified, use it; otherwise try multiple carriers
    const carriersToTry = carrier ? 
      [SMS_EMAIL_GATEWAYS[carrier.toLowerCase()]] : 
      Object.values(SMS_EMAIL_GATEWAYS);

    const results = [];
    
    for (const carrierGateway of carriersToTry) {
      if (!carrierGateway) continue;
      
      const emailAddress = `${localNumber}${carrierGateway}`;
      
      try {
        const info = await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: emailAddress,
          subject: '', // SMS gateways prefer empty subject
          text: message
        });

        results.push({
          carrier: carrierGateway,
          success: true,
          messageId: info.messageId
        });

        console.log(`SMS sent via email to ${emailAddress}: ${info.messageId}`);
        
        // If one succeeds, we can stop (or continue to try all)
        if (carrier) break; // Stop if specific carrier was requested
        
      } catch (error) {
        results.push({
          carrier: carrierGateway,
          success: false,
          error: error.message
        });
        
        console.warn(`Failed to send SMS via ${emailAddress}: ${error.message}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      results,
      successCount,
      message: successCount > 0 ? 
        `SMS sent via email to ${successCount} carriers` : 
        'Failed to send SMS via email to any carrier'
    };

  } catch (error) {
    console.error('SMS via email failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send SMS via email'
    };
  }
};

/**
 * Send booking confirmation SMS via email gateway
 * @param {Object} bookingDetails - Booking details
 * @param {string} phoneNumber - Phone number
 * @param {string} carrier - Carrier name (optional)
 * @returns {Promise<Object>} SMS send result
 */
const sendBookingConfirmationViaEmail = async (bookingDetails, phoneNumber, carrier = null) => {
  const message = `Booking confirmed! ${bookingDetails.service} at ${bookingDetails.outlet} on ${bookingDetails.date} ${bookingDetails.time}. Staff: ${bookingDetails.staff_name}. Total: RM${bookingDetails.price}. Ref: #${bookingDetails.id}`;
  
  return await sendSMSViaEmail(phoneNumber, message, carrier);
};

module.exports = {
  sendSMSViaEmail,
  sendBookingConfirmationViaEmail,
  sendViaTextBelt,
  SMS_EMAIL_GATEWAYS
};
