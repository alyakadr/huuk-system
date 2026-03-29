const mongoose = require("mongoose");

const blockedTimeSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlockedTime", blockedTimeSchema);
