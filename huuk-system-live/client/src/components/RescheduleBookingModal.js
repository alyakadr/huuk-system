import React, { useState, useRef } from 'react';
import './AddBookingModal.css';

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
                <option value="09:00">09:00</option>
                <option value="09:30">09:30</option>
                <option value="10:00">10:00</option>
                <option value="10:30">10:30</option>
                <option value="11:00">11:00</option>
                <option value="11:30">11:30</option>
                <option value="12:00">12:00</option>
                <option value="12:30">12:30</option>
                <option value="13:00">13:00</option>
                <option value="13:30">13:30</option>
                <option value="14:00">14:00</option>
                <option value="14:30">14:30</option>
                <option value="15:00">15:00</option>
                <option value="15:30">15:30</option>
                <option value="16:00">16:00</option>
                <option value="16:30">16:30</option>
                <option value="17:00">17:00</option>
                <option value="17:30">17:30</option>
                <option value="18:00">18:00</option>
              </select>
            </div>
            <button type="submit" className="submit-button compact">
              Confirm
            </button>
          </form>
        </div>
      </div>
      <div className="modal-overlay" onClick={onClose}></div>
    </div>
  );
};

export default RescheduleBookingModal;

