const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    is_read: { type: Boolean, default: false },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    expires_at: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
