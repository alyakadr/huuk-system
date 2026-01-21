import axios from "axios";
import client, {
  deleteBooking,
  setPayAtOutlet,
  updatePaymentStatus,
  checkPaymentStatusBySession,
} from "../api/client";
import { API_BASE_URL } from "./constants";
import { getAuthToken, getUserData } from './tokenUtils';

// Normalize time to HH:MM format with robust string cleaning
export const normalizeTime = (time) => {
  console.log('🔧 [NORMALIZE] Input time:', time, 'Type:', typeof time, 'Constructor:', time?.constructor?.name);
  
  if (!time) {
    console.log('🔧 [NORMALIZE] Empty time, returning empty string');
    return "";
  }
  
  // If it's an object, try to extract time from it
  if (typeof time === 'object' && time !== null) {
    console.log('🔧 [NORMALIZE] Time is object, keys:', Object.keys(time));
    // Check if it's a Date object
    if (time instanceof Date) {
      const result = time.toTimeString().substring(0, 5);
      console.log('🔧 [NORMALIZE] Date object converted to:', result);
      return cleanTimeString(result);
    }
    // Check if it has a time property
    if (time.time) {
      console.log('🔧 [NORMALIZE] Object has time property:', time.time);
      return normalizeTime(time.time);
    }
    // Check if it has a value property
    if (time.value) {
      console.log('🔧 [NORMALIZE] Object has value property:', time.value);
      return normalizeTime(time.value);
    }
    // If it's an object we can't handle, convert to string
    console.warn('🔧 [NORMALIZE] Unknown object type, converting to string:', JSON.stringify(time));
    return cleanTimeString(String(time));
  }
  
  // Convert to string if it's not already
  const timeStr = String(time);
  console.log('🔧 [NORMALIZE] String representation:', timeStr);
  
  // Clean the string first
  const cleanedTimeStr = cleanTimeString(timeStr);
  console.log('🔧 [NORMALIZE] Cleaned string:', cleanedTimeStr, 'Character codes:', cleanedTimeStr.split('').map(c => c.charCodeAt(0)));
  
  // If it's already in HH:MM format, return as is
  if (/^\d{2}:\d{2}$/.test(cleanedTimeStr)) {
    console.log('🔧 [NORMALIZE] Already in HH:MM format:', cleanedTimeStr);
    return cleanedTimeStr;
  }
  
  // If it's HH:MM:SS format, extract HH:MM
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleanedTimeStr)) {
    const result = cleanedTimeStr.substring(0, 5);
    console.log('🔧 [NORMALIZE] HH:MM:SS format converted to:', result);
    return result;
  }
  
  // If it's a different format, try to parse and format
  try {
    const date = new Date(`1970-01-01T${cleanedTimeStr}`);
    const result = date.toTimeString().substring(0, 5);
    console.log('🔧 [NORMALIZE] Parsed and formatted to:', result);
    return cleanTimeString(result);
  } catch (error) {
    console.warn('🔧 [NORMALIZE] Failed to normalize time:', cleanedTimeStr, 'Error:', error.message);
    return cleanedTimeStr;
  }
};

// Helper function to clean time strings of invisible characters and whitespace
const cleanTimeString = (timeStr) => {
  if (!timeStr) return "";
  
  return String(timeStr)
    .trim() // Remove leading/trailing whitespace
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
    .replace(/\s+/g, '') // Remove all remaining whitespace characters
    .replace(/[^\d:]/g, '') // Keep only digits and colons
    .trim(); // Final trim
};

// Simple time comparison function that handles various time formats
const isTimeAvailable = (selectedTime, availableSlots) => {
  console.log('🔍 [TIME COMPARE] Checking if time is available:', selectedTime);
  console.log('🔍 [TIME COMPARE] Available slots:', availableSlots.slice(0, 3));
  console.log('🔍 [TIME COMPARE] All available slots:', availableSlots);
  
  // Try direct string comparison first
  if (availableSlots.includes(selectedTime)) {
    console.log('✅ [TIME COMPARE] Direct match found');
    return true;
  }
  
  // Try normalized comparison
  const normalizedSelected = normalizeTime(selectedTime);
  const normalizedSlots = availableSlots.map(slot => normalizeTime(slot));
  
  console.log('🔍 [TIME COMPARE] Normalized selected:', normalizedSelected);
  console.log('🔍 [TIME COMPARE] Normalized slots sample:', normalizedSlots.slice(0, 3));
  console.log('🔍 [TIME COMPARE] All normalized slots:', normalizedSlots);
  
  // Detailed comparison for debugging
  console.log('🔍 [TIME COMPARE] Detailed slot comparison:');
  normalizedSlots.forEach((slot, index) => {
    const match = slot === normalizedSelected;
    console.log(`  Slot ${index}: "${availableSlots[index]}" -> "${slot}" vs "${normalizedSelected}" = ${match}`);
    if (match) {
      console.log('✅ [TIME COMPARE] Match found in detailed comparison at index:', index);
    }
  });
  
  if (normalizedSlots.includes(normalizedSelected)) {
    console.log('✅ [TIME COMPARE] Normalized match found');
    return true;
  }
  
  // Try simple time parsing comparison
  try {
    const selectedParts = selectedTime.split(':');
    const selectedHour = parseInt(selectedParts[0]);
    const selectedMin = parseInt(selectedParts[1]);
    
    for (const slot of availableSlots) {
      const slotParts = slot.split(':');
      const slotHour = parseInt(slotParts[0]);
      const slotMin = parseInt(slotParts[1]);
      
      if (selectedHour === slotHour && selectedMin === slotMin) {
        console.log('✅ [TIME COMPARE] Time parts match found');
        return true;
      }
    }
  } catch (error) {
    console.warn('⚠️ [TIME COMPARE] Error in time parts comparison:', error);
  }
  
  console.log('❌ [TIME COMPARE] No match found');
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
  clientName
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
  clientName
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
  updateProfile
) => {
  e.preventDefault();
  setLoading((prev) => ({ ...prev, signIn: true }));
  setSignInErrors({ phoneNumber: "", password: "" });

  console.log('[SIGN IN] Starting authentication process');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log('[SIGN IN] Making authentication request to server');
    const response = await axios.post(
      `${API_BASE_URL}/auth/customer/signin`,
      {
        phone_number: signInPhoneNumber,
        password: signInPassword,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);
    console.log('[SIGN IN] Authentication response received:', {
      success: response.data.success,
      hasUser: !!response.data.user,
      hasToken: !!response.data.token
    });

    if (response.data.success && response.data.user && response.data.token) {
      // Store customer-specific tokens for proper authentication
      const userWithToken = { ...response.data.user, token: response.data.token };
      
      console.log('[SIGN IN] Storing authentication data:', {
        userId: userWithToken.id,
        role: userWithToken.role,
        hasToken: !!userWithToken.token
      });
      
      // Primary storage for customer session
      localStorage.setItem("customer_loggedInUser", JSON.stringify(userWithToken));
      localStorage.setItem("customer_token", response.data.token);
      localStorage.setItem("customer_userId", String(response.data.user.id));
      
      // Keep legacy storage for backward compatibility
      localStorage.setItem("loggedInUser", JSON.stringify(userWithToken));
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userId", String(response.data.user.id));
      
      console.log('[SIGN IN] Authentication data stored successfully');
      
      // Update profile context immediately after successful sign-in
      if (updateProfile) {
        console.log('[SIGN IN] Updating profile context');
        updateProfile(userWithToken);
      }
      
      // Close sign-in modal and clear form
      setIsSignInOpen(false);
      setSignInPhoneNumber("");
      setSignInPassword("");
      
      console.log('[SIGN IN] Authentication successful, proceeding with booking');
      
      // Small delay to ensure token storage is complete
      setTimeout(async () => {
        try {
          await handleBookingSubmit();
        } catch (bookingError) {
          console.error('[SIGN IN] Error during booking submission after sign-in:', bookingError);
        }
      }, 100);
      
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
          message = responseData?.message || "Invalid request. Please check your input.";
          break;
        case 401:
          message = responseData?.message || "Invalid phone number or password.";
          break;
        case 403:
          message = responseData?.message || "Account access restricted. Please contact support.";
          break;
        case 404:
          message = "Server endpoint not found. Please contact support.";
          break;
        case 500:
          message = "Server error. Please try again later.";
          break;
        default:
          message = responseData?.message || `Server error (${status}). Please try again.`;
      }
    } else if (error.request) {
      // Request was made but no response received
      message = "No response from server. Please check your connection and try again.";
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
  currentBookingId = null
) => {
  // Skip slot availability check - just proceed with booking
  console.log("✅ [SLOT CHECK] Skipping slot availability check (no reservation system)");
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
  serviceDuration
) => {
  // Provide fallback no-op functions if not provided
  const showSuccess = typeof showSuccessMessage === 'function' ? showSuccessMessage : () => {};
  const showError = typeof showErrorMessage === 'function' ? showErrorMessage : () => {};
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
      serviceDuration
    });

    // Use getAuthToken instead of direct localStorage access
    const token = getAuthToken();
    
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
    console.log("📝 [SUBMIT] Is editing:", isEditingBooking, "Current Booking ID:", currentBookingId);

    let response;
    if (isEditingBooking && currentBookingId) {
      // Update existing booking
      console.log("📝 [SUBMIT] Updating existing booking:", currentBookingId);
      try {
        response = await client.put(`/bookings/${currentBookingId}`, bookingData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        console.log("📝 [SUBMIT] Update response:", response.data);
      } catch (error) {
        console.error("❌ [SUBMIT] Error updating booking:", error);
        console.error("❌ [SUBMIT] Error response:", error.response?.data);
        setBookingError(`Failed to update booking: ${error.response?.data?.message || error.message}`);
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
        
        // Create a complete booking details object for the modal
        const completeBookingDetails = {
          id: updatedBooking.id,
          customer_name: updatedBooking.customer_name || clientName,
          outlet: updatedBooking.outlet_name || updatedBooking.outlet || "N/A",
          staff_name: updatedBooking.staff_name || "N/A",
          service: updatedBooking.service_name || "N/A",
          date: updatedBooking.date || formattedDate,
          time: updatedBooking.time || time,
          price: updatedBooking.price || 0,
          payment_method: updatedBooking.payment_method || "Stripe",
          payment_status: updatedBooking.payment_status || "Pending",
          serviceDuration: serviceDuration || 30,
        };
        
        console.log("📝 [SUBMIT] Setting updated booking details:", completeBookingDetails);
        setBookingDetails(completeBookingDetails);
        
        // Update the booking ID
        setBookingId(updatedBooking.id);
        
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
        setBookingError(`Failed to create booking: ${error.response?.data?.message || error.message}`);
        return false;
      }
      
      // Start cleanup timer for new booking (in case payment is not completed)
      if (startCleanupTimer && response.data && response.data.booking && response.data.booking.id) {
        startCleanupTimer(response.data.booking.id);
      }
      
      // Show success message for draft booking
      showSuccess("Draft booking created! Please complete payment to finalize.");
      
      // Set the booking details for the modal
      if (response.data && response.data.booking) {
        const newBooking = response.data.booking;
        
        // Create a complete booking details object for the modal
        const completeBookingDetails = {
          id: newBooking.id,
          customer_name: newBooking.customer_name || clientName,
          outlet: newBooking.outlet_name || newBooking.outlet || "N/A",
          staff_name: newBooking.staff_name || "N/A",
          service: newBooking.service_name || "N/A",
          date: newBooking.date || formattedDate,
          time: newBooking.time || time,
          price: newBooking.price || 0,
          payment_method: newBooking.payment_method || "Stripe",
          payment_status: newBooking.payment_status || "Pending",
          serviceDuration: serviceDuration || 30,
          isDraft: response.data.isDraft || false,
        };
        
        console.log("📝 [SUBMIT] Setting draft booking details:", completeBookingDetails);
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
      const errorMessage = error.response.data?.message || "Invalid booking data";
    setBookingError(errorMessage);
      showError(errorMessage);
    } else if (error.response?.status === 401) {
      setBookingError("Authentication failed. Please log in again.");
      showError("Authentication failed. Please log in again.");
    } else if (error.response?.status === 409) {
      setBookingError("This time slot is no longer available. Please select another time.");
      showError("This time slot is no longer available. Please select another time.");
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
  showErrorMessage
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
  setBookingId = null // Add booking ID setter
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
  setCurrentBookingId
) => {
  console.log("📝 [EDIT] Starting edit flow for booking:", booking);
  
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
    localStorage.setItem('huuk_editing_booking_id', booking.id);
    console.log("📝 [EDIT] Stored editing booking ID in localStorage:", booking.id);
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
      if (typeof booking.date === 'string') {
        if (booking.date.includes('T')) {
          // ISO format (e.g., "2024-01-15T00:00:00.000Z")
          // Extract just the date part to avoid timezone issues
          const datePart = booking.date.split('T')[0];
          const [year, month, day] = datePart.split('-').map(Number);
          bookingDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
        } else if (booking.date.includes('-')) {
          // YYYY-MM-DD format (e.g., "2024-01-15")
          const [year, month, day] = booking.date.split('-').map(Number);
          bookingDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
        } else if (booking.date.includes('/')) {
          // MM/DD/YYYY format (e.g., "01/15/2024")
          const parts = booking.date.split('/');
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
        console.log("📝 [EDIT] Successfully parsed date:", bookingDate.toISOString().split('T')[0]);
        console.log("📝 [EDIT] Date object details:", {
          year: bookingDate.getFullYear(),
          month: bookingDate.getMonth() + 1,
          day: bookingDate.getDate(),
          time: bookingDate.toTimeString()
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
    (o) => o.shortform === booking.outlet || o.name === booking.outlet || o.id === booking.outlet_id
  );
  setOutletId(matchingOutlet ? matchingOutlet.id : "");
  
  // Find matching staff ID
  const matchingStaff = staff.find(
    (s) => s.name === booking.staff_name || s.id === booking.staff_id
  );
  setStaffId(matchingStaff ? matchingStaff.id : "");
  
  // Find matching service ID
  const matchingService = services.find(
    (s) => s.name === booking.service || s.id === booking.service_id
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
    clientName: booking.customer_name || booking.clientName
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
  interval = 2000 // Increased delay to 2 seconds
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
              : b
          )
        );
        // Finalize the draft booking after successful payment
        try {
          await finalizeBooking(bookingId);
          console.log("✅ [PAYMENT] Draft booking finalized after successful payment");
        } catch (finalizeError) {
          console.error("❌ [PAYMENT] Error finalizing booking after payment:", finalizeError);
          // Don't fail the entire process if finalization fails
        }
        
        // Show success message for payment confirmation
        if (showSuccessMessage) {
          showSuccessMessage("Payment successful! Your booking has been confirmed and finalized.");
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
    "Payment confirmation timed out. Please check your payment status."
  );
  if (showErrorMessage) {
    showErrorMessage("Payment confirmation timed out. Please check your payment status.");
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
  setIsConfirmationOpen = null // Add parameter to close confirmation modal
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
    let paymentData;
    
    if (combinedData && combinedData.isMultipleBookings) {
      console.log("Initiating payment session for multiple bookings:", combinedData.bookingIds);
      paymentData = { 
        booking_ids: combinedData.bookingIds,
        total_amount: combinedData.totalPrice,
        is_multiple_bookings: true
      };
    } else {
      if (!bookingId) {
        throw new Error("No booking ID available");
      }
      console.log("Initiating payment session for single booking_id:", bookingId);
      paymentData = { booking_id: bookingId };
    }
    
    const response = await client.post(
      "/bookings/payments/create-session",
      paymentData,
      { headers: { Authorization: `Bearer ${token}` } }
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
      bookingId,
      paymentIntentId,
      setPaymentError,
      setBookingDetails,
      setBookings,
      scrollToSection,
      bookingHistoryRef,
      showSuccessMessage,
      showErrorMessage
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
    const errorMessage = err.response?.data?.message ||
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
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No authentication token found");
    }
    
    console.log("🔄 [FINALIZE] Finalizing draft booking:", bookingId);
    
    const response = await client.post(`/bookings/${bookingId}/finalize`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    console.log("✅ [FINALIZE] Booking finalized successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ [FINALIZE] Error finalizing booking:", error);
    throw error;
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
  showErrorMessage
) => {
  console.log("🔄 [PAY AT OUTLET] Starting pay at outlet process", {
    bookingId,
    profile: profile ? { email: profile.email, phone: profile.phone_number } : null,
    timestamp: new Date().toISOString()
  });
  
  setLoading((prev) => ({ ...prev, payment: true }));
  setPaymentError("");
  
  try {
    // Step 1: Validate authentication - Use the getAuthToken utility function
    const token = getAuthToken();
    if (!token) {
      console.error("❌ [PAY AT OUTLET] No authentication token found");
      throw new Error("No authentication token found. Please sign in.");
    }
    console.log("✅ [PAY AT OUTLET] Authentication token validated");
    
    // Get current user data including userId
    const userData = getUserData();
    if (!userData || !userData.id) {
      console.error("❌ [PAY AT OUTLET] No user data found");
      throw new Error("User data not found. Please sign in again.");
    }
    console.log("✅ [PAY AT OUTLET] User data found:", { userId: userData.id });

    // Attempt to claim the booking if it might be a guest booking
    await claimGuestBooking(bookingId);

    // Step 2: Get user contact information
    const loggedInUser = localStorage.getItem("loggedInUser") 
      ? JSON.parse(localStorage.getItem("loggedInUser")) 
      : null;
    
    const email = profile?.email || loggedInUser?.email;
    const phoneNumber = profile?.phone_number || loggedInUser?.phone_number;
    
    console.log("📞 [PAY AT OUTLET] Contact information:", {
      email: email ? "✓" : "✗",
      phoneNumber: phoneNumber ? "✓" : "✗"
    });
    
    // Check if user has email for receipt, if not they might be phone-only user
    if (!email && !phoneNumber) {
      console.error("❌ [PAY AT OUTLET] No contact information found");
      throw new Error("Contact information required. Please update your profile.");
    }
    
    // If email exists, validate it. If not, we'll use phone for notifications
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error("❌ [PAY AT OUTLET] Invalid email format:", email);
        throw new Error("Invalid email format. Please update your profile.");
      }
    }
    
    // Step 3: Verify booking exists
    console.log("🔍 [PAY AT OUTLET] Verifying booking exists...");
    try {
      const bookingResponse = await client.get("/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const existingBooking = bookingResponse.data.find((b) => b.id === bookingId);
      if (!existingBooking) {
        console.error("❌ [PAY AT OUTLET] Booking not found:", bookingId);
        console.error("❌ [PAY AT OUTLET] Available bookings:", bookingResponse.data.map(b => ({ id: b.id, customer: b.customer_name })));
        throw new Error("Booking not found. Please try again.");
      }
      
      console.log("✅ [PAY AT OUTLET] Booking found:", {
        id: existingBooking.id,
        status: existingBooking.status,
        payment_method: existingBooking.payment_method,
        payment_status: existingBooking.payment_status
      });
    } catch (bookingCheckError) {
      console.error("❌ [PAY AT OUTLET] Error verifying booking:", bookingCheckError);
      throw new Error("Unable to verify booking. Please try again.");
    }
    
    // Step 4: Call the API to set pay at outlet
    console.log("🚀 [PAY AT OUTLET] Setting pay-at-outlet for booking:", {
      bookingId,
      email: email || "customer@huuksystem.com"
    });
    
    // Use email if available, otherwise use a default email for backend compatibility
    const emailForBackend = email || "customer@huuksystem.com";
    
    // Add detailed logging for the API call
    console.log("📡 [PAY AT OUTLET] Making API call to set-pay-at-outlet...");
    const apiResponse = await setPayAtOutlet(bookingId, emailForBackend, userData.id);
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
          ? { ...b, payment_method: "Pay at Outlet", payment_status: "Pending" }
          : b
      )
    );
    
    setIsPaymentMethodModalOpen(false);
    setClientSecret("");
    clientSecretRef.current = null;
    
    // Close the confirmation modal first
    if (setIsConfirmationOpen) {
      setIsConfirmationOpen(false);
    }
    
    // Step 6: Finalize the draft booking
    console.log("🔄 [PAY AT OUTLET] Finalizing draft booking after payment method set");
    try {
      await finalizeBooking(bookingId);
      console.log("✅ [PAY AT OUTLET] Draft booking finalized successfully");
    } catch (finalizeError) {
      console.error("❌ [PAY AT OUTLET] Error finalizing booking:", finalizeError);
      // Don't fail the entire process if finalization fails
    }
    
    // Step 7: Show success message after a brief delay to ensure modal is closed
    console.log("✅ [PAY AT OUTLET] Process completed successfully");
    setTimeout(() => {
      if (showSuccessMessage) {
        showSuccessMessage("Payment method set to Pay at Outlet successfully! Booking finalized.");
      }
    }, 100);
    
    // Step 7: Scroll to booking history after delay
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
      timestamp: new Date().toISOString()
    });
    
    // Determine appropriate error message
    let errorMessage = "Failed to confirm Pay at Outlet. Please try again.";
    
    if (err.message.includes("timeout")) {
      errorMessage = "Request timed out. Please try again or check your connection.";
    } else if (err.code === "NETWORK_ERROR" || err.code === "ERR_NETWORK") {
      errorMessage = "Network error. Please check your connection and try again.";
    } else if (err.response?.status === 401) {
      errorMessage = "Authentication failed. Please sign in again.";
      // Clear invalid token
      localStorage.removeItem("token");
      localStorage.removeItem("loggedInUser");
    } else if (err.response?.status === 404) {
      errorMessage = "Booking not found. Please refresh the page and try again.";
    } else if (err.response?.status === 400) {
      errorMessage = err.response?.data?.message || "Invalid request. Please check your booking details.";
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
  showSuccessMessage
) => {
  console.log("🔄 [PAYMENT METHOD SELECTION] Selected method:", paymentMethod);
  
  if (paymentMethod === "fpx") {
    console.log("🎯 [PAYMENT METHOD SELECTION] Initiating FPX payment session");
    initiatePaymentSession();
  } else if (paymentMethod === "outlet") {
    console.log("🎯 [PAYMENT METHOD SELECTION] Initiating Pay at Outlet");
    handlePayAtOutlet();
  } else {
    console.error("❌ [PAYMENT METHOD SELECTION] Invalid payment method:", paymentMethod);
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

export const fetchStaff = (
  selectedDate,
  outletId,
  setLoading,
  setStaff,
  setStaffAvailabilities,
  setErrors,
  toTitleCase
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
  setErrors
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
  modalBookings = [] // NEW PARAM: bookings already in the modal
) => {
  console.log('🔍 [SLOT FILTER] ================== STARTING SLOT FILTERING ==================');
  console.log('🔍 [SLOT FILTER] Input parameters:', {
    totalSlots: allSlots.length,
    existingBookings: existingBookings.length,
    serviceDuration,
    currentBookingTime,
    staffId,
    currentBookingId
  });
  // Only consider bookings for the selected staff
  let filteredBookings = existingBookings;
  if (staffId) {
    filteredBookings = existingBookings.filter(b => String(b.staff_id) === String(staffId));
    console.log('🔍 [SLOT FILTER] Filtered bookings for staffId', staffId, ':', filteredBookings.length);
  }
  
  // Add modal bookings to the conflict check (these are bookings already in the same modal)
  if (modalBookings && modalBookings.length > 0) {
    const modalBookingsForStaff = modalBookings.filter(b => String(b.staff_id) === String(staffId));
    console.log('🔍 [SLOT FILTER] Adding modal bookings for conflict check:', modalBookingsForStaff.length);
    filteredBookings = [...filteredBookings, ...modalBookingsForStaff];
  }
  // If currentBookingId is provided, skip that booking in overlap checks
  if (currentBookingId) {
    filteredBookings = filteredBookings.filter(b => String(b.id) !== String(currentBookingId));
    console.log('🔍 [SLOT FILTER] Filtered out current bookingId', currentBookingId, ':', filteredBookings.length);
  }
  // For new bookings (no currentBookingId), skip overlap for booking with same time and staffId as currentBookingTime
  if (!currentBookingId && currentBookingTime && staffId) {
    filteredBookings = filteredBookings.filter(b => {
      // Only skip if both time and staff match
      return !(normalizeTime(b.time) === normalizeTime(currentBookingTime) && String(b.staff_id) === String(staffId));
    });
    console.log('🔍 [SLOT FILTER] Filtered out booking with same time and staff as current booking:', currentBookingTime, staffId);
  }
  
  // Debug: Show all input slots
  console.log('🔍 [SLOT FILTER] All input slots:', allSlots);
  
  // Debug: Show existing bookings in detail
  console.log('🔍 [SLOT FILTER] Existing bookings detail:');
  filteredBookings.forEach((booking, index) => {
    console.log(`  Booking ${index + 1}:`, {
      id: booking.id,
      time: booking.time,
      serviceDuration: booking.serviceDuration,
      customer: booking.customer_name,
      service: booking.service_name || booking.service
    });
  });
  
  // Convert time string to minutes for easier calculation
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const result = hours * 60 + minutes;
      console.log(`🔧 [TIME CONVERT] "${timeStr}" -> ${result} minutes`);
      return result;
    } catch (error) {
      console.error('❌ [SLOT FILTER] Error converting time to minutes:', timeStr, error);
      return 0;
    }
  };
  
  // Convert minutes back to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Get all blocked time ranges from existing bookings
  const blockedRanges = [];
  console.log('🔍 [SLOT FILTER] Building blocked ranges from existing bookings:');
  
  filteredBookings.forEach((booking, index) => {
    if (!booking.time) {
      console.log(`⚠️ [SLOT FILTER] Booking ${index + 1} has no time, skipping:`, booking);
      return;
    }
    
    // Ensure we have valid data and normalize the time
    const normalizedTime = normalizeTime(booking.time);
    const startTime = timeToMinutes(normalizedTime);
    const bookingDuration = booking.serviceDuration || booking.service_duration || serviceDuration || 60;
    const endTime = startTime + bookingDuration;
    
    console.log(`📅 [SLOT FILTER] Booking ${index + 1} blocked range:`, {
      bookingId: booking.id,
      originalTime: booking.time,
      normalizedTime: normalizedTime,
      startMinutes: startTime,
      endMinutes: endTime,
      duration: bookingDuration,
      timeRange: `${minutesToTime(startTime)} - ${minutesToTime(endTime)}`
    });
    
    blockedRanges.push({ 
      start: startTime, 
      end: endTime, 
      bookingId: booking.id,
      originalTime: booking.time,
      normalizedTime: normalizedTime 
    });
  });
  
  console.log('🔍 [SLOT FILTER] Total blocked ranges:', blockedRanges.length);
  console.log('🔍 [SLOT FILTER] Blocked ranges summary:', blockedRanges.map(range => ({
    bookingId: range.bookingId,
    timeRange: `${minutesToTime(range.start)} - ${minutesToTime(range.end)}`
  })));
  
  // Filter available slots
  console.log('🔍 [SLOT FILTER] Starting to filter each slot:');
  const availableSlots = allSlots.filter((slot, slotIndex) => {
    console.log(`\n🔍 [SLOT FILTER] === Checking slot ${slotIndex + 1}/${allSlots.length}: "${slot}" ===`);
    
    // Skip invalid slots
    if (!slot) {
      console.log(`❌ [SLOT FILTER] Slot ${slotIndex + 1} is invalid/empty, rejecting`);
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
      serviceDuration: serviceDuration
    });
    
    // Skip filtering for current booking time when editing
    if (currentBookingTime) {
      const normalizedCurrentTime = normalizeTime(currentBookingTime);
      if (slot === currentBookingTime || normalizedSlot === normalizedCurrentTime) {
        console.log(`✅ [SLOT FILTER] Slot ${slotIndex + 1} is current booking time, keeping:`, slot, 'normalized:', normalizedSlot, 'currentBookingTime:', currentBookingTime);
        return true;
      }
    }
    
    // Check for overlapping bookings using proper interval overlap detection
    // Two intervals [a1, a2] and [b1, b2] overlap if: a1 < b2 && b1 < a2
    console.log(`🔍 [SLOT FILTER] Checking slot ${slotIndex + 1} for overlaps with ${blockedRanges.length} blocked ranges:`);
    
    const hasOverlap = blockedRanges.some((blocked, blockedIndex) => {
      // Skip overlap check if this blocked range is from the current booking being edited
      if (currentBookingTime && blocked.normalizedTime === normalizeTime(currentBookingTime)) {
        console.log(`  Overlap check ${blockedIndex + 1}/${blockedRanges.length}: SKIPPING - this is current booking being edited`);
        return false;
      }
      
      // Check for time overlap using interval intersection
      const overlap = slotStartMinutes < blocked.end && blocked.start < slotEndMinutes;
      
      console.log(`  Overlap check ${blockedIndex + 1}/${blockedRanges.length}:`, {
        slotRange: `${slotStartMinutes}-${slotEndMinutes}`,
        blockedRange: `${blocked.start}-${blocked.end}`,
        slotStart_LT_blockedEnd: `${slotStartMinutes} < ${blocked.end} = ${slotStartMinutes < blocked.end}`,
        blockedStart_LT_slotEnd: `${blocked.start} < ${slotEndMinutes} = ${blocked.start < slotEndMinutes}`,
        bothConditions: `${slotStartMinutes < blocked.end} && ${blocked.start < slotEndMinutes} = ${slotStartMinutes < blocked.end && blocked.start < slotEndMinutes}`,
        isOverlap: overlap,
        blockedBookingId: blocked.bookingId
      });
      
      if (overlap) {
        console.log(`❌ [SLOT FILTER] Slot ${slotIndex + 1} OVERLAP DETECTED with booking ${blocked.bookingId}:`, {
          slot: normalizedSlot,
          slotRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`,
          blockedRange: `${minutesToTime(blocked.start)} - ${minutesToTime(blocked.end)}`,
          blockedBookingId: blocked.bookingId,
          originalBlockedTime: blocked.originalTime
        });
      }
      
      return overlap;
    });
    
    if (hasOverlap) {
      console.log(`❌ [SLOT FILTER] Slot ${slotIndex + 1} REJECTED due to overlap`);
      return false;
    }
    
    // Check for business hours constraints
    const businessEndMinutes = timeToMinutes('22:00');
    const sufficientTimeBeforeClose = slotEndMinutes <= businessEndMinutes;
    
    if (!sufficientTimeBeforeClose) {
      console.log(`❌ [SLOT FILTER] Slot ${slotIndex + 1} REJECTED - insufficient time before business closes:`, {
        slot: normalizedSlot,
        slotEnd: slotEndMinutes,
        businessEnd: businessEndMinutes,
        serviceDuration,
        timeRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`
      });
    } else {
      console.log(`✅ [SLOT FILTER] Slot ${slotIndex + 1} ACCEPTED - passes all checks:`, {
        slot: normalizedSlot,
        timeRange: `${minutesToTime(slotStartMinutes)} - ${minutesToTime(slotEndMinutes)}`
      });
    }
    
    return sufficientTimeBeforeClose;
  });
  
  console.log('🔍 [SLOT FILTER] ================== FILTERING COMPLETE ==================');
  console.log('✅ [SLOT FILTER] Final results:', {
    originalSlots: allSlots.length,
    availableSlots: availableSlots.length,
    filteredOut: allSlots.length - availableSlots.length,
    acceptedSlots: availableSlots,
    rejectedSlots: allSlots.filter(slot => !availableSlots.includes(slot))
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
  modalBookings = [] // Add parameter for bookings already in the modal
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
  
  console.log("✅ fetchTimeSlots: All dependencies met, proceeding with API call", {
    selectedDate: selectedDate?.toISOString(),
    outletId,
    staffId,
    serviceId,
    serviceDuration,
    currentBookingTime,
    currentBookingId,
    existingBookings: existingBookings.length
  });
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
    console.log("📝 [EDIT MODE] Passing currentBookingId to server:", currentBookingId);
  }
  if (currentBookingTime) {
    params.currentBookingTime = normalizeTime(currentBookingTime);
    console.log("📝 [EDIT MODE] Passing currentBookingTime to server:", params.currentBookingTime);
  }
  console.log("Fetching time slots with params:", params);
  client
    .get("/bookings/available-slots", { params })
    .then((response) => {
      console.log("🎯 [SERVER RESPONSE] Time slots API response:", {
        status: response.status,
        dataLength: response.data?.length,
        data: response.data,
        params: params,
        requestUrl: `/bookings/available-slots`,
        fullUrl: `${client.defaults.baseURL}/bookings/available-slots`
      });
      
      console.log("🔍 [SERVER SLOTS] Raw server response analysis:", {
        responseType: typeof response.data,
        isArray: Array.isArray(response.data),
        firstFewSlots: Array.isArray(response.data) ? response.data.slice(0, 5) : 'N/A',
        totalSlots: Array.isArray(response.data) ? response.data.length : 'N/A'
      });
      
      let availableSlots = response.data;
      
      // Validate server response
      if (!Array.isArray(availableSlots)) {
        console.error('❌ [SERVER RESPONSE] Expected array of time slots, got:', typeof availableSlots);
        availableSlots = [];
      }
      
      if (currentBookingTime) {
        console.log("📝 [EDIT MODE] Including current booking time:", currentBookingTime);
        // In edit mode, ensure the current booking time is always available
        const normalizedCurrentTime = normalizeTime(currentBookingTime);
        if (!availableSlots.includes(normalizedCurrentTime) && !availableSlots.includes(currentBookingTime)) {
          availableSlots.push(normalizedCurrentTime);
          console.log("📝 [EDIT MODE] Added current booking time to available slots:", normalizedCurrentTime);
        }
        // Sort the slots to maintain proper order
        availableSlots.sort();
        console.log("📝 [EDIT MODE] Final available slots (including current):", availableSlots);
      }
      
      // Apply smart filtering based on existing bookings and service duration
      console.log('🔄 [PRE-FILTER] About to apply client-side filtering:', {
        serverSlots: availableSlots.length,
        existingBookingsCount: existingBookings.length,
        serviceDuration: serviceDuration,
        shouldFilter: existingBookings.length > 0,
        serverSlotsPreview: availableSlots.slice(0, 8)
      });
      
      const filteredSlots = existingBookings.length > 0 
        ? filterAvailableTimeSlots(
            availableSlots,
            existingBookings,
            serviceDuration,
            currentBookingTime,
            staffId, // Pass staffId to filterAvailableTimeSlots
            currentBookingId, // Pass currentBookingId to filterAvailableTimeSlots
            modalBookings // Pass modalBookings to filterAvailableTimeSlots
          )
        : availableSlots; // Skip filtering if no existing bookings
      
      console.log('📊 [SLOT FILTERING] Applied smart filtering:', {
        serverOriginalSlots: availableSlots.length,
        clientFilteredSlots: filteredSlots.length,
        existingBookings: existingBookings.length,
        serviceDuration,
        removedByFilter: availableSlots.length - filteredSlots.length,
        finalSlots: filteredSlots
      });
      
      setTimeSlots(filteredSlots);
      if (filteredSlots.length === 0) {
        console.log("⚠️ No slots available after filtering, setting error message");
        setErrors((prev) => ({
          ...prev,
          slots:
            staffId === "any"
              ? "No time slots available for this service, date, and outlet"
              : "This barber has no available slots for this service on the selected date",
        }));
      } else {
        console.log("✅ Slots available after filtering, clearing error message");
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
      setErrors((prev) => ({ ...prev, slots: "Unable to load time slots" }));
      setTimeSlots([]);
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
