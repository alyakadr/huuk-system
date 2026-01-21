const {
  db,
  findUserByEmailAndPassword,
  findUserByEmail,
  createUser,
  updateUserApproval,
  checkUsernameExists,
} = require("../models/userModel");
const nodemailer = require("nodemailer");

// Sign-Up Controller
exports.signUp = (req, res) => {
  const { email, password, userType, fullname, outlet, username } = req.body;

  // If the user is a staff member or manager, outlet should be required
  if (userType === "staff" || userType === "manager") {
    if (!outlet) {
      return res.status(400).json({ message: "Outlet is required for staff." });
    }
  }

  // Check if userType is 'staff' or 'manager' and enforce uniqueness for staff
  if (userType === "staff" || userType === "manager") {
    checkUsernameExists(username, (err, exists) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Server error during username check." });
      }

      if (exists) {
        return res
          .status(400)
          .json({ message: "Username is already taken for staff." });
      }

      // Proceed with creating the staff account (manager or normal staff)
      createUser(
        email,
        password,
        userType,
        fullname,
        outlet,
        username,
        (err) => {
          if (err) {
            console.error("Error during user creation:", err);
            return res.status(500).json({ message: "Error during sign-up." });
          }
          res
            .status(200)
            .json({ message: `Sign-up successful for ${userType}!` });
        }
      );
    });
  } else if (userType === "customer") {
    // For customers, skip the username uniqueness check
    // Outlet is not required for customers
    createUser(email, password, "customer", fullname, null, username, (err) => {
      if (err) {
        console.error("Error during user creation:", err);
        return res.status(500).json({ message: "Error during sign-up." });
      }
      res.status(200).json({ message: "Sign-up successful for customer!" });
    });
  } else {
    return res
      .status(400)
      .json({
        message:
          "Invalid user type. Must be 'staff', 'manager', or 'customer'.",
      });
  }
};

// Sign-In Controller
exports.signIn = (req, res) => {
  const { email, password } = req.body;

  findUserByEmailAndPassword(email, password, (err, user) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed." });
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    if (!user.isApproved) {
      return res
        .status(400)
        .json({ message: "Please wait for manager approval." });
    }

    const responseUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullname: user.fullname,
      token: user.token || "", // Add real token generation if needed
    };

    res.status(200).json({ success: true, user: responseUser });
  });
};

// Check if username exists
exports.checkUsernameExists = (req, res) => {
  const { username } = req.params;

  const query = "SELECT * FROM users WHERE username = ?";
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Error checking username:", err);
      return res.status(500).json({ message: "Error checking username." });
    }

    if (results.length > 0) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });
  });
};

// Helper function to send approval email to manager
function sendApprovalEmail(email, userType) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: "2022611454@student.uitm.edu.my",
    to: "staff-email@example.com",
    subject: `New ${userType} Sign Up Pending Approval`,
    text: `A new ${userType} has signed up: ${email}. Please approve or reject the account.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending approval email:", error);
    } else {
      console.log("Approval email sent:", info.response);
    }
  });
}

// Helper function to send registration success email to user
function sendRegistrationSuccessEmail(userEmail) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER, // Set in environment variables for security
      pass: process.env.GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: userEmail,
    subject: "Your Registration is Successful",
    text: "Congratulations! Your account has been successfully registered and is now active.",
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending registration email:", error);
    } else {
      console.log("Registration email sent:", info.response);
    }
  });
}
