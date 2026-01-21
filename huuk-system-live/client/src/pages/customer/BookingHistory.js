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
} from "@mui/material";
import SimpleCalendar from "../../components/common/SimpleCalendar";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import client from "../../api/client";
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
      // Check for customer token first, then fallback to generic token for backward compatibility
      const customerToken = localStorage.getItem("customer_token");
      const genericToken = localStorage.getItem("token");
      const token = customerToken || genericToken;

      if (!token) {
        throw new Error("No authentication token found. Please sign in again.");
      }

      const response = await client.get("/bookings", {
        headers: {
          "Cache-Control": "no-cache",
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Fetched bookings:", response.data); // Debug fetched data
      console.log(
        "API response status:",
        response.status,
        "headers:",
        response.headers
      ); // Additional debug

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
      console.error("Error fetching bookings:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        code: err.code,
      });

      // Handle different error types
      if (err.response?.status === 401) {
        setError("Authentication failed. Please sign in again.");
        // Clear invalid tokens - check both customer and generic tokens
        localStorage.removeItem("customer_token");
        localStorage.removeItem("customer_loggedInUser");
        localStorage.removeItem("token");
        localStorage.removeItem("loggedInUser");
        setTimeout(() => {
          navigate("/homepage?loginRequired=true");
        }, 2000);
      } else if (err.response?.status === 403) {
        setError("Access denied. Please contact support.");
      } else if (err.response?.status === 404) {
        setError("Booking service not found. Please try again later.");
      } else if (err.code === "NETWORK_ERROR" || err.code === "ERR_NETWORK") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(
          err.response?.data?.message ||
            "Failed to load bookings. Please try again later."
        );
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
      const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD for API
      const response = await client.get("/bookings/available-slots", {
        params: {
          date: formattedDate,
          outlet_id: selectedBooking.outlet_id,
          service_id: selectedBooking.service_id,
        },
      });
      setAvailableSlots(response.data);
    } catch (err) {
      setError("Failed to fetch available slots");
    }
  };

  // Fetch available staff for rescheduling
  const fetchAvailableStaff = async (date, time) => {
    if (!selectedBooking || !date || !time) return;
    try {
      const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD for API
      const response = await client.get("/bookings/available-staff", {
        params: {
          outlet_id: selectedBooking.outlet_id,
          date: formattedDate,
          time,
          service_id: selectedBooking.service_id,
        },
      });
      setAvailableStaff(response.data);
    } catch (err) {
      setError("Failed to fetch available staff");
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
      const formattedDate = rescheduleDate.toISOString().split("T")[0]; // YYYY-MM-DD for API
      await client.post("/bookings/reschedule", {
        booking_id: selectedBooking.id,
        date: formattedDate,
        time: rescheduleTime,
        staff_id: rescheduleStaffId,
      });
      await fetchBookings(); // Refresh bookings
      setSuccess("Booking rescheduled successfully!");
      setRescheduleDialogOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reschedule booking");
    }
  };

  // Handle cancel booking
  const handleCancelBooking = async (booking) => {
    try {
      await client.post("/bookings/cancel", {
        booking_id: booking.id,
      });
      await fetchBookings(); // Refresh bookings
      setSuccess("Booking cancelled successfully!");
      setSelectedBooking(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel booking");
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
            >
              <CardContent className="cust-booking-row">
                <Box className="cust-booking-id-date">
                  <Typography
                    variant="h6"
                    style={{
                      fontFamily: "Glacial Indifference",
                      width: "270px",
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
                      (booking.status === "Completed" ||
                        booking.status === "Cancelled") &&
                      !booking.review
                        ? () => handleRateUs(booking)
                        : () => handleViewDetails(booking)
                    }
                    className="cust-details-btn"
                  >
                    {(booking.status === "Completed" ||
                      booking.status === "Cancelled") &&
                    !booking.review
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
                            : ""
                        }
                      >
                        <span>
                          <Button
                            variant="contained"
                            onClick={() =>
                              handleOpenRescheduleDialog(selectedBooking)
                            }
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
                            : ""
                        }
                      >
                        <span>
                          <Button
                            variant="contained"
                            onClick={() => handleCancelBooking(selectedBooking)}
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
      <Dialog
        open={rescheduleDialogOpen}
        onClose={() => setRescheduleDialogOpen(false)}
      >
        <DialogTitle>Reschedule Booking</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Select New Date"
              value={rescheduleDate}
              onChange={handleRescheduleDateChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{
                    style: { color: "#1a1a1a", fontFamily: "Quicksand" },
                  }}
                />
              )}
              minDate={new Date(new Date().setDate(new Date().getDate() + 3))} // Enforce >2 days
              format="dd/MM/yyyy" // Use dd/MM/yyyy in DatePicker
            />
          </LocalizationProvider>
          <FormControl fullWidth margin="normal">
            <InputLabel>Time</InputLabel>
            <Select
              value={rescheduleTime}
              onChange={handleRescheduleTimeChange}
              label="Time"
              disabled={!availableSlots.length}
            >
              {availableSlots.map((slot) => (
                <MenuItem key={slot} value={slot}>
                  {slot}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Staff</InputLabel>
            <Select
              value={rescheduleStaffId}
              onChange={(e) => setRescheduleStaffId(e.target.value)}
              label="Staff"
              disabled={!availableStaff.length}
            >
              {availableStaff.map((staff) => (
                <MenuItem key={staff.id} value={staff.id}>
                  {staff.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRescheduleBooking}
            disabled={!rescheduleDate || !rescheduleTime || !rescheduleStaffId}
          >
            Reschedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookingHistory;
