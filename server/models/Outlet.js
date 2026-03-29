const mongoose = require("mongoose");

const outletSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    shortform: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Outlet", outletSchema);
