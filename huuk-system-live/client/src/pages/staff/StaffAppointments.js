import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";
import moment from "moment";
import { Button } from "@mui/material";
import "../../styles/staffAppointments.css";
import AddBookingModal from "../../components/AddBookingModal";
import RescheduleBookingModal from "../../components/RescheduleBookingModal";
import { TIME_SLOTS, calculateAvailableSlotDuration, getAvailableServicesForSlot } from "../../utils/timeSlotUtils";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../../utils/constants";

const StaffAppointments = () => {
  const navigate = useNavigate();
const location = useLocation();
  const initialBooking = location.state?.booking || null;
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingIds, setProcessingIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [todaySlots, setTodaySlots] = useState([]);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [newBooking, setNewBooking] = useState({
    customer_name: '',
    phone_number: '',
    user_id: null, // Add user_id for linking to users table
    service_name: '',
    booking_date: selectedDate || moment().format('YYYY-MM-DD'),
    start_time: '',
    end_time: ''
  });
  const [customerDetection, setCustomerDetection] = useState({
    isDetecting: false,
    isExisting: false,
    customerInfo: null,
    lastVisit: null,
    bookingHistory: [] // Add booking history array
  });
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [paymentConfirmationData, setPaymentConfirmationData] = useState(null);



  // Retry mechanism for API calls
  // Handler functions for appointment actions
  const handleReschedule = (appointmentId) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    setSelectedAppointment(appointment);
    setRescheduleDate(appointment.booking_date);
    setRescheduleTime(appointment.start_time);
    setShowRescheduleModal(true);
  };

  const handleCancel = async (appointmentId) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      try {
        
        await api.put(`/bookings/staff/appointment/${appointmentId}/status`, {
          status: "cancelled"
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` }
        });
        
        
        // Update local state to mark as cancelled instead of removing
        setAppointments(prev => 
          prev.map(apt => 
            apt.id === appointmentId ? { ...apt, status: "cancelled" } : apt
          )
        );
        
      // Refresh appointments from server to ensure data consistency
      await fetchAppointments();
      
      // Note: todaySlots will be updated automatically via useEffect when appointments change
      } catch (error) {
        alert("Failed to cancel the appointment. Please try again.");
      }
    }
  };

  const handleRescheduleSubmit = async (rescheduleData) => {
    try {
      console.log('Reschedule data being sent:', rescheduleData);
      
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      console.log('Using token:', token ? 'Token exists' : 'No token found');
      
      const response = await api.put(`/bookings/staff/appointment/${rescheduleData.id}/reschedule`, {
        booking_date: rescheduleData.newDate,
        start_time: rescheduleData.newTime,
        // Add additional fields that might be required
        date: rescheduleData.newDate,
        time: rescheduleData.newTime
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Reschedule response:', response.data);
      
      // Calculate end_time based on service duration (assuming 30 minutes default)
      const calculateEndTime = (startTime, serviceDuration = 30) => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + serviceDuration * 60 * 1000);
        return endDate.toTimeString().slice(0, 5); // Format as HH:mm
      };
      
      // Update local state with calculated end_time
      setAppointments(prev => 
        prev.map(apt => {
          if (apt.id === rescheduleData.id) {
            const updatedApt = {
              ...apt, 
              booking_date: rescheduleData.newDate, 
              start_time: rescheduleData.newTime
            };
            
            // Use service duration if available, otherwise default to 30 minutes
            let serviceDuration = 30;
            
            // Try to extract duration from service name or existing end_time calculation
            if (apt.end_time && apt.start_time) {
              const startMoment = moment(apt.start_time, 'HH:mm');
              const endMoment = moment(apt.end_time, 'HH:mm');
              if (startMoment.isValid() && endMoment.isValid()) {
                serviceDuration = endMoment.diff(startMoment, 'minutes');
              }
            }
            
            updatedApt.end_time = calculateEndTime(rescheduleData.newTime, serviceDuration);
            return updatedApt;
          }
          return apt;
        })
      );
      
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      alert('Appointment rescheduled successfully!');
      
      // Refresh appointments from server
      await fetchAppointments();
      
      // Note: todaySlots will be updated automatically via useEffect when appointments change
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      console.error("Error response:", error.response?.data);
      
      // More specific error messages
      if (error.response?.status === 400) {
        alert(`Failed to reschedule appointment: ${error.response.data?.message || 'Invalid request data'}`);
      } else if (error.response?.status === 401) {
        alert('Authentication failed. Please log in again.');
      } else {
        alert(`Failed to reschedule appointment: ${error.message}`);
      }
    }
  };

  const retryApiCall = async (apiCall, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiCall();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  };

  // Use the centralized time slots from utils
  const generateTimeSlots = () => {
    return TIME_SLOTS;
  };

  // Generate time slots for the selected date (or today if no date selected)
  const generateTodaySlots = () => {
    const slots = [];
    const startTime = moment().hour(10).minute(0);
    const endTime = moment().hour(21).minute(30);
    const targetDate = selectedDate || moment().format("YYYY-MM-DD");
    
    // Debug: Log today's date and appointments
    console.log('Generating today slots for date:', targetDate);
    console.log('Total appointments:', appointments.length);
    console.log('Blocked slots:', blockedSlots.length);
    
    // Filter today's appointments for debugging
    const todayAppointments = appointments.filter(apt => {
      const aptDate = extractDateOnly(apt.booking_date);
      const isToday = aptDate === targetDate;
      if (isToday) {
        console.log('Today appointment:', {
          id: apt.id,
          customer: apt.customer_name,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status,
          booking_date: apt.booking_date,
          extracted_date: aptDate
        });
      }
      return isToday;
    });
    
    console.log('Today appointments count:', todayAppointments.length);
    
    while (startTime.isBefore(endTime)) {
      const timeSlot = startTime.format("HH:mm");
      
      // Enhanced booking check that matches StaffDashboard.js logic
      const isBooked = appointments.some(apt => {
        // Skip appointments with invalid status or times - match StaffDashboard.js conditions
        if (!apt || extractDateOnly(apt.booking_date) !== targetDate || 
            apt.status === "-" || apt.start_time === "-" || apt.end_time === "-" ||
            (apt.status && apt.status.toLowerCase() === "cancelled") ||
            apt.is_draft) {
          return false;
        }

        // Calculate booking duration in slots - exact same logic as StaffDashboard.js
        const bookingStartTime = moment(apt.start_time, "HH:mm");
        const bookingEndTime = moment(apt.end_time, "HH:mm");
        
        // Validate moment objects
        if (!bookingStartTime.isValid() || !bookingEndTime.isValid()) {
          return false;
        }
        
        const durationSlots = moment.duration(bookingEndTime.diff(bookingStartTime)).asMinutes() / 30;

        // Check if the current slot is within the booking period - exact same logic as StaffDashboard.js
        for (let i = 0; i < durationSlots; i++) {
          if (bookingStartTime.clone().add(i * 30, 'minutes').format("HH:mm") === timeSlot) {
            console.log('Slot', timeSlot, 'is BOOKED by appointment:', {
              customer: apt.customer_name,
              start: apt.start_time,
              end: apt.end_time,
              status: apt.status
            });
            return true;
          }
        }
        return false;
      });
      
      const isBlocked = blockedSlots.some(slot => slot.time === timeSlot);
      
      const slotStatus = isBooked ? 'booked' : isBlocked ? 'blocked' : 'available';
      
      console.log('Slot', timeSlot, '- Status:', slotStatus);
      
      slots.push({
        time: timeSlot,
        status: slotStatus
      });
      
      startTime.add(30, 'minutes');
    }
    
    console.log('Generated slots summary:', slots.map(s => `${s.time}:${s.status}`));
    return slots;
  };

  useEffect(() => {
    const slots = generateTimeSlots();
    setAvailableSlots(slots);
    
    // Fetch blocked slots first, then appointments to ensure proper dependency order
    const loadData = async () => {
      await fetchBlockedSlots(); // Fetch blocked slots when component mounts
      await fetchAppointments();
    };
    
    loadData();
    // If initial booking is present, set it as selected
    if (initialBooking) {
      setSelectedAppointment(initialBooking);
    }
  }, [currentPage, initialBooking]);

  // Update today's slots whenever appointments or blocked slots change
  useEffect(() => {
    console.log('Updating today slots with appointments:', appointments.length, 'blocked slots:', blockedSlots.length);
    const updatedSlots = generateTodaySlots();
    console.log('Generated slots:', updatedSlots);
    setTodaySlots(updatedSlots);
  }, [appointments, blockedSlots]);

  // Handle overflow detection for enhanced UX
  useEffect(() => {
    const handleOverflowDetection = () => {
      const container = document.querySelector('.appointments-table-container');
      if (container) {
        const hasOverflow = container.scrollHeight > container.clientHeight;
        if (hasOverflow) {
          container.classList.add('has-overflow');
        } else {
          container.classList.remove('has-overflow');
        }
      }
    };

    handleOverflowDetection();
    window.addEventListener('resize', handleOverflowDetection);
    
    return () => {
      window.removeEventListener('resize', handleOverflowDetection);
    };
  }, [appointments]);

  useEffect(() => {
    const socket = io(API_BASE_URL);
    socket.on("bookingUpdated", () => {
      fetchAppointments();
      fetchBlockedSlots();
    });
    socket.on("booking_updated", () => {
      fetchAppointments();
      fetchBlockedSlots();
    });
    socket.on("slotUpdate", () => {
      fetchAppointments();
      fetchBlockedSlots();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle reusable modal submission
  const handleSubmitBooking = async (formData) => {
    try {
      console.log('Submitting booking:', formData);
      console.log('[FORM DEBUG] formData.service:', formData.service);
      console.log('[FORM DEBUG] formData.customerName:', formData.customerName);
      console.log('[FORM DEBUG] formData.phoneNumber:', formData.phoneNumber);
      console.log('[FORM DEBUG] formData.selectedTime:', formData.selectedTime);
      console.log('[FORM DEBUG] formData.bookingDate:', formData.bookingDate);
      
      // Map service ID from form data to actual service ID in the database
      const serviceIdMapping = {
        shampoo: 1,
        haircut: 2,
        'hair-tattoo': 3,
        'scalp-treatment': 4,
        'hair-colour': 5,
      };
      
      // Get token
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      
      // Prepare booking data - use user_id if customer exists
      const bookingData = {
        service_id: parseInt(formData.service) || serviceIdMapping[formData.service] || parseInt(formData.service_id) || 0,
        staff_id: currentUser.id,
        date: formData.bookingDate || formData.date || selectedSlot?.day?.date || selectedSlot?.date || moment().format('YYYY-MM-DD'),
        time: formData.time || formData.selectedTime || selectedSlot?.time || '',
        customer_name: formData.customerName || formData.customer_name || '',
      };
      
      console.log('[FORM DEBUG DETAILED] bookingData construction:');
      console.log('  - service_id result:', bookingData.service_id);
      console.log('  - customer_name result:', bookingData.customer_name);
      console.log('  - date result:', bookingData.date);
      console.log('  - time result:', bookingData.time);
      
      // If we have detected an existing user, use their user_id
      if (customerDetection.isExisting && customerDetection.customerInfo?.user_id) {
        bookingData.user_id = customerDetection.customerInfo.user_id;
        console.log('Using existing user_id:', bookingData.user_id);
      } else {
        // For new customers, send phone number so backend can create new user
        bookingData.phone_number = formData.phoneNumber || formData.phone_number;
        console.log('Creating new user with phone:', bookingData.phone_number);
      }
      
      console.log('[BOOKING SUBMIT] Final booking data being sent:', JSON.stringify(bookingData, null, 2));
      
      const response = await api.post('/bookings/staff/appointment', bookingData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.status === 200 || response.status === 201) {
        alert('Booking submitted successfully!');
        
        // Comprehensive data refresh after successful booking
        await Promise.all([
          fetchAppointments(),    // Refresh appointments list
          fetchBlockedSlots(),    // Refresh blocked slots
        ]);
        
        // Force update today slots display
        const updatedSlots = generateTodaySlots();
        setTodaySlots(updatedSlots);
        
        // The todaySlots will be updated automatically via useEffect when appointments change
      }
      
      // Close modal and reset
      setShowAddBookingModal(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error('[BOOKING SUBMIT] Full error object:', error);
      console.error('[BOOKING SUBMIT] Error response:', error.response?.data);
      console.error('[BOOKING SUBMIT] Error status:', error.response?.status);
      console.error('[BOOKING SUBMIT] Error message:', error.message);
      
      let errorMessage = 'Failed to submit booking. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = `Booking failed: ${error.response.data.message}`;
      } else if (error.response?.data?.error) {
        errorMessage = `Booking failed: ${error.response.data.error}`;
      }
      
      alert(errorMessage);
    }
  };
  
  const handleAddNewBooking = async () => {
    try {
      const response = await api.post('/bookings/staff/appointment', newBooking, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` }
      });
      
      setAppointments(prev => [...prev, response.data]);
      setShowAddBookingModal(false);
      setNewBooking({
        customer_name: '',
        phone_number: '',
        service_name: '',
        booking_date: selectedDate || moment().format('YYYY-MM-DD'),
        start_time: '',
        end_time: ''
      });
      // Note: todaySlots will be updated automatically via useEffect when appointments change
    } catch (error) {
      console.error('Error adding new booking:', error);
      alert('Failed to add new booking. Please try again.');
    }
  };

  const handleTimeSlotSelect = (time) => {
    setNewBooking(prev => ({ ...prev, start_time: time }));
  };


  // Customer detection by phone number
  const detectCustomerByPhone = async (phoneNumber) => {
    if (!phoneNumber || phoneNumber.length < 6) {
      setCustomerDetection({
        isDetecting: false,
        isExisting: false,
        customerInfo: null,
        lastVisit: null
      });
      return;
    }

    setCustomerDetection(prev => ({ ...prev, isDetecting: true }));
    
    try {
      // Check if user exists by phone number and get user info
      const userResponse = await api.get(`/users/by-phone/${phoneNumber}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` }
      });
      
      if (userResponse.data.user) {
        const user = userResponse.data.user;
        
        // Get customer's booking history by user_id
        const bookingHistoryResponse = await api.get(`/bookings/staff/appointments/by-user/${user.id}`, {
          params: {
            limit: 5  // Get last 5 bookings for history
          },
          headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` }
        });
        
        const bookingHistory = bookingHistoryResponse.data.appointments || [];
        const lastVisit = bookingHistory[0];
        
        setCustomerDetection({
          isDetecting: false,
          isExisting: true,
          customerInfo: {
            user_id: user.id,
            name: user.name,
            phone_number: user.phone,
            email: user.email || null
          },
          lastVisit: lastVisit ? {
            date: lastVisit.booking_date,
            service: lastVisit.service_name,
            time: lastVisit.start_time
          } : null,
          bookingHistory: bookingHistory
        });
        
        // Auto-fill customer name
        setNewBooking(prev => ({ 
          ...prev, 
          customer_name: user.name,
          user_id: user.id 
        }));
      } else {
        // User not found - this will be a new customer
        setCustomerDetection({
          isDetecting: false,
          isExisting: false,
          customerInfo: null,
          lastVisit: null,
          bookingHistory: []
        });
      }
    } catch (error) {
      console.error('Error detecting customer:', error);
      // If phone not found, treat as new customer
      setCustomerDetection({
        isDetecting: false,
        isExisting: false,
        customerInfo: null,
        lastVisit: null,
        bookingHistory: []
      });
    }
  };

  // Customer detection by name
  const detectCustomerByName = async (name) => {
    if (!name || name.length < 2) {
      setCustomerDetection({
        isDetecting: false,
        isExisting: false,
        customerInfo: null,
        lastVisit: null
      });
      return;
    }

    setCustomerDetection(prev => ({ ...prev, isDetecting: true }));
    
    try {
      // Search for customer by name in appointments
      const response = await api.get('/bookings/staff/appointments', {
        params: {
          search: name,
          limit: 1
        },
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` }
      });
      
      const matchingAppointment = response.data.appointments?.find(apt => 
        apt.customer_name?.toLowerCase().includes(name.toLowerCase())
      );
      
      if (matchingAppointment) {
        setCustomerDetection({
          isDetecting: false,
          isExisting: true,
          customerInfo: {
            name: matchingAppointment.customer_name,
            phone_number: matchingAppointment.phone_number
          },
          lastVisit: {
            date: matchingAppointment.booking_date,
            service: matchingAppointment.service_name,
            time: matchingAppointment.start_time
          }
        });
        
        // Auto-fill phone number if available
        if (matchingAppointment.phone_number) {
          setNewBooking(prev => ({ ...prev, phone_number: matchingAppointment.phone_number }));
        }
      } else {
        setCustomerDetection({
          isDetecting: false,
          isExisting: false,
          customerInfo: null,
          lastVisit: null
        });
      }
    } catch (error) {
      console.error('Error detecting customer by name:', error);
      setCustomerDetection({
        isDetecting: false,
        isExisting: false,
        customerInfo: null,
        lastVisit: null
      });
    }
  };

  // Handle phone number change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newBooking.phone_number) {
        detectCustomerByPhone(newBooking.phone_number);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [newBooking.phone_number]);

  // Handle name change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newBooking.customer_name && !newBooking.phone_number) {
        detectCustomerByName(newBooking.customer_name);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [newBooking.customer_name]);

  // Initialize currentUser from localStorage
  useEffect(() => {
    const loggedInUser = localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
    if (loggedInUser) {
      try {
        const userData = JSON.parse(loggedInUser);
        setCurrentUser(userData);
      } catch (error) {
        console.error("Error parsing user data from localStorage:", error);
      }
    }
  }, []);


  // Reset customer detection when modal closes
  const handleCloseModal = () => {
    setShowAddBookingModal(false);
    setNewBooking({
      customer_name: '',
      phone_number: '',
      service_name: '',
      booking_date: selectedDate || moment().format('YYYY-MM-DD'),
      start_time: '',
      end_time: ''
    });
    setCustomerDetection({
      isDetecting: false,
      isExisting: false,
      customerInfo: null,
      lastVisit: null
    });
  };

  // Fetch blocked slots from server
  const fetchBlockedSlots = async () => {
    try {
      // Use consistent token retrieval
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      const userJson = localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
      
      if (!token || !userJson) {
        return;
      }
      
      const userData = JSON.parse(userJson);
      const userId = userData.id;
      const targetDate = selectedDate || moment().format('YYYY-MM-DD');
      
      
      const response = await api.get('/staff/blocked-slots', {
        params: {
          staff_id: userId,
          date: targetDate
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const blockedSlots = response.data.blocked_slots || [];
        setBlockedSlots(blockedSlots);
      } else {
        setBlockedSlots([]);
      }
    } catch (error) {
      setBlockedSlots([]);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      
      // Check authentication first with consistent token retrieval
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      const userJson = localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
      
      if (!token) {
        setError("Please log in to view appointments.");
        return;
      }
      
      if (!userJson) {
        setError("User data not found. Please log in again.");
        return;
      }
      
      const userData = JSON.parse(userJson);
      const userId = userData.id;
      
      if (!userId) {
        setError("User ID not found. Please log in again.");
        return;
      }
      
      const params = {
        page: currentPage,
        limit: 100, // Reduced limit for testing
        include_all_dates: true, // Include past, current, and future bookings
        sort_by: 'booking_date', // Sort by date
        sort_order: 'desc' // Show most recent first
      };
      
      
      const response = await api.get("/bookings/staff/appointments", {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      
      if (response.data) {
        const appointmentsData = response.data.appointments || response.data || [];
        
        // Debug: Log the raw data to understand what we're receiving
        console.log('Raw appointments data:', appointmentsData);
        console.log('Number of appointments:', appointmentsData.length);
        
        // Log unique dates to see what dates we have
        const uniqueDates = [...new Set(appointmentsData.map(apt => {
          const date = extractDateOnly(apt.booking_date);
          console.log('Appointment date:', apt.booking_date, 'extracted:', date);
          return date;
        }))].sort();
        console.log('Unique dates found:', uniqueDates);
        
        // Sort appointments by date first (most recent first), then by start time
        const sortedAppointments = appointmentsData.sort((a, b) => {
          const dateA = moment(a.booking_date, moment.ISO_8601);
          const dateB = moment(b.booking_date, moment.ISO_8601);
          if (dateA.isSame(dateB, 'day')) {
            return moment(a.start_time, "HH:mm").diff(moment(b.start_time, "HH:mm"));
          }
          return dateB.diff(dateA); // Changed to show most recent first
        });
        
        console.log('Sorted appointments:', sortedAppointments);
        setAppointments(sortedAppointments);
        setTotalPages(response.data.totalPages || 1);
      } else {
        setAppointments([]);
        setTotalPages(1);
      }
    } catch (err) {
      
      // Set specific error messages based on the error type
      if (err.response?.status === 401) {
        setError("Authentication failed. Please log in again.");
        // Clear invalid tokens
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
      } else if (err.response?.status === 403) {
        setError("Access denied. You don't have permission to view appointments.");
      } else if (err.response?.status === 500) {
        setError("Server error occurred. Please contact administrator.");
      } else if (err.response?.status === 404) {
        setError("Appointment service not found. Please check your configuration.");
      } else if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        setError("Unable to connect to server. Please check your internet connection.");
      } else {
        setError("Failed to fetch appointments. Please try again.");
      }
      
      // If API fails, show empty appointments array
      setAppointments([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Fetch payment data for specific booking
  const fetchPaymentData = async (bookingId) => {
    console.log(`Starting fetchPaymentData for booking ${bookingId}...`);
    try {
      // Fetch payment data for the specific booking
      const response = await api.get(`/payments/booking/${bookingId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` },
      });
      
      console.log("Payment data response:", response.data);
      
      // Process and return payment data
      if (response.data) {
        const paymentData = {
          ...response.data,
          // Normalize payment method values
          payment_method: response.data.payment_method === "pay_at_outlet" ? "Pay at Outlet" : 
                        response.data.payment_method === "online_payment" ? "Online Payment" : 
                        response.data.payment_method || "Unknown",
          // Ensure payment status is capitalized consistently
          payment_status: response.data.payment_status === "paid" ? "Paid" :
                        response.data.payment_status === "pending" ? "Pending" :
                        response.data.payment_status || "Unknown"
        };
        
        console.log("Processed payment data:", paymentData);
        return paymentData;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching payment data for booking ${bookingId}:`, error);
      console.error("Payment API error response:", error.response?.data);
      console.error("Payment API error status:", error.response?.status);
      return null;
    }
  };

  // New function to check if booking needs payment confirmation with improved payment data fetching
  const checkPaymentConfirmation = async (appointmentId) => {
    console.log('DEBUG: Starting payment confirmation check for booking ID:', appointmentId);
    try {
      // First, get booking details to check if payment confirmation is needed
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      
      if (!token) {
        console.error('No authentication token available');
        alert('Authentication required. Please log in again.');
        return;
      }
      
      // Fetch both booking details and payment data in parallel for efficiency
      const [bookingResponse, paymentData] = await Promise.all([
        api.get(`/bookings/booking-details/${appointmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchPaymentData(appointmentId)
      ]);
      
      console.log('DEBUG: Booking details API response:', bookingResponse.data);
      console.log('DEBUG: Payment data:', paymentData);
      
      if (bookingResponse.status === 200) {
        const bookingData = bookingResponse.data;
        
        // Merge payment data with booking data if available
        if (paymentData) {
          bookingData.paymentMethod = paymentData.payment_method || bookingData.paymentMethod;
          bookingData.paymentStatus = paymentData.payment_status || bookingData.paymentStatus;
        }
        
        console.log('DEBUG: Booking data extracted:', {
          paymentMethod: bookingData.paymentMethod,
          paymentStatus: bookingData.paymentStatus,
          isWalkIn: bookingData.isWalkIn,
          customerName: bookingData.customerName,
          serviceName: bookingData.serviceName,
          totalAmount: bookingData.totalAmount
        });
        
        // Force show payment confirmation for Pay at Outlet or pending payments
        const shouldShowPaymentConfirmation = 
          bookingData.paymentMethod === "Pay at Outlet" || 
          bookingData.paymentMethod === "pay_at_outlet" || 
          bookingData.paymentStatus === "Pending" ||
          bookingData.isWalkIn === true;
        
        console.log('DEBUG: Should show payment confirmation?', shouldShowPaymentConfirmation);
        console.log('DEBUG: Condition breakdown:', {
          'paymentMethod === Pay at Outlet': bookingData.paymentMethod === "Pay at Outlet",
          'paymentMethod === pay_at_outlet': bookingData.paymentMethod === "pay_at_outlet",
          'paymentStatus === Pending': bookingData.paymentStatus === "Pending",
          'isWalkIn': bookingData.isWalkIn
        });
        
        if (shouldShowPaymentConfirmation) {
          console.log('SUCCESS: Showing payment confirmation popup');
          // Show payment confirmation popup BEFORE marking as done
          const confirmationData = {
            bookingId: appointmentId,
            paymentMethod: bookingData.paymentMethod || "Pay at Outlet",
            customerName: bookingData.customerName || "Customer",
            serviceName: bookingData.serviceName || "Service",
            totalAmount: bookingData.totalAmount || "0.00",
            paymentStatus: bookingData.paymentStatus || "Pending",
            isWalkIn: bookingData.isWalkIn || false
          };
          console.log('DEBUG: Payment confirmation data:', confirmationData);
          
          // Make sure to set these in the correct order
          setPaymentConfirmationData(confirmationData);
          setTimeout(() => {
          setShowPaymentConfirmation(true);
          console.log('DEBUG: showPaymentConfirmation state set to true');
          }, 50); // Small delay to ensure state updates properly
        } else {
          console.log('INFO: No payment confirmation needed, marking as done directly');
          // No payment confirmation needed, mark as done directly
          await handleStatusChange(appointmentId, 'completed');
        }
      }
    } catch (error) {
      console.error('ERROR: Error checking payment confirmation:', error);
      console.error('ERROR: Error response:', error.response?.data);
      console.error('ERROR: Error status:', error.response?.status);
      // If we can't check, proceed with marking as done
      await handleStatusChange(appointmentId, 'completed');
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    console.log(`[Status Change] Processing ${newStatus} for booking ${appointmentId}`);
    setProcessingIds(prev => new Set(prev).add(appointmentId));
    
    try {
      const response = await api.put(`/bookings/staff/appointment/${appointmentId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` } }
      );
      
      console.log('[API Response] Status update response:', response.data);
      
      // Update local state immediately for better UX
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId ? { ...apt, status: newStatus } : apt
        )
      );
      
      alert(`Appointment marked as ${newStatus}.`);
      
      // Refresh appointments from server to ensure data consistency
      await fetchAppointments();
      
      // Also refresh blocked slots to ensure UI consistency
      await fetchBlockedSlots();
      
      // Force update today slots display
      const updatedSlots = generateTodaySlots();
      setTodaySlots(updatedSlots);
      
    } catch (err) {
      console.error('[Status Change Error]:', err);
      
      // Revert local state change if API call failed
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId ? { ...apt, status: apt.status } : apt
        )
      );
      
      alert("Failed to update appointment status. Please try again.");
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };
  
  const handlePaymentPaid = async () => {
    try {
      if (!paymentConfirmationData) return;
      
      // First mark the booking as completed
      await handleStatusChange(paymentConfirmationData.bookingId, 'completed');
      
      // Then update payment status to Paid
      const response = await api.post("/payments/update-payment-status", {
        booking_id: paymentConfirmationData.bookingId,
        payment_status: "Paid"
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` },
      });
      
      if (response.status === 200) {
        // Close the confirmation modal
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);
        
        // Refresh all data to ensure UI consistency
        await Promise.all([
          fetchAppointments(), // Refresh appointments
          fetchBlockedSlots() // Refresh blocked slots
        ]);
        
        // Show success notification
        alert("Payment marked as Paid successfully!");
        
        // Force update today slots display
        const updatedSlots = generateTodaySlots();
        setTodaySlots(updatedSlots);
      }
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      alert("Failed to update payment status. Please try again.");
      
      // Refresh data anyway to ensure UI consistency
      await fetchAppointments();
    }
  };
  
  const handlePaymentUnpaid = async () => {
    try {
      if (!paymentConfirmationData) return;
      
      // First mark the booking as completed
      await handleStatusChange(paymentConfirmationData.bookingId, 'completed');
      
      // Then update payment status to Pending (keep as pending)
      const response = await api.post("/payments/update-payment-status", {
        booking_id: paymentConfirmationData.bookingId,
        payment_status: "Pending"
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` },
      });
      
      if (response.status === 200) {
        // Close the confirmation modal
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);
        
        // Refresh all data to ensure UI consistency
        await Promise.all([
          fetchAppointments(), // Refresh appointments
          fetchBlockedSlots() // Refresh blocked slots
        ]);
        
        // Show confirmation message
        alert("Booking marked as completed. Payment status kept as Pending. Please collect payment when customer is ready.");
        
        // Force update today slots display
        const updatedSlots = generateTodaySlots();
        setTodaySlots(updatedSlots);
      }
    } catch (error) {
      console.error("Error updating payment status:", error);
      alert("Failed to update payment status. Please try again.");
      
      // Refresh data anyway to ensure UI consistency
      await fetchAppointments();
    }
  };

  const toggleTimeSlot = async (time) => {
    try {
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      const userJson = localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
      
      if (!userJson) {
        alert('User data not found. Please log in again.');
        return;
      }
      
      const userData = JSON.parse(userJson);
      const currentStaffId = userData.id;
      
      // Check if this slot is already blocked by the current staff member
      const existingBlock = blockedSlots.find(slot => slot.time === time && slot.staff_id === currentStaffId);
      
      if (existingBlock) {
        alert('You have already blocked this time slot.');
        return;
      }
      
      // Check if this slot is blocked by another staff member
      const blockedByOther = blockedSlots.find(slot => slot.time === time && slot.staff_id !== currentStaffId);
      
      if (blockedByOther) {
        alert('This time slot is already blocked by another staff member.');
        return;
      }
      
      const action = 'block'; // Only allow blocking
      
      const response = await api.post('/staff/toggle-slot-blocking', {
        staff_id: currentStaffId,
        date: moment().format('YYYY-MM-DD'),
        time: time,
        action: action
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Update local state - add new blocked slot with staff_id
        const newBlockedSlots = [...blockedSlots, { time: time, staff_id: currentStaffId }];
          
        setBlockedSlots(newBlockedSlots);
        
        // Note: todaySlots will be updated automatically via useEffect when blockedSlots changes
        
        // Refresh blocked slots and appointments after action
        await fetchBlockedSlots();
        await fetchAppointments();
        setTodaySlots(generateTodaySlots()); // Refresh today's slots view
        
      } else {
        alert(`Failed to ${action} time slot. Please try again.`);
      }
      
    } catch (error) {
      alert('Failed to update time slot. Please try again.');
    }
  };


  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "pending": return "#fbbf24";
      case "confirmed": return "#3b82f6";
      case "completed": return "#10b981";
      case "cancelled": return "#ef4444";
      case "rescheduled": return "#8b5cf6";
      default: return "#6b7280";
    }
  };

  // Helper function to normalize dates - extract YYYY-MM-DD from any date format
  const extractDateOnly = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      // Handle different date formats
      if (typeof dateValue === 'string') {
        // If it's already a simple date string (YYYY-MM-DD), return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        
        // If it contains 'T' (ISO timestamp), extract date part
        if (dateValue.includes('T')) {
          return dateValue.split('T')[0];
        }
        
        // Handle other date string formats
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0];
        }
      }
      
      // Handle Date objects
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      
      // Handle timestamp numbers
      if (typeof dateValue === 'number') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    } catch (error) {
      console.warn('Date extraction failed for:', dateValue, error);
    }
    
    return null;
  };

  // Helper function to format date for display (DD-MM-YYYY)
  const formatDateForDisplay = (dateValue) => {
    const dateString = extractDateOnly(dateValue);
    if (!dateString) return 'N/A';
    
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  // Get unique dates with bookings for date filter
  const getBookingDates = () => {
    const dates = new Set();
    appointments.forEach(apt => {
      if (apt.booking_date) {
        const normalizedDate = extractDateOnly(apt.booking_date);
        if (normalizedDate) {
          dates.add(normalizedDate);
        }
      }
    });
    return Array.from(dates).sort();
  };

  const bookingDates = getBookingDates();

  // Function to check if a date should be disabled in the date picker
  const shouldDisableDate = (date) => {
    if (!date) return true;
    const dateString = date.format("YYYY-MM-DD");
    const today = moment().format("YYYY-MM-DD");
    
    // Always allow today
    if (dateString === today) return false;
    
    // Only allow dates that have existing bookings
    return !bookingDates.includes(dateString);
  };

  // Get today's date string for highlighting
  const todayString = moment().format("YYYY-MM-DD");
  const isToday = (date) => {
    return date && date.format("YYYY-MM-DD") === todayString;
  };

  // Custom day renderer to show visual indicators
  const renderDay = (date, selectedDate, pickersDayProps) => {
    const dateString = date.format("YYYY-MM-DD");
    const hasBookings = bookingDates.includes(dateString);
    const isCurrentDay = isToday(date);
    
    return (
      <div
        {...pickersDayProps}
        style={{
          ...pickersDayProps.style,
          position: 'relative',
          backgroundColor: isCurrentDay ? '#007bff' : (hasBookings ? '#2a2a2a' : 'transparent'),
          color: isCurrentDay ? 'white' : (hasBookings ? '#90d14f' : '#666'),
          borderRadius: '50%',
          fontWeight: isCurrentDay ? 'bold' : (hasBookings ? '600' : 'normal'),
          border: hasBookings && !isCurrentDay ? '1px solid #90d14f' : 'none'
        }}
      >
        {date.format('D')}
        {hasBookings && (
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '4px',
              height: '4px',
              backgroundColor: isCurrentDay ? 'white' : '#90d14f',
              borderRadius: '50%'
            }}
          />
        )}
      </div>
    );
  };

  // Filter appointments based on selected date
  // Backend already filters out null payment methods
  const getFilteredAppointments = () => {
    if (!appointments || appointments.length === 0) {
      return [];
    }

    return appointments.filter(appointment => {
      if (!appointment || !appointment.booking_date) {
        return false;
      }

      // If no date is selected, show all appointments
      if (!selectedDate) {
        return true;
      }

      // Filter by selected date
      const appointmentDate = extractDateOnly(appointment.booking_date);
      const matches = appointmentDate === selectedDate;
      return matches;
    });
  };

  const filteredAppointments = getFilteredAppointments();

  // Group appointments by date for better organization
  const groupedAppointments = filteredAppointments.reduce((groups, appointment) => {
    const date = extractDateOnly(appointment.booking_date);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(appointment);
    return groups;
  }, {});

  // Sort dates and appointments within each date
  const sortedDates = Object.keys(groupedAppointments).sort().reverse(); // Show most recent dates first
  sortedDates.forEach(date => {
    groupedAppointments[date].sort((a, b) => {
      return moment(a.start_time, "HH:mm").diff(moment(b.start_time, "HH:mm"));
    });
  });

  // Debug logging for filteredAppointments
  

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return "";
    // If time includes seconds, remove them
    if (timeString.includes(":") && timeString.split(":").length === 3) {
      return timeString.substring(0, 5); // Get only HH:MM
    }
    return timeString;
  };

  if (loading) {
    return (
      <div className="staff-appointments-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading appointments...</p>
        </div>
      </div>
    );
  }

  // If there's an error, display it
  if (error) {
    return (
      <div className="staff-appointments-container">
        <div className="error-container">
          <div className="error-message">
            <i className="bi bi-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="retry-btn">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="staff-appointments-container">
      {/* Main Content - Split Layout */}
      <div className="staff-appointments-main">
        {/* Left Side - Appointments Table */}
        <div className="appointments-section">
          <div className="booking-details-header">
            <h2 className="booking-details-title">All Booking Details</h2>
          </div>
          <div className="appointments-table-container" onScroll={(e) => {
            const container = e.target;
            const hasOverflow = container.scrollHeight > container.clientHeight;
            if (hasOverflow) {
              container.classList.add('has-overflow');
            } else {
              container.classList.remove('has-overflow');
            }
          }}>
          <table className="appointments-table">
            {/* Single table header */}
            <thead>
              <tr>
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th>SERVICE</th>
                <th>TIME</th>
                <th>SERVICE STATUS</th>
              </tr>
            </thead>
            <tbody>
              {/* Date sections and appointments */}
              {filteredAppointments.length > 0 ? (
                sortedDates.map(date => (
                  <React.Fragment key={`date-section-${date}`}>
                    {/* Date header row */}
                    <tr className="date-header-row">
                      <td colSpan="5" className="date-header">
                        <div className="date-header-content">
                          <i className="bi bi-calendar-date"></i>
                          <span className="date-text">{formatDateForDisplay(date)}</span>
                          <span className="appointment-count">({groupedAppointments[date].length} appointment{groupedAppointments[date].length !== 1 ? 's' : ''})</span>
                        </div>
                      </td>
                    </tr>
                    {/* Appointment rows for this date */}
                    {groupedAppointments[date].map((appointment) => (
                      <tr key={appointment.id} className={`appointment-row ${appointment.id && typeof appointment.id === 'string' && appointment.id.includes('dummy') ? 'dummy-appointment' : ''}`}>
                        <td className="customer-name" style={{ paddingLeft: '18px' }}>{appointment.customer_name || 'N/A'}</td>
                        <td>{(() => {
                          // Comprehensive phone number fallback logic
                          const phoneFields = [
                            appointment.phone_number,
                            appointment.phone,
                            appointment.customer_phone,
                            appointment.phone_no,
                            appointment.contact_number,
                            appointment.user_phone,
                            appointment.customer?.phone,
                            appointment.customer?.phone_number,
                            appointment.user?.phone,
                            appointment.user?.phone_number
                          ];
                          const phoneNumber = phoneFields.find(phone => 
                            phone && 
                            phone !== '' && 
                            phone !== null && 
                            phone !== undefined &&
                            phone.toString().trim() !== ''
                          );
                          return phoneNumber ? phoneNumber.toString().trim() : 'N/A';
                        })()}</td>
                        <td className="service-text">{appointment.service_name || 'N/A'}</td>
                        <td className="time-display">{appointment.start_time && appointment.end_time ? `${formatTime(appointment.start_time)} – ${formatTime(appointment.end_time)}` : `${formatTime(appointment.start_time) || 'N/A'} – ${formatTime(appointment.end_time) || 'N/A'}`}</td>
                        <td className="service-status-column" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                          <div className="service-status-container" style={{ fontStyle: 'italic' }}>
                            {(() => {
                              // Normalize status to lowercase for consistent checking
                              const normalizedStatus = (appointment.status || '').toLowerCase();
                              
                              // Check for completed status (case-insensitive)
                              if (normalizedStatus === 'completed') {
                                return <span className="status-message completed" style={{ color: '#90d14f', fontStyle: 'italic', textTransform: 'none' }}>Service Completed</span>;
                              } 
                              // Check for absent status (case-insensitive)
                              else if (normalizedStatus === 'absent') {
                                return <span className="status-message absent" style={{ color: '#dc3545', fontStyle: 'italic', textTransform: 'none' }}>Not Attend</span>;
                              } 
                              // Check for cancelled status (case-insensitive)
                              else if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
                                return <span className="status-message cancelled" style={{ color: '#dc3545', fontStyle: 'italic', textTransform: 'none' }}>Booking Cancelled</span>;
                              }
                              // Check for other non-active statuses
                              else if (normalizedStatus === 'rescheduled') {
                                return <span className="status-message rescheduled" style={{ color: '#8b5cf6', fontStyle: 'normal', textTransform: 'none' }}>Rescheduled</span>;
                              }
                              // Only show action buttons for confirmed appointments or appointments with active statuses
                              else if (normalizedStatus === 'confirmed' || normalizedStatus === 'pending' || normalizedStatus === '' || !appointment.status) {
                                // Show buttons for active appointments
                                const daysDiff = moment(appointment.booking_date, moment.ISO_8601).diff(moment(), 'days');
                                
                                // 3+ days in future: Reschedule and Cancel
                                if (daysDiff >= 3) {
                                  return (
                                    <div className="action-buttons-wrapper">
                                      <button
                                        onClick={() => handleReschedule(appointment.id)}
                                        className="action-btn reschedule-btn"
                                      >
                                        Reschedule
                                      </button>
                                      <button
                                        onClick={() => handleCancel(appointment.id)}
                                        className="action-btn cancel-btn"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  );
                                }
                                // 2+ days in future till old appointment: Done and Cancel
                                else if (daysDiff >= 2 || daysDiff < 0) {
                                  return (
                                    <div className="action-buttons-wrapper">
                                      <button
                                        onClick={() => checkPaymentConfirmation(appointment.id)}
                                        disabled={processingIds.has(appointment.id)}
                                        className="action-btn done-btn"
                                      >
                                        Done
                                      </button>
                                      <button
                                        onClick={() => handleCancel(appointment.id)}
                                        className="action-btn cancel-btn"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  );
                                }
                                // Default case (0-1 days in future) - Show Done and Absent
                                else {
                                  return (
                                    <div className="action-buttons-wrapper">
                                      <button
                                        onClick={() => checkPaymentConfirmation(appointment.id)}
                                        disabled={processingIds.has(appointment.id)}
                                        className="action-btn done-btn"
                                      >
                                        Done
                                      </button>
                                      <button
                                        onClick={() => handleStatusChange(appointment.id, "absent")}
                                        disabled={processingIds.has(appointment.id)}
                                        className="action-btn absent-btn"
                                      >
                                        Absent
                                      </button>
                                    </div>
                                  );
                                }
                              }
                              // For any other status, show the status as text
                              else {
                                return (
                                  <span className="status-message generic" style={{ color: getStatusColor(appointment.status), fontStyle: 'normal', textTransform: 'none' }}>
                                    {appointment.status || 'Unknown Status'}
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                /* Empty state */
                <tr>
                  <td colSpan="5" className="no-appointments">
                    <i className="bi bi-calendar-x"></i>
                    {selectedDate ? 
                      'No appointments found for the selected date.' : 
                      'No appointments found for today.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                <i className="bi bi-chevron-left"></i>
              </button>
              
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          )}
        </div>

        {/* Right Side - Booking Slot Section */}
        <div className="booking-slot-section">
          {/* Enhanced Date Filter Controls */}
          <div className="slots-date-filter">
            <div className="date-filter-header">
              <h4 className="date-filter-title">
                <i className="bi bi-calendar3"></i>
                Select Date
              </h4>
            </div>
            <div className="date-filter-controls">
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="date-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  id="date-filter-input"
                />
                <span
                  className="calendar-icon"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 2
                  }}
                  onClick={() => {
                    const input = document.getElementById('date-filter-input');
                    if (input) input.showPicker ? input.showPicker() : input.focus();
                  }}
                  title="Select date"
                >
                  <i className="bi bi-calendar3" style={{ fontSize: '18px', color: '#888' }}></i>
                </span>
                <div className="date-display">
                  {selectedDate ? formatDateForDisplay(selectedDate) : moment().format('DD-MM-YYYY')}
                </div>
              </div>
              <div className="date-quick-actions">
                <button
                  type="button"
                  className={`quick-btn today-btn ${selectedDate === moment().format('YYYY-MM-DD') ? 'active' : ''}`}
                  onClick={() => setSelectedDate(moment().format('YYYY-MM-DD'))}
                >
                  <i className="bi bi-calendar-day"></i>
                  Today
                </button>
                <button
                  type="button"
                  className={`quick-btn tomorrow-btn ${selectedDate === moment().add(1, 'day').format('YYYY-MM-DD') ? 'active' : ''}`}
                  onClick={() => setSelectedDate(moment().add(1, 'day').format('YYYY-MM-DD'))}
                >
                  <i className="bi bi-calendar-plus"></i>
                  Tomorrow
                </button>
                <button
                  type="button"
                  className={`quick-btn clear-btn ${!selectedDate ? 'active' : ''}`}
                  onClick={() => setSelectedDate('')}
                >
                  <i className="bi bi-calendar-range"></i>
                  All Dates
                </button>
              </div>
            </div>
          </div>
          
          {/* Title and Legend Header */}
          <div className="booking-slots-header">
            <h3 className="staff-dashboard-timeslots-title">Booking Slots</h3>
            <div className="booking-slot-legend">
              <div className="legend-item">
                <div className="legend-square legend-blocked"></div>
                <span>Blocked</span>
              </div>
              <div className="legend-item">
                <div className="legend-square legend-booked"></div>
                <span>Booked</span>
              </div>
              <div className="legend-item">
                <div className="legend-square legend-available"></div>
                <span>Available</span>
              </div>
            </div>
          </div>
          
          <div className="booking-slots-container">
            <div className="staff-dashboard-timeslots-grid">
              {todaySlots.map((slot, index) => {
                const getButtonClass = () => {
                  if (slot.status === 'booked') return 'staff-dashboard-booked';
                  if (slot.status === 'blocked') return 'staff-dashboard-blocked';
                  return '';
                };
                
                return (
                  <button
                    key={index}
                    className={`staff-dashboard-timeslot-button ${getButtonClass()}`}
                    onClick={() => toggleTimeSlot(slot.time)}
                    disabled={slot.status === 'booked'}
                    style={{
                      cursor: slot.status === 'booked' ? 'not-allowed' : 'pointer',
                      opacity: slot.status === 'booked' ? 0.6 : 1
                    }}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          </div>
          <button 
            className="add-new-booking-btn"
            onClick={() => {
              // Set up selected slot for the currently selected date (or today if none selected)
              const targetDate = selectedDate ? moment(selectedDate) : moment();
              setSelectedSlot({
                day: {
                  date: targetDate.format('YYYY-MM-DD'),
                  display: targetDate.format('DD-MMM-YYYY')
                },
                time: '', // Will be selected in the modal
                date: targetDate.format('YYYY-MM-DD')
              });
              setShowAddBookingModal(true);
            }}
          >
            <span className="add-booking-text">Add New Booking</span>
            <div className="add-booking-icon">
              <span className="plus-icon">+</span>
            </div>
          </button>
        </div>
      </div>

      {/* Add Booking Modal */}
      <AddBookingModal
        isOpen={showAddBookingModal}
        onClose={handleCloseModal}
        selectedSlot={selectedSlot}
        onSubmit={handleSubmitBooking}
        currentUser={currentUser}
        timeSlots={generateTimeSlots()}
        bookings={appointments}
        blockedSlots={blockedSlots}
      />
      
      {/* Reschedule Booking Modal */}
      <RescheduleBookingModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setSelectedAppointment(null);
        }}
        selectedBooking={selectedAppointment}
        onSubmit={handleRescheduleSubmit}
      />
      
    </div>
    
    {/* Minimal Payment Confirmation Popup - Same as StaffDashboard */}
    {showPaymentConfirmation && (
      <div className="payment-popup-overlay" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div className="payment-popup-container-minimal" style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '20px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          zIndex: 10000
        }}>
          {/* Close button */}
          <button 
            className="payment-popup-close-minimal"
            onClick={() => {
              // Close popup without marking booking as done
              setShowPaymentConfirmation(false);
              setPaymentConfirmationData(null);
              // Note: Booking remains in its original state (not marked as done)
            }}
            aria-label="Close popup without completing booking"
            title="Close without completing booking"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            <i className="bi bi-x"></i>
          </button>
          
          {/* Header */}
          <div className="payment-popup-header-minimal" style={{
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <i className="bi bi-credit-card payment-popup-icon-minimal" style={{
              fontSize: '32px',
              color: '#3b82f6',
              marginBottom: '10px'
            }}></i>
            <h3 className="payment-popup-title-minimal" style={{
              margin: '0',
              color: '#1a1a1a',
              fontSize: '18px'
            }}>Payment Confirmation</h3>
          </div>
          
          {/* Content */}
          <div className="payment-popup-content-minimal" style={{
            marginBottom: '20px'
          }}>
            <div className="payment-popup-info-minimal" style={{
              textAlign: 'center'
            }}>
              <p className="payment-popup-customer-minimal" style={{
                fontSize: '16px',
                margin: '0 0 5px 0'
              }}>
                <strong>{paymentConfirmationData?.customerName || "Walk-in Customer"}</strong>
              </p>
              <p className="payment-popup-service-minimal" style={{
                fontSize: '14px',
                color: '#666',
                margin: '0 0 15px 0'
              }}>
                {paymentConfirmationData?.serviceName || "Service"}
              </p>
              <p className="payment-popup-question-minimal" style={{
                fontSize: '16px',
                fontWeight: 'bold',
                margin: '15px 0 0 0'
              }}>
                Has the customer paid?
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="payment-popup-actions-minimal" style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <button 
              className="payment-popup-btn-minimal payment-popup-paid-btn-minimal"
              onClick={handlePaymentPaid}
              style={{
                flex: '1',
                padding: '12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <i className="bi bi-check-lg"></i> Yes, Paid
            </button>
            
            <button 
              className="payment-popup-btn-minimal payment-popup-pending-btn-minimal"
              onClick={handlePaymentUnpaid}
              style={{
                flex: '1',
                padding: '12px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <i className="bi bi-clock"></i> Not Yet
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default StaffAppointments;
