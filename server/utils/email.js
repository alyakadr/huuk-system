const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Verify SMTP configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP configuration error:", {
      message: error.message,
      stack: error.stack,
    });
  } else {
    console.log("SMTP server is ready to send emails");
  }
});

const validateRecipientEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }
};

const sendStaffPasswordResetEmail = async ({ email, fullname, resetUrl }) => {
  if (!email || !resetUrl) {
    throw new Error("Email and reset URL are required");
  }

  validateRecipientEmail(email);

  const recipientName = fullname || "there";
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Reset your HUUK staff password",
    text: `Hello ${recipientName},\n\nWe received a request to reset your HUUK staff account password. Use the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 30 minutes. If you did not request a password reset, you can ignore this email.\n\nHUUK Team`,
    html: `
      <div style="font-family: Quicksand, Arial, sans-serif; color: #1a1a1a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">Reset your HUUK staff password</h2>
        <p>Hello ${recipientName},</p>
        <p>We received a request to reset your HUUK staff account password.</p>
        <p>
          <a
            href="${resetUrl}"
            style="display: inline-block; padding: 12px 20px; background: #1a1a1a; color: #baa173; text-decoration: none; font-weight: 700; border-radius: 6px;"
          >
            Reset Password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 30 minutes. If you did not request a password reset, you can ignore this email.</p>
        <p>HUUK Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions).catch((smtpErr) => {
    console.error("SMTP error while sending password reset email:", {
      message: smtpErr.message,
      stack: smtpErr.stack,
      to: email,
    });
    throw new Error(`Failed to send email: ${smtpErr.message}`);
  });
};

const sendBookingReceipt = async (bookingDetails, email) => {
  console.log("Attempting to send receipt:", { bookingDetails, to: email });
  if (!email || !bookingDetails) {
    console.error("Missing email or booking details:", {
      email,
      bookingDetails,
    });
    throw new Error("Email and booking details are required");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Invalid email format:", { email });
    throw new Error("Invalid email format");
  }
  // Only allow paid bookings OR Pay at Outlet bookings with any status
  if (
    bookingDetails.payment_status === "Pending" &&
    bookingDetails.payment_method !== "Pay at Outlet"
  ) {
    console.error("Cannot send receipt for unpaid booking:", {
      bookingId: bookingDetails.id,
      payment_status: bookingDetails.payment_status,
      payment_method: bookingDetails.payment_method,
    });
    throw new Error("Cannot send receipt for unpaid booking");
  }

  // Allow "Pay at Outlet" bookings with "Pending" status
  if (
    bookingDetails.payment_method === "Pay at Outlet" &&
    bookingDetails.payment_status === "Pending"
  ) {
    console.log(
      "Sending receipt for Pay at Outlet booking with Pending status:",
      {
        bookingId: bookingDetails.id,
        payment_method: bookingDetails.payment_method,
        payment_status: bookingDetails.payment_status,
      },
    );
  }
  const pdfDir = path.join(__dirname, "../receipts");
  const pdfPath = path.join(pdfDir, `receipt_${bookingDetails.id}.pdf`);

  try {
    // Ensure receipts directory exists
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
      console.log("Created receipts directory:", pdfDir);
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add logo
    const logoPath = path.join(__dirname, "../assets/logo.PNG");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 100 });
    } else {
      console.warn("Logo file not found:", logoPath);
    }

    // Set font
    const fontPath = path.join(__dirname, "../fonts/Quicksand-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      doc.font(fontPath);
    } else {
      console.warn("Font file not found:", fontPath);
      doc.font("Helvetica");
    }

    // Title
    doc
      .fontSize(20)
      .fillColor("#1a1a1a")
      .text("Booking Receipt", 50, 150, { align: "center" });

    // Details
    doc
      .fontSize(12)
      .fillColor("#1a1a1a")
      .text(`Booking ID: ${bookingDetails.id}`, 50, 200)
      .text(`Outlet: ${bookingDetails.outlet}`, 50, 220)
      .text(`Service: ${bookingDetails.service}`, 50, 240)
      .text(`Date: ${bookingDetails.date}`, 50, 260)
      .text(`Time: ${bookingDetails.time}`, 50, 280)
      .text(`Client: ${bookingDetails.customer_name}`, 50, 300)
      .text(`Barber: ${bookingDetails.staff_name}`, 50, 320)
      .text(
        `Price: MYR ${parseFloat(bookingDetails.price).toFixed(2)}`,
        50,
        340,
      )
      .text(
        `Payment Method: ${bookingDetails.payment_method || "Pending"}`,
        50,
        360,
      )
      .text(`Status: ${bookingDetails.payment_status || "Pending"}`, 50, 380);

    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log("PDF generated successfully:", pdfPath);
        resolve();
      });
      writeStream.on("error", (err) => {
        console.error("PDF write stream error:", {
          message: err.message,
          stack: err.stack,
        });
        reject(err);
      });
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `Booking Receipt #${bookingDetails.id}`,
      text: `Dear ${bookingDetails.customer_name},\n\nThank you for your booking. Please find your receipt attached.\n\nBest regards,\nHUUK Team`,
      attachments: [
        {
          filename: `receipt_${bookingDetails.id}.pdf`,
          path: pdfPath,
        },
      ],
    };

    console.log("Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });
    await transporter.sendMail(mailOptions).catch((smtpErr) => {
      console.error("SMTP error:", {
        message: smtpErr.message,
        stack: smtpErr.stack,
        mailOptions,
      });
      throw new Error(`Failed to send email: ${smtpErr.message}`);
    });
    console.log("Email sent successfully to:", email);
  } catch (err) {
    console.error("Error sending receipt email:", {
      message: err.message,
      stack: err.stack,
      email,
      bookingDetails,
    });
    throw err;
  } finally {
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log("Deleted temporary PDF:", pdfPath);
      }
    } catch (err) {
      console.error("Error deleting temporary PDF:", {
        message: err.message,
        stack: err.stack,
      });
    }
  }
};

const sendRescheduleConfirmation = async (bookingDetails, email) => {
  console.log("Attempting to send reschedule confirmation:", {
    bookingDetails,
    to: email,
  });
  if (!email || !bookingDetails) {
    console.error("Missing email or booking details:", {
      email,
      bookingDetails,
    });
    throw new Error("Email and booking details are required");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Invalid email format:", { email });
    throw new Error("Invalid email format");
  }
  const pdfDir = path.join(__dirname, "../receipts");
  const pdfPath = path.join(pdfDir, `reschedule_${bookingDetails.id}.pdf`);

  try {
    // Ensure receipts directory exists
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
      console.log("Created receipts directory:", pdfDir);
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add logo
    const logoPath = path.join(__dirname, "../assets/logo.PNG");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 100 });
    } else {
      console.warn("Logo file not found:", logoPath);
    }

    // Set font
    const fontPath = path.join(__dirname, "../fonts/Quicksand-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      doc.font(fontPath);
    } else {
      console.warn("Font file not found:", fontPath);
      doc.font("Helvetica");
    }

    // Title
    doc
      .fontSize(20)
      .fillColor("#1a1a1a")
      .text("Booking Reschedule Confirmation", 50, 150, { align: "center" });

    // Details
    doc
      .fontSize(12)
      .fillColor("#1a1a1a")
      .text(`Booking ID: ${bookingDetails.id}`, 50, 200)
      .text(`Outlet: ${bookingDetails.outlet}`, 50, 220)
      .text(`Service: ${bookingDetails.service}`, 50, 240)
      .text(`New Date: ${bookingDetails.date}`, 50, 260)
      .text(`New Time: ${bookingDetails.time}`, 50, 280)
      .text(`Client: ${bookingDetails.customer_name}`, 50, 300)
      .text(`Barber: ${bookingDetails.staff_name}`, 50, 320)
      .text(
        `Price: MYR ${parseFloat(bookingDetails.price).toFixed(2)}`,
        50,
        340,
      )
      .text(
        `Payment Method: ${bookingDetails.payment_method || "Pending"}`,
        50,
        360,
      )
      .text(`Status: ${bookingDetails.payment_status || "Pending"}`, 50, 380);

    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log("PDF generated successfully:", pdfPath);
        resolve();
      });
      writeStream.on("error", (err) => {
        console.error("PDF write stream error:", {
          message: err.message,
          stack: err.stack,
        });
        reject(err);
      });
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `Booking Reschedule Confirmation #${bookingDetails.id}`,
      text: `Dear ${bookingDetails.customer_name},\n\nYour booking has been successfully rescheduled. Please find the updated details attached.\n\nBest regards,\nHUUK Team`,
      attachments: [
        {
          filename: `reschedule_${bookingDetails.id}.pdf`,
          path: pdfPath,
        },
      ],
    };

    console.log("Sending reschedule confirmation email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });
    await transporter.sendMail(mailOptions).catch((smtpErr) => {
      console.error("SMTP error:", {
        message: smtpErr.message,
        stack: smtpErr.stack,
        mailOptions,
      });
      throw new Error(`Failed to send email: ${smtpErr.message}`);
    });
    console.log("Reschedule confirmation email sent successfully to:", email);
  } catch (err) {
    console.error("Error sending reschedule confirmation email:", {
      message: err.message,
      stack: err.stack,
      email,
      bookingDetails,
    });
    throw err;
  } finally {
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log("Deleted temporary PDF:", pdfPath);
      }
    } catch (err) {
      console.error("Error deleting temporary PDF:", {
        message: err.message,
        stack: err.stack,
      });
    }
  }
};

const sendCancelConfirmation = async (bookingDetails, email) => {
  console.log("Attempting to send cancellation confirmation:", {
    bookingDetails,
    to: email,
  });
  if (!email || !bookingDetails) {
    console.error("Missing email or booking details:", {
      email,
      bookingDetails,
    });
    throw new Error("Email and booking details are required");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Invalid email format:", { email });
    throw new Error("Invalid email format");
  }
  const pdfDir = path.join(__dirname, "../receipts");
  const pdfPath = path.join(pdfDir, `cancellation_${bookingDetails.id}.pdf`);

  try {
    // Ensure receipts directory exists
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
      console.log("Created receipts directory:", pdfDir);
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add logo
    const logoPath = path.join(__dirname, "../assets/logo.PNG");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 100 });
    } else {
      console.warn("Logo file not found:", logoPath);
    }

    // Set font
    const fontPath = path.join(__dirname, "../fonts/Quicksand-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      doc.font(fontPath);
    } else {
      console.warn("Font file not found:", fontPath);
      doc.font("Helvetica");
    }

    // Title
    doc
      .fontSize(20)
      .fillColor("#1a1a1a")
      .text("Booking Cancellation Confirmation", 50, 150, { align: "center" });

    // Details
    doc
      .fontSize(12)
      .fillColor("#1a1a1a")
      .text(`Booking ID: ${bookingDetails.id}`, 50, 200)
      .text(`Outlet: ${bookingDetails.outlet}`, 50, 220)
      .text(`Service: ${bookingDetails.service}`, 50, 240)
      .text(`Date: ${bookingDetails.date}`, 50, 260)
      .text(`Time: ${bookingDetails.time}`, 50, 280)
      .text(`Client: ${bookingDetails.customer_name}`, 50, 300)
      .text(`Barber: ${bookingDetails.staff_name}`, 50, 320)
      .text(
        `Price: MYR ${parseFloat(bookingDetails.price).toFixed(2)}`,
        50,
        340,
      )
      .text(
        `Payment Method: ${bookingDetails.payment_method || "Pending"}`,
        50,
        360,
      )
      .text(`Status: ${bookingDetails.payment_status || "Pending"}`, 50, 380);

    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log("PDF generated successfully:", pdfPath);
        resolve();
      });
      writeStream.on("error", (err) => {
        console.error("PDF write stream error:", {
          message: err.message,
          stack: err.stack,
        });
        reject(err);
      });
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `Booking Cancellation Confirmation #${bookingDetails.id}`,
      text: `Dear ${bookingDetails.customer_name},\n\nYour booking has been cancelled. Please find the cancellation details attached.\n\nBest regards,\nHUUK Team`,
      attachments: [
        {
          filename: `cancellation_${bookingDetails.id}.pdf`,
          path: pdfPath,
        },
      ],
    };

    console.log("Sending cancellation confirmation email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });
    await transporter.sendMail(mailOptions).catch((smtpErr) => {
      console.error("SMTP error:", {
        message: smtpErr.message,
        stack: smtpErr.stack,
        mailOptions,
      });
      throw new Error(`Failed to send email: ${smtpErr.message}`);
    });
    console.log("Cancellation confirmation email sent successfully to:", email);
  } catch (err) {
    console.error("Error sending cancellation confirmation email:", {
      message: err.message,
      stack: err.stack,
      email,
      bookingDetails,
    });
    throw err;
  } finally {
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log("Deleted temporary PDF:", pdfPath);
      }
    } catch (err) {
      console.error("Error deleting temporary PDF:", {
        message: err.message,
        stack: err.stack,
      });
    }
  }
};

module.exports = {
  sendBookingReceipt,
  sendRescheduleConfirmation,
  sendCancelConfirmation,
  sendStaffPasswordResetEmail,
};
