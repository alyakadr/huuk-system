import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../../utils/constants";
import AddBookingModal from "../../components/AddBookingModal";
import { TIME_SLOTS } from "../../utils/timeSlotUtils";
import { getCurrentWeekDates as getWeekDates } from "../../utils/dateUtils";
import { useAuthSession, INTERFACE_ROLE } from "../../hooks/useAuthSession";
import moment from "moment-timezone";
import { debugLog } from "../../utils/debugLog";

// Helper to get current date in Malaysia timezone
const getMalaysiaToday = () => moment.tz("Asia/Kuala_Lumpur").toDate();
const CACHE_DURATION_MS = 60000;

const StaffSchedule = () => {
  // Helper function to format date consistently (avoiding timezone issues)
  const formatDateForAPI = (date) => {
    return moment.tz(date, "Asia/Kuala_Lumpur").format("YYYY-MM-DD");
  };

  // State variables
  const [view, setView] = useState("Weekly"); // 'Daily' or 'Weekly' view
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [, setLoading] = useState(true);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = getMalaysiaToday();
    const startOfWeek = moment
      .tz(today, "Asia/Kuala_Lumpur")
      .startOf("week")
      .toDate();
    return startOfWeek;
  });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [slotToBlock, setSlotToBlock] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  // Set currentDate to today's date in local timezone
  const [currentDate, setCurrentDate] = useState(getMalaysiaToday);
  const [, setFormData] = useState({
    service: "",
    customerName: "",
    phoneNumber: "",
  });
  const [, setRecentCustomers] = useState([]);
  const [, setTodayCustomers] = useState([]);
  const [, setFrequentCustomers] = useState([]);
  // Services are now handled by AddBookingModal - no need for local state
  const [currentUser, setCurrentUser] = useState(null);
  const { token: authToken, user: authUser } = useAuthSession(
    INTERFACE_ROLE.STAFF,
  );

  // Cache for API responses
  const [bookingsCache, setBookingsCache] = useState(new Map());
  const [, setBlockedSlotsCache] = useState(new Map());
  const [, setRequestError] = useState(null);

  // WebSocket connection
  const socketRef = useRef();
  const fetchTimeoutRef = useRef(null);
  const latestFetchBookingsRef = useRef(null);
  const latestFetchBlockedSlotsRef = useRef(null);

  const sessionToken = useMemo(() => {
    if (authToken) {
      return authToken;
    }

    const staffUser = JSON.parse(
      localStorage.getItem("staff_loggedInUser") || "{}",
    );
    return staffUser.token || localStorage.getItem("token");
  }, [authToken]);

  const sessionStaffId = useMemo(() => {
    if (authUser?.id) {
      return authUser.id;
    }

    const loggedInUser = JSON.parse(
      localStorage.getItem("loggedInUser") || "{}",
    );
    return loggedInUser?.id || null;
  }, [authUser]);

  const getRequestHeaders = useCallback(
    (includeContentType = true) => {
      const headers = {};
      if (includeContentType) {
        headers["Content-Type"] = "application/json";
      }
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }

      return headers;
    },
    [sessionToken],
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    socketRef.current = io(API_BASE_URL);
    const handleRealtimeUpdate = () => {
      latestFetchBookingsRef.current?.();
      latestFetchBlockedSlotsRef.current?.();
    };

    socketRef.current.on("bookingUpdated", handleRealtimeUpdate);
    socketRef.current.on("booking_updated", handleRealtimeUpdate);
    socketRef.current.on("slotUpdate", handleRealtimeUpdate);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      socketRef.current.off("bookingUpdated", handleRealtimeUpdate);
      socketRef.current.off("booking_updated", handleRealtimeUpdate);
      socketRef.current.off("slotUpdate", handleRealtimeUpdate);
      socketRef.current.disconnect();
    };
  }, []);

  // Get current week dates (Fixed date calculation)
  const getCurrentWeekDates = () => {
    return getWeekDates(currentWeekStart);
  };

  // Fetch bookings from API with caching
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);

      if (!sessionStaffId) {
        console.error("Staff ID not found");
        setBookings([]);
        return;
      }

      // Check cache first - use formatDateForAPI to avoid timezone issues
      const currentDateKey = formatDateForAPI(currentDate);
      const weekStartKey = formatDateForAPI(currentWeekStart);
      const cacheKey = `${view}-${currentDateKey}-${weekStartKey}`;
      const now = Date.now();
      const cachedData = bookingsCache.get(cacheKey);

      if (cachedData && now - cachedData.timestamp < CACHE_DURATION_MS) {
        setBookings(cachedData.data);
        setLastFetchTimestamp(now); // Update timestamp even when using cached data
        setLoading(false);
        return;
      }

      // Determine date range based on current view
      let startDate, endDate;
      if (view === "Daily") {
        // Create date range for the selected day in local timezone
        const expandedStart = new Date(currentDate);
        expandedStart.setHours(0, 0, 0, 0);
        expandedStart.setDate(expandedStart.getDate() - 1);
        const expandedEnd = new Date(currentDate);
        expandedEnd.setHours(23, 59, 59, 999);
        expandedEnd.setDate(expandedEnd.getDate() + 1);

        startDate = formatDateForAPI(expandedStart);
        endDate = formatDateForAPI(expandedEnd);
      } else {
        // Weekly view - get start and end of current week
        const weekDates = getCurrentWeekDates();
        startDate = weekDates[0].date;
        endDate = weekDates[6].date;

        // Create date range for the week in local timezone
        const expandedStart = new Date(startDate + "T00:00:00");
        expandedStart.setDate(expandedStart.getDate() - 1);
        const expandedEnd = new Date(endDate + "T23:59:59");
        expandedEnd.setDate(expandedEnd.getDate() + 1);

        startDate = formatDateForAPI(expandedStart);
        endDate = formatDateForAPI(expandedEnd);
      }

      const response = await fetch(
        `${API_BASE_URL}/bookings/staff/bookings?startDate=${startDate}&endDate=${endDate}`,
        {
          method: "GET",
          headers: getRequestHeaders(),
        },
      );

      if (response.ok) {
        const data = await response.json();
        // Check if data is directly an array or wrapped in a bookings property
        const bookingsArray = Array.isArray(data) ? data : data.bookings || [];
        setBookings(bookingsArray);

        // Cache the result and update timestamp
        setBookingsCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(cacheKey, { data: bookingsArray, timestamp: now });
          return newCache;
        });

        // Update last fetch timestamp to trigger UI refresh
        setLastFetchTimestamp(now);
      } else {
        console.error("Failed to fetch bookings:", response.statusText);
        setRequestError("Failed to fetch bookings");
        setBookings([]);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setRequestError("Failed to fetch bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [
    view,
    currentDate,
    currentWeekStart,
    sessionStaffId,
    getRequestHeaders,
    bookingsCache,
  ]);

  // Fetch blocked slots from API
  const fetchBlockedSlots = useCallback(async () => {
    try {
      if (!sessionStaffId) {
        console.error("Staff ID not found");
        setBlockedSlots([]);
        return;
      }

      // Determine date range based on current view
      let apiUrl;
      if (view === "Daily") {
        const dateString = formatDateForAPI(currentDate);
        apiUrl = `${API_BASE_URL}/staff/blocked-slots?staff_id=${sessionStaffId}&date=${dateString}`;
      } else {
        // Weekly view - get start and end of current week
        const weekDates = getCurrentWeekDates();
        const startDate = weekDates[0].date;
        const endDate = weekDates[6].date;
        apiUrl = `${API_BASE_URL}/staff/blocked-slots?staff_id=${sessionStaffId}&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: getRequestHeaders(),
      });

      if (response.ok) {
        const data = await response.json();

        let transformedSlots;
        if (view === "Daily") {
          // For daily view, use blocked_slots array
          transformedSlots = (data.blocked_slots || []).map((slot) => {
            // Use the current selected date instead of creating a new Date()
            const slotDate = new Date(currentDate);
            const dayIndex = slotDate.getDay();
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const dayDisplay = `${dayNames[dayIndex]} ${slotDate.getDate()}`;

            return {
              day: dayDisplay,
              time: normalizeTime(slot.time),
              date: formatDateForAPI(slotDate),
            };
          });
        } else {
          // For weekly view, data is already in the right format from backend
          transformedSlots = Array.isArray(data)
            ? data
            : data.blocked_slots || [];
          // Ensure time normalization
          transformedSlots = transformedSlots.map((slot) => ({
            ...slot,
            time: normalizeTime(slot.time),
          }));
        }

        setBlockedSlots(transformedSlots);
      } else {
        console.error("Failed to fetch blocked slots:", response.statusText);
        setBlockedSlots([]);
      }
    } catch (error) {
      console.error("Error fetching blocked slots:", error);
      setBlockedSlots([]);
    }
  }, [view, currentDate, currentWeekStart, sessionStaffId, getRequestHeaders]);

  useEffect(() => {
    latestFetchBookingsRef.current = fetchBookings;
  }, [fetchBookings]);

  useEffect(() => {
    latestFetchBlockedSlotsRef.current = fetchBlockedSlots;
  }, [fetchBlockedSlots]);

  useEffect(() => {
    // Only fetch when currentWeekStart changes for Weekly view
    if (view === "Weekly") {
      fetchBookings();
      fetchBlockedSlots();
    }
    fetchRecentCustomers();
    fetchTodayCustomers();
    fetchFrequentCustomers();
  }, [currentWeekStart, view, fetchBookings, fetchBlockedSlots]);

  // Fetch data when view changes
  useEffect(() => {
    fetchBookings();
    fetchBlockedSlots();
  }, [view]);

  // Fetch data when current date changes for daily view
  useEffect(() => {
    if (view === "Daily") {
      // Clear cache before fetching to ensure fresh data
      setBookingsCache(new Map());
      setBlockedSlotsCache(new Map());
      fetchBookings();
      fetchBlockedSlots();
    }
  }, [currentDate, view, fetchBookings, fetchBlockedSlots]);

  // Add effect to handle booking updates in daily view
  useEffect(() => {
    // This effect will run whenever bookings state changes
    // It ensures that the UI is updated when bookings are added or modified
    debugLog("📊 [BOOKINGS UPDATE] Bookings state changed, updating UI");
    debugLog("📊 [BOOKINGS UPDATE] Current view:", view);
    debugLog("📊 [BOOKINGS UPDATE] Bookings count:", bookings.length);
  }, [bookings, view]);

  // Initialize currentUser from localStorage
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      return;
    }

    const loggedInUser = localStorage.getItem("loggedInUser");
    if (!loggedInUser) {
      return;
    }

    try {
      const userData = JSON.parse(loggedInUser);
      setCurrentUser(userData);
    } catch (error) {
      console.error("Error parsing user data from localStorage:", error);
    }
  }, [authUser]);

  // Fetch recent customers for autocomplete
  const fetchRecentCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/recent`, {
        headers: getRequestHeaders(false),
      });

      if (response.ok) {
        const data = await response.json();
        setRecentCustomers(data);
      }
    } catch (error) {
      console.error("Error fetching recent customers:", error);
    }
  };

  // Fetch today's customers
  const fetchTodayCustomers = async () => {
    try {
      // Use local date instead of UTC
      const today = formatDateForAPI(new Date());

      const response = await fetch(
        `${API_BASE_URL}/customers/today?date=${today}`,
        {
          headers: getRequestHeaders(false),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setTodayCustomers(data);
      }
    } catch (error) {
      console.error("Error fetching today customers:", error);
    }
  };

  // Fetch frequent customers
  const fetchFrequentCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/frequent`, {
        headers: getRequestHeaders(false),
      });

      if (response.ok) {
        const data = await response.json();
        setFrequentCustomers(data);
      }
    } catch (error) {
      console.error("Error fetching frequent customers:", error);
    }
  };

  // Detect sidebar state from DOM
  useEffect(() => {
    const checkSidebarState = () => {
      const sidebar = document.querySelector(".sidebar");
      if (sidebar) {
        const isMinimized = sidebar.classList.contains("minimized");
        setIsSidebarMinimized(isMinimized);
      }
    };

    // Check initial state
    checkSidebarState();

    // Set up observer to watch for sidebar class changes
    const observer = new MutationObserver(() => {
      checkSidebarState();
    });

    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, []);

  // Time slots configuration is shared across booking features.
  const timeSlots = TIME_SLOTS;

  // Weekly view time slots (same as daily now)
  const weeklyTimeSlots = timeSlots; // Use all time slots for weekly view

  // Days of the week
  const daysOfWeek = getCurrentWeekDates();

  // Helper function to normalize time format
  const normalizeTime = (timeStr) => {
    if (!timeStr) return timeStr;
    return timeStr.substring(0, 5); // Convert "10:00:00" to "10:00"
  };

  // Convert database booking to display format
  const formatBookingForDisplay = (booking) => {
    const duration = Math.ceil(booking.duration / 30) || 1; // Convert minutes to 30-min slots
    let status = "pending";

    if (booking.status === "Confirmed" || booking.status === "Paid") {
      status = "confirmed";
    } else if (booking.status === "Pending") {
      status = "pending";
    } else if (booking.status === "Completed") {
      status = "confirmed";
    } else if (booking.status === "Cancelled") {
      return null; // Don't show cancelled bookings
    }

    // Always parse booking date in Malaysia timezone
    let bookingDateMalaysia;
    let bookingDateFormatted;
    if (booking.date) {
      if (
        typeof booking.date === "string" &&
        booking.date.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        bookingDateMalaysia = moment.tz(
          booking.date,
          "YYYY-MM-DD",
          "Asia/Kuala_Lumpur",
        );
        bookingDateFormatted = bookingDateMalaysia.format("YYYY-MM-DD");
      } else if (
        typeof booking.date === "string" &&
        booking.date.includes("T")
      ) {
        bookingDateMalaysia = moment.tz(booking.date, "Asia/Kuala_Lumpur");
        bookingDateFormatted = bookingDateMalaysia.format("YYYY-MM-DD");
      } else if (booking.date instanceof Date) {
        bookingDateMalaysia = moment.tz(booking.date, "Asia/Kuala_Lumpur");
        bookingDateFormatted = bookingDateMalaysia.format("YYYY-MM-DD");
      } else {
        try {
          bookingDateMalaysia = moment.tz(booking.date, "Asia/Kuala_Lumpur");
          bookingDateFormatted = bookingDateMalaysia.format("YYYY-MM-DD");
        } catch (e) {
          console.error("Error parsing booking date:", e);
          bookingDateMalaysia = moment.tz("Asia/Kuala_Lumpur");
          bookingDateFormatted = bookingDateMalaysia.format("YYYY-MM-DD");
        }
      }
    } else {
      bookingDateMalaysia = moment.tz("Asia/Kuala_Lumpur");
      bookingDateFormatted = bookingDateMalaysia.format("YYYY-MM-DD");
    }

    let dayDisplay;
    if (view === "Weekly") {
      const matchingDay = daysOfWeek.find(
        (d) => d.date === bookingDateFormatted,
      );
      if (matchingDay) {
        dayDisplay = matchingDay.display;
      } else {
        const dayIndex = bookingDateMalaysia.day();
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        dayDisplay = `${dayNames[dayIndex]} ${bookingDateMalaysia.date()}`;
      }
    } else {
      const dayIndex = bookingDateMalaysia.day();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      dayDisplay = `${dayNames[dayIndex]} ${bookingDateMalaysia.date()}`;
    }

    const timeField = booking.start_time || booking.time || "00:00";
    const normalizedTime = normalizeTime(timeField);

    // Payment method and status (try all possible fields)
    const paymentMethod =
      booking.payment_method ||
      booking.paymentMethod ||
      booking.payment_type ||
      booking.method ||
      (booking.payment && booking.payment.method) ||
      "N/A";
    const paymentStatus =
      booking.payment_status ||
      booking.paymentStatus ||
      booking.status_payment ||
      (booking.payment && booking.payment.status) ||
      "N/A";

    // Phone number (try all possible fields)
    const phone =
      booking.phone_number ||
      booking.phone ||
      booking.customer_phone ||
      booking.phone_no ||
      booking.contact_number ||
      booking.user?.phone ||
      booking.user?.phone_number ||
      booking.customer?.phone ||
      booking.customer?.phone_number ||
      "N/A";
    let formattedPhone =
      phone && phone !== "N/A" ? phone.toString().replace(/\D/g, "") : "N/A";
    if (formattedPhone.length === 10) {
      formattedPhone = formattedPhone.replace(
        /^(\d{3})(\d{3})(\d{4})$/,
        "$1-$2-$3",
      );
    } else if (formattedPhone.length === 11) {
      formattedPhone = formattedPhone.replace(
        /^(\d{3})(\d{4})(\d{4})$/,
        "$1-$2-$3",
      );
    } else if (formattedPhone.length < 10) {
      formattedPhone = phone;
    }

    return {
      id: booking.id,
      day: dayDisplay,
      date: bookingDateFormatted,
      time: normalizedTime,
      duration: duration,
      status: status,
      customer: booking.customer_name || booking.customerName || "Unknown",
      phone: formattedPhone || "N/A",
      service: booking.service_name || booking.service || "Unknown Service",
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    };
  };

  // Use memoized formatted bookings for performance
  const formattedBookings = useMemo(() => {
    // Remove payment method filter since bookings from staff schedule don't need payment method validation
    // Only filter out cancelled bookings
    const filteredByPayment = bookings.filter(
      (booking) => booking.status !== "Cancelled",
    );

    const formatted = filteredByPayment
      .map(formatBookingForDisplay)
      .filter(Boolean);

    return formatted;
  }, [
    bookings,
    view,
    currentDate,
    currentWeekStart,
    lastFetchTimestamp,
    blockedSlots,
    daysOfWeek,
  ]);

  // Legacy function for backward compatibility - now just returns memoized value
  const getFormattedBookings = () => {
    return formattedBookings;
  };

  // Check if slot is blocked
  const isSlotBlocked = (day, time) => {
    return blockedSlots.some((slot) => slot.day === day && slot.time === time);
  };

  // Services are now handled directly by AddBookingModal - removed getAvailableServices

  // Block a slot
  const blockSlot = async (day, time) => {
    try {
      // Check if slot is already blocked
      if (isSlotBlocked(day, time)) {
        alert("This time slot is already blocked.");
        setIsBlockModalOpen(false);
        setSlotToBlock(null);
        return;
      }

      if (!sessionStaffId) {
        console.error("Staff ID not found in localStorage");
        alert("Staff ID not found. Please login again.");
        return;
      }

      // Convert day display to date string for API call
      const dayData = daysOfWeek.find((d) => d.display === day);
      const dateString = dayData ? dayData.date : formatDateForAPI(new Date());

      const response = await fetch(
        `${API_BASE_URL}/staff/toggle-slot-blocking`,
        {
          method: "POST",
          headers: getRequestHeaders(),
          body: JSON.stringify({
            staff_id: sessionStaffId,
            date: dateString,
            time: time,
            action: "block",
          }),
        },
      );

      if (response.ok) {
        // Update local state only if API call succeeds
        setBlockedSlots((prev) => [...prev, { day, time }]);
        debugLog(`Slot ${time} on ${day} blocked successfully`);
        alert("Time slot blocked successfully.");
      } else {
        const errorData = await response.json();
        console.error("Failed to block slot:", errorData.message);

        // Handle specific error cases
        if (
          errorData.message &&
          errorData.message.includes("already blocked")
        ) {
          alert("This time slot is already blocked.");
        } else {
          alert("Failed to block slot. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error blocking slot:", error);
      alert("Failed to block slot. Please try again.");
    }

    setIsBlockModalOpen(false);
    setSlotToBlock(null);
  };

  // Submit booking form
  const handleSubmitBooking = async (formData) => {
    try {
      // Use the service ID directly from the form (it's already the correct API service ID)
      const serviceId = parseInt(formData.service_id || formData.service);

      // Validate serviceId
      if (!serviceId || isNaN(serviceId)) {
        alert("Please select a valid service.");
        return;
      }

      // Validate customer name
      const customerName = formData.customer_name || formData.customerName;
      if (!customerName || customerName.trim() === "") {
        alert("Customer name is required.");
        return;
      }

      // Validate time
      const bookingTime =
        formData.selectedTime || formData.time || selectedSlot.time;
      if (!bookingTime || bookingTime.trim() === "") {
        alert("Booking time is required.");
        return;
      }

      // Validate and process date
      let bookingDate =
        formData.date ||
        formData.bookingDate ||
        selectedSlot.day?.date ||
        selectedSlot.date;
      if (!bookingDate || bookingDate.trim() === "") {
        alert("Booking date is required.");
        return;
      }

      // For weekly view, ensure we're using the exact date from daysOfWeek
      if (view === "Weekly" && selectedSlot.day?.display) {
        const dayDisplay = selectedSlot.day.display;

        // Find the matching day in daysOfWeek
        const matchingDay = daysOfWeek.find((d) => d.display === dayDisplay);
        if (matchingDay) {
          // Use the exact date from daysOfWeek
          bookingDate = matchingDay.date;
        }
      }

      // Ensure date is in YYYY-MM-DD format without any timezone adjustments
      if (
        bookingDate &&
        typeof bookingDate === "string" &&
        bookingDate.includes("T")
      ) {
        // If date has timezone info, strip it out
        bookingDate = bookingDate.split("T")[0];
      }

      // Validate staff_id
      const staffId = formData.staff_id || currentUser?.id;
      if (!staffId) {
        alert("Staff ID is missing. Please re-login.");
        return;
      }

      // Validate outlet_id
      const outletId = formData.outlet_id || currentUser?.outlet_id || 1;
      if (!outletId) {
        alert("Outlet ID is missing. Please re-login.");
        return;
      }

      if (!sessionToken) {
        alert("Authentication required. Please log in again.");
        return;
      }

      // Prepare the request payload
      const requestPayload = {
        service_id: serviceId,
        staff_id: staffId,
        date: bookingDate,
        time: bookingTime,
        customer_name: customerName,
        phone_number: formData.phone_number || formData.phoneNumber || "",
        outlet_id: outletId,
      };

      // Make API request
      const apiUrl = `${API_BASE_URL}/bookings/staff/appointment`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify(requestPayload),
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse server response:", jsonError);
        alert("Server returned invalid response format");
        return;
      }

      if (response.ok) {
        alert("Booking submitted successfully!");
        // Completely clear all caches to force fresh data
        setBookingsCache(new Map());
        setBlockedSlotsCache(new Map());
        // Force a re-render by updating the timestamp
        setLastFetchTimestamp(Date.now());

        try {
          // Force a complete refresh of the data
          await Promise.all([fetchBookings(), fetchBlockedSlots()]);
          // Force another re-render after fetch
          setLastFetchTimestamp(Date.now() + 1);
          setIsAddModalOpen(false); // Only close modal after data is refreshed
          setSelectedSlot(null);
        } catch (refreshError) {
          console.error("Error refreshing data:", refreshError);
          setIsAddModalOpen(false); // Still close modal on error
          setSelectedSlot(null);
        }
      } else {
        // Enhanced error handling
        let errorMessage = "Unknown error";
        if (responseData?.message) {
          errorMessage = responseData.message;
        } else if (responseData?.error) {
          errorMessage = responseData.error;
        } else if (responseData?.details) {
          errorMessage = responseData.details;
        }
        alert(`Failed to submit booking: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Booking submission error:", error);
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        alert(
          "Network error: Unable to connect to server. Please check your connection.",
        );
      } else if (error.name === "AbortError") {
        alert("Request timeout. Please try again.");
      } else {
        alert(`Failed to submit booking: ${error.message}`);
      }
    }
  };

  // Handle available slot click (show popup with Add/Block options)
  const handleAvailableSlotClick = (day, time) => {
    // Create custom modal with proper button labels
    const modalDiv = document.createElement("div");
    modalDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h3 style="margin-bottom: 15px; color: #333;">Time Slot: ${time} on ${day}</h3>
          <p style="margin-bottom: 20px; color: #666;">What would you like to do with this slot?</p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="addBtn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Add Booking</button>
            <button id="blockBtn" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Block Slot</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalDiv);

    // Add event listeners
    const addBtn = modalDiv.querySelector("#addBtn");
    const blockBtn = modalDiv.querySelector("#blockBtn");
    const overlay = modalDiv.querySelector("div");

    const cleanup = () => {
      document.body.removeChild(modalDiv);
    };

    addBtn.addEventListener("click", () => {
      cleanup();
      handleAddBooking(day, time);
    });

    blockBtn.addEventListener("click", () => {
      cleanup();
      blockSlot(day, time);
    });

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup();
      }
    });
  };

  // Handle add booking (opens modal)
  const handleAddBooking = (day, time) => {
    let selectedDate;

    if (day === "today") {
      // For daily view, create a proper date object in local timezone
      const today = getMalaysiaToday();
      selectedDate = {
        display: "today",
        date: formatDateForAPI(today),
        fullDate: today,
      };
    } else {
      // For weekly view, find the day in daysOfWeek
      selectedDate = daysOfWeek.find((d) => d.display === day);

      // If not found, try to create a fallback date using current date for daily view
      if (!selectedDate) {
        // Create fallback selectedDate using currentDate for daily view
        if (view === "Daily") {
          selectedDate = {
            display: day,
            date: formatDateForAPI(currentDate),
            fullDate: currentDate,
          };
        }
      }
    }

    // Pre-fill the slot data immediately and open modal
    const slotData = { day: selectedDate, time };
    setSelectedSlot(slotData);
    setFormData({ service: "", customerName: "", phoneNumber: "" }); // Reset form
    setIsAddModalOpen(true);
  };

  // Handle booking click (show booking details popup)
  const handleBookingClick = async (booking) => {
    let fullBooking = booking;
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/booking-details/${booking.id}`,
        {
          headers: getRequestHeaders(false),
        },
      );
      if (response.ok) {
        const data = await response.json();
        fullBooking = data.booking || data;
      }
    } catch (error) {
      console.error("Failed to fetch full booking details:", error);
    }
    setDetailsBooking(fullBooking); // Use React state/modal for display
  };

  // Close booking details modal
  const closeDetailsModal = () => {
    setDetailsBooking(null);
  };

  // Close add booking modal
  const closeAddModal = () => {
    setIsAddModalOpen(false);

    // Force refresh of bookings data after modal is closed
    // This ensures that new bookings are displayed immediately in daily view

    // Clear cache to force fresh data
    setBookingsCache(new Map());
    setBlockedSlotsCache(new Map());

    // Update timestamp to force re-render
    setLastFetchTimestamp(Date.now());

    // Refresh bookings data
    fetchBookings().then(() => {
      // Force another re-render after fetch completes
      setLastFetchTimestamp(Date.now() + 1);
    });
    fetchBlockedSlots();
  };

  // Check if a slot is covered by a multi-slot booking
  const isSlotCoveredByBooking = (day, time) => {
    const timeIndex = timeSlots.indexOf(time);
    const formattedBookings = getFormattedBookings();

    // Check all bookings to see if any multi-slot booking covers this time
    for (const booking of formattedBookings) {
      if (booking.day === day && booking.duration > 1) {
        const bookingStartIndex = timeSlots.indexOf(booking.time);
        if (
          bookingStartIndex !== -1 &&
          timeIndex > bookingStartIndex &&
          timeIndex < bookingStartIndex + booking.duration
        ) {
          return booking; // Return the booking that covers this slot
        }
      }
    }
    return null;
  };

  if (view === "Daily") {
    return (
      <div
        className={`staff-schedule ${
          isSidebarMinimized ? "sidebar-minimized" : ""
        }`}
        style={{
          height: isMobileView ? "auto" : "600px",
          maxHeight: isMobileView ? "none" : "600px",
          overflow: isMobileView ? "visible" : "hidden",
        }}
      >
        {/* Toggle View and Date Filter - No Header */}
        <div className="daily-controls">
          <div className="view-toggle-container">
            <button
              className={`view-toggle-btn ${view === "Daily" ? "active" : ""}`}
              onClick={() => setView("Daily")}
            >
              Daily
            </button>
            <button
              className={`view-toggle-btn ${view === "Weekly" ? "active" : ""}`}
              onClick={() => setView("Weekly")}
            >
              Weekly
            </button>
          </div>
          <div className="date-picker">
            <div className="date-navigation">
              <button
                className="nav-button"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setDate(newDate.getDate() - 1);
                  setCurrentDate(newDate);
                }}
              >
                ←
              </button>
              <div className="date-display">
                {currentDate.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                })}
                <div
                  style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}
                >
                  {isMobileView ? "" : `API: ${formatDateForAPI(currentDate)}`}
                </div>
              </div>
              <button
                className="nav-button"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setCurrentDate(newDate);
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Daily Schedule Legend - Separate styling for daily view */}
        <div className="daily-legend-items">
          <div className="daily-legend-item">
            <div className="daily-legend-color available"></div>
            <span>Available</span>
          </div>
          <div className="daily-legend-item">
            <div className="daily-legend-color booked"></div>
            <span>Booked</span>
          </div>
          <div className="daily-legend-item">
            <div className="daily-legend-color blocked"></div>
            <span>Blocked</span>
          </div>
        </div>

        {/* Daily view content - 8-column grid layout */}
        <div className="daily-schedule-container">
          {/* 8-Column Grid: Time | Booking | Time | Booking | Time | Booking | Time | Booking */}
          <div className="daily-grid">
            {(() => {
              // Get actual bookings from the fetched data
              const formattedBookings = getFormattedBookings();

              // Generate booking data from real API data
              const bookingData = {};

              // Initialize all time slots as available
              timeSlots.forEach((time) => {
                bookingData[time] = { status: "available" };
              });

              // Mark blocked slots - Create selected day's display format directly
              const selectedDay = currentDate || new Date();
              const dayNames = [
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ];
              const selectedDayFormattedDay = `${
                dayNames[selectedDay.getDay()]
              } ${selectedDay.getDate()}`;

              // Mark blocked slots
              blockedSlots.forEach((slot) => {
                if (slot.day === selectedDayFormattedDay) {
                  bookingData[slot.time] = { status: "blocked" };
                }
              });

              // Mark booked slots from real API data and filter by the selected date
              const selectedDateString = formatDateForAPI(selectedDay); // Get current date in YYYY-MM-DD format

              // Filter bookings for the current day only
              const dailyBookings = formattedBookings.filter((booking) => {
                return booking.date === selectedDateString;
              });

              // Mark booked slots and their consecutive slots for multi-slot bookings
              dailyBookings.forEach((booking) => {
                // Mark all slots covered by this booking as booked
                const startTimeIndex = timeSlots.indexOf(booking.time);
                if (startTimeIndex !== -1) {
                  for (let i = 0; i < booking.duration; i++) {
                    const slotIndex = startTimeIndex + i;
                    if (slotIndex < timeSlots.length) {
                      const slotTime = timeSlots[slotIndex];
                      // Only mark it if it's not already marked as blocked
                      if (bookingData[slotTime]?.status !== "blocked") {
                        bookingData[slotTime] = {
                          status: i === 0 ? "booked" : "booked-continuation",
                          customer: booking.customer,
                          service: booking.service,
                          duration: booking.duration,
                          id: booking.id,
                          isContinuation: i !== 0,
                          originalBooking: booking,
                        };
                      }
                    }
                  }
                }
              });

              // Create 4 columns of 6 time slots each (top to bottom, then right) - removed 22:00
              const timeColumns = [
                ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
                ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30"],
                ["16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
                ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
              ];

              const gridItems = [];

              // Generate 8 columns: alternating time and booking columns
              // We need to generate row by row to get proper alternating pattern
              for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
                for (let colIndex = 0; colIndex < 4; colIndex++) {
                  const times = timeColumns[colIndex];
                  const time = times[rowIndex];

                  // Time column (narrow)
                  gridItems.push(
                    <div
                      key={`time-${colIndex}-${rowIndex}`}
                      className="time-label-column"
                    >
                      {time || ""}
                    </div>,
                  );

                  // Booking column (wider) - directly after the time column
                  const booking = time ? bookingData[time] : null;
                  const isBlocked = isSlotBlocked(
                    selectedDayFormattedDay,
                    time,
                  );

                  // Check if this slot is covered by a multi-slot booking
                  const coveringBooking = isSlotCoveredByBooking(
                    selectedDayFormattedDay,
                    time,
                  );
                  const actualBooking =
                    booking ||
                    (coveringBooking
                      ? { ...coveringBooking, status: "booked" }
                      : null);

                  // Don't render individual slots that are covered by multi-slot bookings
                  if (coveringBooking && !booking) {
                    gridItems.push(
                      <div
                        key={`booking-${colIndex}-${rowIndex}`}
                        className="booking-slot-column booked-slot continuation"
                        onClick={() => {
                          handleBookingClick(coveringBooking);
                        }}
                      >
                        <div className="booking-content booked-content">
                          <div className="booked-info continuation-info">
                            <div className="continuation-indicator">···</div>
                          </div>
                        </div>
                      </div>,
                    );
                  } else {
                    // Determine CSS class based on booking status
                    let slotClassName = "booking-slot-column ";

                    if (!actualBooking || !time) {
                      slotClassName += "empty-slot";
                    } else if (
                      isBlocked ||
                      actualBooking.status === "blocked"
                    ) {
                      slotClassName += "blocked-slot";
                    } else if (
                      actualBooking.status === "booked" ||
                      actualBooking.status === "booked-continuation"
                    ) {
                      slotClassName += "booked-slot";
                    } else if (actualBooking.status === "available") {
                      slotClassName += "available-slot";
                    } else {
                      slotClassName += "empty-slot"; // fallback
                    }

                    gridItems.push(
                      <div
                        key={`booking-${colIndex}-${rowIndex}`}
                        className={slotClassName}
                        onClick={() => {
                          if (
                            isBlocked ||
                            actualBooking?.status === "blocked"
                          ) {
                            // Blocked slots have no interaction
                            return;
                          } else if (actualBooking) {
                            if (actualBooking.status === "available") {
                              handleAvailableSlotClick(
                                selectedDayFormattedDay,
                                time,
                              );
                            } else if (
                              actualBooking.status === "booked" ||
                              actualBooking.status === "booked-continuation"
                            ) {
                              // Show booking details popup - use original booking for continuations
                              const bookingToShow =
                                actualBooking.originalBooking || actualBooking;
                              handleBookingClick(bookingToShow);
                            }
                          } else {
                            // Empty slot - show available slot actions
                            handleAvailableSlotClick(
                              selectedDayFormattedDay,
                              time,
                            );
                          }
                        }}
                      >
                        {isBlocked ? (
                          <div className="booking-content blocked-content">
                            <div className="blocked-label">Blocked</div>
                          </div>
                        ) : actualBooking ? (
                          actualBooking.status === "available" ? (
                            <div className="booking-content available-content">
                              <div className="available-actions">
                                <button
                                  className="add-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddBooking(
                                      selectedDayFormattedDay,
                                      time,
                                    );
                                  }}
                                >
                                  <span className="btn-icon">+</span> Add
                                </button>
                                <button
                                  className="block-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    blockSlot(selectedDayFormattedDay, time);
                                  }}
                                >
                                  <span className="btn-icon">◉</span> Block
                                </button>
                              </div>
                            </div>
                          ) : actualBooking.status === "blocked" ? (
                            <div className="booking-content blocked-content">
                              <div className="blocked-label">Blocked</div>
                            </div>
                          ) : actualBooking.status === "booked-continuation" ? (
                            <div className="booking-content booked-content">
                              <div className="booked-info continuation-info">
                                <div className="continuation-indicator">
                                  ···
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="booking-content booked-content">
                              <div className="booked-info">
                                <div className="customer-name">
                                  {actualBooking.customer}
                                </div>
                                <div className="service-name">
                                  {actualBooking.service}
                                </div>
                                {actualBooking.duration > 1 && (
                                  <div className="duration-indicator">
                                    {actualBooking.duration * 30 >= 60
                                      ? `${Math.floor((actualBooking.duration * 30) / 60)}h`
                                      : `${actualBooking.duration * 30}m`}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        ) : null}
                      </div>,
                    );
                  }
                }
              }

              return gridItems;
            })()}
          </div>
        </div>
        {/* Booking Details Modal */}
        {detailsBooking && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.4)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={closeDetailsModal}
            />
            <div
              style={{
                position: "fixed",
                top: "50%", // center vertically
                left: "50%",
                transform: "translate(-50%, -50%)", // center both horizontally and vertically
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 4px 16px rgba(44,62,80,0.12)",
                border: "1.5px solid #e0e0e0",
                zIndex: 1001,
                minWidth: 280,
                maxWidth: 420,
                width: "90vw",
                maxHeight: "calc(100vh - 24px)",
                overflowY: "auto",
                padding: isMobileView ? 14 : 22,
                color: "#222",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: isMobileView ? 18 : 24,
                  color: "#222",
                  letterSpacing: "2px",
                  marginBottom: 12,
                  borderBottom: "1px solid #eee",
                  paddingBottom: 8,
                  textTransform: "uppercase",
                  fontFamily: "Special Gothic Expanded One, sans-serif",
                }}
              >
                BOOKING DETAILS
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobileView ? "1fr" : "1fr 1.2fr",
                  rowGap: 7,
                  columnGap: 10,
                  fontSize: isMobileView ? 13 : 14,
                  color: "#222",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontWeight: 600 }}>Booking ID:</span>
                <span>{detailsBooking.bookingId || detailsBooking.id}</span>
                <span style={{ fontWeight: 600 }}>Customer Name:</span>
                <span>
                  {detailsBooking.customerName ||
                    detailsBooking.customer_name ||
                    detailsBooking.customer ||
                    "Unknown"}
                </span>
                <span style={{ fontWeight: 600 }}>Phone Number:</span>
                <span>
                  {detailsBooking.phoneNumber ||
                    detailsBooking.phone_number ||
                    detailsBooking.phone ||
                    "N/A"}
                </span>
                <span style={{ fontWeight: 600 }}>Service:</span>
                <span>
                  {detailsBooking.serviceName ||
                    detailsBooking.service_name ||
                    detailsBooking.service ||
                    "Unknown Service"}
                </span>
                <span style={{ fontWeight: 600 }}>Date:</span>
                <span>
                  {detailsBooking.bookingDate
                    ? new Date(detailsBooking.bookingDate)
                        .toLocaleDateString("en-GB")
                        .replace(/\//g, "-")
                    : detailsBooking.date || "N/A"}
                </span>
                <span style={{ fontWeight: 600 }}>Time Slot:</span>
                <span>
                  {detailsBooking.startTime
                    ? detailsBooking.startTime.substring(0, 5)
                    : detailsBooking.time || "N/A"}
                </span>
                <span style={{ fontWeight: 600 }}>Staff Name:</span>
                <span>
                  {detailsBooking.staffName ||
                    detailsBooking.staff_name ||
                    detailsBooking.staff ||
                    "N/A"}
                </span>
                <span style={{ fontWeight: 600 }}>Payment Status:</span>
                <span
                  style={{
                    color:
                      (detailsBooking.paymentStatus ||
                        detailsBooking.payment_status) === "Paid"
                        ? "#28a745"
                        : (detailsBooking.paymentStatus ||
                              detailsBooking.payment_status) === "Pending"
                          ? "#dc3545"
                          : "#888",
                    fontWeight: 600,
                  }}
                >
                  {detailsBooking.paymentStatus ||
                    detailsBooking.payment_status ||
                    "N/A"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    textAlign: "center",
                    color: "#888",
                    fontSize: 13,
                    marginTop: 10,
                    fontStyle: "italic",
                  }}
                >
                  Click anywhere to close
                </div>
              </div>
            </div>
          </>
        )}

        {/* Add Booking Modal - Reusable Component */}
        <AddBookingModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          selectedSlot={selectedSlot}
          onSubmit={handleSubmitBooking}
          currentUser={currentUser}
          bookings={getFormattedBookings()}
          blockedSlots={blockedSlots}
          timeSlots={timeSlots}
          disableDynamicTimeLogic={true}
        />

        {/* Block Confirmation Modal */}
        {isBlockModalOpen && slotToBlock && (
          <div className="booking-details-modal">
            <div className="modal-content">
              <div className="booking-details">
                <h3>BLOCK SLOT</h3>
                <button
                  className="close-button"
                  onClick={() => setIsBlockModalOpen(false)}
                >
                  ×
                </button>

                <p>
                  Are you sure you want to block the slot at {slotToBlock.time}{" "}
                  on {slotToBlock.day}?
                </p>

                <div className="block-actions">
                  <button
                    className="confirm-block-btn"
                    onClick={() => blockSlot(slotToBlock.day, slotToBlock.time)}
                  >
                    Yes, Block It
                  </button>
                  <button
                    className="cancel-block-btn"
                    onClick={() => setIsBlockModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
            <div
              className="modal-overlay"
              onClick={() => setIsBlockModalOpen(false)}
            ></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`staff-schedule weekly-schedule ${
        isSidebarMinimized ? "sidebar-minimized" : ""
      }`}
    >
      {/* Toggle View and Date Filter - Same style as Daily View */}
      <div
        className="weekly-controls"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: isMobileView ? "wrap" : "nowrap",
          rowGap: isMobileView ? "10px" : "0",
          marginBottom: "10px",
          padding: "8px 0",
        }}
      >
        <div className="view-toggle-container">
          <button
            className={`view-toggle-btn ${view === "Daily" ? "active" : ""}`}
            onClick={() => setView("Daily")}
          >
            Daily
          </button>
          <button
            className={`view-toggle-btn ${view === "Weekly" ? "active" : ""}`}
            onClick={() => setView("Weekly")}
          >
            Weekly
          </button>
        </div>
        <div className="date-picker">
          <div className="date-navigation">
            <button
              className="nav-button"
              onClick={() => {
                const newDate = new Date(currentWeekStart);
                newDate.setDate(newDate.getDate() - 7);
                setCurrentWeekStart(newDate);
              }}
            >
              ←
            </button>
            <div className="date-display">
              {daysOfWeek[0]?.display
                ? `${
                    daysOfWeek[0].display.split(" ")[1]
                  }-${daysOfWeek[0].display.split(" ")[0].slice(0, 3)}`
                : ""}
              -2025 -
              {daysOfWeek[6]?.display
                ? `${
                    daysOfWeek[6].display.split(" ")[1]
                  }-${daysOfWeek[6].display.split(" ")[0].slice(0, 3)}`
                : ""}
              -2025
            </div>
            <button
              className="nav-button"
              onClick={() => {
                const newDate = new Date(currentWeekStart);
                newDate.setDate(newDate.getDate() + 7);
                setCurrentWeekStart(newDate);
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Legend - Moved to top under view toggle */}
      <div className="legend-items">
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-color booked"></div>
          <span>Booked</span>
        </div>
        <div className="legend-item">
          <div className="legend-color blocked"></div>
          <span>Blocked</span>
        </div>
      </div>

      {/* Modern Weekly Schedule Grid */}
      <div className="modern-weekly-container">
        <div className="schedule-grid-wrapper">
          {/* Header Row with Days and Time Slots */}
          <div className="schedule-header-grid">
            {/* Empty corner cell */}
            <div className="corner-cell"></div>

            {/* Time Headers - Horizontal */}
            {weeklyTimeSlots.map((time) => (
              <div key={time} className="time-header-cell">
                <div className="time-display">{time}</div>
              </div>
            ))}
          </div>

          {/* Days and Time Slots Grid */}
          <div className="schedule-body-grid">
            {daysOfWeek.map((day) => (
              <div key={day.display} className="day-row-grid">
                {/* Day Label - Vertical */}
                <div className="day-label-cell">
                  <div className="day-name">{day.display.split(" ")[0]}</div>
                  <div className="day-date">{day.display.split(" ")[1]}</div>
                </div>

                {/* Time Slots for this day - Horizontal */}
                {timeSlots.map((time) => {
                  // Use real API data for weekly view
                  const formattedBookings = getFormattedBookings();

                  // Check if this slot has a booking from real API data
                  const booking = formattedBookings.find((b) => {
                    const dayMatch = b.day === day.display;
                    const timeMatch =
                      normalizeTime(b.time) === normalizeTime(time);
                    return dayMatch && timeMatch;
                  });

                  // Check if this slot is covered by a multi-slot booking
                  const coveringBooking = isSlotCoveredByBooking(
                    day.display,
                    time,
                  );

                  // Check if this slot is blocked from real API data
                  const isBlocked = blockedSlots.some(
                    (slot) =>
                      slot.day === day.display &&
                      normalizeTime(slot.time) === normalizeTime(time),
                  );

                  const actualBooking = booking || coveringBooking;

                  // Don't render slots that are covered by multi-slot bookings (except the first slot)
                  if (coveringBooking && !booking) {
                    return (
                      <div
                        key={`${day.display}-${time}`}
                        className="schedule-slot booked continuation"
                        onClick={() => {
                          // Show booking details for the covering booking
                          handleBookingClick(coveringBooking);
                        }}
                      >
                        <div className="slot-content booked-content">
                          {/* Continuation of booking - no additional content */}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${day.display}-${time}`}
                      className={`schedule-slot ${
                        isBlocked
                          ? "blocked"
                          : actualBooking
                            ? "booked"
                            : "available"
                      }`}
                      onClick={() => {
                        if (isBlocked) {
                          // Blocked slots have no interaction
                          return;
                        }
                        if (actualBooking) {
                          // Show booking details popup
                          handleBookingClick(actualBooking);
                        } else {
                          // Available slot - show Add/Block popup
                          handleAvailableSlotClick(day.display, time);
                        }
                      }}
                    >
                      {isBlocked ? (
                        <div className="slot-content blocked-content">
                          {/* No text inside blocked slots */}
                        </div>
                      ) : actualBooking ? (
                        <div className="slot-content booked-content">
                          {/* Booked slots show popup on click */}
                          {booking && booking.duration > 1 && (
                            <div className="duration-indicator">
                              {booking.duration * 30 >= 60
                                ? `${Math.floor((booking.duration * 30) / 60)}h`
                                : `${booking.duration * 30}m`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="slot-content available-content">
                          {/* No + icon - slot is directly clickable */}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Booking Details Modal */}
      {detailsBooking && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={closeDetailsModal}
          />
          <div
            style={{
              position: "fixed",
              top: "50%", // center vertically
              left: "50%",
              transform: "translate(-50%, -50%)", // center both horizontally and vertically
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(44,62,80,0.12)",
              border: "1.5px solid #e0e0e0",
              zIndex: 1001,
              minWidth: 280,
              maxWidth: 420,
              width: "90vw",
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              padding: isMobileView ? 14 : 22,
              color: "#222",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                textAlign: "center",
                fontWeight: 700,
                fontSize: isMobileView ? 18 : 24,
                color: "#222",
                letterSpacing: "2px",
                marginBottom: 12,
                borderBottom: "1px solid #eee",
                paddingBottom: 8,
                textTransform: "uppercase",
                fontFamily: "Special Gothic Expanded One, sans-serif",
              }}
            >
              BOOKING DETAILS
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobileView ? "1fr" : "1fr 1.2fr",
                rowGap: 7,
                columnGap: 10,
                fontSize: isMobileView ? 13 : 14,
                color: "#222",
                marginBottom: 10,
              }}
            >
              <span style={{ fontWeight: 600 }}>Booking ID:</span>
              <span>{detailsBooking.bookingId || detailsBooking.id}</span>
              <span style={{ fontWeight: 600 }}>Customer Name:</span>
              <span>
                {detailsBooking.customerName ||
                  detailsBooking.customer_name ||
                  detailsBooking.customer ||
                  "Unknown"}
              </span>
              <span style={{ fontWeight: 600 }}>Phone Number:</span>
              <span>
                {detailsBooking.phoneNumber ||
                  detailsBooking.phone_number ||
                  detailsBooking.phone ||
                  "N/A"}
              </span>
              <span style={{ fontWeight: 600 }}>Service:</span>
              <span>
                {detailsBooking.serviceName ||
                  detailsBooking.service_name ||
                  detailsBooking.service ||
                  "Unknown Service"}
              </span>
              <span style={{ fontWeight: 600 }}>Date:</span>
              <span>
                {detailsBooking.bookingDate
                  ? new Date(detailsBooking.bookingDate)
                      .toLocaleDateString("en-GB")
                      .replace(/\//g, "-")
                  : detailsBooking.date || "N/A"}
              </span>
              <span style={{ fontWeight: 600 }}>Time Slot:</span>
              <span>
                {detailsBooking.startTime
                  ? detailsBooking.startTime.substring(0, 5)
                  : detailsBooking.time || "N/A"}
              </span>
              <span style={{ fontWeight: 600 }}>Staff Name:</span>
              <span>
                {detailsBooking.staffName ||
                  detailsBooking.staff_name ||
                  detailsBooking.staff ||
                  "N/A"}
              </span>
              <span style={{ fontWeight: 600 }}>Payment Method:</span>
              <span
                style={{
                  color: "#007bff",
                  fontWeight: 700,
                  fontSize: 16,
                  padding: "8px 0",
                  display: "block",
                  minHeight: "32px",
                }}
              >
                {detailsBooking.paymentMethod ||
                  detailsBooking.payment_method ||
                  detailsBooking.payment_type ||
                  detailsBooking.method ||
                  (detailsBooking.payment && detailsBooking.payment.method) ||
                  "N/A"}
              </span>
              <span style={{ fontWeight: 600 }}>Payment Status:</span>
              <span
                style={{
                  color:
                    (detailsBooking.paymentStatus ||
                      detailsBooking.payment_status) === "Paid"
                      ? "#28a745"
                      : (detailsBooking.paymentStatus ||
                            detailsBooking.payment_status) === "Pending"
                        ? "#dc3545"
                        : "#888",
                  fontWeight: 600,
                }}
              >
                {detailsBooking.paymentStatus ||
                  detailsBooking.payment_status ||
                  "N/A"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  color: "#888",
                  fontSize: 13,
                  marginTop: 10,
                  fontStyle: "italic",
                }}
              >
                Click anywhere to close
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Booking Modal - Reusable Component */}
      <AddBookingModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        selectedSlot={selectedSlot}
        onSubmit={handleSubmitBooking}
        currentUser={currentUser}
        bookings={getFormattedBookings()}
        blockedSlots={blockedSlots}
        timeSlots={timeSlots}
        disableDynamicTimeLogic={true}
      />

      {/* Block Confirmation Modal */}
      {isBlockModalOpen && slotToBlock && (
        <div className="booking-details-modal">
          <div className="modal-content">
            <div className="booking-details">
              <h3>BLOCK SLOT</h3>
              <button
                className="close-button"
                onClick={() => setIsBlockModalOpen(false)}
              >
                ×
              </button>

              <p>
                Are you sure you want to block the slot at {slotToBlock.time} on{" "}
                {slotToBlock.day}?
              </p>

              <div className="block-actions">
                <button
                  className="confirm-block-btn"
                  onClick={() => blockSlot(slotToBlock.day, slotToBlock.time)}
                >
                  Yes, Block It
                </button>
                <button
                  className="cancel-block-btn"
                  onClick={() => setIsBlockModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          <div
            className="modal-overlay"
            onClick={() => setIsBlockModalOpen(false)}
          ></div>
        </div>
      )}
    </div>
  );
};

export default StaffSchedule;
