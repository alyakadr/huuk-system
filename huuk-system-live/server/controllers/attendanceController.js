const { db } = require("../models/userModel");
const moment = require("moment");
const path = require("path");

const generateDailyAttendanceRecords = (currentDate, callback) => {
  console.log("Generating daily attendance records for date:", currentDate);

  // Fetch all approved staff
  const staffQuery = `
    SELECT id FROM users WHERE role IN ('staff', 'manager') AND isApproved = 1
  `;
  db.query(staffQuery, (err, staffResults) => {
    if (err) {
      console.error("Error fetching staff:", err.message);
      return callback(err);
    }

    if (staffResults.length === 0) {
      console.log("No approved staff found.");
      return callback(null);
    }

    const staffIds = staffResults.map((staff) => staff.id);
    console.log("Approved staff IDs:", staffIds);

    // Check existing records for today
    const checkQuery = `
      SELECT staff_id FROM attendance WHERE DATE(created_date) = ?
    `;
    db.query(checkQuery, [currentDate], (err, existingRecords) => {
      if (err) {
        console.error("Error checking existing records:", err.message);
        return callback(err);
      }

      const existingStaffIds = existingRecords.map((record) => record.staff_id);
      const missingStaffIds = staffIds.filter(
        (id) => !existingStaffIds.includes(id)
      );
      console.log("Missing attendance records for staff IDs:", missingStaffIds);

      if (missingStaffIds.length === 0) {
        console.log("All staff have attendance records for", currentDate);
        return callback(null);
      }

      // Insert new records for missing staff
      const insertQuery = `
        INSERT INTO attendance (staff_id, created_date, time_in, time_out, remarks, outlet)
        VALUES (?, ?, NULL, NULL, 'Upload relevant supporting documents (valid for 3 working days)', 'default')
      `;
      let completed = 0;
      missingStaffIds.forEach((staffId) => {
        db.query(insertQuery, [staffId, currentDate], (err, result) => {
          if (err) {
            console.error(
              "Error inserting attendance record for staff_id:",
              staffId,
              err.message
            );
            return callback(err);
          }
          console.log(
            "Inserted attendance record for staff_id:",
            staffId,
            "date:",
            currentDate
          );
          completed++;
          if (completed === missingStaffIds.length) {
            callback(null);
          }
        });
      });
    });
  });
};

exports.getAttendance = (req, res) => {
  const { staff_id, date, page = 1 } = req.query;
  const limit = 10;
  const offset = (page - 1) * limit;

  if (!staff_id) {
    console.error("GET /users/attendance: Missing staff_id");
    return res.status(400).json({ message: "Staff ID required" });
  }

  // Validate role
  db.query(
    "SELECT role, isApproved FROM users WHERE id = ?",
    [staff_id],
    (err, userResults) => {
      if (err) {
        console.error("Error checking user:", err.message);
        return res.status(500).json({ message: "Server error" });
      }
      if (userResults.length === 0) {
        console.error("User not found for staff_id:", staff_id);
        return res.status(404).json({ message: "User not found" });
      }
      const user = userResults[0];
      if (user.isApproved !== 1) {
        console.error("User not approved:", staff_id);
        return res.status(403).json({ message: "User not approved" });
      }
      if (!["staff", "manager"].includes(user.role)) {
        console.error(
          "Invalid role for staff_id:",
          staff_id,
          "role:",
          user.role
        );
        return res
          .status(403)
          .json({ message: "Only staff or managers can access attendance" });
      }

      const currentDate = moment().format("YYYY-MM-DD");

      generateDailyAttendanceRecords(currentDate, (err) => {
        if (err) {
          console.error(
            "Error generating daily attendance records:",
            err.message
          );
          return res.status(500).json({ message: "Server error" });
        }

        let query = `
          SELECT id, staff_id, created_date, 
                 DATE_FORMAT(time_in, '%Y-%m-%d %H:%i:%s') AS time_in,
                 DATE_FORMAT(time_out, '%Y-%m-%d %H:%i:%s') AS time_out,
                 document_path, remarks, reason
          FROM attendance
          WHERE staff_id = ?
        `;
        let params = [staff_id];

        if (date) {
          query += ` AND DATE(created_date) = ?`;
          params.push(date);
        }

        query += ` ORDER BY created_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        console.log("Executing GET /users/attendance query:", {
          staff_id,
          date,
          page,
        });
        db.query(query, params, (err, results) => {
          if (err) {
            console.error("Error fetching attendance:", err.message);
            return res
              .status(500)
              .json({ message: "Error fetching attendance" });
          }
          console.log("Attendance records fetched:", results);
          res.json({ attendance: results || [] });
        });
      });
    }
  );
};

exports.logAttendance = (req, res) => {
  const { staff_id, time_in, time_out } = req.body;
  const today = moment().format("YYYY-MM-DD");

  if (!staff_id) {
    console.error("POST /users/attendance: Missing staff_id");
    return res.status(400).json({ message: "Staff ID required" });
  }

  if (time_in && !moment(time_in, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
    console.error("Invalid time_in format:", time_in);
    return res.status(400).json({ message: "Invalid time_in format" });
  }
  if (time_out && !moment(time_out, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
    console.error("Invalid time_out format:", time_out);
    return res.status(400).json({ message: "Invalid time_out format" });
  }

  console.log("Processing POST /users/attendance:", {
    staff_id,
    time_in,
    time_out,
  });

  // Validate user
  db.query(
    "SELECT id, role, isApproved FROM users WHERE id = ?",
    [staff_id],
    (err, userResults) => {
      if (err) {
        console.error("Error checking user:", err.message);
        return res.status(500).json({ message: "Server error" });
      }
      if (userResults.length === 0) {
        console.error("User not found for staff_id:", staff_id);
        return res.status(404).json({ message: "User not found" });
      }
      const user = userResults[0];
      if (user.isApproved !== 1) {
        console.error("User not approved:", staff_id);
        return res.status(403).json({ message: "User not approved" });
      }
      if (!["staff", "manager"].includes(user.role)) {
        console.error(
          "Invalid role for staff_id:",
          staff_id,
          "role:",
          user.role
        );
        return res.status(403).json({ message: "Invalid role" });
      }

      // Check existing record
      const checkQuery = `
        SELECT id, time_in, time_out
        FROM attendance
        WHERE staff_id = ? AND DATE(created_date) = ?
      `;
      db.query(checkQuery, [staff_id, today], (err, results) => {
        if (err) {
          console.error("Error checking attendance:", err.message);
          return res.status(500).json({ message: "Server error" });
        }

        console.log("Existing attendance record:", results);

        if (results.length > 0) {
          const record = results[0];
          if (time_in && record.time_in) {
            console.error(
              "Time In already logged for staff_id:",
              staff_id,
              "date:",
              today
            );
            return res
              .status(400)
              .json({ message: "Time In already logged for today" });
          }
          if (time_out) {
            if (!record.time_in) {
              console.error(
                "No Time In for staff_id:",
                staff_id,
                "date:",
                today
              );
              return res.status(400).json({ message: "No Time In recorded" });
            }
            if (record.time_out) {
              console.error(
                "Time Out already logged for staff_id:",
                staff_id,
                "date:",
                today
              );
              return res
                .status(400)
                .json({ message: "Time Out already logged for today" });
            }
            const minTimeOut = moment(record.time_in).add(5, "hours");
            if (moment(time_out).isBefore(minTimeOut)) {
              console.error("Time Out too early for staff_id:", staff_id);
              return res.status(400).json({
                message: "Time Out must be at least 5 hours after Time In",
              });
            }
            const updateQuery = `
              UPDATE attendance
              SET time_out = ?, remarks = COALESCE(remarks, '-')
              WHERE id = ?
            `;
            db.query(updateQuery, [time_out, record.id], (err, result) => {
              if (err) {
                console.error("Error updating attendance:", err.message);
                return res.status(500).json({ message: "Server error" });
              }
              console.log(
                "Time Out logged for staff_id:",
                staff_id,
                "id:",
                record.id
              );
              res.json({
                message: "Time Out logged",
                attendanceId: record.id,
                time_in: record.time_in,
                time_out,
              });
            });
          } else {
            // Handle time_in-only request for existing record
            const updateQuery = `
              UPDATE attendance
              SET time_in = ?, remarks = COALESCE(remarks, '-')
              WHERE id = ?
            `;
            db.query(updateQuery, [time_in, record.id], (err, result) => {
              if (err) {
                console.error("Error updating attendance:", err.message);
                return res.status(500).json({ message: "Server error" });
              }
              console.log(
                "Time In logged for staff_id:",
                staff_id,
                "id:",
                record.id
              );
              res.json({
                message: "Time In logged",
                attendanceId: record.id,
                time_in,
              });
            });
          }
        } else {
          if (!time_in) {
            console.error("Time In required for staff_id:", staff_id);
            return res.status(400).json({ message: "Time In required" });
          }
          const insertQuery = `
            INSERT INTO attendance (staff_id, time_in, remarks, created_at, outlet)
            VALUES (?, ?, '-', ?, 'default')
          `;
          const createdAt = moment(time_in).format("YYYY-MM-DD HH:mm:ss");
          db.query(
            insertQuery,
            [staff_id, time_in, createdAt],
            (err, result) => {
              if (err) {
                console.error("Error saving attendance:", err.message);
                return res.status(500).json({ message: "Server error" });
              }
              console.log(
                "Time In logged for staff_id:",
                staff_id,
                "attendanceId:",
                result.insertId
              );
              res.json({
                message: "Time In logged",
                attendanceId: result.insertId,
                time_in,
              });
            }
          );
        }
      });
    }
  );
};

exports.uploadDocument = (req, res) => {
  const { attendance_id, reason } = req.body;
  const file = req.file;

  if (!file) {
    console.error("POST /users/upload: No file uploaded");
    return res.status(400).json({ message: "No file uploaded" });
  }
  if (!attendance_id || !reason) {
    console.error("POST /users/upload: Missing attendance_id or reason");
    return res
      .status(400)
      .json({ message: "Attendance ID and reason required" });
  }

  console.log("Processing POST /users/upload:", { attendance_id, reason });

  // Verify attendance record
  const checkQuery = `
    SELECT staff_id, created_date
    FROM attendance
    WHERE id = ?
  `;
  db.query(checkQuery, [attendance_id], (err, results) => {
    if (err) {
      console.error("Error checking attendance:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
    if (results.length === 0) {
      console.error("Attendance record not found for id:", attendance_id);
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const record = results[0];
    const dateThreshold = moment(record.created_date).add(3, "days");
    if (moment().isAfter(dateThreshold)) {
      console.error("Upload closed for attendance_id:", attendance_id);
      return res
        .status(400)
        .json({ message: "Document upload closed after 3 days" });
    }

    const filePath = `/Uploads/attendance/${file.filename}`;
    const remarks = `Absent with notice (${reason})`;

    const updateQuery = `
      UPDATE attendance
      SET document_path = ?, remarks = ?, reason = ?
      WHERE id = ?
    `;
    db.query(
      updateQuery,
      [filePath, remarks, reason, attendance_id],
      (err, result) => {
        if (err) {
          console.error("Error uploading document:", err.message);
          return res.status(500).json({ message: "Server error" });
        }
        if (result.affectedRows === 0) {
          console.error("Attendance record not found for id:", attendance_id);
          return res
            .status(404)
            .json({ message: "Attendance record not found" });
        }
        console.log(
          "Document uploaded for attendance_id:",
          attendance_id,
          "filePath:",
          filePath
        );
        res.json({ message: "File uploaded successfully", filePath });
      }
    );
  });
};
