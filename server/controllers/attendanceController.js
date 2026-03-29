const User = require("../models/User");
const Attendance = require("../models/Attendance");
const moment = require("moment");
const path = require("path");

const generateDailyAttendanceRecords = async (currentDate) => {
  console.log("Generating daily attendance records for date:", currentDate);

  const staffList = await User.find({ role: { $in: ["staff", "manager"] }, isApproved: 1 }).select("_id").lean();

  if (!staffList.length) {
    console.log("No approved staff found.");
    return;
  }

  const staffIds = staffList.map((s) => s._id.toString());

  const existing = await Attendance.find({ created_date: currentDate }).select("staff_id").lean();
  const existingIds = existing.map((r) => r.staff_id.toString());

  const missingIds = staffIds.filter((id) => !existingIds.includes(id));
  console.log("Missing attendance records for staff IDs:", missingIds);

  if (!missingIds.length) {
    console.log("All staff have attendance records for", currentDate);
    return;
  }

  const docs = missingIds.map((staffId) => ({
    staff_id: staffId,
    created_date: currentDate,
    time_in: null,
    time_out: null,
    remarks: "Upload relevant supporting documents (valid for 3 working days)",
    outlet: "default",
  }));

  await Attendance.insertMany(docs);
  console.log("Inserted attendance records for missing staff on", currentDate);
};

exports.getAttendance = async (req, res) => {
  const { staff_id, date, page = 1 } = req.query;
  const limit = 10;
  const skip = (page - 1) * limit;

  if (!staff_id) {
    return res.status(400).json({ message: "Staff ID required" });
  }

  try {
    const user = await User.findById(staff_id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isApproved !== 1) return res.status(403).json({ message: "User not approved" });
    if (!["staff", "manager"].includes(user.role)) {
      return res.status(403).json({ message: "Only staff or managers can access attendance" });
    }

    const currentDate = moment().format("YYYY-MM-DD");
    await generateDailyAttendanceRecords(currentDate);

    const filter = { staff_id };
    if (date) filter.created_date = date;

    const records = await Attendance.find(filter)
      .sort({ created_date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formatted = records.map((r) => ({
      id: r._id.toString(),
      staff_id: r.staff_id.toString(),
      created_date: r.created_date,
      time_in: r.time_in || null,
      time_out: r.time_out || null,
      document_path: r.document_path || null,
      remarks: r.remarks || null,
      reason: r.reason || null,
    }));

    res.json({ attendance: formatted });
  } catch (err) {
    console.error("Error fetching attendance:", err.message);
    res.status(500).json({ message: "Error fetching attendance" });
  }
};

exports.logAttendance = async (req, res) => {
  const { staff_id, time_in, time_out } = req.body;
  const today = moment().format("YYYY-MM-DD");

  if (!staff_id) return res.status(400).json({ message: "Staff ID required" });

  if (time_in && !moment(time_in, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
    return res.status(400).json({ message: "Invalid time_in format" });
  }
  if (time_out && !moment(time_out, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
    return res.status(400).json({ message: "Invalid time_out format" });
  }

  try {
    const user = await User.findById(staff_id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isApproved !== 1) return res.status(403).json({ message: "User not approved" });
    if (!["staff", "manager"].includes(user.role)) {
      return res.status(403).json({ message: "Invalid role" });
    }

    const record = await Attendance.findOne({ staff_id, created_date: today });

    if (record) {
      if (time_in && record.time_in) {
        return res.status(400).json({ message: "Time In already logged for today" });
      }
      if (time_out) {
        if (!record.time_in) return res.status(400).json({ message: "No Time In recorded" });
        if (record.time_out) return res.status(400).json({ message: "Time Out already logged for today" });
        const minTimeOut = moment(record.time_in).add(5, "hours");
        if (moment(time_out).isBefore(minTimeOut)) {
          return res.status(400).json({ message: "Time Out must be at least 5 hours after Time In" });
        }
        record.time_out = time_out;
        if (!record.remarks) record.remarks = "-";
        await record.save();
        return res.json({ message: "Time Out logged", attendanceId: record._id.toString(), time_in: record.time_in, time_out });
      } else {
        record.time_in = time_in;
        if (!record.remarks) record.remarks = "-";
        await record.save();
        return res.json({ message: "Time In logged", attendanceId: record._id.toString(), time_in });
      }
    } else {
      if (!time_in) return res.status(400).json({ message: "Time In required" });
      const newRecord = await Attendance.create({
        staff_id,
        time_in,
        remarks: "-",
        created_date: moment(time_in).format("YYYY-MM-DD"),
        outlet: "default",
      });
      return res.json({ message: "Time In logged", attendanceId: newRecord._id.toString(), time_in });
    }
  } catch (err) {
    console.error("Error logging attendance:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.uploadDocument = async (req, res) => {
  const { attendance_id, reason } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ message: "No file uploaded" });
  if (!attendance_id || !reason) return res.status(400).json({ message: "Attendance ID and reason required" });

  try {
    const record = await Attendance.findById(attendance_id);
    if (!record) return res.status(404).json({ message: "Attendance record not found" });

    const dateThreshold = moment(record.created_date).add(3, "days");
    if (moment().isAfter(dateThreshold)) {
      return res.status(400).json({ message: "Document upload closed after 3 days" });
    }

    const filePath = `/Uploads/attendance/${file.filename}`;
    record.document_path = filePath;
    record.remarks = `Absent with notice (${reason})`;
    record.reason = reason;
    await record.save();

    res.json({ message: "File uploaded successfully", filePath });
  } catch (err) {
    console.error("Error uploading document:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
