"use strict";
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Outlet = require("../models/Outlet");
const Service = require("../models/Service");
const Review = require("../models/Review");
const BlockedSlot = require("../models/BlockedSlot");
const BlockedTime = require("../models/BlockedTime");
const Notification = require("../models/Notification");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const {
  sendBookingReceipt: sendReceiptEmail,
  sendRescheduleConfirmation,
  sendCancelConfirmation,
} = require("../utils/email");
const {
  sendBookingConfirmation,
  sendRescheduleConfirmationSMS,
  sendCancellationSMS,
} = require("../utils/smsService");
const {
  sendNotificationAfterBooking,
  sendNotificationAfterCustomer,
  sendNotificationAfterStaff,
  createAndSendNotification,
} = require("../middlewares/notificationMiddleware");
const {
  validateStaffAvailability,
} = require("../services/bookingAvailabilityService");
const {
  resolveOrCreateCustomerUser,
} = require("../services/customerAccountService");
const {
  formatDateForDb,
  isOutsideOperatingHours,
  OUTSIDE_OPERATING_HOURS_MESSAGE,
  toPaymentMethodLabel,
  buildBookingPaymentDetails,
} = require("../utils/booking/bookingPresentation");

const retryOperation = async (operation, retries = 3, delayBase = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err) {
      console.error(`Attempt ${i + 1} failed:`, { message: err.message });
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayBase * (i + 1)));
    }
  }
};

function calculateEndTime(startTime, durationMinutes) {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function getTodayString() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

// List all outlets
exports.getOutlets = async (req, res) => {
  try {
    const results = await Outlet.find({}, "name shortform")
      .sort({ shortform: 1 })
      .lean();
    res.json(results.map((o) => ({ ...o, id: o._id.toString() })));
  } catch (err) {
    console.error("Error fetching outlets:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// List all services
exports.getServices = async (req, res) => {
  try {
    const results = await Service.find({}, "name duration price")
      .sort({ name: 1 })
      .lean();
    res.json(results.map((s) => ({ ...s, id: s._id.toString() })));
  } catch (err) {
    console.error("Error fetching services:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get available 30-min slots
exports.getAvailableSlots = async (req, res) => {
  const {
    date,
    outlet_id,
    service_id,
    staff_id,
    currentBookingTime,
    currentBookingId,
  } = req.query;
  if (!date || !outlet_id || !service_id) {
    return res
      .status(400)
      .json({ message: "Date, outlet_id, and service_id required" });
  }
  try {
    const service = await Service.findById(service_id).lean();
    if (!service) return res.status(404).json({ message: "Service not found" });
    const duration = service.duration || 30;

    const staffQuery = {
      role: { $in: ["staff", "manager"] },
      outlet_id,
      isApproved: 1,
    };
    if (staff_id) staffQuery._id = staff_id;
    const staff = await User.find(staffQuery, "_id").lean();
    if (!staff.length) return res.json([]);

    const staffIds = staff.map((s) => s._id);

    const [blockedTimes, blockedSlots] = await Promise.all([
      BlockedTime.find({ date, staff_id: { $in: staffIds } }).lean(),
      BlockedSlot.find({
        date,
        staff_id: { $in: staffIds },
        is_active: true,
      }).lean(),
    ]);

    const bookingQuery = { date, outlet_id, status: { $ne: "Cancelled" } };
    if (currentBookingId) bookingQuery._id = { $ne: currentBookingId };
    else if (currentBookingTime)
      bookingQuery.time = { $ne: currentBookingTime };
    const bookings = await Booking.find(
      bookingQuery,
      "staff_id time service_id",
    ).lean();

    const bookingServiceIds = [
      ...new Set(bookings.map((b) => b.service_id.toString())),
    ];
    const bookingServices = bookingServiceIds.length
      ? await Service.find(
          { _id: { $in: bookingServiceIds } },
          "duration",
        ).lean()
      : [];
    const serviceDurationMap = {};
    bookingServices.forEach((s) => {
      serviceDurationMap[s._id.toString()] = s.duration || 30;
    });

    const slots = [];
    let current = new Date(`${date}T10:00:00Z`);
    const end = new Date(`${date}T22:00:00Z`);

    const malaysiaNow = moment.tz("Asia/Kuala_Lumpur");
    const malaysiaTodayDate = malaysiaNow.format("YYYY-MM-DD");
    const isToday = date === malaysiaTodayDate;

    if (isToday && malaysiaNow.hour() >= 21) return res.json(["CLOSED"]);

    if (isToday) {
      const timeAfter30Min = malaysiaNow.clone().add(30, "minutes");
      const minutes = timeAfter30Min.minute();
      if (minutes <= 30) timeAfter30Min.minute(30).second(0).millisecond(0);
      else timeAfter30Min.add(1, "hour").minute(0).second(0).millisecond(0);
      const nextSlotStr = timeAfter30Min.format("HH:mm");
      const minStart = new Date(`${date}T10:00:00Z`);
      const nextAvailable = new Date(`${date}T${nextSlotStr}:00Z`);
      current = nextAvailable > minStart ? nextAvailable : minStart;
    }

    while (current < end) {
      const timeStr = current.toISOString().slice(11, 16);
      const slotEnd = new Date(current.getTime() + duration * 60 * 1000);

      if (isToday) {
        const malaysiaCurrentTime = moment.tz("Asia/Kuala_Lumpur");
        const minAllowed = malaysiaCurrentTime.clone().add(30, "minutes");
        const slotMalaysia = moment.tz(
          `${date} ${timeStr}`,
          "YYYY-MM-DD HH:mm",
          "Asia/Kuala_Lumpur",
        );
        if (slotMalaysia.isBefore(minAllowed)) {
          current = new Date(current.getTime() + 30 * 60 * 1000);
          continue;
        }
      }

      let isAvailable = false;
      for (const s of staff) {
        let staffOk = true;
        const requiredSlots = [];
        for (
          let t = new Date(current);
          t < slotEnd;
          t = new Date(t.getTime() + 30 * 60 * 1000)
        ) {
          requiredSlots.push(new Date(t));
        }
        for (const reqSlot of requiredSlots) {
          const reqSlotEnd = new Date(reqSlot.getTime() + 30 * 60 * 1000);
          const isBlocked = blockedTimes
            .filter((bt) => bt.staff_id.toString() === s._id.toString())
            .some((bt) => {
              const bs = new Date(`${date}T${bt.start_time}Z`);
              const be = new Date(`${date}T${bt.end_time}Z`);
              return reqSlot < be && reqSlotEnd > bs;
            });
          if (isBlocked) {
            staffOk = false;
            break;
          }
          const isSlotBlocked = blockedSlots
            .filter((bs) => bs.staff_id.toString() === s._id.toString())
            .some((bs) => {
              const bss = new Date(`${date}T${bs.time_slot}Z`);
              const bse = new Date(bss.getTime() + 30 * 60 * 1000);
              return reqSlot < bse && reqSlotEnd > bss;
            });
          if (isSlotBlocked) {
            staffOk = false;
            break;
          }
          const hasConflict = bookings
            .filter((b) => b.staff_id.toString() === s._id.toString())
            .some((b) => {
              const bs = new Date(`${date}T${b.time}Z`);
              const be = new Date(
                bs.getTime() +
                  (serviceDurationMap[b.service_id.toString()] || 30) *
                    60 *
                    1000,
              );
              return reqSlot < be && reqSlotEnd > bs;
            });
          if (hasConflict) {
            staffOk = false;
            break;
          }
        }
        if (staffOk) {
          const nextEvent = [
            ...blockedTimes
              .filter((bt) => bt.staff_id.toString() === s._id.toString())
              .map((bt) => ({
                start: new Date(`${date}T${bt.start_time}Z`),
                end: new Date(`${date}T${bt.end_time}Z`),
              })),
            ...blockedSlots
              .filter((bs) => bs.staff_id.toString() === s._id.toString())
              .map((bs) => {
                const bss = new Date(`${date}T${bs.time_slot}Z`);
                return {
                  start: bss,
                  end: new Date(bss.getTime() + 30 * 60 * 1000),
                };
              }),
            ...bookings
              .filter((b) => b.staff_id.toString() === s._id.toString())
              .map((b) => {
                const bs = new Date(`${date}T${b.time}Z`);
                return {
                  start: bs,
                  end: new Date(
                    bs.getTime() +
                      (serviceDurationMap[b.service_id.toString()] || 30) *
                        60 *
                        1000,
                  ),
                };
              }),
          ]
            .filter((e) => e.start > current)
            .sort((a, b) => a.start - b.start)[0];
          if (!nextEvent || nextEvent.start >= slotEnd) {
            isAvailable = true;
            break;
          }
        }
      }
      if (isAvailable && !slots.includes(timeStr)) slots.push(timeStr);
      current = new Date(current.getTime() + 30 * 60 * 1000);
    }

    res.json(slots.sort());
  } catch (err) {
    console.error("Error fetching slots:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get available staff for a date/outlet
exports.getAvailableStaff = async (req, res) => {
  const { outlet_id, date, time, service_id } = req.query;
  if (!outlet_id || !date)
    return res.status(400).json({ message: "outlet_id and date required" });
  try {
    let duration = 30;
    if (service_id) {
      const svc = await Service.findById(service_id).lean();
      if (!svc) return res.status(404).json({ message: "Service not found" });
      duration = svc.duration;
    }
    const staff = await User.find(
      { role: { $in: ["staff", "manager"] }, outlet_id, isApproved: 1 },
      "_id username",
    ).lean();
    if (!staff.length) return res.json([]);
    const staffIds = staff.map((s) => s._id);

    const [blockedTimes, bookings] = await Promise.all([
      BlockedTime.find({ date, staff_id: { $in: staffIds } }).lean(),
      Booking.find(
        { date, outlet_id, status: { $ne: "Cancelled" } },
        "staff_id time service_id",
      ).lean(),
    ]);

    const bookingServiceIds = [
      ...new Set(bookings.map((b) => b.service_id.toString())),
    ];
    const bookingServices = bookingServiceIds.length
      ? await Service.find(
          { _id: { $in: bookingServiceIds } },
          "duration",
        ).lean()
      : [];
    const sdMap = {};
    bookingServices.forEach((s) => {
      sdMap[s._id.toString()] = s.duration || 30;
    });

    let availableStaff = staff;
    if (time && service_id) {
      const slotStart = new Date(`${date}T${time}`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
      availableStaff = staff.filter((s) => {
        const blocked = blockedTimes
          .filter((bt) => bt.staff_id.toString() === s._id.toString())
          .some((bt) => {
            const bs = new Date(`${date}T${bt.start_time}`);
            const be = new Date(`${date}T${bt.end_time}`);
            return slotStart < be && slotEnd > bs;
          });
        if (blocked) return false;
        const conflict = bookings
          .filter((b) => b.staff_id.toString() === s._id.toString())
          .some((b) => {
            const bs = new Date(`${date}T${b.time}`);
            const be = new Date(
              bs.getTime() + (sdMap[b.service_id.toString()] || 30) * 60 * 1000,
            );
            return slotStart < be && slotEnd > bs;
          });
        if (conflict) return false;
        const nextEvent = [
          ...blockedTimes
            .filter((bt) => bt.staff_id.toString() === s._id.toString())
            .map((bt) => ({
              start: new Date(`${date}T${bt.start_time}`),
              end: new Date(`${date}T${bt.end_time}`),
            })),
          ...bookings
            .filter((b) => b.staff_id.toString() === s._id.toString())
            .map((b) => {
              const bs = new Date(`${date}T${b.time}`);
              return {
                start: bs,
                end: new Date(
                  bs.getTime() +
                    (sdMap[b.service_id.toString()] || 30) * 60 * 1000,
                ),
              };
            }),
        ]
          .filter((e) => e.start > slotStart)
          .sort((a, b) => a.start - b.start)[0];
        return !nextEvent || nextEvent.start >= slotEnd;
      });
    }
    res.json(availableStaff.map((s) => ({ ...s, id: s._id.toString() })));
  } catch (err) {
    console.error("Error fetching staff:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get staff by time slot (returns least busy available staff)
exports.getStaffByTime = async (req, res) => {
  const { outlet_id, date, time, service_id } = req.query;
  if (!outlet_id || !date || !time || !service_id)
    return res
      .status(400)
      .json({ message: "outlet_id, date, time, and service_id required" });
  try {
    const svc = await Service.findById(service_id).lean();
    if (!svc) return res.status(404).json({ message: "Service not found" });
    const duration = svc.duration;
    const staff = await User.find(
      { role: { $in: ["staff", "manager"] }, outlet_id, isApproved: 1 },
      "_id fullname",
    ).lean();
    if (!staff.length) return res.json([]);
    const staffIds = staff.map((s) => s._id);

    const [blockedTimes, bookings] = await Promise.all([
      BlockedTime.find({ date, staff_id: { $in: staffIds } }).lean(),
      Booking.find(
        { date, outlet_id, status: { $ne: "Cancelled" } },
        "staff_id time service_id",
      ).lean(),
    ]);
    const bookingServiceIds = [
      ...new Set(bookings.map((b) => b.service_id.toString())),
    ];
    const bookingServices = bookingServiceIds.length
      ? await Service.find(
          { _id: { $in: bookingServiceIds } },
          "duration",
        ).lean()
      : [];
    const sdMap = {};
    bookingServices.forEach((s) => {
      sdMap[s._id.toString()] = s.duration || 30;
    });

    const slotStart = new Date(`${date}T${time}Z`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    const availableStaff = staff.filter((s) => {
      const blocked = blockedTimes
        .filter((bt) => bt.staff_id.toString() === s._id.toString())
        .some((bt) => {
          const bs = new Date(`${date}T${bt.start_time}Z`);
          const be = new Date(`${date}T${bt.end_time}Z`);
          return slotStart < be && slotEnd > bs;
        });
      if (blocked) return false;
      const conflict = bookings
        .filter((b) => b.staff_id.toString() === s._id.toString())
        .some((b) => {
          const bs = new Date(`${date}T${b.time}Z`);
          const be = new Date(
            bs.getTime() + (sdMap[b.service_id.toString()] || 30) * 60 * 1000,
          );
          return slotStart < be && slotEnd > bs;
        });
      if (conflict) return false;
      const nextEvent = [
        ...blockedTimes
          .filter((bt) => bt.staff_id.toString() === s._id.toString())
          .map((bt) => ({
            start: new Date(`${date}T${bt.start_time}Z`),
            end: new Date(`${date}T${bt.end_time}Z`),
          })),
        ...bookings
          .filter((b) => b.staff_id.toString() === s._id.toString())
          .map((b) => {
            const bs = new Date(`${date}T${b.time}Z`);
            return {
              start: bs,
              end: new Date(
                bs.getTime() +
                  (sdMap[b.service_id.toString()] || 30) * 60 * 1000,
              ),
            };
          }),
      ]
        .filter((e) => e.start > slotStart)
        .sort((a, b) => a.start - b.start)[0];
      return !nextEvent || nextEvent.start >= slotEnd;
    });
    if (!availableStaff.length) return res.json([]);

    const bookingCounts = await Booking.aggregate([
      {
        $match: {
          date,
          staff_id: {
            $in: availableStaff.map(
              (s) => new mongoose.Types.ObjectId(s._id.toString()),
            ),
          },
          status: { $ne: "Cancelled" },
        },
      },
      { $group: { _id: "$staff_id", booking_count: { $sum: 1 } } },
    ]);
    const countMap = {};
    bookingCounts.forEach((bc) => {
      countMap[bc._id.toString()] = bc.booking_count;
    });
    const staffWithCounts = availableStaff.map((s) => ({
      ...s,
      booking_count: countMap[s._id.toString()] || 0,
    }));
    const minBookings = Math.min(
      ...staffWithCounts.map((s) => s.booking_count),
    );
    const leastBusy = staffWithCounts.filter(
      (s) => s.booking_count === minBookings,
    );
    const selected = leastBusy[Math.floor(Math.random() * leastBusy.length)];
    res.json([{ ...selected, id: selected._id.toString() }]);
  } catch (err) {
    console.error("Error fetching staff by time:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get staff bookings for a date range
exports.getStaffBookings = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ message: "Start and end dates required" });
  try {
    const bookings = await Booking.find({
      staff_id: req.userId,
      date: { $gte: startDate, $lte: endDate },
      status: { $nin: ["Cancelled"] },
    })
      .populate("service_id", "name duration")
      .sort({ date: 1, time: 1 })
      .lean();
    res.json(
      bookings.map((b) => ({
        id: b._id.toString(),
        date: b.date,
        start_time: b.time,
        duration: b.service_id ? b.service_id.duration : 30,
        customer_name: b.customer_name,
        service_name: b.service_id ? b.service_id.name : "",
        status: b.status,
      })),
    );
  } catch (err) {
    console.error("Error fetching staff bookings:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// List user bookings
exports.getUserBookings = async (req, res) => {
  try {
    await new Promise((r) => setTimeout(r, 50));
    const bookings = await Booking.find({ user_id: req.userId })
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price duration")
      .populate("staff_id", "username")
      .sort({ date: -1, time: -1 })
      .lean();

    const bookingIds = bookings.map((b) => b._id);
    const reviews = await Review.find({
      booking_id: { $in: bookingIds },
    }).lean();
    const reviewMap = {};
    reviews.forEach((r) => {
      reviewMap[r.booking_id.toString()] = r;
    });

    const result = bookings.map((b) => {
      const rev = reviewMap[b._id.toString()];
      return {
        ...b,
        id: b._id.toString(),
        outlet_shortform: b.outlet_id ? b.outlet_id.shortform : "",
        service_name: b.service_id ? b.service_id.name : "",
        price: b.service_id ? b.service_id.price : 0,
        service_duration: b.service_id ? b.service_id.duration : 30,
        staff_name: b.staff_id ? b.staff_id.username : "",
        payment_method: toPaymentMethodLabel(b.payment_method),
        review: rev
          ? {
              rating: rev.rating,
              comment: rev.comment || null,
              created_at: rev.createdAt,
            }
          : null,
        rating: rev ? rev.rating : undefined,
        comment: rev ? rev.comment : undefined,
        review_created_at: rev ? rev.createdAt : undefined,
      };
    });
    res.json(result);
  } catch (err) {
    console.error("Error fetching user bookings:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Save a booking (creates draft)
exports.createBooking = async (req, res) => {
  const { outlet_id, service_id, staff_id, date, time, customer_name } =
    req.body;
  const missingFields = [];
  if (!outlet_id) missingFields.push("outlet_id");
  if (!service_id) missingFields.push("service_id");
  if (!staff_id) missingFields.push("staff_id");
  if (!date) missingFields.push("date");
  if (!time) missingFields.push("time");
  if (!customer_name) missingFields.push("customer_name");
  if (missingFields.length > 0)
    return res
      .status(400)
      .json({ message: "All fields required", missingFields });
  if (customer_name.length > 10)
    return res
      .status(400)
      .json({ message: "Client name must be 10 characters or less" });

  let finalUserId = req.userId;
  try {
    if (!finalUserId) {
      finalUserId = await resolveOrCreateCustomerUser({
        providedUserId: null,
        phoneNumber: req.body.phone_number || null,
        customerName: customer_name,
        isApproved: 1,
      });
    }

    const slotStart = new Date(`${date}T${time}Z`);
    if (isOutsideOperatingHours(date, slotStart)) {
      return res.status(400).json({ message: OUTSIDE_OPERATING_HOURS_MESSAGE });
    }

    const svc = await Service.findById(service_id).lean();
    if (!svc) return res.status(404).json({ message: "Service not found" });
    const duration = svc.duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const availability = await validateStaffAvailability({
      staffId: staff_id,
      date,
      slotStart,
      slotEnd,
      includeBlockedSlots: true,
      conflictMatch: {
        status: { $ne: "Cancelled" },
        $or: [{ payment_status: "Paid" }, { payment_method: "Pay at Outlet" }],
      },
    });

    if (availability.isBlockedByTime)
      return res.status(400).json({
        message: "Staff or manager not available due to blocked time",
      });
    if (availability.isBlockedBySlot)
      return res.status(400).json({
        message: "Staff or manager not available due to blocked slot",
      });
    if (availability.hasConflict)
      return res.status(400).json({ message: "Slot already booked" });
    if (availability.nextEvent && availability.nextEvent.start < slotEnd) {
      return res
        .status(400)
        .json({ message: "Insufficient time for service duration" });
    }

    const booking = await Booking.create({
      user_id: finalUserId,
      outlet_id,
      service_id,
      staff_id,
      date,
      time,
      customer_name,
      customer_phone: req.body.phone_number || null,
      status: "Pending",
      is_draft: true,
      payment_status: "Pending",
    });

    await new Promise((r) => setTimeout(r, 100));

    const [outletDoc, staffDoc] = await Promise.all([
      Outlet.findById(outlet_id, "shortform").lean(),
      User.findById(staff_id, "username").lean(),
    ]);

    const bookingId = booking._id.toString();

    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking("create", {
          id: bookingId,
          user_id: finalUserId,
          staff_id,
          service_name: svc.name,
          date,
          customer_name,
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    });

    const user = await User.findById(finalUserId, "phone_number email").lean();
    const userPhone = user ? user.phone_number : null;
    const userEmail = user ? user.email : null;

    if (userPhone) {
      setImmediate(async () => {
        try {
          const details = {
            id: bookingId,
            outlet: outletDoc?.shortform || "N/A",
            service: svc.name,
            date: formatDateForDb(date),
            time,
            staff_name: staffDoc?.username || "N/A",
            price: svc.price || 0,
          };
          await sendBookingConfirmation(details, userPhone);
        } catch (e) {
          console.error("SMS error:", e);
        }
      });
    }

    if (userEmail && userEmail !== "customer@huuksystem.com") {
      setImmediate(async () => {
        try {
          const details = {
            id: bookingId,
            outlet: outletDoc?.shortform || "N/A",
            service: svc.name,
            date: formatDateForDb(date),
            time,
            customer_name,
            staff_name: staffDoc?.username || "N/A",
            price: svc.price || 0,
            payment_method: "Pending",
            payment_status: "Pending",
          };
          await retryOperation(() => sendReceiptEmail(details, userEmail));
        } catch (e) {
          console.error("Email error:", e);
        }
      });
    }

    res.json({
      message: "Draft booking created",
      booking: {
        id: bookingId,
        customer_name,
        outlet_name: outletDoc?.shortform || "N/A",
        staff_name: staffDoc?.username || "N/A",
        service_name: svc.name,
        date,
        time,
        price: parseFloat(svc.price) || 0,
        payment_method: "Stripe",
        payment_status: "Pending",
      },
      bookingId,
      isDraft: true,
    });
  } catch (err) {
    console.error("Error saving booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Finalize a draft booking after payment
exports.finalizeBooking = async (req, res) => {
  const { bookingId } = req.params;
  if (!bookingId)
    return res.status(400).json({ message: "Booking ID required" });
  try {
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const isUserBooking =
      booking.user_id && booking.user_id.toString() === req.userId;
    const isStaff = ["staff", "manager", "admin"].includes(req.role);
    if (!isUserBooking && !isStaff)
      return res
        .status(403)
        .json({ message: "Not authorized to finalize this booking" });
    if (!booking.is_draft) {
      return res.json({
        message: "Booking is already finalized",
        bookingId,
        status: booking.status,
      });
    }
    await Booking.findByIdAndUpdate(bookingId, { $set: { is_draft: false } });
    res.json({ message: "Booking finalized successfully", bookingId });
  } catch (err) {
    console.error("Error finalizing booking:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Create a staff appointment
exports.createStaffAppointment = async (req, res) => {
  const {
    service_id,
    staff_id,
    date,
    time,
    customer_name,
    phone_number,
    user_id,
  } = req.body;
  const errors = [];
  if (!service_id) errors.push("Valid service_id is required");
  if (!staff_id) errors.push("Valid staff_id is required");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    errors.push("Valid date (YYYY-MM-DD) is required");
  if (!time || !/^\d{2}:\d{2}$/.test(time))
    errors.push("Valid time (HH:MM) is required");
  if (!customer_name || customer_name.trim().length === 0)
    errors.push("Customer name is required");
  if (customer_name && customer_name.trim().length > 100)
    errors.push("Customer name must be 100 characters or less");
  if (errors.length > 0)
    return res.status(400).json({ message: "Validation failed", errors });

  try {
    let finalUserId = await resolveOrCreateCustomerUser({
      providedUserId: user_id,
      phoneNumber: phone_number || null,
      customerName: customer_name,
      isApproved: 1,
    });

    const staffDoc = await User.findOne({
      _id: staff_id,
      role: { $in: ["staff", "manager"] },
      isApproved: 1,
    }).lean();
    if (!staffDoc)
      return res
        .status(400)
        .json({ message: "Staff or manager not available or not approved" });
    const staffOutletId = staffDoc.outlet_id;

    const slotStart = new Date(`${date}T${time}Z`);
    if (isOutsideOperatingHours(date, slotStart)) {
      return res.status(400).json({ message: OUTSIDE_OPERATING_HOURS_MESSAGE });
    }

    const svc = await Service.findById(
      service_id,
      "duration price name",
    ).lean();
    if (!svc) return res.status(404).json({ message: "Service not found" });
    const duration = svc.duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const availability = await validateStaffAvailability({
      staffId: staff_id,
      date,
      slotStart,
      slotEnd,
    });
    if (availability.isBlockedByTime)
      return res.status(400).json({
        message: "Staff or manager not available due to blocked time",
      });
    if (availability.hasConflict)
      return res.status(400).json({ message: "Slot already booked" });

    const booking = await Booking.create({
      outlet_id: staffOutletId,
      service_id,
      staff_id,
      user_id: finalUserId,
      date,
      time,
      customer_name: customer_name.trim(),
      customer_phone: phone_number || null,
      status: "Confirmed",
      payment_status: "Pending",
      payment_method: "Pay at Outlet",
    });

    const [outletDoc] = await Promise.all([
      Outlet.findById(staffOutletId, "shortform").lean(),
    ]);

    res.status(201).json({
      message: "Booking created successfully",
      booking: {
        id: booking._id.toString(),
        customer_name: booking.customer_name,
        phone_number: phone_number || null,
        date: booking.date,
        time: booking.time,
        service_name: svc.name || "",
        duration: svc.duration || 30,
        price: svc.price || 0,
        staff_name: staffDoc.username || "",
        outlet_name: outletDoc?.shortform || "",
      },
      success: true,
    });
  } catch (err) {
    console.error("Error saving staff appointment:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Reschedule a staff appointment
exports.rescheduleStaffAppointment = async (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body;
  if (!id || !date || !time)
    return res
      .status(400)
      .json({ message: "Appointment ID, date, and time required" });
  try {
    const appointment = await Booking.findById(id).lean();
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    const slotStart = new Date(`${date}T${time}Z`);
    if (
      slotStart < new Date(`${date}T10:00:00Z`) ||
      slotStart > new Date(`${date}T21:00:00Z`)
    ) {
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }

    const svc = await Service.findById(
      appointment.service_id,
      "duration",
    ).lean();
    if (!svc) return res.status(404).json({ message: "Service not found" });
    const slotEnd = new Date(slotStart.getTime() + svc.duration * 60 * 1000);

    const availability = await validateStaffAvailability({
      staffId: appointment.staff_id,
      date,
      slotStart,
      slotEnd,
      excludeBookingId: id,
    });
    if (availability.isBlockedByTime)
      return res
        .status(400)
        .json({ message: "Staff not available due to blocked time" });
    if (availability.hasConflict)
      return res.status(400).json({ message: "Slot already booked" });

    await Booking.findByIdAndUpdate(id, { $set: { date, time } });

    const updated = await Booking.findById(id)
      .populate("service_id", "name duration")
      .populate("user_id", "phone_number")
      .lean();

    res.json({
      message: "Appointment rescheduled successfully",
      appointment: updated
        ? {
            id: updated._id.toString(),
            customer_name: updated.customer_name,
            phone_number:
              updated.user_id?.phone_number || updated.customer_phone || null,
            service_name: updated.service_id?.name || "",
            start_time: updated.time,
            end_time: calculateEndTime(
              updated.time,
              updated.service_id?.duration || 30,
            ),
            status: updated.status,
            booking_date: updated.date,
            payment_method: updated.payment_method,
            payment_status: updated.payment_status,
          }
        : null,
      newDate: date,
      newTime: time,
    });
  } catch (err) {
    console.error("Error rescheduling appointment:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Cancel a staff appointment
exports.cancelStaffAppointment = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "Appointment ID required" });
  try {
    const appointment = await Booking.findById(id).lean();
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });
    await Booking.findByIdAndUpdate(id, { $set: { status: "Cancelled" } });
    res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error("Error cancelling appointment:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Cancel a booking
exports.cancelBooking = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  try {
    const booking = await Booking.findById(booking_id)
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price")
      .populate("staff_id", "username")
      .populate("user_id", "email phone_number")
      .lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!booking.user_id || booking.user_id._id.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const bookingDate = new Date(booking.date);
    const now = new Date();
    const hoursDiff = (bookingDate - now) / (1000 * 60 * 60);
    if (hoursDiff < 24)
      return res.status(400).json({ message: "Cannot cancel within 24 hours" });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cancelCount = await Booking.countDocuments({
      user_id: req.userId,
      status: "Cancelled",
      createdAt: { $gte: monthStart },
    });
    if (cancelCount >= 3)
      return res
        .status(400)
        .json({ message: "Maximum 3 cancellations per month allowed" });

    let refundStatus = booking.payment_status;
    if (booking.payment_status === "Paid" && booking.payment_intent_id) {
      const daysDiff = Math.ceil(hoursDiff / 24);
      if (daysDiff > 3) {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        try {
          await stripe.refunds.create({
            payment_intent: booking.payment_intent_id,
          });
          refundStatus = "Refunded";
        } catch (stripeErr) {
          console.error("Stripe refund error:", { message: stripeErr.message });
          throw new Error("Failed to process refund: " + stripeErr.message);
        }
      }
    }

    await Booking.findByIdAndUpdate(booking_id, {
      $set: { status: "Cancelled", payment_status: refundStatus },
    });

    const bookingDetails = buildBookingPaymentDetails({
      id: booking_id,
      outlet: booking.outlet_id?.shortform,
      service: booking.service_id?.name,
      date: booking.date,
      time: booking.time,
      customer_name: booking.customer_name,
      staff_name: booking.staff_id?.username,
      price: parseFloat(booking.service_id?.price) || 0,
      payment_method: booking.payment_method,
      payment_status: refundStatus,
    });

    if (booking.user_id?.email) {
      await retryOperation(() =>
        sendCancelConfirmation(bookingDetails, booking.user_id.email),
      );
    }
    if (booking.user_id?.phone_number) {
      setImmediate(async () => {
        try {
          await sendCancellationSMS(
            bookingDetails,
            booking.user_id.phone_number,
          );
        } catch (e) {
          console.error("SMS cancel error:", e);
        }
      });
    }

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    console.error("Error cancelling booking:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete booking (cleanup of incomplete bookings)
exports.deleteBooking = async (req, res) => {
  const { bookingId } = req.params;
  if (!bookingId)
    return res.status(400).json({ message: "Booking ID required" });
  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      user_id: req.userId,
    }).lean();
    if (!booking)
      return res
        .status(404)
        .json({ message: "Booking not found or not authorized" });
    if (booking.payment_status === "Paid")
      return res
        .status(400)
        .json({ message: "Cannot delete completed bookings" });
    await Booking.findByIdAndDelete(bookingId);
    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    console.error("Error deleting booking:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Send booking receipt via email (route handler)
exports.sendBookingReceipt = async (req, res) => {
  const { booking_id, email } = req.body;
  if (!booking_id || !email)
    return res.status(400).json({ message: "Booking ID and email required" });
  try {
    const booking = await Booking.findOne({
      _id: booking_id,
      user_id: req.userId,
    })
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price")
      .populate("staff_id", "username")
      .lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (
      booking.payment_status !== "Paid" &&
      booking.payment_method !== "Pay at Outlet"
    ) {
      return res
        .status(400)
        .json({ message: "Booking not paid or not set to pay at outlet" });
    }
    const details = buildBookingPaymentDetails({
      id: booking_id,
      outlet: booking.outlet_id?.shortform,
      service: booking.service_id?.name,
      date: booking.date,
      time: booking.time,
      customer_name: booking.customer_name,
      staff_name: booking.staff_id?.username,
      price: parseFloat(booking.service_id?.price) || 0,
      payment_method: booking.payment_method,
      payment_status: booking.payment_status,
    });
    await retryOperation(() => sendReceiptEmail(details, email));
    res.json({ message: "Receipt sent successfully" });
  } catch (err) {
    console.error("Error sending receipt:", { message: err.message });
    res
      .status(500)
      .json({ message: "Failed to send receipt", error: err.message });
  }
};

// Set payment method to Pay at Outlet and send receipt
exports.setPayAtOutlet = async (req, res) => {
  const { booking_id, email, user_id, debug } = req.body;
  if (!booking_id || !email) {
    return res.status(400).json({ message: "Booking ID and email required" });
  }
  const userId = user_id || req.userId;
  const isPlaceholderEmail = email === "customer@huuksystem.com";
  if (!isPlaceholderEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
  }
  try {
    const booking = await Booking.findById(booking_id)
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price")
      .populate("staff_id", "username")
      .populate("user_id", "phone_number email")
      .lean();

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const actualUserId = booking.user_id
      ? booking.user_id._id.toString()
      : null;
    if (actualUserId && actualUserId !== String(userId) && !debug) {
      if (!["staff", "manager", "admin"].includes(req.role)) {
        return res.status(403).json({
          message: "You don't have permission to modify this booking",
        });
      }
    }

    await Booking.findByIdAndUpdate(booking_id, {
      $set: { payment_method: "Pay at Outlet", payment_status: "Pending" },
    });

    const bookingDetails = buildBookingPaymentDetails({
      id: booking_id,
      outlet: booking.outlet_id?.shortform,
      service: booking.service_id?.name,
      date: booking.date,
      time: booking.time,
      customer_name: booking.customer_name,
      staff_name: booking.staff_id?.username,
      price: booking.service_id?.price || 0,
      payment_method: "Pay at Outlet",
      payment_status: "Pending",
    });

    const userEmail = booking.user_id?.email;
    if (userEmail && !isPlaceholderEmail) {
      try {
        await retryOperation(() => sendReceiptEmail(bookingDetails, userEmail));
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }
    }

    const userPhone = booking.user_id?.phone_number;
    if (userPhone) {
      setImmediate(async () => {
        try {
          await sendBookingConfirmation(bookingDetails, userPhone);
        } catch (e) {
          console.error("SMS error:", e);
        }
      });
    }

    res.json({
      message: "Payment method set and confirmation sent successfully",
    });
  } catch (err) {
    console.error("Error setting pay at outlet:", {
      message: err.message,
      stack: err.stack,
      booking_id,
    });
    res
      .status(500)
      .json({ message: "Failed to process request", error: err.message });
  }
};

// Set payment method to Pay at Outlet for multiple bookings
exports.setMultiplePayAtOutlet = async (req, res) => {
  const { booking_ids, email, user_id, debug } = req.body;
  if (!booking_ids || !Array.isArray(booking_ids) || booking_ids.length === 0) {
    return res
      .status(400)
      .json({ message: "Valid booking IDs array required" });
  }
  if (!email) return res.status(400).json({ message: "Email required" });

  const userId = user_id || req.userId;
  const isPlaceholderEmail = email === "customer@huuksystem.com";
  if (!isPlaceholderEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const results = [];
    const failedBookings = [];

    for (const bookingId of booking_ids) {
      try {
        const booking = await Booking.findById(bookingId)
          .populate("outlet_id", "shortform")
          .populate("service_id", "name price")
          .populate("staff_id", "username")
          .populate("user_id", "phone_number email")
          .lean();

        if (!booking) {
          failedBookings.push({ id: bookingId, error: "Booking not found" });
          continue;
        }

        const actualUserId = booking.user_id
          ? booking.user_id._id.toString()
          : null;
        if (actualUserId && actualUserId !== String(userId) && !debug) {
          if (!["staff", "manager", "admin"].includes(req.role)) {
            failedBookings.push({ id: bookingId, error: "Permission denied" });
            continue;
          }
        }

        await Booking.findByIdAndUpdate(bookingId, {
          $set: { payment_method: "Pay at Outlet", payment_status: "Pending" },
        });

        results.push({
          ...buildBookingPaymentDetails({
            id: bookingId,
            outlet: booking.outlet_id?.shortform,
            service: booking.service_id?.name,
            date: booking.date,
            time: booking.time,
            customer_name: booking.customer_name,
            staff_name: booking.staff_id?.username,
            price: booking.service_id?.price || 0,
            payment_method: "Pay at Outlet",
            payment_status: "Pending",
          }),
        });
      } catch (bookingError) {
        console.error(`Error processing booking ${bookingId}:`, bookingError);
        failedBookings.push({ id: bookingId, error: "Processing error" });
      }
    }

    if (results.length === 0 && failedBookings.length > 0) {
      return res
        .status(400)
        .json({ message: "Failed to update any bookings", failedBookings });
    }

    return res.status(200).json({
      message: `Payment method set to Pay at Outlet for ${results.length} bookings`,
      bookings: results,
      failedBookings: failedBookings.length > 0 ? failedBookings : undefined,
      successCount: results.length,
      failCount: failedBookings.length,
    });
  } catch (err) {
    console.error("Error setting multiple pay at outlet:", err);
    return res
      .status(500)
      .json({ message: "Error setting pay at outlet for multiple bookings" });
  }
};

// Confirm Pay at Outlet payment
exports.confirmPayAtOutlet = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  try {
    const booking = await Booking.findOne({
      _id: booking_id,
      payment_method: "Pay at Outlet",
      payment_status: "Pending",
    })
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price")
      .populate("staff_id", "username")
      .lean();
    if (!booking)
      return res.status(404).json({
        message: "Booking not found or not eligible for confirmation",
      });

    const { user_id, date, customer_name } = booking;

    const relatedBookings = await Booking.find(
      {
        user_id,
        date,
        customer_name,
        payment_status: "Pending",
      },
      "_id",
    ).lean();

    if (relatedBookings.length > 0) {
      const relatedIds = relatedBookings.map((b) => b._id);
      await Booking.updateMany(
        { _id: { $in: relatedIds } },
        { $set: { payment_status: "Paid" } },
      );
    }

    const bookingDetails = buildBookingPaymentDetails({
      id: booking_id,
      outlet: booking.outlet_id?.shortform,
      service: booking.service_id?.name,
      date: booking.date,
      time: booking.time,
      customer_name: booking.customer_name,
      staff_name: booking.staff_id?.username,
      price: parseFloat(booking.service_id?.price) || 0,
      payment_method: "Pay at Outlet",
      payment_status: "Paid",
    });

    const userDoc = await User.findById(booking.user_id, "email").lean();
    if (userDoc && userDoc.email) {
      await retryOperation(() =>
        sendReceiptEmail(bookingDetails, userDoc.email),
      );
    }

    res.json({ message: "Payment confirmed and receipt sent successfully" });
  } catch (err) {
    console.error("Error confirming Pay at Outlet:", {
      message: err.message,
      stack: err.stack,
      booking_id,
    });
    res
      .status(500)
      .json({ message: "Failed to confirm payment", error: err.message });
  }
};

// Sales report for staff outlet
exports.getStaffSales = async (req, res) => {
  if (req.role !== "staff")
    return res.status(403).json({ message: "Staff role required" });
  const { outlet_id, date } = req.query;
  if (!outlet_id || !date)
    return res.status(400).json({ message: "Outlet ID and date required" });
  try {
    const [summary] = await Booking.aggregate([
      {
        $match: {
          outlet_id: new mongoose.Types.ObjectId(outlet_id),
          date,
          payment_status: "Paid",
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: null,
          booking_count: { $sum: 1 },
          total_revenue: { $sum: { $ifNull: ["$service.price", 0] } },
        },
      },
    ]);
    const topServicesRaw = await Booking.aggregate([
      { $match: { outlet_id: new mongoose.Types.ObjectId(outlet_id), date } },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: "$service._id",
          name: { $first: "$service.name" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);
    res.json({
      total_revenue: summary ? summary.total_revenue || 0 : 0,
      booking_count: summary ? summary.booking_count : 0,
      top_services: topServicesRaw.map((s) => ({
        name: s.name,
        count: s.count,
      })),
    });
  } catch (err) {
    console.error("Error fetching sales:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Payment summary for staff outlet
exports.getStaffPayments = async (req, res) => {
  if (req.role !== "staff")
    return res.status(403).json({ message: "Staff role required" });
  const { outlet_id, date } = req.query;
  if (!outlet_id || !date)
    return res.status(400).json({ message: "Outlet ID and date required" });
  try {
    const summary = await Booking.aggregate([
      { $match: { outlet_id: new mongoose.Types.ObjectId(outlet_id), date } },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: "$payment_status",
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$service.price", 0] } },
        },
      },
    ]);
    const result = {
      Paid: { count: 0, amount: 0 },
      Pending: { count: 0, amount: 0 },
    };
    summary.forEach((r) => {
      if (result[r._id])
        result[r._id] = { count: r.count, amount: r.amount || 0 };
    });
    res.json(result);
  } catch (err) {
    console.error("Error fetching payments:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Sales report for all outlets (manager)
exports.getManagerSales = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "Date required" });
  try {
    const [summary] = await Booking.aggregate([
      { $match: { date, payment_status: "Paid" } },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: null,
          booking_count: { $sum: 1 },
          total_revenue: { $sum: { $ifNull: ["$service.price", 0] } },
        },
      },
    ]);
    const topServicesRaw = await Booking.aggregate([
      { $match: { date } },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: "$service._id",
          name: { $first: "$service.name" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);
    res.json({
      total_revenue: summary ? summary.total_revenue || 0 : 0,
      booking_count: summary ? summary.booking_count : 0,
      top_services: topServicesRaw.map((s) => ({
        name: s.name,
        count: s.count,
      })),
    });
  } catch (err) {
    console.error("Error fetching manager sales:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Payment summary for all outlets (manager)
exports.getManagerPayments = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "Date required" });
  try {
    const summary = await Booking.aggregate([
      { $match: { date } },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: "$payment_status",
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$service.price", 0] } },
        },
      },
    ]);
    const result = {
      Paid: { count: 0, amount: 0 },
      Pending: { count: 0, amount: 0 },
    };
    summary.forEach((r) => {
      if (result[r._id])
        result[r._id] = { count: r.count, amount: r.amount || 0 };
    });
    res.json(result);
  } catch (err) {
    console.error("Error fetching manager payments:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Sales report for today's completed bookings (for pie chart)
exports.getSalesReport = async (req, res) => {
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  try {
    const today = getTodayString();
    const results = await Booking.aggregate([
      { $match: { date: today, status: { $in: ["Completed", "Done"] } } },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: { id: "$service._id", name: "$service.name" },
          count: { $sum: 1 },
          total: { $sum: { $ifNull: ["$service.price", 0] } },
        },
      },
      { $sort: { "_id.name": 1 } },
    ]);
    const totalSales = results.reduce(
      (sum, item) => sum + (item.total || 0),
      0,
    );
    res.json({
      labels: results.map((item) => item._id.name || ""),
      data: results.map((item) => item.count),
      totalSales,
    });
  } catch (err) {
    console.error("Error fetching sales report:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get today's transaction count grouped by outlet
exports.getTodayTransactionsByOutlet = async (req, res) => {
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  try {
    const today = getTodayString();
    const results = await Booking.aggregate([
      { $match: { date: today, status: { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "outlets",
          localField: "outlet_id",
          foreignField: "_id",
          as: "outlet",
        },
      },
      { $unwind: { path: "$outlet", preserveNullAndEmpty: true } },
      {
        $group: {
          _id: { id: "$outlet._id", shortform: "$outlet.shortform" },
          transaction_count: { $sum: 1 },
        },
      },
      { $sort: { "_id.shortform": 1 } },
    ]);
    res.json({
      date: today,
      outlets: results.map((r) => ({
        outlet_name: r._id.shortform || "",
        transaction_count: r.transaction_count,
      })),
    });
  } catch (err) {
    console.error("Error fetching today's transactions by outlet:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get staff appointments with pagination and filtering
exports.getStaffAppointments = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  const { date, status, page = 1, limit = 10, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const query = {
      staff_id: req.userId,
      payment_method: { $exists: true, $ne: null },
    };
    if (date) query.date = date;
    if (status && status !== "all") query.status = status;
    if (search) {
      const matchingServices = await Service.find(
        { name: { $regex: search, $options: "i" } },
        "_id",
      ).lean();
      const serviceIds = matchingServices.map((s) => s._id);
      query.$or = [
        { customer_name: { $regex: search, $options: "i" } },
        { customer_phone: { $regex: search, $options: "i" } },
        { service_id: { $in: serviceIds } },
      ];
    }
    const totalCount = await Booking.countDocuments(query);
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const bookings = await Booking.find(query)
      .populate("service_id", "name duration")
      .populate("user_id", "phone_number")
      .populate("staff_id", "username fullname")
      .sort({ date: -1, time: 1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const appointments = bookings
      .filter((b) => b.service_id !== null)
      .map((b) => ({
        id: b._id.toString(),
        customer_name: b.customer_name,
        phone_number: b.user_id?.phone_number || b.customer_phone || null,
        service_name: b.service_id?.name || "",
        start_time: b.time,
        end_time: calculateEndTime(
          b.time || "10:00",
          b.service_id?.duration || 30,
        ),
        status: b.status,
        booking_date: b.date,
        payment_method: b.payment_method,
        payment_status: b.payment_status,
        staff_username: b.staff_id?.username || "",
        staff_fullname: b.staff_id?.fullname || "",
      }));

    res.json({
      appointments,
      totalPages,
      currentPage: parseInt(page),
      totalCount,
    });
  } catch (err) {
    console.error("Error fetching staff appointments:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get booking details by ID
exports.getBookingDetails = async (req, res) => {
  const { id } = req.params;
  const debug = req.query.debug === "true";
  if (!id) return res.status(400).json({ message: "Booking ID required" });
  try {
    let booking;
    if (["staff", "manager", "admin"].includes(req.role)) {
      booking = await Booking.findById(id)
        .populate("service_id", "name price duration")
        .populate("outlet_id", "name shortform")
        .populate("user_id", "phone_number")
        .populate("staff_id", "username fullname")
        .lean();
    } else {
      booking = await Booking.findOne({ _id: id, user_id: req.userId })
        .populate("service_id", "name price duration")
        .populate("outlet_id", "name shortform")
        .populate("user_id", "phone_number")
        .populate("staff_id", "username fullname")
        .lean();
      if (!booking && debug) {
        booking = await Booking.findById(id)
          .populate("service_id", "name price duration")
          .populate("outlet_id", "name shortform")
          .populate("user_id", "phone_number")
          .populate("staff_id", "username fullname")
          .lean();
      }
    }
    if (!booking)
      return res
        .status(404)
        .json({ message: "Booking not found or not authorized" });

    const endTime = calculateEndTime(
      booking.time || "10:00",
      booking.service_id?.duration || 30,
    );
    const bookingData = {
      id: booking._id.toString(),
      bookingId: booking._id.toString(),
      customer_name: booking.customer_name,
      customerName: booking.customer_name,
      service_name: booking.service_id?.name || "",
      serviceName: booking.service_id?.name || "",
      payment_method: booking.payment_method,
      paymentMethod: booking.payment_method,
      payment_status: booking.payment_status,
      paymentStatus: booking.payment_status,
      price: booking.service_id?.price || 0,
      totalAmount: booking.service_id?.price || 0,
      time: booking.time,
      startTime: booking.time,
      endTime,
      date: booking.date,
      bookingDate: booking.date,
      staff_name:
        booking.staff_id?.fullname || booking.staff_id?.username || "",
      staffName: booking.staff_id?.fullname || booking.staff_id?.username || "",
      staff_id: booking.staff_id ? booking.staff_id._id.toString() : null,
      user_id: booking.user_id ? booking.user_id._id.toString() : null,
      phoneNumber:
        booking.user_id?.phone_number || booking.customer_phone || null,
      outlet: booking.outlet_id?.name || "",
      outlet_shortform: booking.outlet_id?.shortform || "",
    };
    res.json(bookingData);
  } catch (err) {
    console.error("Error fetching booking details:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  const { id } = req.params;
  const { status } = req.body;
  if (!id || !status)
    return res
      .status(400)
      .json({ message: "Appointment ID and status required" });

  const validStatuses = [
    "Pending",
    "Confirmed",
    "Completed",
    "Cancelled",
    "pending",
    "confirmed",
    "completed",
    "cancelled",
    "absent",
    "Absent",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: `Invalid status: ${status}. Valid statuses are: ${validStatuses.join(", ")}`,
    });
  }

  let normalizedStatus =
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const finalStatus =
    status.toLowerCase() === "absent" ? "Cancelled" : normalizedStatus;

  try {
    const appointment = await Booking.findOne({
      _id: id,
      staff_id: req.userId,
    }).lean();
    if (!appointment)
      return res
        .status(404)
        .json({ message: "Appointment not found or not authorized" });

    await Booking.findByIdAndUpdate(id, { $set: { status: finalStatus } });

    if (status === "Completed") {
      const isPayAtOutlet = appointment.payment_method === "Pay at Outlet";
      const isPendingPayment = appointment.payment_status === "Pending";
      if (isPayAtOutlet && isPendingPayment) {
        return res.json({
          message: "Appointment marked as completed",
          showPaymentConfirmation: true,
          bookingId: id,
          paymentMethod: appointment.payment_method,
          paymentStatus: appointment.payment_status,
        });
      }
    }

    res.json({ message: "Appointment status updated successfully" });
  } catch (err) {
    console.error("Error updating appointment status:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Add a blocked time
exports.blockTime = async (req, res) => {
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  const { staff_id, date, start_time, end_time, reason } = req.body;
  if (!staff_id || !date || !start_time || !end_time || !reason) {
    return res.status(400).json({ message: "All fields required" });
  }
  try {
    const user = await User.findOne({
      _id: staff_id,
      role: { $in: ["staff", "manager"] },
      isApproved: 1,
    }).lean();
    if (!user)
      return res
        .status(404)
        .json({ message: "Approved staff or manager not found" });

    if (req.role === "staff" && staff_id.toString() !== req.userId.toString()) {
      return res
        .status(403)
        .json({ message: "Staff can only block their own time" });
    }

    const start = new Date(`${date}T${start_time}Z`);
    const end = new Date(`${date}T${end_time}Z`);
    if (start >= end)
      return res
        .status(400)
        .json({ message: "Start time must be before end time" });

    const existingBlocks = await BlockedTime.find({
      staff_id,
      date,
      $or: [{ start_time: { $lt: end_time }, end_time: { $gt: start_time } }],
    }).lean();
    if (existingBlocks.length)
      return res
        .status(400)
        .json({ message: "Overlapping blocked time exists" });

    const result = await BlockedTime.create({
      staff_id,
      date,
      start_time,
      end_time,
    });
    res.json({ message: "Blocked time added", blockId: result._id.toString() });
  } catch (err) {
    console.error("Error adding blocked time:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// List blocked times
exports.getBlockedTimes = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { staff_id, date } = req.query;
  if (!staff_id || !date)
    return res.status(400).json({ message: "Staff ID and date required" });
  try {
    const results = await BlockedTime.find({ staff_id, date }).lean();
    res.json(
      results.map((r) => ({
        id: r._id.toString(),
        start_time: r.start_time,
        end_time: r.end_time,
        reason: null,
      })),
    );
  } catch (err) {
    console.error("Error fetching blocked times:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Submit a review
exports.submitReview = async (req, res) => {
  const { booking_id, user_id, staff_id, rating, comment } = req.body;
  if (!booking_id || !user_id || !staff_id || !rating) {
    return res
      .status(400)
      .json({ message: "All required fields must be provided" });
  }
  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  try {
    const booking = await Booking.findById(
      booking_id,
      "date time user_id status",
    ).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user_id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });
    const bookingDateTime = new Date(`${booking.date}T${booking.time}Z`);
    if (bookingDateTime > new Date())
      return res.status(400).json({ message: "Cannot review future bookings" });
    if (!["Confirmed", "Completed"].includes(booking.status)) {
      return res.status(400).json({ message: "Booking must be confirmed" });
    }
    const reviewCutoff = new Date(
      bookingDateTime.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    if (new Date() > reviewCutoff)
      return res.status(400).json({ message: "Review period has expired" });
    const existingReview = await Review.findOne({ booking_id }).lean();
    if (existingReview)
      return res.status(400).json({ message: "Review already submitted" });
    const result = await Review.create({
      booking_id,
      user_id,
      rating,
      comment: comment || null,
    });
    res.json({ message: "Review submitted", reviewId: result._id.toString() });
  } catch (err) {
    console.error("Error submitting review:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Fetch review for a booking
exports.getReview = async (req, res) => {
  const { booking_id } = req.params;
  try {
    const booking = await Booking.findById(booking_id, "user_id").lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user_id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });
    const review = await Review.findOne({ booking_id }).lean();
    if (!review) return res.status(404).json({ message: "No review found" });
    res.json({
      id: review._id.toString(),
      rating: review.rating,
      comment: review.comment,
      created_at: review.createdAt,
    });
  } catch (err) {
    console.error("Error fetching review:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update a review
exports.updateReview = async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  if (!rating) return res.status(400).json({ message: "Rating is required" });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  try {
    const review = await Review.findById(id, "booking_id").lean();
    if (!review) return res.status(404).json({ message: "Review not found" });
    const booking = await Booking.findById(
      review.booking_id,
      "date time user_id",
    ).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user_id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });
    const bookingDateTime = new Date(`${booking.date}T${booking.time}Z`);
    const reviewCutoff = new Date(
      bookingDateTime.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    if (new Date() > reviewCutoff)
      return res
        .status(400)
        .json({ message: "Review edit period has expired" });
    await Review.findByIdAndUpdate(id, {
      $set: { rating, comment: comment || null },
    });
    res.json({ message: "Review updated" });
  } catch (err) {
    console.error("Error updating review:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update a booking
exports.updateBooking = async (req, res) => {
  const { bookingId } = req.params;
  const { outlet_id, service_id, staff_id, date, time, customer_name } =
    req.body;
  if (
    !bookingId ||
    !outlet_id ||
    !service_id ||
    !staff_id ||
    !date ||
    !time ||
    !customer_name
  ) {
    return res.status(400).json({ message: "All fields required" });
  }
  if (customer_name.length > 10)
    return res
      .status(400)
      .json({ message: "Client name must be 10 characters or less" });
  try {
    const existingBooking = await Booking.findOne({
      _id: bookingId,
      user_id: req.userId,
    }).lean();
    if (!existingBooking)
      return res
        .status(404)
        .json({ message: "Booking not found or not authorized" });

    const staffDoc = await User.findOne({
      _id: staff_id,
      role: { $in: ["staff", "manager"] },
      isApproved: 1,
    }).lean();
    if (!staffDoc)
      return res
        .status(400)
        .json({ message: "Staff or manager not available or not approved" });

    const slotStart = new Date(`${date}T${time}Z`);
    if (isOutsideOperatingHours(date, slotStart)) {
      return res.status(400).json({ message: OUTSIDE_OPERATING_HOURS_MESSAGE });
    }

    const svc = await Service.findById(
      service_id,
      "duration name price",
    ).lean();
    if (!svc) return res.status(404).json({ message: "Service not found" });
    const duration = svc.duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const availability = await validateStaffAvailability({
      staffId: staff_id,
      date,
      slotStart,
      slotEnd,
      excludeBookingId: bookingId,
    });
    if (availability.isBlockedByTime)
      return res.status(400).json({
        message: "Staff or manager not available due to blocked time",
      });
    if (availability.hasConflict)
      return res.status(400).json({ message: "Slot already booked" });

    await Booking.findByIdAndUpdate(bookingId, {
      $set: { outlet_id, service_id, staff_id, date, time, customer_name },
    });

    const [outletDoc, staffInfoDoc] = await Promise.all([
      Outlet.findById(outlet_id, "shortform").lean(),
      User.findById(staff_id, "username").lean(),
    ]);

    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking("update", {
          id: bookingId,
          user_id: req.userId,
          staff_id,
          service_name: svc.name,
          date,
          customer_name,
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    });

    res.json({
      message: "Booking updated successfully",
      booking: {
        id: bookingId,
        customer_name,
        outlet_name: outletDoc?.shortform || "N/A",
        staff_name: staffInfoDoc?.username || "N/A",
        service_name: svc.name || "N/A",
        date,
        time,
        price: parseFloat(svc.price) || 0,
        payment_method: "Stripe",
        payment_status: "Pending",
      },
      bookingId,
    });
  } catch (err) {
    console.error("Error updating booking:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Reschedule a booking
exports.rescheduleBooking = async (req, res) => {
  const { booking_id, date, time, staff_id } = req.body;
  if (!booking_id || !date || !time || !staff_id) {
    return res.status(400).json({ message: "All fields required" });
  }
  try {
    const booking = await Booking.findById(booking_id)
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price duration")
      .populate("staff_id", "username")
      .populate("user_id", "email phone_number")
      .lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!booking.user_id || booking.user_id._id.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const currentBookingDateTime = new Date(`${booking.date}T${booking.time}Z`);
    const now = new Date();
    const hoursDiff = (currentBookingDateTime - now) / (1000 * 60 * 60);
    if (hoursDiff < 24)
      return res
        .status(400)
        .json({ message: "Cannot reschedule within 24 hours" });
    if (booking.status === "Cancelled")
      return res
        .status(400)
        .json({ message: "Cannot reschedule cancelled booking" });

    const staffDoc = await User.findOne({
      _id: staff_id,
      role: { $in: ["staff", "manager"] },
      isApproved: 1,
    }).lean();
    if (!staffDoc)
      return res
        .status(400)
        .json({ message: "Staff not available or not approved" });

    const slotStart = new Date(`${date}T${time}Z`);
    if (isOutsideOperatingHours(date, slotStart)) {
      return res.status(400).json({ message: OUTSIDE_OPERATING_HOURS_MESSAGE });
    }

    const duration = booking.service_id?.duration || 30;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const availability = await validateStaffAvailability({
      staffId: staff_id,
      date,
      slotStart,
      slotEnd,
      excludeBookingId: booking_id,
    });
    if (availability.isBlockedByTime)
      return res
        .status(400)
        .json({ message: "Staff not available due to blocked time" });
    if (availability.hasConflict)
      return res.status(400).json({ message: "Slot already booked" });
    if (availability.nextEvent && availability.nextEvent.start < slotEnd) {
      return res
        .status(400)
        .json({ message: "Insufficient time for service duration" });
    }

    await Booking.findByIdAndUpdate(booking_id, {
      $set: { date, time, staff_id },
    });

    const bookingDetails = buildBookingPaymentDetails({
      id: booking_id,
      outlet: booking.outlet_id?.shortform,
      service: booking.service_id?.name,
      date,
      time,
      customer_name: booking.customer_name,
      staff_name: booking.staff_id?.username,
      price: parseFloat(booking.service_id?.price) || 0,
      payment_method: booking.payment_method,
      payment_status: booking.payment_status,
    });

    if (booking.user_id?.email) {
      await retryOperation(() =>
        sendRescheduleConfirmation(bookingDetails, booking.user_id.email),
      );
    }

    res.json({ message: "Booking rescheduled" });
  } catch (err) {
    console.error("Error rescheduling booking:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Staff schedule (upcoming appointments today)
exports.getStaffSchedule = async (req, res) => {
  try {
    const staffId = req.userId;
    const today = getTodayString();
    const now = new Date();
    const currentTime =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");

    const bookings = await Booking.find({
      staff_id: staffId,
      date: today,
      status: { $nin: ["Cancelled", "Completed"] },
      time: { $gte: currentTime },
      user_id: { $ne: null, $exists: true },
    })
      .populate({
        path: "user_id",
        select: "phone_number role",
        match: { role: { $in: ["customer", "staff", "manager"] } },
      })
      .populate("service_id", "name duration")
      .sort({ time: 1 })
      .limit(4)
      .lean();

    const filtered = bookings.filter((b) => b.user_id !== null);

    const formattedResults = filtered.map((b) => ({
      id: b._id.toString(),
      customer_name: b.customer_name || "-",
      phone_number: b.user_id?.phone_number
        ? `011-${b.user_id.phone_number.slice(3).padEnd(7, "x")}`
        : "-",
      service_name: b.service_id?.name || "-",
      start_time: b.time ? b.time.slice(0, 5) : "-",
      end_time: calculateEndTime(
        b.time || "10:00",
        b.service_id?.duration || 30,
      ),
      status: b.status || "-",
      payment_method: b.payment_method || "-",
    }));

    res.json(
      formattedResults.length
        ? formattedResults
        : [
            {
              id: null,
              customer_name: "-",
              phone_number: "-",
              service_name: "-",
              start_time: "-",
              end_time: "-",
              status: "-",
              payment_method: "-",
            },
          ],
    );
  } catch (err) {
    console.error("[STAFF SCHEDULE] ERROR:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Mark booking as done
exports.markBookingDone = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  try {
    const booking = await Booking.findById(
      booking_id,
      "staff_id date time payment_method payment_status user_id",
    ).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.staff_id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });
    const bookingDateTime = new Date(`${booking.date}T${booking.time}Z`);
    if (bookingDateTime > new Date())
      return res
        .status(400)
        .json({ message: "Cannot mark future booking as done" });

    await Booking.findByIdAndUpdate(booking_id, {
      $set: { status: "Completed" },
    });

    const bookingDetail = await Booking.findById(booking_id)
      .populate("service_id", "name price")
      .lean();

    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking("complete", {
          id: booking_id,
          user_id: booking.user_id,
          staff_id: req.userId,
          service_name: bookingDetail?.service_id?.name || "",
          date: booking.date,
          customer_name: bookingDetail?.customer_name || "",
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    });

    const isPayAtOutlet = booking.payment_method === "Pay at Outlet";
    const isPendingPayment = booking.payment_status === "Pending";

    if (isPayAtOutlet && isPendingPayment) {
      return res.json({
        message: "Booking marked as done",
        showPaymentConfirmation: true,
        bookingId: booking_id,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
        customerName: bookingDetail?.customer_name || "Customer",
        serviceName: bookingDetail?.service_id?.name || "",
        totalAmount: bookingDetail?.service_id?.price
          ? parseFloat(bookingDetail.service_id.price).toFixed(2)
          : "0.00",
        isWalkIn: !booking.user_id,
      });
    }
    res.json({ message: "Booking marked as done" });
  } catch (err) {
    console.error("Error marking booking as done:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Mark booking as absent
exports.markBookingAbsent = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  try {
    const booking = await Booking.findById(
      booking_id,
      "staff_id date time user_id",
    ).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.staff_id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });
    const bookingDateTime = new Date(`${booking.date}T${booking.time}Z`);
    if (bookingDateTime > new Date())
      return res
        .status(400)
        .json({ message: "Cannot mark future booking as absent" });

    await Booking.findByIdAndUpdate(booking_id, { $set: { status: "Absent" } });

    const bookingDetail = await Booking.findById(booking_id)
      .populate("service_id", "name")
      .lean();

    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking("absent", {
          id: booking_id,
          user_id: booking.user_id,
          staff_id: req.userId,
          service_name: bookingDetail?.service_id?.name || "",
          date: booking.date,
          customer_name: bookingDetail?.customer_name || "",
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    });

    res.json({ message: "Booking marked as absent" });
  } catch (err) {
    console.error("Error marking booking as absent:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get total appointments from yesterday
exports.getTotalAppointmentsYesterday = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  try {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const yesterday =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");
    const count = await Booking.countDocuments({ date: yesterday });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching total appointments yesterday:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all appointments (manager)
exports.getAllAppointments = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  try {
    const bookings = await Booking.find({})
      .populate("service_id", "name duration")
      .populate("outlet_id", "shortform")
      .populate("user_id", "phone_number")
      .populate("staff_id", "username fullname")
      .sort({ date: -1, time: -1 })
      .lean();

    const results = bookings
      .filter((b) => b.service_id !== null)
      .map((b) => ({
        id: b._id.toString(),
        customer_name: b.customer_name,
        phone_number: b.user_id?.phone_number || b.customer_phone || null,
        service: b.service_id?.name || "",
        date: b.date,
        start_time: b.time,
        end_time: calculateEndTime(
          b.time || "10:00",
          b.service_id?.duration || 30,
        ),
        status: b.status,
        outlet: b.outlet_id?.shortform || "",
        username: b.staff_id?.username || "",
        staffName: b.staff_id?.fullname || "",
        service_duration: b.service_id?.duration || 30,
        service_id: b.service_id?._id.toString() || null,
        staff_id: b.staff_id?._id.toString() || null,
        outlet_id: b.outlet_id?._id.toString() || null,
        user_id: b.user_id?._id.toString() || null,
      }));
    res.json(results);
  } catch (err) {
    console.error("Error fetching all appointments:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get total appointments today
exports.getTotalAppointmentsToday = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  try {
    const today = getTodayString();
    const count = await Booking.countDocuments({ date: today });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching total appointments today:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get summary statistics for staff dashboard
exports.getStaffSummary = async (req, res) => {
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  try {
    const today = getTodayString();
    let matchStage = { date: today };
    if (req.role === "staff")
      matchStage.staff_id = new mongoose.Types.ObjectId(req.userId);

    const results = await Booking.aggregate([
      { $match: matchStage },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const summary = {
      done: 0,
      pending: 0,
      cancelled: 0,
      rescheduled: 0,
      absent: 0,
    };
    results.forEach((r) => {
      switch (r._id) {
        case "Completed":
        case "Done":
          summary.done += r.count;
          break;
        case "Pending":
        case "Confirmed":
          summary.pending += r.count;
          break;
        case "Cancelled":
          summary.cancelled += r.count;
          break;
        case "Rescheduled":
        case "Reschedule":
          summary.rescheduled += r.count;
          break;
        case "Absent":
          summary.absent += r.count;
          break;
      }
    });
    res.json(summary);
  } catch (err) {
    console.error("Error fetching summary statistics:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get today's appointments by all staff for bar chart
exports.getTodaysAppointmentsByStaff = async (req, res) => {
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  try {
    const today = moment().format("YYYY-MM-DD");
    let staffQuery = { role: { $in: ["staff", "manager"] }, isApproved: 1 };
    if (req.role === "staff") {
      const user = await User.findById(req.userId, "outlet_id").lean();
      if (!user) return res.status(404).json({ message: "User not found" });
      staffQuery.outlet_id = user.outlet_id;
    }
    const allStaff = await User.find(staffQuery, "username").lean();
    const staffIds = allStaff.map((s) => s._id);

    const bookings = await Booking.find(
      {
        date: today,
        status: { $nin: ["Cancelled"] },
        staff_id: { $in: staffIds },
      },
      "staff_id",
    ).lean();
    const countMap = {};
    bookings.forEach((b) => {
      const k = b.staff_id.toString();
      countMap[k] = (countMap[k] || 0) + 1;
    });

    const results = allStaff
      .filter((s) => (countMap[s._id.toString()] || 0) > 0)
      .map((s) => ({
        staff_name: s.username,
        appointment_count: countMap[s._id.toString()] || 0,
      }))
      .sort((a, b) => b.appointment_count - a.appointment_count);

    res.json({
      labels: results.map((r) => r.staff_name || "Unknown"),
      data: results.map((r) => r.appointment_count || 0),
    });
  } catch (err) {
    console.error("Error fetching today's appointments by staff:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get customer satisfaction ratings for manager dashboard
exports.getCustomerSatisfactionRatings = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  try {
    const ratingCounts = await Review.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const satisfactionData = [
      { rating: "1 ★", count: 0 },
      { rating: "2 ★", count: 0 },
      { rating: "3 ★", count: 0 },
      { rating: "4 ★", count: 0 },
      { rating: "5 ★", count: 0 },
    ];
    ratingCounts.forEach((r) => {
      const idx = r._id - 1;
      if (idx >= 0 && idx < 5) satisfactionData[idx].count = r.count;
    });
    res.json(satisfactionData);
  } catch (err) {
    console.error("Error fetching customer satisfaction ratings:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get booking history by phone number
exports.getBookingsByPhone = async (req, res) => {
  const { phoneNumber } = req.params;
  if (!phoneNumber)
    return res.status(400).json({ message: "Phone number is required" });
  try {
    const user = await User.findOne({ phone_number: phoneNumber }).lean();
    if (!user) return res.json([]);
    const bookings = await Booking.find({
      user_id: user._id,
      status: { $nin: ["Cancelled"] },
    })
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price duration")
      .populate("staff_id", "username")
      .sort({ date: -1, time: -1 })
      .limit(10)
      .lean();
    const results = bookings.map((b) => ({
      id: b._id.toString(),
      date: b.date,
      start_time: b.time,
      customer_name: b.customer_name,
      status: b.status,
      payment_status: b.payment_status,
      payment_method: toPaymentMethodLabel(b.payment_method),
      createdAt: b.createdAt,
      outlet_shortform: b.outlet_id?.shortform || "",
      service_name: b.service_id?.name || "",
      price: b.service_id?.price || 0,
      service_duration: b.service_id?.duration || 30,
      staff_name: b.staff_id?.username || "",
      phone_number: phoneNumber,
    }));
    res.json(results);
  } catch (err) {
    console.error("Error fetching bookings by phone:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get appointments by user ID
exports.getAppointmentsByUserId = async (req, res) => {
  const { userId } = req.params;
  const { limit = 10 } = req.query;
  if (!userId) return res.status(400).json({ message: "User ID is required" });
  try {
    const bookings = await Booking.find({
      user_id: userId,
      status: { $nin: ["Cancelled"] },
    })
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price duration")
      .populate("staff_id", "username")
      .sort({ date: -1, time: -1 })
      .limit(parseInt(limit))
      .lean();

    const appointments = bookings.map((b) => ({
      id: b._id.toString(),
      booking_date: b.date,
      start_time: b.time,
      customer_name: b.customer_name,
      status: b.status,
      payment_status: b.payment_status,
      payment_method: toPaymentMethodLabel(b.payment_method),
      createdAt: b.createdAt,
      outlet_shortform: b.outlet_id?.shortform || "",
      service_name: b.service_id?.name || "",
      price: b.service_id?.price || 0,
      service_duration: b.service_id?.duration || 30,
      staff_name: b.staff_id?.username || "",
    }));
    res.json({ appointments });
  } catch (err) {
    console.error("Error fetching appointments by user ID:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Public: fetch bookings for a date and outlet (for time slot filtering)
exports.getBookingsForDateOutlet = async (req, res) => {
  const { date, outlet_id } = req.query;
  if (!date || !outlet_id)
    return res.status(400).json({ message: "date and outlet_id are required" });
  try {
    const bookings = await Booking.find({
      date,
      outlet_id,
      status: { $ne: "Cancelled" },
    })
      .populate("service_id", "duration")
      .lean();
    res.json(
      bookings.map((b) => ({
        id: b._id.toString(),
        staff_id: b.staff_id.toString(),
        time: b.time,
        service_id: b.service_id?._id.toString() || b.service_id.toString(),
        service_duration: b.service_id?.duration || 30,
        customer_name: b.customer_name,
        status: b.status,
      })),
    );
  } catch (err) {
    console.error("Error fetching bookings for date/outlet:", {
      message: err.message,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Associate a user with a guest booking
exports.claimGuestBooking = async (req, res) => {
  const { booking_id } = req.params;
  const userId = req.userId;
  if (!booking_id || !userId) {
    return res
      .status(400)
      .json({ message: "Booking ID and User ID are required." });
  }
  try {
    const booking = await Booking.findOne({
      _id: booking_id,
      user_id: null,
    }).lean();
    if (!booking)
      return res
        .status(404)
        .json({ message: "Guest booking not found or already claimed." });
    await Booking.findByIdAndUpdate(booking_id, { $set: { user_id: userId } });
    res.json({ message: "Booking successfully claimed by user." });
  } catch (err) {
    console.error("Error claiming guest booking:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Manager reschedule appointment
exports.managerRescheduleAppointment = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { id } = req.params;
  const { date, time } = req.body;
  if (!id || !date || !time)
    return res
      .status(400)
      .json({ message: "Appointment ID, date, and time required" });
  try {
    const appointment = await Booking.findById(id)
      .populate("service_id", "name duration price")
      .populate("staff_id", "username")
      .populate("user_id", "email phone_number")
      .lean();
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    const slotStart = new Date(`${date}T${time}Z`);
    if (isOutsideOperatingHours(date, slotStart)) {
      return res.status(400).json({ message: OUTSIDE_OPERATING_HOURS_MESSAGE });
    }

    const duration = appointment.service_id?.duration || 30;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const staffId = appointment.staff_id?._id || appointment.staff_id;
    const availability = await validateStaffAvailability({
      staffId,
      date,
      slotStart,
      slotEnd,
      excludeBookingId: id,
    });
    if (availability.isBlockedByTime)
      return res
        .status(400)
        .json({ message: "Staff not available due to blocked time" });
    if (availability.hasConflict)
      return res.status(400).json({ message: "Slot already booked" });

    await Booking.findByIdAndUpdate(id, { $set: { date, time } });

    setImmediate(async () => {
      try {
        const rescheduleDetails = {
          id: appointment._id.toString(),
          outlet: "",
          service: appointment.service_id?.name || "",
          date: formatDateForDb(date),
          time,
          customer_name: appointment.customer_name,
          staff_name: appointment.staff_id?.username || "",
          price: 0,
        };
        const email = appointment.user_id?.email;
        const phone = appointment.user_id?.phone_number;
        if (email && email !== "customer@huuksystem.com") {
          await retryOperation(() =>
            sendRescheduleConfirmation(rescheduleDetails, email),
          );
        }
        if (phone) {
          await sendRescheduleConfirmationSMS(rescheduleDetails, phone);
        }
      } catch (e) {
        console.error("Error sending reschedule notifications:", e);
      }
    });

    res.json({
      message: "Appointment rescheduled successfully",
      newDate: date,
      newTime: time,
    });
  } catch (err) {
    console.error("Error rescheduling appointment:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Manager cancel appointment
exports.managerCancelAppointment = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "Appointment ID required" });
  try {
    const appointment = await Booking.findById(id)
      .populate("service_id", "name price")
      .populate("staff_id", "username")
      .populate("outlet_id", "shortform")
      .populate("user_id", "email phone_number")
      .lean();
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    await Booking.findByIdAndUpdate(id, { $set: { status: "Cancelled" } });

    setImmediate(async () => {
      try {
        const cancelDetails = buildBookingPaymentDetails({
          id: appointment._id.toString(),
          outlet: appointment.outlet_id?.shortform,
          service: appointment.service_id?.name,
          date: appointment.date,
          time: appointment.time,
          customer_name: appointment.customer_name,
          staff_name: appointment.staff_id?.username,
          price: parseFloat(appointment.service_id?.price) || 0,
          payment_method: appointment.payment_method,
          payment_status: appointment.payment_status,
        });
        const email = appointment.user_id?.email;
        const phone = appointment.user_id?.phone_number;
        if (email && email !== "customer@huuksystem.com") {
          await retryOperation(() =>
            sendCancelConfirmation(cancelDetails, email),
          );
        }
        if (phone) {
          await sendCancellationSMS(cancelDetails, phone);
        }
      } catch (e) {
        console.error("Error sending cancellation notifications:", e);
      }
    });

    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking("cancel", {
          id,
          user_id: appointment.user_id?._id || appointment.user_id,
          staff_id: appointment.staff_id?._id || appointment.staff_id,
          service_name: appointment.service_id?.name || "",
          date: appointment.date,
          customer_name: appointment.customer_name,
        });
      } catch (e) {
        console.error("Error sending booking cancellation notification:", e);
      }
    });

    res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error("Error cancelling appointment:", { message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
