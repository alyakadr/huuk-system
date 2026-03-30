"use strict";

const Booking = require("../models/Booking");
const Service = require("../models/Service");
const BlockedTime = require("../models/BlockedTime");
const BlockedSlot = require("../models/BlockedSlot");
const SlotReservation = require("../models/SlotReservation");
const { buildScheduleBlockingBookingMatch } = require("../utils/bookingQuery");

const toUtcDateTime = (date, time) => new Date(`${date}T${time}Z`);

const hasOverlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

const buildServiceDurationMap = async (bookings) => {
  const serviceIds = [
    ...new Set(bookings.map((booking) => booking.service_id.toString())),
  ];
  if (!serviceIds.length) {
    return {};
  }

  const services = await Service.find(
    { _id: { $in: serviceIds } },
    "duration",
  ).lean();
  const durationByServiceId = {};
  services.forEach((service) => {
    durationByServiceId[service._id.toString()] = service.duration || 30;
  });

  return durationByServiceId;
};

const hasBlockedTimeConflict = (blockedTimes, date, slotStart, slotEnd) => {
  return blockedTimes.some((blockedTime) => {
    const blockedStart = toUtcDateTime(date, blockedTime.start_time);
    const blockedEnd = toUtcDateTime(date, blockedTime.end_time);
    return hasOverlap(slotStart, slotEnd, blockedStart, blockedEnd);
  });
};

const hasBlockedSlotConflict = (blockedSlots, date, slotStart, slotEnd) => {
  return blockedSlots.some((blockedSlot) => {
    const blockedStart = toUtcDateTime(date, blockedSlot.time_slot);
    const blockedEnd = new Date(blockedStart.getTime() + 30 * 60 * 1000);
    return hasOverlap(slotStart, slotEnd, blockedStart, blockedEnd);
  });
};

const hasBookingConflict = (
  bookings,
  date,
  slotStart,
  slotEnd,
  durationByServiceId,
) => {
  return bookings.some((booking) => {
    const bookingStart = toUtcDateTime(date, booking.time);
    const bookingDuration =
      durationByServiceId[booking.service_id.toString()] || 30;
    const bookingEnd = new Date(
      bookingStart.getTime() + bookingDuration * 60 * 1000,
    );
    return hasOverlap(slotStart, slotEnd, bookingStart, bookingEnd);
  });
};

const getNextEvent = ({
  blockedTimes,
  blockedSlots,
  bookings,
  date,
  durationByServiceId,
  slotStart,
}) => {
  const events = [
    ...blockedTimes.map((blockedTime) => ({
      start: toUtcDateTime(date, blockedTime.start_time),
      end: toUtcDateTime(date, blockedTime.end_time),
    })),
    ...blockedSlots.map((blockedSlot) => {
      const start = toUtcDateTime(date, blockedSlot.time_slot);
      return {
        start,
        end: new Date(start.getTime() + 30 * 60 * 1000),
      };
    }),
    ...bookings.map((booking) => {
      const start = toUtcDateTime(date, booking.time);
      const duration = durationByServiceId[booking.service_id.toString()] || 30;
      return {
        start,
        end: new Date(start.getTime() + duration * 60 * 1000),
      };
    }),
  ];

  return (
    events
      .filter((event) => event.start > slotStart)
      .sort((a, b) => a.start - b.start)[0] || null
  );
};

const validateStaffAvailability = async ({
  staffId,
  date,
  slotStart,
  slotEnd,
  includeBlockedSlots = false,
  excludeBookingId,
  conflictMatch = buildScheduleBlockingBookingMatch(),
}) => {
  const now = new Date();

  const [blockedTimes, blockedSlots, reservations] = await Promise.all([
    BlockedTime.find({ staff_id: staffId, date }).lean(),
    includeBlockedSlots
      ? BlockedSlot.find({ staff_id: staffId, date, is_active: true }).lean()
      : Promise.resolve([]),
    SlotReservation.find(
      {
        staff_id: staffId,
        date,
        status: "reserved",
        expires_at: { $gt: now },
        ...(excludeBookingId ? { booking_id: { $ne: excludeBookingId } } : {}),
      },
      "time service_id",
    ).lean(),
  ]);

  const conflictQuery = {
    staff_id: staffId,
    date,
    ...conflictMatch,
  };

  if (excludeBookingId) {
    conflictQuery._id = { $ne: excludeBookingId };
  }

  const conflicts = await Booking.find(conflictQuery, "time service_id").lean();
  const occupiedSlots = [...conflicts, ...reservations];
  const durationByServiceId = await buildServiceDurationMap(occupiedSlots);

  const isBlockedByTime = hasBlockedTimeConflict(
    blockedTimes,
    date,
    slotStart,
    slotEnd,
  );
  const isBlockedBySlot = includeBlockedSlots
    ? hasBlockedSlotConflict(blockedSlots, date, slotStart, slotEnd)
    : false;
  const hasConflict = hasBookingConflict(
    occupiedSlots,
    date,
    slotStart,
    slotEnd,
    durationByServiceId,
  );

  return {
    isBlockedByTime,
    isBlockedBySlot,
    hasConflict,
    nextEvent: getNextEvent({
      blockedTimes,
      blockedSlots,
      bookings: occupiedSlots,
      date,
      durationByServiceId,
      slotStart,
    }),
  };
};

module.exports = {
  validateStaffAvailability,
};
