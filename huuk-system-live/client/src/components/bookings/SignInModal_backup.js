import React, { useEffect, useState } from "react";
import { Typography, Button, TextField, IconButton, InputAdornment } from "@mui/material";
import Modal from "react-modal";
import { MdPhone, MdLock, MdClose, MdVisibility, MdVisibilityOff } from "react-icons/md";
import "../../styles/booking.css";
import "../../styles/customerHomepage.css";
import "../../styles/enhancedModals.css";
import modalImage from "../../assets/modalcust1.jpg";

Modal.setAppElement("#root");

const SignInModal = ({
  isOpen,
  onClose,
  signInPhoneNumber,
  setSignInPhoneNumber,
  signInPassword,
  setSignInPassword,
  handleSignIn,
  errors = { phoneNumber: "", password: "" }, // Default to prevent undefined errors
  setSignInErrors = () => {}, // Default to no-op function
  loading,
  navigate,
  profile = {}, // Default to empty object to prevent undefined errors
}) => {
  // Debug logging
  console.log("SignInModal render - isOpen:", isOpen);
  console.log("SignInModal render - errors:", errors);
  console.log("SignInModal render - loading:", loading);
  console.log("SignInModal render - phoneNumber:", signInPhoneNumber);
  console.log("SignInModal render - password:", signInPassword ? "[PRESENT]" : "[EMPTY]");
  
  if (isOpen) {
    console.log("🔴 MODAL IS OPEN - Should be visible!");
  } else {
    console.log("⚪ MODAL IS CLOSED");
  }
  const [showPassword, setShowPassword] = useState(false);
  

  // Reset loading state on unmount to prevent stuck loading
  useEffect(() => {
    return () => {
      setSignInErrors({ phoneNumber: "", password: "" });
      setSignInPhoneNumber("");
      setSignInPassword("");
      setShowPassword(false);
    };
  }, [setSignInErrors, setSignInPhoneNumber, setSignInPassword]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Sign In Modal"
      className="enhanced-signin-modal"
      overlayClassName="enhanced-signin-overlay"
      onRequestClose={onClose}
      closeTimeoutMS={200}
    >
      <div className="enhanced-signin-overlay-content" onClick={handleOverlayClick}>
        <div className="enhanced-signin-modal-container">
          <div className="enhanced-signin-left-section">
            <div className="enhanced-signin-background-image">
              <img src={modalImage} alt="Background" />
            </div>
            <div className="enhanced-signin-left-content">
              <div className="enhanced-signin-welcome-text">
                <h2 className="enhanced-signin-h2he">WELCOME</h2>
                <h2 className="enhanced-signin-h2he2">BACK!</h2>
                <p className="enhanced-signin-description">
                  Log in to your existing account
                </p>
              </div>
              <div className="enhanced-signin-switch-text">
                <span className="enhanced-signin-no-account">Don't have an account? </span>
                <span
                  onClick={() => navigate("/homepage?loginRequired=true")}
                  className="enhanced-signin-sign-up-text"
                >
                  Sign Up
                </span>
              </div>
            </div>
          </div>

          <div className="enhanced-signin-right-section">
            <IconButton
              className="enhanced-signin-close-btn"
              onClick={onClose}
              aria-label="close"
            >
              <MdClose />
            </IconButton>
            
            <div className="enhanced-signin-form-container">
              <h2 className="enhanced-signin-heading">Sign In</h2>
              
              {loading.signIn && (
                <div className="enhanced-signin-loading">
                  <div className="enhanced-signin-spinner"></div>
                  <span>Signing you in...</span>
                </div>
              )}
              
              {(errors.phoneNumber || errors.password) && (
                <div className="enhanced-signin-error-container">
                  {errors.phoneNumber && (
                    <div className="enhanced-signin-error">
                      {errors.phoneNumber}
                    </div>
                  )}
                  {errors.password && (
                    <div className="enhanced-signin-error">
                      {errors.password}
                    </div>
                  )}
                </div>
              )}
              
              <form onSubmit={handleSignIn} className="enhanced-signin-form">
                <div className="enhanced-signin-input-group">
                  <label htmlFor="phoneNumber" className="enhanced-signin-label">
                    Phone Number
                  </label>
                  <div className="enhanced-signin-input-container">
                    <MdPhone className="enhanced-signin-input-icon" />
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={signInPhoneNumber}
                      onChange={(e) => {
                        setSignInPhoneNumber(e.target.value);
                        setSignInErrors((prev) => ({ ...prev, phoneNumber: "" }));
                      }}
                      placeholder="Enter your phone number"
                      required
                      className={`enhanced-signin-input ${errors.phoneNumber ? 'error' : ''}`}
                      disabled={loading.signIn}
                    />
                  </div>
                </div>

                <div className="enhanced-signin-input-group">
                  <label htmlFor="password" className="enhanced-signin-label">
                    Password
                  </label>
                  <div className="enhanced-signin-input-container">
                    <MdLock className="enhanced-signin-input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={signInPassword}
                      onChange={(e) => {
                        setSignInPassword(e.target.value);
                        setSignInErrors((prev) => ({ ...prev, password: "" }));
                      }}
                      placeholder="Enter your password"
                      required
                      className={`enhanced-signin-input ${errors.password ? 'error' : ''}`}
                      disabled={loading.signIn}
                    />
                    <IconButton
                      className="enhanced-signin-password-toggle"
                      onClick={togglePasswordVisibility}
                      disabled={loading.signIn}
                      tabIndex={-1}
                    >
                      {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                    </IconButton>
                  </div>
                </div>

                <button
                  type="submit"
                  className="enhanced-signin-submit-btn"
                  disabled={loading.signIn || !signInPhoneNumber || !signInPassword}
                >
                  {loading.signIn ? (
                    <>
                      <div className="enhanced-signin-btn-spinner"></div>
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>
        </div>
      </div>
    </Modal>
  );
};

export default SignInModal;
