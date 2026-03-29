const mongoose = require("mongoose");

const blockedSlotSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    time_slot: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

blockedSlotSchema.index({ staff_id: 1, date: 1, time_slot: 1 }, { unique: true });

module.exports = mongoose.model("BlockedSlot", blockedSlotSchema);
