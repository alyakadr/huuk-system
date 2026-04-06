import React, { useEffect, useRef, memo } from "react";
import { Typography, Button, Box } from "@mui/material";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import client, {
  updatePaymentStatus,
  checkPaymentStatusBySession,
} from "../../api/client";
import { debugLog } from "../../utils/debugLog";

const PaymentForm = memo(
  ({
    clientName,
    bookingId,
    paymentError,
    setPaymentError,
    loading,
    setLoading,
    setIsConfirmationOpen,
    setBookingDetails,
    setIsFPXModalOpen,
    showSuccessMessage,
    showErrorMessage,
    scrollToSection,
    bookingHistoryRef,
  }) => {
    const stripe = useStripe();
    const elements = useElements();
    const paymentElementMounted = useRef(false);

    useEffect(() => {
      debugLog("PaymentForm mounted for booking:", bookingId);
      paymentElementMounted.current = true;
      return () => {
        debugLog("PaymentForm unmounted");
        paymentElementMounted.current = false;
      };
    }, [bookingId]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!stripe || !elements) {
        setPaymentError("Stripe has not loaded. Please try again.");
        console.error("Stripe or elements not loaded for booking:", bookingId);
        return;
      }
      if (!paymentElementMounted.current) {
        setPaymentError("Payment form is not ready. Please try again.");
        console.error("PaymentElement not mounted for booking:", bookingId);
        return;
      }

      // Handle multiple bookings scenario
      const combinedData = window.combinedBookingData;
      let actualBookingIds = bookingId;

      if (combinedData && combinedData.isMultipleBookings) {
        debugLog(
          "[PAYMENT FORM] Processing multiple bookings payment:",
          combinedData,
        );
        actualBookingIds = combinedData.bookingIds.slice(0, 5);

        // Validate that all bookings have valid IDs
        if (
          !actualBookingIds.length ||
          actualBookingIds.some(
            (id) => !id || id.toString().startsWith("temp-"),
          )
        ) {
          setPaymentError(
            "Some bookings are not yet confirmed. Please ensure all bookings are saved before payment.",
          );
          console.error(
            "Invalid booking IDs for multiple payment:",
            actualBookingIds,
          );
          return;
        }
      }

      // Validate booking ID format
      if (
        !bookingId ||
        (typeof bookingId === "string" && bookingId.startsWith("temp-"))
      ) {
        setPaymentError("Invalid booking ID. Please refresh and try again.");
        console.error("Invalid booking ID for payment:", bookingId);
        return;
      }
      setLoading((prev) => ({ ...prev, payment: true }));
      setPaymentError("");
      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.href,
            payment_method_data: {
              billing_details: { name: clientName },
            },
          },
          redirect: "if_required",
        });
        if (error) {
          console.error("Stripe payment error:", {
            message: error.message,
            code: error.code,
            bookingId,
            timestamp: new Date().toISOString(),
          });
          const errorMessages = {
            card_declined: "Your card was declined. Please try another card.",
            expired_card: "Your card has expired. Please use a valid card.",
            incorrect_cvc:
              "The CVC code is incorrect. Please check and try again.",
            insufficient_funds: "Insufficient funds in your account.",
          };
          throw new Error(errorMessages[error.code] || error.message);
        }
        debugLog("Payment succeeded:", {
          paymentIntentId: paymentIntent.id,
          bookingId,
          timestamp: new Date().toISOString(),
        });
        const paymentIntentId = paymentIntent.id;
        // Immediately update payment status in database after successful payment
        debugLog(`Updating payment status to Paid for booking ${bookingId}`);
        let statusUpdated = false;

        try {
          // Handle multiple bookings or single booking payment status update
          const combinedData = window.combinedBookingData;
          if (
            combinedData &&
            combinedData.isMultipleBookings &&
            combinedData.bookingIds.length > 1
          ) {
            // Use the new multiple booking update API
            const { updateMultipleBookingsPaymentStatus } =
              await import("../../api/client");
            await updateMultipleBookingsPaymentStatus(
              combinedData.bookingIds,
              "Paid",
            );
            debugLog(
              `Successfully updated payment status to Paid for multiple bookings:`,
              combinedData.bookingIds,
            );
          } else {
            await updatePaymentStatus(bookingId, "Paid");
            debugLog(
              `Successfully updated payment status to Paid for booking ${bookingId}`,
            );
          }
          statusUpdated = true;
        } catch (updateErr) {
          console.error("Failed to update payment status immediately:", {
            message: updateErr.message,
            response: updateErr.response?.data,
            status: updateErr.response?.status,
            bookingId,
            timestamp: new Date().toISOString(),
          });
        }

        // If immediate update failed, retry with payment intent check
        if (!statusUpdated) {
          debugLog("Retrying payment status update using payment intent check");
          let attempts = 0;
          const maxAttempts = 8;
          const interval = 2000;
          let booking;

          while (attempts < maxAttempts && !statusUpdated) {
            debugLog(
              `Checking payment status for booking ${bookingId}, paymentIntent ${paymentIntentId}, attempt ${
                attempts + 1
              }`,
            );
            try {
              const response =
                await checkPaymentStatusBySession(paymentIntentId);
              debugLog("Payment status response:", {
                data: response.data,
                bookingId,
                paymentIntentId,
                timestamp: new Date().toISOString(),
              });
              booking = response.data;
              if (booking && booking.payment_status === "Paid") {
                statusUpdated = true;
                break;
              }
            } catch (err) {
              console.error(`Attempt ${attempts + 1} failed:`, {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
                bookingId,
                paymentIntentId,
                timestamp: new Date().toISOString(),
              });
            }
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, interval));
            }
          }
        }

        // If all attempts failed, still proceed with UI update as payment was successful on Stripe
        if (!statusUpdated) {
          console.warn(
            "Payment status update failed after all attempts, but payment was successful on Stripe. Proceeding with UI update for booking:",
            bookingId,
          );
          statusUpdated = true;
        }
        if (statusUpdated) {
          // Finalize booking(s) after payment
          const token =
            localStorage.getItem("customer_token") ||
            localStorage.getItem("token");
          if (
            combinedData &&
            combinedData.isMultipleBookings &&
            Array.isArray(actualBookingIds)
          ) {
            for (const id of actualBookingIds) {
              try {
                await client.post(
                  `/bookings/finalize/${id}`,
                  {},
                  { headers: { Authorization: `Bearer ${token}` } },
                );
                debugLog(`Finalized booking ${id}`);
              } catch (err) {
                console.error(`Failed to finalize booking ${id}:`, err);
              }
            }
          } else if (bookingId) {
            try {
              await client.post(
                `/bookings/finalize/${bookingId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } },
              );
              debugLog(`Finalized booking ${bookingId}`);
            } catch (err) {
              console.error(`Failed to finalize booking ${bookingId}:`, err);
            }
          }
          debugLog(`Updating UI for booking ${bookingId} to Paid`);
          setBookingDetails((prev) => ({
            ...prev,
            payment_method: "Online Payment",
            payment_status: "Paid",
          }));
          setIsFPXModalOpen(false);
          if (showSuccessMessage) {
            showSuccessMessage(
              "Payment successful! Your booking has been confirmed.",
            );
          }
          setTimeout(() => {
            debugLog("Scrolling to MY HISTORY section for booking:", bookingId);
            if (bookingHistoryRef && bookingHistoryRef.current) {
              scrollToSection(bookingHistoryRef);
            }
          }, 2000);

          // Trigger a refresh of booking history by dispatching a custom event
          setTimeout(() => {
            debugLog("Triggering booking history refresh after payment");
            window.dispatchEvent(
              new CustomEvent("refreshBookingHistory", {
                detail: { bookingId, paymentStatus: "Paid" },
              }),
            );
          }, 1000);
        } else {
          throw new Error(
            "Payment status not updated to Paid. Please contact support.",
          );
        }
      } catch (err) {
        console.error("Payment error:", {
          message: err.message,
          stack: err.stack,
          code: err.code,
          bookingId,
          timestamp: new Date().toISOString(),
        });
        const errorMessage = err.message || "Payment failed. Please try again.";
        setPaymentError(errorMessage);
        if (showErrorMessage) {
          showErrorMessage(errorMessage);
        }
      } finally {
        setLoading((prev) => ({ ...prev, payment: false }));
      }
    };

    if (!stripe || !elements) {
      return <Typography>Loading payment form...</Typography>;
    }

    return (
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        {/* Compact Info Bar */}
        <Box
          sx={{
            mb: 1.5,
            p: 1,
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: "32px",
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: "#baa173",
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: "#666",
              fontFamily: "Quicksand, sans-serif",
              fontSize: "0.8rem",
              fontWeight: 500,
            }}
          >
            {(() => {
              const combinedData = window.combinedBookingData;
              if (combinedData && combinedData.isMultipleBookings) {
                const count = Math.min(combinedData.bookingIds.length, 5);
                const total = combinedData.bookings
                  .slice(0, 5)
                  .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
                return `${count} Bookings • RM${total.toFixed(2)} • ${clientName}`;
              }
              return `ID: ${bookingId} • ${clientName}`;
            })()}
          </Typography>
        </Box>

        {/* Compact Payment Element */}
        <Box
          sx={{
            mb: 1.5,
            p: 1,
            border: "1px solid #e9ecef",
            borderRadius: "8px",
            backgroundColor: "#fff",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              mb: 1,
              color: "#333",
              fontFamily: "Quicksand, sans-serif",
              fontWeight: 600,
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: "4px",
                backgroundColor: "#baa173",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "2px",
                  backgroundColor: "white",
                }}
              />
            </Box>
            Payment Method
          </Typography>
          <PaymentElement
            options={{
              layout: "tabs",
              fields: {
                billingDetails: {
                  name: "auto",
                },
              },
              paymentMethodOrder: ["fpx", "card"],
            }}
            onReady={() =>
              debugLog("PaymentElement ready for booking:", bookingId)
            }
            onLoadError={(error) =>
              setPaymentError(
                `Failed to load payment form: ${error.error.message}`,
              )
            }
          />
        </Box>

        {/* Compact Security Badge */}
        <Box
          sx={{
            mb: 1,
            p: 0.8,
            backgroundColor: "#e8f5e8",
            borderRadius: "6px",
            border: "1px solid #c3e6c3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
          }}
        >
          <Box sx={{ fontSize: "0.75rem" }}>🔒</Box>
          <Typography
            variant="body2"
            sx={{
              color: "#2e7d32",
              fontFamily: "Quicksand, sans-serif",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            Bank-level encryption
          </Typography>
        </Box>

        {/* Compact Error Display */}
        {paymentError && (
          <Box
            sx={{
              mb: 1,
              p: 1,
              backgroundColor: "#ffebee",
              borderRadius: "6px",
              border: "1px solid #ffcdd2",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                backgroundColor: "#f44336",
              }}
            />
            <Typography
              color="error"
              sx={{
                fontFamily: "Quicksand, sans-serif",
                fontSize: "0.8rem",
                fontWeight: 500,
              }}
            >
              {paymentError}
            </Typography>
          </Box>
        )}

        {/* Compact Payment Button */}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={
            loading.payment ||
            !stripe ||
            !elements ||
            !paymentElementMounted.current
          }
          sx={{
            backgroundColor: "#1a1a1a",
            color: "#baa173",
            py: 1,
            fontFamily: "Quicksand, sans-serif",
            fontWeight: 600,
            fontSize: "0.9rem",
            borderRadius: "8px",
            height: "40px",
            textTransform: "none",
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "#333",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            },
            "&:disabled": {
              backgroundColor: "#ccc",
              color: "#888",
            },
          }}
        >
          {loading.payment ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  border: "2px solid #baa173",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing...
            </Box>
          ) : (
            "Complete Payment"
          )}
        </Button>
      </form>
    );
  },
);

export default PaymentForm;
