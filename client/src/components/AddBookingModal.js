import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import moment from "moment-timezone";
import { API_BASE_URL } from "../utils/constants";
import {
  getAvailableServicesForSlot,
  calculateAvailableSlotDuration,
  formatDuration,
} from "../utils/timeSlotUtils";
import { fetchBookingsByPhone } from "../utils/api";
import { debugLog } from "../utils/debugLog";
import "./AddBookingModal.css";

// Malaysia timezone constant
const MALAYSIA_TZ = "Asia/Kuala_Lumpur";

const AddBookingModal = ({
  isOpen,
  onClose,
  selectedSlot,
  onSubmit,
  currentUser,
  timeSlots = [],
  bookings = [],
  blockedSlots = [],
  disableDynamicTimeLogic = false, // New prop to disable dynamic time logic for StaffSchedule
}) => {
  const modalRef = useRef();
  const [formData, setFormData] = useState({
    service: "",
    customerName: "",
    phoneNumber: "",
    selectedTime: "",
  });
  const [allServices, setAllServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [isWalkInOverride, setIsWalkInOverride] = useState(false);
  const [walkInMessage, setWalkInMessage] = useState("");
  const [showOverrideConfirmation, setShowOverrideConfirmation] =
    useState(false);
  const [overrideConfirmationData, setOverrideConfirmationData] =
    useState(null);
  const [slotAvailabilityMessage, setSlotAvailabilityMessage] = useState("");

  // Booking history state
  const [bookingHistory, setBookingHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Service caching to prevent redundant API calls
  const servicesCache = useRef(new Map());
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

  // Phone lookup debouncing
  const phoneDebounceRef = useRef(null);

  // Simplified time selection with Malaysia timezone
  const getSmartTimeSelection = () => {
    if (!selectedSlot?.time || !timeSlots.length) return "";

    // Use Malaysia time consistently
    const currentMalaysiaTime = moment.tz(MALAYSIA_TZ);
    const selectedDate = selectedSlot.day?.date || selectedSlot.date;
    const today = currentMalaysiaTime.format("YYYY-MM-DD");

    // If disabled dynamic logic or not today, return original time
    if (disableDynamicTimeLogic || selectedDate !== today) {
      return selectedSlot.time || "";
    }

    // For today - find next available slot after 30 minutes
    const next30Min = currentMalaysiaTime.clone().add(30, "minutes");
    const nextSlotTime = next30Min
      .minute(next30Min.minute() < 30 ? 30 : 0)
      .second(0);
    if (next30Min.minute() >= 30) nextSlotTime.add(1, "hour");

    const nextTimeString = nextSlotTime.format("HH:mm");

    // Find first available slot at or after calculated time
    for (const slot of timeSlots) {
      if (slot >= nextTimeString && !isSlotTaken(slot, selectedDate)) {
        return slot;
      }
    }

    return selectedSlot.time || timeSlots[0] || "";
  };

  // Real-time walk-in slot selection logic
  const getWalkInTimeSlot = (currentTime, today) => {
    // Snap to nearest lower 30-min slot
    const snapTime = snapToNearest30MinSlot(currentTime);

    // Check if the snapped slot is available and has sufficient remaining time
    if (isSlotUsableForWalkIn(snapTime, currentTime, today)) {
      return snapTime;
    }

    // If snapped slot is not usable, find next available slot
    return findNextAvailableWalkInSlot(currentTime, today);
  };

  // Snap current time to nearest lower 30-minute slot
  const snapToNearest30MinSlot = (currentTime) => {
    const minutes = currentTime.minutes();
    const hours = currentTime.hours();

    // Snap to lower 30-min boundary (e.g., 15:13 -> 15:00)
    const snappedMinutes = minutes < 30 ? 0 : 30;
    const snapTime = moment()
      .hours(hours)
      .minutes(snappedMinutes)
      .format("HH:mm");

    // Ensure the snapped time exists in our time slots
    if (timeSlots.includes(snapTime)) {
      return snapTime;
    }

    // If exact snap time doesn't exist, find the closest earlier slot
    const snapMoment = moment(snapTime, "HH:mm");
    for (let i = timeSlots.length - 1; i >= 0; i--) {
      const slotMoment = moment(timeSlots[i], "HH:mm");
      if (slotMoment.isSameOrBefore(snapMoment)) {
        return timeSlots[i];
      }
    }

    return timeSlots[0]; // Fallback to first slot
  };

  // Check if a slot is usable for walk-in booking
  const isSlotUsableForWalkIn = (slotTime, currentTime, date) => {
    const slotMoment = moment(slotTime, "HH:mm");
    const timeDiffMinutes = currentTime.diff(slotMoment, "minutes");

    // If slot is already taken, not usable
    if (isSlotTaken(slotTime, date)) {
      return false;
    }

    // If current time is before slot start, it's usable
    if (timeDiffMinutes <= 0) {
      return true;
    }

    // If slot is partially passed but within first 10-15 minutes, still usable with override
    if (timeDiffMinutes <= 15) {
      const remainingDuration = getRemainingSlotDuration(
        slotTime,
        currentTime,
        date,
      );
      return remainingDuration >= 15; // At least 15 minutes remaining for a meaningful service
    }

    return false; // Slot is too far passed
  };

  // Get remaining duration in a time slot
  const getRemainingSlotDuration = (slotTime, currentTime, date) => {
    const slotIndex = timeSlots.indexOf(slotTime);
    if (slotIndex === -1) return 0;

    const nextSlotTime = timeSlots[slotIndex + 1];
    if (!nextSlotTime) return 30; // Default to 30 min if no next slot

    const slotStart = moment(slotTime, "HH:mm");
    const slotEnd = moment(nextSlotTime, "HH:mm");
    const totalSlotDuration = slotEnd.diff(slotStart, "minutes");
    const elapsedTime = currentTime.diff(slotStart, "minutes");

    return Math.max(0, totalSlotDuration - elapsedTime);
  };

  // Find next available slot for walk-in
  const findNextAvailableWalkInSlot = (currentTime, date) => {
    for (const slot of timeSlots) {
      const slotMoment = moment(slot, "HH:mm");

      // Only consider future slots or current slots with sufficient remaining time
      if (
        slotMoment.isAfter(currentTime) ||
        isSlotUsableForWalkIn(slot, currentTime, date)
      ) {
        if (!isSlotTaken(slot, date)) {
          return slot;
        }
      }
    }

    return timeSlots[0]; // Fallback
  };

  // Check if a time slot is taken
  const isSlotTaken = (time, date) => {
    // Check bookings
    const isBooked = bookings.some((booking) => {
      if (
        !booking ||
        booking.status === "cancelled" ||
        booking.status === "Cancelled"
      ) {
        return false;
      }

      // Handle different date field names and formats
      const bookingDateRaw = booking.booking_date || booking.date;
      if (!bookingDateRaw) return false;

      const bookingDate = extractDateOnly(bookingDateRaw);

      // Handle different time field names - prioritize start_time
      const bookingTime = booking.start_time || booking.time;
      if (!bookingTime) {
        return false;
      }

      if (bookingDate !== date) return false;

      const bookingStart = moment(bookingTime, "HH:mm");
      if (!bookingStart.isValid()) {
        return false;
      }

      const slotTime = moment(time, "HH:mm");

      // If we don't have end_time, calculate it from duration
      if (!booking.end_time && booking.duration) {
        const calculatedEnd = bookingStart
          .clone()
          .add(booking.duration, "minutes");
        const overlap = slotTime.isBetween(
          bookingStart,
          calculatedEnd,
          null,
          "[)",
        );
        if (overlap) {
          debugLog(
            `Slot ${time} is booked: ${booking.service || "Service"} for ${booking.customer_name || "Customer"} (${bookingTime}-${calculatedEnd.format("HH:mm")})`,
          );
        }
        return overlap;
      }

      // If we have end_time, use it
      if (booking.end_time) {
        const bookingEnd = moment(booking.end_time, "HH:mm");
        const overlap = slotTime.isBetween(
          bookingStart,
          bookingEnd,
          null,
          "[)",
        );
        if (overlap) {
          debugLog(
            `Slot ${time} is booked: ${booking.service || "Service"} for ${booking.customer_name || "Customer"} (${bookingTime}-${booking.end_time})`,
          );
        }
        return overlap;
      }

      // Fallback: assume 30-minute slot if no duration or end_time
      const calculatedEnd = bookingStart.clone().add(30, "minutes");
      const overlap = slotTime.isBetween(
        bookingStart,
        calculatedEnd,
        null,
        "[)",
      );
      if (overlap) {
        debugLog(
          `Slot ${time} is booked: ${booking.service || "Service"} for ${booking.customer_name || "Customer"} (${bookingTime}-${calculatedEnd.format("HH:mm")})`,
        );
      }
      return overlap;
    });

    // Check blocked slots with enhanced detection for various formats
    const isBlocked = blockedSlots.some((slot) => {
      // Log the slot structure to debug
      debugLog(
        "Checking blocked slot:",
        slot,
        "against time:",
        time,
        "date:",
        date,
      );

      // Case 1: Simple time string
      if (typeof slot === "string") {
        const isMatch = slot === time;
        if (isMatch) debugLog(`Slot ${time} is blocked (string match)`);
        return isMatch;
      }

      // Case 2: Object with time property only
      if (slot.time && !slot.date && !slot.day) {
        const isMatch = slot.time === time;
        if (isMatch) debugLog(`Slot ${time} is blocked (time-only match)`);
        return isMatch;
      }

      // Case 3: Object with time and date
      if (slot.time && slot.date) {
        const blockedDate = extractDateOnly(slot.date);
        const isMatch = slot.time === time && blockedDate === date;
        if (isMatch)
          debugLog(`Slot ${time} is blocked on ${date} (time+date match)`);
        return isMatch;
      }

      // Case 4: Object with time and day display
      if (slot.time && slot.day) {
        // Get day display for the selected date
        const selectedDate = moment(date);
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayDisplay = `${dayNames[selectedDate.day()]} ${selectedDate.date()}`;

        // Check if day display matches and time matches
        const isMatch = slot.time === time && slot.day === dayDisplay;
        if (isMatch)
          debugLog(`Slot ${time} is blocked on ${dayDisplay} (time+day match)`);
        return isMatch;
      }

      return false;
    });

    if (isBooked) debugLog(`Slot ${time} on ${date} is BOOKED`);
    if (isBlocked) debugLog(`Slot ${time} on ${date} is BLOCKED`);

    return isBooked || isBlocked;
  };

  // Extract date from booking date (helper function)
  const extractDateOnly = (dateValue) => {
    if (!dateValue) return null;

    // If already in YYYY-MM-DD format, return as-is
    if (
      typeof dateValue === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    // Handle ISO date strings with timezone (e.g., "2025-07-16T16:00:00.000Z")
    if (typeof dateValue === "string" && dateValue.includes("T")) {
      // Extract only the date part from UTC string to avoid timezone conversion issues
      return dateValue.split("T")[0];
    }

    // Handle Date objects
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, "0");
      const day = String(dateValue.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // Try to parse as date if it's another string format
    try {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Error parsing date
      return null;
    }

    return null;
  };

  // Check and set walk-in override status with appropriate message
  const checkAndSetWalkInOverride = (
    selectedTime,
    snapTime,
    currentTime,
    selectedDate,
  ) => {
    const slotMoment = moment(selectedTime, "HH:mm");
    const timeDiffMinutes = currentTime.diff(slotMoment, "minutes");

    // If slot is in the past but still being used (override scenario)
    if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
      const remainingDuration = getRemainingSlotDuration(
        selectedTime,
        currentTime,
        selectedDate,
      );
      if (remainingDuration >= 15) {
        setIsWalkInOverride(true);
        setWalkInMessage(
          `Walk-in Override: Slot started ${timeDiffMinutes} minutes ago, ${remainingDuration} minutes remaining`,
        );
        return;
      }
    }

    // If we snapped to a different time than originally selected
    if (
      selectedTime !== snapTime &&
      selectedTime === snapToNearest30MinSlot(currentTime)
    ) {
      setIsWalkInOverride(true);
      setWalkInMessage(
        `Time snapped to nearest 30-min slot for walk-in booking`,
      );
      return;
    }

    // Reset if no override needed
    setIsWalkInOverride(false);
    setWalkInMessage("");
  };

  // Find next available time slot with smart snapping
  const findNextAvailableSlot = (startTime, date) => {
    const currentTime = moment();
    const today = moment().format("YYYY-MM-DD");
    const startIndex = timeSlots.indexOf(startTime);

    // If startTime is not in our slot list, start from beginning
    const searchStartIndex = startIndex === -1 ? 0 : startIndex;

    for (let i = searchStartIndex; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      const slotMoment = moment(slot, "HH:mm");

      // For today's bookings, apply time-based logic
      if (date === today) {
        const timeDifference = slotMoment.diff(currentTime, "minutes");

        // For slots within 15 minutes, snap to them if available
        if (timeDifference <= 15) {
          if (!isSlotTaken(slot, date)) {
            return slot;
          }
        }
        // For slots more than 15 minutes away, use them if available
        else if (!isSlotTaken(slot, date)) {
          return slot;
        }
      }
      // For future dates, just check availability
      else if (!isSlotTaken(slot, date)) {
        return slot;
      }
    }

    // If no available slot found after startTime, return the first available slot
    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      if (!isSlotTaken(slot, date)) {
        return slot;
      }
    }

    // If all slots are taken, return the original time
    return startTime;
  };

  // Optimized service fetching with better caching
  const fetchServicesForSlot = useCallback(
    async (maxDuration = null) => {
      const cacheKey = `services_${maxDuration || "all"}`;

      // Check cache first
      const cachedData = servicesCache.current.get(cacheKey);
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        setAllServices(cachedData.data);
        return;
      }

      // Prevent multiple simultaneous requests
      if (loadingServices) {
        return;
      }

      setLoadingServices(true);
      try {
        const staffUser = JSON.parse(
          localStorage.getItem("staff_loggedInUser") || "{}",
        );
        const token = staffUser.token || localStorage.getItem("token");

        if (!token) {
          setAllServices([]);
          return;
        }

        const params = new URLSearchParams();
        if (maxDuration && maxDuration > 0) {
          params.append("maxDuration", maxDuration.toString());
        }

        const apiUrl = `${API_BASE_URL}/users/services${params.toString() ? `?${params.toString()}` : ""}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          // Ensure data is an array
          const servicesArray = Array.isArray(data) ? data : [];

          // Cache the response
          servicesCache.current.set(cacheKey, {
            data: servicesArray,
            timestamp: Date.now(),
          });

          setAllServices(servicesArray);
        } else {
          setAllServices([]);
        }
      } catch (error) {
        if (error.name === "AbortError") {
        } else {
        }
        setAllServices([]);
      } finally {
        setLoadingServices(false);
      }
    },
    [loadingServices],
  );

  // Fetch all services (fallback method)
  const fetchAllServices = useCallback(async () => {
    await fetchServicesForSlot();
  }, [fetchServicesForSlot]);

  // Fetch booking history by phone number with debouncing
  const lookupBookingHistory = useCallback(
    async (phoneNumber) => {
      if (!phoneNumber || phoneNumber.length < 6) {
        setBookingHistory([]);
        setShowHistory(false);
        return;
      }

      setLoadingHistory(true);
      try {
        const response = await fetchBookingsByPhone(phoneNumber);

        if (response && response.bookings) {
          setBookingHistory(response.bookings);
          setShowHistory(response.bookings.length > 0);

          // Auto-fill customer name if we have booking history and current name is empty
          if (response.bookings.length > 0 && !formData.customerName) {
            const latestBooking = response.bookings[0];
            if (latestBooking.customer_name || latestBooking.name) {
              setFormData((prev) => ({
                ...prev,
                customerName: latestBooking.customer_name || latestBooking.name,
              }));
            }
          }
        } else {
          setBookingHistory([]);
          setShowHistory(false);
        }
      } catch (error) {
        setBookingHistory([]);
        setShowHistory(false);
      } finally {
        setLoadingHistory(false);
      }
    },
    [formData.customerName],
  );

  // Enhanced phone lookup with user detection
  const lookupCustomerByPhone = useCallback(async (phoneNumber) => {
    if (!phoneNumber || phoneNumber.length < 6) {
      setBookingHistory([]);
      setShowHistory(false);
      setFormData((prev) => ({ ...prev, customerName: "" }));
      return;
    }

    setLoadingHistory(true);
    try {
      const staffUser = JSON.parse(
        localStorage.getItem("staff_loggedInUser") || "{}",
      );
      const token = staffUser.token || localStorage.getItem("token");

      // First try to find user by phone
      const userResponse = await fetch(
        `${API_BASE_URL}/users/by-phone/${phoneNumber}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user) {
          // Auto-fill customer name
          setFormData((prev) => ({
            ...prev,
            customerName: userData.user.name || prev.customerName,
          }));

          // Fetch booking history
          const historyResponse = await fetch(
            `${API_BASE_URL}/bookings/by-phone/${phoneNumber}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            const bookings = Array.isArray(historyData.bookings)
              ? historyData.bookings
              : [];
            setBookingHistory(bookings);
            setShowHistory(bookings.length > 0);
          }
        }
      } else {
        // New customer
        setBookingHistory([]);
        setShowHistory(false);
      }
    } catch (error) {
      setBookingHistory([]);
      setShowHistory(false);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Debounced phone lookup effect
  useEffect(() => {
    if (phoneDebounceRef.current) {
      clearTimeout(phoneDebounceRef.current);
    }

    if (!formData.phoneNumber) {
      setBookingHistory([]);
      setShowHistory(false);
      return;
    }

    phoneDebounceRef.current = setTimeout(() => {
      lookupCustomerByPhone(formData.phoneNumber);
    }, 600); // Reduced debounce time

    return () => {
      if (phoneDebounceRef.current) {
        clearTimeout(phoneDebounceRef.current);
      }
    };
  }, [formData.phoneNumber, lookupCustomerByPhone]);

  // Check consecutive slot availability for service filtering
  const getConsecutiveAvailableSlots = useCallback(
    (startTime, date) => {
      if (!startTime || !timeSlots.length) {
        debugLog("No start time or time slots provided");
        return 0;
      }

      const startIndex = timeSlots.indexOf(startTime);
      if (startIndex === -1) {
        debugLog(`Start time ${startTime} not found in time slots`);
        return 0;
      }

      // Log the blocked slots for this date to help debug
      debugLog(
        "Blocked slots for date",
        date,
        ":",
        blockedSlots.map((slot) => {
          if (typeof slot === "string") return slot;
          return slot.time;
        }),
      );

      let consecutiveCount = 0;
      let availableSlots = [];

      // Check current slot and subsequent slots
      for (let i = startIndex; i < timeSlots.length; i++) {
        const currentSlot = timeSlots[i];

        // Check if this slot is available (not booked or blocked)
        const slotTaken = isSlotTaken(currentSlot, date);

        if (slotTaken) {
          // Stop counting if we hit an unavailable slot
          debugLog(
            `Slot ${currentSlot} is taken - stopping count at ${consecutiveCount} slots`,
          );
          break;
        }

        // This slot is available
        consecutiveCount++;
        availableSlots.push(currentSlot);

        // For real-time bookings, also check if we have enough remaining time in partially passed slots
        if (i === startIndex) {
          const today = moment().format("YYYY-MM-DD");
          if (date === today) {
            const currentTime = moment();
            const slotMoment = moment(currentSlot, "HH:mm");
            const timeDiffMinutes = currentTime.diff(slotMoment, "minutes");

            // If slot has started but less than 15 minutes have passed
            if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
              const remainingDuration = getRemainingSlotDuration(
                currentSlot,
                currentTime,
                date,
              );
              // If less than 20 minutes remaining, this slot can't support full 30-min services
              if (remainingDuration < 20) {
                debugLog(
                  `Slot ${currentSlot} has insufficient remaining time (${remainingDuration} min)`,
                );
                return 0; // Not enough time even for shortest service
              }
            }
          }
        }
      }

      // Log available slots for debugging
      if (consecutiveCount > 0) {
        debugLog(
          `Available slots from ${startTime} on ${date}: ${availableSlots.join(", ")} (${consecutiveCount} slots)`,
        );
      } else {
        debugLog(`No available slots from ${startTime} on ${date}`);
      }

      return consecutiveCount;
    },
    [timeSlots, bookings, blockedSlots, isSlotTaken, getRemainingSlotDuration],
  );

  // Calculate maximum service duration based on consecutive available slots
  const getMaxServiceDuration = useCallback(
    (startTime, date) => {
      const consecutiveSlots = getConsecutiveAvailableSlots(startTime, date);

      if (consecutiveSlots === 0) {
        return 0;
      }

      // Calculate actual available minutes based on consecutive slots
      const maxMinutes = consecutiveSlots * 30;

      return maxMinutes;
    },
    [getConsecutiveAvailableSlots],
  );

  // Fetch services when component mounts
  useEffect(() => {
    fetchAllServices();
  }, [fetchAllServices]);

  // Reset form when modal opens/closes and refetch services when slot changes
  useEffect(() => {
    if (isOpen) {
      const previousActiveElement = document.activeElement;
      modalRef.current.focus();
      return () => {
        if (previousActiveElement) previousActiveElement.focus();
      };
    }
  }, [isOpen]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen && selectedSlot && timeSlots.length > 0) {
      let smartTime = selectedSlot.time || "";
      const selectedDate = selectedSlot.day?.date || selectedSlot.date;
      const today = moment().format("YYYY-MM-DD");
      const currentTime = moment();

      // Reset override states
      setIsWalkInOverride(false);
      setWalkInMessage("");

      // If dynamic time logic is disabled (e.g., from StaffSchedule), use the exact time
      if (disableDynamicTimeLogic) {
        smartTime = selectedSlot.time || "";
        // When disableDynamicTimeLogic is true, always use the exact clicked time
        // Don't automatically change to next available slot - let the user decide
      }
      // If dynamic time logic is enabled (default behavior for walk-in bookings)
      else {
        // If no time is provided, find the best available slot
        if (!smartTime) {
          // Use walk-in logic for today, regular logic for future dates
          if (selectedDate === today) {
            const snapTime = snapToNearest30MinSlot(currentTime);
            smartTime = getWalkInTimeSlot(currentTime, today);

            // Check if we're using an override scenario
            checkAndSetWalkInOverride(
              smartTime,
              snapTime,
              currentTime,
              selectedDate,
            );
          } else {
            // For future dates, use first available slot
            for (const timeSlot of timeSlots) {
              if (!isSlotTaken(timeSlot, selectedDate)) {
                smartTime = timeSlot;
                break;
              }
            }
            smartTime = smartTime || timeSlots[0];
          }
        }
        // If a specific time was provided, validate and potentially snap it
        else {
          // If it's today, use walk-in validation logic
          if (selectedDate === today) {
            const slotMoment = moment(smartTime, "HH:mm");
            const timeDifference = slotMoment.diff(currentTime, "minutes");

            // If the slot is significantly in the past or taken, use walk-in logic
            if (timeDifference < -15 || isSlotTaken(smartTime, selectedDate)) {
              const snapTime = snapToNearest30MinSlot(currentTime);
              smartTime = getWalkInTimeSlot(currentTime, today);
              checkAndSetWalkInOverride(
                smartTime,
                snapTime,
                currentTime,
                selectedDate,
              );
            }
            // If slot is slightly in the past but still usable, keep it if available
            else if (
              !isSlotUsableForWalkIn(smartTime, currentTime, selectedDate)
            ) {
              const snapTime = snapToNearest30MinSlot(currentTime);
              smartTime = getWalkInTimeSlot(currentTime, today);
              checkAndSetWalkInOverride(
                smartTime,
                snapTime,
                currentTime,
                selectedDate,
              );
            }
            // If slot is usable, still check if it requires override
            else {
              checkAndSetWalkInOverride(
                smartTime,
                smartTime,
                currentTime,
                selectedDate,
              );
            }
          }
          // For future dates, just validate availability
          else if (isSlotTaken(smartTime, selectedDate)) {
            smartTime = findNextAvailableSlot(smartTime, selectedDate);
          }
        }
      }

      setFormData({
        service: "",
        customerName: "",
        phoneNumber: "",
        selectedTime: smartTime,
      });

      // Refetch services when slot changes to ensure we have latest data
      if (allServices.length === 0) {
        fetchAllServices();
      }
    }
  }, [
    isOpen,
    selectedSlot,
    timeSlots.length,
    fetchAllServices,
    allServices.length,
  ]);

  // Keep selected time in sync with live bookings/blocked slots updates.
  useEffect(() => {
    if (
      !isOpen ||
      !selectedSlot ||
      !formData.selectedTime ||
      timeSlots.length === 0
    ) {
      return;
    }

    const selectedDate = selectedSlot.day?.date || selectedSlot.date;
    if (!selectedDate) {
      return;
    }

    if (!isSlotTaken(formData.selectedTime, selectedDate)) {
      setSlotAvailabilityMessage("");
      return;
    }

    const fallbackTime = findNextAvailableSlot(
      formData.selectedTime,
      selectedDate,
    );
    if (
      fallbackTime &&
      fallbackTime !== formData.selectedTime &&
      !isSlotTaken(fallbackTime, selectedDate)
    ) {
      setFormData((prev) => ({ ...prev, selectedTime: fallbackTime }));
      setSlotAvailabilityMessage(
        `Selected slot is no longer available. Switched to ${fallbackTime}.`,
      );
      return;
    }

    setFormData((prev) => ({ ...prev, selectedTime: "" }));
    setSlotAvailabilityMessage(
      "Selected slot is no longer available. Please choose another slot.",
    );
  }, [
    isOpen,
    selectedSlot,
    formData.selectedTime,
    bookings,
    blockedSlots,
    timeSlots,
  ]);

  // Debounced service fetching to prevent excessive API calls
  const debouncedFetchServicesRef = useRef(null);

  // Dynamically refetch services when time changes to get duration-filtered services
  useEffect(() => {
    if (formData.selectedTime && selectedSlot?.day?.date) {
      const selectedDate = selectedSlot.day?.date || selectedSlot.date;
      const maxDuration = getMaxServiceDuration(
        formData.selectedTime,
        selectedDate,
      );
      const currentOutlet = currentUser?.outlet || "SCM";

      // Clear any pending debounced fetch
      if (debouncedFetchServicesRef.current) {
        clearTimeout(debouncedFetchServicesRef.current);
      }

      // Debounce the service fetching by 300ms to prevent rapid successive calls
      debouncedFetchServicesRef.current = setTimeout(() => {
        // Only refetch if we have a meaningful max duration
        if (maxDuration > 0) {
          fetchServicesForSlot(maxDuration);
        } else {
          // If no duration available, fetch all services
          fetchServicesForSlot();
        }
      }, 300); // 300ms debounce delay
    }

    // Cleanup timeout on unmount
    return () => {
      if (debouncedFetchServicesRef.current) {
        clearTimeout(debouncedFetchServicesRef.current);
      }
    };
  }, [
    formData.selectedTime,
    selectedSlot?.day?.date,
    selectedSlot?.date,
    currentUser?.outlet,
    fetchServicesForSlot,
    getMaxServiceDuration,
  ]);

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Check if current submission requires override confirmation
  const requiresOverrideConfirmation = () => {
    const selectedDate = selectedSlot.day?.date || selectedSlot.date;
    const today = moment().format("YYYY-MM-DD");

    // Only check for today's bookings
    if (selectedDate !== today) return false;

    const currentTime = moment();
    const selectedTime = formData.selectedTime;
    const slotMoment = moment(selectedTime, "HH:mm");
    const timeDiffMinutes = currentTime.diff(slotMoment, "minutes");

    // If slot is in the past but within override range (0-15 minutes)
    return timeDiffMinutes > 0 && timeDiffMinutes <= 15;
  };

  // Handle override confirmation
  const handleOverrideConfirm = () => {
    setShowOverrideConfirmation(false);
    if (onSubmit && overrideConfirmationData) {
      onSubmit(overrideConfirmationData);
    }
    setOverrideConfirmationData(null);
  };

  // Handle override cancel
  const handleOverrideCancel = () => {
    setShowOverrideConfirmation(false);
    setOverrideConfirmationData(null);
  };

  // Enhanced form submission with comprehensive debugging
  const handleSubmit = (e) => {
    e.preventDefault();

    // === STEP 1: VALIDATION ===
    const errors = [];

    // Service validation
    const serviceId = parseInt(formData.service);
    const serviceExists = availableServices.some(
      (service) => service.id === serviceId,
    );

    if (
      !formData.service ||
      formData.service === "" ||
      formData.service === "0"
    ) {
      errors.push("Please select a valid service");
    } else if (!serviceExists && availableServices.length > 0) {
      errors.push("Selected service is not available for this time slot");
    }

    // Customer name validation - enhanced with minimum length check
    if (!formData.customerName?.trim()) {
      errors.push("Customer name is required");
    } else if (formData.customerName.trim().length < 2) {
      errors.push("Customer name must be at least 2 characters");
    }

    // Time validation
    if (!formData.selectedTime) {
      errors.push("Time is required");
    }

    // Check validation results
    if (errors.length > 0) {
      alert("Please fill in all required fields:\n" + errors.join("\n"));
      return;
    }

    // === STEP 2: CHECK ONSUBMIT CALLBACK ===
    if (!onSubmit) {
      alert("Submission handler not available. Please try again.");
      return;
    }

    // === STEP 3: PREPARE SUBMISSION DATA ===

    // Format date consistently for submission
    let selectedDate = selectedSlot.day?.date || selectedSlot.date;

    // Ensure the date is in YYYY-MM-DD format without timezone information
    if (selectedDate) {
      // If it's already in YYYY-MM-DD format
      if (
        typeof selectedDate === "string" &&
        selectedDate.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        // Already in correct format, do nothing
      }
      // If it has timezone info (contains T)
      else if (typeof selectedDate === "string" && selectedDate.includes("T")) {
        selectedDate = selectedDate.split("T")[0];
      }
      // If it's a Date object
      else if (selectedDate instanceof Date) {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        selectedDate = `${year}-${month}-${day}`;
      }
      // Try to parse as date
      else {
        try {
          const parsedDate = new Date(selectedDate);
          if (!isNaN(parsedDate.getTime())) {
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
            const day = String(parsedDate.getDate()).padStart(2, "0");
            selectedDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          // Error parsing date
          selectedDate = moment.tz(MALAYSIA_TZ).format("YYYY-MM-DD");
        }
      }
    } else {
      // If no date provided, use current date as fallback
      selectedDate = moment.tz(MALAYSIA_TZ).format("YYYY-MM-DD");
    }

    // Ensure all required fields are properly formatted
    const customerName = formData.customerName.trim();
    const phoneNumber = formData.phoneNumber?.trim() || "";
    const time = formData.selectedTime;

    // Get user IDs with fallbacks
    const staffId = currentUser?.id || currentUser?.user_id;
    const outletId = currentUser?.outlet_id || 1;

    // Log submission data for debugging
    debugLog("Submitting booking with data:", {
      service_id: serviceId,
      customer_name: customerName,
      phone_number: phoneNumber,
      time: time,
      date: selectedDate,
      staff_id: staffId,
      outlet_id: outletId,
    });

    // Final validation check before submission
    if (!serviceId || !customerName || !time || !selectedDate || !staffId) {
      alert("Missing required fields. Please check your form data.");
      return;
    }

    const submissionData = {
      service_id: serviceId,
      customer_name: customerName,
      phone_number: phoneNumber,
      time: time,
      date: selectedDate,
      outlet_id: outletId,
      staff_id: staffId,
    };

    // === STEP 4: CHECK OVERRIDE CONFIRMATION ===
    const needsOverride = requiresOverrideConfirmation();

    if (needsOverride) {
      setOverrideConfirmationData(submissionData);
      setShowOverrideConfirmation(true);
      return;
    }

    // === STEP 5: CALL ONSUBMIT ===
    try {
      onSubmit(submissionData);
    } catch (callbackError) {
      console.error("Error during booking submission:", callbackError);
      alert("Error during booking submission. Please try again.");
    }
  };

  // Calculate available services based on consecutive slot availability
  const availableServices = useMemo(() => {
    // Only use services from API - no fallback to props
    if (!allServices || allServices.length === 0) {
      return [];
    }

    // If no time is selected, return all API services
    if (!formData.selectedTime || !selectedSlot?.day?.date) {
      return allServices;
    }

    // Filter services based on time slot availability
    const selectedDate = selectedSlot.day.date || selectedSlot.date;

    // Get maximum duration based on consecutive available slots
    const maxDuration = getMaxServiceDuration(
      formData.selectedTime,
      selectedDate,
    );

    if (maxDuration === 0) {
      return []; // No services available
    }

    // Calculate how many 30-minute slots are available
    const availableSlots = Math.floor(maxDuration / 30);

    // Filter services that fit within the available consecutive slots
    const filteredServices = allServices.filter((service) => {
      // Calculate how many slots this service needs
      const serviceSlots = Math.ceil(service.duration / 30);

      // Basic check: service must fit within available slots
      if (serviceSlots > availableSlots) {
        return false;
      }

      // For real-time bookings on today's date, check remaining time in first slot
      const today = moment().format("YYYY-MM-DD");
      if (selectedDate === today) {
        const currentTime = moment();
        const slotMoment = moment(formData.selectedTime, "HH:mm");
        const timeDiffMinutes = currentTime.diff(slotMoment, "minutes");

        // If slot has already started
        if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
          const remainingDuration = getRemainingSlotDuration(
            formData.selectedTime,
            currentTime,
            selectedDate,
          );

          // Service must fit in remaining time of current slot plus full next slots
          const consecutiveSlots = getConsecutiveAvailableSlots(
            formData.selectedTime,
            selectedDate,
          );
          const additionalSlotTime = Math.max(0, (consecutiveSlots - 1) * 30);
          const totalAvailableTime = remainingDuration + additionalSlotTime;

          return service.duration <= totalAvailableTime;
        }
      }

      // If we got here, service fits in available slots
      return true;
    });

    return filteredServices;
  }, [
    allServices,
    formData.selectedTime,
    selectedSlot,
    getMaxServiceDuration,
    getConsecutiveAvailableSlots,
  ]);

  // Calculate available duration for display
  const availableDuration = useMemo(() => {
    if (!selectedSlot?.time || !selectedSlot?.day?.date) {
      return 0;
    }

    return calculateAvailableSlotDuration(
      selectedSlot.time,
      timeSlots,
      bookings,
      blockedSlots,
      selectedSlot.day.date,
    );
  }, [selectedSlot, bookings, blockedSlots, timeSlots]);

  // Calculate end time for display
  const getEndTime = () => {
    if (!selectedSlot?.time || !timeSlots.length) return "";
    const currentIndex = timeSlots.indexOf(selectedSlot.time);
    return timeSlots[currentIndex + 1] || "";
  };

  if (!isOpen || !selectedSlot) return null;

  return (
    <div
      className="booking-details-modal"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
      tabIndex="-1"
      ref={modalRef}
      onKeyDown={handleKeyDown}
    >
      <div className="add-booking-modal-content">
        <div className="booking-details">
          <h3 id="modal-title">ADD NEW BOOKING</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>

          <form onSubmit={handleSubmit} className="booking-form">
            {/* Info Display Fields - Outlet, Barber, Date, Time in one centered row */}
            <div className="info-display-container">
              <div className="form-group info-display">
                <label>Outlet</label>
                <div className="form-value-display">SCM</div>
              </div>

              <div className="form-group info-display">
                <label>Barber</label>
                <div className="form-value-display">
                  {currentUser?.username || currentUser?.name || "Addy"}
                </div>
              </div>

              <div className="form-group info-display">
                <label>Date</label>
                <div className="form-value-display">
                  {(() => {
                    const dateStr = selectedSlot.day?.date || selectedSlot.date;
                    if (dateStr) {
                      // Use moment to ensure consistent formatting in Malaysia timezone
                      return moment
                        .tz(dateStr, MALAYSIA_TZ)
                        .format("DD-MM-YYYY");
                    }
                    return moment.tz(MALAYSIA_TZ).format("DD-MM-YYYY");
                  })()}
                </div>
              </div>

              <div className="form-group info-display">
                <label>Time</label>
                <div className="form-value-display">
                  {formData.selectedTime || selectedSlot.time}
                </div>
              </div>
            </div>

            {slotAvailabilityMessage && (
              <div
                className="form-group info-display"
                style={{
                  marginBottom: "10px",
                  justifyContent: "center",
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffeaa7",
                  borderRadius: "4px",
                  padding: "8px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#856404",
                    textAlign: "center",
                  }}
                >
                  {slotAvailabilityMessage}
                </div>
              </div>
            )}

            {/* Available Duration Info */}
            {availableDuration > 0 && (
              <div
                className="form-group info-display"
                style={{ marginBottom: "10px", justifyContent: "center" }}
              >
                <label style={{ fontSize: "12px", color: "#666" }}>
                  Available Duration:
                </label>
                <div
                  className="form-value-display"
                  style={{
                    fontSize: "12px",
                    color: "#007bff",
                    fontWeight: "bold",
                  }}
                >
                  {formatDuration(availableDuration)}
                </div>
              </div>
            )}

            {/* Walk-in Override Indicator */}
            {isWalkInOverride && walkInMessage && (
              <div
                className="form-group info-display"
                style={{
                  marginBottom: "15px",
                  justifyContent: "center",
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffeaa7",
                  borderRadius: "4px",
                  padding: "8px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#856404",
                    fontWeight: "bold",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>⚠️</span>
                  {walkInMessage}
                </div>
              </div>
            )}

            {/* Service Selection */}
            <div className="form-group input-field">
              <select
                name="service"
                value={formData.service}
                onChange={handleFormChange}
                required
                disabled={loadingServices}
              >
                <option value="">
                  {loadingServices ? "Loading services..." : "Select Service"}
                </option>
                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration} min)
                  </option>
                ))}
              </select>
              {availableServices.length === 0 && !loadingServices && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#dc3545",
                    marginTop: "4px",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  No services available for this time slot duration
                </div>
              )}
              {/* Slot availability info */}
              <div
                style={{
                  fontSize: "10px",
                  color: "#666",
                  marginTop: "4px",
                  textAlign: "center",
                }}
              >
                {(() => {
                  const slots = Math.floor(
                    getMaxServiceDuration(
                      formData.selectedTime,
                      selectedSlot?.day?.date || selectedSlot?.date,
                    ) / 30,
                  );
                  if (slots === 0) return "No available slots";
                  if (slots === 1) return "Available: 1 slot (30 min services)";
                  if (slots === 2)
                    return "Available: 2 slots (up to 60 min services)";
                  return `Available: ${slots} slots (up to ${slots * 30} min services)`;
                })()}
              </div>

              {/* Available slots visualization */}
              {(() => {
                // Only show if we have a selected time and date
                if (!formData.selectedTime || !selectedSlot?.day?.date) {
                  return null;
                }

                const startTime = formData.selectedTime;
                const date = selectedSlot.day.date || selectedSlot.date;
                const startIndex = timeSlots.indexOf(startTime);

                if (startIndex === -1) {
                  return null;
                }

                // Get available slots
                const availableSlotsList = [];
                for (let i = startIndex; i < timeSlots.length; i++) {
                  const currentSlot = timeSlots[i];
                  if (isSlotTaken(currentSlot, date)) {
                    break;
                  }
                  availableSlotsList.push(currentSlot);
                  // Limit to 8 slots for display
                  if (availableSlotsList.length >= 8) {
                    break;
                  }
                }

                if (availableSlotsList.length === 0) {
                  return null;
                }

                // Find the next unavailable slot (if any)
                let nextUnavailableSlot = null;
                const lastAvailableIndex =
                  startIndex + availableSlotsList.length;
                if (lastAvailableIndex < timeSlots.length) {
                  nextUnavailableSlot = timeSlots[lastAvailableIndex];
                }

                return (
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      Available time slots:
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        justifyContent: "center",
                      }}
                    >
                      {availableSlotsList.map((slot, index) => (
                        <div
                          key={slot}
                          style={{
                            fontSize: "9px",
                            padding: "2px 5px",
                            backgroundColor:
                              index === 0 ? "#e3f2fd" : "#f1f8e9",
                            border: "1px solid",
                            borderColor: index === 0 ? "#bbdefb" : "#dcedc8",
                            borderRadius: "3px",
                            color: index === 0 ? "#1976d2" : "#388e3c",
                          }}
                        >
                          {slot}
                        </div>
                      ))}
                      {nextUnavailableSlot && (
                        <div
                          style={{
                            fontSize: "9px",
                            padding: "2px 5px",
                            backgroundColor: "#ffebee",
                            border: "1px solid #ffcdd2",
                            borderRadius: "3px",
                            color: "#c62828",
                            position: "relative",
                          }}
                        >
                          {nextUnavailableSlot}
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                height: "1px",
                                backgroundColor: "#c62828",
                                transform: "rotate(-45deg)",
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Explanation of slot calculation */}
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#666",
                        marginTop: "8px",
                        textAlign: "center",
                        maxWidth: "280px",
                        padding: "4px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>How services are filtered:</strong> Starting from{" "}
                      {startTime}, we found {availableSlotsList.length}{" "}
                      consecutive available slots
                      {nextUnavailableSlot
                        ? ` (until ${nextUnavailableSlot} which is unavailable)`
                        : ""}
                      . This allows for services up to{" "}
                      {availableSlotsList.length * 30} minutes.
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Customer Name Input */}
            <div className="form-group input-field">
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleFormChange}
                placeholder="Customer Name"
                autoComplete="off"
                required
              />
            </div>

            {/* Phone Number Input */}
            <div className="form-group input-field">
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleFormChange}
                placeholder="Phone Number (Optional)"
              />
              {loadingHistory && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#007bff",
                    marginTop: "4px",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  Looking up booking history...
                </div>
              )}
            </div>

            {/* Booking History Display */}
            {showHistory && bookingHistory.length > 0 && (
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "15px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#495057",
                    marginBottom: "8px",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                  }}
                >
                  📅 Customer History ({bookingHistory.length} bookings)
                </div>
                <div
                  style={{
                    maxHeight: "120px",
                    overflowY: "auto",
                    fontSize: "11px",
                  }}
                >
                  {bookingHistory.slice(0, 3).map((booking, index) => (
                    <div
                      key={booking.id || index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 8px",
                        marginBottom: "4px",
                        backgroundColor: "white",
                        borderRadius: "4px",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#495057", fontWeight: "500" }}>
                          {booking.service_name || "Service"}
                        </div>
                        <div style={{ color: "#6c757d", fontSize: "10px" }}>
                          {moment(booking.booking_date || booking.date).format(
                            "DD/MM/YYYY",
                          )}{" "}
                          • {booking.start_time || booking.time}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color:
                            booking.status === "completed"
                              ? "#28a745"
                              : "#6c757d",
                          textTransform: "capitalize",
                          fontWeight: "500",
                        }}
                      >
                        {booking.status || "N/A"}
                      </div>
                    </div>
                  ))}
                  {bookingHistory.length > 3 && (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#6c757d",
                        fontSize: "10px",
                        fontStyle: "italic",
                        marginTop: "8px",
                      }}
                    >
                      ... and {bookingHistory.length - 3} more bookings
                    </div>
                  )}
                </div>
              </div>
            )}

            <button type="submit" className="submit-button compact">
              Submit
            </button>
          </form>
        </div>
      </div>
      <div className="modal-overlay" onClick={onClose}></div>

      {/* Override Confirmation Dialog */}
      {showOverrideConfirmation && (
        <div className="booking-details-modal" style={{ zIndex: 10001 }}>
          <div
            className="add-booking-modal-content"
            style={{ maxWidth: "400px", padding: "20px" }}
          >
            <div className="booking-details">
              <h3
                style={{
                  color: "#856404",
                  textAlign: "center",
                  marginBottom: "20px",
                }}
              >
                ⚠️ Override Confirmation
              </h3>

              <div
                style={{
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffeaa7",
                  borderRadius: "8px",
                  padding: "15px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    color: "#856404",
                    margin: "0 0 10px 0",
                    fontWeight: "bold",
                  }}
                >
                  Service will start immediately at {moment().format("HH:mm")}.
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    margin: "0",
                  }}
                >
                  The selected time slot has already started. Do you want to
                  proceed?
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={handleOverrideCancel}
                  style={{
                    padding: "8px 20px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideConfirm}
                  style={{
                    padding: "8px 20px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
          <div className="modal-overlay" onClick={handleOverrideCancel}></div>
        </div>
      )}
    </div>
  );
};

export default AddBookingModal;
