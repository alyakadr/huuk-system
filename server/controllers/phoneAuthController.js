const {
  db,
  createCustomerWithPhone,
  findUserByPhone,
  storeOTP,
  verifyOTP,
  updateUserProfile,
} = require("../models/userModel");
const jwt = require("jsonwebtoken");
const {
  generateOTP,
  sendOTP,
  formatPhoneNumber,
} = require("../utils/smsService");

// Request OTP for phone number (sign up or sign in)
exports.requestOTP = async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phone_number);
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP in database
    storeOTP(formattedPhone, otp, async (err) => {
      if (err) {
        console.error("Error storing OTP:", err);
        return res.status(500).json({ message: "Failed to send OTP" });
      }

      try {
        // Send OTP via SMS
        await sendOTP(formattedPhone, otp);
        console.log(`OTP sent to ${formattedPhone}: ${otp}`); // Remove in production
        
        res.status(200).json({ 
          message: "OTP sent successfully",
          phone_number: formattedPhone
        });
      } catch (smsError) {
        console.error("SMS sending failed:", smsError);
        res.status(500).json({ 
          message: "Failed to send SMS. Please try again." 
        });
      }
    });
  } catch (error) {
    console.error("Error in requestOTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Verify OTP and sign up/sign in customer
exports.verifyOTPAndAuth = async (req, res) => {
  try {
    const { phone_number, otp, fullname } = req.body;

    if (!phone_number || !otp) {
      return res.status(400).json({ message: "Phone number and OTP are required" });
    }

    const formattedPhone = formatPhoneNumber(phone_number);

    // Verify OTP
    verifyOTP(formattedPhone, otp, (err, isValid) => {
      if (err) {
        console.error("Error verifying OTP:", err);
        return res.status(500).json({ message: "OTP verification failed" });
      }

      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Check if user already exists
      findUserByPhone(formattedPhone, (findErr, existingUser) => {
        if (findErr) {
          console.error("Error finding user:", findErr);
          return res.status(500).json({ message: "Authentication failed" });
        }

        if (existingUser) {
          // User exists - sign in
          const token = jwt.sign(
            { userId: existingUser.id, role: existingUser.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
          );

          const responseUser = {
            id: existingUser.id,
            phone_number: existingUser.phone_number,
            email: existingUser.email,
            role: existingUser.role,
            fullname: existingUser.fullname,
            token: token,
          };

          console.log(`User signed in: ${existingUser.id}`);
          res.status(200).json({ 
            success: true, 
            user: responseUser,
            message: "Sign in successful"
          });
        } else {
          // New user - sign up
          if (!fullname) {
            return res.status(400).json({ 
              message: "Full name is required for new users" 
            });
          }

          createCustomerWithPhone(formattedPhone, fullname, (createErr, result) => {
            if (createErr) {
              console.error("Error creating user:", createErr);
              return res.status(500).json({ message: "Failed to create account" });
            }

            const userId = result.insertId;
            const token = jwt.sign(
              { userId: userId, role: 'customer' },
              process.env.JWT_SECRET || 'fallback_secret',
              { expiresIn: '24h' }
            );

            const responseUser = {
              id: userId,
              phone_number: formattedPhone,
              email: null,
              role: 'customer',
              fullname: fullname,
              token: token,
            };

            console.log(`New customer created: ${userId}`);
            res.status(201).json({ 
              success: true, 
              user: responseUser,
              message: "Account created successfully"
            });
          });
        }
      });
    });
  } catch (error) {
    console.error("Error in verifyOTPAndAuth:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update customer profile (add email)
exports.updateProfile = async (req, res) => {
  try {
    const { email, fullname } = req.body;
    const userId = req.userId; // From auth middleware

    if (!email && !fullname) {
      return res.status(400).json({ message: "At least one field is required" });
    }

    const updates = {};
    if (email) updates.email = email;
    if (fullname) updates.fullname = fullname;

    updateUserProfile(userId, updates, (err, result) => {
      if (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ message: "Failed to update profile" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`Profile updated for user: ${userId}`);
      res.status(200).json({ 
        message: "Profile updated successfully",
        updated_fields: Object.keys(updates)
      });
    });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware

    db.query(
      "SELECT id, phone_number, email, fullname, role FROM users WHERE id = ?",
      [userId],
      (err, results) => {
        if (err) {
          console.error("Error fetching profile:", err);
          return res.status(500).json({ message: "Failed to fetch profile" });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const user = results[0];
        res.status(200).json({
          id: user.id,
          phone_number: user.phone_number,
          email: user.email,
          fullname: user.fullname,
          role: user.role,
        });
      }
    );
  } catch (error) {
    console.error("Error in getProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if phone number exists
exports.checkPhoneExists = async (req, res) => {
  try {
    const { phone_number } = req.params;
    
    if (!phone_number) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const formattedPhone = formatPhoneNumber(phone_number);

    findUserByPhone(formattedPhone, (err, user) => {
      if (err) {
        console.error("Error checking phone:", err);
        return res.status(500).json({ message: "Error checking phone number" });
      }

      res.status(200).json({ 
        exists: !!user,
        requires_signup: !user
      });
    });
  } catch (error) {
    console.error("Error in checkPhoneExists:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  requestOTP: exports.requestOTP,
  verifyOTPAndAuth: exports.verifyOTPAndAuth,
  updateProfile: exports.updateProfile,
  getProfile: exports.getProfile,
  checkPhoneExists: exports.checkPhoneExists,
};
