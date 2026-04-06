import React, { useEffect, useState } from "react";
import {
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
import { MdDelete, MdAdd } from "react-icons/md";
import { normalizeTime } from "../../utils/bookingUtils";
import {
  formatBookingTimeRange,
  resolveBookingDuration,
} from "../../utils/bookingDisplay";

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
  setCurrentBookingId = () => {}, // Add default empty function
  setModalBookingsParent = () => {}, // Add function to pass modal bookings back to parent
  isEditingBooking = false, // Add prop to track edit mode from parent
  onEditComplete = () => {}, // Add callback for when edit is completed
  onDraftCancelled = () => {}, // Add callback for when a draft booking is cancelled
  updateBookingInList = () => {}, // Add updateBookingInList function with default empty function
}) => {
  const [modalBookings, setModalBookings] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  // Track if we're adding a new booking (to distinguish from editing)
  const [isAddingNewBooking, setIsAddingNewBooking] = useState(false);
  // Track previous modal state to detect when modal first opens
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  // Track if modal was just opened (for initialization)
  const [justOpened, setJustOpened] = useState(false);

  // Pass modalBookings back to parent component for time slot filtering
  useEffect(() => {
    setModalBookingsParent(modalBookings);
  }, [modalBookings, setModalBookingsParent]);

  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0.7,
    scale: isOpen ? 1 : 0.99,
    config: { tension: 150, friction: 26 },
  });

  // Detect when modal opens for the first time
  useEffect(() => {
    if (isOpen && !prevIsOpen) {
      console.log(
        "📝 [MODAL DEBUG] Modal just opened, setting justOpened flag",
      );
      setJustOpened(true);
    }
    setPrevIsOpen(isOpen);
  }, [isOpen, prevIsOpen]);

  // Initialize modal bookings only when the modal is first opened
  useEffect(() => {
    if (isOpen && justOpened) {
      // Only initialize if modalBookings is empty
      setModalBookings((prev) => {
        // Don't overwrite existing bookings if we already have them
        if (prev.length > 0) return prev;

        // If we have bookingDetails, use that first
        if (bookingDetails && Object.keys(bookingDetails).length > 0) {
          const updatedBooking = {
            id: bookingDetails.id,
            customer_name: String(
              bookingDetails.customer_name ||
                bookingDetails.clientName ||
                "N/A",
            ),
            outlet: String(bookingDetails.outlet || "N/A"),
            staff_id: bookingDetails.staff_id || null,
            staff_name: String(bookingDetails.staff_name || "N/A"),
            service: String(bookingDetails.service || "N/A"),
            date: String(bookingDetails.date || "N/A"),
            time: String(bookingDetails.time || "N/A"),
            price: Number(bookingDetails.price) || 0,
            payment_method: String(
              bookingDetails.payment_method || "Online Payment",
            ),
            payment_status: String(bookingDetails.payment_status || "Pending"),
            serviceDuration: resolveBookingDuration(bookingDetails),
          };
          console.log(
            "📝 [MODAL DEBUG] Initializing modal with bookingDetails:",
            updatedBooking,
          );
          return [updatedBooking];
        }
        // Otherwise, use the bookings array if available
        else if (bookings && bookings.length > 0) {
          console.log(
            "📝 [MODAL DEBUG] Initializing modal with bookings array:",
            bookings,
          );
          return bookings.map((b) => ({
            id: b.id,
            customer_name: String(b.customer_name || b.clientName || "N/A"),
            outlet: String(b.outlet || "N/A"),
            staff_id: b.staff_id || null,
            staff_name: String(b.staff_name || "N/A"),
            service: String(b.service || "N/A"),
            date: String(b.date || "N/A"),
            time: String(b.time || "N/A"),
            price: Number(b.price) || 0,
            payment_method: String(b.payment_method || "Online Payment"),
            payment_status: String(b.payment_status || "Pending"),
            serviceDuration: resolveBookingDuration(b),
          }));
        }

        // If no data available, return empty array
        return [];
      });
      setJustOpened(false);
    }
  }, [
    isOpen,
    justOpened,
    bookings,
    bookingDetails,
    serviceDuration,
    isEditingBooking,
  ]);

  // Handle editing and updating existing bookings
  useEffect(() => {
    if (
      isOpen &&
      isEditingBooking &&
      bookingDetails &&
      Object.keys(bookingDetails).length > 0
    ) {
      console.log(
        "📝 [MODAL DEBUG] Updating booking in modal after edit:",
        bookingDetails,
      );

      setModalBookings((prevBookings) => {
        const newBooking = {
          id: bookingDetails.id,
          customer_name: String(
            bookingDetails.customer_name || bookingDetails.clientName || "N/A",
          ),
          outlet: String(bookingDetails.outlet || "N/A"),
          staff_id: bookingDetails.staff_id || null,
          staff_name: String(bookingDetails.staff_name || "N/A"),
          service: String(bookingDetails.service || "N/A"),
          date: String(bookingDetails.date || "N/A"),
          time: String(bookingDetails.time || "N/A"),
          price: Number(bookingDetails.price) || 0,
          payment_method: String(
            bookingDetails.payment_method || "Online Payment",
          ),
          payment_status: String(bookingDetails.payment_status || "Pending"),
          serviceDuration: resolveBookingDuration(bookingDetails),
        };

        // If there are no bookings yet, add this one
        if (prevBookings.length === 0) {
          console.log(
            "📝 [MODAL DEBUG] No existing bookings, adding new one:",
            newBooking,
          );
          return [newBooking];
        }

        const bookingIndex = prevBookings.findIndex((b) => {
          if (
            String(b.id).startsWith("temp-") &&
            String(bookingDetails.id).startsWith("temp-")
          ) {
            // Match by all unique fields for temp bookings
            return (
              b.customer_name === bookingDetails.customer_name &&
              b.outlet === bookingDetails.outlet &&
              b.staff_name === bookingDetails.staff_name &&
              b.service === bookingDetails.service &&
              b.date === bookingDetails.date &&
              b.time === bookingDetails.time
            );
          }
          return b.id === bookingDetails.id;
        });

        if (bookingIndex !== -1) {
          const updatedBookings = [...prevBookings];
          // Preserve existing staff_name if the new one is "N/A" and the old one isn't
          if (
            newBooking.staff_name === "N/A" &&
            updatedBookings[bookingIndex].staff_name !== "N/A"
          ) {
            newBooking.staff_name = updatedBookings[bookingIndex].staff_name;
            console.log(
              "📝 [MODAL DEBUG] Preserved existing staff name:",
              newBooking.staff_name,
            );
          }
          updatedBookings[bookingIndex] = newBooking;
          console.log(
            "📝 [MODAL DEBUG] Updated existing booking at index",
            bookingIndex,
            ":",
            newBooking,
          );
          return updatedBookings;
        }

        // If not found, add it to the list
        console.log(
          "📝 [MODAL DEBUG] Booking not found in list, adding it:",
          newBooking,
        );
        return [...prevBookings, newBooking];
      });
    } else if (
      isOpen &&
      !isEditingBooking &&
      bookingDetails &&
      Object.keys(bookingDetails).length > 0 &&
      isAddingNewBooking
    ) {
      // If not editing but adding a new booking, append it to the existing list
      setModalBookings((prev) => {
        const alreadyExists = prev.some(
          (b) =>
            b.id === bookingDetails.id ||
            (b.customer_name === bookingDetails.customer_name &&
              b.outlet === bookingDetails.outlet &&
              b.service === bookingDetails.service &&
              b.date === bookingDetails.date &&
              b.time === bookingDetails.time),
        );
        if (alreadyExists) return prev;
        return [
          ...prev,
          {
            id:
              bookingDetails.id ||
              `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            customer_name: String(
              bookingDetails.customer_name ||
                bookingDetails.clientName ||
                "N/A",
            ),
            outlet: String(bookingDetails.outlet || "N/A"),
            staff_id: bookingDetails.staff_id || null,
            staff_name: String(bookingDetails.staff_name || "N/A"),
            service: String(bookingDetails.service || "N/A"),
            date: String(bookingDetails.date || "N/A"),
            time: String(bookingDetails.time || "N/A"),
            price: Number(bookingDetails.price) || 0,
            payment_method: String(
              bookingDetails.payment_method || "Online Payment",
            ),
            payment_status: String(bookingDetails.payment_status || "Pending"),
            serviceDuration: resolveBookingDuration(bookingDetails),
          },
        ];
      });

      // Reset the flag after handling
      setIsAddingNewBooking(false);
    } else if (
      isOpen &&
      bookingDetails &&
      Object.keys(bookingDetails).length > 0
    ) {
      // Handle case when modal is open with bookingDetails but not editing or adding
      console.log(
        "📝 [MODAL DEBUG] Modal open with bookingDetails but not editing/adding:",
        bookingDetails,
      );

      // Check if we need to update or add the booking
      setModalBookings((prev) => {
        // If modalBookings is empty, add the booking
        if (prev.length === 0) {
          const newBooking = {
            id: bookingDetails.id,
            customer_name: String(
              bookingDetails.customer_name ||
                bookingDetails.clientName ||
                "N/A",
            ),
            outlet: String(bookingDetails.outlet || "N/A"),
            staff_id: bookingDetails.staff_id || null,
            staff_name: String(bookingDetails.staff_name || "N/A"),
            service: String(bookingDetails.service || "N/A"),
            date: String(bookingDetails.date || "N/A"),
            time: String(bookingDetails.time || "N/A"),
            price: Number(bookingDetails.price) || 0,
            payment_method: String(
              bookingDetails.payment_method || "Online Payment",
            ),
            payment_status: String(bookingDetails.payment_status || "Pending"),
            serviceDuration: resolveBookingDuration(bookingDetails),
          };
          console.log(
            "📝 [MODAL DEBUG] Adding booking to empty modal:",
            newBooking,
          );
          return [newBooking];
        }
        return prev;
      });
    }

    // Set current date regardless of modal state
    if (isOpen) {
      setCurrentDate(new Date());
    }
  }, [
    isOpen,
    bookingDetails,
    isEditingBooking,
    isAddingNewBooking,
    serviceDuration,
  ]);

  // Calculate total price whenever modalBookings changes
  useEffect(() => {
    const total = modalBookings.reduce(
      (sum, booking) => sum + (Number(booking.price) || 0),
      0,
    );
    setTotalPrice(total);
  }, [modalBookings]);

  // New function to handle adding booking within modal (temporarily closes modal for new booking)
  const handleAddBookingInModal = () => {
    console.log(
      "📝 [MODAL DEBUG] Adding new booking - temporarily closing modal for new booking flow",
    );

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
    window.existingBookingsForFiltering = currentModalBookings.map(
      (booking) => ({
        id: booking.id,
        staff_id: booking.staff_id || null,
        time: booking.time,
        date: booking.date,
        serviceDuration: resolveBookingDuration(booking),
      }),
    );

    // Close the modal temporarily to allow user to create new booking
    onClose();

    console.log(
      "📝 [MODAL DEBUG] Modal closed temporarily, user can now create new booking",
    );
    console.log(
      "📝 [MODAL DEBUG] Stored modal bookings:",
      currentModalBookings,
    );
    console.log(
      "📝 [MODAL DEBUG] Stored existing bookings for filtering:",
      window.existingBookingsForFiltering,
    );
  };

  // Watch for new bookings being created after modal is open
  useEffect(() => {
    if (isOpen && bookingDetails && isAddingNewBooking) {
      // Always generate a unique ID for new bookings
      const uniqueId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const bookingSnapshot = {
        ...bookingDetails,
        id: uniqueId,
        staff_id: bookingDetails.staff_id || null,
        serviceDuration: resolveBookingDuration(bookingDetails),
      };
      setModalBookings((prev) => {
        // Check if a booking with the same details already exists
        const alreadyExists = prev.some(
          (b) =>
            b.customer_name === bookingSnapshot.customer_name &&
            b.outlet === bookingSnapshot.outlet &&
            b.staff_name === bookingSnapshot.staff_name &&
            b.service === bookingSnapshot.service &&
            b.date === bookingSnapshot.date &&
            b.time === bookingSnapshot.time,
        );
        if (alreadyExists) {
          return prev;
        }
        return [...prev, bookingSnapshot];
      });
      setIsAddingNewBooking(false); // Reset the flag
    }
  }, [bookingDetails, isOpen, isAddingNewBooking, serviceDuration]);

  // Log when bookingDetails changes
  useEffect(() => {
    if (bookingDetails && Object.keys(bookingDetails).length > 0) {
      console.log(
        "📝 [MODAL DEBUG] bookingDetails prop changed:",
        bookingDetails,
      );
    }
  }, [bookingDetails]);

  // Effect to remove temp bookings and call onDraftCancelled when modal closes
  useEffect(() => {
    if (!isOpen) {
      const tempBookings = modalBookings.filter(
        (b) => b.id && b.id.toString().startsWith("temp-"),
      );
      if (tempBookings.length > 0 && typeof onDraftCancelled === "function") {
        tempBookings.forEach((b) => onDraftCancelled(b));
      }
      setModalBookings((prev) =>
        prev.filter((b) => !(b.id && b.id.toString().startsWith("temp-"))),
      );
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
          opacity: modalAnimation.opacity,
        }}
        className="booking-details-modal-container"
      >
        <div className="booking-details-modal-content">
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "20px",
              fontSize: "14px",
            }}
          >
            <span style={{ fontWeight: "bold" }}>Date:</span>{" "}
            {currentDate
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
              .replace(/\//g, "-")}
          </div>
          <h2
            style={{
              textAlign: "center",
              marginBottom: "20px",
              marginTop: "30px",
              fontWeight: "bold",
              fontFamily: "Special Gothic Expanded One, sans-serif",
              fontSize: "24px",
            }}
          >
            BOOKING DETAILS
          </h2>
          <TableContainer
            component={Paper}
            style={{
              marginBottom: "15px",
              boxShadow: "none",
              border: "none",
              overflow: "hidden",
            }}
          >
            <Table
              style={{
                border: "none",
                fontSize: "12px",
                tableLayout: "fixed",
                borderCollapse: "collapse",
                borderSpacing: "0",
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 0px 6px 6px",
                      fontSize: "11px",
                      margin: "0",
                      width: "70px",
                    }}
                  >
                    BOOKING ID
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 6px 6px 0px",
                      fontSize: "11px",
                      whiteSpace: "nowrap",
                      margin: "0",
                      width: "130px",
                    }}
                  >
                    CUSTOMER NAME
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 0px 6px 6px",
                      fontSize: "11px",
                      margin: "0",
                      width: "60px",
                    }}
                  >
                    OUTLET
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 6px 6px 0px",
                      fontSize: "11px",
                      margin: "0",
                      width: "90px",
                    }}
                  >
                    BARBER
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 0px 6px 6px",
                      fontSize: "11px",
                      margin: "0",
                      width: "90px",
                    }}
                  >
                    SERVICE
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 6px 6px 0px",
                      fontSize: "11px",
                      margin: "0",
                      width: "90px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    DATE
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 0px 6px 6px",
                      fontSize: "11px",
                      margin: "0",
                      width: "100px",
                    }}
                  >
                    TIME
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px 6px 6px 0px",
                      fontSize: "11px",
                      margin: "0",
                      width: "70px",
                    }}
                  >
                    PRICE
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: "bold",
                      border: "none",
                      padding: "6px",
                      fontSize: "11px",
                      textAlign: "center",
                    }}
                  >
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalBookings.map((booking, index) => {
                  // Generate unique key that combines booking ID and index to avoid duplicates
                  const uniqueKey =
                    booking.id === "New Booking" ||
                    booking.id.toString().startsWith("temp-")
                      ? `new-booking-${index}-${booking.id}`
                      : `booking-${booking.id}-${index}`;

                  return (
                    <TableRow key={uniqueKey}>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 0px 6px 6px",
                          margin: "0",
                          width: "70px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "60px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "0px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {booking.id === "New Booking" ||
                          booking.id.toString().startsWith("temp-")
                            ? "New Booking"
                            : String(booking.id).padStart(7, "0")}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 6px 6px 0px",
                          margin: "0",
                          width: "130px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "120px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "4px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {booking.customer_name}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 0px 6px 6px",
                          margin: "0",
                          width: "60px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "50px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "0px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {booking.outlet}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 6px 6px 0px",
                          margin: "0",
                          width: "90px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "80px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "4px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {booking.staff_name}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 0px 6px 6px",
                          margin: "0",
                          width: "90px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "80px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "0px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {booking.service}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 6px 6px 0px",
                          margin: "0",
                          width: "90px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "80px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "0px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {booking.date !== "N/A"
                            ? new Date(booking.date)
                                .toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                                .replace(/\//g, "-")
                            : "N/A"}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 0px 6px 6px",
                          margin: "0",
                          width: "100px",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#e8f0f7",
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "90px",
                            textAlign: "left",
                            fontSize: "12px",
                            marginRight: "0px",
                          }}
                        >
                          {booking.time !== "N/A"
                            ? (() => {
                                const bookingDuration = resolveBookingDuration(
                                  booking,
                                  services,
                                  serviceDuration,
                                );
                                return formatBookingTimeRange(
                                  booking.time,
                                  bookingDuration,
                                ).replace(" - ", " – ");
                              })()
                            : "N/A"}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 6px 6px 0px",
                          margin: "0",
                          width: "70px",
                        }}
                      >
                        <div
                          style={{
                            padding: "6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            width: "50px",
                            textAlign: "left",
                            fontSize: "12px",
                          }}
                        >
                          RM{Math.floor(booking.price)}
                        </div>
                      </TableCell>
                      <TableCell
                        style={{
                          border: "none",
                          padding: "6px 4px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "4px",
                            justifyContent: "center",
                          }}
                        >
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
                                setCurrentBookingId,
                                updateBookingInList,
                              );
                            }}
                            sx={{
                              color: "#1a1a1a",
                              fontSize: "12px",
                              minWidth: "60px",
                              textTransform: "none",
                              fontFamily: "Quicksand, sans-serif",
                              fontWeight: "bold",
                              backgroundColor: "transparent",
                              "&:hover": {
                                backgroundColor: "transparent",
                                textDecoration: "underline",
                              },
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            startIcon={<MdDelete />}
                            onClick={async () => {
                              console.log(
                                "🗑️ [MODAL DEBUG] Deleting booking:",
                                booking,
                              );

                              // For temporary bookings, just remove from modal
                              if (
                                booking.id &&
                                booking.id.toString().startsWith("temp-")
                              ) {
                                setModalBookings((prev) =>
                                  prev.filter(
                                    (b, idx) =>
                                      !(b.id === booking.id && idx === index),
                                  ),
                                );
                                if (typeof onDraftCancelled === "function") {
                                  onDraftCancelled(booking);
                                }
                                return;
                              }

                              // For real bookings, call API first
                              if (booking.id) {
                                try {
                                  const originalIndex = index;

                                  // Call the delete API directly using client
                                  const token = localStorage.getItem("token");
                                  if (!token) {
                                    console.error(
                                      "No token found for delete operation",
                                    );
                                    return;
                                  }

                                  // Import client
                                  const client = (
                                    await import("../../api/client")
                                  ).default;

                                  // Call delete API directly
                                  await client.delete(
                                    `/bookings/${booking.id}`,
                                    {
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    },
                                  );

                                  // Remove from modal bookings
                                  setModalBookings((prev) =>
                                    prev.filter(
                                      (b, idx) =>
                                        !(
                                          b.id === booking.id &&
                                          idx === originalIndex
                                        ),
                                    ),
                                  );

                                  // Show success message
                                  if (showSuccessMessage) {
                                    showSuccessMessage(
                                      "Booking deleted successfully!",
                                    );
                                  }

                                  console.log(
                                    "🗑️ [MODAL DEBUG] Successfully deleted booking:",
                                    booking.id,
                                  );
                                } catch (error) {
                                  console.error(
                                    "Error deleting booking:",
                                    error,
                                  );
                                  const errorMessage =
                                    "Failed to delete booking. Please try again.";
                                  if (showSuccessMessage) {
                                    showSuccessMessage(errorMessage);
                                  }
                                }
                              }
                            }}
                            sx={{
                              color: "#ff0000",
                              fontSize: "10px",
                              minWidth: "40px",
                            }}
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
                console.log(
                  "📝 [MODAL DEBUG] Adding new booking - keeping modal open",
                );
                // Create a new booking handler that keeps the modal open
                handleAddBookingInModal();
              }}
              sx={{
                backgroundColor: "#1a1a1a",
                color: "white",
                fontSize: "10px",
                padding: "4px 8px",
                minWidth: "auto",
                "&:hover": {
                  backgroundColor: "#333",
                },
              }}
            >
              Add Booking
            </Button>
          </div>

          {/* Right side summary and pay button */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                textAlign: "right",
                minWidth: "200px",
              }}
            >
              {/* Booking ID and Total Price */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    textAlign: "left",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <strong>
                      Booking ID{modalBookings.length > 1 ? "s" : ""}
                    </strong>
                  </div>
                  <div style={{ color: "#666", fontSize: "12px" }}>
                    {modalBookings.map((booking, index) => {
                      const id =
                        booking.id === "New Booking" ||
                        booking.id === "N/A" ||
                        booking.id.toString().startsWith("temp-")
                          ? "New Booking"
                          : String(booking.id).padStart(7, "0");
                      // Generate unique key that combines booking ID and index to avoid duplicates
                      const uniqueKey =
                        booking.id === "New Booking" ||
                        booking.id.toString().startsWith("temp-")
                          ? `new-booking-id-${index}-${booking.id}`
                          : `booking-id-${booking.id}-${index}`;
                      return (
                        <div
                          key={uniqueKey}
                          style={{
                            marginBottom:
                              index < modalBookings.length - 1 ? "2px" : "0",
                          }}
                        >
                          {id}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontSize: "12px",
                    marginLeft: "30px",
                  }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Price</strong>
                  </div>
                  <div style={{ color: "#666", fontSize: "12px" }}>
                    {modalBookings.map((booking, index) => {
                      // Generate unique key that combines booking ID and index to avoid duplicates
                      const uniqueKey =
                        booking.id === "New Booking" ||
                        booking.id.toString().startsWith("temp-")
                          ? `new-booking-price-${index}-${booking.id}`
                          : `booking-price-${booking.id}-${index}`;
                      return (
                        <div
                          key={uniqueKey}
                          style={{
                            marginBottom:
                              index < modalBookings.length - 1 ? "2px" : "0",
                          }}
                        >
                          RM{Math.floor(booking.price)}.00
                        </div>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      borderTop: "1px solid #ddd",
                      paddingTop: "4px",
                      marginTop: "4px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#1a1a1a",
                    }}
                  >
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
                      bookingIds: modalBookings
                        .map((b) => b.id)
                        .filter((id) => !id.toString().startsWith("temp-")),
                      customer_name: modalBookings[0]?.customer_name || "N/A",
                      payment_method: "Online Payment",
                      payment_status: "Pending",
                      isMultipleBookings: modalBookings.length > 1,
                    };

                    console.log(
                      "💳 [PAYMENT] Opening payment modal with combined data:",
                      combinedBookingData,
                    );

                    // Store the combined booking data temporarily for the payment process
                    window.combinedBookingData = combinedBookingData;

                    openPaymentMethodModal();
                  }}
                  disabled={
                    loading.paymentInit ||
                    !modalBookings.length ||
                    (modalBookings.length === 1 &&
                      modalBookings[0]?.payment_status === "Paid") ||
                    (modalBookings.length === 1 &&
                      modalBookings[0]?.payment_method === "Pay at Outlet")
                  }
                  sx={{
                    backgroundColor: "#1a1a1a",
                    color: "white",
                    fontSize: "10px",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    minWidth: "60px",
                    textTransform: "none",
                  }}
                >
                  {loading.paymentInit
                    ? "Initiating Payment..."
                    : modalBookings.length === 1 &&
                        modalBookings[0]?.payment_method === "Pay at Outlet"
                      ? "Paid at Outlet"
                      : "Pay"}
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
