import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import moment from 'moment-timezone';
import { API_BASE_URL } from '../utils/constants';
import { getAvailableServicesForSlot, calculateAvailableSlotDuration, formatDuration } from '../utils/timeSlotUtils';
import { fetchBookingsByPhone } from '../utils/api';
import './AddBookingModal.css';

// Malaysia timezone constant
const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

// Debug mode flag - set to false in production
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Lightweight logging utility
const debugLog = (category, message, data = null) => {
  if (DEBUG_MODE) {
    console.log(`🔧 [${category}] ${message}`, data || '');
  }
};

const AddBookingModal = ({ 
  isOpen, 
  onClose, 
  selectedSlot, 
  onSubmit, 
  currentUser,
  timeSlots = [],
  bookings = [],
  blockedSlots = [],
  disableDynamicTimeLogic = false
}) => {
  const modalRef = useRef();
  const [formData, setFormData] = useState({
    service: '',
    customerName: '',
    phoneNumber: '',
    selectedTime: ''
  });
  const [allServices, setAllServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [isWalkInOverride, setIsWalkInOverride] = useState(false);
  const [walkInMessage, setWalkInMessage] = useState('');
  const [showOverrideConfirmation, setShowOverrideConfirmation] = useState(false);
  const [overrideConfirmationData, setOverrideConfirmationData] = useState(null);
  
  // Booking history state
  const [bookingHistory, setBookingHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Service caching
  const servicesCache = useRef(new Map());
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
  
  // Phone lookup debouncing
  const phoneDebounceRef = useRef(null);

  // Optimized slot checking with memoization
  const slotCheckCache = useRef(new Map());
  
  const isSlotTaken = useCallback((time, date) => {
    const cacheKey = `${time}_${date}`;
    if (slotCheckCache.current.has(cacheKey)) {
      return slotCheckCache.current.get(cacheKey);
    }

    // Check bookings
    const isBooked = bookings.some(booking => {
      if (!booking || booking.status === 'cancelled' || booking.status === 'Cancelled') {
        return false;
      }
      
      const bookingDateRaw = booking.booking_date || booking.date;
      if (!bookingDateRaw) return false;
      
      const bookingDate = extractDateOnly(bookingDateRaw);
      const bookingTime = booking.start_time || booking.time;
      if (!bookingTime) return false;
      
      if (bookingDate !== date) return false;
      
      const bookingStart = moment(bookingTime, 'HH:mm');
      if (!bookingStart.isValid()) return false;
      
      const slotTime = moment(time, 'HH:mm');
      
      // Calculate end time based on duration or end_time
      if (!booking.end_time && booking.duration) {
        const calculatedEnd = bookingStart.clone().add(booking.duration, 'minutes');
        return slotTime.isBetween(bookingStart, calculatedEnd, null, '[)');
      }
      
      if (booking.end_time) {
        const bookingEnd = moment(booking.end_time, 'HH:mm');
        return slotTime.isBetween(bookingStart, bookingEnd, null, '[)');
      }
      
      // Fallback: 30-minute slot
      const calculatedEnd = bookingStart.clone().add(30, 'minutes');
      return slotTime.isBetween(bookingStart, calculatedEnd, null, '[)');
    });
    
    // Check blocked slots
    const isBlocked = blockedSlots.some(slot => slot.time === time);
    
    const result = isBooked || isBlocked;
    slotCheckCache.current.set(cacheKey, result);
    
    debugLog('SLOT_CHECK', `${time} on ${date}: ${result ? 'taken' : 'available'}`);
    return result;
  }, [bookings, blockedSlots]);

  // Clear slot cache when dependencies change
  useEffect(() => {
    slotCheckCache.current.clear();
  }, [bookings, blockedSlots]);

  // Extract date from booking date (helper function)
  const extractDateOnly = (dateValue) => {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    
    return moment(dateValue).format('YYYY-MM-DD');
  };

  // Optimized consecutive slot calculation
  const getConsecutiveAvailableSlots = useCallback((startTime, date) => {
    const startIndex = timeSlots.indexOf(startTime);
    if (startIndex === -1) return 0;
    
    let consecutiveCount = 0;
    const currentTime = moment();
    const today = moment().format('YYYY-MM-DD');
    
    for (let i = startIndex; i < timeSlots.length; i++) {
      const slotTime = timeSlots[i];
      
      // For first slot on today's date, check remaining time
      if (i === startIndex && date === today) {
        const slotMoment = moment(slotTime, 'HH:mm');
        const timeDiffMinutes = currentTime.diff(slotMoment, 'minutes');
        
        if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
          const remainingDuration = getRemainingSlotDuration(slotTime, currentTime, date);
          if (remainingDuration < 15) {
            break; // Not enough time remaining in first slot
          }
        }
      }
      
      if (!isSlotTaken(slotTime, date)) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    return consecutiveCount;
  }, [timeSlots, isSlotTaken]);

  // Get remaining duration in a time slot
  const getRemainingSlotDuration = (slotTime, currentTime, date) => {
    const slotIndex = timeSlots.indexOf(slotTime);
    if (slotIndex === -1) return 0;
    
    const nextSlotTime = timeSlots[slotIndex + 1];
    if (!nextSlotTime) return 30;
    
    const slotStart = moment(slotTime, 'HH:mm');
    const slotEnd = moment(nextSlotTime, 'HH:mm');
    const totalSlotDuration = slotEnd.diff(slotStart, 'minutes');
    const elapsedTime = currentTime.diff(slotStart, 'minutes');
    
    return Math.max(0, totalSlotDuration - elapsedTime);
  };

  // Get maximum service duration for a time slot
  const getMaxServiceDuration = useCallback((selectedTime, selectedDate) => {
    const consecutiveSlots = getConsecutiveAvailableSlots(selectedTime, selectedDate);
    if (consecutiveSlots === 0) return 0;
    
    const today = moment().format('YYYY-MM-DD');
    const currentTime = moment();
    
    // For today's bookings, adjust for partially elapsed first slot
    if (selectedDate === today) {
      const slotMoment = moment(selectedTime, 'HH:mm');
      const timeDiffMinutes = currentTime.diff(slotMoment, 'minutes');
      
      if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
        const remainingDuration = getRemainingSlotDuration(selectedTime, currentTime, selectedDate);
        const additionalSlotTime = Math.max(0, (consecutiveSlots - 1) * 30);
        return remainingDuration + additionalSlotTime;
      }
    }
    
    return consecutiveSlots * 30;
  }, [getConsecutiveAvailableSlots]);

  // Optimized service fetching
  const fetchServicesForSlot = useCallback(async (maxDuration = null) => {
    const cacheKey = `services_${maxDuration || 'all'}`;
    
    // Check cache first
    const cachedData = servicesCache.current.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      debugLog('SERVICES', 'Using cached data');
      setAllServices(cachedData.data);
      return;
    }
    
    if (loadingServices) return;
    
    setLoadingServices(true);
    try {
      const staffUser = JSON.parse(localStorage.getItem('staff_loggedInUser') || '{}');
      const token = staffUser.token || localStorage.getItem('token');

      if (!token) {
        debugLog('SERVICES', 'No authentication token found');
        setAllServices([]);
        return;
      }

      const params = new URLSearchParams();
      if (maxDuration && maxDuration > 0) {
        params.append('maxDuration', maxDuration.toString());
      }
      
      const apiUrl = `${API_BASE_URL}/users/services${params.toString() ? `?${params.toString()}` : ''}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const servicesArray = Array.isArray(data) ? data : [];
        
        servicesCache.current.set(cacheKey, {
          data: servicesArray,
          timestamp: Date.now()
        });
        
        setAllServices(servicesArray);
        debugLog('SERVICES', `Fetched ${servicesArray.length} services`);
      } else {
        debugLog('SERVICES', `API error: ${response.status}`);
        setAllServices([]);
      }
    } catch (error) {
      debugLog('SERVICES', `Fetch error: ${error.message}`);
      setAllServices([]);
    } finally {
      setLoadingServices(false);
    }
  }, [loadingServices]);

  // Smart time selection
  const getSmartTimeSelection = () => {
    if (!selectedSlot?.time || !timeSlots.length) return '';
    
    const currentMalaysiaTime = moment.tz(MALAYSIA_TZ);
    const selectedDate = selectedSlot.day?.date || selectedSlot.date;
    const today = currentMalaysiaTime.format('YYYY-MM-DD');

    if (disableDynamicTimeLogic || selectedDate !== today) {
      return selectedSlot.time || '';
    }

    // For today - find next available slot after current time + 30 minutes
    const next30Min = currentMalaysiaTime.clone().add(30, 'minutes');
    const nextSlotTime = next30Min.minute(next30Min.minute() < 30 ? 30 : 0).second(0);
    if (next30Min.minute() >= 30) nextSlotTime.add(1, 'hour');
    
    const nextTimeString = nextSlotTime.format('HH:mm');
    
    for (const slot of timeSlots) {
      if (slot >= nextTimeString && !isSlotTaken(slot, selectedDate)) {
        return slot;
      }
    }
    
    return selectedSlot.time || timeSlots[0] || '';
  };

  // Check for walk-in override requirements
  const requiresOverrideConfirmation = () => {
    if (!formData.selectedTime) return false;
    
    const currentTime = moment();
    const today = moment().format('YYYY-MM-DD');
    const selectedDate = selectedSlot.day?.date || selectedSlot.date;
    
    if (selectedDate !== today) return false;
    
    const slotMoment = moment(formData.selectedTime, 'HH:mm');
    const timeDiffMinutes = currentTime.diff(slotMoment, 'minutes');
    
    return timeDiffMinutes > 0 && timeDiffMinutes <= 15;
  };

  // Phone number lookup with debouncing
  const lookupPhoneNumber = useCallback(async (phoneNumber) => {
    if (!phoneNumber || phoneNumber.length < 8) {
      setBookingHistory([]);
      setShowHistory(false);
      return;
    }

    if (phoneDebounceRef.current) {
      clearTimeout(phoneDebounceRef.current);
    }

    phoneDebounceRef.current = setTimeout(async () => {
      try {
        setLoadingHistory(true);
        const history = await fetchBookingsByPhone(phoneNumber);
        
        if (history && history.length > 0) {
          setBookingHistory(history);
          setShowHistory(true);
          
          // Auto-fill customer name if available
          const lastBooking = history[0];
          if (lastBooking.customer_name && !formData.customerName) {
            setFormData(prev => ({
              ...prev,
              customerName: lastBooking.customer_name
            }));
          }
          
          debugLog('PHONE_LOOKUP', `Found ${history.length} previous bookings`);
        } else {
          setBookingHistory([]);
          setShowHistory(false);
          debugLog('PHONE_LOOKUP', 'No previous bookings found');
        }
      } catch (error) {
        debugLog('PHONE_LOOKUP', `Error: ${error.message}`);
        setBookingHistory([]);
        setShowHistory(false);
      } finally {
        setLoadingHistory(false);
      }
    }, 500);
  }, [formData.customerName]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && selectedSlot) {
      const smartTime = getSmartTimeSelection();
      setFormData(prev => ({
        ...prev,
        selectedTime: smartTime
      }));
      
      // Fetch services for the selected slot
      const selectedDate = selectedSlot.day?.date || selectedSlot.date;
      const maxDuration = getMaxServiceDuration(smartTime, selectedDate);
      fetchServicesForSlot(maxDuration);
      
      debugLog('MODAL_INIT', `Initialized with time: ${smartTime}, max duration: ${maxDuration}min`);
    }
  }, [isOpen, selectedSlot, getMaxServiceDuration, fetchServicesForSlot]);

  // Handle phone number changes
  useEffect(() => {
    if (formData.phoneNumber) {
      lookupPhoneNumber(formData.phoneNumber);
    }
  }, [formData.phoneNumber, lookupPhoneNumber]);

  // Update services when time selection changes
  useEffect(() => {
    if (formData.selectedTime && selectedSlot) {
      const selectedDate = selectedSlot.day?.date || selectedSlot.date;
      const maxDuration = getMaxServiceDuration(formData.selectedTime, selectedDate);
      fetchServicesForSlot(maxDuration);
      
      debugLog('TIME_CHANGE', `Time changed to ${formData.selectedTime}, max duration: ${maxDuration}min`);
    }
  }, [formData.selectedTime, selectedSlot, getMaxServiceDuration, fetchServicesForSlot]);

  // Calculate available services with optimized filtering
  const availableServices = useMemo(() => {
    if (!allServices || allServices.length === 0) {
      return [];
    }
    
    if (!formData.selectedTime || !selectedSlot?.day?.date) {
      return allServices;
    }
    
    const selectedDate = selectedSlot.day.date || selectedSlot.date;
    const maxDuration = getMaxServiceDuration(formData.selectedTime, selectedDate);
    
    debugLog('SERVICES_FILTER', `Filtering ${allServices.length} services, max duration: ${maxDuration}min`);
    
    if (maxDuration === 0) {
      return [];
    }
    
    const filteredServices = allServices.filter(service => {
      if (service.duration > maxDuration) {
        return false;
      }
      
      // For real-time bookings on today's date
      const today = moment().format('YYYY-MM-DD');
      if (selectedDate === today) {
        const currentTime = moment();
        const slotMoment = moment(formData.selectedTime, 'HH:mm');
        const timeDiffMinutes = currentTime.diff(slotMoment, 'minutes');
        
        if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
          const remainingDuration = getRemainingSlotDuration(formData.selectedTime, currentTime, selectedDate);
          const consecutiveSlots = getConsecutiveAvailableSlots(formData.selectedTime, selectedDate);
          const additionalSlotTime = Math.max(0, (consecutiveSlots - 1) * 30);
          const totalAvailableTime = remainingDuration + additionalSlotTime;
          
          return service.duration <= totalAvailableTime;
        }
      }
      
      return true;
    });
    
    debugLog('SERVICES_FILTER', `Filtered to ${filteredServices.length} services`);
    return filteredServices;
  }, [allServices, formData.selectedTime, selectedSlot, getMaxServiceDuration, getConsecutiveAvailableSlots]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Handle override confirmation
  const handleOverrideConfirm = () => {
    setShowOverrideConfirmation(false);
    if (onSubmit && overrideConfirmationData) {
      onSubmit(overrideConfirmationData);
    }
    setOverrideConfirmationData(null);
  };

  const handleOverrideCancel = () => {
    setShowOverrideConfirmation(false);
    setOverrideConfirmationData(null);
  };

  // Optimized form submission with minimal logging
  const handleSubmit = (e) => {
    e.preventDefault();
    
    debugLog('SUBMIT', 'Starting form submission');
    
    // Validation
    const errors = [];
    
    if (!formData.service || formData.service === '' || formData.service === '0') {
      errors.push('Please select a valid service');
    } else {
      const serviceId = parseInt(formData.service);
      const serviceExists = availableServices.some(service => service.id === serviceId);
      if (!serviceExists && availableServices.length > 0) {
        errors.push('Selected service is not available for this time slot');
      }
    }
    
    if (!formData.customerName?.trim()) {
      errors.push('Customer name is required');
    }
    
    if (!formData.selectedTime) {
      errors.push('Time is required');
    }
    
    if (errors.length > 0) {
      alert('Please fill in all required fields:\n' + errors.join('\n'));
      return;
    }
    
    if (!onSubmit) {
      alert('Submission handler not available. Please try again.');
      return;
    }
    
    // Prepare submission data
    const selectedDate = selectedSlot.day?.date || selectedSlot.date;
    const bookingDate = selectedDate || moment.tz(MALAYSIA_TZ).format('YYYY-MM-DD');
    
    const submissionData = {
      service_id: parseInt(formData.service),
      customer_name: formData.customerName.trim(),
      phone_number: formData.phoneNumber?.trim() || '',
      time: formData.selectedTime,
      date: bookingDate,
      outlet_id: currentUser?.outlet_id || 1,
      staff_id: currentUser?.id || currentUser?.user_id || 1
    };
    
    debugLog('SUBMIT', 'Prepared submission data', submissionData);
    
    // Check for override confirmation
    if (requiresOverrideConfirmation()) {
      setOverrideConfirmationData(submissionData);
      setShowOverrideConfirmation(true);
      debugLog('SUBMIT', 'Requires override confirmation');
      return;
    }
    
    // Submit
    try {
      onSubmit(submissionData);
      debugLog('SUBMIT', 'Form submitted successfully');
    } catch (error) {
      debugLog('SUBMIT', `Submission error: ${error.message}`);
      alert('Error during booking submission. Please try again.');
    }
  };

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
      selectedSlot.day.date
    );
  }, [selectedSlot, bookings, blockedSlots, timeSlots]);

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
            {/* Info Display Fields */}
            <div className="info-display-container">
              <div className="form-group info-display">
                <label>Outlet</label>
                <div className="form-value-display">SCM</div>
              </div>
              
              <div className="form-group info-display">
                <label>Barber</label>
                <div className="form-value-display">
                  {currentUser?.username || currentUser?.name || 'Staff'}
                </div>
              </div>
              
              <div className="form-group info-display">
                <label>Date</label>
                <div className="form-value-display">
                  {moment(selectedSlot.day?.date || selectedSlot.date).format('DD/MM/YYYY')}
                </div>
              </div>
              
              <div className="form-group info-display">
                <label>Available Duration</label>
                <div className="form-value-display">
                  {formatDuration(availableDuration)}
                </div>
              </div>
            </div>

            {/* Service Selection */}
            <div className="form-group">
              <label htmlFor="service">Service *</label>
              <select
                id="service"
                name="service"
                value={formData.service}
                onChange={handleInputChange}
                disabled={loadingServices}
                required
              >
                <option value="">
                  {loadingServices ? 'Loading services...' : 'Select a service'}
                </option>
                {availableServices.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration}min) - RM{service.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Selection */}
            <div className="form-group">
              <label htmlFor="selectedTime">Time *</label>
              <select
                id="selectedTime"
                name="selectedTime"
                value={formData.selectedTime}
                onChange={handleInputChange}
                required
              >
                <option value="">Select time</option>
                {timeSlots.map(time => {
                  const selectedDate = selectedSlot.day?.date || selectedSlot.date;
                  const isDisabled = isSlotTaken(time, selectedDate);
                  return (
                    <option key={time} value={time} disabled={isDisabled}>
                      {time} {isDisabled ? '(Taken)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Customer Information */}
            <div className="form-group">
              <label htmlFor="customerName">Customer Name *</label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                placeholder="Enter customer name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Enter phone number (optional)"
              />
              {loadingHistory && <div className="loading-indicator">Looking up customer history...</div>}
            </div>

            {/* Booking History Display */}
            {showHistory && bookingHistory.length > 0 && (
              <div className="booking-history">
                <h4>Previous Bookings ({bookingHistory.length})</h4>
                <div className="history-list">
                  {bookingHistory.slice(0, 3).map((booking, index) => (
                    <div key={index} className="history-item">
                      <span>{moment(booking.booking_date).format('DD/MM/YY')}</span>
                      <span>{booking.service_name || 'Service'}</span>
                      <span>{booking.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Walk-in Override Message */}
            {isWalkInOverride && walkInMessage && (
              <div className="walk-in-override-message">
                ℹ️ {walkInMessage}
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button type="button" onClick={onClose} className="cancel-btn">
                Cancel
              </button>
              <button type="submit" className="submit-btn">
                Add Booking
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Override Confirmation Modal */}
      {showOverrideConfirmation && (
        <div className="override-confirmation-modal">
          <div className="override-confirmation-content">
            <h3>Confirm Walk-in Override</h3>
            <p>
              This booking requires an override because the selected time slot has already started. 
              Are you sure you want to proceed?
            </p>
            <div className="override-confirmation-actions">
              <button onClick={handleOverrideCancel} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleOverrideConfirm} className="confirm-btn">
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddBookingModal;
