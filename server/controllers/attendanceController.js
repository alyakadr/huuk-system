const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/attendance");
const moment = require("moment");
const path = require("path");
const { emitToUser, emitToManagers } = require("../utils/socketEmit");

function parseStaffObjectId(staffId, res) {
  if (!staffId) return null;
  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    if (res) res.status(400).json({ message: "Invalid staff_id" });
    return null;
  }
  return new mongoose.Types.ObjectId(staffId);
}

const generateDailyAttendanceRecords = async (currentDate) => {
  console.log("Generating daily attendance records for date:", currentDate);

  const staffList = await User.find({ role: { $in: ["staff", "manager"] }, isApproved: 1 }).select("_id").lean();

  if (!staffList.length) {
    console.log("No approved staff found.");
    return;
  }

  const existing = await Attendance.find({ created_date: currentDate }).select("staff_id").lean();
  const existingIdSet = new Set(existing.map((r) => r.staff_id.toString()));

  const missingStaff = staffList.filter((s) => !existingIdSet.has(s._id.toString()));
  console.log(
    "Missing attendance records for staff IDs:",
    missingStaff.map((s) => s._id.toString())
  );

  if (!missingStaff.length) {
    console.log("All staff have attendance records for", currentDate);
    return;
  }

  const docs = missingStaff.map((s) => ({
    staff_id: s._id,
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

  const staffObjectId = parseStaffObjectId(staff_id, res);
  if (!staffObjectId) return;

  try {
    const user = await User.findById(staffObjectId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isApproved !== 1) return res.status(403).json({ message: "User not approved" });
    if (!["staff", "manager"].includes(user.role)) {
      return res.status(403).json({ message: "Only staff or managers can access attendance" });
    }

    const currentDate = moment().format("YYYY-MM-DD");
    await generateDailyAttendanceRecords(currentDate);

    const filter = { staff_id: staffObjectId };
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

  const staffObjectId = parseStaffObjectId(staff_id, res);
  if (!staffObjectId) return;

  if (time_in && !moment(time_in, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
    return res.status(400).json({ message: "Invalid time_in format" });
  }
  if (time_out && !moment(time_out, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
    return res.status(400).json({ message: "Invalid time_out format" });
  }

  try {
    const user = await User.findById(staffObjectId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isApproved !== 1) return res.status(403).json({ message: "User not approved" });
    if (!["staff", "manager"].includes(user.role)) {
      return res.status(403).json({ message: "Invalid role" });
    }

    const record = await Attendance.findOne({ staff_id: staffObjectId, created_date: today });

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
        staff_id: staffObjectId,
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

function buildAttendanceListPipeline(filters) {
  const match = {};
  if (filters.staffObjectId) match.staff_id = filters.staffObjectId;
  if (filters.date) match.created_date = filters.date;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "staff_id",
        foreignField: "_id",
        as: "u",
      },
    },
    { $unwind: "$u" },
  ];
  if (filters.outlet) {
    pipeline.push({ $match: { "u.outlet": filters.outlet } });
  }
  pipeline.push({ $sort: { createdAt: -1 } });
  return pipeline;
}

exports.listAttendanceFiltered = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }

  const { staff_id, outlet, date, page = 1, all } = req.query;
  const limit = 10;
  const skip = (Number(page) - 1) * limit;

  if (!staff_id && !outlet && !date) {
    return res.status(400).json({ message: "At least one filter required" });
  }

  try {
    let staffObjectId = null;
    if (staff_id) {
      staffObjectId = parseStaffObjectId(staff_id, res);
      if (!staffObjectId) return;
    }

    if (req.role !== "manager") {
      if (staffObjectId && staffObjectId.toString() !== req.userId) {
        return res
          .status(403)
          .json({ message: "You may only view your own attendance" });
      }
      staffObjectId = new mongoose.Types.ObjectId(req.userId);
    }

    const filters = { staffObjectId, outlet, date };
    const basePipeline = buildAttendanceListPipeline(filters);

    if (all === "true") {
      const rows = await Attendance.aggregate(basePipeline);
      const attendance = rows.map((r) => ({
        id: r._id.toString(),
        staff_id: r.staff_id.toString(),
        fullname: r.u.fullname,
        username: r.u.username,
        outlet: r.u.outlet,
        time_in: r.time_in,
        time_out: r.time_out,
        created_date: r.created_date,
        document_path: r.document_path,
        remarks: r.remarks,
      }));
      return res.json({ attendance, page: Number(page), totalPages: 1, total: attendance.length });
    }

    const countResult = await Attendance.aggregate([...basePipeline, { $count: "total" }]);
    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const rows = await Attendance.aggregate([...basePipeline, { $skip: skip }, { $limit: limit }]);
    const attendance = rows.map((r) => ({
      id: r._id.toString(),
      staff_id: r.staff_id.toString(),
      fullname: r.u.fullname,
      username: r.u.username,
      outlet: r.u.outlet,
      time_in: r.time_in,
      time_out: r.time_out,
      created_date: r.created_date,
      document_path: r.document_path,
      remarks: r.remarks,
    }));

    res.json({ attendance, page: Number(page), totalPages, total });
  } catch (err) {
    console.error("Error fetching attendance:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.logAttendancePost = async (req, res) => {
  const { staff_id, time_in, time_out } = req.body;
  if (!staff_id || (!time_in && !time_out)) {
    return res.status(400).json({ message: "staff_id and either time_in or time_out required" });
  }
  const staffObjectId = parseStaffObjectId(staff_id, res);
  if (!staffObjectId) return;

  if (staffObjectId.toString() !== req.userId && req.role !== "manager") {
    return res.status(403).json({ message: "Cannot log attendance for another user" });
  }

  try {
    const user = await User.findById(staffObjectId).lean();
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!["staff", "manager"].includes(user.role) || user.isApproved !== 1) {
      return res.status(400).json({ message: "User not authorized to log attendance" });
    }

    const today = moment().format("YYYY-MM-DD");
    let record = await Attendance.findOne({ staff_id: staffObjectId, created_date: today });

    if (record) {
      if (time_in && record.time_in) {
        return res.status(400).json({ message: "Time In already logged for today" });
      }
      const willHaveTimeIn = Boolean(record.time_in || (time_in && !record.time_in));
      if (time_out) {
        if (!willHaveTimeIn) {
          return res.status(400).json({ message: "Cannot log Time Out without Time In" });
        }
        if (record.time_out) {
          return res.status(400).json({ message: "Time Out already logged for today" });
        }
      }
      if (time_in && !record.time_in) {
        record.time_in = time_in;
      }
      if (time_out) {
        record.time_out = time_out;
      }
      await record.save();
    } else {
      if (time_out && !time_in) {
        return res.status(400).json({ message: "Cannot log Time Out without Time In" });
      }
      record = await Attendance.create({
        staff_id: staffObjectId,
        ...(time_in ? { time_in } : {}),
        ...(time_out ? { time_out } : {}),
        created_date: today,
        outlet: user.outlet || "default",
      });
    }

    const fresh = await Attendance.findById(record._id).lean();
    const io = req.app.get("socketio");
    const attendancePayload = {
      staff_id: fresh.staff_id.toString(),
      outlet: fresh.outlet,
      time_in: fresh.time_in ? moment(fresh.time_in).format("YYYY-MM-DD HH:mm:ss") : null,
      time_out: fresh.time_out ? moment(fresh.time_out).format("YYYY-MM-DD HH:mm:ss") : null,
      created_date: moment(fresh.createdAt).format("YYYY-MM-DD HH:mm:ss"),
    };
    emitToUser(io, fresh.staff_id.toString(), "attendanceUpdate", attendancePayload);
    emitToManagers(io, "attendanceUpdate", attendancePayload);

    res.status(200).json({
      id: fresh._id,
      staff_id: fresh.staff_id,
      time_in: fresh.time_in,
      time_out: fresh.time_out,
      created_at: fresh.createdAt,
      outlet: fresh.outlet,
    });
  } catch (err) {
    console.error("Error logging attendance:", err.message);
    res.status(400).json({ message: err.message || "Server error" });
  }
};

exports.createNewDayAttendance = async (req, res) => {
  const { staff_id } = req.body;
  if (!staff_id) {
    return res.status(400).json({ message: "staff_id required" });
  }
  const staffObjectId = parseStaffObjectId(staff_id, res);
  if (!staffObjectId) return;

  if (staffObjectId.toString() !== req.userId && req.role !== "manager") {
    return res.status(403).json({
      message:
        "Cannot create attendance for another user. Only staff or manager can create their own attendance record.",
    });
  }
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Only staff or manager role can create attendance records." });
  }

  try {
    const today = moment().format("YYYY-MM-DD");
    const exists = await Attendance.findOne({ staff_id: staffObjectId, created_date: today });
    if (exists) {
      return res.status(400).json({ message: "Attendance record already exists for today" });
    }

    const user = await User.findById(staffObjectId).select("outlet").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const created = await Attendance.create({
      staff_id: staffObjectId,
      created_date: today,
      outlet: user.outlet || "default",
    });

    const fresh = await Attendance.findById(created._id).lean();
    res.status(201).json({
      id: fresh._id,
      staff_id: fresh.staff_id,
      time_in: fresh.time_in,
      time_out: fresh.time_out,
      created_at: fresh.createdAt,
      outlet: fresh.outlet,
    });
  } catch (err) {
    console.error("Error creating new day record:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.uploadAttendanceDocument = async (req, res) => {
  const fs = require("fs");
  const { attendance_id, reason } = req.body;

  if (!req.file || !attendance_id || !reason) {
    return res.status(400).json({ message: "File, attendance_id, and reason required" });
  }

  const filePath = `/Uploads/attendance/${req.file.filename}`;

  try {
    const record = await Attendance.findById(attendance_id);
    if (!record) {
      throw new Error("Attendance record not found");
    }
    if (record.staff_id.toString() !== req.userId && req.role !== "manager") {
      throw new Error("Cannot upload for another user's attendance");
    }

    const attendanceDate = moment(record.created_date, "YYYY-MM-DD", true);
    const thresholdDate = attendanceDate.clone().add(3, "days");
    if (moment().isAfter(thresholdDate.endOf("day"))) {
      throw new Error("Upload period expired (3 days after attendance date)");
    }
    if (record.time_in && record.time_out) {
      throw new Error("Cannot upload for completed attendance");
    }
    if ((record.document_upload_count || 0) >= 2) {
      throw new Error("Maximum uploads reached for this attendance record");
    }

    record.document_path = filePath;
    record.remarks = `Absent with notice (${reason})`;
    record.reason = reason;
    record.document_upload_count = (record.document_upload_count || 0) + 1;
    await record.save();

    res.status(200).json({ filePath, message: "Document uploaded successfully" });
  } catch (err) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    console.error("Error uploading document:", err.message);
    res.status(400).json({ message: err.message });
  }
};
