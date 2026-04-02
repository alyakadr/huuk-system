import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  TextField,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  FormHelperText,
  IconButton,
} from "@mui/material";
import SimpleCalendar from "../../components/common/SimpleCalendar";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import client from "../../api/client";
import http from "../../utils/httpClient";
import io from "socket.io-client";
import { jsPDF } from "jspdf";
import "../../styles/bookingHistory.css";

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const BookingHistory = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [countdowns, setCountdowns] = useState({});
  const [slotInfo, setSlotInfo] = useState({});
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleStaffId, setRescheduleStaffId] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancelDialogOpen, setConfirmCancelDialogOpen] = useState(false);

  const navigate = useNavigate();
  const { profile } = useProfile();
  const isLoggedIn = !!profile;

  const formatDate = (dateInput) => {
    // Handle both string and Date inputs
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (!date || isNaN(date.getTime())) {
      console.error("Invalid date input:", dateInput);
      return "";
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`; // dd/mm/yyyy
  };

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/homepage?loginRequired=true");
      return;
    }
    fetchBookings();
    const socket = io(API_BASE_URL);
    socket.on("slotUpdate", (data) => {
      setSlotInfo((prev) => ({
        ...prev,
        [data.outletId]: {
          currentSlot: data.currentSlot,
          queue: data.queue,
        },
      }));
    });
    socket.on("bookingUpdated", () => {
      fetchBookings();
    });
    socket.on("booking_updated", () => {
      fetchBookings();
    });

    // Listen for custom refresh events from payment completion
    const handleRefreshBookingHistory = (event) => {
      console.log("Received booking history refresh event:", event.detail);
      // Add a small delay to ensure database is updated
      setTimeout(() => {
        fetchBookings();
      }, 1000);
    };

    window.addEventListener(
      "refreshBookingHistory",
      handleRefreshBookingHistory
    );

    // Also listen for focus events to refresh when user returns to page
    const handleFocus = () => {
      console.log("Page focused, refreshing booking history");
      fetchBookings();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      socket.disconnect();
      window.removeEventListener(
        "refreshBookingHistory",
        handleRefreshBookingHistory
      );
      window.removeEventListener("focus", handleFocus);
    };
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newCountdowns = {};
      bookings.forEach((booking) => {
        const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
        const diffMs = bookingDateTime - now;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins > 0 && diffMins <= 60) {
          newCountdowns[booking.id] = diffMins;
        }
      });
      setCountdowns(newCountdowns);
    }, 60000);
    return () => clearInterval(interval);
  }, [bookings]);

  const fetchBookings = async () => {
    setLoading(true);
    setError(""); // Clear previous errors
    
    try {
      // Get customer-specific token first
      const customerToken = localStorage.getItem("customer_token");
      
      if (!customerToken) {
        console.error("No valid customer authentication found");
        throw new Error("Please sign in to view your bookings");
      }

      // Direct API call with explicit headers
      const response = await http.get(`${API_BASE_URL}/bookings`, {
        headers: {
          "Authorization": `Bearer ${customerToken}`,
          "Cache-Control": "no-cache",
          "Content-Type": "application/json"
        }
      });

      if (response.data && Array.isArray(response.data)) {
        setBookings(response.data);
        if (response.data.length === 0) {
          setError("No bookings found for your account.");
        }
      } else {
        console.error("Invalid response format:", response.data);
        throw new Error("Invalid response format from API");
      }
    } catch (err) {
      console.error("Error fetching bookings:", err.message);

      // Simple error handling
      if (err.response?.status === 401) {
        setError("Your session has expired. Please sign in again.");
        // Clear auth tokens
        localStorage.removeItem("customer_token");
        localStorage.removeItem("customer_loggedInUser");
        
        // Redirect after a short delay
        setTimeout(() => {
          navigate("/homepage?loginRequired=true");
        }, 2000);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Unable to load your bookings. Please try again.");
      }
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setShowFeedbackForm(false);
  };

  const handleRateUs = (booking) => {
    setSelectedBooking(booking);
    setShowFeedbackForm(true);
    setRating(booking.review ? booking.review.rating : 0);
    setFeedbackText(booking.review ? booking.review.comment || "" : "");
  };

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      setError("Please provide a rating.");
      return;
    }

    const payload = {
      booking_id: selectedBooking.id,
      user_id: profile.id,
      staff_id: selectedBooking.staff_id,
      rating,
      comment: feedbackText,
    };

    console.log("Submitting feedback with payload:", payload);
    console.log("Selected booking:", selectedBooking);
    console.log("Profile:", profile);

    try {
      const response = await client.post("/bookings/reviews", payload);
      console.log("Feedback submission successful:", response.data);

      // Create updated booking with review data
      const updatedBooking = {
        ...selectedBooking,
        review: {
          rating,
          comment: feedbackText,
          created_at: new Date().toISOString(),
        },
      };

      // Update the selected booking first to ensure UI updates immediately
      setSelectedBooking(updatedBooking);

      // Then update the bookings array
      setBookings(
        bookings.map((b) => (b.id === selectedBooking.id ? updatedBooking : b))
      );

      setSuccess("Feedback submitted successfully!");
      setShowFeedbackForm(false);
    } catch (err) {
      console.error("Feedback submission error:", err);
      console.error("Error response data:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Error headers:", err.response?.headers);

      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to submit feedback";
      setError(errorMessage);
    }
  };

  const handleDownloadReceiptLocal = (booking) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Booking Receipt", 20, 20);
    doc.setFontSize(12);
    doc.text(`ID: #${String(booking.id).padStart(7, "0")}`, 20, 30);
    doc.text(`Outlet: ${booking.outlet_shortform}`, 20, 40);
    doc.text(`Service: ${booking.service_name}`, 20, 50);
    doc.text(`Date: ${formatDate(booking.date)}`, 20, 60);
    doc.text(`Time: ${booking.time}`, 20, 70);
    doc.text(`Name: ${booking.customer_name}`, 20, 80);
    doc.text(`Barber: ${booking.staff_name}`, 20, 90);
    doc.text(`Payment Status: ${booking.payment_status}`, 20, 100);
    doc.save(`receipt_${booking.id}.pdf`);
  };

  // Extract unique booking dates for enabling/disabling calendar dates
  const bookingDates = [
    ...new Set(
      bookings.map((booking) => formatDate(booking.date)).filter(Boolean) // Remove invalid or empty dates
    ),
  ];
  console.log("Booking dates:", bookingDates); // Debug booking dates

  // Filter bookings based on selected date
  const filteredBookings = selectedDate
    ? bookings.filter(
        (booking) => formatDate(booking.date) === formatDate(selectedDate)
      )
    : bookings;

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    // Handle missing date/time values
    if (!a.date || !a.time) {
      console.warn("Booking A missing date/time:", a);
      return 1; // Move to end
    }
    if (!b.date || !b.time) {
      console.warn("Booking B missing date/time:", b);
      return -1; // Move to end
    }

    // Handle date parsing - dates might be ISO strings or Date objects
    let dateA, dateB;
    try {
      // If date is already a Date object, use it; otherwise parse the ISO string
      const dateObjA = typeof a.date === "string" ? new Date(a.date) : a.date;
      const dateObjB = typeof b.date === "string" ? new Date(b.date) : b.date;

      // Create combined datetime for comparison
      const timeA = a.time.split(":");
      const timeB = b.time.split(":");

      dateA = new Date(dateObjA);
      dateA.setHours(
        parseInt(timeA[0]),
        parseInt(timeA[1]),
        parseInt(timeA[2] || 0)
      );

      dateB = new Date(dateObjB);
      dateB.setHours(
        parseInt(timeB[0]),
        parseInt(timeB[1]),
        parseInt(timeB[2] || 0)
      );
    } catch (error) {
      console.warn("Date parsing error:", error, { a, b });
      return 0;
    }

    // Check for invalid dates
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      console.warn("Invalid date after parsing:", { dateA, dateB, a, b });
      return 0;
    }

    // Determine if bookings are active (Pending or Confirmed status) - be very explicit
    const isActiveA = ["pending", "confirmed"].includes(
      String(a.status).toLowerCase()
    );
    const isActiveB = ["pending", "confirmed"].includes(
      String(b.status).toLowerCase()
    );

    // CRITICAL: Active bookings MUST come before non-active bookings
    if (isActiveA && !isActiveB) {
      return -1;
    }
    if (!isActiveA && isActiveB) {
      return 1;
    }

    // For ACTIVE bookings: sort by nearest due appointment (earliest first)
    if (isActiveA && isActiveB) {
      return dateA - dateB;
    }

    // For NON-ACTIVE bookings: sort by most recent appointment (latest date/time first)
    // This ensures the most recently completed appointments appear first
    return dateB - dateA;
  });

  // Log the final result to verify correct sorting
  console.log("=== FINAL SORTED ORDER ===");
  sortedBookings.forEach((booking, index) => {
    const isActive = ["pending", "confirmed"].includes(
      String(booking.status).toLowerCase()
    );
    console.log(
      `${index + 1}. ID: ${booking.id}, Status: ${
        booking.status
      }, Active: ${isActive}, Date: ${booking.date} ${booking.time}`
    );
  });
  console.log("=== END SORTED ORDER ===");

  const bookingsPerPage = 7;
  const totalPages = Math.min(
    Math.ceil(filteredBookings.length / bookingsPerPage),
    10
  );
  const currentBookings = sortedBookings.slice(
    (currentPage - 1) * bookingsPerPage,
    currentPage * bookingsPerPage
  );

  // Reset currentPage when selectedDate changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  // Function to disable dates not in bookingDates
  const shouldDisableDate = (date) => {
    if (!date || isNaN(date.getTime())) {
      console.warn("Invalid DatePicker date:", date);
      return true; // Disable invalid dates
    }
    const formattedDate = formatDate(date);
    if (!formattedDate) {
      console.warn("Formatted date is empty for:", date);
      return true; // Disable if formatting fails
    }
    console.log(
      "Checking date:",
      formattedDate,
      "in bookingDates:",
      bookingDates
    ); // Debug log to verify function
    return !bookingDates.includes(formattedDate);
  };

  // Logic to determine if Reschedule and Cancel buttons should be disabled
  const getButtonDisableStatus = (booking) => {
    if (!booking) return { rescheduleDisabled: true, cancelDisabled: true };

    const today = new Date();
    const bookingDate = new Date(booking.date);
    const diffTime = bookingDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const rescheduleDisabled = diffDays <= 2; // Disabled if within 2 days
    const cancelDisabled = diffDays <= 1; // Disabled if within 24 hours

    return { rescheduleDisabled, cancelDisabled };
  };

  const { rescheduleDisabled, cancelDisabled } = selectedBooking
    ? getButtonDisableStatus(selectedBooking)
    : { rescheduleDisabled: true, cancelDisabled: true };

  // Fetch available slots for rescheduling
  const fetchAvailableSlots = async (date) => {
    if (!selectedBooking || !date) return;
    try {
      setLoading(true);
      // Format date in Malaysia timezone (UTC+8)
      const formattedDate = date.toLocaleDateString('en-CA', { 
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-'); // YYYY-MM-DD for API
      
      // Include the current booking ID to exclude it from conflicts
      const response = await client.get("/bookings/available-slots", {
        params: {
          date: formattedDate,
          outlet_id: selectedBooking.outlet_id,
          service_id: selectedBooking.service_id,
          currentBookingId: selectedBooking.id, // Add current booking ID
          currentBookingTime: selectedBooking.time // Add current booking time
        },
      });
      
      console.log("Available slots response:", {
        date: formattedDate,
        slots: response.data,
        params: {
          outlet_id: selectedBooking.outlet_id,
          service_id: selectedBooking.service_id,
          currentBookingId: selectedBooking.id
        }
      });
      
      // Filter out any special values like 'CLOSED'
      const validSlots = Array.isArray(response.data) 
        ? response.data.filter(slot => typeof slot === 'string' && slot !== 'CLOSED')
        : [];
        
      setAvailableSlots(validSlots);
      
      if (validSlots.length === 0) {
        console.log("No available slots found for date:", formattedDate);
      }
    } catch (err) {
      console.error("Error fetching available slots:", err);
      setError("Failed to fetch available slots. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch available staff for rescheduling
  const fetchAvailableStaff = async (date, time) => {
    if (!selectedBooking || !date || !time) return;
    try {
      setLoading(true);
      // Format date in Malaysia timezone (UTC+8)
      const formattedDate = date.toLocaleDateString('en-CA', { 
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-'); // YYYY-MM-DD for API
      
      const response = await client.get("/bookings/available-staff", {
        params: {
          outlet_id: selectedBooking.outlet_id,
          date: formattedDate,
          time,
          service_id: selectedBooking.service_id,
          currentBookingId: selectedBooking.id, // Add current booking ID
          currentBookingTime: selectedBooking.time // Add current booking time
        },
      });
      
      console.log("Available staff response:", {
        date: formattedDate,
        time: time,
        staff: response.data,
        params: {
          outlet_id: selectedBooking.outlet_id,
          service_id: selectedBooking.service_id,
          currentBookingId: selectedBooking.id
        }
      });
      
      // Ensure we have a valid array of staff
      const validStaff = Array.isArray(response.data) ? response.data : [];
      
      // If the current staff is not in the list, add them
      const currentStaffId = selectedBooking.staff_id;
      if (currentStaffId && !validStaff.some(staff => staff.id === currentStaffId)) {
        // Try to get staff name from the booking
        const staffName = selectedBooking.staff_name || "Current Staff";
        
        console.log("Adding current staff to available staff list:", {
          id: currentStaffId,
          name: staffName
        });
        
        validStaff.push({
          id: currentStaffId,
          username: staffName,
          name: staffName
        });
      }
      
      setAvailableStaff(validStaff);
      
      // If we have staff but none are selected yet, default to current staff
      if (validStaff.length > 0 && !rescheduleStaffId && currentStaffId) {
        setRescheduleStaffId(currentStaffId);
      }
      
      if (validStaff.length === 0) {
        console.log("No available staff found for date:", formattedDate, "and time:", time);
      }
    } catch (err) {
      console.error("Error fetching available staff:", err);
      setError("Failed to fetch available staff. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle reschedule dialog open
  const handleOpenRescheduleDialog = (booking) => {
    setSelectedBooking(booking);
    setRescheduleDate(null);
    setRescheduleTime("");
    setRescheduleStaffId("");
    setAvailableSlots([]);
    setAvailableStaff([]);
    setRescheduleDialogOpen(true);
  };

  // Handle reschedule date change
  const handleRescheduleDateChange = (newDate) => {
    // Adjust date to Malaysia timezone (UTC+8)
    if (newDate) {
      // Create a date that's properly set to Malaysia timezone
      const malaysiaDate = new Date(newDate);
      // No need to adjust hours since we only care about the date part
    }
    
    setRescheduleDate(newDate);
    setRescheduleTime("");
    setRescheduleStaffId("");
    setAvailableStaff([]);
    if (newDate) {
      fetchAvailableSlots(newDate);
    }
  };

  // Handle reschedule time change
  const handleRescheduleTimeChange = (event) => {
    const time = event.target.value;
    setRescheduleTime(time);
    setRescheduleStaffId("");
    if (rescheduleDate && time) {
      fetchAvailableStaff(rescheduleDate, time);
    }
  };

  // Handle reschedule submission
  const handleRescheduleBooking = async () => {
    if (!rescheduleDate || !rescheduleTime || !rescheduleStaffId) {
      setError("Please select date, time, and staff");
      return;
    }
    
    try {
      setIsRescheduling(true);
      
      // Format date in Malaysia timezone (UTC+8)
      // Create a new date object to avoid modifying the original
      const malaysiaDate = new Date(rescheduleDate);
      // Format as YYYY-MM-DD for API
      const formattedDate = malaysiaDate.toLocaleDateString('en-CA', { 
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      
      // Get token and ensure we have authentication
      const customerToken = localStorage.getItem("customer_token");
      if (!customerToken) {
        setError("Authentication error. Please sign in again.");
        setTimeout(() => navigate("/homepage?loginRequired=true"), 2000);
        return;
      }
      
      // Check if anything actually changed
      const isSameDate = formattedDate === selectedBooking.date.split('T')[0];
      const isSameTime = rescheduleTime === selectedBooking.time;
      const isSameStaff = parseInt(rescheduleStaffId) === parseInt(selectedBooking.staff_id);
      
      if (isSameDate && isSameTime && isSameStaff) {
        setError("No changes detected. Please select a different date, time, or staff.");
        setIsRescheduling(false);
        return;
      }
      
      // Direct API call with explicit headers
      const response = await http.post(
        `${API_BASE_URL}/bookings/reschedule`,
        {
          booking_id: selectedBooking.id,  // Use booking_id as expected by the backend
          date: formattedDate,
          time: rescheduleTime,
          staff_id: rescheduleStaffId,
        },
        {
          headers: {
            "Authorization": `Bearer ${customerToken}`,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
          }
        }
      );
      
      console.log("Reschedule response:", response.data);
      
      await fetchBookings(); // Refresh bookings
      setSuccess("Booking rescheduled successfully!");
      setRescheduleDialogOpen(false);
    } catch (err) {
      console.error("Reschedule error:", err);
      
      // Simple error handling
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 401) {
        setError("Your session has expired. Please sign in again.");
        setTimeout(() => navigate("/homepage?loginRequired=true"), 2000);
      } else {
        setError("Unable to reschedule booking. Please try again later.");
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  // Handle opening cancel confirmation dialog
  const handleOpenCancelDialog = (booking) => {
    setSelectedBooking(booking);
    setConfirmCancelDialogOpen(true);
  };

  // Handle cancel booking
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    
    try {
      setIsCancelling(true);
      
      // Get token and ensure we have authentication
      const customerToken = localStorage.getItem("customer_token");
      if (!customerToken) {
        setError("Authentication error. Please sign in again.");
        setTimeout(() => navigate("/homepage?loginRequired=true"), 2000);
        return;
      }
      
      // Direct API call with explicit headers
      const response = await http.post(
        `${API_BASE_URL}/bookings/cancel`,
        { booking_id: selectedBooking.id },  // Use booking_id as expected by the backend
        { 
          headers: { 
            "Authorization": `Bearer ${customerToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      console.log("Cancel response:", response.data);
      
      await fetchBookings(); // Refresh bookings
      setSuccess("Booking cancelled successfully!");
      setConfirmCancelDialogOpen(false);
    } catch (err) {
      console.error("Cancel error:", err);
      
      // Simple error handling
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 401) {
        setError("Your session has expired. Please sign in again.");
        setTimeout(() => navigate("/homepage?loginRequired=true"), 2000);
      } else {
        setError("Unable to cancel booking. Please try again later.");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <Box className="booking-history-loading">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="booking-history-page">
      <Typography className="cust-booking-history-title">
        MY BOOKING HISTORY
      </Typography>
      <Box className="cust-main-container">
        <Box className="cust-bookings-container">
          {/* Calendar Filter at the top of booking list */}
          <Box
            className="cust-filter-container"
            style={{
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginLeft: "0",
              paddingLeft: "0",
            }}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              <input
                type="text"
                value={
                  selectedDate
                    ? selectedDate
                        .toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                        .replace(/\//g, "/")
                    : ""
                }
                onClick={() => setIsDatePickerOpen(true)}
                readOnly
                placeholder="--SELECT DATE--"
                style={{
                  color: "#1a1a1a",
                  fontFamily: "Quicksand",
                  backgroundColor: "#ffffff",
                  borderRadius: "10px",
                  padding: "3px 40px 3px 12px",
                  fontSize: "14px",
                  height: "25px",
                  lineHeight: "1.2",
                  border: "1px solid #1a1a1a",
                  cursor: "pointer",
                  width: "200px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                  e.target.style.transform = "translateY(0)";
                }}
              />
              {selectedDate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(null);
                  }}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#ff6b4a",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                    padding: "0",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    transition: "all 0.2s ease",
                    zIndex: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "rgba(255, 107, 74, 0.1)";
                    e.target.style.color = "#e55a42";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "transparent";
                    e.target.style.color = "#ff6b4a";
                  }}
                  title="Clear date filter"
                >
                  ✕
                </button>
              )}
              <SimpleCalendar
                value={selectedDate}
                onChange={(newValue) => {
                  // Only allow dates that have bookings
                  if (newValue && bookingDates.includes(formatDate(newValue))) {
                    setSelectedDate(newValue);
                    setIsDatePickerOpen(false);
                  } else if (!newValue) {
                    setSelectedDate(null);
                    setIsDatePickerOpen(false);
                  }
                }}
                open={isDatePickerOpen}
                onClose={() => setIsDatePickerOpen(false)}
                shouldDisableDate={(date) =>
                  !bookingDates.includes(formatDate(date))
                }
              />
            </div>
          </Box>
          {error && <Typography color="error">{error}</Typography>}
          {currentBookings.length === 0 && (
            <Typography>You have no bookings at the moment.</Typography>
          )}
          {currentBookings.map((booking) => (
            <Card
              key={booking.id}
              className={`cust-booking-card ${
                countdowns[booking.id] && countdowns[booking.id] <= 60
                  ? "upcoming-soon"
                  : ""
              }`}
              sx={{ marginBottom: "20px" }}
            >
                <CardContent className="cust-booking-row" sx={{ display: 'flex', alignItems: 'center', padding: '10px !important' }}>
                <Box className="cust-booking-id-date">
                  <Typography
                    variant="h6"
                    style={{
                      fontFamily: "Glacial Indifference",
                      width: "270px",
                      margin: 0,
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    ID: #{String(booking.id).padStart(7, "0")} | Booked:{" "}
                    {formatDate(booking.date)}
                  </Typography>
                </Box>
                <Box className="cust-booking-status">
                  {(() => {
                    // Debug logging
                    console.log(
                      `Booking ${booking.id} status: "${
                        booking.status
                      }" (type: ${typeof booking.status})`
                    );
                    const isActive = ["pending", "confirmed"].includes(
                      String(booking.status).toLowerCase()
                    );
                    console.log(`Is active: ${isActive}`);
                    return isActive;
                  })() && (
                    <span
                      className="cust-active-dot"
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#00fa1b",
                        borderRadius: "50%",
                      }}
                    ></span>
                  )}
                </Box>
                <Box className="cust-booking-actions">
                  <Button
                    variant="contained"
                    onClick={
                      booking.status === "Completed" && !booking.review
                        ? () => handleRateUs(booking)
                        : () => handleViewDetails(booking)
                    }
                    className="cust-details-btn"
                  >
                    {booking.status === "Completed" && !booking.review
                      ? "Rate Us"
                      : "View Details"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
          {totalPages > 1 && (
            <Box
              className="cust-pagination"
              sx={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <Button
                className="cust-pagination-btn"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                sx={{ minWidth: "40px", padding: "8px", borderRadius: "50%" }}
              >
                {"<"}
              </Button>
              <Typography className="cust-pagination-text">
                {currentPage}/{totalPages}
              </Typography>
              <Button
                className="cust-pagination-btn"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                sx={{ minWidth: "40px", padding: "8px", borderRadius: "50%" }}
              >
                {">"}
              </Button>
            </Box>
          )}
        </Box>
        <Box className="cust-details-container">
          {selectedBooking ? (
            showFeedbackForm &&
            (selectedBooking.status === "Completed" ||
              selectedBooking.status === "Cancelled") &&
            !selectedBooking.review ? (
              <Box className="feedback-form">
                <Typography
                  variant="h5"
                  style={{
                    color: "#fff",
                    textAlign: "center",
                    marginBottom: "20px",
                    fontFamily: "Quicksand",
                    fontWeight: "bold",
                  }}
                >
                  Your opinion matters to us
                </Typography>
                <Box
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "20px",
                  }}
                >
                  <Rating
                    value={rating}
                    onChange={(e, newValue) => setRating(newValue)}
                    size="large"
                    style={{ fontSize: "2.5rem", gap: "10px" }}
                    sx={{
                      "& .MuiRating-iconFilled": { color: "#ffff00" },
                      "& .MuiRating-iconEmpty": {
                        color: "#fff",
                        WebkitTextStroke: "1px white",
                      },
                    }}
                  />
                </Box>
                <TextField
                  variant="outlined"
                  placeholder="Write your feedback..."
                  value={feedbackText}
                  onChange={(e) => {
                    const words = e.target.value
                      .trim()
                      .split(/\s+/)
                      .slice(0, 45)
                      .join(" ");
                    setFeedbackText(words);
                  }}
                  fullWidth
                  multiline
                  rows={4}
                  style={{
                    backgroundColor: "#000",
                    color: "#fff",
                    marginBottom: "20px",
                    borderRadius: "10px",
                    width: "80%",
                    border: "1px solid #fff",
                    fontFamily: "Quicksand",
                  }}
                  InputProps={{
                    style: { color: "#fff", fontFamily: "Quicksand" },
                  }}
                  InputLabelProps={{
                    style: { color: "#fff", fontFamily: "Quicksand" },
                  }}
                  sx={{
                    "& .MuiInputBase-input::placeholder": {
                      fontFamily: "Quicksand",
                      color: "#fff",
                      opacity: 0.7,
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSubmitFeedback}
                  style={{
                    backgroundColor: rating > 0 ? "#007bff" : "#666",
                    color: "#fff",
                  }}
                  disabled={rating === 0}
                >
                  Submit Feedback
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h3">
                  #{String(selectedBooking.id).padStart(7, "0")} | Booked:{" "}
                  {formatDate(selectedBooking.date)}
                  {["Pending", "Confirmed"].includes(
                    selectedBooking.status
                  ) && (
                    <>
                      <span
                        className="cust-status-dot"
                        style={{ color: "#00fa1b" }}
                      >
                        {" "}
                        ●
                      </span>
                      <span
                        style={{
                          color: "#aaaaaa",
                          fontStyle: "italic",
                          fontSize: "10px",
                        }}
                      >
                        Active Booking
                      </span>
                    </>
                  )}
                </Typography>
                <Box className="cust-details-rows">
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Customer Name:</span>{" "}
                    {selectedBooking.customer_name}
                  </Typography>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Outlet:</span>{" "}
                    {selectedBooking.outlet_shortform}
                  </Typography>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Barber:</span>{" "}
                    {selectedBooking.staff_name}
                  </Typography>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Service:</span>{" "}
                    {selectedBooking.service_name}
                  </Typography>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Time:</span>{" "}
                    {selectedBooking.time}
                  </Typography>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Status:</span>{" "}
                    {selectedBooking.status}
                  </Typography>
                  <Typography>
                    <span style={{ fontWeight: "bold" }}>Payment:</span>{" "}
                    {selectedBooking.payment_status}
                  </Typography>
                </Box>
                {selectedBooking.status !== "Pending" &&
                  selectedBooking.review && (
                    <Box className="cust-feedback-section">
                      <hr
                        style={{
                          border: "0.1px solid #fff",
                          opacity: 0.5,
                          marginTop: "20px",
                          marginLeft: "2px",
                          marginRight: "30px",
                        }}
                      />
                      <Typography
                        style={{
                          fontFamily: "Quicksand",
                          fontSize: "15px",
                          fontWeight: "bold",
                          color: "#fff",
                          marginLeft: "2px",
                          marginTop: "10px",
                        }}
                      >
                        My feedback
                      </Typography>
                      <Typography
                        style={{
                          fontFamily: "Quicksand",
                          fontSize: "14px",
                          color: "#ffff00",
                          marginLeft: "2px",
                        }}
                      >
                        {"★ ".repeat(
                          Math.min(selectedBooking.review.rating, 5)
                        ) +
                          "☆ ".repeat(
                            Math.max(0, 5 - selectedBooking.review.rating)
                          )}
                      </Typography>
                      {selectedBooking.review.comment ? (
                        <Typography
                          style={{
                            fontFamily: "Quicksand",
                            fontStyle: "italic",
                            fontSize: "14px",
                            color: "#fff",
                            marginLeft: "2px",
                            textAlign: "justify",
                            width: "95%",
                          }}
                        >
                          {selectedBooking.review.comment}
                        </Typography>
                      ) : (
                        <Typography
                          style={{
                            fontFamily: "Quicksand",
                            fontStyle: "italic",
                            fontSize: "14px",
                            color: "#fff",
                            marginLeft: "2px",
                          }}
                        >
                          -blank-
                        </Typography>
                      )}
                    </Box>
                  )}
                <Box className="cust-actions">
                  {["Pending", "Confirmed"].includes(
                    selectedBooking.status
                  ) && (
                    <>
                      <Tooltip
                        title={
                          rescheduleDisabled
                            ? "Cannot reschedule within 2 days of the booking date"
                            : "Reschedule this booking"
                        }
                        placement="top"
                      >
                        <span>
                          <Button
                            variant="contained"
                            onClick={() => handleOpenRescheduleDialog(selectedBooking)}
                            className="cust-reschedule-btn"
                            disabled={rescheduleDisabled}
                          >
                            Reschedule
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          cancelDisabled
                            ? "Cannot cancel within 24 hours of the booking date"
                            : "Cancel this booking"
                        }
                        placement="top"
                      >
                        <span>
                          <Button
                            variant="contained"
                            onClick={() => handleOpenCancelDialog(selectedBooking)}
                            className="cust-cancel-btn"
                            disabled={cancelDisabled}
                          >
                            Cancel
                          </Button>
                        </span>
                      </Tooltip>
                    </>
                  )}
                  <Button
                    variant="contained"
                    onClick={() => handleDownloadReceiptLocal(selectedBooking)}
                    className="cust-receipt-btn"
                  >
                    Download Receipt
                  </Button>
                </Box>
              </>
            )
          ) : (
            <Typography>-- SELECT BOOKING --</Typography>
          )}
        </Box>
      </Box>
      <Snackbar
        open={!!success}
        autoHideDuration={5000}
        onClose={() => setSuccess("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        sx={{
          "& .MuiSnackbarContent-root": {
            minWidth: "320px",
            maxWidth: "500px",
          },
          zIndex: 1002,
        }}
      >
        <Alert
          severity="success"
          onClose={() => setSuccess("")}
          sx={{
            width: "100%",
            fontSize: "0.9rem",
            fontFamily: "Quicksand, sans-serif",
            fontWeight: 500,
            backgroundColor: "#4caf50", // Green for success
            color: "#fff",
            border: "2px solid #4caf50",
            "& .MuiAlert-icon": {
              color: "#fff",
              fontSize: "1.2rem",
            },
            "& .MuiAlert-action": {
              color: "#fff",
              "& .MuiIconButton-root": {
                color: "#fff",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                },
              },
            },
            borderRadius: "12px",
            boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            "& .MuiAlert-message": {
              padding: "0",
              display: "flex",
              alignItems: "center",
            },
          }}
        >
          {success}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        sx={{
          "& .MuiSnackbarContent-root": {
            minWidth: "320px",
            maxWidth: "500px",
          },
          zIndex: 1002,
        }}
      >
        <Alert
          severity="error"
          onClose={() => setError("")}
          sx={{
            width: "100%",
            fontSize: "0.9rem",
            fontFamily: "Quicksand, sans-serif",
            fontWeight: 500,
            backgroundColor: "#ff6b4a", // Red for error
            color: "#fff",
            border: "2px solid #ff6b4a",
            "& .MuiAlert-icon": {
              color: "#fff",
              fontSize: "1.2rem",
            },
            "& .MuiAlert-action": {
              color: "#fff",
              "& .MuiIconButton-root": {
                color: "#fff",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                },
              },
            },
            borderRadius: "12px",
            boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            "& .MuiAlert-message": {
              padding: "0",
              display: "flex",
              alignItems: "center",
            },
          }}
        >
          {error}
        </Alert>
      </Snackbar>
            {/* Reschedule Dialog */}
      <Dialog 
        open={rescheduleDialogOpen} 
        onClose={() => !isRescheduling && setRescheduleDialogOpen(false)}
        className="reschedule-dialog"
        maxWidth="xs"
        PaperProps={{
          sx: {
            width: '350px',
            maxWidth: '90vw'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          py: 1.5,
          px: 2
        }}>
          <Box sx={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography sx={{ color: '#007bff', fontSize: '16px' }}>↻</Typography>
          </Box>
          <Typography sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
            Reschedule Booking #{selectedBooking?.id ? String(selectedBooking.id).padStart(7, "0") : ""}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium', fontSize: '0.9rem' }}>
              Please select a new date, time, and staff for your booking.
            </Typography>
            
            {selectedBooking && (
              <Box sx={{ 
                p: 1.5, 
                mb: 2,
                bgcolor: 'rgba(255,255,255,0.05)', 
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.85rem'
              }}>
                <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
                  <strong>Current:</strong> {formatDate(selectedBooking.date)}, {selectedBooking.time}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  <strong>Service:</strong> {selectedBooking.service_name}
                </Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Select New Date"
                  value={rescheduleDate}
                  onChange={handleRescheduleDateChange}
                  minDate={new Date(new Date().setDate(new Date().getDate() + 3))} // Enforce >2 days
                  format="dd/MM/yyyy" // Use dd/MM/yyyy in DatePicker
                  disabled={isRescheduling}
                  timezone="Asia/Kuala_Lumpur" // Set Malaysia timezone
                  sx={{
                    width: '220px',
                    '& .MuiInputBase-input': { color: '#fff', fontSize: '0.9rem', py: 1 },
                    '& .MuiInputLabel-root': { color: '#fff', fontSize: '0.9rem' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                    '& .MuiSvgIcon-root': { color: '#fff', fontSize: '1.2rem' }
                  }}
                  slotProps={{
                    textField: {
                      margin: "normal",
                      helperText: "Min. 3 days from today (Malaysia Time)",
                      InputProps: {
                        style: { color: '#fff' }
                      },
                      InputLabelProps: {
                        style: { color: '#fff' }
                      },
                      FormHelperTextProps: {
                        style: { color: '#999', fontSize: '0.75rem' }
                      }
                    }
                  }}
                />
              </LocalizationProvider>
              
              <FormControl 
                margin="normal" 
                disabled={!rescheduleDate || isRescheduling}
                sx={{ width: '220px', display: 'block', my: 1 }}
              >
                <InputLabel sx={{ fontSize: '0.9rem' }}>Available Time Slots</InputLabel>
                <Select
                  value={rescheduleTime}
                  onChange={handleRescheduleTimeChange}
                  label="Available Time Slots"
                  size="small"
                  sx={{ fontSize: '0.9rem' }}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 250,
                        backgroundColor: '#1a1a1a',
                        color: '#fff'
                      }
                    }
                  }}
                >
                  {availableSlots.length > 0 ? (
                    availableSlots.map((slot) => (
                      <MenuItem key={slot} value={slot} sx={{ fontSize: '0.9rem' }}>
                        {slot}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled value="" sx={{ fontSize: '0.9rem' }}>
                      {rescheduleDate ? "No available slots for this date" : "Select a date first"}
                    </MenuItem>
                  )}
                </Select>
                <FormHelperText sx={{ fontSize: '0.75rem' }}>
                  {rescheduleDate && availableSlots.length === 0 
                    ? "No available slots for this date." 
                    : "Only available slots are shown"}
                </FormHelperText>
              </FormControl>
              
              <FormControl 
                margin="normal" 
                disabled={!rescheduleTime || isRescheduling}
                sx={{ width: '220px', display: 'block', my: 1 }}
              >
                <InputLabel sx={{ fontSize: '0.9rem' }}>Staff</InputLabel>
                <Select
                  value={rescheduleStaffId}
                  onChange={(e) => setRescheduleStaffId(e.target.value)}
                  label="Staff"
                  size="small"
                  sx={{ fontSize: '0.9rem' }}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 250,
                        backgroundColor: '#1a1a1a',
                        color: '#fff'
                      }
                    }
                  }}
                >
                  {availableStaff.length > 0 ? (
                    availableStaff.map((staff) => (
                      <MenuItem key={staff.id} value={staff.id} sx={{ fontSize: '0.9rem' }}>
                        {staff.username}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled value="" sx={{ fontSize: '0.9rem' }}>
                      {rescheduleTime ? "No available staff for this time" : "Select a time first"}
                    </MenuItem>
                  )}
                </Select>
                <FormHelperText sx={{ fontSize: '0.75rem' }}>
                  {rescheduleTime && availableStaff.length === 0 
                    ? "No staff available for this time." 
                    : "Select your preferred staff"}
                </FormHelperText>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #333', p: 1.5, px: 2 }}>
          <Button 
            onClick={() => setRescheduleDialogOpen(false)} 
            className="reschedule-cancel-btn"
            disabled={isRescheduling}
            sx={{
              fontFamily: 'Quicksand, sans-serif',
              textTransform: 'none',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              minWidth: '90px'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRescheduleBooking}
            disabled={!rescheduleDate || !rescheduleTime || !rescheduleStaffId || isRescheduling}
            className="reschedule-confirm-btn"
            sx={{
              fontFamily: 'Quicksand, sans-serif',
              textTransform: 'none',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              minWidth: '130px'
            }}
          >
            {isRescheduling ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={14} color="inherit" />
                <span>Rescheduling...</span>
              </Box>
            ) : "Confirm Reschedule"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog 
        open={confirmCancelDialogOpen} 
        onClose={() => !isCancelling && setConfirmCancelDialogOpen(false)}
        className="reschedule-dialog"
        maxWidth="sm"
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Box sx={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            backgroundColor: 'rgba(236, 31, 35, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography sx={{ color: '#ec1f23', fontSize: '20px' }}>!</Typography>
          </Box>
          <Typography sx={{ fontWeight: 'bold' }}>Confirm Cancellation</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
            Are you sure you want to cancel this booking?
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: '#ff6b4a', fontStyle: 'italic' }}>
            This action cannot be undone.
          </Typography>
          {selectedBooking && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.05)', 
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Booking ID:</strong> #{String(selectedBooking.id).padStart(7, "0")}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Service:</strong> {selectedBooking.service_name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Date:</strong> {formatDate(selectedBooking.date)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Time:</strong> {selectedBooking.time}
              </Typography>
              <Typography variant="body2">
                <strong>Staff:</strong> {selectedBooking.staff_name}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #333', p: 2 }}>
          <Button 
            onClick={() => setConfirmCancelDialogOpen(false)} 
            className="reschedule-cancel-btn"
            disabled={isCancelling}
            sx={{
              fontFamily: 'Quicksand, sans-serif',
              textTransform: 'none',
              fontWeight: 'bold',
              minWidth: '120px'
            }}
          >
            Keep Booking
          </Button>
          <Button
            onClick={handleCancelBooking}
            className="reschedule-confirm-btn"
            sx={{ 
              bgcolor: '#ec1f23 !important', 
              '&:hover': { bgcolor: '#d81b1f !important' },
              fontFamily: 'Quicksand, sans-serif',
              textTransform: 'none',
              fontWeight: 'bold',
              minWidth: '160px'
            }}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} color="inherit" />
                <span>Cancelling...</span>
              </Box>
            ) : "Yes, Cancel Booking"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookingHistory;



