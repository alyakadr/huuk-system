const express = require("express");
const router = express.Router();
const { attendanceUpload } = require("../middlewares/uploadMiddleware");
const attendanceController = require("../controllers/attendanceController");
const verifyToken = require("../middlewares/authMiddleware");

router.get("/attendance", verifyToken, attendanceController.listAttendanceFiltered);
router.post("/attendance", verifyToken, attendanceController.logAttendancePost);
router.post("/attendance/new-day", verifyToken, attendanceController.createNewDayAttendance);
router.post("/upload", verifyToken, attendanceUpload.single("file"), attendanceController.uploadAttendanceDocument);

module.exports = router;
