import React, { useEffect } from "react";
import { Typography, Button, TextField } from "@mui/material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import { MdPhone, MdLock } from "react-icons/md";
import "../../styles/booking.css";

Modal.setAppElement("#root");

const SignInModal = ({
  isOpen,
  onClose,
  signInPhone,
  setSignInPhone,
  signInPassword,
  setSignInPassword,
  handleSignIn,
  errors = { phone: "", password: "" }, // Changed from email to phone
  setSignInErrors = () => {},
  loading,
  navigate,
  profile = {},
}) => {
  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0.7,
    transform: isOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  // Reset loading state on unmount to prevent stuck loading
  useEffect(() => {
    return () => {
      setSignInErrors({ phoneNumber: "", password: "" });
      setSignInPhone("");
      setSignInPassword("");
    };
  }, [setSignInErrors, setSignInPhone, setSignInPassword]);

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Sign In Modal"
      className="sign-in-modal"
      overlayClassName="cust-overlay"
      onRequestClose={onClose}
    >
      <animated.div style={modalAnimation} className="sign-in-modal-container">
        <div className="sign-in-left-section">
          <h2 className="sign-in-h2">WELCOME</h2>
          <h2 className="sign-in-h2">BACK!</h2>
          <p className="sign-in-subheading">Log in to your existing account</p>
          <p>
            <span className="sign-in-no-account">Don't have an account? </span>
            <span
              onClick={() => navigate("/homepage?loginRequired=true")}
              className="sign-in-sign-up-text"
            >
              Sign Up
            </span>
          </p>
        </div>
        <div className="sign-in-right-section">
          <h2 className="sign-in-heading">Sign In</h2>
          {loading.signIn && <Typography>Signing in...</Typography>}
          <form onSubmit={handleSignIn} className="sign-in-form">
            <TextField
              label="Phone Number"
              type="tel"
              value={signInPhone}
              onChange={(e) => {
                setSignInPhone(e.target.value);
                setSignInErrors((prev) => ({ ...prev, phone: "" }));
              }}
              fullWidth
              required
              disabled={loading.signIn}
              error={!!errors.phone}
              helperText={errors.phone}
              InputProps={{
                startAdornment: (
                  <MdPhone
                    style={{
                      color: errors.phone ? "red" : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={signInPassword}
              onChange={(e) => {
                setSignInPassword(e.target.value);
                setSignInErrors((prev) => ({ ...prev, password: "" }));
              }}
              fullWidth
              required
              disabled={loading.signIn}
              error={!!errors.password}
              helperText={errors.password}
              InputProps={{
                startAdornment: (
                  <MdLock
                    style={{
                      color: errors.password ? "red" : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              className="sign-in-btn"
              disabled={loading.signIn}
              sx={{ backgroundColor: "#1a1a1a", color: "#baa173", mt: 2 }}
            >
              {loading.signIn ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>
        <button className="sign-in-close-btn" onClick={onClose}>
          x
        </button>
      </animated.div>
    </Modal>
  );
};

export default SignInModal;
