const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    created_date: { type: String, required: true },
    time_in: { type: String },
    time_out: { type: String },
    document_path: { type: String },
    document_upload_count: { type: Number, default: 0 },
    remarks: { type: String },
    reason: { type: String },
    outlet: { type: String, default: "default" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);
