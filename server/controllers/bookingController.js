const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const {
  sendBookingReceipt,
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
  createAndSendNotification
} = require("../middlewares/notificationMiddleware");

// Helper function to format date as dd/mm/yyyy
const formatDateForDb = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Retry utility for email sending
const retryOperation = async (operation, retries = 3, delayBase = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err) {
      console.error(`Attempt ${i + 1} failed:`, {
        message: err.message,
        stack: err.stack,
      });
      if (i === retries - 1) throw err;
      const delay = delayBase * (i + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};


// List all outlets
exports.getOutlets = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT id, name, shortform FROM outlets ORDER BY shortform"
    );
    console.log("Fetched outlets:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching outlets:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// List all services
exports.getServices = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT id, name, duration, price FROM services ORDER BY name"
    );
    console.log("Fetched services:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching services:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};


// Get available 30-min slots
exports.getAvailableSlots = async (req, res) => {
  const { date, outlet_id, service_id, staff_id, currentBookingTime, currentBookingId } = req.query;
  console.log(`[AVAILABILITY CHECK] Incoming request params: date=${date}, outlet_id=${outlet_id}, service_id=${service_id}, staff_id=${staff_id}, currentBookingTime=${currentBookingTime}, currentBookingId=${currentBookingId}`);
  console.log(`[AVAILABILITY CHECK] Request user ID: ${req.userId}`);
  if (!date || !outlet_id || !service_id) {
    return res
      .status(400)
      .json({ message: "Date, outlet_id, and service_id required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [service] = await connection.query(
      "SELECT duration FROM services WHERE id = ?",
      [service_id]
    );
    if (!service.length) {
      console.error("Service not found for service_id:", service_id);
      return res.status(404).json({ message: "Service not found" });
    }
    const duration = service[0].duration || 30;

    const staffQuery = staff_id
      ? 'SELECT id FROM users WHERE role IN ("staff", "manager") AND outlet_id = ? AND isApproved = 1 AND id = ?'
      : 'SELECT id FROM users WHERE role IN ("staff", "manager") AND outlet_id = ? AND isApproved = 1';
    const staffParams = staff_id ? [outlet_id, staff_id] : [outlet_id];
    const [staff] = await connection.query(staffQuery, staffParams);
    if (!staff.length) {
      console.log("No staff available for outlet_id:", outlet_id);
      return res.json([]);
    }

    const [blockedTimes] = await connection.query(
      "SELECT staff_id, start_time, end_time FROM blocked_times WHERE date = ? AND staff_id IN (?)",
      [date, staff.map((s) => s.id)]
    );
    
    // Also check for blocked slots from staff dashboard
    const [blockedSlots] = await connection.query(
      "SELECT staff_id, time_slot FROM blocked_slots WHERE date = ? AND staff_id IN (?) AND is_active = 1",
      [date, staff.map((s) => s.id)]
    );
    
    console.log(`🔍 [BLOCKED SLOTS] Found ${blockedSlots.length} blocked slots for date ${date}:`, blockedSlots.map(bs => `Staff ${bs.staff_id}: ${bs.time_slot}`));
    // When editing a booking, exclude the current booking from conflicts
    // Consider all bookings except cancelled ones and the current booking being edited
    let bookingsQuery = "SELECT staff_id, time, service_id FROM bookings WHERE date = ? AND outlet_id = ? AND status != 'Cancelled'";
    let bookingsParams = [date, outlet_id];
    
    if (currentBookingId) {
      console.log(`📝 [EDIT MODE] Excluding current booking ID from conflicts: ${currentBookingId}`);
      bookingsQuery += " AND id != ?";
      bookingsParams.push(currentBookingId);
    } else if (currentBookingTime) {
      console.log(`📝 [EDIT MODE] Excluding current booking time from conflicts: ${currentBookingTime}`);
      bookingsQuery += " AND time != ?";
      bookingsParams.push(currentBookingTime);
    }
    
    const [bookings] = await connection.query(bookingsQuery, bookingsParams);

    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const [services] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    console.log(`🔍 [SLOT DEBUG] Checking availability for date: ${date}, outlet: ${outlet_id}, service: ${service_id}`);

    const serviceDurationMap = services.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );

    const slots = [];
    let current = new Date(`${date}T10:00:00Z`);
    const end = new Date(`${date}T22:00:00Z`); // Allow slots up to 21:30 (ending at 22:00)
    
    // Use Malaysia timezone (UTC+8) for all time calculations
    const malaysiaNow = moment.tz('Asia/Kuala_Lumpur');
    const malaysiaTodayDate = malaysiaNow.format('YYYY-MM-DD');
    const isToday = date === malaysiaTodayDate;
    
    console.log(`🕐 [TIME DEBUG] Malaysia current time: ${malaysiaNow.format('YYYY-MM-DD HH:mm:ss')}, checking date: ${date}, isToday: ${isToday}`);
    
    // If it's today in Malaysia timezone, apply current day restrictions
    if (isToday) {
      const currentMalaysiaTime = malaysiaNow.format('HH:mm');
      
      // If current Malaysia time is after 9:00 PM (21:00), show CLOSED
      if (malaysiaNow.hour() >= 21) {
        console.log(`🔒 [CURRENT DAY] Shop is closed - current Malaysia time (${currentMalaysiaTime}) is after 9:00 PM`);
        return res.json(['CLOSED']);
      }
      
      // Calculate 30 minutes from current Malaysia time
      const timeAfter30Min = malaysiaNow.clone().add(30, 'minutes');
      
      // Round up to the next 30-minute boundary
      const minutes = timeAfter30Min.minute();
      let roundedMinutes;
      if (minutes <= 30) {
        roundedMinutes = 30;
      } else {
        roundedMinutes = 0; // Next hour, 0 minutes
        timeAfter30Min.add(1, 'hour');
      }
      timeAfter30Min.minute(roundedMinutes).second(0).millisecond(0);
      
      // Create the next available slot time
      const nextSlotTime = timeAfter30Min.format('HH:mm');
      
    // Convert to UTC for slot generation
    const minStartTime = new Date(`${date}T10:00:00Z`);
    const nextAvailableSlot = new Date(`${date}T${nextSlotTime}:00Z`);
    
    // Use the later of minimum start time (10:00) or calculated slot time
    current = nextAvailableSlot > minStartTime ? nextAvailableSlot : minStartTime;
      
      console.log(`🕐 [CURRENT DAY] Malaysia time: ${currentMalaysiaTime}, 30min buffer: ${timeAfter30Min.format('HH:mm')}, next slot: ${current.toISOString().slice(11, 16)}`);
    }
    
    while (current < end) {
      const timeStr = current.toISOString().slice(11, 16);
      const slotEnd = new Date(current.getTime() + duration * 60 * 1000);
      if (current >= end) {
        break;
      }
      if (isToday) {
        const malaysiaCurrentTime = moment.tz('Asia/Kuala_Lumpur');
        const minAllowedMalaysiaTime = malaysiaCurrentTime.clone().add(30, 'minutes');
        const currentSlotMalaysiaTime = moment.tz(`${date} ${timeStr}`, 'YYYY-MM-DD HH:mm', 'Asia/Kuala_Lumpur');
        if (currentSlotMalaysiaTime.isBefore(minAllowedMalaysiaTime)) {
          current.setMinutes(current.getMinutes() + 30);
          continue;
        }
      }
      let isAvailable = false;
      let debugReasons = [];
      for (const s of staff) {
        let staffIsAvailableForEntireSlot = true;
        let staffDebug = { staffId: s.id, slot: timeStr, reasons: [] };
        const requiredSlots = [];
        for (let slotTime = new Date(current); slotTime < slotEnd; slotTime.setMinutes(slotTime.getMinutes() + 30)) {
          requiredSlots.push(new Date(slotTime));
        }
        for (const requiredSlot of requiredSlots) {
          const requiredSlotEnd = new Date(requiredSlot.getTime() + 30 * 60 * 1000);
          // Blocked times
          const isBlocked = blockedTimes
            .filter((bt) => bt.staff_id === s.id)
            .some((bt) => {
              const blockStart = new Date(`${date}T${bt.start_time}Z`);
              const blockEnd = new Date(`${date}T${bt.end_time}Z`);
              return requiredSlot < blockEnd && requiredSlotEnd > blockStart;
            });
          if (isBlocked) {
            staffIsAvailableForEntireSlot = false;
            staffDebug.reasons.push({ type: 'blockedTime', slot: requiredSlot.toISOString().slice(11,16) });
            break;
          }
          // Blocked slots
          const isSlotBlocked = blockedSlots
            .filter((bs) => bs.staff_id === s.id)
            .some((bs) => {
              const slotTime = bs.time_slot;
              const blockStart = new Date(`${date}T${slotTime}Z`);
              const blockEnd = new Date(blockStart.getTime() + 30 * 60 * 1000);
              return requiredSlot < blockEnd && requiredSlotEnd > blockStart;
            });
          if (isSlotBlocked) {
            staffIsAvailableForEntireSlot = false;
            staffDebug.reasons.push({ type: 'blockedSlot', slot: requiredSlot.toISOString().slice(11,16) });
            break;
          }
          // Booking conflicts
          const hasConflict = bookings
            .filter((b) => b.staff_id === s.id)
            .some((b) => {
              const bookingStart = new Date(`${date}T${b.time}Z`);
              const bookingEnd = new Date(
                bookingStart.getTime() +
                  (serviceDurationMap[b.service_id] || 30) * 60 * 1000
              );
              return requiredSlot < bookingEnd && requiredSlotEnd > bookingStart;
            });
          if (hasConflict) {
            staffIsAvailableForEntireSlot = false;
            staffDebug.reasons.push({ type: 'bookingConflict', slot: requiredSlot.toISOString().slice(11,16) });
            break;
          }
        }
        if (staffIsAvailableForEntireSlot) {
          const nextEvent = [
            ...blockedTimes.filter((bt) => bt.staff_id === s.id),
            ...bookings.filter((b) => b.staff_id === s.id),
            ...blockedSlots.filter((bs) => bs.staff_id === s.id).map((bs) => ({
              start_time: bs.time_slot,
              end_time: null,
              service_id: null
            }))
          ]
            .map((e) => {
              const start = new Date(`${date}T${e.start_time || e.time}Z`);
              return {
                start,
                end: e.end_time
                  ? new Date(`${date}T${e.end_time}Z`)
                  : new Date(
                      start.getTime() +
                        (serviceDurationMap[e.service_id] || 30) * 60 * 1000
                    ),
              };
            })
            .filter((e) => e.start > current)
            .sort((a, b) => a.start - b.start)[0];
          if (!nextEvent || nextEvent.start >= slotEnd) {
            isAvailable = true;
            staffDebug.reasons.push({ type: 'available' });
            break;
          } else {
            staffDebug.reasons.push({ type: 'nextEventConflict', nextEvent: nextEvent.start.toISOString().slice(11,16) });
          }
        }
        debugReasons.push(staffDebug);
      }
      if (!isAvailable) {
        console.log(`[SLOT DEBUG] Slot ${timeStr} rejected. Details:`, JSON.stringify(debugReasons, null, 2));
      }
      if (isAvailable && !slots.includes(timeStr)) {
        slots.push(timeStr);
      }
      current.setMinutes(current.getMinutes() + 30);
    }
    console.log(
      `Fetched available slots for date: ${date}, outlet_id: ${outlet_id}, service_id: ${
        service_id || "any"
      }:`,
      slots
    );
    
    // Additional debugging for slot availability checking
    const sortedSlots = slots.sort();
    console.log(`[AVAILABILITY CHECK] Returning ${sortedSlots.length} slots for date ${date}:`, sortedSlots);
    if (currentBookingTime) {
      console.log(`[AVAILABILITY CHECK] Current booking time was: ${currentBookingTime}`);
      console.log(`[AVAILABILITY CHECK] Current booking time is included in slots: ${sortedSlots.includes(currentBookingTime)}`);
    }
    
    res.json(sortedSlots);
  } catch (err) {
    console.error("Error fetching slots:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get available staff
exports.getAvailableStaff = async (req, res) => {
  const { outlet_id, date, time, service_id } = req.query;
  if (!outlet_id || !date) {
    return res.status(400).json({ message: "outlet_id and date required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    let duration = 30;
    if (service_id) {
      const [service] = await connection.query(
        "SELECT duration FROM services WHERE id = ?",
        [service_id]
      );
      if (!service.length)
        return res.status(404).json({ message: "Service not found" });
      duration = service[0].duration;
    }

    const [staff] = await connection.query(
      'SELECT id, username FROM users WHERE role IN ("staff", "manager") AND outlet_id = ? AND isApproved = 1',
      [outlet_id]
    );
    if (!staff.length) return res.json([]);

    const [blockedTimes] = await connection.query(
      "SELECT staff_id, start_time, end_time FROM blocked_times WHERE date = ? AND staff_id IN (?)",
      [date, staff.map((s) => s.id)]
    );
    const [bookings] = await connection.query(
      "SELECT staff_id, time, service_id FROM bookings WHERE date = ? AND outlet_id = ? AND status != 'Cancelled'",
      [date, outlet_id]
    );

    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const [services] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    const serviceDurationMap = services.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );

    let availableStaff = staff;
    if (time && service_id) {
      // Ensure all Date parsing is local (no 'Z')
      const slotStart = new Date(`${date}T${time}`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
      availableStaff = staff.filter((s) => {
        const isBlocked = blockedTimes
          .filter((bt) => bt.staff_id === s.id)
          .some((bt) => {
            const blockStart = new Date(`${date}T${bt.start_time}`);
            const blockEnd = new Date(`${date}T${bt.end_time}`);
            return slotStart < blockEnd && slotEnd > blockStart;
          });
        if (isBlocked) return false;
        const hasConflict = bookings
          .filter((b) => b.staff_id === s.id)
          .some((b) => {
            const bookingStart = new Date(`${date}T${b.time}`);
            const bookingEnd = new Date(
              bookingStart.getTime() +
                (serviceDurationMap[b.service_id] || 30) * 60 * 1000
            );
            // Debug: print local time strings, not UTC
            console.log(' [UPDATE BOOKING] Conflict check: {',
              'conflictId:', b.id,
              'conflictTime:', b.time,
              'bookingStart:', bookingStart.toLocaleString(),
              'bookingEnd:', bookingEnd.toLocaleString(),
              'slotStart:', slotStart.toLocaleString(),
              'slotEnd:', slotEnd.toLocaleString(),
              'hasConflict:', slotStart < bookingEnd && slotEnd > bookingStart,
              '}');
            return slotStart < bookingEnd && slotEnd > bookingStart;
          });
        if (hasConflict) return false;
        const nextEvent = [
          ...blockedTimes.filter((bt) => bt.staff_id === s.id),
          ...bookings.filter((b) => b.staff_id === s.id),
        ]
          .map((e) => {
            const start = new Date(`${date}T${e.start_time || e.time}`);
            return {
              start,
              end: e.end_time
                ? new Date(`${date}T${e.end_time}`)
                : new Date(
                    start.getTime() +
                      (serviceDurationMap[e.service_id] || 30) * 60 * 1000
                  ),
            };
          })
          .filter((e) => e.start > slotStart)
          .sort((a, b) => a.start - b.start)[0];
        return !nextEvent || nextEvent.start >= slotEnd;
      });
    }
    console.log(
      `Fetched available staff for outlet_id: ${outlet_id}, date: ${date}, time: ${
        time || "any"
      }, service_id: ${service_id || "any"}:`,
      availableStaff.length
    );
    res.json(availableStaff);
  } catch (err) {
    console.error("Error fetching staff:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get staff with fewest bookings for a time
exports.getStaffByTime = async (req, res) => {
  const { outlet_id, date, time, service_id } = req.query;
  if (!outlet_id || !date || !time || !service_id) {
    return res
      .status(400)
      .json({ message: "outlet_id, date, time, and service_id required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [service] = await connection.query(
      "SELECT duration FROM services WHERE id = ?",
      [service_id]
    );
    if (!service.length)
      return res.status(404).json({ message: "Service not found" });
    const duration = service[0].duration;

    const [staff] = await connection.query(
      'SELECT id, fullname FROM users WHERE role IN ("staff", "manager") AND outlet_id = ? AND isApproved = 1',
      [outlet_id]
    );
    if (!staff.length) return res.json([]);

    const [blockedTimes] = await connection.query(
      "SELECT staff_id, start_time, end_time FROM blocked_times WHERE date = ? AND staff_id IN (?)",
      [date, staff.map((s) => s.id)]
    );
    const [bookings] = await connection.query(
      "SELECT staff_id, time, service_id FROM bookings WHERE date = ? AND outlet_id = ? AND status != 'Cancelled'",
      [date, outlet_id]
    );

    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const [services] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    const serviceDurationMap = services.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );

    const slotStart = new Date(`${date}T${time}Z`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    const availableStaff = staff.filter((s) => {
      const isBlocked = blockedTimes
        .filter((bt) => bt.staff_id === s.id)
        .some((bt) => {
          const blockStart = new Date(`${date}T${bt.start_time}Z`);
          const blockEnd = new Date(`${date}T${bt.end_time}Z`);
          return slotStart < blockEnd && slotEnd > blockStart;
        });
      if (isBlocked) return false;
      const hasConflict = bookings
        .filter((b) => b.staff_id === s.id)
        .some((b) => {
          const bookingStart = new Date(`${date}T${b.time}Z`);
          const bookingEnd = new Date(
            bookingStart.getTime() +
              (serviceDurationMap[b.service_id] || 30) * 60 * 1000
          );
          return slotStart < bookingEnd && slotEnd > bookingStart;
        });
      if (hasConflict) return false;
      const nextEvent = [
        ...blockedTimes.filter((bt) => bt.staff_id === s.id),
        ...bookings.filter((b) => b.staff_id === s.id),
      ]
        .map((e) => {
          const start = new Date(`${date}T${e.start_time || e.time}Z`);
          return {
            start,
            end: e.end_time
              ? new Date(`${date}T${e.end_time}Z`)
              : new Date(
                  start.getTime() +
                    (serviceDurationMap[e.service_id] || 30) * 60 * 1000
                ),
          };
        })
        .filter((e) => e.start > slotStart)
        .sort((a, b) => a.start - b.start)[0];
      return !nextEvent || nextEvent.start >= slotEnd;
    });

    if (!availableStaff.length) return res.json([]);

    const [bookingCounts] = await connection.query(
      "SELECT staff_id, COUNT(*) as booking_count FROM bookings WHERE date = ? AND staff_id IN (?) AND status != 'Cancelled' GROUP BY staff_id",
      [date, availableStaff.map((s) => s.id)]
    );

    const staffWithCounts = availableStaff.map((s) => ({
      ...s,
      booking_count:
        bookingCounts.find((bc) => bc.staff_id === s.id)?.booking_count || 0,
    }));

    const minBookings = Math.min(
      ...staffWithCounts.map((s) => s.booking_count)
    );
    const leastBusyStaff = staffWithCounts.filter(
      (s) => s.booking_count === minBookings
    );
    const selectedStaff =
      leastBusyStaff[Math.floor(Math.random() * leastBusyStaff.length)];
    console.log(
      `Selected least busy staff for time ${time}, service_id ${service_id}:`,
      selectedStaff?.id
    );
    res.json([selectedStaff]);
  } catch (err) {
    console.error("Error fetching staff by time:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.getStaffBookings = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Start and end dates required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `SELECT b.id, b.date, b.time AS start_time, s.duration, b.customer_name, s.name AS service_name, b.status
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.staff_id = ? AND b.date BETWEEN ? AND ? AND b.status NOT IN ('Cancelled')
       ORDER BY b.date, b.time`,
      [req.userId, startDate, endDate]
    );
    res.json(results);
  } catch (err) {
    console.error("Error fetching staff bookings:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// List user bookings
exports.getUserBookings = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Add a small delay to prevent race conditions with recently created bookings
    await new Promise(resolve => setTimeout(resolve, 50));

    const sql = `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, s.price, s.duration AS service_duration, u.username AS staff_name,
              r.rating, r.comment, r.created_at AS review_created_at
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       LEFT JOIN reviews r ON b.id = r.booking_id
       WHERE b.user_id = ?
       ORDER BY b.date DESC, b.time DESC`;
    const params = [req.userId];
    console.log("[DEBUG][getUserBookings] SQL Query:", sql);
    console.log("[DEBUG][getUserBookings] Query Params:", params);
    
    const [results] = await connection.query(sql, params);
    console.log("[DEBUG][getUserBookings] Raw DB Results:", results);
    
    // Transform payment_method and review data for response
    const transformedResults = results.map((booking) => ({
      ...booking,
      payment_method:
        booking.payment_method === "Stripe"
          ? "Online Payment"
          : booking.payment_method,
      review: booking.rating
        ? {
            rating: booking.rating,
            comment: booking.comment || null,
            created_at: booking.review_created_at,
          }
        : null,
    }));
    
    console.log(
      "✅ [GET USER BOOKINGS] Fetched bookings for user:",
      req.userId,
      "Total:",
      transformedResults.length,
      "IDs:",
      transformedResults.map(b => b.id)
    );
    
    res.json(transformedResults);
  } catch (err) {
    console.error("❌ [GET USER BOOKINGS] Error fetching bookings:", {
      message: err.message,
      stack: err.stack,
      userId: req.userId
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Save a booking
exports.createBooking = async (req, res) => {
  console.log('🚀 [CREATE BOOKING] Function called');
  console.log('📋 [CREATE BOOKING] Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('👤 [CREATE BOOKING] User ID from token:', req.userId);
  console.log('🔑 [CREATE BOOKING] User role from token:', req.userRole);
  console.log('📝 [CREATE BOOKING] Content-Type:', req.get('Content-Type'));
  
  const { outlet_id, service_id, staff_id, date, time, customer_name } =
    req.body;
    
  console.log('🔍 [CREATE BOOKING] Extracted fields:', {
    outlet_id: outlet_id,
    service_id: service_id,
    staff_id: staff_id,
    date: date,
    time: time,
    customer_name: customer_name
  });
  
  // Individual field validation with detailed logging
  const missingFields = [];
  if (!outlet_id) missingFields.push('outlet_id');
  if (!service_id) missingFields.push('service_id');
  if (!staff_id) missingFields.push('staff_id');
  if (!date) missingFields.push('date');
  if (!time) missingFields.push('time');
  if (!customer_name) missingFields.push('customer_name');
  
  if (missingFields.length > 0) {
    console.log('❌ [CREATE BOOKING] Missing required fields:', missingFields);
    return res.status(400).json({ message: "All fields required", missingFields });
  }
  if (customer_name.length > 10) {
    return res
      .status(400)
      .json({ message: "Client name must be 10 characters or less" });
  }
  let connection;
  let finalUserId = req.userId;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // If no user_id or user does not exist, create a new customer user
    if (!finalUserId) {
      let phone_number = req.body.phone_number || null;
      let customer_name = req.body.customer_name || 'Walk-in Customer';
      // Try to find existing customer by phone number
      if (phone_number) {
        const [existingUser] = await connection.query(
          'SELECT id FROM users WHERE phone_number = ? AND role = "customer"',
          [phone_number]
        );
        if (existingUser.length > 0) {
          finalUserId = existingUser[0].id;
        } else {
          // Create new customer user
          const bcrypt = require('bcryptjs');
          const defaultPassword = await bcrypt.hash('defaultpassword123', 10);
          const uniqueEmail = `customer_${phone_number}_${Date.now()}@huuksystem.com`;
          const [newUser] = await connection.query(
            `INSERT INTO users (phone_number, password, email, fullname, username, role, outlet)
             VALUES (?, ?, ?, ?, ?, 'customer', 'N/A')`,
            [phone_number, defaultPassword, uniqueEmail, customer_name.trim(), customer_name.trim()]
          );
          finalUserId = newUser.insertId;
        }
      } else {
        // Create minimal customer user
        const bcrypt = require('bcrypt');
        const defaultPassword = await bcrypt.hash('defaultpassword123', 10);
        const uniqueEmail = `customer_${customer_name.trim().replace(/\s+/g, '_').toLowerCase()}_${Date.now()}@huuksystem.com`;
        const [newUser] = await connection.query(
          `INSERT INTO users (phone_number, password, email, fullname, username, role, outlet)
           VALUES (?, ?, ?, ?, ?, 'customer', 'N/A')`,
          [null, defaultPassword, uniqueEmail, customer_name.trim(), customer_name.trim()]
        );
        finalUserId = newUser.insertId;
      }
    }
    
    const slotStart = new Date(`${date}T${time}Z`);
    const operatingStart = new Date(`${date}T10:00:00Z`);
    const operatingEnd = new Date(`${date}T21:00:00Z`);
    if (slotStart < operatingStart || slotStart > operatingEnd) {
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }
    const [service] = await connection.query(
      "SELECT duration FROM services WHERE id = ?",
      [service_id]
    );
    if (!service.length)
      return res.status(404).json({ message: "Service not found" });
    const duration = service[0].duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    const [blockedTimes] = await connection.query(
      "SELECT start_time, end_time FROM blocked_times WHERE staff_id = ? AND date = ?",
      [staff_id, date]
    );
    const isBlocked = blockedTimes.some((bt) => {
      const blockStart = new Date(`${date}T${bt.start_time}Z`);
      const blockEnd = new Date(`${date}T${bt.end_time}Z`);
      return slotStart < blockEnd && slotEnd > blockStart;
    });
    if (isBlocked) {
      return res.status(400).json({
        message: "Staff or manager not available due to blocked time",
      });
    }
    
    // Also check for blocked slots from staff dashboard
    const [blockedSlots] = await connection.query(
      "SELECT time_slot FROM blocked_slots WHERE staff_id = ? AND date = ? AND is_active = 1",
      [staff_id, date]
    );
    const isSlotBlocked = blockedSlots.some((bs) => {
      const slotTime = bs.time_slot;
      const blockStart = new Date(`${date}T${slotTime}Z`);
      const blockEnd = new Date(blockStart.getTime() + 30 * 60 * 1000); // 30 minutes
      return slotStart < blockEnd && slotEnd > blockStart;
    });
    if (isSlotBlocked) {
      return res.status(400).json({
        message: "Staff or manager not available due to blocked slot",
      });
    }
    const [conflicts] = await connection.query(
      "SELECT id, time, service_id FROM bookings WHERE staff_id = ? AND date = ? AND status != 'Cancelled' AND (payment_status = 'Paid' OR payment_method = 'Pay at Outlet')",
      [staff_id, date]
    );
    
    console.log(`🔍 Checking conflicts for booking:`, {
      staff_id,
      date,
      time,
      service_id,
      requestedSlot: { start: slotStart, end: slotEnd },
      existingConflicts: conflicts.map(c => ({ id: c.id, time: c.time, service_id: c.service_id }))
    });
    
    const serviceIds = [...new Set(conflicts.map((c) => c.service_id))];
    const [conflictServices] = await connection.query(
      "SELECT id, duration from services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    const serviceDurationMap = conflictServices.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );
    
    console.log(`📊 Service duration map:`, serviceDurationMap);
    
    const hasConflict = conflicts.some((c) => {
      const bookingStart = new Date(`${date}T${c.time}Z`);
      const bookingEnd = new Date(
        bookingStart.getTime() +
          (serviceDurationMap[c.service_id] || 30) * 60 * 1000
      );
      const overlaps = slotStart < bookingEnd && slotEnd > bookingStart;
      
      console.log(`⚖️ Overlap check for booking ${c.id}:`, {
        existingBooking: { start: bookingStart, end: bookingEnd, duration: serviceDurationMap[c.service_id] || 30 },
        requestedSlot: { start: slotStart, end: slotEnd },
        overlaps
      });
      
      return overlaps;
    });
    
    if (hasConflict) {
      console.log(`❌ Booking rejected due to conflict`);
      return res.status(400).json({ message: "Slot already booked" });
    }
    
    console.log(`✅ No conflicts detected, proceeding with booking creation`);
    
    const nextEvent = [
      ...blockedTimes,
      ...conflicts.map((c) => ({
        start_time: c.time,
        end_time: new Date(`${date}T${c.time}Z`).toTimeString().slice(0, 5),
        service_id: c.service_id,
      })),
    ]
      .map((e) => {
        const start = new Date(`${date}T${e.start_time}Z`);
        return {
          start,
          end: e.end_time
            ? new Date(`${date}T${e.end_time}Z`)
            : new Date(
                start.getTime() +
                  (serviceDurationMap[e.service_id] || 30) * 60 * 1000
              ),
        };
      })
      .filter((e) => e.start > slotStart)
      .sort((a, b) => a.start - b.start)[0];
    if (nextEvent && nextEvent.start < slotEnd) {
      return res
        .status(400)
        .json({ message: "Insufficient time for service duration" });
    }
    const [result] = await connection.query(
      `INSERT INTO bookings (user_id, outlet_id, service_id, staff_id, date, time, customer_name, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', 'Pending')`,
      [finalUserId, outlet_id, service_id, staff_id, date, time, customer_name]
    );
    
    // Get booking details for SMS
    const [bookingData] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, 
              s.price, u.username AS staff_name, u2.phone_number
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       JOIN users u2 ON b.user_id = u2.id
       WHERE b.id = ?`,
      [result.insertId]
    );
    
    await connection.commit();
    console.log("Booking created:", result.insertId);
    
    // Wait a brief moment to ensure the transaction is fully committed across all connections
    // This prevents race conditions where the client immediately tries to fetch the booking
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the complete booking details for the response
    const [completeBookingData] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, 
              s.price, u.username AS staff_name, u2.phone_number
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       JOIN users u2 ON b.user_id = u2.id
       WHERE b.id = ?`,
      [result.insertId]
    );
    
    // Send notification after booking creation
    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking('create', {
          id: result.insertId,
          user_id: finalUserId,
          staff_id: staff_id,
          service_name: bookingData[0].service_name,
          date: date,
          customer_name: customer_name
        });
      } catch (notificationError) {
        console.error('Error sending booking creation notification:', notificationError);
      }
    });
    
    // Send SMS confirmation if phone number exists (non-blocking)
    if (bookingData.length > 0 && bookingData[0].phone_number) {
      // Run SMS sending in background without blocking booking creation
      setImmediate(async () => {
        try {
          const bookingDetails = {
            id: result.insertId,
            outlet: bookingData[0].outlet_shortform,
            service: bookingData[0].service_name,
            date: formatDateForDb(date),
            time: time,
            staff_name: bookingData[0].staff_name,
            price: parseFloat(bookingData[0].price) || 0,
          };
          
          console.log(`📱 Attempting to send SMS confirmation to ${bookingData[0].phone_number}`);
          const smsResult = await sendBookingConfirmation(bookingDetails, bookingData[0].phone_number);
          
          if (smsResult.success) {
            console.log(`✅ SMS confirmation sent successfully for booking #${result.insertId}`);
          } else {
            console.warn(`⚠️ SMS failed for booking #${result.insertId}: ${smsResult.message || smsResult.error}`);
          }
        } catch (smsError) {
          console.error(`❌ SMS sending failed for booking #${result.insertId}:`, smsError.message);
          // Log but don't crash - booking is still created successfully
        }
      });
    }
    
    // Send email confirmation if user has email (non-blocking)
    const [userData] = await connection.query(
      "SELECT email FROM users WHERE id = ?",
      [finalUserId]
    );
    
    if (userData.length > 0 && userData[0].email && userData[0].email !== "customer@huuksystem.com") {
      // Run email sending in background without blocking booking creation
      setImmediate(async () => {
        try {
          const bookingDetails = {
            id: result.insertId,
            outlet: bookingData[0].outlet_shortform,
            service: bookingData[0].service_name,
            date: formatDateForDb(date),
            time: time,
            customer_name: customer_name,
            staff_name: bookingData[0].staff_name,
            price: parseFloat(bookingData[0].price) || 0,
            payment_method: "Pending",
            payment_status: "Pending",
          };
          
          console.log(`📧 Attempting to send email confirmation to ${userData[0].email}`);
          await retryOperation(() => sendBookingReceipt(bookingDetails, userData[0].email));
          console.log(`✅ Email confirmation sent successfully for booking #${result.insertId}`);
        } catch (emailError) {
          console.error(`❌ Email sending failed for booking #${result.insertId}:`, emailError.message);
          // Log but don't crash - booking is still created successfully
        }
      });
    }
    
    // Return the complete booking object that the frontend expects
    const bookingResponse = {
      id: result.insertId,
      customer_name: customer_name,
      outlet_name: completeBookingData[0]?.outlet_shortform || "N/A",
      staff_name: completeBookingData[0]?.staff_name || "N/A",
      service_name: completeBookingData[0]?.service_name || "N/A",
      date: date,
      time: time,
      price: parseFloat(completeBookingData[0]?.price) || 0,
      payment_method: "Stripe",
      payment_status: "Pending",
    };
    
    res.json({ 
      message: "Draft booking created", 
      booking: bookingResponse,
      bookingId: result.insertId,
      isDraft: true
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error saving booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Finalize a draft booking after payment
exports.finalizeBooking = async (req, res) => {
  const { bookingId } = req.params;
  
  if (!bookingId) {
    return res.status(400).json({ message: "Booking ID required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // First check if the booking exists at all
    const [bookingCheck] = await connection.query(
      "SELECT * FROM bookings WHERE id = ?",
      [bookingId]
    );
    
    if (!bookingCheck.length) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    // Check if user has permission to finalize this booking
    const isUserBooking = bookingCheck[0].user_id == req.userId;
    const isStaffUser = ["staff", "manager", "admin"].includes(req.role);
    
    if (!isUserBooking && !isStaffUser) {
      return res.status(403).json({ message: "Not authorized to finalize this booking" });
    }
    
    // Check if booking is already finalized (not in Draft status)
    if (bookingCheck[0].status !== 'Draft') {
      console.log(`Booking ${bookingId} is already finalized with status: ${bookingCheck[0].status}`);
      return res.json({ 
        message: "Booking is already finalized", 
        bookingId: bookingId,
        status: bookingCheck[0].status
      });
    }
    
    // Update the booking to finalize it
    await connection.query(
      "UPDATE bookings SET status = 'Pending' WHERE id = ?",
      [bookingId]
    );
    
    await connection.commit();
    console.log("Draft booking finalized:", bookingId);
    
    res.json({ 
      message: "Booking finalized successfully", 
      bookingId: bookingId 
    });
    
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error finalizing booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Create a staff appointment with enhanced user linking
exports.createStaffAppointment = async (req, res) => {
  console.log('\n=== CREATE STAFF APPOINTMENT FUNCTION CALLED ===');
  console.log('[CREATE STAFF APPOINTMENT] Timestamp:', new Date().toISOString());
  console.log('[CREATE STAFF APPOINTMENT] Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('[CREATE STAFF APPOINTMENT] User ID from token:', req.userId);
  console.log('[CREATE STAFF APPOINTMENT] User role from token:', req.role);
  
  const { service_id, staff_id, date, time, customer_name, phone_number, user_id } = req.body;
  
  console.log('[CREATE STAFF APPOINTMENT] Extracted fields:', {
    service_id,
    staff_id,
    date,
    time,
    customer_name,
    phone_number: phone_number ? '[PROVIDED]' : '[NOT PROVIDED]',
    user_id: user_id || '[NOT PROVIDED]'
  });
  
  // Enhanced field validation
  const errors = [];
  if (!service_id || isNaN(parseInt(service_id))) errors.push('Valid service_id is required');
  if (!staff_id || isNaN(parseInt(staff_id))) errors.push('Valid staff_id is required');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Valid date (YYYY-MM-DD) is required');
  if (!time || !/^\d{2}:\d{2}$/.test(time)) errors.push('Valid time (HH:MM) is required');
  if (!customer_name || customer_name.trim().length === 0) errors.push('Customer name is required');
  if (customer_name && customer_name.trim().length > 100) errors.push('Customer name must be 100 characters or less');
  
  if (errors.length > 0) {
    console.log('[CREATE STAFF APPOINTMENT] Validation errors:', errors);
    return res.status(400).json({ 
      message: "Validation failed", 
      errors: errors
    });
  }

  let connection;
  let finalUserId = user_id;
  
  try {
    console.log('[DEBUG] Getting database connection...');
    connection = await pool.getConnection();
    console.log('[DEBUG] Database connection established');
    
    console.log('[DEBUG] Beginning transaction...');
    await connection.beginTransaction();
    console.log('[DEBUG] Transaction started');
    
    // Handle user creation/lookup for staff appointments
    if (!finalUserId && phone_number) {
      console.log('[DEBUG] No user_id provided, checking if user exists with phone:', phone_number);
      
      // First try to find existing user by phone number
      const [existingUser] = await connection.query(
        'SELECT id FROM users WHERE phone_number = ? AND role = "customer"',
        [phone_number]
      );
      
      if (existingUser.length > 0) {
        finalUserId = existingUser[0].id;
        console.log('[DEBUG] Found existing user with phone:', phone_number, 'User ID:', finalUserId);
      } else {
        // Create a new customer user
        console.log('[DEBUG] Creating new customer user with phone:', phone_number);
        const bcrypt = require('bcrypt');
        const defaultPassword = await bcrypt.hash('defaultpassword123', 10);
        // Generate unique email address based on phone number and timestamp
        const uniqueEmail = `customer_${phone_number}_${Date.now()}@huuksystem.com`;
        const [newUser] = await connection.query(
          `INSERT INTO users (phone_number, password, email, fullname, username, role, outlet, isApproved)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [phone_number, defaultPassword, uniqueEmail, customer_name.trim(), customer_name.trim(), 'customer', 'N/A', 1]
        );
        finalUserId = newUser.insertId;
        console.log('[DEBUG] Created new user with ID:', finalUserId, 'and email:', uniqueEmail);
      }
    } else if (!finalUserId) {
      // If no user_id and no phone_number, create a minimal user record
      console.log('[DEBUG] Creating minimal user record for customer:', customer_name);
      const bcrypt = require('bcrypt');
      const defaultPassword = await bcrypt.hash('defaultpassword123', 10);
      // Generate unique email address based on customer name and timestamp
      const uniqueEmail = `customer_${customer_name.trim().replace(/\s+/g, '_').toLowerCase()}_${Date.now()}@huuksystem.com`;
      const [newUser] = await connection.query(
        `INSERT INTO users (phone_number, password, email, fullname, username, role, outlet, isApproved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [null, defaultPassword, uniqueEmail, customer_name.trim(), customer_name.trim(), 'customer', 'N/A', 1]
      );
      finalUserId = newUser.insertId;
      console.log('[DEBUG] Created minimal user with ID:', finalUserId, 'and email:', uniqueEmail);
    }
    
    console.log('[DEBUG] Staff appointment - final user_id:', finalUserId);
    
    console.log('[DEBUG] Validating staff...');
    const [staff] = await connection.query(
      'SELECT id, outlet_id FROM users WHERE id = ? AND role IN ("staff", "manager") AND isApproved = 1',
      [staff_id]
    );
    if (!staff.length) {
      console.log('[DEBUG] Staff validation failed - staff not found or not approved');
      return res.status(400).json({ message: "Staff or manager not available or not approved" });
    }
    console.log('[DEBUG] Staff validation passed');
    
    const staffOutletId = staff[0].outlet_id || 1;
    
    console.log('[DEBUG] Calculating time slots...');
    const slotStart = new Date(`${date}T${time}Z`);
    const operatingStart = new Date(`${date}T10:00:00Z`);
    const operatingEnd = new Date(`${date}T21:00:00Z`);
    console.log('[DEBUG] Time calculations:', {
      slotStart: slotStart.toISOString(),
      operatingStart: operatingStart.toISOString(),
      operatingEnd: operatingEnd.toISOString()
    });
    
    if (slotStart < operatingStart || slotStart > operatingEnd) {
      console.log('[DEBUG] Slot outside operating hours');
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }
    console.log('[DEBUG] Time validation passed');
    
    console.log('[DEBUG] Fetching service details...');
    const [service] = await connection.query(
      "SELECT duration, price FROM services WHERE id = ?",
      [service_id]
    );
    if (!service.length) {
      console.log('[DEBUG] Service not found');
      return res.status(404).json({ message: "Service not found" });
    }
    console.log('[DEBUG] Service found:', service[0]);
    
    const duration = service[0].duration;
    const servicePrice = parseFloat(service[0].price) || 0;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    console.log('[DEBUG] Duration calculated:', {
      duration,
      slotEnd: slotEnd.toISOString()
    });
    console.log('[DEBUG] Checking for blocked times...');
    const [blockedTimes] = await connection.query(
      "SELECT start_time, end_time FROM blocked_times WHERE staff_id = ? AND date = ?",
      [staff_id, date]
    );
    console.log('[DEBUG] Found blocked times:', blockedTimes);
    
    const isBlocked = blockedTimes.some((bt) => {
      const blockStart = new Date(`${date}T${bt.start_time}Z`);
      const blockEnd = new Date(`${date}T${bt.end_time}Z`);
      const blocked = slotStart < blockEnd && slotEnd > blockStart;
      console.log('[DEBUG] Block check:', {
        block: `${bt.start_time}-${bt.end_time}`,
        requestedSlot: `${slotStart.toISOString().slice(11, 16)}-${slotEnd.toISOString().slice(11, 16)}`,
        blocked
      });
      return blocked;
    });
    
    if (isBlocked) {
      console.log('[DEBUG] Slot blocked by staff schedule');
      return res.status(400).json({
        message: "Staff or manager not available due to blocked time",
      });
    }
    console.log('[DEBUG] No blocked times conflict');
    
    console.log('[DEBUG] Checking for booking conflicts...');
    const [conflicts] = await connection.query(
      "SELECT id, time, service_id FROM bookings WHERE staff_id = ? AND date = ? AND status != 'Cancelled'",
      [staff_id, date]
    );
    console.log('[DEBUG] Found existing bookings:', conflicts.map(c => ({ id: c.id, time: c.time, service_id: c.service_id })));
    
    const serviceIds = [...new Set(conflicts.map((c) => c.service_id))];
    const [conflictServices] = await connection.query(
      "SELECT id, duration from services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    const serviceDurationMap = conflictServices.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );
    console.log('[DEBUG] Service duration map for conflicts:', serviceDurationMap);
    
    const hasConflict = conflicts.some((c) => {
      const bookingStart = new Date(`${date}T${c.time}Z`);
      const bookingEnd = new Date(
        bookingStart.getTime() +
          (serviceDurationMap[c.service_id] || 30) * 60 * 1000
      );
      const conflicted = slotStart < bookingEnd && slotEnd > bookingStart;
      console.log('[DEBUG] Conflict check for booking', c.id, ':', {
        existing: `${bookingStart.toISOString().slice(11, 16)}-${bookingEnd.toISOString().slice(11, 16)}`,
        requested: `${slotStart.toISOString().slice(11, 16)}-${slotEnd.toISOString().slice(11, 16)}`,
        conflicted
      });
      return conflicted;
    });
    
    if (hasConflict) {
      console.log('[DEBUG] Slot conflicts with existing booking');
      return res.status(400).json({ message: "Slot already booked" });
    }
    console.log('[DEBUG] No booking conflicts detected');
    
    console.log('[DEBUG] Creating booking...');
    console.log('[DEBUG] Debug: finalUserId value before insert:', finalUserId, typeof finalUserId);
    const [result] = await connection.query(
      `INSERT INTO bookings (outlet_id, service_id, staff_id, user_id, date, time, customer_name, status, payment_status, payment_method, phone_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', 'Pending', 'Pay at Outlet', ?, NOW())`,
      [staffOutletId, service_id, staff_id, finalUserId, date, time, customer_name.trim(), phone_number || null]
    );
    console.log('[DEBUG] Booking insertion successful, ID:', result.insertId);
    
    // End time can be calculated from service duration when needed
    // (Removed database update since end_time column doesn't exist)
    
    console.log('[DEBUG] Committing transaction...');
    await connection.commit();
    console.log('✅ Transaction committed successfully');
    
    console.log("�� Booking created:", result.insertId);
    
    // Return comprehensive booking details
    const [createdBooking] = await connection.query(
      `SELECT b.id, b.customer_name, b.phone_number, b.date, b.time, 
              s.name AS service_name, s.duration, s.price,
              u.username AS staff_name, o.shortform AS outlet_name
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id  
       JOIN outlets o ON b.outlet_id = o.id
       WHERE b.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({ 
      message: "Booking created successfully", 
      booking: createdBooking[0] || { id: result.insertId },
      success: true
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error saving booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Reschedule a staff appointment
exports.rescheduleStaffAppointment = async (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body;

  if (!id || !date || !time) {
    return res.status(400).json({ message: "Appointment ID, date, and time required" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [appointment] = await connection.query(
      "SELECT * FROM bookings WHERE id = ?",
      [id]
    );
    if (!appointment.length) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const slotStart = new Date(`${date}T${time}Z`);
    const operatingStart = new Date(`${date}T10:00:00Z`);
    const operatingEnd = new Date(`${date}T21:00:00Z`);
    if (slotStart < operatingStart || slotStart > operatingEnd) {
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }

    const [service] = await connection.query(
      "SELECT duration FROM services WHERE id = ?",
      [appointment[0].service_id]
    );
    if (!service.length) {
      return res.status(404).json({ message: "Service not found" });
    }
    const duration = service[0].duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const [blockedTimes] = await connection.query(
      "SELECT start_time, end_time FROM blocked_times WHERE staff_id = ? AND date = ?",
      [appointment[0].staff_id, date]
    );
    const isBlocked = blockedTimes.some((bt) => {
      const blockStart = new Date(`${date}T${bt.start_time}Z`);
      const blockEnd = new Date(`${date}T${bt.end_time}Z`);
      return slotStart < blockEnd && slotEnd > blockStart;
    });
    if (isBlocked) {
      return res.status(400).json({
        message: "Staff not available due to blocked time",
      });
    }

    const [conflicts] = await connection.query(
      "SELECT id, time, service_id FROM bookings WHERE staff_id = ? AND date = ? AND id != ? AND status != 'Cancelled'",
      [appointment[0].staff_id, date, id]
    );

    const serviceIds = [...new Set(conflicts.map((c) => c.service_id))];
    const [conflictServices] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );

    const serviceDurationMap = conflictServices.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );

    const hasConflict = conflicts.some((c) => {
      const bookingStart = new Date(`${date}T${c.time}Z`);
      const bookingEnd = new Date(
        bookingStart.getTime() + (serviceDurationMap[c.service_id] || 30) * 60 * 1000
      );
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
    if (hasConflict) {
      return res.status(400).json({ message: "Slot already booked" });
    }

    await connection.query(
      "UPDATE bookings SET date = ?, time = ? WHERE id = ?",
      [date, time, id]
    );
    
    // Get updated appointment with calculated end_time for response
    const [updatedAppointment] = await connection.query(
      `SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name,
             b.time AS start_time, 
             TIME_FORMAT(ADDTIME(b.time, SEC_TO_TIME(s.duration * 60)), '%H:%i') AS end_time,
             b.status, b.date AS booking_date, b.payment_method, b.payment_status
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
      [id]
    );
    
    await connection.commit();
    console.log(`Appointment ${id} rescheduled to ${date} ${time}`);
    
    res.json({ 
      message: "Appointment rescheduled successfully",
      appointment: updatedAppointment[0] || null,
      newDate: date, 
      newTime: time 
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error rescheduling appointment:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Cancel a staff appointment
exports.cancelStaffAppointment = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: "Appointment ID required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [appointment] = await connection.query(
      "SELECT * FROM bookings WHERE id = ?",
      [id]
    );
    if (!appointment.length) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    await connection.query(
      "UPDATE bookings SET status = 'Cancelled' WHERE id = ?",
      [id]
    );
    await connection.commit();
    console.log(`Appointment ${id} cancelled`);
    res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error cancelling appointment:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Cancel a booking
exports.cancelBooking = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [booking] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, s.price, u.username AS staff_name, u2.email, u2.phone_number
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       JOIN users u2 ON b.user_id = u2.id
       WHERE b.id = ?`,
      [booking_id]
    );
    if (!booking.length)
      return res.status(404).json({ message: "Booking not found" });
    if (String(booking[0].user_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const bookingDate = new Date(booking[0].date);
    const now = new Date();
    const hoursDiff = (bookingDate - now) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      return res.status(400).json({ message: "Cannot cancel within 24 hours" });
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [cancelCount] = await connection.query(
      "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status = 'Cancelled' AND created_at >= ?",
      [req.userId, monthStart]
    );
    if (cancelCount[0].count >= 3) {
      return res
        .status(400)
        .json({ message: "Maximum 3 cancellations per month allowed" });
    }
    let refundStatus = booking[0].payment_status;
    if (booking[0].payment_status === "Paid" && booking[0].payment_intent_id) {
      const daysDiff = Math.ceil(hoursDiff / 24);
      if (daysDiff > 3) {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        try {
          await stripe.refunds.create({
            payment_intent: booking[0].payment_intent_id,
          });
          refundStatus = "Refunded";
        } catch (stripeErr) {
          console.error("Stripe refund error:", {
            message: stripeErr.message,
            stack: stripeErr.stack,
          });
          throw new Error("Failed to process refund: " + stripeErr.message);
        }
      }
    }
    await connection.query(
      "UPDATE bookings SET status = 'Cancelled', payment_status = ? WHERE id = ?",
      [refundStatus, booking_id]
    );
    
    // Skip notification table insert - simplify the process
    
    const bookingDetails = {
      id: booking[0].id,
      outlet: booking[0].outlet_shortform,
      service: booking[0].service_name,
      date: formatDateForDb(booking[0].date),
      time: booking[0].time,
      customer_name: booking[0].customer_name,
      staff_name: booking[0].staff_name,
      price: parseFloat(booking[0].price) || 0,
      payment_method:
        booking[0].payment_method === "Stripe"
          ? "Online Payment"
          : booking[0].payment_method,
      payment_status: refundStatus,
    };
    
    // Send email to customer
    if (booking[0].email) {
      await retryOperation(() =>
        sendCancelConfirmation(bookingDetails, booking[0].email)
      );
    }
    
    // Send SMS notification if phone number exists (non-blocking)
    if (booking[0].phone_number) {
      setImmediate(async () => {
        try {
          console.log(`📱 Sending SMS cancellation notification to: ${booking[0].phone_number}`);
          const smsResult = await sendCancellationSMS(bookingDetails, booking[0].phone_number);
          
          if (smsResult.success) {
            console.log(`✅ SMS cancellation notification sent for booking #${booking_id}`);
          } else {
            console.warn(`⚠️ SMS cancellation failed for booking #${booking_id}: ${smsResult.message || smsResult.error}`);
          }
        } catch (smsError) {
          console.error(`❌ SMS cancellation sending failed for booking #${booking_id}:`, smsError.message);
          // Don't fail the cancellation if SMS fails
        }
      });
    }
    
    await connection.commit();
    console.log("Booking cancelled:", booking_id);
    
    // Simplified staff notification - just log the event
    console.log(`Staff notification: Booking #${booking_id} cancelled by customer ${booking[0].customer_name}`);
    
    res.json({ message: "Booking cancelled" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error cancelling booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Delete booking (for cleanup of incomplete bookings)
exports.deleteBooking = async (req, res) => {
  const { bookingId } = req.params;
  if (!bookingId) {
    return res.status(400).json({ message: "Booking ID required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Check if booking exists and belongs to user
    const [booking] = await connection.query(
      "SELECT * FROM bookings WHERE id = ? AND user_id = ?",
      [bookingId, req.userId]
    );
    
    if (!booking.length) {
      return res.status(404).json({ message: "Booking not found or not authorized" });
    }
    
    // Only allow deletion of incomplete bookings (no payment made)
    if (booking[0].payment_status === "Paid") {
      return res.status(400).json({ message: "Cannot delete completed bookings" });
    }
    
    // Delete the booking
    await connection.query(
      "DELETE FROM bookings WHERE id = ? AND user_id = ?",
      [bookingId, req.userId]
    );
    
    await connection.commit();
    console.log(`🗑️ [CLEANUP] Deleted incomplete booking: ${bookingId}`);
    
    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error deleting booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Send booking receipt via email
exports.sendBookingReceipt = async (req, res) => {
  const { booking_id, email } = req.body;
  if (!booking_id || !email) {
    return res.status(400).json({ message: "Booking ID and email required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [booking] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, s.price, u.username AS staff_name
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       WHERE b.id = ? AND b.user_id = ? `,
      [booking_id, req.userId]
    );
    if (!booking.length) {
      console.error("Booking not found:", { booking_id, userId: req.userId });
      return res.status(404).json({ message: "Booking not found" });
    }
    if (
      booking[0].payment_status !== "Paid" &&
      booking[0].payment_method !== "Pay at Outlet"
    ) {
      console.error("Booking not eligible for receipt:", {
        booking_id,
        payment_status: booking[0].payment_status,
        payment_method: booking[0].payment_method,
      });
      return res
        .status(400)
        .json({ message: "Booking not paid or not set to pay at outlet" });
    }
    const bookingDetails = {
      id: booking[0].id,
      outlet: booking[0].outlet_shortform,
      service: booking[0].service_name,
      date: formatDateForDb(booking[0].date),
      time: booking[0].time,
      customer_name: booking[0].customer_name,
      staff_name: booking[0].staff_name,
      price: parseFloat(booking[0].price) || 0,
      payment_method:
        booking[0].payment_method === "Stripe"
          ? "Online Payment"
          : booking[0].payment_method,
      payment_status: booking[0].payment_status,
    };
    console.log("Sending receipt for booking:", { bookingDetails, to: email });
    await retryOperation(() => sendBookingReceipt(bookingDetails, email));
    res.json({ message: "Receipt sent successfully" });
  } catch (err) {
    console.error("Error sending receipt:", {
      message: err.message,
      stack: err.stack,
      booking_id,
      email,
    });
    res
      .status(500)
      .json({ message: "Failed to send receipt", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Set payment method to Pay at Outlet and send receipt
exports.setPayAtOutlet = async (req, res) => {
  const { booking_id, email, user_id, debug } = req.body;
  if (!booking_id || !email) {
    return res.status(400).json({ message: "Booking ID and email required" });
  }
  
  // Use the user_id from the request body if provided, otherwise use the user ID from the token
  const userId = user_id || req.userId;
  
  // Allow placeholder email for phone-only users
  const isPlaceholderEmail = email === "customer@huuksystem.com";
  if (!isPlaceholderEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Add detailed logging for debugging
    console.log("Querying booking with:", { 
      booking_id, 
      userId: userId,
      tokenUserId: req.userId,
      debug: debug || false
    });

    // First try to get the booking by ID only (more permissive)
    let booking = [];
    try {
      [booking] = await connection.query(
        `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, 
                s.price, u.username AS staff_name, u2.phone_number, u2.email AS user_email,
                u2.id AS booking_user_id
         FROM bookings b
         JOIN outlets o ON b.outlet_id = o.id
         JOIN services s ON b.service_id = s.id
         JOIN users u ON b.staff_id = u.id
         JOIN users u2 ON b.user_id = u2.id
         WHERE b.id = ?`,
        [booking_id]
      );
      
      // If found, check if it belongs to the user or if we're in debug mode
      if (booking.length) {
        const actualUserId = booking[0].user_id || booking[0].booking_user_id;
        
        // Check if user IDs match or if debug mode is enabled
        if (String(actualUserId) !== String(userId) && !debug) {
          console.log("Found booking but user ID mismatch:", {
            bookingId: booking_id,
            requestUserId: userId,
            actualUserId: actualUserId
          });
          
          // For non-debug mode, reject the request if user IDs don't match
          if (["staff", "manager", "admin"].includes(req.role)) {
            console.log("Staff/manager/admin role detected, allowing access despite user ID mismatch");
          } else {
            console.log("User ID mismatch and not in debug mode, access denied");
            return res.status(403).json({ message: "You don't have permission to modify this booking" });
          }
        } else if (debug) {
          console.log("Debug mode enabled, proceeding with operation despite possible user ID mismatch");
        }
      }
    } catch (queryError) {
      console.error("Error querying booking:", queryError);
      throw queryError;
    }
    
    // If still not found, return error
    if (!booking.length) {
      console.error("Booking not found:", { booking_id });
      return res.status(404).json({ message: "Booking not found" });
    }

    const [updateResult] = await connection.query(
      "UPDATE bookings SET payment_method = ?, payment_status = ? WHERE id = ?",
      ["Pay at Outlet", "Pending", booking_id]
    );
    if (updateResult.affectedRows === 0) {
      console.error("No rows updated for booking:", { booking_id });
      throw new Error("Failed to update booking");
    }

    const bookingDetails = {
      id: booking[0].id,
      outlet: booking[0].outlet_shortform,
      service: booking[0].service_name,
      date: formatDateForDb(booking[0].date),
      time: booking[0].time,
      customer_name: booking[0].customer_name,
      staff_name: booking[0].staff_name,
      price: booking[0].price,
      payment_method: "Pay at Outlet",
      payment_status: "Pending",
    };

    // Send email receipt if user has real email
    if (booking[0].user_email && !isPlaceholderEmail) {
      console.log("Sending email receipt to:", booking[0].user_email);
      try {
        await retryOperation(() => sendBookingReceipt(bookingDetails, booking[0].user_email));
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't fail the operation if email fails
      }
    }
    
    // Send SMS confirmation if phone number exists (non-blocking)
    if (booking[0].phone_number) {
      setImmediate(async () => {
        try {
          console.log(`📱 Sending SMS confirmation to: ${booking[0].phone_number}`);
          const smsResult = await sendBookingConfirmation(bookingDetails, booking[0].phone_number);
          
          if (smsResult.success) {
            console.log(`✅ SMS confirmation sent for Pay at Outlet booking #${booking_id}`);
          } else {
            console.warn(`⚠️ SMS failed for Pay at Outlet booking #${booking_id}: ${smsResult.message || smsResult.error}`);
          }
        } catch (smsError) {
          console.error(`❌ SMS sending failed for Pay at Outlet booking #${booking_id}:`, smsError.message);
          // Don't fail the operation if SMS fails
        }
      });
    }

    await connection.commit();
    console.log("Successfully set Pay at Outlet for booking:", booking_id);
    res.json({ message: "Payment method set and confirmation sent successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error setting pay at outlet:", {
      message: err.message,
      stack: err.stack,
      booking_id,
      email,
      userId: req.userId,
    });
    res
      .status(500)
      .json({ message: "Failed to process request", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Set payment method to Pay at Outlet for multiple bookings
exports.setMultiplePayAtOutlet = async (req, res) => {
  const { booking_ids, email, user_id, debug } = req.body;
  
  if (!booking_ids || !Array.isArray(booking_ids) || booking_ids.length === 0) {
    return res.status(400).json({ message: "Valid booking IDs array required" });
  }
  
  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }
  
  // Use the user_id from the request body if provided, otherwise use the user ID from the token
  const userId = user_id || req.userId;
  
  // Allow placeholder email for phone-only users
  const isPlaceholderEmail = email === "customer@huuksystem.com";
  if (!isPlaceholderEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    console.log("Processing multiple bookings for pay at outlet:", { 
      booking_ids, 
      count: booking_ids.length,
      userId: userId,
      tokenUserId: req.userId,
      debug: debug || false
    });

    // Process each booking
    const results = [];
    const failedBookings = [];
    
    for (const bookingId of booking_ids) {
      try {
        // Verify booking exists and belongs to user or is accessible by staff
        let booking = [];
        try {
          [booking] = await connection.query(
            `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, 
                    s.price, u.username AS staff_name, u2.phone_number, u2.email AS user_email,
                    u2.id AS booking_user_id
             FROM bookings b
             JOIN outlets o ON b.outlet_id = o.id
             JOIN services s ON b.service_id = s.id
             JOIN users u ON b.staff_id = u.id
             JOIN users u2 ON b.user_id = u2.id
             WHERE b.id = ?`,
            [bookingId]
          );
          
          if (booking.length) {
            const actualUserId = booking[0].user_id || booking[0].booking_user_id;
            
            // Check if user IDs match or if debug mode is enabled
            if (String(actualUserId) !== String(userId) && !debug) {
              // For non-debug mode, check if user is staff
              if (["staff", "manager", "admin"].includes(req.role)) {
                console.log(`Staff/manager/admin role detected, allowing access to booking ${bookingId}`);
              } else {
                console.log(`User ID mismatch for booking ${bookingId}, access denied`);
                failedBookings.push({
                  id: bookingId,
                  error: "Permission denied"
                });
                continue; // Skip this booking
              }
            }
          } else {
            failedBookings.push({
              id: bookingId,
              error: "Booking not found"
            });
            continue; // Skip this booking
          }
        } catch (queryError) {
          console.error(`Error querying booking ${bookingId}:`, queryError);
          failedBookings.push({
            id: bookingId,
            error: "Database query error"
          });
          continue; // Skip this booking
        }

        // Update booking payment method
        const [updateResult] = await connection.query(
          "UPDATE bookings SET payment_method = ?, payment_status = ? WHERE id = ?",
          ["Pay at Outlet", "Pending", bookingId]
        );
        
        if (updateResult.affectedRows === 0) {
          console.error(`No rows updated for booking ${bookingId}`);
          failedBookings.push({
            id: bookingId,
            error: "Update failed"
          });
          continue; // Skip this booking
        }

        // Add to successful results
        results.push({
          id: booking[0].id,
          outlet: booking[0].outlet_shortform,
          service: booking[0].service_name,
          date: formatDateForDb(booking[0].date),
          time: booking[0].time,
          customer_name: booking[0].customer_name,
          staff_name: booking[0].staff_name,
          price: booking[0].price,
          payment_method: "Pay at Outlet",
          payment_status: "Pending",
        });
      } catch (bookingError) {
        console.error(`Error processing booking ${bookingId}:`, bookingError);
        failedBookings.push({
          id: bookingId,
          error: "Processing error"
        });
      }
    }
    
    // If all bookings failed, return error
    if (results.length === 0 && failedBookings.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        message: "Failed to update any bookings", 
        failedBookings 
      });
    }

    // Commit transaction
    await connection.commit();
    
    // Return results with any failed bookings
    return res.status(200).json({
      message: `Payment method set to Pay at Outlet for ${results.length} bookings`,
      bookings: results,
      failedBookings: failedBookings.length > 0 ? failedBookings : undefined,
      successCount: results.length,
      failCount: failedBookings.length
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error setting multiple pay at outlet:", err);
    return res.status(500).json({ message: "Error setting pay at outlet for multiple bookings" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Confirm Pay at Outlet payment
exports.confirmPayAtOutlet = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id) {
    return res.status(400).json({ message: "Booking ID required" });
  }
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [booking] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, s.price, u.username AS staff_name
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       WHERE b.id = ? AND b.payment_method = 'Pay at Outlet' AND b.payment_status = 'Pending'`,
      [booking_id]
    );
    if (!booking.length) {
      console.error("Booking not found or not eligible:", { booking_id });
      return res.status(404).json({
        message: "Booking not found or not eligible for confirmation",
      });
    }

    const bookingData = booking[0];
    const { user_id, date, customer_name } = bookingData;

    // Find all related bookings for the same user, date, and customer name that are pending payment
    const [relatedBookings] = await connection.query(
      "SELECT id FROM bookings WHERE user_id = ? AND date = ? AND customer_name = ? AND payment_status = 'Pending'",
      [user_id, date, customer_name]
    );

    if (relatedBookings.length > 0) {
      const relatedBookingIds = relatedBookings.map(b => b.id);
      
      const [updateResult] = await connection.query(
        "UPDATE bookings SET payment_status = 'Paid' WHERE id IN (?)",
        [relatedBookingIds]
      );
      if (updateResult.affectedRows === 0) {
        console.error("No rows updated for related bookings:", { relatedBookingIds });
        throw new Error("Failed to confirm payment for related bookings");
      }
      console.log(
        `Successfully confirmed Pay at Outlet for ${updateResult.affectedRows} related bookings:`,
        relatedBookingIds
      );
    }

    const bookingDetails = {
      id: booking[0].id,
      outlet: booking[0].outlet_shortform,
      service: booking[0].service_name,
      date: formatDateForDb(booking[0].date),
      time: booking[0].time,
      customer_name: booking[0].customer_name,
      staff_name: booking[0].staff_name,
      price: parseFloat(booking[0].price) || 0,
      payment_method: "Pay at Outlet",
      payment_status: "Paid",
    };

    const [user] = await connection.query(
      "SELECT email FROM users WHERE id = ?",
      [booking[0].user_id]
    );
    if (user.length && user[0].email) {
      console.log("Sending receipt for confirmed Pay at Outlet booking:", {
        booking_id,
        to: user[0].email,
      });
      await retryOperation(() =>
        sendBookingReceipt(bookingDetails, user[0].email)
      );
    } else {
      console.warn("No email found for user ID:", {
        userId: booking[0].user_id,
      });
    }

    await connection.commit();
    console.log(
      "Successfully confirmed Pay at Outlet for booking:",
      booking_id
    );
    res.json({ message: "Payment confirmed and receipt sent successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error confirming Pay at Outlet:", {
      message: err.message,
      stack: err.stack,
      booking_id,
      userId: req.userId,
    });
    res
      .status(500)
      .json({ message: "Failed to confirm payment", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Sales report for staff outlet
exports.getStaffSales = async (req, res) => {
  if (req.role !== "staff")
    return res.status(403).json({ message: "Staff role required" });
  const { outlet_id, date } = req.query;
  if (!outlet_id || !date)
    return res.status(400).json({ message: "Outlet ID and date required" });
  let connection;
  try {
    connection = await pool.getConnection();
    const [summary] = await connection.query(
      `SELECT COUNT(*) AS booking_count, SUM(s.price) AS total_revenue
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.outlet_id = ? AND b.date = ? AND b.payment_status = 'Paid'`,
      [outlet_id, date]
    );
    const [topServices] = await connection.query(
      `SELECT s.name, COUNT(*) AS count
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.outlet_id = ? AND b.date = ?
       GROUP BY s.id
       ORDER BY count DESC
       LIMIT 3`,
      [outlet_id, date]
    );
    console.log("Fetched sales report for outlet:", outlet_id, "date:", date);
    res.json({
      total_revenue: summary[0].total_revenue || 0,
      booking_count: summary[0].booking_count,
      top_services: topServices,
    });
  } catch (err) {
    console.error("Error fetching sales:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Payment summary for staff outlet
exports.getStaffPayments = async (req, res) => {
  if (req.role !== "staff")
    return res.status(403).json({ message: "Staff role required" });
  const { outlet_id, date } = req.query;
  if (!outlet_id || !date)
    return res.status(400).json({ message: "Outlet ID and date required" });
  let connection;
  try {
    connection = await pool.getConnection();
    const [summary] = await connection.query(
      `SELECT payment_status, COUNT(*) AS count, SUM(s.price) AS amount
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.outlet_id = ? AND b.date = ?
       GROUP BY payment_status`,
      [outlet_id, date]
    );
    const result = {
      Paid: { count: 0, amount: 0 },
      Pending: { count: 0, amount: 0 },
    };
    summary.forEach((row) => {
      result[row.payment_status] = {
        count: row.count,
        amount: row.amount || 0,
      };
    });
    console.log(
      "Fetched payment summary for outlet:",
      outlet_id,
      "date:",
      date
    );
    res.json(result);
  } catch (err) {
    console.error("Error fetching payments:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Sales report for all outlets
exports.getManagerSales = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "Date required" });
  let connection;
  try {
    connection = await pool.getConnection();
    const [summary] = await connection.query(
      `SELECT COUNT(*) AS booking_count, SUM(s.price) AS total_revenue
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ? AND b.payment_status = 'Paid'`,
      [date]
    );
    const [topServices] = await connection.query(
      `SELECT s.name, COUNT(*) AS count
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ?
       GROUP BY s.id
       ORDER BY count DESC
       LIMIT 3`,
      [date]
    );
    console.log("Fetched manager sales report for date:", date);
    res.json({
      total_revenue: summary[0].total_revenue || 0,
      booking_count: summary[0].booking_count,
      top_services: topServices,
    });
  } catch (err) {
    console.error("Error fetching manager sales:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Payment summary for all outlets
exports.getManagerPayments = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "Date required" });
  let connection;
  try {
    connection = await pool.getConnection();
    const [summary] = await connection.query(
      `SELECT payment_status, COUNT(*) AS count, SUM(s.price) AS amount
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ?
       GROUP BY payment_status`,
      [date]
    );
    const result = {
      Paid: { count: 0, amount: 0 },
      Pending: { count: 0, amount: 0 },
    };
    summary.forEach((row) => {
      result[row.payment_status] = {
        count: row.count,
        amount: row.amount || 0,
      };
    });
    console.log("Fetched manager payment summary for date:", date);
    res.json(result);
  } catch (err) {
    console.error("Error fetching manager payments:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Sales report for today's completed bookings (for pie chart)
exports.getSalesReport = async (req, res) => {
  // Allow both staff and managers to access sales report
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Get today's date in YYYY-MM-DD format using local time
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    
    // Query to get completed bookings for today grouped by service
    const [results] = await connection.query(
      `SELECT s.name AS service_name, COUNT(*) AS service_count, SUM(s.price) AS total_sales
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ? AND b.status IN ('Completed', 'Done')
       GROUP BY s.id, s.name
       ORDER BY service_count DESC`,
      [today]
    );
    
    // Calculate total sales
    const totalSales = results.reduce((sum, item) => sum + parseFloat(item.total_sales || 0), 0);
    
    // Format the response data for the pie chart (frontend expects labels and data arrays)
    const labels = results.map(item => item.service_name);
    const data = results.map(item => parseInt(item.service_count));
    
    console.log("Fetched sales report for today:", today, "Total services:", results.length);
    
    res.json({
      labels: labels,
      data: data,
      totalSales: totalSales
    });
    
  } catch (err) {
    console.error("Error fetching sales report:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get today's transaction count grouped by outlet
exports.getTodayTransactionsByOutlet = async (req, res) => {
  // Allow both staff and managers to access transaction data
  if (!["staff", "manager"].includes(req.role))
    return res.status(403).json({ message: "Staff or manager role required" });
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Get today's date in YYYY-MM-DD format using local time
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    
    // Query to get today's bookings grouped by outlet
    const [results] = await connection.query(
      `SELECT o.shortform AS outlet_name, COUNT(*) AS transaction_count
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       WHERE b.date = ? AND b.status != 'Cancelled'
       GROUP BY o.id, o.shortform
       ORDER BY o.shortform`,
      [today]
    );
    
    console.log("Fetched today's transaction counts by outlet:", today, "Total outlets:", results.length);
    
    res.json({
      date: today,
      outlets: results
    });
    
  } catch (err) {
    console.error("Error fetching today's transactions by outlet:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get staff appointments with pagination and filtering
exports.getStaffAppointments = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  
  const { date, status, page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Build query conditions
    let whereClause = "WHERE b.staff_id = ? AND b.payment_method IS NOT NULL";
    let queryParams = [req.userId];
    
    if (date) {
      whereClause += " AND b.date = ?";
      queryParams.push(date);
    }
    
    if (status && status !== "all") {
      whereClause += " AND b.status = ?";
      queryParams.push(status);
    }
    
    if (search) {
      whereClause += " AND (b.customer_name LIKE ? OR u.phone_number LIKE ? OR s.name LIKE ?)";
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      LEFT JOIN users u ON b.user_id = u.id
      ${whereClause}
    `;
    
    const [countResult] = await connection.query(countQuery, queryParams);
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Get appointments with simplified end_time calculation and staff information
    const appointmentsQuery = `
      SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name,
             b.time AS start_time, 
             TIME_FORMAT(ADDTIME(b.time, SEC_TO_TIME(s.duration * 60)), '%H:%i') AS end_time,
             b.status, DATE_FORMAT(b.date, '%Y-%m-%d') AS booking_date, b.payment_method, b.payment_status,
             staff.username AS staff_username, staff.fullname AS staff_fullname
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN users staff ON b.staff_id = staff.id
      ${whereClause}
      AND s.id IS NOT NULL
      ORDER BY b.date DESC, b.time ASC
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), offset);
    const [appointments] = await connection.query(appointmentsQuery, queryParams);
    
    console.log(`Fetched ${appointments.length} appointments for staff ${req.userId}`);
    
    res.json({
      appointments,
      totalPages,
      currentPage: parseInt(page),
      totalCount
    });
    
  } catch (err) {
    console.error("Error fetching staff appointments:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get booking details by ID
exports.getBookingDetails = async (req, res) => {
  // Allow any authenticated user to access booking details
  // Staff/managers can access any booking, customers can only access their own
  const { id } = req.params;
  const debug = req.query.debug === 'true';
  
  if (!id) {
    return res.status(400).json({ message: "Booking ID required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Different query based on user role
    let booking = [];
    
    if (["staff", "manager", "admin"].includes(req.role)) {
      // Staff/managers can access any booking
      [booking] = await connection.query(`
        SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name,
               b.time AS start_time, b.user_id,
               TIME_FORMAT(ADDTIME(b.time, SEC_TO_TIME(s.duration * 60)), '%H:%i') AS end_time,
               b.status, b.date AS booking_date, b.payment_method, b.payment_status,
               s.price, s.duration, o.name AS outlet_name, o.shortform AS outlet_shortform,
               staff.username AS staff_username, staff.fullname AS staff_fullname,
               staff.id AS staff_id
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN outlets o ON b.outlet_id = o.id
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN users staff ON b.staff_id = staff.id
        WHERE b.id = ?
      `, [id]);
    } else {
      // Customers can only access their own bookings
      [booking] = await connection.query(`
        SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name,
               b.time AS start_time, b.user_id,
               TIME_FORMAT(ADDTIME(b.time, SEC_TO_TIME(s.duration * 60)), '%H:%i') AS end_time,
               b.status, b.date AS booking_date, b.payment_method, b.payment_status,
               s.price, s.duration, o.name AS outlet_name, o.shortform AS outlet_shortform,
               staff.username AS staff_username, staff.fullname AS staff_fullname,
               staff.id AS staff_id
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN outlets o ON b.outlet_id = o.id
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN users staff ON b.staff_id = staff.id
        WHERE b.id = ? AND b.user_id = ?
      `, [id, req.userId]);
      
      // If not found with user ID constraint, try without it for debugging
      if (!booking.length && debug) {
        console.log(`Debug mode: Trying to find booking ${id} without user ID constraint`);
        [booking] = await connection.query(`
          SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name,
                 b.time AS start_time, b.user_id,
                 TIME_FORMAT(ADDTIME(b.time, SEC_TO_TIME(s.duration * 60)), '%H:%i') AS end_time,
                 b.status, b.date AS booking_date, b.payment_method, b.payment_status,
                 s.price, s.duration, o.name AS outlet_name, o.shortform AS outlet_shortform,
                 staff.username AS staff_username, staff.fullname AS staff_fullname,
                 staff.id AS staff_id
          FROM bookings b
          JOIN services s ON b.service_id = s.id
          JOIN outlets o ON b.outlet_id = o.id
          LEFT JOIN users u ON b.user_id = u.id
          LEFT JOIN users staff ON b.staff_id = staff.id
          WHERE b.id = ?
        `, [id]);
        
        if (booking.length) {
          console.log(`Debug mode: Found booking ${id} but it belongs to user ${booking[0].user_id}, not ${req.userId}`);
        }
      }
    }
    
    if (!booking.length) {
      return res.status(404).json({ message: "Booking not found or not authorized" });
    }
    
    console.log(`Fetched booking details for booking ${id}`);
    
    // Format the response to match what the frontend expects
    const bookingData = {
      id: booking[0].id,
      bookingId: booking[0].id,
      customer_name: booking[0].customer_name,
      customerName: booking[0].customer_name,
      service_name: booking[0].service_name,
      serviceName: booking[0].service_name,
      payment_method: booking[0].payment_method,
      paymentMethod: booking[0].payment_method,
      payment_status: booking[0].payment_status,
      paymentStatus: booking[0].payment_status,
      price: booking[0].price,
      totalAmount: booking[0].price,
      time: booking[0].start_time,
      startTime: booking[0].start_time,
      endTime: booking[0].end_time,
      date: booking[0].booking_date,
      bookingDate: booking[0].booking_date,
      staff_name: booking[0].staff_fullname || booking[0].staff_username,
      staffName: booking[0].staff_fullname || booking[0].staff_username,
      staff_id: booking[0].staff_id,
      phoneNumber: booking[0].phone_number,
      outlet: booking[0].outlet_name,
      outlet_shortform: booking[0].outlet_shortform
    };
    
    res.json(bookingData);
    
  } catch (err) {
    console.error("Error fetching booking details:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  
  const { id } = req.params;
  const { status } = req.body;
  
  if (!id || !status) {
    return res.status(400).json({ message: "Appointment ID and status required" });
  }
  
  // Validate status (case-insensitive)
  const validStatuses = ["Pending", "Confirmed", "Completed", "Cancelled", "pending", "confirmed", "completed", "cancelled", "absent", "Absent"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid status: ${status}. Valid statuses are: ${validStatuses.join(', ')}` });
  }
  
  // Normalize status to proper case
  let normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  
  // Handle special case for 'absent' status
  const finalStatus = status.toLowerCase() === 'absent' ? 'Cancelled' : normalizedStatus;
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Check if appointment exists and belongs to staff
    const [appointment] = await connection.query(
      "SELECT * FROM bookings WHERE id = ? AND staff_id = ?",
      [id, req.userId]
    );
    
    if (!appointment.length) {
      return res.status(404).json({ message: "Appointment not found or not authorized" });
    }
    
    // Update appointment status
    await connection.query(
      "UPDATE bookings SET status = ? WHERE id = ?",
      [finalStatus, id]
    );
    
    // If marking as completed, also handle payment if it's pay at outlet
    if (status === "Completed") {
      const booking = appointment[0];
      const isPayAtOutlet = booking.payment_method === 'Pay at Outlet';
      const isPendingPayment = booking.payment_status === 'Pending';
      
      if (isPayAtOutlet && isPendingPayment) {
        // For pay at outlet, ask for payment confirmation
        await connection.commit();
        return res.json({ 
          message: "Appointment marked as completed",
          showPaymentConfirmation: true,
          bookingId: id,
          paymentMethod: booking.payment_method,
          paymentStatus: booking.payment_status
        });
      }
    }
    
    await connection.commit();
    console.log(`Appointment ${id} status updated to ${status}`);
    
    res.json({ message: "Appointment status updated successfully" });
    
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating appointment status:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
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
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [user] = await connection.query(
      'SELECT id, role FROM users WHERE id = ? AND role IN ("staff", "manager") AND isApproved = 1',
      [staff_id]
    );
    if (!user.length)
      return res
        .status(404)
        .json({ message: "Approved staff or manager not found" });

    if (req.role === "staff" && staff_id !== req.userId) {
      return res
        .status(403)
        .json({ message: "Staff can only block their own time" });
    }

    const start = new Date(`${date}T${start_time}Z`);
    const end = new Date(`${date}T${end_time}Z`);
    if (start >= end)
      return res
        .status(400)
        .json({ message: "End time must be after start time" });

    if (req.role === "staff") {
      const [schedule] = await connection.query(
        "SELECT start_time, end_time FROM schedules WHERE staff_id = ? AND date = ?",
        [staff_id, date]
      );
      if (!schedule.length) {
        return res
          .status(400)
          .json({ message: "No working hours scheduled for this date" });
      }
      const scheduleStart = new Date(`${date}T${schedule[0].start_time}Z`);
      const scheduleEnd = new Date(`${date}T${schedule[0].end_time}Z`);
      if (start < scheduleStart || end > scheduleEnd) {
        return res
          .status(400)
          .json({ message: "Blocked time must be within working hours" });
      }
    }

    const [existingBlocks] = await connection.query(
      "SELECT id FROM blocked_times WHERE staff_id = ? AND date = ? AND (start_time < ? AND end_time > ?)",
      [staff_id, date, end_time, start_time]
    );
    if (existingBlocks.length)
      return res
        .status(400)
        .json({ message: "Overlapping blocked time exists" });

    const [result] = await connection.query(
      "INSERT INTO blocked_times (staff_id, date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)",
      [staff_id, date, start_time, end_time, reason]
    );

    await connection.commit();
    console.log("Blocked time added:", result.insertId);
    res.json({ message: "Blocked time added", blockId: result.insertId });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error adding blocked time:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// List blocked times
exports.getBlockedTimes = async (req, res) => {
  if (req.role !== "manager")
    return res.status(403).json({ message: "Manager role required" });
  const { staff_id, date } = req.query;
  if (!staff_id || !date)
    return res.status(400).json({ message: "Staff ID and date required" });
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT id, start_time, end_time, reason FROM blocked_times WHERE staff_id = ? AND date = ?",
      [staff_id, date]
    );
    console.log("Fetched blocked times for staff:", staff_id, "date:", date);
    res.json(results);
  } catch (err) {
    console.error("Error fetching blocked times:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
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
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [booking] = await connection.query(
      "SELECT date, time, user_id, status FROM bookings WHERE id = ?",
      [booking_id]
    );
    if (!booking.length) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (String(booking[0].user_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const bookingDateTime = new Date(`${booking[0].date}T${booking[0].time}Z`);
    if (bookingDateTime > new Date()) {
      return res.status(400).json({ message: "Cannot review future bookings" });
    }
    if (!["Confirmed", "Completed"].includes(booking[0].status)) {
      return res.status(400).json({ message: "Booking must be confirmed" });
    }
    const reviewCutoff = new Date(
      bookingDateTime.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    if (new Date() > reviewCutoff) {
      return res.status(400).json({ message: "Review period has expired" });
    }
    const [existingReview] = await connection.query(
      "SELECT id FROM reviews WHERE booking_id = ?",
      [booking_id]
    );
    if (existingReview.length) {
      return res.status(400).json({ message: "Review already submitted" });
    }
    const [result] = await connection.query(
      "INSERT INTO reviews (booking_id, user_id, staff_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [booking_id, user_id, staff_id, rating, comment || null]
    );
    await connection.commit();
    console.log("Review submitted:", result.insertId);
    res.json({ message: "Review submitted", reviewId: result.insertId });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error submitting review:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Fetch review for a booking
exports.getReview = async (req, res) => {
  const { booking_id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [booking] = await connection.query(
      "SELECT user_id FROM bookings WHERE id = ?",
      [booking_id]
    );
    if (!booking.length) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (String(booking[0].user_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const [review] = await connection.query(
      "SELECT id, rating, comment, created_at FROM reviews WHERE booking_id = ?",
      [booking_id]
    );
    if (!review.length) {
      return res.status(404).json({ message: "No review found" });
    }
    res.json(review[0]);
  } catch (err) {
    console.error("Error fetching review:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Update a review
exports.updateReview = async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  if (!rating) {
    return res.status(400).json({ message: "Rating is required" });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [review] = await connection.query(
      "SELECT booking_id, created_at FROM reviews WHERE id = ?",
      [id]
    );
    if (!review.length) {
      return res.status(404).json({ message: "Review not found" });
    }
    const [booking] = await connection.query(
      "SELECT date, time, user_id FROM bookings WHERE id = ?",
      [review[0].booking_id]
    );
    if (!booking.length) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (String(booking[0].user_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const bookingDateTime = new Date(`${booking[0].date}T${booking[0].time}Z`);
    const reviewCutoff = new Date(
      bookingDateTime.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    if (new Date() > reviewCutoff) {
      return res
        .status(400)
        .json({ message: "Review edit period has expired" });
    }
    await connection.query(
      "UPDATE reviews SET rating = ?, comment = ? WHERE id = ?",
      [rating, comment || null, id]
    );
    await connection.commit();
    console.log("Review updated:", id);
    res.json({ message: "Review updated" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating review:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Update a booking
exports.updateBooking = async (req, res) => {
  console.log("🔧 [UPDATE BOOKING] Request received:", {
    bookingId: req.params.bookingId,
    body: req.body,
    userId: req.userId
  });
  
  const { bookingId } = req.params;
  const { outlet_id, service_id, staff_id, date, time, customer_name } = req.body;
  
  console.log("🔧 [UPDATE BOOKING] Extracted fields:", {
    bookingId,
    outlet_id,
    service_id,
    staff_id,
    date,
    time,
    customer_name
  });
  
  if (!bookingId || !outlet_id || !service_id || !staff_id || !date || !time || !customer_name) {
    console.log("❌ [UPDATE BOOKING] Missing required fields:", {
      bookingId: !!bookingId,
      outlet_id: !!outlet_id,
      service_id: !!service_id,
      staff_id: !!staff_id,
      date: !!date,
      time: !!time,
      customer_name: !!customer_name
    });
    return res.status(400).json({ message: "All fields required" });
  }
  if (customer_name.length > 10) {
    return res.status(400).json({ message: "Client name must be 10 characters or less" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Check if booking exists and belongs to user
    const [existingBooking] = await connection.query(
      "SELECT * FROM bookings WHERE id = ? AND user_id = ?",
      [bookingId, req.userId]
    );
    if (!existingBooking.length) {
      return res.status(404).json({ message: "Booking not found or not authorized" });
    }
    
    // Validate staff
    const [staff] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND role IN ("staff", "manager") AND isApproved = 1',
      [staff_id]
    );
    if (!staff.length) {
      return res.status(400).json({ message: "Staff or manager not available or not approved" });
    }
    
    // Validate slot timing
    const slotStart = new Date(`${date}T${time}Z`);
    const operatingStart = new Date(`${date}T10:00:00Z`);
    const operatingEnd = new Date(`${date}T21:00:00Z`);
    if (slotStart < operatingStart || slotStart > operatingEnd) {
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }
    
    // Get service duration
    const [service] = await connection.query(
      "SELECT duration FROM services WHERE id = ?",
      [service_id]
    );
    if (!service.length) {
      return res.status(404).json({ message: "Service not found" });
    }
    const duration = service[0].duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    
    console.log("🔧 [UPDATE BOOKING] Service and slot details:", {
      service_id,
      duration,
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      bookingId
    });
    
    // Check for blocked times
    const [blockedTimes] = await connection.query(
      "SELECT start_time, end_time FROM blocked_times WHERE staff_id = ? AND date = ?",
      [staff_id, date]
    );
    const isBlocked = blockedTimes.some((bt) => {
      const blockStart = new Date(`${date}T${bt.start_time}Z`);
      const blockEnd = new Date(`${date}T${bt.end_time}Z`);
      return slotStart < blockEnd && slotEnd > blockStart;
    });
    if (isBlocked) {
      return res.status(400).json({
        message: "Staff or manager not available due to blocked time",
      });
    }
    
    // Get current booking details to compare service durations
    const [currentBooking] = await connection.query(
      "SELECT service_id, time FROM bookings WHERE id = ?",
      [bookingId]
    );
    
    if (currentBooking.length > 0) {
      const [currentService] = await connection.query(
        "SELECT duration FROM services WHERE id = ?",
        [currentBooking[0].service_id]
      );
      
      console.log("🔧 [UPDATE BOOKING] Current vs new service comparison:", {
        currentServiceId: currentBooking[0].service_id,
        currentServiceDuration: currentService[0]?.duration || "unknown",
        newServiceId: service_id,
        newServiceDuration: duration,
        currentTime: currentBooking[0].time,
        newTime: time,
        sameTime: currentBooking[0].time === time
      });
    }
    
    // Check for conflicts with other bookings (excluding current booking)
    console.log("🔧 [UPDATE BOOKING] Checking conflicts with params:", {
      staff_id,
      date,
      bookingId,
      userId: req.userId
    });
    
    const [conflicts] = await connection.query(
      "SELECT id, time, service_id FROM bookings WHERE staff_id = ? AND date = ? AND id != ? AND status != 'Cancelled'",
      [staff_id, date, bookingId]
    );
    
    console.log("🔧 [UPDATE BOOKING] Found conflicts:", conflicts);
    
    const serviceIds = [...new Set(conflicts.map((c) => c.service_id))];
    const [conflictServices] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    const serviceDurationMap = conflictServices.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );
    
    const hasConflict = conflicts.some((c) => {
      const bookingStart = new Date(`${date}T${c.time}Z`);
      const bookingEnd = new Date(
        bookingStart.getTime() + (serviceDurationMap[c.service_id] || 30) * 60 * 1000
      );
      const conflict = slotStart < bookingEnd && slotEnd > bookingStart;
      console.log("🔧 [UPDATE BOOKING] Conflict check:", {
        conflictId: c.id,
        conflictTime: c.time,
        bookingStart: bookingStart.toISOString(),
        bookingEnd: bookingEnd.toISOString(),
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        hasConflict: conflict
      });
      return conflict;
    });
    
    console.log("🔧 [UPDATE BOOKING] Final conflict result:", hasConflict);
    
    if (hasConflict) {
      console.log("❌ [UPDATE BOOKING] Conflict detected, rejecting update");
      return res.status(400).json({ message: "Slot already booked" });
    }
    
    // Update the booking
    console.log("🔧 [UPDATE BOOKING] Executing update query with params:", {
      outlet_id,
      service_id,
      staff_id,
      date,
      time,
      customer_name,
      bookingId,
      userId: req.userId
    });
    
    const [result] = await connection.query(
      "UPDATE bookings SET outlet_id = ?, service_id = ?, staff_id = ?, date = ?, time = ?, customer_name = ? WHERE id = ? AND user_id = ?",
      [outlet_id, service_id, staff_id, date, time, customer_name, bookingId, req.userId]
    );
    
    console.log("🔧 [UPDATE BOOKING] Update result:", result);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found or not authorized" });
    }
    
    // Get updated booking details for notification
    const [updatedBooking] = await connection.query(
      `SELECT b.*, s.name AS service_name 
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.id = ?`,
      [bookingId]
    );
    
    await connection.commit();
    console.log("Booking updated:", bookingId);
    
    // Get complete updated booking details for the response
    const [completeUpdatedBooking] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, 
              s.price, u.username AS staff_name
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       WHERE b.id = ?`,
      [bookingId]
    );
    
    // Send notification after booking update
    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking('update', {
          id: bookingId,
          user_id: req.userId,
          staff_id: staff_id,
          service_name: updatedBooking[0].service_name,
          date: date,
          customer_name: customer_name
        });
      } catch (notificationError) {
        console.error('Error sending booking update notification:', notificationError);
      }
    });
    
    // Return the complete booking object that the frontend expects
    const bookingResponse = {
      id: bookingId,
      customer_name: customer_name,
      outlet_name: completeUpdatedBooking[0]?.outlet_shortform || "N/A",
      staff_name: completeUpdatedBooking[0]?.staff_name || "N/A",
      service_name: completeUpdatedBooking[0]?.service_name || "N/A",
      date: date,
      time: time,
      price: parseFloat(completeUpdatedBooking[0]?.price) || 0,
      payment_method: "Stripe",
      payment_status: "Pending",
    };
    
    res.json({ 
      message: "Booking updated successfully", 
      booking: bookingResponse,
      bookingId: bookingId 
    });
    
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("❌ [UPDATE BOOKING] Error updating booking:", {
      message: err.message,
      stack: err.stack,
      bookingId: req.params.bookingId,
      userId: req.userId,
      body: req.body
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Reschedule a booking
exports.rescheduleBooking = async (req, res) => {
  const { booking_id, date, time, staff_id } = req.body;
  if (!booking_id || !date || !time || !staff_id) {
    return res.status(400).json({ message: "All fields required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [booking] = await connection.query(
      `SELECT b.*, o.shortform AS outlet_shortform, s.name AS service_name, s.price, u.username AS staff_name, u2.email
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       JOIN users u2 ON b.user_id = u2.id
       WHERE b.id = ?`,
      [booking_id]
    );
    if (!booking.length) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (String(booking[0].user_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const currentBookingDateTime = new Date(
      `${booking[0].date}T${booking[0].time}Z`
    );
    const now = new Date();
    const hoursDiff = (currentBookingDateTime - now) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      return res
        .status(400)
        .json({ message: "Cannot reschedule within 24 hours" });
    }
    if (booking[0].status === "Cancelled") {
      return res
        .status(400)
        .json({ message: "Cannot reschedule cancelled booking" });
    }
    const [staff] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND role IN ("staff", "manager") AND isApproved = 1',
      [staff_id]
    );
    if (!staff.length) {
      return res
        .status(400)
        .json({ message: "Staff not available or not approved" });
    }
    const slotStart = new Date(`${date}T${time}Z`);
    const operatingStart = new Date(`${date}T10:00:00Z`);
    const operatingEnd = new Date(`${date}T21:00:00Z`);
    if (slotStart < operatingStart || slotStart > operatingEnd) {
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }
    const [service] = await connection.query(
      "SELECT duration FROM services WHERE id = ?",
      [booking[0].service_id]
    );
    if (!service.length)
      return res.status(404).json({ message: "Service not found" });
    const duration = service[0].duration;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    const [blockedTimes] = await connection.query(
      "SELECT start_time, end_time FROM blocked_times WHERE staff_id = ? AND date = ?",
      [staff_id, date]
    );
    const isBlocked = blockedTimes.some((bt) => {
      const blockStart = new Date(`${date}T${bt.start_time}Z`);
      const blockEnd = new Date(`${date}T${bt.end_time}Z`);
      return slotStart < blockEnd && slotEnd > blockStart;
    });
    if (isBlocked) {
      return res
        .status(400)
        .json({ message: "Staff not available due to blocked time" });
    }
    const [conflicts] = await connection.query(
      "SELECT id, time, service_id FROM bookings WHERE staff_id = ? AND date = ? AND id != ? AND status != 'Cancelled'",
      [staff_id, date, booking_id]
    );
    const serviceIds = [...new Set(conflicts.map((c) => c.service_id))];
    const [conflictServices] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    const serviceDurationMap = conflictServices.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );
    const hasConflict = conflicts.some((c) => {
      const bookingStart = new Date(`${date}T${c.time}Z`);
      const bookingEnd = new Date(
        bookingStart.getTime() +
          (serviceDurationMap[c.service_id] || 30) * 60 * 1000
      );
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
    if (hasConflict) {
      return res.status(400).json({ message: "Slot already booked" });
    }
    const nextEvent = [
      ...blockedTimes,
      ...conflicts.map((c) => ({
        start_time: c.time,
        end_time: new Date(`${date}T${c.time}Z`).toTimeString().slice(0, 5),
        service_id: c.service_id,
      })),
    ]
      .map((e) => {
        const start = new Date(`${date}T${e.start_time}Z`);
        return {
          start,
          end: e.end_time
            ? new Date(`${date}T${e.end_time}Z`)
            : new Date(
                start.getTime() +
                  (serviceDurationMap[e.service_id] || 30) * 60 * 1000
              ),
        };
      })
      .filter((e) => e.start > slotStart)
      .sort((a, b) => a.start - b.start)[0];
    if (nextEvent && nextEvent.start < slotEnd) {
      return res
        .status(400)
        .json({ message: "Insufficient time for service duration" });
    }
    await connection.query(
      "UPDATE bookings SET date = ?, time = ?, staff_id = ? WHERE id = ?",
      [date, time, staff_id, booking_id]
    );
    
    // Skip notification table insert - simplify the process
    
    const bookingDetails = {
      id: booking[0].id,
      outlet: booking[0].outlet_shortform,
      service: booking[0].service_name,
      date: formatDateForDb(date),
      time: time,
      customer_name: booking[0].customer_name,
      staff_name: booking[0].staff_name,
      price: parseFloat(booking[0].price) || 0,
      payment_method:
        booking[0].payment_method === "Stripe"
          ? "Online Payment"
          : booking[0].payment_method,
      payment_status: booking[0].payment_status,
    };
    
    // Send email to customer
    if (booking[0].email) {
      await retryOperation(() =>
        sendRescheduleConfirmation(bookingDetails, booking[0].email)
      );
    }
    
    await connection.commit();
    console.log("Booking rescheduled:", booking_id);
    
    // Simplified staff notification - just log the event
    console.log(`Staff notification: Booking #${booking_id} rescheduled by customer ${booking[0].customer_name} to ${formatDateForDb(date)} at ${time}`);
    
    res.json({ message: "Booking rescheduled" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error rescheduling booking:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Staff schedule
exports.getStaffSchedule = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const staffId = req.userId; // From authenticated staff
    const now = new Date();
    // Use local date instead of UTC to avoid timezone issues
    const currentDate = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0'); // "2025-07-15"
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + 
                       String(now.getMinutes()).padStart(2, '0'); // "00:26"
    
    console.log('Staff schedule query params:', {
      staffId,
      currentDate,
      currentTime,
      datetime: `${currentDate} ${currentTime}`
    });
    // Debug: Log the query and parameters
    console.log('[STAFF SCHEDULE] Query:', `\nSELECT b.id, b.customer_name, u.phone_number, s.name AS service_name, \n        b.time AS start_time, \n        DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(b.date, ' ', b.time), '%Y-%m-%d %H:%i'), \n                INTERVAL s.duration MINUTE), '%H:%i') AS end_time, b.status, b.payment_method\n FROM bookings b\n JOIN services s ON b.service_id = s.id\n LEFT JOIN users u ON b.user_id = u.id\n WHERE b.staff_id = ? AND DATE(b.date) = ? AND b.status NOT IN ('Cancelled', 'Completed')\n AND STR_TO_DATE(CONCAT(b.date, ' ', b.time), '%Y-%m-%d %H:%i') >= STR_TO_DATE(?, '%Y-%m-%d %H:%i')\n AND u.id IS NOT NULL\n AND (u.role = 'customer' OR u.role IN ('staff', 'manager'))\n ORDER BY b.time ASC\n LIMIT 4`);
    console.log('[STAFF SCHEDULE] Params:', staffId, currentDate, `${currentDate} ${currentTime}`);
    const [results] = await connection.query(
      `SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name, 
              b.time AS start_time, 
              DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(b.date, ' ', b.time), '%Y-%m-%d %H:%i'), 
                      INTERVAL s.duration MINUTE), '%H:%i') AS end_time, b.status, b.payment_method, u.role, u.id as user_id
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.staff_id = ? AND DATE(b.date) = ?
       AND STR_TO_DATE(CONCAT(b.date, ' ', b.time), '%Y-%m-%d %H:%i') >= STR_TO_DATE(?, '%Y-%m-%d %H:%i')
       AND u.id IS NOT NULL
       AND (
         u.role = 'customer'
         OR u.role IN ('staff', 'manager')
       )
       ORDER BY b.time ASC
       LIMIT 4`,
      [staffId, currentDate, `${currentDate} ${currentTime}`]
    );
    // Debug: Log the results
    console.log('[STAFF SCHEDULE] Results:', results);
    
    console.log('Raw query results:', results);
    const formattedResults = results.map((booking) => ({
      id: booking.id,
      customer_name: booking.customer_name || "-",
      phone_number: booking.phone_number
        ? `011-${booking.phone_number.slice(3).padEnd(7, "x")}`
        : "-",
      service_name: booking.service_name || "-",
      start_time: booking.start_time ? booking.start_time.slice(0, 5) : "-",
      end_time: booking.end_time || "-",
      status: booking.status || "-",
      payment_method: booking.payment_method || "-",
    }));
    console.log("Formatted results:", formattedResults);
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
          ]
    );
  } catch (err) {
    console.error("[STAFF SCHEDULE] ERROR:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Mark booking as done
exports.markBookingDone = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [booking] = await connection.query(
      "SELECT staff_id, date, time FROM bookings WHERE id = ?",
      [booking_id]
    );
    if (!booking.length)
      return res.status(404).json({ message: "Booking not found" });
    if (String(booking[0].staff_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const bookingDateTime = new Date(`${booking[0].date}T${booking[0].time}Z`);
    const now = new Date(); // Use actual current time
    if (bookingDateTime > now) {
      return res
        .status(400)
        .json({ message: "Cannot mark future booking as done" });
    }
    await connection.query(
      "UPDATE bookings SET status = 'Completed' WHERE id = ?",
      [booking_id]
    );
    
    // Get booking details for notification and payment check
    const [bookingDetails] = await connection.query(
      `SELECT b.*, s.name AS service_name, s.price AS service_price, u.fullname AS customer_name
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
      [booking_id]
    );
    
    await connection.commit();
    console.log("Booking marked as done:", booking_id);
    
    // Send notification after booking completion
    if (bookingDetails.length > 0) {
      setImmediate(async () => {
        try {
          await sendNotificationAfterBooking('complete', {
            id: booking_id,
            user_id: bookingDetails[0].user_id,
            staff_id: req.userId,
            service_name: bookingDetails[0].service_name,
            date: bookingDetails[0].date,
            customer_name: bookingDetails[0].customer_name || bookingDetails[0].customer_name
          });
        } catch (notificationError) {
          console.error('Error sending booking completion notification:', notificationError);
        }
      });
    }
    
    // Check if this is a pay at outlet booking with pending payment
    const bookingDetail = bookingDetails[0];
    const isPayAtOutlet = bookingDetail && bookingDetail.payment_method === 'Pay at Outlet';
    const isPendingPayment = bookingDetail && bookingDetail.payment_status === 'Pending';
    
    // Return response with payment information if applicable - only for Pay at Outlet
    if (isPayAtOutlet && isPendingPayment) {
      res.json({ 
        message: "Booking marked as done",
        showPaymentConfirmation: true,
        bookingId: booking_id,
        paymentMethod: bookingDetail.payment_method,
        paymentStatus: bookingDetail.payment_status,
        customerName: bookingDetail.customer_name || bookingDetail.fullname || "Customer",
        serviceName: bookingDetail.service_name,
        totalAmount: bookingDetail.service_price ? parseFloat(bookingDetail.service_price).toFixed(2) : "0.00",
        isWalkIn: !bookingDetail.user_id // If no user_id, it's a walk-in
      });
    } else {
      res.json({ message: "Booking marked as done" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error marking booking as done:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Mark booking as absent
exports.markBookingAbsent = async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id)
    return res.status(400).json({ message: "Booking ID required" });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [booking] = await connection.query(
      "SELECT staff_id, date, time FROM bookings WHERE id = ?",
      [booking_id]
    );
    if (!booking.length)
      return res.status(404).json({ message: "Booking not found" });
    if (String(booking[0].staff_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const bookingDateTime = new Date(`${booking[0].date}T${booking[0].time}Z`);
    const now = new Date(); // Use actual current time
    if (bookingDateTime > now) {
      return res
        .status(400)
        .json({ message: "Cannot mark future booking as absent" });
    }
    await connection.query(
      "UPDATE bookings SET status = 'Absent' WHERE id = ?",
      [booking_id]
    );
    
    // Get booking details for notification
    const [bookingDetails] = await connection.query(
      `SELECT b.*, s.name AS service_name, u.fullname AS customer_name
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
      [booking_id]
    );
    
    await connection.commit();
    console.log("Booking marked as absent:", booking_id);
    
    // Send notification after booking marked as absent
    if (bookingDetails.length > 0) {
      setImmediate(async () => {
        try {
          await sendNotificationAfterBooking('absent', {
            id: booking_id,
            user_id: bookingDetails[0].user_id,
            staff_id: req.userId,
            service_name: bookingDetails[0].service_name,
            date: bookingDetails[0].date,
            customer_name: bookingDetails[0].customer_name || bookingDetails[0].customer_name
          });
        } catch (notificationError) {
          console.error('Error sending booking absence notification:', notificationError);
        }
      });
    }
    
    res.json({ message: "Booking marked as absent" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error marking booking as absent:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get total appointments from yesterday
exports.getTotalAppointmentsYesterday = async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const yesterday = now.getFullYear() + '-' +
                      String(now.getMonth() + 1).padStart(2, '0') + '-' +
                      String(now.getDate()).padStart(2, '0');
    const [summary] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE date = ?`,
      [yesterday]
    );
    console.log("Fetched total appointments yesterday:", summary[0].count);
    res.json({ count: summary[0].count });
  } catch (err) {
    console.error("Error fetching total appointments yesterday:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get all appointments
exports.getAllAppointments = async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `SELECT b.id, b.customer_name, u.phone_number, s.name AS service,
              b.date, b.time AS start_time, 
              TIME_FORMAT(ADDTIME(b.time, SEC_TO_TIME(s.duration * 60)), '%H:%i') AS end_time,
              b.status, o.shortform AS outlet,
              u2.username, u2.fullname AS staffName, s.duration AS service_duration,
              b.service_id, b.staff_id, b.outlet_id, b.user_id
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN outlets o ON b.outlet_id = o.id
       LEFT JOIN users u ON b.user_id = u.id
       JOIN users u2 ON b.staff_id = u2.id
       WHERE s.id IS NOT NULL
       ORDER BY b.date DESC, b.time DESC`
    );
    console.log("Fetched all appointments:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching all appointments:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Manager reschedule appointment
exports.managerRescheduleAppointment = async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  
  const { id } = req.params;
  const { date, time } = req.body;
  
  if (!id || !date || !time) {
    return res.status(400).json({ message: "Appointment ID, date, and time required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Get appointment details
    const [appointment] = await connection.query(
      `SELECT b.*, s.name AS service_name, s.duration, u.username AS staff_name, u2.email, u2.phone_number
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       LEFT JOIN users u2 ON b.user_id = u2.id
       WHERE b.id = ?`,
      [id]
    );
    
    if (!appointment.length) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    const appointmentData = appointment[0];
    const slotStart = new Date(`${date}T${time}Z`);
    const operatingStart = new Date(`${date}T10:00:00Z`);
    const operatingEnd = new Date(`${date}T21:00:00Z`);
    
    if (slotStart < operatingStart || slotStart > operatingEnd) {
      return res.status(400).json({
        message: "Slot outside operating hours (10:00 AM - 9:00 PM UTC)",
      });
    }
    
    const duration = appointmentData.duration || 30;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    
    // Check for blocked times
    const [blockedTimes] = await connection.query(
      "SELECT start_time, end_time FROM blocked_times WHERE staff_id = ? AND date = ?",
      [appointmentData.staff_id, date]
    );
    
    const isBlocked = blockedTimes.some((bt) => {
      const blockStart = new Date(`${date}T${bt.start_time}Z`);
      const blockEnd = new Date(`${date}T${bt.end_time}Z`);
      return slotStart < blockEnd && slotEnd > blockStart;
    });
    
    if (isBlocked) {
      return res.status(400).json({
        message: "Staff not available due to blocked time",
      });
    }
    
    // Check for conflicts with other bookings (excluding current appointment)
    const [conflicts] = await connection.query(
      "SELECT id, time, service_id FROM bookings WHERE staff_id = ? AND date = ? AND id != ? AND status != 'Cancelled'",
      [appointmentData.staff_id, date, id]
    );
    
    const serviceIds = [...new Set(conflicts.map((c) => c.service_id))];
    const [conflictServices] = await connection.query(
      "SELECT id, duration FROM services WHERE id IN (?)",
      [serviceIds.length ? serviceIds : [0]]
    );
    
    const serviceDurationMap = conflictServices.reduce(
      (acc, s) => ({ ...acc, [s.id]: s.duration || 30 }),
      {}
    );
    
    const hasConflict = conflicts.some((c) => {
      const bookingStart = new Date(`${date}T${c.time}Z`);
      const bookingEnd = new Date(
        bookingStart.getTime() + (serviceDurationMap[c.service_id] || 30) * 60 * 1000
      );
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
    
    if (hasConflict) {
      return res.status(400).json({ message: "Slot already booked" });
    }
    
    // Update the appointment
    await connection.query(
      "UPDATE bookings SET date = ?, time = ? WHERE id = ?",
      [date, time, id]
    );
    
    // Create reschedule notification
    await connection.query(
      "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
      [
        id,
        "Reschedule",
        `Appointment #${id} rescheduled to ${formatDateForDb(date)} ${time} by manager`,
      ]
    );
    
    await connection.commit();
    console.log(`Manager rescheduled appointment ${id} to ${date} ${time}`);
    
    // Send notification emails/SMS in background
    setImmediate(async () => {
      try {
        const rescheduleDetails = {
          id: appointmentData.id,
          outlet: appointmentData.outlet || "-",
          service: appointmentData.service_name,
          date: formatDateForDb(date),
          time: time,
          customer_name: appointmentData.customer_name,
          staff_name: appointmentData.staff_name,
          price: 0, // Manager reschedule doesn't change price
        };
        
        // Send email if customer has email
        if (appointmentData.email && appointmentData.email !== "customer@huuksystem.com") {
          await retryOperation(() => sendRescheduleConfirmation(rescheduleDetails, appointmentData.email));
          console.log(`✅ Reschedule email sent for appointment #${id}`);
        }
        
        // Send SMS if customer has phone
        if (appointmentData.phone_number) {
          const smsResult = await sendRescheduleConfirmationSMS(rescheduleDetails, appointmentData.phone_number);
          if (smsResult.success) {
            console.log(`✅ Reschedule SMS sent for appointment #${id}`);
          } else {
            console.warn(`⚠️ Reschedule SMS failed for appointment #${id}:`, smsResult.message);
          }
        }
      } catch (notificationError) {
        console.error(`❌ Error sending reschedule notifications for appointment #${id}:`, notificationError);
      }
    });
    
    res.json({ 
      message: "Appointment rescheduled successfully", 
      newDate: date, 
      newTime: time 
    });
    
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error rescheduling appointment:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Manager cancel appointment
exports.managerCancelAppointment = async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ message: "Appointment ID required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Get appointment details
    const [appointment] = await connection.query(
      `SELECT b.*, s.name AS service_name, s.price, u.username AS staff_name, 
              o.shortform AS outlet_shortform, u2.email, u2.phone_number
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       JOIN outlets o ON b.outlet_id = o.id
       LEFT JOIN users u2 ON b.user_id = u2.id
       WHERE b.id = ?`,
      [id]
    );
    
    if (!appointment.length) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    const appointmentData = appointment[0];
    
    // Update appointment status to Cancelled
    await connection.query(
      "UPDATE bookings SET status = 'Cancelled' WHERE id = ?",
      [id]
    );
    
    // Create cancellation notification
    await connection.query(
      "INSERT INTO notifications (booking_id, type, message) VALUES (?, ?, ?)",
      [
        id,
        "Cancellation",
        `Appointment #${id} cancelled by manager on ${formatDateForDb(new Date())}`,
      ]
    );
    
    await connection.commit();
    console.log(`Manager cancelled appointment ${id}`);
    
    // Send notification emails/SMS in background
    setImmediate(async () => {
      try {
        const cancelDetails = {
          id: appointmentData.id,
          outlet: appointmentData.outlet_shortform,
          service: appointmentData.service_name,
          date: formatDateForDb(appointmentData.date),
          time: appointmentData.time,
          customer_name: appointmentData.customer_name,
          staff_name: appointmentData.staff_name,
          price: parseFloat(appointmentData.price) || 0,
          payment_method: appointmentData.payment_method === "Stripe" ? "Online Payment" : appointmentData.payment_method,
          payment_status: appointmentData.payment_status,
        };
        
        // Send email if customer has email
        if (appointmentData.email && appointmentData.email !== "customer@huuksystem.com") {
          await retryOperation(() => sendCancelConfirmation(cancelDetails, appointmentData.email));
          console.log(`✅ Cancellation email sent for appointment #${id}`);
        }
        
        // Send SMS if customer has phone
        if (appointmentData.phone_number) {
          const smsResult = await sendCancellationSMS(cancelDetails, appointmentData.phone_number);
          if (smsResult.success) {
            console.log(`✅ Cancellation SMS sent for appointment #${id}`);
          } else {
            console.warn(`⚠️ Cancellation SMS failed for appointment #${id}:`, smsResult.message);
          }
        }
      } catch (notificationError) {
        console.error(`❌ Error sending cancellation notifications for appointment #${id}:`, notificationError);
      }
    });
    
    // Send notification to affected parties
    setImmediate(async () => {
      try {
        await sendNotificationAfterBooking('cancel', {
          id: id,
          user_id: appointmentData.user_id,
          staff_id: appointmentData.staff_id,
          service_name: appointmentData.service_name,
          date: appointmentData.date,
          customer_name: appointmentData.customer_name
        });
      } catch (notificationError) {
        console.error('Error sending booking cancellation notification:', notificationError);
      }
    });
    
    res.json({ message: "Appointment cancelled successfully" });
    
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error cancelling appointment:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get total appointments today
exports.getTotalAppointmentsToday = async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const now = new Date();
    const today = now.getFullYear() + '-' +
                  String(now.getMonth() + 1).padStart(2, '0') + '-' +
                  String(now.getDate()).padStart(2, '0');
    const [summary] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE date = ?`,
      [today]
    );
    console.log("Fetched total appointments today:", summary[0].count);
    res.json({ count: summary[0].count });
  } catch (err) {
    console.error("Error fetching total appointments today:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get summary statistics for staff dashboard
exports.getStaffSummary = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    // Use local date instead of moment to avoid timezone issues
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    
    // For staff mode - filter by staff ID, for manager mode - get all bookings
    let query;
    let params;
    
    if (req.role === "staff") {
      query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM bookings 
        WHERE staff_id = ? AND date = ?
        GROUP BY status
      `;
      params = [req.userId, today];
    } else {
      // Manager mode - get all bookings for today
      query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM bookings 
        WHERE date = ?
        GROUP BY status
      `;
      params = [today];
    }
    
    const [results] = await connection.query(query, params);
    
    // Initialize counters
    const summary = {
      done: 0,
      pending: 0,
      cancelled: 0,
      rescheduled: 0,
      absent: 0
    };
    
    // Map database results to summary object
    results.forEach(row => {
      switch (row.status) {
        case 'Completed':
        case 'Done':
          summary.done += row.count;
          break;
        case 'Pending':
        case 'Confirmed':  // Include confirmed status as pending for display
          summary.pending += row.count;
          break;
        case 'Cancelled':
          summary.cancelled += row.count;
          break;
        case 'Rescheduled':
        case 'Reschedule':  // Handle both variations
          summary.rescheduled += row.count;
          break;
        case 'Absent':
          summary.absent += row.count;
          break;
        default:
          console.warn(`Unknown booking status encountered: ${row.status}`);
          break;
      }
    });
    
    console.log(`Fetched ${req.role} summary for today:`, summary);
    res.json(summary);
  } catch (err) {
    console.error("Error fetching summary statistics:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get today's appointments by all staff for bar chart
exports.getTodaysAppointmentsByStaff = async (req, res) => {
  if (!["staff", "manager"].includes(req.role)) {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    const today = moment().format("YYYY-MM-DD");
    
    // Get staff user info to check outlet
    const [userInfo] = await connection.query(
      "SELECT outlet_id FROM users WHERE id = ?",
      [req.userId]
    );
    
    if (!userInfo.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userOutletId = userInfo[0].outlet_id;
    
    // Get appointments by staff for today (filter by outlet for staff, all outlets for manager)
    let query;
    let params;
    
    if (req.role === "staff") {
      // For staff, only show appointments from their outlet
      query = `
        SELECT u.username AS staff_name, COUNT(b.id) AS appointment_count
        FROM users u
        LEFT JOIN bookings b ON u.id = b.staff_id AND b.date = ? AND b.status NOT IN ('Cancelled')
        WHERE u.role IN ('staff', 'manager') AND u.isApproved = 1 AND u.outlet_id = ?
        GROUP BY u.id, u.username
        HAVING appointment_count > 0
        ORDER BY appointment_count DESC
      `;
      params = [today, userOutletId];
    } else {
      // For manager, show all appointments across all outlets
      query = `
        SELECT u.username AS staff_name, COUNT(b.id) AS appointment_count
        FROM users u
        LEFT JOIN bookings b ON u.id = b.staff_id AND b.date = ? AND b.status NOT IN ('Cancelled')
        WHERE u.role IN ('staff', 'manager') AND u.isApproved = 1
        GROUP BY u.id, u.username
        HAVING appointment_count > 0
        ORDER BY appointment_count DESC
      `;
      params = [today];
    }
    
    const [results] = await connection.query(query, params);
    
    // Debug: Log raw results from database
    console.log(`🔍 Raw database results for ${req.role}:`, results);
    
    // Format data for chart
    const chartData = {
      labels: results.map(row => row.staff_name || 'Unknown'),
      data: results.map(row => row.appointment_count || 0)
    };
    
    // Debug: Log formatted chart data
    console.log(`📊 Formatted chart data for ${req.role}:`, chartData);
    console.log(`📋 Labels array:`, chartData.labels);
    
    res.json(chartData);
  } catch (err) {
    console.error("Error fetching today's appointments by staff:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get customer satisfaction ratings for manager dashboard
exports.getCustomerSatisfactionRatings = async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Get aggregated rating counts
    const [ratingCounts] = await connection.query(`
      SELECT 
        rating,
        COUNT(*) as count
      FROM reviews
      GROUP BY rating
      ORDER BY rating ASC
    `);
    
    // Initialize the response data with all ratings from 1-5
    const satisfactionData = [
      { rating: "1 ★", count: 0 },
      { rating: "2 ★", count: 0 },
      { rating: "3 ★", count: 0 },
      { rating: "4 ★", count: 0 },
      { rating: "5 ★", count: 0 }
    ];
    
    // Fill in actual counts from database
    ratingCounts.forEach(row => {
      const ratingIndex = row.rating - 1; // Convert 1-5 to 0-4 for array index
      if (ratingIndex >= 0 && ratingIndex < 5) {
        satisfactionData[ratingIndex].count = row.count;
      }
    });
    
    console.log("Fetched customer satisfaction ratings:", satisfactionData);
    res.json(satisfactionData);
  } catch (err) {
    console.error("Error fetching customer satisfaction ratings:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get booking history by phone number
exports.getBookingsByPhone = async (req, res) => {
  const { phoneNumber } = req.params;
  
  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log(`📱 [BOOKING HISTORY] Searching for bookings with phone number: ${phoneNumber}`);
    
    // Search for bookings where the user's phone number matches
    // Note: bookings table doesn't have phone_number column, only users table does
    const [results] = await connection.query(
      `
      SELECT DISTINCT
        b.id, 
        b.date, 
        b.time AS start_time, 
        b.customer_name, 
        b.status, 
        b.payment_status, 
        b.payment_method,
        b.created_at,
        o.shortform AS outlet_shortform, 
        s.name AS service_name, 
        s.price, 
        s.duration AS service_duration, 
        u.username AS staff_name,
        u2.phone_number AS phone_number
      FROM bookings b
      JOIN outlets o ON b.outlet_id = o.id
      JOIN services s ON b.service_id = s.id
      JOIN users u ON b.staff_id = u.id
      LEFT JOIN users u2 ON b.user_id = u2.id
      WHERE u2.phone_number = ?
        AND b.status NOT IN ('Cancelled')
      ORDER BY b.date DESC, b.time DESC
      LIMIT 10
      `,
      [phoneNumber]
    );
    
    console.log(`📱 [BOOKING HISTORY] Found ${results.length} bookings for phone: ${phoneNumber}`);
    
    // Transform the results to match the expected format
    const transformedResults = results.map((booking) => ({
      ...booking,
      payment_method:
        booking.payment_method === "Stripe"
          ? "Online Payment"
          : booking.payment_method,
    }));
    
    res.json(transformedResults);
  } catch (err) {
    console.error("❌ [BOOKING HISTORY] Error fetching bookings by phone:", {
      message: err.message,
      stack: err.stack,
      phoneNumber: phoneNumber
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Get appointments by user ID
exports.getAppointmentsByUserId = async (req, res) => {
  const { userId } = req.params;
  const { limit = 10 } = req.query;
  
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log(`[APPOINTMENTS BY USER] Getting appointments for user ID: ${userId}`);
    
    // Get user's booking history
    const [results] = await connection.query(
      `
      SELECT 
        b.id, 
        b.date as booking_date, 
        b.time AS start_time, 
        b.customer_name, 
        b.status, 
        b.payment_status, 
        b.payment_method,
        b.created_at,
        o.shortform AS outlet_shortform, 
        s.name AS service_name, 
        s.price, 
        s.duration AS service_duration, 
        u.username AS staff_name
      FROM bookings b
      JOIN outlets o ON b.outlet_id = o.id
      JOIN services s ON b.service_id = s.id
      JOIN users u ON b.staff_id = u.id
      WHERE b.user_id = ?
        AND b.status NOT IN ('Cancelled')
      ORDER BY b.date DESC, b.time DESC
      LIMIT ?
      `,
      [userId, parseInt(limit)]
    );
    
    console.log(`[APPOINTMENTS BY USER] Found ${results.length} appointments for user: ${userId}`);
    
    // Transform the results to match the expected format
    const transformedResults = results.map((booking) => ({
      ...booking,
      payment_method:
        booking.payment_method === "Stripe"
          ? "Online Payment"
          : booking.payment_method,
    }));
    
    res.json({ appointments: transformedResults });
  } catch (err) {
    console.error("[APPOINTMENTS BY USER] Error fetching appointments:", {
      message: err.message,
      stack: err.stack,
      userId: userId
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// Public: fetch bookings for a date and outlet (for time slot filtering)
exports.getBookingsForDateOutlet = async (req, res) => {
  const { date, outlet_id } = req.query;
  if (!date || !outlet_id) {
    return res.status(400).json({ message: "date and outlet_id are required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [bookings] = await connection.query(
      `SELECT b.id, b.staff_id, b.time, b.service_id, s.duration AS service_duration, b.customer_name, b.status
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ? AND b.outlet_id = ? AND b.status != 'Cancelled'`,
      [date, outlet_id]
    );
    res.json(bookings);
  } catch (err) {
    console.error("Error fetching bookings for date/outlet:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// New endpoint to associate a user with a guest booking
exports.claimGuestBooking = async (req, res) => {
  const { booking_id } = req.params;
  const { userId } = req; // From verifyToken middleware

  if (!booking_id || !userId) {
    return res.status(400).json({ message: "Booking ID and User ID are required." });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // First, check if the booking exists and is a guest booking (user_id is NULL)
    const [booking] = await connection.query(
      "SELECT * FROM bookings WHERE id = ? AND user_id IS NULL",
      [booking_id]
    );

    if (booking.length === 0) {
      return res.status(404).json({ message: "Guest booking not found or already claimed." });
    }

    // Update the booking with the new user's ID
    const [updateResult] = await connection.query(
      "UPDATE bookings SET user_id = ? WHERE id = ?",
      [userId, booking_id]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Failed to claim booking.");
    }

    res.json({ message: "Booking successfully claimed by user." });
  } catch (error) {
    console.error("Error claiming guest booking:", error);
    res.status(500).json({ message: "Server error while claiming booking." });
  } finally {
    if (connection) connection.release();
  }
};

