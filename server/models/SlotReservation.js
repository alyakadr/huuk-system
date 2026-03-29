const mongoose = require("mongoose");

const slotReservationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    outlet_id: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    expires_at: { type: Date, required: true },
    status: {
      type: String,
      enum: ["reserved", "confirmed", "expired", "cancelled"],
      default: "reserved",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SlotReservation", slotReservationSchema);
