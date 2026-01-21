/**
 * Time Slot Duration and Service Filtering Utilities
 * 
 * This module provides functions to:
 * 1. Calculate available time slot duration
 * 2. Filter services based on available slot duration
 * 3. Handle time slot booking logic consistently across the application
 */

import moment from 'moment';

/**
 * Standard time slots for the application (30-minute intervals, 10:00 AM to 9:30 PM)
 */
export const TIME_SLOTS = [
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
];

/**
 * Calculate available duration for a time slot in minutes
 * @param {string} selectedTime - The selected time slot (e.g., "14:30")
 * @param {Array} timeSlots - Array of all available time slots
 * @param {Array} bookings - Array of existing bookings
 * @param {Array} blockedSlots - Array of blocked time slots
 * @param {string} selectedDate - The selected date in YYYY-MM-DD format
 * @returns {number} Available duration in minutes
 */
export const calculateAvailableSlotDuration = (
  selectedTime, 
  timeSlots = TIME_SLOTS, 
  bookings = [], 
  blockedSlots = [], 
  selectedDate = moment().format('YYYY-MM-DD')
) => {
  if (!selectedTime || !timeSlots.includes(selectedTime)) {
    return 0;
  }

  const currentIndex = timeSlots.indexOf(selectedTime);
  const today = moment().format('YYYY-MM-DD');
  const isToday = selectedDate === today;
  
  // For today's bookings, check if the selected time has already passed
  if (isToday) {
    const selectedMoment = moment(selectedTime, "HH:mm");
    const currentMoment = moment();
    
    if (selectedMoment.isBefore(currentMoment)) {
      // The selected time slot has already passed
      return 0;
    }
  }
  
  let availableDuration = 30; // Start with the current slot (30 minutes)
  
  // For today's bookings, calculate remaining time in the current slot
  if (isToday) {
    const selectedMoment = moment(selectedTime, "HH:mm");
    const currentMoment = moment();
    const slotEndMoment = moment(selectedTime, "HH:mm").add(30, 'minutes');
    
    if (currentMoment.isAfter(selectedMoment)) {
      // We're already partway through this slot
      const remainingInCurrentSlot = slotEndMoment.diff(currentMoment, 'minutes');
      if (remainingInCurrentSlot <= 0) {
        return 0; // No time left in this slot
      }
      availableDuration = remainingInCurrentSlot;
    }
  }
  
  // Check consecutive slots after the selected time
  for (let i = currentIndex + 1; i < timeSlots.length; i++) {
    const nextSlot = timeSlots[i];
    
    // Check if next slot is booked
    const isNextSlotBooked = bookings.some(booking => {
      // Skip invalid bookings
      if (!booking || 
          booking.status === "cancelled" || 
          booking.status === "Cancelled" ||
          booking.status === "completed" ||
          booking.status === "Completed" ||
          booking.status === "-") {
        return false;
      }

      // Check if booking is on the selected date
      const bookingDate = moment(booking.booking_date || booking.date).format('YYYY-MM-DD');
      if (bookingDate !== selectedDate) {
        return false;
      }

      // Check if the next slot falls within this booking's duration
      const bookingStartTime = moment(booking.start_time, "HH:mm");
      const bookingEndTime = moment(booking.end_time, "HH:mm");
      const nextSlotTime = moment(nextSlot, "HH:mm");
      
      if (!bookingStartTime.isValid() || !bookingEndTime.isValid() || !nextSlotTime.isValid()) {
        return false;
      }

      // Check if next slot time falls within the booking period
      return nextSlotTime.isSameOrAfter(bookingStartTime) && 
             nextSlotTime.isBefore(bookingEndTime);
    });

    // Check if next slot is blocked
    const isNextSlotBlocked = blockedSlots.some(blockedSlot => {
      // Handle different blocked slot formats
      if (typeof blockedSlot === 'string') {
        return blockedSlot === nextSlot;
      }
      if (blockedSlot.time && blockedSlot.date) {
        const blockedDate = moment(blockedSlot.date).format('YYYY-MM-DD');
        return blockedSlot.time === nextSlot && blockedDate === selectedDate;
      }
      if (blockedSlot.time && blockedSlot.day) {
        // Handle day format like "Mon 6"
        const today = moment(selectedDate);
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const expectedDay = `${dayNames[today.day()]} ${today.date()}`;
        return blockedSlot.time === nextSlot && blockedSlot.day === expectedDay;
      }
      return false;
    });

    if (isNextSlotBooked || isNextSlotBlocked) {
      break; // Stop if next slot is not available
    }
    
    availableDuration += 30; // Add 30 minutes for each additional available slot
  }
  
  return Math.max(0, availableDuration); // Ensure we never return negative duration
};

/**
 * Filter services based on available time slot duration
 * @param {Array} services - Array of all available services
 * @param {number} availableDuration - Available duration in minutes
 * @returns {Array} Filtered services that fit within the available duration
 */
export const filterServicesByDuration = (services = [], availableDuration) => {
  if (!availableDuration || availableDuration < 30) {
    return []; // No services available if less than 30 minutes
  }

  return services.filter(service => {
    const serviceDuration = parseInt(service.duration) || 30;
    return serviceDuration <= availableDuration;
  });
};

/**
 * Get available services for a specific time slot
 * @param {string} selectedTime - The selected time slot
 * @param {string} selectedDate - The selected date
 * @param {Array} allServices - Array of all available services
 * @param {Array} bookings - Array of existing bookings
 * @param {Array} blockedSlots - Array of blocked slots
 * @param {Array} timeSlots - Array of time slots (optional, defaults to TIME_SLOTS)
 * @returns {Array} Available services for the time slot
 */
export const getAvailableServicesForSlot = (
  selectedTime,
  selectedDate,
  allServices = [],
  bookings = [],
  blockedSlots = [],
  timeSlots = TIME_SLOTS
) => {
  // Calculate available duration for the selected time slot
  const availableDuration = calculateAvailableSlotDuration(
    selectedTime,
    timeSlots,
    bookings,
    blockedSlots,
    selectedDate
  );

  // Calculate how many 30-minute slots are available
  const availableSlots = Math.floor(availableDuration / 30);
  
  if (availableSlots === 0) {
    console.log(`No available slots for ${selectedTime} on ${selectedDate}`);
    return []; // No slots available
  }
  
  // Log available slots for debugging
  console.log(`Found ${availableSlots} consecutive available slots from ${selectedTime} on ${selectedDate} (${availableDuration} minutes total)`);
  
  // Get the available time slots for display
  const startIndex = timeSlots.indexOf(selectedTime);
  const availableTimeSlots = [];
  
  if (startIndex !== -1) {
    // Find consecutive available slots
    for (let i = 0; i < availableSlots && (startIndex + i) < timeSlots.length; i++) {
      availableTimeSlots.push(timeSlots[startIndex + i]);
    }
    
    if (availableTimeSlots.length > 0) {
      console.log(`Available time slots: ${availableTimeSlots.join(', ')}`);
    }
  }
  
  // Filter services based on how many slots they require
  const filteredServices = allServices.filter(service => {
    // Calculate how many slots this service needs
    const serviceDuration = parseInt(service.duration) || 30;
    const serviceSlots = Math.ceil(serviceDuration / 30);
    
    // Service must fit within available slots
    const fits = serviceSlots <= availableSlots;
    
    if (fits) {
      console.log(`Service "${service.name}" (${serviceDuration} min) fits in ${availableSlots} slots`);
    }
    
    return fits;
  });
  
  console.log(`Filtered ${filteredServices.length} services that fit within ${availableSlots} slots (${availableDuration} minutes)`);
  
  return filteredServices;
};

/**
 * Check if a service can fit in the available time slot
 * @param {Object} service - Service object with duration property
 * @param {number} availableDuration - Available duration in minutes
 * @returns {boolean} True if service fits, false otherwise
 */
export const canServiceFitInSlot = (service, availableDuration) => {
  if (!service || !service.duration) return false;
  
  const serviceDuration = parseInt(service.duration) || 30;
  return serviceDuration <= availableDuration;
};

/**
 * Format duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }
};

export default {
  TIME_SLOTS,
  calculateAvailableSlotDuration,
  filterServicesByDuration,
  getAvailableServicesForSlot,
  canServiceFitInSlot,
  formatDuration
};
