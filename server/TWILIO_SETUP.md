# Twilio SMS Configuration Guide

## Issue Resolution
The SMS functionality was failing because Twilio credentials were missing from the `.env` file. This has been fixed with better error handling.

## Required Twilio Configuration

### 1. Get Twilio Account Credentials
1. Sign up for a Twilio account at https://www.twilio.com/try-twilio
2. Go to your Twilio Console Dashboard
3. Note down these three values:
   - **Account SID**: Starts with "AC..."
   - **Auth Token**: Your secret authentication token
   - **Phone Number**: Your Twilio phone number (starts with "+")

### 2. Update .env File
Add these three lines to your `server/.env` file:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcdef
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Example Configuration
```env
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcdef
TWILIO_AUTH_TOKEN=abcdef1234567890abcdef1234567890
TWILIO_PHONE_NUMBER=+14155552345
```

## Testing SMS Configuration

### Test with Node.js Script
Create a test file and run:

```javascript
require('dotenv').config();
const { sendTestSMS } = require('./utils/smsService');

sendTestSMS('+1234567890') // Replace with your phone number
  .then(result => console.log('SMS Test Result:', result))
  .catch(error => console.error('SMS Test Failed:', error));
```

### Current Behavior Without Configuration
- ✅ System continues to work normally
- ⚠️ SMS messages are logged to console instead of being sent
- 📱 No actual SMS delivery occurs
- 📝 All SMS content is visible in server logs for debugging

## SMS Features in the System

1. **Booking Confirmations**: Sent after successful booking
2. **OTP Verification**: For phone-based authentication
3. **Appointment Reminders**: 24h and 1h before appointments
4. **Cancellation Notifications**: When bookings are cancelled
5. **Reschedule Confirmations**: When appointments are rescheduled

## Troubleshooting

### Common Error Codes
- **20003**: Authentication failed (check SID and Auth Token)
- **21608**: Invalid phone number format
- **21211**: Invalid "To" phone number
- **21610**: Message cannot be sent to landline number

### Error Handling Improvements
- ✅ Graceful fallback when Twilio not configured
- ✅ Detailed error logging with specific error codes
- ✅ Console logging of SMS content for debugging
- ✅ System continues normal operation without SMS

## Production Recommendations

1. **Use Twilio Production Credentials** (not trial)
2. **Verify Phone Numbers** are in correct E.164 format
3. **Monitor SMS Delivery** through Twilio Console
4. **Set Up Webhooks** for delivery status (optional)
5. **Configure Rate Limiting** to prevent spam

## Cost Considerations

- **Trial Account**: Limited free credits
- **Production**: Pay per SMS sent
- **Malaysian Numbers**: Ensure international SMS is enabled
- **Budget Alerts**: Set up in Twilio Console

## Security Notes

- ✅ Never commit Twilio credentials to Git
- ✅ Use environment variables only
- ✅ Rotate Auth Tokens periodically
- ✅ Monitor usage for unusual activity
