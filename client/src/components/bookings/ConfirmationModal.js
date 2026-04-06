import React from "react";
import {
  Typography,
  Button,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import {
  formatBookingTimeRange,
  resolveBookingDuration,
} from "../../utils/bookingDisplay";

Modal.setAppElement("#root");

const ConfirmationModal = ({
  isOpen,
  onClose,
  bookingDetails,
  paymentMethod,
  setPaymentMethod,
  paymentError,
  setPaymentError,
  loading,
  setLoading,
  initiatePaymentSession,
  handlePayAtOutlet,
  handleDownloadReceipt,
  serviceDuration,
  outlets,
  staff,
  services,
  setActiveStep,
  setSelectedDate,
  setOutletId,
  setStaffId,
  setServiceId,
  setTime,
  setClientName,
  setIsConfirmationOpen,
  scrollToSection,
  bookingHistoryRef,
  setClientSecret,
  clientSecretRef,
  setBookingDetails,
  setIsPaymentMethodModalOpen,
  setIsFPXModalOpen,
  setBookings,
  profile,
  showSuccessMessage,
  showErrorMessage,
}) => {
  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0.7,
    transform: isOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  const bookingDuration = resolveBookingDuration(
    bookingDetails,
    services,
    serviceDuration,
  );

  // Transform payment_method for display
  const displayedPaymentMethod = ["Stripe", "FPX"].includes(
    bookingDetails?.payment_method,
  )
    ? "Online Payment"
    : bookingDetails?.payment_method;

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Booking Confirmation Modal"
      className="confirmation-modal"
      overlayClassName="cust-overlay"
      onRequestClose={onClose}
    >
      <animated.div
        style={modalAnimation}
        className="confirmation-modal-container"
      >
        <div className="confirmation-left-section">
          <h2 className="confirmation-h2">BOOKING</h2>
          <h2 className="confirmation-h2">CONFIRMED!</h2>
          <p className="confirmation-subheading">Select your payment method</p>
        </div>
        <div className="confirmation-right-section">
          <h2 className="confirmation-heading">Booking Details</h2>
          {bookingDetails ? (
            <Box sx={{ mb: 2, fontFamily: '"Quicksand", sans-serif' }}>
              <Typography>
                <strong>Booking ID:</strong> {bookingDetails.id}
              </Typography>
              <Typography>
                <strong>Outlet:</strong> {bookingDetails.outlet}
              </Typography>
              <Typography>
                <strong>Service:</strong> {bookingDetails.service}
              </Typography>
              <Typography>
                <strong>Date:</strong>{" "}
                {new Date(bookingDetails.date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </Typography>
              <Typography>
                <strong>Time:</strong>{" "}
                {formatBookingTimeRange(bookingDetails.time, bookingDuration)}
              </Typography>
              <Typography>
                <strong>Duration:</strong> {bookingDuration} min
              </Typography>
              <Typography>
                <strong>Client:</strong> {bookingDetails.customer_name}
              </Typography>
              <Typography>
                <strong>Barber:</strong> {bookingDetails.staff_name}
              </Typography>
              <Typography>
                <strong>Price:</strong> MYR{" "}
                {Math.floor(Number(bookingDetails.price || 0))}
              </Typography>
              {bookingDetails.payment_method && (
                <>
                  <Typography>
                    <strong>Payment Method:</strong> {displayedPaymentMethod}
                  </Typography>
                  <Typography>
                    <strong>Status:</strong> {bookingDetails.payment_status}
                  </Typography>
                </>
              )}
            </Box>
          ) : (
            <Typography color="error">Booking details not available</Typography>
          )}
          {paymentError && (
            <Typography color="error" sx={{ mb: 2 }}>
              {paymentError}
            </Typography>
          )}
          {!bookingDetails?.payment_method && (
            <>
              <RadioGroup
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPaymentError("");
                }}
                sx={{ mb: 2 }}
              >
                <FormControlLabel
                  value="card"
                  control={<Radio />}
                  label="Online Payment"
                />
                <FormControlLabel
                  value="outlet"
                  control={<Radio />}
                  label="Pay at Outlet"
                />
              </RadioGroup>
              {paymentMethod === "card" && (
                <Button
                  variant="contained"
                  onClick={() => {
                    setBookingDetails((prev) => ({
                      ...prev,
                      payment_method: "Online Payment",
                      payment_status: "Pending",
                    }));
                    setClientSecret("");
                    clientSecretRef.current = null;
                    setIsFPXModalOpen(false);
                    showSuccessMessage?.(
                      "Online payment selected (demo mode).",
                    );
                  }}
                  disabled={loading.paymentInit}
                  sx={{
                    backgroundColor: "#1a1a1a",
                    color: "#baa173",
                    mt: 2,
                  }}
                >
                  {loading.paymentInit
                    ? "Processing..."
                    : "Confirm Online Payment"}
                </Button>
              )}
              {paymentMethod === "outlet" && (
                <Button
                  variant="contained"
                  onClick={() => {
                    handlePayAtOutlet(
                      bookingDetails?.id,
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
                    );
                  }}
                  disabled={loading.payment}
                  sx={{
                    backgroundColor: "#1a1a1a",
                    color: "#baa173",
                    mt: 2,
                  }}
                >
                  {loading.payment ? "Processing..." : "Confirm Pay at Outlet"}
                </Button>
              )}
            </>
          )}
          {bookingDetails?.payment_method && (
            <Button
              variant="contained"
              onClick={handleDownloadReceipt}
              sx={{ backgroundColor: "#1a1a1a", color: "#baa173", mt: 2 }}
            >
              Download Receipt
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => {
              setIsConfirmationOpen(false);
              setActiveStep(0);
              setSelectedDate(new Date(bookingDetails.date));
              setOutletId(
                Array.isArray(outlets)
                  ? outlets.find((o) => o.shortform === bookingDetails.outlet)
                      ?.id || ""
                  : "",
              );
              setStaffId(
                Array.isArray(staff)
                  ? staff.find((s) => s.username === bookingDetails.staff_name)
                      ?.id || ""
                  : "",
              );
              setServiceId(
                Array.isArray(services)
                  ? services.find((s) => s.name === bookingDetails.service)
                      ?.id || ""
                  : "",
              );
              setTime(bookingDetails.time);
              setClientName(bookingDetails.customer_name);
            }}
            sx={{ backgroundColor: "#1a1a1a", color: "#baa173", mt: 2, ml: 1 }}
          >
            Edit
          </Button>
        </div>
        <button className="confirmation-close-btn" onClick={onClose}>
          x
        </button>
      </animated.div>
    </Modal>
  );
};

export default ConfirmationModal;
