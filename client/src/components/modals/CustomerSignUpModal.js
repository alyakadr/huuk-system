import React, { useEffect, useState } from "react";
import { IconButton } from "@mui/material";
import Modal from "react-modal";
import { MdPhone, MdLock, MdPerson, MdClose, MdVisibility, MdVisibilityOff } from "react-icons/md";
import "../../styles/enhancedModals.css";
import modalImage from "../../assets/modalcust1.jpg";

Modal.setAppElement("#root");

const CustomerSignUpModal = ({
  isOpen,
  onClose,
  signUpPhoneNumber,
  setSignUpPhoneNumber,
  signUpPassword,
  setSignUpPassword,
  signUpName,
  setSignUpName,
  handleSignUp,
  errors = { phoneNumber: "", password: "", name: "" },
  setSignUpErrors = () => {},
  loading,
  onShowSignIn,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    return () => {
      setSignUpErrors({ phoneNumber: "", password: "", name: "" });
      setSignUpPhoneNumber("");
      setSignUpPassword("");
      setSignUpName("");
      setShowPassword(false);
    };
  }, [setSignUpErrors, setSignUpPhoneNumber, setSignUpPassword, setSignUpName]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Customer Sign Up Modal"
      className="enhanced-signup-modal"
      overlayClassName="enhanced-signup-overlay"
      onRequestClose={onClose}
    >
      <div className="enhanced-signup-modal-container">
        <div className="enhanced-signup-left-section">
          <div className="enhanced-signup-background-image">
            <img src={modalImage} alt="Background" />
          </div>
          <div className="enhanced-signup-left-content">
            <div className="enhanced-signup-welcome-text">
              <h2 className="enhanced-signup-h2he">JOIN</h2>
              <h2 className="enhanced-signup-h2he2">US!</h2>
              <p className="enhanced-signup-description">
                Create a new account to get started
              </p>
            </div>
            <div className="enhanced-signup-switch-text">
              <span className="enhanced-signup-no-account">Already have an account? </span>
              <span
                onClick={onShowSignIn}
                className="enhanced-signup-sign-in-text"
              >
                Sign In
              </span>
            </div>
          </div>
        </div>

        <div className="enhanced-signup-right-section">
          <IconButton
            className="enhanced-signup-close-btn"
            onClick={onClose}
            aria-label="close"
          >
            <MdClose />
          </IconButton>
          
          <div className="enhanced-signup-form-container">
            <h2 className="enhanced-signup-heading">Sign Up</h2>
            
            {loading.signUp && (
              <div className="enhanced-signup-loading">
                <div className="enhanced-signup-spinner"></div>
                <span>Creating your account...</span>
              </div>
            )}
            
            {(errors.name || errors.phoneNumber || errors.password) && (
              <div className="enhanced-signup-error-container">
                {errors.name && (
                  <div className="enhanced-signup-error">
                    {errors.name}
                  </div>
                )}
                {errors.phoneNumber && (
                  <div className="enhanced-signup-error">
                    {errors.phoneNumber}
                  </div>
                )}
                {errors.password && (
                  <div className="enhanced-signup-error">
                    {errors.password}
                  </div>
                )}
              </div>
            )}
            
            <form onSubmit={handleSignUp} className="enhanced-signup-form">
              <div className="enhanced-signup-input-group">
                <label htmlFor="name" className="enhanced-signup-label">
                  Full Name
                </label>
                <div className="enhanced-signup-input-container">
                  <MdPerson className="enhanced-signup-input-icon" />
                  <input
                    type="text"
                    id="name"
                    value={signUpName}
                    onChange={(e) => {
                      setSignUpName(e.target.value);
                      setSignUpErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="Enter your full name"
                    required
                    className={`enhanced-signup-input ${errors.name ? 'error' : ''}`}
                    disabled={loading.signUp}
                  />
                </div>
              </div>

              <div className="enhanced-signup-input-group">
                <label htmlFor="phoneNumber" className="enhanced-signup-label">
                  Phone Number
                </label>
                <div className="enhanced-signup-input-container">
                  <MdPhone className="enhanced-signup-input-icon" />
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={signUpPhoneNumber}
                    onChange={(e) => {
                      setSignUpPhoneNumber(e.target.value);
                      setSignUpErrors((prev) => ({ ...prev, phoneNumber: "" }));
                    }}
                    placeholder="Enter your phone number"
                    required
                    className={`enhanced-signup-input ${errors.phoneNumber ? 'error' : ''}`}
                    disabled={loading.signUp}
                  />
                </div>
              </div>

              <div className="enhanced-signup-input-group">
                <label htmlFor="password" className="enhanced-signup-label">
                  Password
                </label>
                <div className="enhanced-signup-input-container">
                  <MdLock className="enhanced-signup-input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={signUpPassword}
                    onChange={(e) => {
                      setSignUpPassword(e.target.value);
                      setSignUpErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    placeholder="Enter your password"
                    required
                    className={`enhanced-signup-input ${errors.password ? 'error' : ''}`}
                    disabled={loading.signUp}
                  />
                  <IconButton
                    className="enhanced-signup-password-toggle"
                    onClick={togglePasswordVisibility}
                    disabled={loading.signUp}
                    tabIndex={-1}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </IconButton>
                </div>
              </div>

              <button
                type="submit"
                className="enhanced-signup-submit-btn"
                disabled={loading.signUp || !signUpName || !signUpPhoneNumber || !signUpPassword}
              >
                {loading.signUp ? (
                  <div>
                    <div className="enhanced-signup-btn-spinner"></div>
                    Signing Up...
                  </div>
                ) : (
                  "Sign Up"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomerSignUpModal;
