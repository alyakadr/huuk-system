const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { attachJwtUserIds } = require("../utils/attachJwtUser");
const { attendanceUpload } = require("../middlewares/uploadMiddleware");
const attendanceController = require("../controllers/attendanceController");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    if (!attachJwtUserIds(req, decoded.userId)) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.role = decoded.role;
    next();
  });
};

router.get("/attendance", verifyToken, attendanceController.listAttendanceFiltered);
router.post("/attendance", verifyToken, attendanceController.logAttendancePost);
router.post("/attendance/new-day", verifyToken, attendanceController.createNewDayAttendance);
router.post("/upload", verifyToken, attendanceUpload.single("file"), attendanceController.uploadAttendanceDocument);

module.exports = router;
