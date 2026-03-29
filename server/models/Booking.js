const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    outlet_id: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    customer_name: { type: String },
    customer_phone: { type: String },
    notes: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled", "Absent"],
      default: "Pending",
    },
    payment_status: {
      type: String,
      enum: ["Pending", "Paid", "Unpaid", "Failed"],
      default: "Pending",
    },
    payment_method: { type: String },
    payment_intent_id: { type: String },
    duration_minutes: { type: Number },
    price: { type: Number },
    is_draft: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
