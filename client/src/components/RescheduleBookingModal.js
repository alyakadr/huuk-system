import React, { useState, useRef, useEffect } from 'react';
import './AddBookingModal.css';
import api from '../utils/api';
import moment from 'moment';

const RescheduleBookingModal = ({ 
  isOpen, 
  onClose, 
  selectedBooking,
  onSubmit
}) => {
  const modalRef = useRef();
  const [formData, setFormData] = useState({
    newDate: '',
    newTime: ''
  });
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    totalBookings: 0,
    blockedSlots: 0,
    unavailableSlots: [],
    availableSlots: []
  });

  // Generate all possible time slots from 09:00 to 21:30
  const generateAllTimeSlots = () => {
    const slots = [];
    const startTime = moment().hour(9).minute(0);
    const endTime = moment().hour(21).minute(30);
    
    while (startTime.isSameOrBefore(endTime)) {
      slots.push(startTime.format('HH:mm'));
      startTime.add(30, 'minutes');
    }
    
    return slots;
  };

  // Fetch available time slots for the selected date
  const fetchAvailableTimeSlots = async (date) => {
    if (!date) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get staff token or regular token
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      
      // Get current user data
      const userJson = localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
      if (!userJson) {
        setError("User data not found");
        setLoading(false);
        return;
      }
      
      const userData = JSON.parse(userJson);
      const staffId = userData.id;
      
      console.log(`Fetching bookings for date: ${date}, staff ID: ${staffId}`);
      
      // Fetch bookings for the selected date
      const bookingsResponse = await api.get("/bookings/staff/appointments", {
        params: {
          date: date,
          staff_id: staffId
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch blocked slots for the selected date
      const blockedSlotsResponse = await api.get('/staff/blocked-slots', {
        params: {
          staff_id: staffId,
          date: date
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Extract bookings and blocked slots
      const bookings = bookingsResponse.data.appointments || [];
      const blockedSlots = blockedSlotsResponse.data.blocked_slots || [];
      
      console.log(`Found ${bookings.length} bookings and ${blockedSlots.length} blocked slots for ${date}`);
      
      if (bookings.length > 0) {
        console.log('First booking:', bookings[0]);
      }
      
      if (blockedSlots.length > 0) {
        console.log('First blocked slot:', blockedSlots[0]);
      }
      
      // Generate all time slots
      const allTimeSlots = generateAllTimeSlots();
      
      // Filter out booked and blocked slots
      const unavailableTimes = new Set();
      
      // Mark booked slots as unavailable
      bookings.forEach(booking => {
        // Skip cancelled bookings or the booking being rescheduled
        if (booking.status?.toLowerCase() === 'cancelled' || booking.id === selectedBooking.id) {
          console.log(`Skipping booking ID ${booking.id} - ${booking.status === 'cancelled' ? 'cancelled' : 'current booking'}`);
          return;
        }
        
        const startTime = moment(booking.start_time, 'HH:mm');
        const endTime = moment(booking.end_time || booking.start_time, 'HH:mm');
        
        console.log(`Processing booking: ${booking.customer_name}, start: ${booking.start_time}, end: ${booking.end_time}`);
        
        // If valid times
        if (startTime.isValid() && endTime.isValid()) {
          // Calculate duration in 30-minute slots
          const durationSlots = Math.ceil(endTime.diff(startTime, 'minutes') / 30);
          
          console.log(`Booking duration: ${durationSlots} slots (${endTime.diff(startTime, 'minutes')} minutes)`);
          
          // Mark all slots within the booking as unavailable
          for (let i = 0; i < durationSlots; i++) {
            const slotTime = startTime.clone().add(i * 30, 'minutes').format('HH:mm');
            unavailableTimes.add(slotTime);
            console.log(`Marking slot ${slotTime} as unavailable`);
          }
        } else {
          console.log(`Invalid booking times: start=${booking.start_time}, end=${booking.end_time}`);
        }
      });
      
      // Mark blocked slots as unavailable
      blockedSlots.forEach(slot => {
        unavailableTimes.add(slot.time);
        console.log(`Marking blocked slot ${slot.time} as unavailable`);
      });
      
      // Filter available time slots
      const available = allTimeSlots.filter(time => !unavailableTimes.has(time));
      
      console.log(`Total time slots: ${allTimeSlots.length}, Unavailable: ${unavailableTimes.size}, Available: ${available.length}`);
      console.log('Available slots:', available);
      
      setAvailableTimeSlots(available);
      setDebugInfo({
        totalBookings: bookings.length,
        blockedSlots: blockedSlots.length,
        unavailableSlots: Array.from(unavailableTimes),
        availableSlots: available
      });
    } catch (error) {
      console.error("Error fetching available time slots:", error);
      console.error("Error response:", error.response?.data);
      setError("Failed to load available time slots");
      setAvailableTimeSlots(generateAllTimeSlots()); // Fallback to all slots
    } finally {
      setLoading(false);
    }
  };

  // When the date changes, fetch available time slots
  useEffect(() => {
    if (formData.newDate) {
      fetchAvailableTimeSlots(formData.newDate);
    }
  }, [formData.newDate]);

  // Initialize form data when selected booking changes
  useEffect(() => {
    if (selectedBooking) {
      const initialDate = selectedBooking.booking_date || moment().format('YYYY-MM-DD');
      setFormData({
        newDate: initialDate,
        newTime: selectedBooking.start_time || ''
      });
      
      console.log('Selected booking:', selectedBooking);
      console.log('Setting initial date:', initialDate);
      
      // Fetch available slots for the initial date
      fetchAvailableTimeSlots(initialDate);
    }
  }, [selectedBooking]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };  

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({
        ...selectedBooking,
        newDate: formData.newDate,
        newTime: formData.newTime
      });
    }
  };

  if (!isOpen || !selectedBooking) return null;

  return (
    <div 
      className="booking-details-modal" 
      role="dialog" 
      aria-labelledby="modal-title" 
      aria-modal="true"
      tabIndex="-1"
      ref={modalRef}
    >
      <div className="add-booking-modal-content">
        <div className="booking-details">
          <h3 id="modal-title">RESCHEDULE BOOKING</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
          <form onSubmit={handleSubmit} className="booking-form">
            {/* Customer Name */}
            <div className="form-group info-display" style={{ textAlign: 'center', marginBottom: '20px', padding: '0 20px' }}>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: 'bold', 
                color: '#333',
                lineHeight: '1.4',
                wordWrap: 'break-word'
              }}>
                Confirm {selectedBooking?.customer_name || selectedBooking?.customerName || 'Customer'}'s new booking time before proceeding.
              </div>
            </div>
            
            {/* Select New Date */}
            <div className="form-group input-field">
              <input
                type="date"
                name="newDate"
                value={formData.newDate}
                onChange={handleFormChange}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Select Time */}
            <div className="form-group input-field">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '12px' }}>Loading available times...</div>
              ) : error ? (
                <div style={{ color: 'red', textAlign: 'center', padding: '12px' }}>{error}</div>
              ) : (
                <select
                  name="newTime"
                  value={formData.newTime}
                  onChange={handleFormChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Select Time</option>
                  {availableTimeSlots.length === 0 ? (
                    <option value="" disabled>No available slots for this date</option>
                  ) : (
                    availableTimeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))
                  )}
                </select>
              )}
              {availableTimeSlots.length === 0 && !loading && !error && (
                <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '5px' }}>
                  No available time slots for this date. Please select another date.
                </div>
              )}
            </div>
            
            {/* Debug Info */}
            <div className="debug-info" style={{ fontSize: '11px', color: '#999', margin: '10px 0', padding: '5px', border: '1px dashed #ddd' }}>
              <p>Bookings: {debugInfo.totalBookings}, Blocked: {debugInfo.blockedSlots}</p>
              <p>Unavailable: {debugInfo.unavailableSlots.join(', ')}</p>
              <p>Available: {debugInfo.availableSlots.length} slots</p>
            </div>
            
            <button 
              type="submit" 
              className="submit-button compact"
              disabled={loading || availableTimeSlots.length === 0}
            >
              {loading ? 'Loading...' : 'Confirm'}
            </button>
          </form>
        </div>
      </div>
      <div className="modal-overlay" onClick={onClose}></div>
    </div>
  );
};

export default RescheduleBookingModal;

