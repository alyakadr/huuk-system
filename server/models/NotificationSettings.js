const mongoose = require("mongoose");

const notificationSettingsSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    notification_type: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    email_enabled: { type: Boolean, default: false },
    push_enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

notificationSettingsSchema.index({ user_id: 1, notification_type: 1 }, { unique: true });

module.exports = mongoose.model("NotificationSettings", notificationSettingsSchema);
