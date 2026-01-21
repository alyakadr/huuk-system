import React, { useState } from "react";
import {
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  Fade,
  IconButton,
  LinearProgress,
} from "@mui/material";
import {
  Store,
  Security,
  CheckCircle,
  Close,
  Payment,
  AccountBalance,
} from "@mui/icons-material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import { handlePaymentMethodSelection } from "../../utils/bookingUtils";
import "../../styles/booking.css";

Modal.setAppElement("#root");

const PaymentModal = ({
  isOpen,
  onClose,
  paymentMethod,
  setPaymentMethod,
  bookingDetails,
  paymentError,
  setPaymentError,
  loading,
  setLoading,
  clientName,
  bookingId,
  initiatePaymentSession,
  handlePayAtOutlet,
  showSuccessMessage,
  scrollToSection,
  bookingHistoryRef,
  setClientSecret, // Added prop
  clientSecretRef, // Added prop
  setBookingDetails, // Added prop
  setIsPaymentMethodModalOpen, // Added prop
  setIsFPXModalOpen, // Added prop
  profile, // Added prop
  setIsConfirmationOpen, // Added prop
}) => {
  const [selectedMethod, setSelectedMethod] = useState(paymentMethod || "fpx");
  const [showDetails, setShowDetails] = useState(false);

  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "scale(1)" : "scale(0.95)",
    config: { tension: 200, friction: 25 },
  });

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setPaymentMethod(method);
    setShowDetails(true);
    setPaymentError("");
  };

  const handleConfirm = async () => {
    handlePaymentMethodSelection(
      selectedMethod,
      bookingId,
      clientName,
      setLoading,
      setPaymentError,
      () =>
        initiatePaymentSession(
          bookingId,
          setLoading,
          setPaymentError,
          setClientSecret,
          clientSecretRef,
          setBookingDetails,
          setIsPaymentMethodModalOpen,
          setIsFPXModalOpen,
          () => {}, // setBookings placeholder - PaymentModal doesn't have access to setBookings
          scrollToSection,
          bookingHistoryRef,
          showSuccessMessage,
          () => {} // showErrorMessage placeholder
        ),
      () =>
        handlePayAtOutlet(
          bookingId,
          profile,
          setLoading,
          setPaymentError,
          setBookingDetails,
          setIsPaymentMethodModalOpen,
          setClientSecret,
          clientSecretRef,
          setIsConfirmationOpen,
          () => {}, // setBookings placeholder - PaymentModal doesn't have access to setBookings
          scrollToSection,
          bookingHistoryRef,
          showSuccessMessage,
          () => {} // showErrorMessage placeholder
        ),
      showSuccessMessage
    );
  };

  const paymentOptions = [
    {
      id: "fpx",
      title: "Online Payment (FPX)",
      description: "Pay securely using your bank account",
      icon: <AccountBalance sx={{ fontSize: 28 }} />, 
      badges: ["Instant", "Secure"],
      details: [
        "Instant payment confirmation",
        "Secure bank-level encryption",
        "No card details required",
        "Direct bank account transfer",
      ],
    },
    {
      id: "outlet",
      title: "Pay at Outlet",
      description: "Pay in person when you arrive",
      icon: <Store sx={{ fontSize: 28 }} />, 
      badges: ["Flexible", "Cash/Card"],
      details: [
        "Pay on arrival at the outlet",
        "Accept cash or card payments",
        "No advance payment required",
        "Easy cancellation if needed",
      ],
    },
  ];

  const selectedOption = paymentOptions.find(option => option.id === selectedMethod);

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Payment Method Modal"
      className="enhanced-payment-modal"
      overlayClassName="enhanced-payment-overlay"
      onRequestClose={onClose}
    >
      <animated.div style={modalAnimation} className="enhanced-payment-modal-container">
        {/* Header */}
        <Box className="payment-modal-header">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment sx={{ color: '#baa173', fontSize: '1.2rem' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a1a1a', fontSize: '1.1rem' }}>
              Choose Payment Method
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#666', padding: '4px' }}>
            <Close sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Box>

        {/* Amount Display */}
        <Box className="payment-amount-section">
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
            RM{(() => {
              const combinedData = window.combinedBookingData;
              if (combinedData) {
                const count = Math.min(combinedData.bookings.length, 5);
                const total = combinedData.bookings.slice(0, 5).reduce((sum, b) => sum + (Number(b.price) || 0), 0);
                return total.toFixed(2);
              }
              return Math.floor(bookingDetails?.price || 150).toFixed(2);
            })()}
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mt: 0.5, fontSize: '0.85rem' }}>
            {(() => {
              const combinedData = window.combinedBookingData;
              if (combinedData && combinedData.isMultipleBookings) {
                return `Total for ${Math.min(combinedData.bookings.length, 5)} bookings`;
              }
              return "Total amount";
            })()}
          </Typography>
        </Box>

        {/* Payment Options */}
        <Box 
          className="payment-options-section"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '220px',
            width: '100%',
            maxWidth: 400,
            margin: '0 auto',
            gap: 2,
            mt: 3,
            mb: 3
          }}
        >
          {paymentOptions.map((option) => (
            <Card
              key={option.id}
              className={`payment-option-card ${selectedMethod === option.id ? 'selected' : ''}`}
              onClick={() => handleMethodSelect(option.id)}
              sx={{ cursor: 'pointer', mb: 2, width: '100%', boxShadow: selectedMethod === option.id ? 4 : 1 }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box className="payment-option-icon">
                    {option.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      {option.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                      {option.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {option.badges.map((badge, index) => (
                        <Chip
                          key={index}
                          label={badge}
                          size="small"
                          sx={{
                            backgroundColor: selectedMethod === option.id ? '#baa173' : '#f5f5f5',
                            color: selectedMethod === option.id ? '#fff' : '#666',
                            fontSize: '0.75rem',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  {selectedMethod === option.id && (
                    <CheckCircle sx={{ color: '#4caf50', fontSize: 28 }} />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Payment Details */}
        <Fade in={Boolean(showDetails && selectedOption)}>
          <Box className="payment-details-section">
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security sx={{ color: '#baa173', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {selectedOption?.title} Details
              </Typography>
            </Box>
            <Box sx={{ pl: 3 }}>
              {selectedOption?.details.map((detail, index) => (
                <Typography
                  key={index}
                  variant="body2"
                  sx={{ color: '#666', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CheckCircle sx={{ fontSize: 16, color: '#4caf50' }} />
                  {detail}
                </Typography>
              ))}
            </Box>
          </Box>
        </Fade>

        {/* Error Display */}
        {paymentError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {paymentError}
          </Alert>
        )}

        {/* Loading Progress */}
        {(loading.payment || loading.paymentInit) && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress 
              sx={{ 
                backgroundColor: '#f5f5f5',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#baa173'
                }
              }} 
            />
            <Typography variant="body2" sx={{ color: '#666', mt: 1, textAlign: 'center' }}>
              Processing your payment method...
            </Typography>
          </Box>
        )}

        {/* Action Buttons */}
        <Box className="payment-actions-section">
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{
              borderColor: '#ccc',
              color: '#666',
              '&:hover': {
                borderColor: '#baa173',
                backgroundColor: 'rgba(186, 161, 115, 0.1)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={loading.payment || loading.paymentInit || !selectedMethod}
            sx={{
              backgroundColor: '#1a1a1a',
              color: '#baa173',
              minWidth: 120,
              '&:hover': {
                backgroundColor: '#333'
              },
              '&:disabled': {
                backgroundColor: '#ccc',
                color: '#999'
              }
            }}
          >
            {loading.payment || loading.paymentInit ? (
              <>
                <Box 
                  sx={{ 
                    width: 16, 
                    height: 16, 
                    border: '2px solid #baa173', 
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    mr: 1
                  }} 
                />
                Processing...
              </>
            ) : (
              "Confirm Payment"
            )}
          </Button>
        </Box>
      </animated.div>
    </Modal>
  );
};

export default PaymentModal;
