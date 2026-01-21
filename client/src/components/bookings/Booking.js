import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import EnhancedOutletDropdown from "./EnhancedOutletDropdown";
import EnhancedBarberDropdown from "./EnhancedBarberDropdown";
import EnhancedServiceDropdown from "./EnhancedServiceDropdown";
import EnhancedTimeSlotDropdown from "./EnhancedTimeSlotDropdown";
import SimpleCalendar from "../common/SimpleCalendar";
import { useNavigate, useLocation } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import "../../styles/booking.css";
import "../../styles/customerHomepage.css";
import styles from "../../styles/homepage.module.css";

import PaymentForm from "./PaymentForm";
import Modal from "react-modal";
import { useSpring, animated } from "@react-spring/web";
import { MdPhone, MdLock, MdBadge, MdPerson, MdEmail, MdVisibility, MdVisibilityOff, MdOutlineInfo, MdErrorOutline } from "react-icons/md";
import modalImage from "../../assets/modalcust1.jpg";
import axios from "axios";
import PaymentModal from "./PaymentModal";
import BookingDetailsModal from "./BookingDetailsModal";
import ConfirmationModal from "./ConfirmationModal";
import FPXModal from "./FPXModal";
import SwitchModeButton from "../shared/SwitchModeButton";

// DEBUG: Add this to check DatePicker

import * as bookingUtils from "../../utils/bookingUtils";
import { API_BASE_URL, stripePromise } from "../../utils/constants";
import client from "../../api/client";

// Import getAuthToken at the top of the file
import { getAuthToken } from "../../utils/tokenUtils";

// Debug flag for logging
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

function Booking({ scrollToSection, bookingHistoryRef }) {
  const steps = [
    "Select Date",
    "Select Outlet",
    "Select Barber",
    "Select Service",
    "Select Time",
    "Enter Name",
  ];

  // Persistent booking data keys
  const BOOKING_DATA_KEY = 'huuk_booking_form_data';
  const INCOMPLETE_BOOKING_KEY = 'huuk_incomplete_booking';
  const BOOKING_TIMER_KEY = 'huuk_booking_timer';

  // Load persisted data from localStorage
  const loadPersistedData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(BOOKING_DATA_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
      // Reduced logging frequency for persistence operations
      if (DEBUG && Math.random() < 0.1) {
        debugLog('[PERSISTENCE] Loading saved booking data:', parsedData);
      }
        return parsedData;
      }
    } catch (error) {
      console.error('❌ [PERSISTENCE] Error loading persisted data:', error);
    }
    return null;
  }, []);

  // Save data to localStorage
  const saveDataToLocalStorage = useCallback((data) => {
    try {
      localStorage.setItem(BOOKING_DATA_KEY, JSON.stringify(data));
      // Reduced logging frequency for persistence operations
      if (DEBUG && Math.random() < 0.1) {
        debugLog('[PERSISTENCE] Saved booking data to localStorage');
      }
    } catch (error) {
      console.error('❌ [PERSISTENCE] Error saving data to localStorage:', error);
    }
  }, []);


  // Clear persisted data
  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(BOOKING_DATA_KEY);
      localStorage.removeItem(INCOMPLETE_BOOKING_KEY);
      localStorage.removeItem(BOOKING_TIMER_KEY);
      debugLog('🧹 [PERSISTENCE] Cleared persisted booking data');
    } catch (error) {
      console.error('❌ [PERSISTENCE] Error clearing persisted data:', error);
    }
  }, []);

  // Initialize state with persisted data (only once)
  const [persistedData] = useState(() => {
    const data = loadPersistedData();
    if (data) {
      // Reduced logging frequency for persistence operations
      if (DEBUG && Math.random() < 0.1) {
        debugLog('[PERSISTENCE] Restoring state from localStorage:', data);
      }
    } else {
      debugLog('📦 [PERSISTENCE] No persisted data found, using defaults');
    }
    return data;
  });
  
  const [activeStep, setActiveStep] = useState(() => {
    const step = bookingUtils.getActiveStep({
      selectedDate: persistedData?.selectedDate ? new Date(persistedData.selectedDate) : new Date(),
      outletId: persistedData?.outletId || "",
      staffId: persistedData?.staffId || "",
      serviceId: persistedData?.serviceId || "",
      time: persistedData?.time || "",
      clientName: persistedData?.clientName || ""
    });
    return step || 0;
  });
  const [selectedDate, setSelectedDate] = useState(
    persistedData?.selectedDate ? new Date(persistedData.selectedDate) : new Date()
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [outletId, setOutletId] = useState(persistedData?.outletId || "");
  const [staffId, setStaffId] = useState(persistedData?.staffId || "");
  const [time, setTime] = useState(persistedData?.time || "");
  const [serviceId, setServiceId] = useState(persistedData?.serviceId || "");
  const [serviceDuration, setServiceDuration] = useState(persistedData?.serviceDuration || null);
  const [clientName, setClientName] = useState(persistedData?.clientName || "");
  
  // Only log initial state occasionally to reduce console spam
  if (DEBUG && Math.random() < 0.1) {
    debugLog('[INITIAL STATE] State initialized with:', {
      time: persistedData?.time || "",
      clientName: persistedData?.clientName || "",
      isEditingBooking: false,
      hasPersistedData: !!persistedData
    });
  }
  const [outlets, setOutlets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([]); // Track selected time slots to remove them from available slots
  const [services, setServices] = useState([]);
  const [staffAvailabilities, setStaffAvailabilities] = useState({});
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState({
    outlets: false,
    staff: false,
    slots: false,
    services: false,
    payment: false,
    paymentInit: false,
    signIn: false,
    signUp: false,
  });
  const [errors, setErrors] = useState({});
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] =
    useState(false);
  const [isFPXModalOpen, setIsFPXModalOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  const signUpAnimation = useSpring({
    opacity: isSignUpOpen ? 1 : 0.7,
    transform: isSignUpOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [bookingError, setBookingError] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("fpx");
  const [clientSecret, setClientSecret] = useState("");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [signInPhoneNumber, setSignInPhoneNumber] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInErrors, setSignInErrors] = useState({
    phoneNumber: "",
    password: "",
  });
  const [signUpPhoneNumber, setSignUpPhoneNumber] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signUpErrors, setSignUpErrors] = useState({
    name: "",
    phoneNumber: "",
    password: "",
    username: "",
    confirmPassword: "",
  });
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [currentBookingTime, setCurrentBookingTime] = useState(null);
  const [currentBookingId, setCurrentBookingId] = useState(null);
  const [modalBookings, setModalBookings] = useState([]); // Add state for modal bookings

  // Booking cleanup related state
  const [incompleteBookingId, setIncompleteBookingId] = useState(null);
  const [bookingCleanupTimer, setBookingCleanupTimer] = useState(null);
  const [isBookingActive, setIsBookingActive] = useState(false);

  const clientSecretRef = useRef(null);
  const cleanupTimerRef = useRef(null);
  const bookingStartTimeRef = useRef(null);

  const navigate = useNavigate();
  const { profile, updateProfile, loading: profileLoading, setIsSignInOpen, isSignInOpen } = useProfile();
  
  // Add debug log to check profile data
  useEffect(() => {
    console.log("🧪 [PROFILE DEBUG] Current profile data:", {
      exists: !!profile,
      id: profile?.id,
      role: profile?.role,
      email: profile?.email,
      phone: profile?.phone_number,
      token: profile?.token ? "present" : "missing"
    });
  }, [profile]);
  
  const location = useLocation();
  
  // Save current form data to localStorage whenever it changes
  useEffect(() => {
    if (selectedDate || outletId || staffId || serviceId || time || clientName) {
      // Only save if we have valid data
      const isValidDate = selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime());
      
      const formData = {
        selectedDate: isValidDate ? selectedDate.toISOString() : null,
        outletId: outletId || null,
        staffId: staffId || null,
        serviceId: serviceId || null,
        time: time || null,
        clientName: clientName || null,
        serviceDuration: serviceDuration || null,
        timestamp: new Date().toISOString()
      };
      
      // Only save if we have at least one meaningful value
      if (isValidDate || outletId || staffId || serviceId || time || clientName) {
        saveDataToLocalStorage(formData);
      }
    }
  }, [selectedDate, outletId, staffId, serviceId, time, clientName, serviceDuration, saveDataToLocalStorage]);

  // Helper function to show success messages
  const showSuccessMessage = (message) => {
    setSnackbar({ open: true, message: message || "Booking successful!", severity: "success" });
  };

  // Helper function to show error messages
  const showErrorMessage = (message) => {
    setSnackbar({ open: true, message, severity: "error" });
  };

  // Validation functions
  const validateFullName = (fullname) => {
    const regex = /^[A-Za-z\s\-'/]+$/;
    return regex.test(fullname);
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return re.test(password);
  };

  // Sign-up handler
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, signUp: true }));
    setSignUpErrors({ name: "", phoneNumber: "", password: "", username: "", confirmPassword: "" });
    
    let newErrors = {
      email: "",
      username: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    };

    if (!validateEmail(signUpEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!signUpUsername) {
      newErrors.username = "Username cannot be empty.";
    }

    if (!validatePassword(signUpPassword)) {
      newErrors.password = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    }

    if (signUpPassword !== signUpConfirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.values(newErrors).some((e) => e !== "")) {
      setSignUpErrors(newErrors);
      setLoading(prev => ({ ...prev, signUp: false }));
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/customer/signup`,
        {
          phone_number: signUpPhoneNumber,
          password: signUpPassword,
          username: signUpUsername,
          email: signUpEmail,
        }
      );
      if (response.data.message) {
        await axios.post(`${API_BASE_URL}/customers/register`, {
          phoneNumber: signUpPhoneNumber,
          email: signUpEmail,
        });
        showSuccessMessage(response.data.message);
        setIsSignUpOpen(false);
        setSignUpPhoneNumber("");
        setSignUpPassword("");
        setSignUpEmail("");
        setSignUpErrors({ email: "", username: "", phoneNumber: "", password: "", confirmPassword: "" });
        setIsSignInOpen(true);
      }
    } catch (error) {
      // Support multiple field errors from backend (object)
      const errData = error.response?.data;
      if (errData && typeof errData === 'object' && (errData.email || errData.username || errData.phoneNumber || errData.password || errData.confirmPassword)) {
        setSignUpErrors({
          email: errData.email || "",
          username: errData.username || "",
          phoneNumber: errData.phoneNumber || "",
          password: errData.password || "",
          confirmPassword: errData.confirmPassword || ""
        });
      } else {
        const message = errData?.message || "Sign-up failed";
        // Try to parse which field the error is about
        if (message.toLowerCase().includes('email')) {
          setSignUpErrors({ email: message, username: "", phoneNumber: "", password: "", confirmPassword: "" });
        } else if (message.toLowerCase().includes('username')) {
          setSignUpErrors({ email: "", username: message, phoneNumber: "", password: "", confirmPassword: "" });
        } else if (message.toLowerCase().includes('phone')) {
          setSignUpErrors({ email: "", username: "", phoneNumber: message, password: "", confirmPassword: "" });
        } else if (message.toLowerCase().includes('password')) {
          setSignUpErrors({ email: "", username: "", phoneNumber: "", password: message, confirmPassword: "" });
        } else {
          setSignUpErrors({ email: message, username: "", phoneNumber: "", password: "", confirmPassword: "" });
        }
      }
    } finally {
      setLoading(prev => ({ ...prev, signUp: false }));
    }
  };


  // Cleanup incomplete bookings function
  const cleanupIncompleteBooking = useCallback(async (bookingId) => {
    if (!bookingId) return;

    try {
      const token = getAuthToken();
      if (!token) return;

      debugLog(`🧹 [CLEANUP] Attempting to delete draft booking: ${bookingId}`);
      
      const response = await client.delete(`/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      debugLog(`✅ [CLEANUP] Successfully deleted draft booking: ${bookingId}`);
      
      // Clear the incomplete booking from localStorage
      localStorage.removeItem(INCOMPLETE_BOOKING_KEY);
      localStorage.removeItem(BOOKING_TIMER_KEY);
      
      setIncompleteBookingId(null);
      setIsBookingActive(false);
      
    } catch (error) {
      console.error(`❌ [CLEANUP] Error deleting draft booking ${bookingId}:`, error);
      // Still clear the local references even if deletion fails
      localStorage.removeItem(INCOMPLETE_BOOKING_KEY);
      localStorage.removeItem(BOOKING_TIMER_KEY);
      setIncompleteBookingId(null);
      setIsBookingActive(false);
    }
  }, []);

  // Start cleanup timer for draft bookings
  const startCleanupTimer = useCallback((bookingId) => {
    if (!bookingId) return;

    debugLog(`⏰ [CLEANUP] Starting 5-minute cleanup timer for draft booking: ${bookingId}`);
    
    // Clear any existing timer
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
    }

    // Store booking info in localStorage
    localStorage.setItem(INCOMPLETE_BOOKING_KEY, bookingId.toString());
    localStorage.setItem(BOOKING_TIMER_KEY, (Date.now() + 300000).toString()); // 5 minutes from now
    
    setIncompleteBookingId(bookingId);
    setIsBookingActive(true);
    bookingStartTimeRef.current = Date.now();

    // Set 5-minute timer for draft bookings
    cleanupTimerRef.current = setTimeout(() => {
      cleanupIncompleteBooking(bookingId);
    }, 300000); // 5 minutes

    setBookingCleanupTimer(cleanupTimerRef.current);
  }, [cleanupIncompleteBooking]);

  // Cancel cleanup timer (when booking is completed)
  const cancelCleanupTimer = useCallback(() => {
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
      setBookingCleanupTimer(null);
    }
    
    localStorage.removeItem(INCOMPLETE_BOOKING_KEY);
    localStorage.removeItem(BOOKING_TIMER_KEY);
    setIncompleteBookingId(null);
    setIsBookingActive(false);
    bookingStartTimeRef.current = null;
    
    debugLog('⏹️ [CLEANUP] Cleanup timer cancelled');
  }, []);

  // Check for existing incomplete bookings on component mount
  useEffect(() => {
    const checkIncompleteBookings = () => {
      try {
        const incompleteBookingId = localStorage.getItem(INCOMPLETE_BOOKING_KEY);
        const timerEndTime = localStorage.getItem(BOOKING_TIMER_KEY);
        
        if (incompleteBookingId && timerEndTime) {
          const currentTime = Date.now();
          const endTime = parseInt(timerEndTime);
          
                  if (currentTime >= endTime) {
          // Timer has expired, clean up immediately
          debugLog('⏰ [CLEANUP] Found expired draft booking, cleaning up immediately');
          cleanupIncompleteBooking(incompleteBookingId);
        } else {
          // Timer still active, resume the countdown
          const remainingTime = endTime - currentTime;
          debugLog(`⏰ [CLEANUP] Resuming cleanup timer with ${remainingTime}ms remaining`);
            
            setIncompleteBookingId(incompleteBookingId);
            setIsBookingActive(true);
            
            cleanupTimerRef.current = setTimeout(() => {
              cleanupIncompleteBooking(incompleteBookingId);
            }, remainingTime);
            
            setBookingCleanupTimer(cleanupTimerRef.current);
          }
        }
      } catch (error) {
        console.error('❌ [CLEANUP] Error checking incomplete bookings:', error);
      }
    };

    checkIncompleteBookings();
  }, [cleanupIncompleteBooking]);

  // Handle page refresh/unload - keep the cleanup timer running
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isBookingActive && incompleteBookingId) {
        // Don't prevent the unload, just ensure the timer info is saved
        debugLog('📄 [CLEANUP] Page refreshing/closing with active draft booking, timer will continue');
        e.returnValue = 'You have a draft booking. If you leave, it will be automatically cancelled in 5 minutes if not completed.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isBookingActive, incompleteBookingId]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    bookingUtils.fetchOutlets(
      setLoading,
      setOutlets,
      setErrors
    );
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get("session_id");
    if (query.get("success") && sessionId) {
      const token = localStorage.getItem("token");
      client
        .get(`/bookings/payments/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          const booking = response.data;
          if (booking && booking.payment_status === "Paid") {
            // Cancel cleanup timer since payment is successful
            cancelCleanupTimer();
            
            setBookingDetails({
              id: booking.booking_id,
              outlet: booking.outlet_shortform,
              service: booking.service_name,
              date: booking.date,
              time: booking.time,
              customer_name: booking.customer_name,
              staff_name: booking.staff_name,
              price: Number(booking.price) || 0,
              payment_method: booking.payment_method || "Stripe",
              payment_status: booking.payment_status,
            });
            setBookingId(booking.booking_id);
            showSuccessMessage("Booking successful!");
            
            // Clear persisted form data after successful payment
            clearPersistedData();
            
setTimeout(() => {
  if (bookingHistoryRef.current) {
    scrollToSection(bookingHistoryRef);
  }
}, 2000);
          }
        })
        .catch((error) => {
          console.error("Error fetching booking details:", error);
          setPaymentError("Failed to fetch booking details. Please try again.");
        });
    } else if (query.get("cancelled")) {
      setPaymentError("Payment was cancelled.");
    }
  }, [location, scrollToSection, bookingHistoryRef]);

  useEffect(() => {
    if (bookingId && isBookingDetailsOpen) {
      bookingUtils.fetchReview(
        bookingId,
        setBookingDetails
      );
    }
  }, [bookingId, isBookingDetailsOpen]);

  // Add a new state to track if edit lock should be applied
  const [isEditLocked, setIsEditLocked] = useState(false);

  // In handleEditBooking, after setting all fields, set activeStep to last step and lock edit after all three fields are set
  const handleEditBooking = (
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
    updateBookingInList
  ) => {
    // Prefill all fields
    bookingUtils.handleEditBooking(
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
    );
    // Set to last step so all fields are visible/editable
    setActiveStep(steps.length - 1);
    setIsEditingBooking(true);
    // Update the booking in the list
    updateBookingInList(booking);
    // Remove any edit lock logic
  };

  // In the useEffect that recalculates activeStep, skip if isEditingBooking
  useEffect(() => {
    if (isEditingBooking) {
      setActiveStep(steps.length - 1);
      return;
    }
    const newActiveStep = bookingUtils.getActiveStep(
      selectedDate,
      outletId,
      staffId,
      serviceId,
      time,
      clientName
    );
    setActiveStep(newActiveStep);
  }, [selectedDate, outletId, staffId, serviceId, time, clientName, activeStep, isEditingBooking]);

  const handleChange = (field, value) => {
    debugLog(`Changing ${field} to`, value);
    debugLog('Current array states:', {
      outlets: Array.isArray(outlets) ? `Array(${outlets.length})` : typeof outlets,
      staff: Array.isArray(staff) ? `Array(${staff.length})` : typeof staff,
      services: Array.isArray(services) ? `Array(${services.length})` : typeof services,
      timeSlots: Array.isArray(timeSlots) ? `Array(${timeSlots.length})` : typeof timeSlots
    });
    switch (field) {
      case "selectedDate":
        const utcDate = value
          ? new Date(
              Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
            )
          : null;
        debugLog('[DATE CHANGE] Date changed:', {
          oldDate: selectedDate?.toISOString().split('T')[0],
          newDate: utcDate?.toISOString().split('T')[0],
          isEditingBooking
        });
        setSelectedDate(utcDate);
        if (!isEditingBooking) {
          setOutletId("");
          setStaffId("");
          setServiceId("");
          setServiceDuration(null);
          setTime("");
          setSelectedTimeSlots([]);
          setClientName("");
          setStaff([]);
          setTimeSlots([]);
          setServices([]);
          setStaffAvailabilities({});
          setIsEditingBooking(false);
          setCurrentBookingId(null);
          setCurrentBookingTime(null);
          debugLog("[DATE CHANGE] Date changed, clearing all selections and edit state (new booking)");
        } else {
          debugLog("[DATE CHANGE] Date changed, preserving all selections (editing existing booking)");
        }
        setErrors({});
        break;
      case "outletId":
        setOutletId(value);
        if (!isEditingBooking) {
          setStaffId("");
          setServiceId("");
          setServiceDuration(null);
          setTime("");
          setClientName("");
          setStaff([]);
          setTimeSlots([]);
          setServices([]);
          setStaffAvailabilities({});
        } else {
          debugLog('[OUTLET CHANGE] Outlet changed, preserving dependent selections (editing mode)');
        }
        setErrors({});
        break;
      case "staffId":
        setStaffId(value);
        if (!isEditingBooking) {
          setServiceId("");
          setServiceDuration(null);
          setTime("");
          setClientName("");
          setTimeSlots([]);
        } else {
          debugLog('[STAFF CHANGE] Staff changed, preserving dependent selections (editing mode)');
        }
        setErrors({});
        break;
      case "serviceId":
        setServiceId(value);
        let selectedService = Array.isArray(services) ? services.find((s) => s.id === value) : null;
        let newServiceDuration = selectedService ? selectedService.duration : null;
        // Debug log for selected service
        if (selectedService) {
          debugLog('[SERVICE DEBUG] Selected service:', selectedService.name, 'Duration:', selectedService.duration);
          // TEMP FIX: If Coloring Black Hair and duration > 90, override for testing
          if (selectedService.name && selectedService.name.toLowerCase().includes('coloring black hair') && selectedService.duration > 90) {
            debugLog('[SERVICE DEBUG] Overriding Coloring Black Hair duration from', selectedService.duration, 'to 90 for slot testing');
            newServiceDuration = 90;
            selectedService = { ...selectedService, duration: 90 };
          }
        }
        setServiceDuration(newServiceDuration);
        
        debugLog('[SERVICE CHANGE] Service changed:', {
          oldServiceId: serviceId,
          newServiceId: value,
          newServiceDuration,
          serviceName: selectedService?.name,
          isEditingBooking
        });
        
        // Check service duration compatibility when editing
        if (isEditingBooking && time && newServiceDuration && serviceDuration) {
          const oldDuration = serviceDuration;
          const durationChange = newServiceDuration - oldDuration;
          
          debugLog('[SERVICE CHANGE] Duration analysis:', {
            oldDuration,
            newDuration: newServiceDuration,
            durationChange,
            currentTime: time
          });
          
          if (durationChange > 0) {
            // New service is longer - check if it fits
            const timeToMinutes = (timeStr) => {
              const [hours, minutes] = timeStr.split(':').map(Number);
              return hours * 60 + minutes;
            };
            
            const currentTimeMinutes = timeToMinutes(time);
            const newEndTimeMinutes = currentTimeMinutes + newServiceDuration;
            const oldEndTimeMinutes = currentTimeMinutes + oldDuration;
            
            debugLog('[SERVICE CHANGE] Time slot analysis:', {
              currentTimeMinutes,
              oldEndTimeMinutes,
              newEndTimeMinutes,
              timeExtension: newEndTimeMinutes - oldEndTimeMinutes
            });
            
            // Check if the extended time would conflict with other bookings
            const hasConflict = bookings.some(booking => {
              if (booking.id === currentBookingId) return false; // Skip current booking
              
              const bookingTimeMinutes = timeToMinutes(booking.time);
              const bookingEndMinutes = bookingTimeMinutes + (booking.serviceDuration || 60);
              
              // Check for overlap
              return (currentTimeMinutes < bookingEndMinutes && newEndTimeMinutes > bookingTimeMinutes);
            });
            
            if (hasConflict) {
              debugLog('[SERVICE CHANGE] ⚠️ Service duration conflict detected!');
              showErrorMessage(`⚠️ Warning: The new service (${newServiceDuration} min) requires ${durationChange} more minutes than the current slot. This may conflict with other bookings. Please select a different time slot.`);
            } else {
              debugLog('[SERVICE CHANGE] ✅ New service duration fits in current slot');
              showSuccessMessage(`✅ Service updated successfully. The new duration (${newServiceDuration} min) fits in the current time slot.`);
            }
          } else if (durationChange < 0) {
            // New service is shorter - this is always safe
            debugLog('[SERVICE CHANGE] ✅ New service is shorter, no conflicts possible');
            showSuccessMessage(`✅ Service updated successfully. The new duration (${newServiceDuration} min) fits comfortably in the current time slot.`);
          }
        }
        
        // Only clear dependent fields if not editing
        if (!isEditingBooking) {
          setTime("");
          setClientName("");
          // Clear time slots to force refresh with new service duration
          setTimeSlots([]);
        } else {
          debugLog('[SERVICE CHANGE] Service changed, preserving time and client name (editing mode)');
        }
        
        setErrors({});
        break;
      case "time":
        const normalizedTime = bookingUtils.normalizeTime(value);
        debugLog('⏰ [TIME CHANGE] Time selection details:', {
          originalValue: value,
          normalizedTime: normalizedTime,
          previousTime: time,
          isEditingBooking: isEditingBooking,
          clientName: clientName
        });
        setTime(normalizedTime);
        
        // Only reset client name if not editing
        if (!isEditingBooking) {
          setClientName("");
          debugLog('🧹 [TIME CHANGE] Client name reset (not editing)');
        } else {
          debugLog('📝 [TIME CHANGE] Client name preserved (editing mode)');
        }
        
        setErrors({});
        
        debugLog('⏰ [TIME CHANGE] Time state updated:', {
          newTime: normalizedTime,
          stateAfterUpdate: 'Will be updated in next render'
        });
        break;
      case "clientName":
        setClientName(value);
        setErrors({});
        break;
      default:
        break;
    }
  };

  // Defensive dropdown logic: always allow current value when editing
  const getDropdownOptions = (options, currentValue, key = 'id') => {
    if (!options.some(opt => String(opt[key]) === String(currentValue)) && currentValue) {
      // If current value is not in options, add a placeholder option
      return [
        ...options,
        { [key]: currentValue, name: '[Current Selection]', disabled: true }
      ];
    }
    return options;
  };
  // Use getDropdownOptions for staff, service, and time dropdowns
  // Example: <EnhancedServiceDropdown ... options={getDropdownOptions(services, serviceId)} ... />
  // Example: <EnhancedBarberDropdown ... options={getDropdownOptions(staff, staffId)} ... />
  // Example: <EnhancedTimeSlotDropdown ... options={getDropdownOptions(timeSlots, time)} ... />

  // On form submit, always check isEditingBooking and currentBookingId
  const handleFormSubmit = async () => {
    // Add detailed token and profile debugging
    console.log("🔍 [FORM DEBUG] DETAILED AUTH CHECK:", {
      profile: profile ? {
        id: profile.id,
        role: profile.role,
        hasToken: !!profile.token
      } : null,
      isLoggedIn: !!profile,
      customerToken: localStorage.getItem("customer_token") ? "present" : "missing",
      legacyToken: localStorage.getItem("token") ? "present" : "missing",
      staffToken: localStorage.getItem("staff_token") ? "present" : "missing",
    });
    
    debugLog("🎯 [FORM DEBUG] Form submit triggered with:", {
      selectedDate: selectedDate?.toISOString(),
      outletId,
      staffId,
      serviceId,
      time,
      clientName,
      isLoggedIn: !!profile,
      isEditingBooking, // Log editing state
      currentBookingId: currentBookingId, // Log current booking ID
      token: localStorage.getItem("token") ? "present" : "missing",
      timestamp: new Date().toISOString()
    });

    if (
      !bookingUtils.validateForm(
        selectedDate,
        outletId,
        staffId,
        serviceId,
        time,
        clientName
      )
    ) {
      const validationErrors = {
        0: !selectedDate ? "Please select a date" : "",
        1: !outletId ? "Please select an outlet" : "",
        2: !staffId && staffId !== "any" ? "Please select a barber" : "",
        3: !serviceId ? "Please select a service" : "",
        4: !time ? "Please select a time" : "",
        5:
          !clientName || clientName.length > 10
            ? "Please enter a name (max 10 characters)"
            : "",
      };
      debugLog("❌ [FORM DEBUG] Validation failed:", validationErrors);
      setErrors(validationErrors);
      return;
    }
    if (staffId === "any" && time) {
      debugLog("�� [FORM DEBUG] Resolving 'any' staff to specific staff member");
      try {
        const dateStr = selectedDate.toISOString().split("T")[0];
        const response = await client.get("/bookings/staff-by-time", {
          params: {
            outlet_id: outletId,
            date: dateStr,
            time,
            service_id: serviceId,
          },
        });
        debugLog("👥 [FORM DEBUG] Available staff response:", response.data);
        if (response.data.length > 0) {
          const selectedStaff = response.data[0];
          debugLog("✅ [FORM DEBUG] Selected staff:", selectedStaff);
          setStaffId(selectedStaff.id);
          // Update the staffId variable for the booking submission
          staffId = selectedStaff.id;
        } else {
          debugLog("❌ [FORM DEBUG] No staff available for this time");
          setErrors({ 2: "No barbers available for this time" });
          return;
        }
      } catch (error) {
        console.error("❌ [FORM DEBUG] Error fetching staff for time:", error);
        setErrors({ 2: "Unable to assign a barber" });
        return;
      }
    }
    // Check authentication before proceeding
    debugLog("🔐 [FORM DEBUG] Auth check - current state:", { isLoggedIn: !!profile, profileLoading });
    
    if (profileLoading) {
      debugLog("🔄 [FORM DEBUG] Profile still loading, waiting...");
      showErrorMessage("Please wait, loading user profile...");
      return;
    }
    
    if (!profile || !profile.id || profile.role !== 'customer') {
      debugLog("🔓 [FORM DEBUG] User not authenticated, opening sign-in modal");
      
      // Save current form data to localStorage before opening sign-in modal
      const formData = {
        selectedDate: selectedDate ? selectedDate.toISOString() : null,
        outletId,
        staffId,
        serviceId,
        time,
        clientName,
        serviceDuration
      };
      localStorage.setItem('TEMP_BOOKING_FORM_DATA', JSON.stringify(formData));
      debugLog("💾 [FORM DEBUG] Saved form data to localStorage before login:", formData);
      
      setIsSignInOpen(true);
      return; // Add this return statement to prevent booking submission when not logged in
    } else {
      debugLog("✅ [FORM DEBUG] Auth passed, checking slot availability before submission");
      debugLog("📝 [FORM DEBUG] Editing state:", { 
        isEditingBooking, 
        currentBookingId, 
        currentBookingTime 
      });
      
      // Show loading state during slot check
      setLoading(prev => ({ ...prev, payment: true }));
      
      try {
        // Check slot availability before proceeding with submission
        let isSlotAvailable = true;
        if (!(isEditingBooking && time === currentBookingTime)) {
          isSlotAvailable = await bookingUtils.checkSlotAvailabilityBeforeSubmission(
            outletId,
            serviceId,
            staffId,
            selectedDate,
            time,
            setTimeSlots,
            setTime,
            showErrorMessage,
            isEditingBooking,
            currentBookingTime,
            currentBookingId
          );
        }
        if (!isSlotAvailable) {
          debugLog("❌ [FORM DEBUG] Slot not available, submission cancelled");
          return;
        }
        
        debugLog("✅ [FORM DEBUG] Slot available, proceeding with booking submission");
        debugLog("📝 [FORM DEBUG] Booking details before submission:", {
          bookingDetails,
          bookingDetailsId: bookingDetails?.id,
          isEditingBooking
        });
      await bookingUtils.handleBookingSubmit(
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
        currentBookingId, // Use currentBookingId instead of bookingDetails?.id
        startCleanupTimer,
        cancelCleanupTimer,
        clearPersistedData,
        serviceDuration,
        staff // Pass the staff array
      );
      
      // If we're editing a booking, update it in the modal list as well
      if (isEditingBooking && currentBookingId) {
        // Find the staff member by ID to get the name
        const selectedStaff = staff.find(s => s.id === staffId);
        const staffName = selectedStaff ? (selectedStaff.name || selectedStaff.username) : "N/A";
        
        // Create a complete booking object with all necessary fields
        const updatedBooking = {
          id: currentBookingId,
          customer_name: clientName,
          outlet: outlets.find(o => o.id === outletId)?.name || "N/A",
          outlet_id: outletId,
          staff_name: staffName,
          staff_id: staffId,
          service: services.find(s => s.id === serviceId)?.name || "N/A",
          service_id: serviceId,
          date: selectedDate.toISOString().split("T")[0],
          time: time,
          price: services.find(s => s.id === serviceId)?.price || 0,
          serviceDuration: serviceDuration || 30,
          payment_method: bookingDetails?.payment_method || "Pending",
          payment_status: bookingDetails?.payment_status || "Pending"
        };
        
        console.log("📝 [FORM DEBUG] Updating booking details after successful edit:", updatedBooking);
        
        // Update bookingDetails to trigger the useEffect in BookingDetailsModal
        setBookingDetails(updatedBooking);
        
        // Update the booking in the lists
        updateBookingInList(updatedBooking);
        
        // Open the booking details modal to show the updated booking
        setTimeout(() => {
          setIsBookingDetailsOpen(true);
        }, 100);
      }
      } catch (error) {
        console.error("[FORM DEBUG] Error during booking process:", error);
        showErrorMessage("An error occurred during booking. Please try again.");
        setLoading(prev => ({ ...prev, payment: false }));
        // Only reset editing state on error, not on success
        setIsEditingBooking(false);
      } finally {
        setLoading(prev => ({ ...prev, payment: false }));
      }
    }
  };

  // Fetch staff and services when date and outlet change
  useEffect(() => {
    if (selectedDate && outletId) {
      bookingUtils.fetchStaff(
        selectedDate,
        outletId,
        setLoading,
        setStaff,
        setStaffAvailabilities,
        setErrors,
        bookingUtils.toTitleCase
      );
      bookingUtils.fetchServices(selectedDate, outletId, setLoading, setServices, setErrors);

      // Fetch existing bookings for the current day to determine availability
      debugLog("📅 [BOOKINGS] Fetching existing bookings for date and outlet", {
        date: selectedDate.toISOString().split('T')[0],
        outletId: outletId
      });
      
      client.get(`/bookings?date=${selectedDate.toISOString().split('T')[0]}&outlet_id=${outletId}`)
        .then(response => {
          debugLog("✅ [BOOKINGS] Successfully fetched bookings:", response.data);
          setBookings(response.data);
        })
        .catch(error => {
          console.error('❌ [BOOKINGS] Error fetching existing bookings:', error);
          setBookings([]); // Set empty array on error to prevent stale data
        });
    } else {
      // Clear bookings when date or outlet changes
      setBookings([]);
    }
  }, [selectedDate, outletId]);

  // Separate useEffect for time slots with debouncing - now properly waits for bookings
  useEffect(() => {
    // Reduced slot condition logging frequency
    if (DEBUG && Math.random() < 0.1) {
      debugLog("[SLOTS] Checking slot fetch conditions", {
        selectedDate: !!selectedDate,
        outletId: !!outletId,
        staffId: staffId,
        staffIdType: typeof staffId,
        serviceId: serviceId,
        serviceDuration: serviceDuration,
        bookingsLength: bookings.length,
        shouldFetch: selectedDate && outletId && (staffId || staffId === "any") && serviceId
      });
    }

    // Clear the current selected time when dependencies change (except when editing)
    if (!isEditingBooking && time && (
      !selectedDate || 
      !outletId || 
      (!staffId && staffId !== "any") || 
      !serviceId
    )) {
      debugLog("[SLOTS] Clearing selected time due to dependency change");
      setTime("");
    }

    // Only clear time slots if we're changing a dependency that affects the fetch
    // Don't clear immediately on every dependency change to prevent race conditions
    if (
      !selectedDate ||
      !outletId ||
      (!staffId && staffId !== "any") ||
      !serviceId
    ) {
      // Reduced slot clearing logging frequency
      if (DEBUG && Math.random() < 0.1) {
        debugLog("[SLOTS] Conditions not met, will clear timeSlots after debounce");
      }
      // Use debounce for clearing as well to prevent race conditions
      const clearTimeoutId = setTimeout(() => {
        // Reduced slot clearing logging frequency
        if (DEBUG && Math.random() < 0.1) {
          debugLog("[SLOTS] Clearing timeSlots after debounce");
        }
        setTimeSlots([]);
      }, 100); // Shorter debounce for clearing
      return () => clearTimeout(clearTimeoutId);
    }

    // Debounce the API call to prevent excessive requests
    const timeoutId = setTimeout(() => {
      debugLog("[SLOTS] All conditions met, calling fetchTimeSlots with bookings:", {
        bookingsCount: bookings.length,
        bookings: bookings.map(b => ({ id: b.id, time: b.time, service_id: b.service_id }))
      });
      
      bookingUtils.fetchTimeSlots(
        selectedDate,
        outletId,
        staffId,
        serviceId,
        setLoading,
        setTimeSlots,
        setErrors,
        isEditingBooking ? currentBookingTime : null, // Pass current booking time when editing
        isEditingBooking ? currentBookingId : null, // Pass current booking ID when editing
        bookings, // Existing bookings to filter out
        serviceDuration || 60, // Use service duration or default to 60 minutes
        modalBookings // Pass modal bookings for conflict checking
      );
    }, 300); // 300ms debounce

    // Cleanup timeout on dependency change
    return () => clearTimeout(timeoutId);
  }, [selectedDate, outletId, staffId, serviceId, serviceDuration, bookings, isEditingBooking, currentBookingTime, currentBookingId, time, modalBookings]); // Added bookings and editing state to dependencies

  // Separate useEffect to handle editing state changes without triggering time slot refetch
  useEffect(() => {
    if (isEditingBooking && currentBookingTime && currentBookingId) {
      debugLog("📝 [EDIT MODE] Editing state activated, but not refetching slots to prevent loops", {
        currentBookingTime,
        currentBookingId,
        isEditingBooking
      });
    }
  }, [isEditingBooking, currentBookingTime, currentBookingId]);

  // Handle time slot selection for better UX
  const handleTimeSlotSelected = useCallback((selectedTime) => {
    debugLog('⏰ [TIME SLOT] Time slot selected:', selectedTime);
    // Track selected time slots and avoid duplicates
    setSelectedTimeSlots(prev => [...new Set([...prev, selectedTime])]);
  }, []);

  // Clear selected time slots when form is reset
  useEffect(() => {
    if (!selectedDate || !outletId || !staffId || !serviceId) {
      setSelectedTimeSlots([]);
    }
  }, [selectedDate, outletId, staffId, serviceId]);

  // Add this state at the top with other useState hooks
  const [shouldAutoSubmitAfterLogin, setShouldAutoSubmitAfterLogin] = useState(false);

  // Add this useEffect after all state hooks
  useEffect(() => {
    if (shouldAutoSubmitAfterLogin) {
      if (
        selectedDate &&
        outletId &&
        staffId &&
        serviceId &&
        time &&
        clientName
      ) {
        bookingUtils.handleBookingSubmit(
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
          currentBookingId, // Use currentBookingId instead of bookingDetails?.id
          startCleanupTimer,
          cancelCleanupTimer,
          clearPersistedData,
          serviceDuration,
          staff // Pass the staff array
        );
        setShouldAutoSubmitAfterLogin(false);
      }
    }
  }, [shouldAutoSubmitAfterLogin, selectedDate, outletId, staffId, serviceId, time, clientName]);

  // Add these states at the top with other useState hooks
  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [readyToSubmitBooking, setReadyToSubmitBooking] = useState(false);

  // Add this useEffect to restore form state from pendingBookingData
  useEffect(() => {
    if (readyToSubmitBooking && pendingBookingData) {
      setSelectedDate(pendingBookingData.selectedDate ? new Date(pendingBookingData.selectedDate) : new Date());
      setOutletId(pendingBookingData.outletId || "");
      setStaffId(pendingBookingData.staffId || "");
      setServiceId(pendingBookingData.serviceId || "");
      setTime(pendingBookingData.time || "");
      setClientName(pendingBookingData.clientName || "");
      setServiceDuration(pendingBookingData.serviceDuration || null);
    }
  }, [readyToSubmitBooking, pendingBookingData]);

  // Add this useEffect to trigger booking submit only after all fields are set
  useEffect(() => {
    if (
      readyToSubmitBooking &&
      selectedDate &&
      outletId &&
      staffId &&
      serviceId &&
      time &&
      clientName
    ) {
      (async () => {
        await bookingUtils.handleBookingSubmit(
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
          setIsBookingDetailsOpen, // this will open the modal after booking is created
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
          staff // Pass the staff array
        );
        setReadyToSubmitBooking(false);
        setPendingBookingData(null);
      })();
    }
  }, [readyToSubmitBooking, selectedDate, outletId, staffId, serviceId, time, clientName]);

  // Add at the top with other useState hooks
  const [pendingInit, setPendingInit] = useState(null);
  // ... existing code ...
  // On load, store persisted data in pendingInit
  useEffect(() => {
    const saved = localStorage.getItem('huuk_booking_form_data');
    if (saved) {
      setPendingInit(JSON.parse(saved));
    }
  }, []);
  // ... existing code ...
  // Wait for options to load, then set values from pendingInit
  useEffect(() => {
    if (
      pendingInit &&
      Array.isArray(services) && services.length > 0 &&
      Array.isArray(staff) && staff.length > 0 &&
      Array.isArray(outlets) && outlets.length > 0
    ) {
      if (outlets.some(o => String(o.id) === String(pendingInit.outletId))) setOutletId(pendingInit.outletId);
      if (staff.some(s => String(s.id) === String(pendingInit.staffId))) setStaffId(pendingInit.staffId);
      if (services.some(s => String(s.id) === String(pendingInit.serviceId))) setServiceId(pendingInit.serviceId);
      if (pendingInit.selectedDate) setSelectedDate(new Date(pendingInit.selectedDate));
      if (pendingInit.time) setTime(pendingInit.time);
      if (pendingInit.clientName) setClientName(pendingInit.clientName);
      setPendingInit(null);
    }
  }, [pendingInit, services, staff, outlets]);
  // ... existing code ...
  // Block time slot fetch until all dependencies are loaded and valid
  useEffect(() => {
    debugLog('[DEBUG] useEffect for time slot fetch triggered');
    debugLog('[DEBUG] Dependencies:', {
      selectedDate,
      outletId,
      staffId,
      serviceId,
      serviceDuration,
      isEditingBooking,
      currentBookingTime,
      currentBookingId
    });

    // Only run if all IDs are set and present in their arrays
    const outletValid = outletId && Array.isArray(outlets) && outlets.some(o => String(o.id) === String(outletId));
    const staffValid = staffId && Array.isArray(staff) && staff.some(s => String(s.id) === String(staffId));
    const serviceValid = serviceId && Array.isArray(services) && services.some(s => String(s.id) === String(serviceId));

    if (
      selectedDate &&
      outletValid &&
      staffValid &&
      serviceValid
    ) {
      debugLog('[DEBUG] All dependencies valid, calling fetchTimeSlots');
      bookingUtils.fetchTimeSlots(
        selectedDate,
        outletId,
        staffId,
        serviceId,
        setLoading,
        setTimeSlots,
        setErrors,
        isEditingBooking ? currentBookingTime : null, // Always pass currentBookingTime when editing
        isEditingBooking ? currentBookingId : null,   // Always pass currentBookingId when editing
        bookings,
        serviceDuration || 60,
        modalBookings
      );
    } else {
      debugLog('[DEBUG] Not all dependencies valid, not calling fetchTimeSlots', {
        selectedDate,
        outletId,
        outletValid,
        staffId,
        staffValid,
        serviceId,
        serviceValid
      });
    }
  }, [selectedDate, outletId, staffId, serviceId, serviceDuration, isEditingBooking, currentBookingTime, currentBookingId]);
  // ... existing code ...

  // Defensive reset for serviceId if not in available services
  useEffect(() => {
    if (
      serviceId &&
      Array.isArray(services) &&
      services.length > 0 &&
      !services.some(s => String(s.id) === String(serviceId))
    ) {
      setServiceId("");
    }
  }, [serviceId, services]);

  // Add updateBookingInList function to update booking in modal/bookings list after editing
  const updateBookingInList = (editedBooking) => {
    console.log("🔄 [UPDATE BOOKING] Updating booking in lists:", editedBooking);
    
    if (!editedBooking || !editedBooking.id) {
      console.error("🔄 [UPDATE BOOKING] Invalid booking object or missing ID:", editedBooking);
      return;
    }
    
    // Ensure staff_name is set correctly
    let updatedBooking = { ...editedBooking };
    
    // If staff_name is missing but we have staff_id, look it up
    if ((!updatedBooking.staff_name || updatedBooking.staff_name === "N/A") && updatedBooking.staff_id) {
      const matchingStaff = staff.find(s => s.id === updatedBooking.staff_id);
      if (matchingStaff) {
        updatedBooking.staff_name = matchingStaff.name || matchingStaff.username;
        console.log("🔄 [UPDATE BOOKING] Found staff name from staff array:", updatedBooking.staff_name);
      }
    }
    
    setModalBookings(prev => {
      // Ensure we have bookings to update
      if (!prev || prev.length === 0) {
        console.log("🔄 [UPDATE BOOKING] No modal bookings to update, adding new booking");
        return [updatedBooking];
      }
      
      // Find the booking by ID (handle different ID formats)
      const bookingIndex = prev.findIndex(b => 
        String(b.id) === String(updatedBooking.id) || 
        (b.id && updatedBooking.id && 
         (b.customer_name === updatedBooking.customer_name &&
          b.date === updatedBooking.date &&
          b.time === updatedBooking.time))
      );
      
      if (bookingIndex !== -1) {
        // Update existing booking
        const updated = [...prev];
        updated[bookingIndex] = { ...prev[bookingIndex], ...updatedBooking };
        console.log("🔄 [UPDATE BOOKING] Updated modal booking at index", bookingIndex);
        return updated;
      } else {
        // Add as new booking if not found
        console.log("🔄 [UPDATE BOOKING] Booking not found in modal bookings, adding as new");
        return [...prev, updatedBooking];
      }
    });
    
    setBookings(prev => {
      // Ensure we have bookings to update
      if (!prev || prev.length === 0) {
        console.log("🔄 [UPDATE BOOKING] No main bookings to update, adding new booking");
        return [updatedBooking];
      }
      
      // Find the booking by ID (handle different ID formats)
      const bookingIndex = prev.findIndex(b => 
        String(b.id) === String(updatedBooking.id) || 
        (b.id && updatedBooking.id && 
         (b.customer_name === updatedBooking.customer_name &&
          b.date === updatedBooking.date &&
          b.time === updatedBooking.time))
      );
      
      if (bookingIndex !== -1) {
        // Update existing booking
        const updated = [...prev];
        updated[bookingIndex] = { ...prev[bookingIndex], ...updatedBooking };
        console.log("🔄 [UPDATE BOOKING] Updated main booking at index", bookingIndex);
        return updated;
      } else {
        // Add as new booking if not found
        console.log("🔄 [UPDATE BOOKING] Booking not found in main bookings, adding as new");
        return [...prev, updatedBooking];
      }
    });
  };

  // Add these states at the top of the component:
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);

  // 1. Add at the top with other useState hooks:
  const [justBookedAfterLogin, setJustBookedAfterLogin] = useState(false);

  // 3. Add this useEffect to open Booking Details Modal after booking post-login:
  useEffect(() => {
    if (justBookedAfterLogin && bookingDetails) {
      setIsBookingDetailsOpen(true);
      setJustBookedAfterLogin(false);
    }
  }, [justBookedAfterLogin, bookingDetails]);

  // Listen for the custom booking-login-success event
  useEffect(() => {
    const handleLoginSuccess = (event) => {
      console.log('[BOOKING] Login success event received with booking data');
      const bookingData = event.detail?.bookingData;
      if (bookingData) {
        // Set the booking data and trigger submission
        setPendingBookingData(bookingData);
        setReadyToSubmitBooking(true);
        // Remove the temporary data
        localStorage.removeItem('TEMP_BOOKING_FORM_DATA');
      }
    };

    // Add event listener
    window.addEventListener('booking-login-success', handleLoginSuccess);

    // Clean up
    return () => {
      window.removeEventListener('booking-login-success', handleLoginSuccess);
    };
  }, []);

  // Add a function to check if the user is logged in after sign-in modal closes
  const checkAndSubmitAfterLogin = useCallback(() => {
    console.log("🔄 [AUTH] Checking if user is logged in after sign-in modal closed");
    
    // Check if user is logged in
    const isLoggedIn = !!profile && profile.id && profile.role === 'customer';
    const hasToken = !!localStorage.getItem("customer_token") || !!localStorage.getItem("token");
    
    console.log("🔄 [AUTH] Login status:", { 
      isLoggedIn, 
      hasToken,
      profile: profile ? { id: profile.id, role: profile.role } : null
    });
    
    // If user is logged in and has token, submit booking
    if (isLoggedIn && hasToken) {
      console.log("✅ [AUTH] User is logged in, submitting booking");
      
      // Get saved form data
      const savedFormData = localStorage.getItem('TEMP_BOOKING_FORM_DATA');
      if (savedFormData) {
        const formData = JSON.parse(savedFormData);
        console.log("📝 [AUTH] Retrieved saved form data:", formData);
        
        // Set form data
        if (formData.selectedDate) setSelectedDate(new Date(formData.selectedDate));
        if (formData.outletId) setOutletId(formData.outletId);
        if (formData.staffId) setStaffId(formData.staffId);
        if (formData.serviceId) setServiceId(formData.serviceId);
        if (formData.time) setTime(formData.time);
        if (formData.clientName) setClientName(formData.clientName);
        if (formData.serviceDuration) setServiceDuration(formData.serviceDuration);
        
        // Remove saved form data
        localStorage.removeItem('TEMP_BOOKING_FORM_DATA');
        
        // Submit booking after a short delay to ensure all state is updated
        setTimeout(() => {
          console.log("🚀 [AUTH] Submitting booking after login");
          handleFormSubmit();
        }, 500);
      }
    }
  }, [profile, handleFormSubmit]);
  
  // Add useEffect to check login status when sign-in modal closes
  useEffect(() => {
    // When sign-in modal closes and we have a profile, check if we should submit booking
    if (!isSignInOpen && profile && profile.id) {
      checkAndSubmitAfterLogin();
    }
  }, [isSignInOpen, profile, checkAndSubmitAfterLogin]);

  return (
    <div className="cust-booking">
      <h2>BOOK YOUR APPOINTMENT</h2>
      <div className="cust-container">
        <Stepper
          activeStep={activeStep || 0}
          alternativeLabel
          className="cust-stepper"
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ fontFamily: 'Quicksand, sans-serif' }}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <div className="cust-form">
          <div className="form-columns">
            <div className="form-column-left">
              <div className="form-field">
                <label>Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={selectedDate ? selectedDate.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }).replace(/\//g, '-') : ''}
                    onClick={() => !(isEditingBooking && isEditLocked) && setIsDatePickerOpen(true)}
                    readOnly
                    placeholder="Select a date"
                    className="name-input"
                    style={{ cursor: isEditingBooking && isEditLocked ? 'not-allowed' : 'pointer', background: isEditingBooking && isEditLocked ? '#f5f5f5' : undefined }}
                    disabled={isEditingBooking && isEditLocked}
                  />
                  <SimpleCalendar
                    value={selectedDate}
                    onChange={(date) => handleChange("selectedDate", date)}
                    minDate={new Date()}
                    open={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                </div>
                {errors[0] && (
                  <Typography color="error">{errors[0]}</Typography>
                )}
              </div>
              <div className="form-field">
                <label>Outlet</label>
                <EnhancedOutletDropdown
                  value={Array.isArray(outlets) && outlets.some(o => String(o.id) === String(outletId)) ? outletId : ""}
                  onChange={(id) => !(isEditingBooking && isEditLocked) && handleChange("outletId", id)}
                  disabled={isEditingBooking && isEditLocked}
                  outlets={Array.isArray(outlets) ? outlets : []}
                  loading={loading.outlets}
                  errors={errors.outlets || errors[1]}
                  isEditMode={isEditingBooking}
                />
              </div>
              <div className="form-field">
                <label>Barber</label>
                <EnhancedBarberDropdown
                  value={Array.isArray(staff) && staff.some(s => String(s.id) === String(staffId)) ? staffId : ""}
                  onChange={(id) => !(isEditingBooking && isEditLocked) && handleChange("staffId", id)}
                  disabled={isEditingBooking && isEditLocked}
                  staff={Array.isArray(staff) ? staff : []}
                  loading={loading.staff}
                  errors={errors.staff || errors[2]}
                  staffAvailabilities={staffAvailabilities}
                  isEditMode={isEditingBooking}
                />
              </div>
            </div>
            <div className="form-column-right">
              <div className="form-field">
                <label>Service</label>
                {debugLog('[DEBUG] Rendering EnhancedServiceDropdown', {
                  value: Array.isArray(services) && services.some(s => String(s.id) === String(serviceId)) ? String(serviceId) : "",
                  services,
                  disabled: !staffId && staffId !== "any"
                })}
                <EnhancedServiceDropdown
                  value={Array.isArray(services) && services.some(s => String(s.id) === String(serviceId)) ? String(serviceId) : ""}
                  onChange={(id) => handleChange("serviceId", id)}
                  disabled={!staffId && staffId !== "any"}
                  services={Array.isArray(services) ? services : []}
                  loading={loading.services}
                  errors={errors.services || errors[3]}
                  serviceBookingCounts={{}} // TODO: Add actual service booking data from backend
                  isEditMode={isEditingBooking}
                />
              </div>
              <div className="form-field">
                <label>Time</label>
                {debugLog('[DEBUG] Rendering EnhancedTimeSlotDropdown', {
                  value: Array.isArray(timeSlots) && timeSlots.some(slot => String(slot) === String(time)) ? time : "",
                  timeSlots,
                  disabled: !serviceId
                })}
                <EnhancedTimeSlotDropdown
                  value={Array.isArray(timeSlots) && timeSlots.some(slot => String(slot) === String(time)) ? time : ""}
                  onChange={(selectedTime) => handleChange("time", selectedTime)}
                  disabled={!serviceId}
                  timeSlots={Array.isArray(timeSlots) ? timeSlots : []}
                  loading={loading.slots}
                  errors={errors.slots || errors[4]}
                  timeSlotBookingCounts={{}} // TODO: Add actual time slot booking data from backend
                  onTimeSlotSelected={handleTimeSlotSelected}
                  selectedTimeSlots={selectedTimeSlots}
                  isEditMode={isEditingBooking}
                  originalBookingTime={currentBookingTime}
                  selectedDate={selectedDate}
                />
              </div>
              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => handleChange("clientName", e.target.value)}
                  disabled={!time}
                  maxLength={10}
                  placeholder="Your Name"
                  className="name-input"
                />
                {errors[5] && (
                  <Typography color="error">{errors[5]}</Typography>
                )}
              </div>
            </div>
          </div>
          {bookingError && (
            <Typography color="error" sx={{ mt: 2, textAlign: "center" }}>
              {bookingError}
            </Typography>
          )}

          {isEditingBooking ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'nowrap', marginTop: 16 }}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  setIsEditingBooking(false);
                  setCurrentBookingId(null);
                  setCurrentBookingTime(null);
                  setActiveStep(0);
                  setSelectedDate(new Date());
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
                  setErrors({});
                }}
                style={{ whiteSpace: 'nowrap', fontFamily: 'Quicksand, sans-serif', fontWeight: 'bold' }}
              >
                Cancel Edit
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleFormSubmit}
                style={{ whiteSpace: 'nowrap', fontFamily: 'Quicksand, sans-serif', fontWeight: 'bold' }}
              >
                Confirm Edit
              </Button>
            </div>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleFormSubmit}
              style={{ marginTop: 16, fontFamily: 'Quicksand, sans-serif', fontWeight: 'bold' }}
            >
              Submit
            </Button>
          )}
        </div>
      </div>
     
         

        
    
      
      {/* Sign-up Modal */}
      <Modal
        isOpen={isSignUpOpen}
        onRequestClose={() => setIsSignUpOpen(false)}
        contentLabel="Sign Up Modal"
        className={styles["homepage-signup-modal"]}
        overlayClassName={styles["homepage-signup-overlay"]}
        parentSelector={() => document.body}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        preventScroll={true}
      >
        <animated.div
          style={{
            ...signUpAnimation,
            width: '1000px',
            maxWidth: '100vw',
            minWidth: '320px',
          }}
          className={styles["homepage-signup-modal-container"]}
        >
          <div className={styles["homepage-signup-left-section"]}>
            <div className={styles["h2-wrapper-homepage"]}>
              <h2 className={styles["h2he-homepage"]}>Hello</h2>
              <h2 className={styles["h2he2-homepage"]}>Newcomer!</h2>
            </div>
            <p className={styles["create-account-heading-homepage"]}>
              Create your own account
            </p>
            <div className={styles["modal-link-container"]}>
              <span className={styles["have-account-homepage"]}>
                Already have an account?{" "}
              </span>
              <span
                onClick={() => { setIsSignUpOpen(false); setIsSignInOpen(true); }}
                className={styles["sign-in-text-homepage"]}
              >
                Sign In
              </span>
            </div>
          </div>

          <div className={styles["homepage-signup-right-section"]}>
            <h2 className={styles["sign-up-heading-homepage"]}>Sign Up</h2>
            {loading.signUp && <div>Loading...</div>}
            <form onSubmit={handleSignUp} className={styles["sign-up-form-homepage"]}>
              <label htmlFor="signUpName">Email</label>
              <div style={{ position: "relative" }}>
                <MdEmail
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signUpErrors.email ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="email"
                  id="signUpName"
                  value={signUpEmail}
                  placeholder="Enter your email"
                  onChange={(e) => {
                    setSignUpEmail(e.target.value);
                    setSignUpErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: signUpErrors.email ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signUpErrors.email
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    paddingLeft: "40px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading.signUp}
                />
              </div>
              {signUpErrors.email && (
                <p className={styles["error-homepage"]}>{signUpErrors.email}</p>
              )}

              <label htmlFor="signUpUsername">Username</label>
              <div style={{ position: "relative" }}>
                <MdPerson
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signUpErrors.username ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="text"
                  id="signUpUsername"
                  value={signUpUsername}
                  placeholder="Enter your username"
                  onChange={(e) => {
                    setSignUpUsername(e.target.value);
                    setSignUpErrors((prev) => ({ ...prev, username: "" }));
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: signUpErrors.username ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signUpErrors.username
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    paddingLeft: "40px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading.signUp}
                />
              </div>
              {signUpErrors.username && (
                <p className={styles["error-homepage"]}>{signUpErrors.username}</p>
              )}

              <label htmlFor="signUpPhoneNumber">Phone Number</label>
              <div style={{ position: "relative" }}>
                <MdPhone
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signUpErrors.phoneNumber ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="tel"
                  id="signUpPhoneNumber"
                  value={signUpPhoneNumber}
                  placeholder="01234567890"
                  onChange={(e) => {
                    setSignUpPhoneNumber(e.target.value);
                    setSignUpErrors((prev) => ({ ...prev, phoneNumber: "" }));
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: signUpErrors.phoneNumber ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signUpErrors.phoneNumber
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading.signUp}
                />
              </div>
              {signUpErrors.phoneNumber && (
                <p className={styles["error-homepage"]}>{signUpErrors.phoneNumber}</p>
              )}
              
              <label htmlFor="signUpPassword">Password</label>
              <div style={{ position: "relative" }}>
                <MdLock
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signUpErrors.password ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type={showSignUpPassword ? 'text' : 'password'}
                  id="signUpPassword"
                  placeholder="Enter your password"
                  value={signUpPassword}
                  onChange={(e) => {
                    setSignUpPassword(e.target.value);
                    setSignUpErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  style={{
                    paddingLeft: "40px",
                    color: signUpErrors.password ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signUpErrors.password
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    paddingLeft: "40px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                    paddingRight: '40px',
                  }}
                  disabled={loading.signUp}
                />
                <span
                  onClick={() => setShowSignUpPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '10px',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#1a1a1a',
                    fontSize: '1.2rem'
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignUpPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </span>
              </div>
              {signUpErrors.password && (
                <p className={styles["error-homepage"]}>{signUpErrors.password}</p>
              )}

              <label htmlFor="signUpConfirmPassword">Confirm Password</label>
              <div style={{ position: "relative" }}>
                <MdLock
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signUpErrors.confirmPassword ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type={showSignUpConfirmPassword ? 'text' : 'password'}
                  id="signUpConfirmPassword"
                  placeholder="Confirm your password"
                  value={signUpConfirmPassword}
                  onChange={(e) => {
                    setSignUpConfirmPassword(e.target.value);
                    setSignUpErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  style={{
                    paddingLeft: "40px",
                    color: signUpErrors.confirmPassword ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signUpErrors.confirmPassword
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    paddingLeft: "40px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                    paddingRight: '40px',
                  }}
                  disabled={loading.signUp}
                />
                <span
                  onClick={() => setShowSignUpConfirmPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '10px',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#1a1a1a',
                    fontSize: '1.2rem'
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={showSignUpConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignUpConfirmPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </span>
              </div>
              {signUpErrors.confirmPassword && (
                <p className={styles["error-homepage"]}>{signUpErrors.confirmPassword}</p>
              )}

              <button
                type="submit"
                className={styles["sign-up-btn-homepage"]}
                disabled={loading.signUp}
              >
                {loading.signUp ? "Signing Up..." : "Sign Up"}
              </button>
            </form>
          </div>

          <button
            className={styles["close-btn-homepage"]}
            onClick={() => {
              setIsSignUpOpen(false);
              setSignUpPhoneNumber("");
              setSignUpPassword("");
              setSignUpEmail("");
              setSignUpUsername("");
              setSignUpConfirmPassword("");
              setSignUpErrors({ name: "", phoneNumber: "", password: "", username: "", confirmPassword: "" });
              setLoading((prev) => ({ ...prev, signUp: false }));
            }}
          >
            x
          </button>
        </animated.div>
      </Modal>
      
      <BookingDetailsModal
        isOpen={isBookingDetailsOpen}
        onClose={() => {
          setIsBookingDetailsOpen(false);
          // Only reset form if not editing (i.e., after a new booking)
          if (!isEditingBooking) {
            setActiveStep(0);
            setSelectedDate(new Date());
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
          }
        }}
        bookings={bookings}
        bookingDetails={bookingDetails}
        handleDeleteBooking={() =>
          bookingUtils.handleDeleteBooking(
            bookingId,
            setBookings,
            setBookingDetails,
            setIsBookingDetailsOpen,
            setBookingError,
            showSuccessMessage,
            showErrorMessage
          )
        }
        handleAddBooking={() =>
          bookingUtils.handleAddBooking(
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
            setBookingDetails, // Add this parameter
            setBookingId // Add this parameter
          )
        }
        handleEditBooking={(booking) =>
          handleEditBooking(
            booking,
            () => setIsBookingDetailsOpen(false),
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
            bookingUtils.normalizeTime,
            setCurrentBookingId,
            updateBookingInList
          )
        }
        openPaymentMethodModal={() => {
          setIsBookingDetailsOpen(false);
          setIsPaymentMethodModalOpen(true);
        }}
        loading={loading}
        setActiveStep={setActiveStep}
        setBookingDetails={setBookingDetails}
        setSelectedDate={setSelectedDate}
        setOutletId={setOutletId}
        outlets={outlets}
        setStaffId={setStaffId}
        staff={staff}
        setTime={setTime}
        setServiceId={setServiceId}
        services={services}
        setClientName={setClientName}
        serviceDuration={serviceDuration}
        setIsEditingBooking={setIsEditingBooking}
        setModalBookingsParent={setModalBookings}
        isEditingBooking={isEditingBooking}
        onEditComplete={() => {
          // Reset edit state when edit is completed
          setIsEditingBooking(false);
          setCurrentBookingId(null);
          setCurrentBookingTime(null);
          debugLog("📝 [EDIT] Edit state reset after completion");
        }}
        updateBookingInList={updateBookingInList}
      />
      <PaymentModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => {
          setIsPaymentMethodModalOpen(false);
          setPaymentMethod("fpx");
          setPaymentError("");
        }}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        bookingDetails={bookingDetails}
        paymentError={paymentError}
        setPaymentError={setPaymentError}
        loading={loading}
        setLoading={setLoading}
        clientName={clientName}
        bookingId={bookingId}
        initiatePaymentSession={() =>
          bookingUtils.initiatePaymentSession(
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
            showErrorMessage
          )
        }
        handlePayAtOutlet={() =>
          bookingUtils.handlePayAtOutlet(
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
          )
        }
        scrollToSection={scrollToSection}
        bookingHistoryRef={bookingHistoryRef}
        setClientSecret={setClientSecret}
        clientSecretRef={clientSecretRef}
        setBookingDetails={setBookingDetails}
        setIsPaymentMethodModalOpen={setIsPaymentMethodModalOpen}
        setIsFPXModalOpen={setIsFPXModalOpen}
        profile={profile}
        setIsConfirmationOpen={setIsConfirmationOpen}
      />
      <FPXModal
        isOpen={isFPXModalOpen}
        onClose={() => {
          setIsFPXModalOpen(false);
          setClientSecret("");
          clientSecretRef.current = null;
          setPaymentError("");
        }}
        clientSecret={clientSecret}
        clientName={clientName}
        bookingId={bookingId}
        paymentError={paymentError}
        setPaymentError={setPaymentError}
        loading={loading}
        setLoading={setLoading}
        setBookingDetails={setBookingDetails}
        setIsConfirmationOpen={setIsConfirmationOpen}
        showSuccessMessage={showSuccessMessage}
        showErrorMessage={showErrorMessage}
        scrollToSection={scrollToSection}
        bookingHistoryRef={bookingHistoryRef}
      />
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => {
          setIsConfirmationOpen(false);
          setPaymentMethod("fpx");
          setClientSecret("");
          clientSecretRef.current = null;
          setBookingDetails(null);
          setPaymentError("");
        }}
        bookingDetails={bookingDetails}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentError={paymentError}
        setPaymentError={setPaymentError}
        loading={loading}
        setLoading={setLoading}
        initiatePaymentSession={() =>
          bookingUtils.initiatePaymentSession(
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
            showErrorMessage
          )
        }
        handlePayAtOutlet={() =>
          bookingUtils.handlePayAtOutlet(
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
          )
        }
        handleDownloadReceipt={() => bookingUtils.handleDownloadReceipt(bookingDetails)}
        serviceDuration={serviceDuration}
        outlets={outlets}
        staff={staff}
        services={services}
        setActiveStep={setActiveStep}
        setSelectedDate={setSelectedDate}
        setOutletId={setOutletId}
        setStaffId={setStaffId}
        setServiceId={setServiceId}
        setTime={setTime}
        setClientName={setClientName}
        setIsConfirmationOpen={setIsConfirmationOpen}
        showSuccessMessage={showSuccessMessage}
        showErrorMessage={showErrorMessage}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          "& .MuiSnackbarContent-root": {
            minWidth: "320px",
            maxWidth: "500px",
          },
          zIndex: 1002,
        }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{
            width: "100%",
            fontSize: "0.9rem",
            fontFamily: "Quicksand, sans-serif",
            fontWeight: 500,
            backgroundColor: snackbar.severity === "success" ? "#4caf50" : "#ff6b4a", // Green for success, red for error
            color: "#fff",
            border: `2px solid ${snackbar.severity === "success" ? "#4caf50" : "#ff6b4a"}`,
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
          {snackbar.message}
        </Alert>
      </Snackbar>
      <SwitchModeButton />
    </div>
  );
}

export default Booking;
