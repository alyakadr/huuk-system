import React from "react";
import { Typography, LinearProgress } from "@mui/material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import { Elements } from "@stripe/react-stripe-js";
import PaymentForm from "./PaymentForm";
import { stripePromise } from "../../utils/constants";
import "../../styles/booking.css";

Modal.setAppElement("#root");

const FPXModal = ({
  isOpen,
  onClose,
  clientSecret,
  clientName,
  bookingId,
  paymentError,
  setPaymentError,
  loading,
  setLoading,
  setBookingDetails,
  setIsConfirmationOpen,
  showSuccessMessage,
  showErrorMessage, // Added prop
  scrollToSection, // Updated from navigate to scrollToSection
  bookingHistoryRef, // Added prop
}) => {
  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "scale(1)" : "scale(0.95)",
    config: { tension: 150, friction: 20 },
  });

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="FPX Payment Modal"
      className="fpx-modal"
      overlayClassName="cust-overlay"
      onRequestClose={onClose}
    >
      <animated.div style={modalAnimation} className="fpx-modal-container">
        <div className="fpx-modal-content">
          {/* Enhanced Header */}
          <div className="fpx-header">
            <h2 style={{ textAlign: "center", marginBottom: "8px" }}>
              Online Payment (FPX)
            </h2>
            <Typography variant="subtitle2" style={{ textAlign: "center", color: '#666', fontSize: '0.85rem' }}>
              Secure • Instant • Encrypted
            </Typography>
          </div>
          {/* Payment Form or Loading */}
          <div className="fpx-body">
            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "flat",
                    variables: {
                      colorPrimary: "#1a1a1a",
                      colorText: "#333333",
                      fontFamily: '"Quicksand", sans-serif',
                      spacingUnit: "4px",
                      borderRadius: "5px",
                      colorBackground: "#f5f5f5",
                      colorTextPlaceholder: "#888888"
                    },
                  },
                }}
              >
                <PaymentForm
                  clientName={clientName}
                  bookingId={bookingId}
                  paymentError={paymentError}
                  setPaymentError={setPaymentError}
                  loading={loading}
                  setLoading={setLoading}
                  setIsConfirmationOpen={setIsConfirmationOpen}
                  setBookingDetails={setBookingDetails}
                  showSuccessMessage={showSuccessMessage}
                  showErrorMessage={showErrorMessage} // Pass showErrorMessage
                  scrollToSection={scrollToSection} // Pass scrollToSection
                  bookingHistoryRef={bookingHistoryRef} // Pass bookingHistoryRef
                />
              </Elements>
            )}
            {!clientSecret && (
              <div className="loading-section">
                <Typography>Loading FPX payment form...</Typography>
                <LinearProgress style={{ marginTop: "15px" }} />
              </div>
            )}
          </div>
          <div className="fpx-info" style={{ marginTop: "20px" }}>
            <Typography variant="body2" style={{ color: '#666' }}>
              By proceeding, you agree to our terms and conditions and confirm that all payment details entered are correct.
            </Typography>
          </div>
          <button className="fpx-close-btn" onClick={onClose}>
            x
          </button>
        </div>
      </animated.div>
    </Modal>
  );
};

export default FPXModal;
