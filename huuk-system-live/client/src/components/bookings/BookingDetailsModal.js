import React, { useEffect, useState } from "react";
import {
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import { MdEdit, MdDelete, MdAdd } from "react-icons/md";
import { normalizeTime } from "../../utils/bookingUtils";
import "../../styles/booking.css";

Modal.setAppElement("#root");

const BookingDetailsModal = ({
  isOpen,
  onClose,
  bookings,
  bookingDetails,
  handleDeleteBooking,
  handleAddBooking,
  handleEditBooking,
  openPaymentMethodModal,
  loading,
  setActiveStep,
  setBookingDetails,
  setSelectedDate,
  setOutletId,
  outlets,
  setStaffId,
  staff,
  setTime,
  setServiceId,
  services,
  setClientName,
  serviceDuration,
  showSuccessMessage,
  setIsEditingBooking,
  setCurrentBookingTime = () => {}, // Add default empty function
  setCurrentBookingId = () => {},   // Add default empty function
  setModalBookingsParent = () => {}, // Add function to pass modal bookings back to parent
  isEditingBooking = false, // Add prop to track edit mode from parent
  onEditComplete = () => {}, // Add callback for when edit is completed
  onDraftCancelled = () => {}, // Add callback for when a draft booking is cancelled
}) => {
  const [modalBookings, setModalBookings] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Pass modalBookings back to parent component for time slot filtering
  useEffect(() => {
    setModalBookingsParent(modalBookings);
  }, [modalBookings, setModalBookingsParent]);

  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0.7,
    scale: isOpen ? 1 : 0.99,
    config: { tension: 150, friction: 26 },
  });

  // Track previous modal state to detect when modal first opens
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  
  // Track if we're currently editing a booking
  const [isEditingModalBooking, setIsEditingModalBooking] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  
  // Use current booking form data and calculate total price
  useEffect(() => {
    if (isOpen) {
      console.log("📝 [MODAL DEBUG] Modal opened, using current booking form data:", bookingDetails);
      
      // Only add booking when modal first opens (not on subsequent bookingDetails changes)
      const isModalJustOpened = isOpen && !prevIsOpen;
      
      if (isModalJustOpened && !isEditingModalBooking) {
        // Check if we have temporarily stored bookings from a previous "Add Booking" action
        if (window.tempModalBookings && window.tempModalBookings.length > 0) {
          console.log("📝 [MODAL DEBUG] Restoring previously saved bookings:", window.tempModalBookings);
          
          // Restore the previously saved bookings
          setModalBookings([...window.tempModalBookings]);
          
          // If we have new booking details, add them to the existing bookings
          if (bookingDetails) {
            console.log("📝 [MODAL DEBUG] Adding new booking to existing bookings");
            addBookingToModal(bookingDetails);
          }
          
          // Clear the temporary storage
          window.tempModalBookings = null;
        } else if (bookingDetails) {
          console.log("📝 [MODAL DEBUG] Modal just opened, adding current booking via addBookingToModal");
          
          // Check if we're in edit mode - if so, preserve existing bookings
          const isEditMode = isEditingBooking || editingBookingId;
          
          if (isEditMode) {
            console.log("📝 [MODAL DEBUG] Edit mode detected, preserving existing bookings and updating");
            // Don't reset modal bookings in edit mode
            addBookingToModal(bookingDetails);
          } else {
            console.log("📝 [MODAL DEBUG] New booking mode, resetting modal bookings");
            // Reset modal bookings first to start fresh for new bookings
            setModalBookings([]);
            addBookingToModal(bookingDetails);
          }
        } else {
          console.log("📝 [MODAL DEBUG] No booking details available, showing empty state");
          setModalBookings([]);
          setTotalPrice(0);
        }
      } else if (bookingDetails && !isModalJustOpened) {
        // Enhanced edit detection logic
        const isEditMode = isEditingBooking || editingBookingId;
        const existingBookingIndex = modalBookings.findIndex(b => 
          b.id === bookingDetails.id || 
          (isEditMode && editingBookingId && b.id === editingBookingId) ||
          (isEditMode && b.customer_name === bookingDetails.customer_name && 
           b.date === bookingDetails.date && b.time === bookingDetails.time)
        );
        
        if (existingBookingIndex !== -1 || isEditMode) {
          // This is an edit operation - update the existing booking
          console.log("📝 [MODAL DEBUG] Detected edit operation:", {
            existingBookingIndex,
            isEditMode,
            editingBookingId,
            bookingDetailsId: bookingDetails.id,
            modalBookingsCount: modalBookings.length
          });
          
          if (existingBookingIndex !== -1) {
            // Update the existing booking with the new data
            updateEditedBooking(bookingDetails);
          } else {
            // We're in edit mode but the booking isn't in modal yet - add it
            console.log("📝 [MODAL DEBUG] Edit mode but booking not in modal, adding as edit");
            addBookingToModal(bookingDetails);
          }
          
          // Set editing state
          setIsEditingModalBooking(true);
          setEditingBookingId(bookingDetails.id);
        } else {
          // This is a new booking being added
          console.log("📝 [MODAL DEBUG] Adding new booking to modal:", bookingDetails);
          addBookingToModal(bookingDetails);
        }
      }
      
      setCurrentDate(new Date());
    } else {
      // Only reset modal state when closing if not in edit mode
      if (!isEditingModalBooking) {
        setModalBookings([]);
        setTotalPrice(0);
      } else {
        // Keep edit state active for a short time to allow for successful updates
        console.log("📝 [MODAL DEBUG] Modal closing in edit mode, preserving edit state temporarily");
        // Don't reset edit state immediately - let the parent component handle it
      }
    }
    
    // Update previous modal state
    setPrevIsOpen(isOpen);
    // Only depend on isOpen and other true dependencies, NOT prevIsOpen
  }, [isOpen, bookingDetails, isEditingModalBooking, isEditingBooking, editingBookingId, onEditComplete]);

  // Calculate total price whenever modalBookings changes
  useEffect(() => {
    const total = modalBookings.reduce((sum, booking) => sum + (Number(booking.price) || 0), 0);
    setTotalPrice(total);
  }, [modalBookings]);
  
  // Function to add a new booking to the modal
  const addBookingToModal = (newBookingDetails) => {
    if (newBookingDetails) {
      // Create a deep copy to ensure independence from the original bookingDetails object
      const newBooking = {
        id: newBookingDetails.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customer_name: String(newBookingDetails.customer_name || newBookingDetails.clientName || "N/A"),
        outlet: String(newBookingDetails.outlet || "N/A"),
        staff_name: String(newBookingDetails.staff_name || "N/A"),
        service: String(newBookingDetails.service || "N/A"),
        date: String(newBookingDetails.date || "N/A"),
        time: String(newBookingDetails.time || "N/A"),
        price: Number(newBookingDetails.price) || 0,
        payment_method: String(newBookingDetails.payment_method || "Stripe"),
        payment_status: String(newBookingDetails.payment_status || "Pending"),
        serviceDuration: Number(newBookingDetails.serviceDuration) || Number(newBookingDetails.duration) || Number(newBookingDetails.service_duration) || serviceDuration || 60,
      };
      
      // Ensure a full deep clone to prevent data reference issues
      const clonedNewBooking = JSON.parse(JSON.stringify(newBooking));
      
      console.log("📝 [MODAL DEBUG] Adding new booking to modal:", clonedNewBooking);
      
      setModalBookings(prev => {
        // Enhanced logic to detect existing bookings for editing
        const isEditMode = isEditingBooking || editingBookingId;
        
        // Check if a booking with the same ID already exists
        let existingIndex = prev.findIndex(b => b.id === clonedNewBooking.id);
        
        // If not found by ID and we're in edit mode, try to find by matching details
        if (existingIndex === -1 && isEditMode) {
          existingIndex = prev.findIndex(b => 
            b.customer_name === clonedNewBooking.customer_name &&
            b.date === clonedNewBooking.date &&
            b.time === clonedNewBooking.time
          );
        }
        
        if (existingIndex !== -1) {
          // Update existing booking
          console.log("📝 [MODAL DEBUG] Updating existing booking at index:", existingIndex);
          const updated = [...prev];
          updated[existingIndex] = clonedNewBooking;
          return updated;
        } else {
          // Add new booking
          console.log("📝 [MODAL DEBUG] Adding new booking to modal");
          return [...prev, clonedNewBooking];
        }
      });
    }
  };
  
  // Track if we're adding a new booking (to distinguish from editing)
  const [isAddingNewBooking, setIsAddingNewBooking] = useState(false);
  
  // New function to handle adding booking within modal (temporarily closes modal for new booking)
  const handleAddBookingInModal = () => {
    console.log("📝 [MODAL DEBUG] Adding new booking - temporarily closing modal for new booking flow");
    
    // Store current modal bookings to preserve them
    const currentModalBookings = [...modalBookings];
    
    // Clear any existing booking details and reset form states for new booking
    setBookingDetails(null);
    setIsEditingBooking(false);
    setActiveStep(0);
    setSelectedDate(null);
    setOutletId("");
    setStaffId("");
    setServiceId("");
    setTime("");
    setClientName("");
    
    // Set flag to track that we're adding a new booking
    setIsAddingNewBooking(true);
    
    // Store the current modal bookings in a temporary state so we can restore them
    // when the new booking is completed
    window.tempModalBookings = currentModalBookings;
    
    // Also store the existing bookings for time slot filtering
    // This will be used by the main booking component to filter available slots
    window.existingBookingsForFiltering = currentModalBookings.map(booking => ({
      id: booking.id,
      time: booking.time,
      date: booking.date,
      serviceDuration: booking.serviceDuration || serviceDuration || 30 // Use the booking's actual service duration
    }));
    
    // Close the modal temporarily to allow user to create new booking
    onClose();
    
    console.log("📝 [MODAL DEBUG] Modal closed temporarily, user can now create new booking");
    console.log("📝 [MODAL DEBUG] Stored modal bookings:", currentModalBookings);
    console.log("📝 [MODAL DEBUG] Stored existing bookings for filtering:", window.existingBookingsForFiltering);
  };
  
  // Watch for new bookings being created after modal is open
  useEffect(() => {
    if (isOpen && bookingDetails && isAddingNewBooking) {
      // Modal is open, we're adding a new booking, and we have new booking details
      console.log("📝 [MODAL DEBUG] Adding new booking after Add Booking button clicked");
      
      // Create a snapshot of the current booking details to avoid reference issues
      const bookingSnapshot = {
        id: bookingDetails.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customer_name: bookingDetails.customer_name,
        clientName: bookingDetails.clientName,
        outlet: bookingDetails.outlet,
        staff_name: bookingDetails.staff_name,
        service: bookingDetails.service,
        date: bookingDetails.date,
        time: bookingDetails.time,
        price: bookingDetails.price,
        payment_method: bookingDetails.payment_method,
        payment_status: bookingDetails.payment_status,
        serviceDuration: bookingDetails.serviceDuration || serviceDuration || 30,
      };
      // Create a deep clone to ensure complete independence
      const clonedBookingSnapshot = JSON.parse(JSON.stringify(bookingSnapshot));
      addBookingToModal(clonedBookingSnapshot);
      
      setIsAddingNewBooking(false); // Reset the flag
    }
  }, [bookingDetails, isOpen, isAddingNewBooking]);

  // New function to update a specific booking after editing
  const updateEditedBooking = (updatedBookingDetails) => {
    if (!updatedBookingDetails || !updatedBookingDetails.id) return;
    
    setModalBookings(prevBookings => {
      // Find the booking with the matching ID
      const bookingIndex = prevBookings.findIndex(booking => booking.id === updatedBookingDetails.id);
      
      if (bookingIndex === -1) {
        // If not found, just add it as a new booking
        console.log("📝 [MODAL DEBUG] Edited booking not found in existing bookings, adding as new");
        return [...prevBookings, {
          id: updatedBookingDetails.id,
          customer_name: String(updatedBookingDetails.customer_name || updatedBookingDetails.clientName || "N/A"),
          outlet: String(updatedBookingDetails.outlet || "N/A"),
          staff_name: String(updatedBookingDetails.staff_name || "N/A"),
          service: String(updatedBookingDetails.service || "N/A"),
          date: String(updatedBookingDetails.date || "N/A"),
          time: String(updatedBookingDetails.time || "N/A"),
          price: Number(updatedBookingDetails.price) || 0,
          payment_method: String(updatedBookingDetails.payment_method || "Stripe"),
          payment_status: String(updatedBookingDetails.payment_status || "Pending"),
          serviceDuration: Number(updatedBookingDetails.serviceDuration) || Number(updatedBookingDetails.duration) || Number(updatedBookingDetails.service_duration) || serviceDuration || 60,
        }];
      }
      
      // Create a deep copy of the bookings array
      const updatedBookings = [...prevBookings];
      
      // Update the specific booking
      updatedBookings[bookingIndex] = {
        ...updatedBookings[bookingIndex],
        customer_name: String(updatedBookingDetails.customer_name || updatedBookingDetails.clientName || updatedBookings[bookingIndex].customer_name),
        outlet: String(updatedBookingDetails.outlet || updatedBookings[bookingIndex].outlet),
        staff_name: String(updatedBookingDetails.staff_name || updatedBookings[bookingIndex].staff_name),
        service: String(updatedBookingDetails.service || updatedBookings[bookingIndex].service),
        date: String(updatedBookingDetails.date || updatedBookings[bookingIndex].date),
        time: String(updatedBookingDetails.time || updatedBookings[bookingIndex].time),
        price: Number(updatedBookingDetails.price) || updatedBookings[bookingIndex].price,
        payment_method: String(updatedBookingDetails.payment_method || updatedBookings[bookingIndex].payment_method),
        payment_status: String(updatedBookingDetails.payment_status || updatedBookings[bookingIndex].payment_status),
        serviceDuration: Number(updatedBookingDetails.serviceDuration) || Number(updatedBookingDetails.duration) || Number(updatedBookingDetails.service_duration) || updatedBookings[bookingIndex].serviceDuration || serviceDuration || 60,
      };
      
      console.log("📝 [MODAL DEBUG] Updated booking at index", bookingIndex, ":", updatedBookings[bookingIndex]);
      
      // Call edit complete callback if we're in edit mode
      if (isEditingBooking || editingBookingId) {
        console.log("📝 [MODAL DEBUG] Edit completed successfully, calling onEditComplete");
        onEditComplete();
      }
      
      return updatedBookings;
    });
  };

  // Effect to remove temp bookings and call onDraftCancelled when modal closes
  useEffect(() => {
    if (!isOpen) {
      const tempBookings = modalBookings.filter(b => b.id && b.id.toString().startsWith('temp-'));
      if (tempBookings.length > 0 && typeof onDraftCancelled === 'function') {
        tempBookings.forEach(b => onDraftCancelled(b));
      }
      setModalBookings(prev => prev.filter(b => !(b.id && b.id.toString().startsWith('temp-'))));
    }
  }, [isOpen, modalBookings, onDraftCancelled]);

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Booking Details Modal"
      className="booking-details-modal"
      overlayClassName="cust-overlay"
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={true}
      shouldCloseOnEsc={true}
    >
      <animated.div
        style={{
          opacity: modalAnimation.opacity
        }}
        className="booking-details-modal-container"
      >
        <div className="booking-details-modal-content">
          <div style={{ position: "absolute", top: "10px", left: "20px", fontSize: "14px" }}>
            <span style={{ fontWeight: "bold" }}>Date:</span> {currentDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).replace(/\//g, '-')}
          </div>
          <h2 style={{ 
            textAlign: "center", 
            marginBottom: "20px", 
            marginTop: "30px",
            fontWeight: "bold",
            fontFamily: "Special Gothic Expanded One, sans-serif",
            fontSize: "24px"
          }}>
            BOOKING DETAILS
          </h2>
          <TableContainer
            component={Paper}
            style={{ 
              marginBottom: "15px", 
              boxShadow: "none",
              border: "none",
              overflow: "hidden"
            }}
          >
            <Table style={{ 
              border: "none", 
              fontSize: "12px", 
              tableLayout: "fixed",
              borderCollapse: "collapse",
              borderSpacing: "0"
            }}>
              <TableHead>
                <TableRow>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 0px 6px 6px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "70px"
                  }}>BOOKING ID</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 6px 6px 0px", 
                    fontSize: "11px", 
                    whiteSpace: "nowrap",
                    margin: "0",
                    width: "130px"
                  }}>CUSTOMER NAME</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 0px 6px 6px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "60px"
                  }}>OUTLET</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 6px 6px 0px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "90px"
                  }}>BARBER</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 0px 6px 6px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "90px"
                  }}>SERVICE</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 6px 6px 0px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "90px",
                    whiteSpace: "nowrap"
                  }}>DATE</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 0px 6px 6px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "100px"
                  }}>TIME</TableCell>
                  <TableCell style={{ 
                    fontWeight: "bold", 
                    border: "none", 
                    padding: "6px 6px 6px 0px", 
                    fontSize: "11px",
                    margin: "0",
                    width: "70px"
                  }}>PRICE</TableCell>
                  <TableCell style={{ fontWeight: "bold", border: "none", padding: "6px", fontSize: "11px", textAlign: "center" }}>ACTION</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalBookings.map((booking, index) => {
                  // Calculate end time for service with improved duration handling
                  const getServiceEndTime = (startTime, duration) => {
                    try {
                      // Ensure duration is a valid number
                      const serviceDurationMinutes = Number(duration) || 60;
                      console.log(`🕐 [TIME CALCULATION] Calculating end time for booking ${booking.id}:`, {
                        startTime,
                        duration: serviceDurationMinutes,
                        bookingServiceDuration: booking.serviceDuration,
                        fallbackDuration: serviceDuration
                      });
                      
                      const [hours, minutes] = startTime.split(':').map(Number);
                      const startDate = new Date();
                      startDate.setHours(hours, minutes, 0, 0);
                      const endDate = new Date(startDate.getTime() + serviceDurationMinutes * 60000);
                      const endTime = endDate.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });
                      
                      console.log(`🕐 [TIME CALCULATION] Result: ${startTime} + ${serviceDurationMinutes} minutes = ${endTime}`);
                      return endTime;
                    } catch (error) {
                      console.error(`❌ [TIME CALCULATION] Error calculating end time:`, error);
                      return "N/A";
                    }
                  };

                  // Generate unique key that combines booking ID and index to avoid duplicates
                  const uniqueKey = booking.id === "New Booking" || booking.id.toString().startsWith('temp-') 
                    ? `new-booking-${index}-${booking.id}` 
                    : `booking-${booking.id}-${index}`;

                  const isEditingThisBooking = isEditingModalBooking && editingBookingId === booking.id;

                  return (
                  <TableRow key={uniqueKey}>
                    <TableCell style={{ border: "none", padding: "6px 0px 6px 6px", margin: "0", width: "70px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "60px", textAlign: "left", fontSize: "12px", marginRight: "0px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {booking.id === "New Booking" || booking.id.toString().startsWith('temp-') ? "New Booking" : String(booking.id).padStart(7, '0')}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 6px 6px 0px", margin: "0", width: "130px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "120px", textAlign: "left", fontSize: "12px", marginRight: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {booking.customer_name}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 0px 6px 6px", margin: "0", width: "60px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "50px", textAlign: "left", fontSize: "12px", marginRight: "0px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {booking.outlet}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 6px 6px 0px", margin: "0", width: "90px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "80px", textAlign: "left", fontSize: "12px", marginRight: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {booking.staff_name}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 0px 6px 6px", margin: "0", width: "90px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "80px", textAlign: "left", fontSize: "12px", marginRight: "0px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {booking.service}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 6px 6px 0px", margin: "0", width: "90px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "80px", textAlign: "left", fontSize: "12px", marginRight: "0px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {booking.date !== "N/A" ? new Date(booking.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, '-') : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 0px 6px 6px", margin: "0", width: "100px" }}>
                      <div style={{ backgroundColor: "#e8f0f7", padding: "6px", borderRadius: "4px", display: "inline-block", width: "90px", textAlign: "left", fontSize: "12px", marginRight: "0px" }}>
                        {booking.time !== "N/A" ? (() => {
                          const bookingDuration = booking.serviceDuration || booking.service_duration || serviceDuration || 60;
                          const startTimeFormatted = new Date(`1970-01-01T${booking.time}`).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
                          const endTime = getServiceEndTime(booking.time, bookingDuration);
                          return `${startTimeFormatted} – ${endTime}`;
                        })() : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 6px 6px 0px", margin: "0", width: "70px" }}>
                      <div style={{ padding: "6px", borderRadius: "4px", display: "inline-block", width: "50px", textAlign: "left", fontSize: "12px" }}>
                        RM{Math.floor(booking.price)}
                      </div>
                    </TableCell>
                    <TableCell style={{ border: "none", padding: "6px 4px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                        <Button
                          onClick={() => {
                            handleEditBooking(
                              booking,
                              () => {
                                onClose();
                              },
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
                          }}
                          sx={{ color: "#1a1a1a", fontSize: "12px", minWidth: "60px", textTransform: "none", fontFamily: "Quicksand, sans-serif", fontWeight: "bold", backgroundColor: "transparent", '&:hover': { backgroundColor: "transparent", textDecoration: "underline" } }}
                        >
                          Edit
                        </Button>
                        <Button
                          startIcon={<MdDelete />}
                          onClick={async () => {
                            console.log("🗑️ [MODAL DEBUG] Deleting booking:", booking);
                            
                            // For temporary bookings, just remove from modal
                            if (booking.id && booking.id.toString().startsWith('temp-')) {
                              setModalBookings(prev => prev.filter((b, idx) => 
                                !(b.id === booking.id && idx === index)
                              ));
                              if (typeof onDraftCancelled === 'function') {
                                onDraftCancelled(booking);
                              }
                              return;
                            }
                            
                            // For real bookings, call API first
                            if (booking.id) {
                              try {
                                // Store the booking for potential rollback
                                const bookingToDelete = { ...booking };
                                const originalIndex = index;
                                
                                // Call the delete API directly using client
                                const token = localStorage.getItem("token");
                                if (!token) {
                                  console.error("No token found for delete operation");
                                  return;
                                }
                                
                                // Import client
                                const client = (await import("../../api/client")).default;
                                
                                // Call delete API directly
                                await client.delete(`/bookings/${booking.id}`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                
                                // Remove from modal bookings
                                setModalBookings(prev => prev.filter((b, idx) => 
                                  !(b.id === booking.id && idx === originalIndex)
                                ));
                                
                                // Show success message
                                if (showSuccessMessage) {
                                  showSuccessMessage("Booking deleted successfully!");
                                }
                                
                                console.log("🗑️ [MODAL DEBUG] Successfully deleted booking:", booking.id);
                              } catch (error) {
                                console.error("Error deleting booking:", error);
                                const errorMessage = "Failed to delete booking. Please try again.";
                                if (showSuccessMessage) {
                                  showSuccessMessage(errorMessage);
                                }
                              }
                            }
                          }}
                          sx={{ color: "#ff0000", fontSize: "10px", minWidth: "40px" }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Add Booking Button - Below table, left aligned */}
          <div style={{ marginBottom: "15px", textAlign: "left" }}>
            <Button
              variant="contained"
              startIcon={<MdAdd />}
              onClick={() => {
                console.log("📝 [MODAL DEBUG] Adding new booking - keeping modal open");
                // Create a new booking handler that keeps the modal open
                handleAddBookingInModal();
              }}
              sx={{ 
                backgroundColor: "#1a1a1a", 
                color: "white",
                fontSize: "10px",
                padding: "4px 8px",
                minWidth: "auto",
                '&:hover': {
                  backgroundColor: "#333"
                }
              }}
            >
              Add Booking
            </Button>
          </div>
          
          {/* Right side summary and pay button */}
          <div style={{ 
            display: "flex", 
            justifyContent: "flex-end", 
            marginBottom: "10px"
          }}>
            <div style={{ 
              textAlign: "right",
              minWidth: "200px"
            }}>
              {/* Booking ID and Total Price */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "flex-start",
                marginBottom: "8px"
              }}>
                <div style={{ 
                  textAlign: "left",
                  fontSize: "12px"
                }}>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Booking ID{modalBookings.length > 1 ? 's' : ''}</strong>
                  </div>
                  <div style={{ color: "#666", fontSize: "12px" }}>
                    {modalBookings.map((booking, index) => {
                      const id = booking.id === "New Booking" || booking.id === "N/A" || booking.id.toString().startsWith('temp-') ? "New Booking" : String(booking.id).padStart(7, '0');
                      // Generate unique key that combines booking ID and index to avoid duplicates
                      const uniqueKey = booking.id === "New Booking" || booking.id.toString().startsWith('temp-') 
                        ? `new-booking-id-${index}-${booking.id}` 
                        : `booking-id-${booking.id}-${index}`;
                      return (
                        <div key={uniqueKey} style={{ marginBottom: index < modalBookings.length - 1 ? "2px" : "0" }}>
                          {id}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div style={{ 
                  textAlign: "right",
                  fontSize: "12px",
                  marginLeft: "30px"
                }}>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Price</strong>
                  </div>
                  <div style={{ color: "#666", fontSize: "12px" }}>
                    {modalBookings.map((booking, index) => {
                      // Generate unique key that combines booking ID and index to avoid duplicates
                      const uniqueKey = booking.id === "New Booking" || booking.id.toString().startsWith('temp-') 
                        ? `new-booking-price-${index}-${booking.id}` 
                        : `booking-price-${booking.id}-${index}`;
                      return (
                        <div key={uniqueKey} style={{ marginBottom: index < modalBookings.length - 1 ? "2px" : "0" }}>
                          RM{Math.floor(booking.price)}.00
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ 
                    borderTop: "1px solid #ddd", 
                    paddingTop: "4px", 
                    marginTop: "4px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#1a1a1a"
                  }}>
                    RM{totalPrice.toFixed(2)}
                  </div>
                </div>
              </div>
              
              {/* Pay Button */}
              <div style={{ textAlign: "right", marginTop: "8px" }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    // Create combined booking data for payment
                    const combinedBookingData = {
                      bookings: modalBookings,
                      totalPrice: totalPrice,
                      bookingIds: modalBookings.map(b => b.id).filter(id => !id.toString().startsWith('temp-')),
                      customer_name: modalBookings[0]?.customer_name || "N/A",
                      payment_method: "Stripe",
                      payment_status: "Pending",
                      isMultipleBookings: modalBookings.length > 1
                    };
                    
                    console.log("💳 [PAYMENT] Opening payment modal with combined data:", combinedBookingData);
                    
                    // Store the combined booking data temporarily for the payment process
                    window.combinedBookingData = combinedBookingData;
                    
                    openPaymentMethodModal();
                  }}
                  disabled={
                    loading.paymentInit ||
                    !modalBookings.length ||
                    (modalBookings.length === 1 && modalBookings[0]?.payment_status === "Paid") ||
                    (modalBookings.length === 1 && modalBookings[0]?.payment_method === "Pay at Outlet")
                  }
                  sx={{ 
                    backgroundColor: "#1a1a1a", 
                    color: "white",
                    fontSize: "10px",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    minWidth: "60px",
                    textTransform: "none"
                  }}
                >
                  {loading.paymentInit ? "Initiating Payment..." :
                    (modalBookings.length === 1 && modalBookings[0]?.payment_method === "Pay at Outlet") ? "Paid at Outlet" : "Pay"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <button className="booking-details-close-btn" onClick={onClose}>
          x
        </button>
      </animated.div>
    </Modal>
  );
};

export default BookingDetailsModal;
