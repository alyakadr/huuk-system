import React, { useState, useEffect } from "react";
import {
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Chip,
  Alert,
  IconButton,
  LinearProgress,
} from "@mui/material";
import {
  Store,
  CheckCircle,
  Close,
  Payment,
  AccountBalance,
} from "@mui/icons-material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import { verifyAuthentication } from "../../utils/bookingUtils";
import { getUserData, getAuthToken } from "../../utils/tokenUtils";

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
  const [authStatus, setAuthStatus] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Check authentication status when modal opens
  useEffect(() => {
    if (isOpen) {
      const auth = verifyAuthentication();
      setAuthStatus(auth);
      setPaymentError("");

      // Get user role from userData
      const userData = auth.userData || {};
      setUserRole(userData.role || "customer"); // Default to customer if no role found

      // If not authenticated, set an error
      if (!auth.isAuthenticated) {
        setPaymentError(
          "You need to be logged in to make a payment. Please sign in and try again.",
        );
      }
    }
  }, [isOpen, setPaymentError]);

  // Debug log to check profile prop
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("📋 [PAYMENT MODAL] Profile prop received:", {
        exists: !!profile,
        id: profile?.id,
        email: profile?.email,
        phone: profile?.phone_number,
        role: profile?.role || "unknown",
      });
    }
  }, [profile]);

  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "scale(1)" : "scale(0.95)",
    config: { tension: 200, friction: 25 },
  });

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setPaymentMethod(method);
    setPaymentError("");
  };

  const handleConfirm = async () => {
    // Check authentication first
    const auth = verifyAuthentication();
    setAuthStatus(auth);

    if (!auth.isAuthenticated) {
      setPaymentError(
        "You need to be logged in to make a payment. Please sign in and try again.",
      );
      return;
    }

    // Get user role from userData
    const userData = auth.userData || {};
    const role = userData.role || "customer";
    setUserRole(role);

    // Validate bookingId is available
    if (!bookingId) {
      setPaymentError(
        "Booking ID is missing. Please refresh the page and try again.",
      );
      return;
    }

    // Ensure token is available
    const token = getAuthToken();
    if (!token) {
      setPaymentError("Authentication token is missing. Please sign in again.");
      return;
    }

    // Get user data directly from localStorage
    const localUserData = getUserData();

    // Debug logs only in development
    if (process.env.NODE_ENV !== "production") {
      console.log("🔐 [PAYMENT MODAL] User data from localStorage:", {
        exists: !!localUserData,
        id: localUserData?.id,
        email: localUserData?.email,
        phone: localUserData?.phone_number,
        role: localUserData?.role || "unknown",
        token: token ? "present" : "missing",
      });
    }

    // Use either the profile prop or userData from localStorage
    const effectiveProfile = profile || localUserData;

    if (!effectiveProfile || !effectiveProfile.id) {
      setPaymentError(
        "User profile information is missing. Please sign in again.",
      );
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("🔐 [PAYMENT MODAL] Using profile data:", {
        source: profile ? "profile prop" : "localStorage userData",
        id: effectiveProfile?.id,
        email: effectiveProfile?.email,
        phone: effectiveProfile?.phone_number,
        role: effectiveProfile?.role || "unknown",
      });
    }

    // Check if the token is valid by looking at token expiry if it exists
    try {
      const tokenData = token.split(".")[1];
      if (tokenData) {
        const decodedToken = JSON.parse(atob(tokenData));
        const currentTime = Math.floor(Date.now() / 1000);

        if (decodedToken.exp && decodedToken.exp < currentTime) {
          // Token is expired
          setPaymentError("Your session has expired. Please sign in again.");
          localStorage.removeItem("token");
          localStorage.removeItem("loggedInUser");
          return;
        }
      }
    } catch (error) {
      console.error("Error parsing token:", error);
      // Continue anyway - not all tokens might have this structure
    }

    // Create a modified profile with role information for the payment handlers
    const profileWithRole = {
      ...effectiveProfile,
      role: role, // Ensure role is passed to payment handlers
      isStaff: role === "staff" || role === "manager" || role === "admin",
    };

    if (selectedMethod === "fpx") {
      setBookingDetails((prev) => ({
        ...prev,
        payment_method: "Online Payment",
        payment_status: "Pending",
      }));

      if (window.combinedBookingData) {
        window.combinedBookingData = {
          ...window.combinedBookingData,
          payment_method: "Online Payment",
          payment_status: "Pending",
        };
      }

      setIsPaymentMethodModalOpen(false);
      setIsFPXModalOpen(false);
      setClientSecret("");
      clientSecretRef.current = null;
      setIsConfirmationOpen(true);
      showSuccessMessage?.("Online payment selected (demo mode).");
      return;
    }

    handlePayAtOutlet(
      bookingId,
      profileWithRole,
      setLoading,
      setPaymentError,
      setBookingDetails,
      setIsPaymentMethodModalOpen,
      setClientSecret,
      clientSecretRef,
      setIsConfirmationOpen,
      () => {},
      scrollToSection,
      bookingHistoryRef,
      showSuccessMessage,
      setPaymentError,
    );
  };

  const paymentOptions = [
    {
      id: "fpx",
      title: "Online Payment",
      description: "Demo mode for frontend showcase",
      icon: <AccountBalance sx={{ fontSize: 28 }} />,
      badges: ["Demo", "Showcase"],
      details: [
        "No real gateway integration",
        "UI-only payment selection",
        "Useful for product demos",
        "Can be wired to real provider later",
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

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Payment Method Modal"
      className="enhanced-payment-modal"
      overlayClassName="enhanced-payment-overlay"
      onRequestClose={onClose}
    >
      <animated.div
        style={modalAnimation}
        className="enhanced-payment-modal-container"
      >
        {/* Header */}
        <Box className="payment-modal-header">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Payment sx={{ color: "#baa173", fontSize: "1.2rem" }} />
            <Typography
              variant="h6"
              sx={{ fontWeight: "bold", color: "#1a1a1a", fontSize: "1.1rem" }}
            >
              Choose Payment Method
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: "#666", padding: "4px" }}>
            <Close sx={{ fontSize: "1.2rem" }} />
          </IconButton>
        </Box>

        {/* Authentication Status Alert */}
        {authStatus && !authStatus.isAuthenticated && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You need to be logged in to complete payment. Please sign in.
          </Alert>
        )}

        {/* Staff Role Alert */}
        {userRole &&
          (userRole === "staff" ||
            userRole === "manager" ||
            userRole === "admin") && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You are logged in as staff. You can process payments on behalf of
              customers.
            </Alert>
          )}

        {/* Amount Display */}
        <Box className="payment-amount-section">
          <Typography
            variant="h5"
            sx={{ fontWeight: "bold", color: "#1a1a1a" }}
          >
            RM
            {(() => {
              const combinedData = window.combinedBookingData;
              if (combinedData) {
                const count = Math.min(combinedData.bookings.length, 5);
                const total = combinedData.bookings
                  .slice(0, 5)
                  .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
                return total.toFixed(2);
              }
              return Math.floor(bookingDetails?.price || 150).toFixed(2);
            })()}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "#666", mt: 0.5, fontSize: "0.85rem" }}
          >
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
        <Box className="payment-options-section">
          {paymentOptions.map((option) => (
            <Card
              key={option.id}
              className={`payment-option-card ${selectedMethod === option.id ? "selected" : ""}`}
              onClick={() => handleMethodSelect(option.id)}
              sx={{
                cursor: "pointer",
                width: "100%",
                boxShadow: selectedMethod === option.id ? 4 : 1,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box className="payment-option-icon">{option.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: "bold", mb: 0.5 }}
                    >
                      {option.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                      {option.description}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      {option.badges.map((badge, index) => (
                        <Chip
                          key={index}
                          label={badge}
                          size="small"
                          sx={{
                            backgroundColor:
                              selectedMethod === option.id
                                ? "#baa173"
                                : "#f5f5f5",
                            color:
                              selectedMethod === option.id ? "#fff" : "#666",
                            fontSize: "0.75rem",
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  {selectedMethod === option.id && (
                    <CheckCircle sx={{ color: "#4caf50", fontSize: 28 }} />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

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
                backgroundColor: "#f5f5f5",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "#baa173",
                },
              }}
            />
            <Typography
              variant="body2"
              sx={{ color: "#666", mt: 1, textAlign: "center" }}
            >
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
              borderColor: "#ccc",
              color: "#666",
              "&:hover": {
                borderColor: "#baa173",
                backgroundColor: "rgba(186, 161, 115, 0.1)",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={
              loading.payment ||
              loading.paymentInit ||
              !selectedMethod ||
              (authStatus && !authStatus.isAuthenticated)
            }
            sx={{
              backgroundColor: "#1a1a1a",
              color: "#baa173",
              minWidth: 120,
              "&:hover": {
                backgroundColor: "#333",
              },
              "&:disabled": {
                backgroundColor: "#ccc",
                color: "#999",
              },
            }}
          >
            {loading.payment || loading.paymentInit ? (
              <>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    border: "2px solid #baa173",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    mr: 1,
                  }}
                />
                Processing...
              </>
            ) : (
              "Confirm Method"
            )}
          </Button>
        </Box>
      </animated.div>
    </Modal>
  );
};

export default PaymentModal;
