import http from "./httpClient";
import client, {
  deleteBooking,
  setPayAtOutlet,
  updatePaymentStatus,
  checkPaymentStatusBySession,
  setMultiplePayAtOutlet,
} from "../api/client";
import { API_BASE_URL } from "./constants";
import { getAuthToken, getUserData } from "./tokenUtils";

// Add this helper function near the top of the file
export const verifyAuthentication = () => {
  // Detailed logging of token state
  const customerToken = localStorage.getItem("customer_token");
  const staffToken = localStorage.getItem("staff_token");
  const legacyToken = localStorage.getItem("token");

  console.log("🔑 [AUTH CHECK] Token availability:", {
    customerToken: customerToken
      ? `${customerToken.substring(0, 10)}...`
      : "missing",
    staffToken: staffToken ? `${staffToken.substring(0, 10)}...` : "missing",
    legacyToken: legacyToken ? `${legacyToken.substring(0, 10)}...` : "missing",
  });

  // Detailed logging of user data state
  const customerUserJson = localStorage.getItem("customer_loggedInUser");
  const staffUserJson = localStorage.getItem("staff_loggedInUser");
  const legacyUserJson = localStorage.getItem("loggedInUser");

  console.log("👤 [AUTH CHECK] User data availability:", {
    customerUserJson: customerUserJson ? "present" : "missing",
    staffUserJson: staffUserJson ? "present" : "missing",
    legacyUserJson: legacyUserJson ? "present" : "missing",
  });

  // Try to parse user data
  let userData = null;
  try {
    if (customerUserJson) userData = JSON.parse(customerUserJson);
    else if (staffUserJson) userData = JSON.parse(staffUserJson);
    else if (legacyUserJson) userData = JSON.parse(legacyUserJson);
  } catch (error) {
    console.error("❌ [AUTH CHECK] Error parsing user data:", error);
  }

  console.log(
    "🔐 [AUTH CHECK] Parsed user data:",
    userData
      ? {
          id: userData.id || "missing",
          role: userData.role || "missing",
          email: userData.email || "missing",
          phone_number: userData.phone_number || "missing",
        }
      : "No valid user data found",
  );

  const token = customerToken || staffToken || legacyToken;

  return {
    isAuthenticated: !!token && !!userData,
    token,
    userData,
  };
};

// Normalize time to HH:MM format with robust string cleaning
export const normalizeTime = (time) => {
  console.log(
    "🔧 [NORMALIZE] Input time:",
    time,
    "Type:",
    typeof time,
    "Constructor:",
    time?.constructor?.name,
  );

  if (!time) {
    console.log("🔧 [NORMALIZE] Empty time, returning empty string");
    return "";
  }

  // If it's an object, try to extract time from it
  if (typeof time === "object" && time !== null) {
    console.log("🔧 [NORMALIZE] Time is object, keys:", Object.keys(time));
    // Check if it's a Date object
    if (time instanceof Date) {
      const result = time.toTimeString().substring(0, 5);
      console.log("🔧 [NORMALIZE] Date object converted to:", result);
      return cleanTimeString(result);
    }
    // Check if it has a time property
    if (time.time) {
      console.log("🔧 [NORMALIZE] Object has time property:", time.time);
      return normalizeTime(time.time);
    }
    // Check if it has a value property
    if (time.value) {
      console.log("🔧 [NORMALIZE] Object has value property:", time.value);
      return normalizeTime(time.value);
    }
    // If it's an object we can't handle, convert to string
    console.warn(
      "🔧 [NORMALIZE] Unknown object type, converting to string:",
      JSON.stringify(time),
    );
    return cleanTimeString(String(time));
  }

  // Convert to string if it's not already
  const timeStr = String(time);
  console.log("🔧 [NORMALIZE] String representation:", timeStr);

  // Clean the string first
  const cleanedTimeStr = cleanTimeString(timeStr);
  console.log(
    "🔧 [NORMALIZE] Cleaned string:",
    cleanedTimeStr,
    "Character codes:",
    cleanedTimeStr.split("").map((c) => c.charCodeAt(0)),
  );

  // If it's already in HH:MM format, return as is
  if (/^\d{2}:\d{2}$/.test(cleanedTimeStr)) {
    console.log("🔧 [NORMALIZE] Already in HH:MM format:", cleanedTimeStr);
    return cleanedTimeStr;
  }

  // If it's HH:MM:SS format, extract HH:MM
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleanedTimeStr)) {
    const result = cleanedTimeStr.substring(0, 5);
    console.log("🔧 [NORMALIZE] HH:MM:SS format converted to:", result);
    return result;
  }

  // If it's a different format, try to parse and format
  try {
    const date = new Date(`1970-01-01T${cleanedTimeStr}`);
    const result = date.toTimeString().substring(0, 5);
    console.log("🔧 [NORMALIZE] Parsed and formatted to:", result);
    return cleanTimeString(result);
  } catch (error) {
    console.warn(
      "🔧 [NORMALIZE] Failed to normalize time:",
      cleanedTimeStr,
      "Error:",
      error.message,
    );
    return cleanedTimeStr;
  }
};

// Helper function to clean time strings of invisible characters and whitespace
const cleanTimeString = (timeStr) => {
  if (!timeStr) return "";

  return String(timeStr)
    .trim() // Remove leading/trailing whitespace
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces with regular spaces
    .replace(/\s+/g, "") // Remove all remaining whitespace characters
    .replace(/[^\d:]/g, "") // Keep only digits and colons
    .trim(); // Final trim
};

// Simple time comparison function that handles various time formats
const isTimeAvailable = (selectedTime, availableSlots) => {
  console.log("🔍 [TIME COMPARE] Checking if time is available:", selectedTime);
  console.log("🔍 [TIME COMPARE] Available slots:", availableSlots.slice(0, 3));
  console.log("🔍 [TIME COMPARE] All available slots:", availableSlots);

  // Try direct string comparison first
  if (availableSlots.includes(selectedTime)) {
    console.log("✅ [TIME COMPARE] Direct match found");
    return true;
  }

  // Try normalized comparison
  const normalizedSelected = normalizeTime(selectedTime);
  const normalizedSlots = availableSlots.map((slot) => normalizeTime(slot));

  console.log("🔍 [TIME COMPARE] Normalized selected:", normalizedSelected);
  console.log(
    "🔍 [TIME COMPARE] Normalized slots sample:",
    normalizedSlots.slice(0, 3),
  );
  console.log("🔍 [TIME COMPARE] All normalized slots:", normalizedSlots);

  // Detailed comparison for debugging
  console.log("🔍 [TIME COMPARE] Detailed slot comparison:");
  normalizedSlots.forEach((slot, index) => {
    const match = slot === normalizedSelected;
    console.log(
      `  Slot ${index}: "${availableSlots[index]}" -> "${slot}" vs "${normalizedSelected}" = ${match}`,
    );
    if (match) {
      console.log(
        "✅ [TIME COMPARE] Match found in detailed comparison at index:",
        index,
      );
    }
  });

  if (normalizedSlots.includes(normalizedSelected)) {
    console.log("✅ [TIME COMPARE] Normalized match found");
    return true;
  }

  // Try simple time parsing comparison
  try {
    const selectedParts = selectedTime.split(":");
    const selectedHour = parseInt(selectedParts[0]);
    const selectedMin = parseInt(selectedParts[1]);

    for (const slot of availableSlots) {
      const slotParts = slot.split(":");
      const slotHour = parseInt(slotParts[0]);
      const slotMin = parseInt(slotParts[1]);

      if (selectedHour === slotHour && selectedMin === slotMin) {
        console.log("✅ [TIME COMPARE] Time parts match found");
        return true;
      }
    }
  } catch (error) {
    console.warn("⚠️ [TIME COMPARE] Error in time parts comparison:", error);
  }

  console.log("❌ [TIME COMPARE] No match found");
  return false;
};

export const toTitleCase = (str) => {
  return str.toLowerCase().replace(/(^|\s)\w/g, (char) => char.toUpperCase());
};

export const validateForm = (
  selectedDate,
  outletId,
  staffId,
  serviceId,
  time,
  clientName,
) => {
  return (
    !!selectedDate &&
    !!outletId &&
    (staffId || staffId === "any") &&
    !!serviceId &&
    !!time &&
    clientName &&
    clientName.length <= 10
  );
};

export const getActiveStep = (
  selectedDate,
  outletId,
  staffId,
  serviceId,
  time,
  clientName,
) => {
  if (!selectedDate) return 0;
  if (!outletId) return 1;
  if (!staffId && staffId !== "any") return 2;
  if (!serviceId) return 3;
  if (!time) return 4;
  if (!clientName || clientName.length > 10) return 5;
  return 6;
};

export const fetchReview = async (bookingId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await client.get(`/reviews/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`Review for booking ${bookingId}:`, response.data);
    return response.data;
  } catch (error) {
    console.log(`No review found for booking ${bookingId}:`, {
      message: error.message,
      status: error.response?.status,
      code: error.code,
    });
    return null;
  }
};

export const handleSignIn = async (
  e,
  signInPhoneNumber,
  signInPassword,
  setLoading,
  setSignInErrors,
  setIsSignInOpen,
  setSignInPhoneNumber,
  setSignInPassword,
  handleBookingSubmit,
  updateProfile,
  setIsBookingDetailsOpen,
) => {
  e.preventDefault();
  setLoading((prev) => ({ ...prev, signIn: true }));
  setSignInErrors({ phoneNumber: "", password: "" });

  console.log("[SIGN IN] Starting authentication process");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log("[SIGN IN] Making authentication request to server");
    const response = await http.post(
      `${API_BASE_URL}/auth/customer/signin`,
      {
        phone_number: signInPhoneNumber,
        password: signInPassword,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);
    console.log("[SIGN IN] Authentication response received:", {
      success: response.data.success,
      hasUser: !!response.data.user,
      hasToken: !!response.data.token,
    });

    if (response.data.success && response.data.user && response.data.token) {
      // Store customer-specific tokens for proper authentication
      const userWithToken = {
        ...response.data.user,
        token: response.data.token,
      };

      console.log("[SIGN IN] Storing authentication data:", {
        userId: userWithToken.id,
        role: userWithToken.role,
        hasToken: !!userWithToken.token,
      });

      // Primary storage for customer session
      localStorage.setItem(
        "customer_loggedInUser",
        JSON.stringify(userWithToken),
      );
      localStorage.setItem("customer_token", response.data.token);
      localStorage.setItem("customer_userId", String(response.data.user.id));

      // Keep legacy storage for backward compatibility
      localStorage.setItem("loggedInUser", JSON.stringify(userWithToken));
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userId", String(response.data.user.id));

      console.log("[SIGN IN] Authentication data stored successfully");

      // Update profile context immediately after successful sign-in
      if (updateProfile) {
        console.log("[SIGN IN] Updating profile context");
        updateProfile(userWithToken);
      }

      // Close sign-in modal and clear form
      setIsSignInOpen(false);
      setSignInPhoneNumber("");
      setSignInPassword("");

      console.log(
        "[SIGN IN] Authentication successful, proceeding with booking",
      );

      // REMOVE: setTimeout/auto-submit logic for handleBookingSubmit
    } else {
      throw new Error("Invalid sign-in response from server");
    }
  } catch (error) {
    console.error("Sign-in error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code,
      url: error.config?.url,
      method: error.config?.method,
    });

    let message = "Something went wrong. Please try again.";

    if (error.name === "AbortError") {
      message = "Request timed out. Please check your connection.";
    } else if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
      message = "Network error. Please check your connection and try again.";
    } else if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const responseData = error.response.data;

      switch (status) {
        case 400:
          message =
            responseData?.message ||
            "Invalid request. Please check your input.";
          break;
        case 401:
          message =
            responseData?.message || "Invalid phone number or password.";
          break;
        case 403:
          message =
            responseData?.message ||
            "Account access restricted. Please contact support.";
          break;
        case 404:
          message = "Server endpoint not found. Please contact support.";
          break;
        case 500:
          message = "Server error. Please try again later.";
          break;
        default:
          message =
            responseData?.message ||
            `Server error (${status}). Please try again.`;
      }
    } else if (error.request) {
      // Request was made but no response received
      message =
        "No response from server. Please check your connection and try again.";
    }

    setSignInErrors({ phoneNumber: message, password: "" });
  } finally {
    setLoading((prev) => ({ ...prev, signIn: false }));
  }
};

// Simplified slot availability check without reservation system
export const checkSlotAvailabilityBeforeSubmission = async (
  outletId,
  serviceId,
  staffId,
  selectedDate,
  time,
  setTimeSlots,
  setTime,
  showErrorMessage,
  isEditingBooking = false,
  currentBookingTime = null,
  currentBookingId = null,
) => {
  // Skip slot availability check - just proceed with booking
  console.log(
    "✅ [SLOT CHECK] Skipping slot availability check (no reservation system)",
  );
  return true;
};

export const handleBookingSubmit = async (
  outletId,
  serviceId,
  staffId,
  selectedDate,
  time,
  clientName,
  setBookingError,
  setBookingId,
  setBookings,
  setBookingDetails,
  setIsBookingDetailsOpen,
  setActiveStep,
  setSelectedDate,
  setOutletId,
  setStaffId,
  setServiceId,
  setServiceDuration,
  setTime,
  setClientName,
  setStaff,
  setTimeSlots,
  setServices,
  setStaffAvailabilities,
  showSuccessMessage,
  showErrorMessage,
  isEditingBooking,
  currentBookingId,
  startCleanupTimer,
  cancelCleanupTimer,
  clearPersistedData,
  serviceDuration,
  staff = [], // Add staff parameter with default empty array
) => {
  // Provide fallback no-op functions if not provided
  const showSuccess =
    typeof showSuccessMessage === "function" ? showSuccessMessage : () => {};
  const showError =
    typeof showErrorMessage === "function" ? showErrorMessage : () => {};
  try {
    // Log detailed information about the submission
    console.log("📝 [SUBMIT] Starting booking submission with data:", {
      outletId,
      serviceId,
      staffId,
      selectedDate: selectedDate?.toISOString(),
      time,
      clientName,
      isEditingBooking,
      currentBookingId,
      serviceDuration,
    });

    // Use getAuthToken instead of direct localStorage access
    const token = getAuthToken();

    // Log token status for debugging
    console.log("🔑 [SUBMIT] Token check:", {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      customerTokenExists: !!localStorage.getItem("customer_token"),
      legacyTokenExists: !!localStorage.getItem("token"),
      staffTokenExists: !!localStorage.getItem("staff_token"),
    });

    if (!token) {
      setBookingError("Please log in to book an appointment");
      return false; // Indicate failure
    }

    // Format date for API - backend expects YYYY-MM-DD format for database storage
    const formattedDate = selectedDate.toISOString().split("T")[0];

    // Prepare booking data
    const bookingData = {
      outlet_id: outletId,
      service_id: serviceId,
      staff_id: staffId,
      date: formattedDate,
      time: time,
      customer_name: clientName,
    };

    console.log("📝 [SUBMIT] Prepared booking data:", bookingData);
    console.log(
      "📝 [SUBMIT] Is editing:",
      isEditingBooking,
      "Current Booking ID:",
      currentBookingId,
    );

    let response;
    if (isEditingBooking && currentBookingId) {
      // Update existing booking
      console.log("📝 [SUBMIT] Updating existing booking:", currentBookingId);
      try {
        response = await client.put(
          `/bookings/${currentBookingId}`,
          bookingData,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        console.log("📝 [SUBMIT] Update response:", response.data);
      } catch (error) {
        console.error("❌ [SUBMIT] Error updating booking:", error);
        console.error("❌ [SUBMIT] Error response:", error.response?.data);
        setBookingError(
          `Failed to update booking: ${error.response?.data?.message || error.message}`,
        );
        return false;
      }

      // Cancel any cleanup timer since we're successfully updating
      if (cancelCleanupTimer) {
        cancelCleanupTimer();
      }

      // Show success message
      showSuccess("Booking updated successfully!");

      // Set the booking details for the modal
      if (response.data && response.data.booking) {
        const updatedBooking = response.data.booking;

        // Find staff name from staff ID if not provided in response
        let staffName = updatedBooking.staff_name;
        if (!staffName && updatedBooking.staff_id) {
          // Try to find the staff name from the staff array
          const matchingStaff =
            Array.isArray(staff) &&
            staff.find((s) => s.id === updatedBooking.staff_id);
          if (matchingStaff) {
            staffName = matchingStaff.name || matchingStaff.username;
            console.log(
              "📝 [SUBMIT] Found staff name from staff array:",
              staffName,
            );
          }
        }

        // Create a complete booking details object for the modal
        const completeBookingDetails = {
          id: updatedBooking.id,
          customer_name: updatedBooking.customer_name || clientName,
          outlet: updatedBooking.outlet_name || updatedBooking.outlet || "N/A",
          staff_id: updatedBooking.staff_id || staffId || null,
          staff_name: staffName || "N/A",
          service: updatedBooking.service_name || "N/A",
          date: updatedBooking.date || formattedDate,
          time: updatedBooking.time || time,
          price: updatedBooking.price || 0,
          payment_method: updatedBooking.payment_method || "Online Payment",
          payment_status: updatedBooking.payment_status || "Pending",
          serviceDuration: serviceDuration || 30,
        };

        console.log(
          "📝 [SUBMIT] Setting updated booking details:",
          completeBookingDetails,
        );
        setBookingDetails(completeBookingDetails);

        // Update the booking ID
        setBookingId(updatedBooking.id);

        // Update the bookings list with the updated booking
        setBookings((prev) =>
          prev.map((b) =>
            b.id === updatedBooking.id
              ? { ...b, ...completeBookingDetails }
              : b,
          ),
        );

        // Open the booking details modal to show the updated booking
        setIsBookingDetailsOpen(true);
      }

      // Reset editing state
      return true;
    } else {
      // Create new booking
      console.log("📝 [SUBMIT] Creating new booking");
      try {
        response = await client.post("/bookings", bookingData, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("📝 [SUBMIT] Create response:", response.data);
      } catch (error) {
        console.error("❌ [SUBMIT] Error creating booking:", error);
        console.error("❌ [SUBMIT] Error response:", error.response?.data);
        setBookingError(
          `Failed to create booking: ${error.response?.data?.message || error.message}`,
        );
        return false;
      }

      // Start cleanup timer for new booking (in case payment is not completed)
      if (
        startCleanupTimer &&
        response.data &&
        response.data.booking &&
        response.data.booking.id
      ) {
        startCleanupTimer(response.data.booking.id);
      }

      // Start payment/confirmation flow without exposing the temporary draft state to users.
      showSuccess(
        "Booking started. Complete payment or confirm pay at outlet to finalize.",
      );

      // Set the booking details for the modal
      if (response.data && response.data.booking) {
        const newBooking = response.data.booking;

        // Create a complete booking details object for the modal
        const completeBookingDetails = {
          id: newBooking.id,
          customer_name: newBooking.customer_name || clientName,
          outlet: newBooking.outlet_name || newBooking.outlet || "N/A",
          staff_id: newBooking.staff_id || staffId || null,
          staff_name: newBooking.staff_name || "N/A",
          service: newBooking.service_name || "N/A",
          date: newBooking.date || formattedDate,
          time: newBooking.time || time,
          price: newBooking.price || 0,
          payment_method: newBooking.payment_method || "Online Payment",
          payment_status: newBooking.payment_status || "Pending",
          serviceDuration: serviceDuration || 30,
          isDraft: response.data.isDraft || false,
        };

        console.log(
          "📝 [SUBMIT] Setting draft booking details:",
          completeBookingDetails,
        );
        setBookingDetails(completeBookingDetails);

        // Update the booking ID
        setBookingId(newBooking.id);

        // Open the booking details modal to show the new booking
        setIsBookingDetailsOpen(true);
      }
    }

    // Clear persisted form data after successful submission
    if (clearPersistedData) {
      clearPersistedData();
    }

    return true; // Indicate success for new bookings
  } catch (error) {
    console.error("❌ [SUBMIT] Error submitting booking:", error);
    console.error("❌ [SUBMIT] Error response:", error.response?.data);

    // Handle specific error cases
    if (error.response?.status === 400) {
      const errorMessage =
        error.response.data?.message || "Invalid booking data";
      setBookingError(errorMessage);
      showError(errorMessage);
    } else if (error.response?.status === 401) {
      setBookingError("Authentication failed. Please log in again.");
      showError("Authentication failed. Please log in again.");
    } else if (error.response?.status === 409) {
      setBookingError(
        "This time slot is no longer available. Please select another time.",
      );
      showError(
        "This time slot is no longer available. Please select another time.",
      );
    } else {
      setBookingError("Failed to submit booking. Please try again.");
      showError("Failed to submit booking. Please try again.");
    }

    return false; // Indicate failure
  }
};

export const handleDeleteBooking = async (
  bookingId,
  setBookings,
  setBookingDetails,
  setIsBookingDetailsOpen,
  setBookingError,
  showSuccessMessage,
  showErrorMessage,
) => {
  if (!window.confirm("Are you sure you want to delete this booking?")) {
    return false; // User cancelled deletion
  }
  try {
    await deleteBooking(bookingId);
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    setBookingDetails(null);
    setIsBookingDetailsOpen(false);
    if (showSuccessMessage) {
      showSuccessMessage("Booking deleted successfully!");
    }
    return true; // Success
  } catch (error) {
    console.error("Error deleting booking:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code,
    });
    const errorMessage = "Failed to delete booking. Please try again.";
    setBookingError(errorMessage);
    if (showErrorMessage) {
      showErrorMessage(errorMessage);
    }
    return false; // Failure
  }
};

export const handleAddBooking = (
  setIsBookingDetailsOpen,
  setActiveStep,
  setSelectedDate,
  setOutletId,
  setStaffId,
  setServiceId,
  setServiceDuration,
  setTime,
  setClientName,
  setStaff,
  setTimeSlots,
  setServices,
  setStaffAvailabilities,
  setIsEditingBooking,
  setCurrentBookingTime,
  setCurrentBookingId,
  setBookingDetails = null, // Add this optional parameter
  setBookingId = null, // Add booking ID setter
) => {
  console.log("🆕 [ADD NEW BOOKING] Starting completely new booking process");

  // Close the current booking details modal
  setIsBookingDetailsOpen(false);

  // Reset ALL booking-related states to start fresh
  setActiveStep(0);
  setSelectedDate(null);
  setOutletId("");
  setStaffId("");
  setServiceId("");
  setServiceDuration(null);
  setTime("");
  setClientName("");
  setStaff([]);
  setTimeSlots([]);
  setServices([]);
  setStaffAvailabilities({});

  // Ensure we're NOT in editing mode (this is a NEW booking)
  setIsEditingBooking(false);
  setCurrentBookingTime(null);
  setCurrentBookingId(null);

  // Clear any existing booking details and ID
  if (setBookingDetails) {
    setBookingDetails(null);
  }
  if (setBookingId) {
    setBookingId(null);
  }

  console.log("✅ [ADD NEW BOOKING] User can now start fresh booking process");
};

export const handleEditBooking = (
  booking,
  closeModal,
  setActiveStep,
  setBookingDetails,
  setSelectedDate,
  setOutletId,
  setStaffId,
  setServiceId,
  setTime,
  setClientName,
  setIsEditingBooking,
  setCurrentBookingTime,
  outlets,
  staff,
  services,
  normalizeTime,
  setCurrentBookingId,
) => {
  console.log("📝 [EDIT] Starting edit flow for booking:", booking);
  console.log("📝 [EDIT] Booking details:", {
    id: booking.id,
    customer_name: booking.customer_name || booking.clientName,
    outlet: booking.outlet,
    staff_name: booking.staff_name,
    service: booking.service,
    date: booking.date,
    time: booking.time,
    price: booking.price,
    serviceDuration:
      booking.serviceDuration || booking.duration || booking.service_duration,
  });

  // Save the current booking details before editing
  setBookingDetails(booking);

  // Set the editing flag to true
  setIsEditingBooking(true);

  // Save the current booking time and ID for reference
  // This is used to allow the current booking's time slot to be available
  setCurrentBookingTime(booking.time);
  setCurrentBookingId(booking.id);

  // Store the booking ID in localStorage to maintain edit state across page refreshes
  try {
    localStorage.setItem("huuk_editing_booking_id", booking.id);
    console.log(
      "📝 [EDIT] Stored editing booking ID in localStorage:",
      booking.id,
    );
  } catch (error) {
    console.error("📝 [EDIT] Error storing editing booking ID:", error);
  }

  // Close the modal but don't clear the state
  if (closeModal) closeModal();

  // Parse the date string to a Date object - FIXED to preserve original date without timezone issues
  let bookingDate = null;
  try {
    if (booking.date) {
      console.log("📝 [EDIT] Parsing booking date:", booking.date);

      // Handle different date formats more robustly
      if (typeof booking.date === "string") {
        if (booking.date.includes("T")) {
          // ISO format (e.g., "2024-01-15T00:00:00.000Z")
          // Extract just the date part to avoid timezone issues
          const datePart = booking.date.split("T")[0];
          const [year, month, day] = datePart.split("-").map(Number);
          bookingDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
        } else if (booking.date.includes("-")) {
          // YYYY-MM-DD format (e.g., "2024-01-15")
          const [year, month, day] = booking.date.split("-").map(Number);
          bookingDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
        } else if (booking.date.includes("/")) {
          // MM/DD/YYYY format (e.g., "01/15/2024")
          const parts = booking.date.split("/");
          if (parts.length === 3) {
            const [month, day, year] = parts.map(Number);
            bookingDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
          }
        }
      } else if (booking.date instanceof Date) {
        // Already a Date object - create new date with same year/month/day but noon time
        const year = booking.date.getFullYear();
        const month = booking.date.getMonth();
        const day = booking.date.getDate();
        bookingDate = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
      }

      // Validate the parsed date
      if (bookingDate && !isNaN(bookingDate.getTime())) {
        console.log(
          "📝 [EDIT] Successfully parsed date:",
          bookingDate.toISOString().split("T")[0],
        );
        console.log("📝 [EDIT] Date object details:", {
          year: bookingDate.getFullYear(),
          month: bookingDate.getMonth() + 1,
          day: bookingDate.getDate(),
          time: bookingDate.toTimeString(),
        });
      } else {
        console.error("📝 [EDIT] Invalid date parsed, using fallback");
        bookingDate = new Date();
      }
    } else {
      console.error("📝 [EDIT] No date provided, using fallback");
      bookingDate = new Date();
    }
  } catch (error) {
    console.error("📝 [EDIT] Error parsing date:", error);
    bookingDate = new Date(); // Fallback to today
  }

  // Set form fields with booking data
  setSelectedDate(bookingDate);

  // Find matching outlet ID
  const matchingOutlet = outlets.find(
    (o) =>
      o.shortform === booking.outlet ||
      o.name === booking.outlet ||
      o.id === booking.outlet_id,
  );
  setOutletId(matchingOutlet ? matchingOutlet.id : "");

  // Find matching staff ID
  const matchingStaff = staff.find(
    (s) => s.name === booking.staff_name || s.id === booking.staff_id,
  );
  setStaffId(matchingStaff ? matchingStaff.id : "");

  // Find matching service ID
  const matchingService = services.find(
    (s) => s.name === booking.service || s.id === booking.service_id,
  );
  setServiceId(matchingService ? matchingService.id : "");

  // Normalize time format
  const normalizedTime = normalizeTime(booking.time);
  setTime(normalizedTime);

  // Set client name
  setClientName(booking.customer_name || booking.clientName || "");

  // Set active step to the beginning of the form
  setActiveStep(0);

  console.log("📝 [EDIT] Edit flow initialized with values:", {
    date: bookingDate,
    outletId: matchingOutlet?.id,
    staffId: matchingStaff?.id,
    serviceId: matchingService?.id,
    time: normalizedTime,
    clientName: booking.customer_name || booking.clientName,
  });
};

export const checkPaymentStatus = async (
  bookingId,
  paymentIntentId,
  setPaymentError,
  setBookingDetails,
  setBookings,
  scrollToSection,
  bookingHistoryRef,
  showSuccessMessage,
  showErrorMessage,
  maxAttempts = 30,
  interval = 2000, // Increased delay to 2 seconds
) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const token = getAuthToken();
      const response = await checkPaymentStatusBySession(paymentIntentId);
      const booking = response.data;
      if (booking && booking.payment_status === "Paid") {
        console.log("Payment confirmed for booking:", bookingId);
        // Explicitly update payment status in the database
        await updatePaymentStatus(bookingId, "Paid");
        setBookingDetails((prev) => ({
          ...prev,
          payment_status: "Paid",
          payment_method: booking.payment_method,
        }));
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  payment_status: "Paid",
                  payment_method: booking.payment_method,
                }
              : b,
          ),
        );
        // Finalize the draft booking after successful payment
        try {
          await finalizeBooking(bookingId);
          console.log(
            "✅ [PAYMENT] Draft booking finalized after successful payment",
          );
        } catch (finalizeError) {
          console.error(
            "❌ [PAYMENT] Error finalizing booking after payment:",
            finalizeError,
          );
          // Don't fail the entire process if finalization fails
        }

        // Show success message for payment confirmation
        if (showSuccessMessage) {
          showSuccessMessage(
            "Payment successful! Your booking has been confirmed and finalized.",
          );
        }
        setTimeout(() => {
          if (bookingHistoryRef && bookingHistoryRef.current) {
            scrollToSection(bookingHistoryRef);
          }
        }, 2000);
        return true;
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (err) {
      console.error("Error checking payment status:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        code: err.code,
      });
      setPaymentError("Failed to verify payment status. Please try again.");
      if (showErrorMessage) {
        showErrorMessage("Failed to verify payment status. Please try again.");
      }
      return false;
    }
  }
  setPaymentError(
    "Payment confirmation timed out. Please check your payment status.",
  );
  if (showErrorMessage) {
    showErrorMessage(
      "Payment confirmation timed out. Please check your payment status.",
    );
  }
  return false;
};

export const initiatePaymentSession = async (
  bookingId,
  setLoading,
  setPaymentError,
  setClientSecret,
  clientSecretRef,
  setBookingDetails,
  setIsPaymentMethodModalOpen,
  setIsFPXModalOpen,
  setBookings,
  scrollToSection,
  bookingHistoryRef,
  showSuccessMessage,
  showErrorMessage,
  setIsConfirmationOpen = null, // Add parameter to close confirmation modal
) => {
  setLoading((prev) => ({ ...prev, paymentInit: true }));
  setPaymentError("");
  setClientSecret("");
  clientSecretRef.current = null;

  // Close the confirmation modal if it's open
  if (setIsConfirmationOpen) {
    setIsConfirmationOpen(false);
  }

  try {
    const token = getAuthToken();

    // Check for combined booking data
    const combinedData = window.combinedBookingData;
    const normalizedCombinedIds = Array.isArray(combinedData?.bookingIds)
      ? combinedData.bookingIds
          .map((id) => String(id || "").trim())
          .filter((id) => id && !id.startsWith("temp-"))
      : [];
    const hasMultipleCombined = normalizedCombinedIds.length > 1;
    const singleBookingId =
      normalizedCombinedIds.length === 1
        ? normalizedCombinedIds[0]
        : String(bookingId || "").trim();

    let paymentData;
    if (hasMultipleCombined) {
      console.log(
        "Initiating payment session for multiple bookings:",
        normalizedCombinedIds,
      );
      paymentData = {
        booking_ids: normalizedCombinedIds,
        total_amount: combinedData.totalPrice,
        is_multiple_bookings: true,
      };
    } else {
      if (!singleBookingId || singleBookingId.startsWith("temp-")) {
        throw new Error("No valid booking ID available");
      }
      console.log(
        "Initiating payment session for single booking_id:",
        singleBookingId,
      );
      paymentData = { booking_id: singleBookingId };
    }

    const response = await client.post(
      "/bookings/payments/create-session",
      paymentData,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    console.log("Payment session response:", response.data);
    if (!response.data.clientSecret) {
      throw new Error("No clientSecret received from server");
    }
    setClientSecret(response.data.clientSecret);
    clientSecretRef.current = response.data.clientSecret;
    setBookingDetails((prev) => ({
      ...prev,
      price: response.data.price || prev.price,
    }));
    setIsPaymentMethodModalOpen(false);
    setIsFPXModalOpen(true);
    // Start checking payment status using payment_intent_id
    const paymentIntentId = response.data.clientSecret.split("_secret_")[0];
    const paymentConfirmed = await checkPaymentStatus(
      singleBookingId,
      paymentIntentId,
      setPaymentError,
      setBookingDetails,
      setBookings,
      scrollToSection,
      bookingHistoryRef,
      showSuccessMessage,
      showErrorMessage,
    );
    if (!paymentConfirmed) {
      throw new Error("Payment confirmation failed");
    }
  } catch (err) {
    console.error("Error initiating payment session:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      code: err.code,
    });
    const errorMessage =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "Failed to initiate payment. Please try again.";
    setPaymentError(errorMessage);
    if (showErrorMessage) {
      showErrorMessage(errorMessage);
    }
  } finally {
    setLoading((prev) => ({ ...prev, paymentInit: false }));
  }
};

// Function to finalize a draft booking
export const finalizeBooking = async (bookingId) => {
  if (!bookingId) {
    console.error("❌ [FINALIZE] Cannot finalize booking: Missing bookingId");
    throw new Error("Cannot finalize booking: Missing ID");
  }

  try {
    // Use comprehensive authentication check
    const authCheck = verifyAuthentication();
    if (!authCheck.isAuthenticated) {
      console.error("❌ [FINALIZE] Authentication check failed:", {
        hasToken: !!authCheck.token,
        hasUserData: !!authCheck.userData,
      });
      throw new Error("Authentication required to finalize booking");
    }

    const token = authCheck.token;
    const userData = authCheck.userData || {};
    const userRole = userData.role || "customer";

    console.log("🔄 [FINALIZE] Finalizing draft booking:", {
      bookingId,
      userRole,
    });

    // Use different endpoints based on user role if needed
    let endpoint = `/bookings/${bookingId}/finalize`;

    // For staff users, you might want to use a different endpoint or add role parameter
    if (
      userRole === "staff" ||
      userRole === "manager" ||
      userRole === "admin"
    ) {
      // This could be a staff-specific endpoint if your API has one
      // endpoint = `/staff/bookings/${bookingId}/finalize`;

      // Or you could add a query parameter to indicate staff action
      endpoint = `/bookings/${bookingId}/finalize?staff_action=true`;
    }

    const response = await client.post(
      endpoint,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // Check if the booking was already finalized
    if (
      response.data.message &&
      response.data.message.includes("already finalized")
    ) {
      console.log("ℹ️ [FINALIZE] Booking was already finalized:", {
        id: response.data?.bookingId,
        status: response.data?.status,
        userRole,
      });
    } else {
      console.log("✅ [FINALIZE] Booking finalized successfully:", {
        id: response.data?.id || response.data?.bookingId,
        status: response.data?.status,
        userRole,
      });
    }

    return response.data;
  } catch (error) {
    // Enhanced error logging with details
    console.error("❌ [FINALIZE] Error finalizing booking:", {
      bookingId,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Check if the error is because the booking is already finalized
    if (error.response?.data?.message?.includes("already finalized")) {
      console.log("ℹ️ [FINALIZE] Booking was already finalized:", bookingId);
      return {
        id: bookingId,
        status: error.response?.data?.status || "Confirmed",
        alreadyFinalized: true,
      };
    }

    // Specific error message based on status code
    if (error.response?.status === 401) {
      throw new Error(
        "Authentication failed. Please sign in again to finalize your booking.",
      );
    } else if (error.response?.status === 404) {
      throw new Error(
        "Booking not found. It may have been deleted or already finalized.",
      );
    } else if (error.response?.status === 403) {
      // Check if it's a role-based permission issue
      if (error.response?.data?.message?.includes("role")) {
        throw new Error(
          "You don't have the required role to finalize this booking. Please contact support.",
        );
      } else {
        throw new Error("You don't have permission to finalize this booking.");
      }
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error("Failed to finalize booking. Please try again.");
    }
  }
};

export const handlePayAtOutlet = async (
  bookingId,
  profile,
  setLoading,
  setPaymentError,
  setBookingDetails,
  setIsPaymentMethodModalOpen,
  setClientSecret,
  clientSecretRef,
  setIsConfirmationOpen,
  setBookings,
  scrollToSection,
  bookingHistoryRef,
  showSuccessMessage,
  showErrorMessage,
) => {
  console.log("🔄 [PAY AT OUTLET] Starting pay at outlet process", {
    bookingId,
    profileExists: !!profile,
    profile: profile
      ? {
          id: profile.id || "missing",
          email: profile.email || "missing",
          phone: profile.phone_number || "missing",
        }
      : "null",
    timestamp: new Date().toISOString(),
  });

  // Run a comprehensive authentication check before proceeding
  const authCheck = verifyAuthentication();
  console.log("🔒 [PAY AT OUTLET] Authentication check results:", {
    isAuthenticated: authCheck.isAuthenticated,
    hasToken: !!authCheck.token,
    hasUserData: !!authCheck.userData,
  });

  // Explicitly log localStorage contents to see what's available
  console.log("🔍 [PAY AT OUTLET] LocalStorage inspection:", {
    customerToken: localStorage.getItem("customer_token")
      ? "present"
      : "missing",
    staffToken: localStorage.getItem("staff_token") ? "present" : "missing",
    legacyToken: localStorage.getItem("token") ? "present" : "missing",
    customerUser: localStorage.getItem("customer_loggedInUser")
      ? "present"
      : "missing",
    staffUser: localStorage.getItem("staff_loggedInUser")
      ? "present"
      : "missing",
    legacyUser: localStorage.getItem("loggedInUser") ? "present" : "missing",
  });

  setLoading((prev) => ({ ...prev, payment: true }));
  setPaymentError("");

  try {
    // Use the token from our comprehensive authentication check
    const token = authCheck.token;
    if (!token) {
      console.error("❌ [PAY AT OUTLET] No authentication token found");
      throw new Error("No authentication token found. Please sign in.");
    }
    console.log("✅ [PAY AT OUTLET] Authentication token validated");

    // Use the user data from our comprehensive authentication check
    const userData = authCheck.userData;
    if (!userData || !userData.id) {
      console.error("❌ [PAY AT OUTLET] No user data found");
      throw new Error("User data not found. Please sign in again.");
    }
    console.log("✅ [PAY AT OUTLET] User data found:", { userId: userData.id });

    // Try to use profile data, fall back to userData
    const effectiveUserData = profile || userData;
    console.log("✅ [PAY AT OUTLET] Using user data:", {
      source: profile ? "profile prop" : "localStorage",
      id: effectiveUserData.id,
      email: effectiveUserData.email || "(not available)",
      phone: effectiveUserData.phone_number || "(not available)",
      role: effectiveUserData.role || "customer",
    });

    // Check if user is staff (staff, manager, admin)
    const isStaff =
      effectiveUserData.role === "staff" ||
      effectiveUserData.role === "manager" ||
      effectiveUserData.role === "admin" ||
      effectiveUserData.isStaff === true;

    // Check for multiple bookings
    const combinedData = window.combinedBookingData;
    let actualBookingIds = bookingId;
    let isMultipleBookings = false;

    if (combinedData && combinedData.isMultipleBookings) {
      console.log(
        "[PAY AT OUTLET] Processing multiple bookings:",
        combinedData,
      );
      actualBookingIds = combinedData.bookingIds.slice(0, 5);
      isMultipleBookings = true;

      if (
        !actualBookingIds.length ||
        actualBookingIds.some((id) => !id || id.toString().startsWith("temp-"))
      ) {
        console.error(
          "❌ [PAY AT OUTLET] Invalid booking IDs in combined data",
        );
        throw new Error("Invalid booking data. Please try again.");
      }
    }

    // Attempt to claim the booking(s) if it might be a guest booking
    // But don't fail the process if claiming fails
    // Skip claim step for staff users - they don't need to claim bookings
    if (!isStaff) {
      try {
        if (isMultipleBookings) {
          // Attempt to claim each booking
          for (const id of actualBookingIds) {
            try {
              const claimResult = await claimGuestBooking(id);
              console.log(
                `🔄 [PAY AT OUTLET] Attempted to claim booking ${id}: ${claimResult ? "Success" : "Not needed"}`,
              );
            } catch (claimError) {
              console.warn(
                `⚠️ [PAY AT OUTLET] Non-critical error when claiming booking ${id}:`,
                claimError.message,
              );
            }
          }
        } else {
          const claimResult = await claimGuestBooking(bookingId);
          console.log(
            `🔄 [PAY AT OUTLET] Attempted to claim booking ${bookingId}: ${claimResult ? "Success" : "Not needed"}`,
          );
        }
      } catch (claimError) {
        // Just log the error, but continue with the process
        console.warn(
          `⚠️ [PAY AT OUTLET] Non-critical error when claiming booking:`,
          claimError.message,
        );
      }
    } else {
      console.log(
        `🔄 [PAY AT OUTLET] Skipping claim step for staff user (role: ${effectiveUserData.role})`,
      );
    }

    // Step 2: Get user contact information
    const loggedInUser = localStorage.getItem("loggedInUser")
      ? JSON.parse(localStorage.getItem("loggedInUser"))
      : null;

    const email = profile?.email || loggedInUser?.email;
    const phoneNumber = profile?.phone_number || loggedInUser?.phone_number;

    console.log("📞 [PAY AT OUTLET] Contact information:", {
      email: email ? "✓" : "✗",
      phoneNumber: phoneNumber ? "✓" : "✗",
    });

    // Check if user has email for receipt, if not they might be phone-only user
    if (!email && !phoneNumber) {
      console.error("❌ [PAY AT OUTLET] No contact information found");
      throw new Error(
        "Contact information required. Please update your profile.",
      );
    }

    // If email exists, validate it. If not, we'll use phone for notifications
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error("❌ [PAY AT OUTLET] Invalid email format:", email);
        throw new Error("Invalid email format. Please update your profile.");
      }
    }

    // Step 3: Call the API to set pay at outlet
    // Use email if available, otherwise use a default email for backend compatibility
    const emailForBackend = email || "customer@huuksystem.com";

    if (isMultipleBookings) {
      // Handle multiple bookings
      console.log(
        "🚀 [PAY AT OUTLET] Setting pay-at-outlet for multiple bookings:",
        {
          bookingIds: actualBookingIds,
          email: emailForBackend,
        },
      );

      // Add detailed logging for the API call
      console.log(
        "📡 [PAY AT OUTLET] Making API call to set-multiple-pay-at-outlet...",
      );

      // Use the already imported setMultiplePayAtOutlet function
      const apiResponse = await setMultiplePayAtOutlet(
        actualBookingIds,
        emailForBackend,
        userData.id,
      );
      console.log("✅ [PAY AT OUTLET] API call successful:", apiResponse.data);

      // Step 5: Update UI state for multiple bookings
      console.log(
        "🔄 [PAY AT OUTLET] Updating UI state for multiple bookings...",
      );

      // Update each booking in the list
      if (typeof setBookings === "function") {
        setBookings((prev) =>
          prev.map((b) =>
            actualBookingIds.includes(b.id)
              ? {
                  ...b,
                  payment_method: "Pay at Outlet",
                  payment_status: "Pending",
                }
              : b,
          ),
        );
      }

      // Update the current booking details
      setBookingDetails((prev) => ({
        ...prev,
        payment_method: "Pay at Outlet",
        payment_status: "Pending",
      }));
    } else {
      // Handle single booking (original code)
      console.log("🚀 [PAY AT OUTLET] Setting pay-at-outlet for booking:", {
        bookingId,
        email: emailForBackend,
      });

      // Add detailed logging for the API call
      console.log("📡 [PAY AT OUTLET] Making API call to set-pay-at-outlet...");
      const apiResponse = await setPayAtOutlet(
        bookingId,
        emailForBackend,
        userData.id,
      );
      console.log("✅ [PAY AT OUTLET] API call successful:", apiResponse.data);

      // Step 5: Update UI state
      console.log("🔄 [PAY AT OUTLET] Updating UI state...");
      setBookingDetails((prev) => ({
        ...prev,
        payment_method: "Pay at Outlet",
        payment_status: "Pending",
      }));

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                payment_method: "Pay at Outlet",
                payment_status: "Pending",
              }
            : b,
        ),
      );
    }

    setIsPaymentMethodModalOpen(false);
    setClientSecret("");
    clientSecretRef.current = null;

    // Close the confirmation modal first
    if (setIsConfirmationOpen) {
      setIsConfirmationOpen(false);
    }

    // Step 6: Finalize the draft booking(s)
    if (isMultipleBookings) {
      console.log(
        "🔄 [PAY AT OUTLET] Finalizing multiple draft bookings after payment method set",
      );
      try {
        // Process bookings sequentially with a delay between each to prevent race conditions
        for (let i = 0; i < actualBookingIds.length; i++) {
          const id = actualBookingIds[i];
          try {
            // Add a small delay between requests to prevent race conditions
            if (i > 0) {
              console.log(
                `🔄 [PAY AT OUTLET] Adding delay before finalizing booking ${id}`,
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            const finalizedBooking = await finalizeBooking(id);
            console.log(
              "✅ [PAY AT OUTLET] Draft booking finalized successfully",
              {
                id: finalizedBooking?.id,
                status: finalizedBooking?.status,
              },
            );
          } catch (finalizeError) {
            // Check if the error is because the booking is already finalized
            if (finalizeError.message.includes("already finalized")) {
              console.log(
                `✅ [PAY AT OUTLET] Booking ${id} was already finalized`,
              );
            } else {
              console.error(
                `❌ [PAY AT OUTLET] Error finalizing booking ${id}:`,
                finalizeError,
              );
            }
          }
        }

        // Update booking details to reflect the finalized status
        setBookingDetails((prev) => ({
          ...prev,
          status: "Confirmed",
        }));

        // Update bookings list if setBookings is available
        if (typeof setBookings === "function") {
          setBookings((prev) =>
            prev.map((b) =>
              actualBookingIds.includes(b.id)
                ? { ...b, status: "Confirmed" }
                : b,
            ),
          );
        }
      } catch (finalizeError) {
        console.error(
          "❌ [PAY AT OUTLET] Error finalizing bookings:",
          finalizeError,
        );

        // Show a warning but don't fail the entire process
        if (showErrorMessage) {
          showErrorMessage(
            "Your booking payment method was set, but there was an issue finalizing the bookings. Please check your booking status.",
          );
        }
      }
    } else {
      console.log(
        "🔄 [PAY AT OUTLET] Finalizing draft booking after payment method set",
      );
      try {
        const finalizedBooking = await finalizeBooking(bookingId);
        console.log("✅ [PAY AT OUTLET] Draft booking finalized successfully", {
          id: finalizedBooking?.id,
          status: finalizedBooking?.status,
        });

        // Update booking details to reflect the finalized status
        setBookingDetails((prev) => ({
          ...prev,
          status: "Confirmed",
        }));

        // Update bookings list if setBookings is available
        if (typeof setBookings === "function") {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === bookingId ? { ...b, status: "Confirmed" } : b,
            ),
          );
        }
      } catch (finalizeError) {
        console.error(
          "❌ [PAY AT OUTLET] Error finalizing booking:",
          finalizeError,
        );

        // Show a warning but don't fail the entire process
        if (showErrorMessage) {
          showErrorMessage(
            "Your booking payment method was set, but there was an issue finalizing the booking. Please check your booking status.",
          );
        }
      }
    }

    // Step 7: Show success message after a brief delay to ensure modal is closed
    console.log("✅ [PAY AT OUTLET] Process completed successfully");
    setTimeout(() => {
      if (showSuccessMessage) {
        if (isMultipleBookings) {
          showSuccessMessage(
            `Payment method set to Pay at Outlet successfully for ${actualBookingIds.length} bookings! All bookings finalized.`,
          );
        } else {
          showSuccessMessage(
            "Payment method set to Pay at Outlet successfully! Booking finalized.",
          );
        }
      }
    }, 100);

    // Step 8: Scroll to booking history after delay
    setTimeout(() => {
      console.log("📜 [PAY AT OUTLET] Scrolling to booking history...");
      if (bookingHistoryRef && bookingHistoryRef.current) {
        scrollToSection(bookingHistoryRef);
      }
    }, 2000);
  } catch (err) {
    console.error("❌ [PAY AT OUTLET] Error occurred:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      code: err.code,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });

    // Determine appropriate error message
    let errorMessage = "Failed to confirm Pay at Outlet. Please try again.";

    if (err.message.includes("timeout")) {
      errorMessage =
        "Request timed out. Please try again or check your connection.";
    } else if (err.code === "NETWORK_ERROR" || err.code === "ERR_NETWORK") {
      errorMessage =
        "Network error. Please check your connection and try again.";
    } else if (err.response?.status === 401) {
      errorMessage = "Authentication failed. Please sign in again.";
      // Clear invalid token
      localStorage.removeItem("token");
      localStorage.removeItem("loggedInUser");
    } else if (err.response?.status === 404) {
      errorMessage =
        "Booking not found. Please refresh the page and try again.";
    } else if (err.response?.status === 400) {
      errorMessage =
        err.response?.data?.message ||
        "Invalid request. Please check your booking details.";
    } else if (err.response?.status === 500) {
      errorMessage = "Server error. Please try again later.";
    } else if (err.response?.data?.message) {
      errorMessage = err.response.data.message;
    } else if (err.message && !err.message.includes("Failed to confirm")) {
      errorMessage = err.message;
    }

    console.error("❌ [PAY AT OUTLET] Final error message:", errorMessage);
    setPaymentError(errorMessage);

    // Show error snackbar notification
    if (showErrorMessage) {
      showErrorMessage(errorMessage);
    }
  } finally {
    console.log("🔄 [PAY AT OUTLET] Cleaning up loading state");
    setLoading((prev) => ({ ...prev, payment: false }));
  }
};

export const handlePaymentMethodSelection = (
  paymentMethod,
  bookingId,
  clientName,
  setLoading,
  setPaymentError,
  initiatePaymentSession,
  handlePayAtOutlet,
  showSuccessMessage,
) => {
  console.log("🔄 [PAYMENT METHOD SELECTION] Selected method:", paymentMethod);

  if (paymentMethod === "fpx") {
    console.log("🎯 [PAYMENT METHOD SELECTION] Initiating FPX payment session");
    initiatePaymentSession();
  } else if (paymentMethod === "outlet") {
    console.log("🎯 [PAYMENT METHOD SELECTION] Initiating Pay at Outlet");
    handlePayAtOutlet();
  } else {
    console.error(
      "❌ [PAYMENT METHOD SELECTION] Invalid payment method:",
      paymentMethod,
    );
    setPaymentError("Invalid payment method selected.");
  }
};

export const handleDownloadReceipt = (bookingDetails) => {
  const receiptText = `
      Booking Receipt
      ID: ${bookingDetails?.id}
      Outlet: ${bookingDetails?.outlet}
      Service: ${bookingDetails?.service}
      Date: ${bookingDetails?.date}
      Time: ${bookingDetails?.time}
      Client: ${bookingDetails?.customer_name}
      Barber: ${bookingDetails?.staff_name}
      Price: MYR ${Math.floor(Number(bookingDetails?.price || 0))}
      Payment Method: ${bookingDetails?.payment_method}
      Status: ${bookingDetails?.payment_status}
    `;
  const blob = new Blob([receiptText], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt_${bookingDetails?.id}.txt`;
  a.click();
  window.URL.revokeObjectURL(url);
};

// New helper function to claim a guest booking
export const claimGuestBooking = async (bookingId) => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn(
        `Skipping claim for booking ${bookingId}: No authentication token found`,
      );
      // Don't throw an error here, just return false to indicate claim wasn't possible
      return false;
    }

    // Check user role before attempting to claim
    const userData = getUserData();
    if (
      userData &&
      (userData.role === "staff" ||
        userData.role === "manager" ||
        userData.role === "admin")
    ) {
      console.log(
        `ℹ️ Booking ${bookingId} claim skipped: Staff users don't need to claim bookings`,
      );
      return true; // Return true to indicate success (no need to claim)
    }

    // Only proceed with claim if user is a customer
    const response = await client.patch(
      `/bookings/${bookingId}/claim`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    console.log(`✅ Booking ${bookingId} claimed successfully.`);
    return true;
  } catch (error) {
    // If there's a 404, the booking might not be a guest booking or doesn't exist
    if (error.response?.status === 404) {
      console.log(
        `ℹ️ Booking ${bookingId} is not a guest booking or doesn't exist.`,
      );
      return false;
    }

    // If there's a 403, user might not have permission to claim
    if (error.response?.status === 403) {
      // Check if error is due to role permissions
      if (error.response?.data?.message?.includes("role")) {
        console.log(
          `ℹ️ User doesn't have customer role to claim booking ${bookingId}.`,
        );
      } else {
        console.log(
          `ℹ️ User doesn't have permission to claim booking ${bookingId}.`,
        );
      }
      return false;
    }

    console.error(`❌ Error claiming booking ${bookingId}:`, error);
    // Don't throw an error, just return false to indicate claim failed
    return false;
  }
};

export const fetchStaff = (
  selectedDate,
  outletId,
  setLoading,
  setStaff,
  setStaffAvailabilities,
  setErrors,
  toTitleCase,
) => {
  if (!selectedDate || !outletId) {
    console.log("fetchStaff: Missing dependencies", {
      selectedDate,
      outletId,
    });
    setStaff([]);
    setStaffAvailabilities({});
    return;
  }
  const dateStr = selectedDate.toISOString().split("T")[0];
  setLoading((prev) => ({ ...prev, staff: true }));
  client
    .get("/bookings/available-staff", {
      params: { outlet_id: outletId, date: dateStr },
    })
    .then((response) => {
      console.log("Staff received:", response.data);
      const staffData = Array.isArray(response.data) ? response.data : [];
      const staffList = staffData.map((s) => ({
        ...s,
        username: toTitleCase(s.username || "Unknown"),
      }));
      setStaff(staffList);
      if (staffList.length === 0) {
        setErrors((prev) => ({
          ...prev,
          staff: "No barbers available for this date and outlet",
        }));
      }
      setStaffAvailabilities({});
      setLoading((prev) => ({ ...prev, staff: false }));
    })
    .catch((error) => {
      console.error("Error fetching staff:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });
      setErrors((prev) => ({ ...prev, staff: "Unable to load barbers" }));
      setStaff([]);
      setStaffAvailabilities({});
      setLoading((prev) => ({ ...prev, staff: false }));
    });
};

export const fetchServices = (
  selectedDate,
  outletId,
  setLoading,
  setServices,
  setErrors,
) => {
  if (!selectedDate || !outletId) {
    console.log("fetchServices: Missing dependencies", {
      selectedDate,
      outletId,
    });
    setServices([]);
    return;
  }
  setLoading((prev) => ({ ...prev, services: true }));
  client
    .get("/bookings/services")
    .then((response) => {
      console.log("Services received:", response.data);
      const servicesData = Array.isArray(response.data) ? response.data : [];
      setServices(servicesData);
      setLoading((prev) => ({ ...prev, services: false }));
    })
    .catch((error) => {
      console.error("Error fetching services:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });
      setErrors((prev) => ({ ...prev, services: "Unable to load services" }));
      setLoading((prev) => ({ ...prev, services: false }));
    });
};

// Helper function to filter time slots based on existing bookings and service duration
// Add staffId parameter
export const filterAvailableTimeSlots = (
  allSlots,
  existingBookings = [],
  serviceDuration = 60,
  currentBookingTime = null,
  staffId = null, // NEW PARAM
  currentBookingId = null, // NEW PARAM
  modalBookings = [], // NEW PARAM: bookings already in the modal
) => {
  console.log(
    "🔍 [SLOT FILTER] ================== STARTING SLOT FILTERING ==================",
  );
  console.log("🔍 [SLOT FILTER] Input parameters:", {
    totalSlots: allSlots.length,
    existingBookings: existingBookings.length,
    serviceDuration,
    currentBookingTime,
    staffId,
    currentBookingId,
  });
  // Only consider bookings for the selected staff
  let filteredBookings = existingBookings;
  if (staffId) {
    filteredBookings = existingBookings.filter(
      (b) => String(b.staff_id) === String(staffId),
    );
    console.log(
      "🔍 [SLOT FILTER] Filtered bookings for staffId",
      staffId,
      ":",
      filteredBookings.length,
    );
  }

  // Add modal bookings to the conflict check (these are in-session bookings before final submit)
  if (modalBookings && modalBookings.length > 0) {
    const modalBookingsForStaff = modalBookings.filter((b) => {
      if (!staffId || staffId === "any") {
        return true;
      }

      // Primary match by staff_id when available
      if (
        b.staff_id !== undefined &&
        b.staff_id !== null &&
        b.staff_id !== ""
      ) {
        return String(b.staff_id) === String(staffId);
      }

      // Fallback: if staff_id is missing, try to match by staff name using existing bookings
      const matchedExisting = existingBookings.find(
        (existing) =>
          existing &&
          existing.staff_name &&
          b.staff_name &&
          String(existing.staff_name).trim().toLowerCase() ===
            String(b.staff_name).trim().toLowerCase(),
      );

      return matchedExisting
        ? String(matchedExisting.staff_id) === String(staffId)
        : false;
    });
    console.log(
      "🔍 [SLOT FILTER] Adding modal bookings for conflict check:",
      modalBookingsForStaff.length,
    );
    filteredBookings = [...filteredBookings, ...modalBookingsForStaff];
  }
  // If currentBookingId is provided, skip that booking in overlap checks
  if (currentBookingId) {
    filteredBookings = filteredBookings.filter(
      (b) => String(b.id) !== String(currentBookingId),
    );
    console.log(
      "🔍 [SLOT FILTER] Filtered out current bookingId",
      currentBookingId,
      ":",
      filteredBookings.length,
    );
  }
  // For new bookings (no currentBookingId), skip overlap for booking with same time and staffId as currentBookingTime
  if (!currentBookingId && currentBookingTime && staffId) {
    filteredBookings = filteredBookings.filter((b) => {
      // Only skip if both time and staff match
      return !(
        normalizeTime(b.time) === normalizeTime(currentBookingTime) &&
        String(b.staff_id) === String(staffId)
      );
    });
    console.log(
      "🔍 [SLOT FILTER] Filtered out booking with same time and staff as current booking:",
      currentBookingTime,
      staffId,
    );
  }

  // Debug: Show all input slots
  console.log("🔍 [SLOT FILTER] All input slots:", allSlots);

  // Debug: Show existing bookings in detail
  console.log("🔍 [SLOT FILTER] Existing bookings detail:");
  filteredBookings.forEach((booking, index) => {
    console.log(`  Booking ${index + 1}:`, {
      id: booking.id,
      time: booking.time,
      serviceDuration: booking.serviceDuration,
      customer: booking.customer_name,
      service: booking.service_name || booking.service,
    });
  });

  // Convert time string to minutes for easier calculation
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    try {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const result = hours * 60 + minutes;
      console.log(`🔧 [TIME CONVERT] "${timeStr}" -> ${result} minutes`);
      return result;
    } catch (error) {
      console.error(
        "❌ [SLOT FILTER] Error converting time to minutes:",
        timeStr,
        error,
      );
      return 0;
    }
  };

  // Convert minutes back to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // Get all blocked time ranges from existing bookings
  const blockedRanges = [];
  console.log(
    "🔍 [SLOT FILTER] Building blocked ranges from existing bookings:",
  );

  filteredBookings.forEach((booking, index) => {
    if (!booking.time) {
      console.log(
        `⚠️ [SLOT FILTER] Booking ${index + 1} has no time, skipping:`,
        booking,
      );
      return;
    }

    // Ensure we have valid data and normalize the time
    const normalizedTime = normalizeTime(booking.time);
    const startTime = timeToMinutes(normalizedTime);
    const bookingDuration =
      booking.serviceDuration ||
      booking.service_duration ||
      booking.duration ||
      serviceDuration ||
      60;
    const endTime = startTime + bookingDuration;

    console.log(`📅 [SLOT FILTER] Booking ${index + 1} blocked range:`, {
      bookingId: booking.id,
      originalTime: booking.time,
      normalizedTime: normalizedTime,
      startMinutes: startTime,
      endMinutes: endTime,
      duration: bookingDuration,
      timeRange: `${minutesToTime(startTime)} - ${minutesToTime(endTime)}`,
    });

    blockedRanges.push({
      start: startTime,
      end: endTime,
      bookingId: booking.id,
      originalTime: booking.time,
      normalizedTime: normalizedTime,
    });
  });

  console.log("🔍 [SLOT FILTER] Total blocked ranges:", blockedRanges.length);
  console.log(
    "🔍 [SLOT FILTER] Blocked ranges summary:",
    blockedRanges.map((range) => ({
      bookingId: range.bookingId,
      timeRange: `${minutesToTime(range.start)} - ${minutesToTime(range.end)}`,
    })),
  );

  // Filter available slots
  console.log("🔍 [SLOT FILTER] Starting to filter each slot:");
  const availableSlots = allSlots.filter((slot, slotIndex) => {
    console.log(
      `\n🔍 [SLOT FILTER] === Checking slot ${slotIndex + 1}/${allSlots.length}: "${slot}" ===`,
    );

    // Skip invalid slots
    if (!slot) {
      console.log(
        `❌ [SLOT FILTER] Slot ${slotIndex + 1} is invalid/empty, rejecting`,
      );
      return false;
    }

    const normalizedSlot = normalizeTime(slot);
    const slotStartMinutes = timeToMinutes(normalizedSlot);
    const slotEndMinutes = slotStartMinutes + serviceDuration;

    console.log(`🔍 [SLOT FILTER] Slot ${slotIndex + 1} details:`, {
      original: slot,
      normalized: normalizedSlot,
      startMinutes: slotStartMinutes,
      endMinutes: slotEndMinutes,
      timeRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`,
      serviceDuration: serviceDuration,
    });

    // Skip filtering for current booking time when editing
    if (currentBookingTime) {
      const normalizedCurrentTime = normalizeTime(currentBookingTime);
      if (
        slot === currentBookingTime ||
        normalizedSlot === normalizedCurrentTime
      ) {
        console.log(
          `✅ [SLOT FILTER] Slot ${slotIndex + 1} is current booking time, keeping:`,
          slot,
          "normalized:",
          normalizedSlot,
          "currentBookingTime:",
          currentBookingTime,
        );
        return true;
      }
    }

    // Check for overlapping bookings using proper interval overlap detection
    // Two intervals [a1, a2] and [b1, b2] overlap if: a1 < b2 && b1 < a2
    console.log(
      `🔍 [SLOT FILTER] Checking slot ${slotIndex + 1} for overlaps with ${blockedRanges.length} blocked ranges:`,
    );

    const hasOverlap = blockedRanges.some((blocked, blockedIndex) => {
      // Skip overlap check if this blocked range is from the current booking being edited
      if (
        currentBookingTime &&
        blocked.normalizedTime === normalizeTime(currentBookingTime)
      ) {
        console.log(
          `  Overlap check ${blockedIndex + 1}/${blockedRanges.length}: SKIPPING - this is current booking being edited`,
        );
        return false;
      }

      // Check for time overlap using interval intersection
      const overlap =
        slotStartMinutes < blocked.end && blocked.start < slotEndMinutes;

      console.log(
        `  Overlap check ${blockedIndex + 1}/${blockedRanges.length}:`,
        {
          slotRange: `${slotStartMinutes}-${slotEndMinutes}`,
          blockedRange: `${blocked.start}-${blocked.end}`,
          slotStart_LT_blockedEnd: `${slotStartMinutes} < ${blocked.end} = ${slotStartMinutes < blocked.end}`,
          blockedStart_LT_slotEnd: `${blocked.start} < ${slotEndMinutes} = ${blocked.start < slotEndMinutes}`,
          bothConditions: `${slotStartMinutes < blocked.end} && ${blocked.start < slotEndMinutes} = ${slotStartMinutes < blocked.end && blocked.start < slotEndMinutes}`,
          isOverlap: overlap,
          blockedBookingId: blocked.bookingId,
        },
      );

      if (overlap) {
        console.log(
          `❌ [SLOT FILTER] Slot ${slotIndex + 1} OVERLAP DETECTED with booking ${blocked.bookingId}:`,
          {
            slot: normalizedSlot,
            slotRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`,
            blockedRange: `${minutesToTime(blocked.start)} - ${minutesToTime(blocked.end)}`,
            blockedBookingId: blocked.bookingId,
            originalBlockedTime: blocked.originalTime,
          },
        );
      }

      return overlap;
    });

    if (hasOverlap) {
      console.log(
        `❌ [SLOT FILTER] Slot ${slotIndex + 1} REJECTED due to overlap`,
      );
      return false;
    }

    // Check for business hours constraints
    const businessEndMinutes = timeToMinutes("22:00");
    const sufficientTimeBeforeClose = slotEndMinutes <= businessEndMinutes;

    if (!sufficientTimeBeforeClose) {
      console.log(
        `❌ [SLOT FILTER] Slot ${slotIndex + 1} REJECTED - insufficient time before business closes:`,
        {
          slot: normalizedSlot,
          slotEnd: slotEndMinutes,
          businessEnd: businessEndMinutes,
          serviceDuration,
          timeRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`,
        },
      );
    } else {
      console.log(
        `✅ [SLOT FILTER] Slot ${slotIndex + 1} ACCEPTED - passes all checks:`,
        {
          slot: normalizedSlot,
          timeRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`,
        },
      );
    }

    return sufficientTimeBeforeClose;
  });

  console.log(
    "🔍 [SLOT FILTER] ================== FILTERING COMPLETE ==================",
  );
  console.log("✅ [SLOT FILTER] Final results:", {
    originalSlots: allSlots.length,
    availableSlots: availableSlots.length,
    filteredOut: allSlots.length - availableSlots.length,
    acceptedSlots: availableSlots,
    rejectedSlots: allSlots.filter((slot) => !availableSlots.includes(slot)),
  });

  return availableSlots;
};

export const fetchTimeSlots = (
  selectedDate,
  outletId,
  staffId,
  serviceId,
  setLoading,
  setTimeSlots,
  setErrors,
  currentBookingTime = null, // Add parameter for current booking time when editing
  currentBookingId = null, // Add parameter for current booking ID when editing
  existingBookings = [], // Add parameter for existing bookings to filter out
  serviceDuration = 60, // Add parameter for service duration
  modalBookings = [], // Add parameter for bookings already in the modal
) => {
  if (
    !selectedDate ||
    !outletId ||
    (!staffId && staffId !== "any") ||
    !serviceId
  ) {
    console.log("fetchTimeSlots: Missing dependencies", {
      selectedDate,
      outletId,
      staffId,
      serviceId,
      staffIdType: typeof staffId,
      staffIdValue: staffId,
    });
    setTimeSlots([]);
    return;
  }

  console.log(
    "✅ fetchTimeSlots: All dependencies met, proceeding with API call",
    {
      selectedDate: selectedDate?.toISOString(),
      outletId,
      staffId,
      serviceId,
      serviceDuration,
      currentBookingTime,
      currentBookingId,
      existingBookings: existingBookings.length,
    },
  );
  const dateStr = selectedDate.toISOString().split("T")[0];
  setLoading((prev) => ({ ...prev, slots: true }));
  const params = {
    date: dateStr,
    outlet_id: outletId,
    service_id: serviceId,
  };
  if (staffId !== "any") {
    params.staff_id = staffId;
  }
  // Pass current booking info during edit mode to exclude it from conflicts
  if (currentBookingId) {
    params.currentBookingId = currentBookingId;
    console.log(
      "📝 [EDIT MODE] Passing currentBookingId to server:",
      currentBookingId,
    );
  }
  if (currentBookingTime) {
    params.currentBookingTime = normalizeTime(currentBookingTime);
    console.log(
      "📝 [EDIT MODE] Passing currentBookingTime to server:",
      params.currentBookingTime,
    );
  }
  console.log("Fetching time slots with params:", params);

  // Check if the selected date is in the future (not today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDateOnly = new Date(selectedDate);
  selectedDateOnly.setHours(0, 0, 0, 0);
  const isFutureDate = selectedDateOnly > today;

  console.log("📅 [DATE CHECK] Date comparison:", {
    today: today.toISOString(),
    selectedDate: selectedDateOnly.toISOString(),
    isFutureDate,
  });

  client
    .get("/bookings/available-slots", { params })
    .then((response) => {
      console.log("🎯 [SERVER RESPONSE] Time slots API response:", {
        status: response.status,
        dataLength: response.data?.length,
        data: response.data,
        params: params,
        requestUrl: `/bookings/available-slots`,
        fullUrl: `${client.defaults.baseURL}/bookings/available-slots`,
      });

      console.log("🔍 [SERVER SLOTS] Raw server response analysis:", {
        responseType: typeof response.data,
        isArray: Array.isArray(response.data),
        firstFewSlots: Array.isArray(response.data)
          ? response.data.slice(0, 5)
          : "N/A",
        totalSlots: Array.isArray(response.data) ? response.data.length : "N/A",
      });

      let availableSlots = response.data;

      // Validate server response
      if (!Array.isArray(availableSlots)) {
        console.error(
          "❌ [SERVER RESPONSE] Expected array of time slots, got:",
          typeof availableSlots,
        );
        availableSlots = [];
      }

      // If no slots are returned but it's a future date, generate default time slots
      // This fixes the "shop closed" issue for future dates
      if (availableSlots.length === 0 && isFutureDate) {
        console.log(
          "📅 [FUTURE DATE] No slots returned for future date, generating default slots",
        );

        // Generate default time slots from 10:00 to 21:30 in 30-minute intervals
        availableSlots = [];
        for (let hour = 10; hour < 22; hour++) {
          for (let minute of [0, 30]) {
            if (hour === 21 && minute === 30) continue; // Skip 21:30 as it's too close to closing
            const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
            availableSlots.push(timeStr);
          }
        }

        console.log(
          "📅 [FUTURE DATE] Generated default slots:",
          availableSlots,
        );
      }

      if (currentBookingTime) {
        console.log(
          "📝 [EDIT MODE] Including current booking time:",
          currentBookingTime,
        );
        // In edit mode, ensure the current booking time is always available
        const normalizedCurrentTime = normalizeTime(currentBookingTime);
        if (
          !availableSlots.includes(normalizedCurrentTime) &&
          !availableSlots.includes(currentBookingTime)
        ) {
          availableSlots.push(normalizedCurrentTime);
          console.log(
            "📝 [EDIT MODE] Added current booking time to available slots:",
            normalizedCurrentTime,
          );
        }
        // Sort the slots to maintain proper order
        availableSlots.sort();
        console.log(
          "📝 [EDIT MODE] Final available slots (including current):",
          availableSlots,
        );
      }

      // Apply smart filtering based on existing bookings and service duration
      console.log("🔄 [PRE-FILTER] About to apply client-side filtering:", {
        serverSlots: availableSlots.length,
        existingBookingsCount: existingBookings.length,
        serviceDuration: serviceDuration,
        shouldFilter: existingBookings.length > 0,
        serverSlotsPreview: availableSlots.slice(0, 8),
      });

      const hasClientSideConflicts =
        existingBookings.length > 0 ||
        (Array.isArray(modalBookings) && modalBookings.length > 0);

      const filteredSlots = hasClientSideConflicts
        ? filterAvailableTimeSlots(
            availableSlots,
            existingBookings,
            serviceDuration,
            currentBookingTime,
            staffId, // Pass staffId to filterAvailableTimeSlots
            currentBookingId, // Pass currentBookingId to filterAvailableTimeSlots
            modalBookings, // Pass modalBookings to filterAvailableTimeSlots
          )
        : availableSlots; // Skip filtering if no existing bookings

      console.log("📊 [SLOT FILTERING] Applied smart filtering:", {
        serverOriginalSlots: availableSlots.length,
        clientFilteredSlots: filteredSlots.length,
        existingBookings: existingBookings.length,
        serviceDuration,
        removedByFilter: availableSlots.length - filteredSlots.length,
        finalSlots: filteredSlots,
      });

      setTimeSlots(filteredSlots);
      if (filteredSlots.length === 0) {
        console.log(
          "⚠️ No slots available after filtering, setting error message",
        );
        setErrors((prev) => ({
          ...prev,
          slots:
            staffId === "any"
              ? "No time slots available for this service, date, and outlet"
              : "This barber has no available slots for this service on the selected date",
        }));
      } else {
        console.log(
          "✅ Slots available after filtering, clearing error message",
        );
        setErrors((prev) => ({ ...prev, slots: "" }));
      }
      setLoading((prev) => ({ ...prev, slots: false }));
    })
    .catch((error) => {
      console.error("Error fetching slots:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });

      // If there's an error but it's a future date, generate default time slots
      if (isFutureDate) {
        console.log(
          "📅 [FUTURE DATE] Error fetching slots for future date, generating default slots",
        );

        // Generate default time slots from 10:00 to 21:30 in 30-minute intervals
        const defaultSlots = [];
        for (let hour = 10; hour < 22; hour++) {
          for (let minute of [0, 30]) {
            if (hour === 21 && minute === 30) continue; // Skip 21:30 as it's too close to closing
            const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
            defaultSlots.push(timeStr);
          }
        }

        console.log("📅 [FUTURE DATE] Generated default slots:", defaultSlots);
        setTimeSlots(defaultSlots);
        setErrors((prev) => ({ ...prev, slots: "" }));
      } else {
        setErrors((prev) => ({ ...prev, slots: "Unable to load time slots" }));
        setTimeSlots([]);
      }

      setLoading((prev) => ({ ...prev, slots: false }));
    });
};

export const fetchOutlets = (setLoading, setOutlets, setErrors) => {
  setLoading((prev) => ({ ...prev, outlets: true }));
  setErrors((prev) => ({ ...prev, outlets: "" }));
  client
    .get("/bookings/outlets")
    .then((response) => {
      // Reduced outlets logging frequency
      if (Math.random() < 0.1) {
        console.log("Outlets received:", response.data.length, "outlets");
      }
      const outletsData = Array.isArray(response.data) ? response.data : [];
      setOutlets(outletsData);
      if (outletsData.length === 0) {
        setErrors((prev) => ({
          ...prev,
          outlets: "No outlets available",
        }));
      }
      setLoading((prev) => ({ ...prev, outlets: false }));
    })
    .catch((error) => {
      console.error("Error fetching outlets:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });
      setErrors((prev) => ({ ...prev, outlets: "Unable to load outlets" }));
      setOutlets([]);
      setLoading((prev) => ({ ...prev, outlets: false }));
    });
};
