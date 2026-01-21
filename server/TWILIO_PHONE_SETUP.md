# Twilio Phone Number Setup

## Issue
The system is currently configured with `TWILIO_PHONE_NUMBER=+601173130476`, which appears to be a customer's phone number rather than a Twilio phone number. This causes the error:

```
'To' and 'From' number cannot be the same
```

## Solution

## FREE Options Available:

### Option 1: Development Mode (Immediate Fix)
Set `SMS_MODE=console` in your `.env` file. This will:
- Log SMS messages to the console instead of sending them
- Allow you to see what messages would be sent
- Perfect for development and testing
- No phone number required

### Option 2: Get a FREE Twilio Phone Number

**Option A: Free Trial Number (Recommended)**
1. Go to your [Twilio Console](https://console.twilio.com/)
2. If you haven't already, sign up for a free trial (includes $15 credit)
3. Navigate to **Phone Numbers** → **Manage** → **Buy a number**
4. Choose a number from Malaysia (+60) or your preferred country
5. The first number is FREE with your trial credit
6. Click "Buy" (it won't charge you, uses trial credit)

**Option B: Use Twilio's Free Trial Features**
- Your trial account comes with a free phone number
- You can send SMS to verified numbers only during trial
- After verification, you can send to any number

### Option 3: Alternative Free SMS Services

**A. TextBelt (Free)**
- 1 free SMS per day per IP
- No signup required
- US/Canada numbers only
- API: `https://textbelt.com/text`

**B. SMS Gateway using Email**
- Send SMS via email gateways (carrier-dependent)
- Examples: `phonenumber@txt.att.net`, `phonenumber@tmomail.net`
- Free but limited to specific carriers

**C. Firebase Cloud Messaging (FCM)**
- Free push notifications
- Requires mobile app integration
- Good for in-app notifications

### Step 2: Update Environment Variable
1. Open `server/.env` file
2. Replace the current `TWILIO_PHONE_NUMBER` with your purchased Twilio number
3. Example:
   ```
   TWILIO_PHONE_NUMBER=+60123456789  # Your actual Twilio number
   ```

### Step 3: Verify Configuration
1. Restart your server
2. Test SMS sending functionality
3. Check server logs for successful SMS delivery

## Important Notes
- **TWILIO_PHONE_NUMBER** must be a phone number purchased from Twilio
- It cannot be the same as any customer's phone number
- The number should be in E.164 format (e.g., +60123456789)
- Make sure the number supports SMS in your target country

## Error Handling
The system now includes better error handling for this issue:
- Pre-send validation to check if To/From numbers are the same
- Specific error messages for Twilio error code 21266
- Clear console warnings about proper phone number configuration

## Testing
To test SMS functionality:
1. Use a different phone number than your Twilio number
2. Create a booking to trigger SMS confirmation
3. Check server logs for successful SMS delivery
