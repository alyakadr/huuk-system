"use strict";

const buildScheduleBlockingBookingMatch = (overrides = {}) => ({
  is_draft: { $ne: true },
  status: { $ne: "Cancelled" },
  $or: [{ payment_status: "Paid" }, { payment_method: "Pay at Outlet" }],
  ...overrides,
});

const buildVisibleBookingMatch = (overrides = {}) => ({
  is_draft: { $ne: true },
  status: { $ne: "Cancelled" },
  ...overrides,
});

module.exports = {
  buildScheduleBlockingBookingMatch,
  buildVisibleBookingMatch,
};
