import React, { useEffect, useState } from "react";
import { IconButton } from "@mui/material";
import Modal from "react-modal";
import { MdPhone, MdLock, MdPerson, MdClose, MdVisibility, MdVisibilityOff } from "react-icons/md";
import "../../styles/customerModals.css";
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
      className="customer-signup-modal"
      overlayClassName="customer-signup-overlay"
      onRequestClose={onClose}
    >
      <div className="customer-signup-modal-container">
        <div className="customer-signup-left-section">
          <div className="customer-signup-background-image">
            <img src={modalImage} alt="Background" />
          </div>
          <div className="customer-signup-left-content">
            <div className="customer-signup-welcome-text">
              <h2 className="customer-signup-h2">JOIN</h2>
              <h2 className="customer-signup-h2">US!</h2>
              <p className="customer-signup-description">
                Create a new account to get started
              </p>
            </div>
            <div className="customer-signup-switch-text">
              <span className="customer-signup-no-account">Already have an account? </span>
              <span
                onClick={onShowSignIn}
                className="customer-signup-sign-in-text"
              >
                Sign In
              </span>
            </div>
          </div>
        </div>

        <div className="customer-signup-right-section">
          <IconButton
            className="customer-signup-close-btn"
            onClick={onClose}
            aria-label="close"
          >
            <MdClose />
          </IconButton>
          
          <div className="customer-signup-form-container">
            <h2 className="customer-signup-heading">Sign Up</h2>
            
            {loading.signUp && (
              <div className="customer-signup-loading">
                <div className="customer-signup-spinner"></div>
                <span>Creating your account...</span>
              </div>
            )}
            
            {(errors.name || errors.phoneNumber || errors.password) && (
              <div className="customer-signup-error-container">
                {errors.name && (
                  <div className="customer-signup-error">
                    {errors.name}
                  </div>
                )}
                {errors.phoneNumber && (
                  <div className="customer-signup-error">
                    {errors.phoneNumber}
                  </div>
                )}
                {errors.password && (
                  <div className="customer-signup-error">
                    {errors.password}
                  </div>
                )}
              </div>
            )}
            
            <form onSubmit={handleSignUp} className="customer-signup-form">
              <div className="customer-signup-input-group">
                <label htmlFor="name" className="customer-signup-label">
                  Full Name
                </label>
                <div className="customer-signup-input-container">
                  <MdPerson className="customer-signup-input-icon" />
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
                    className={`customer-signup-input ${errors.name ? 'error' : ''}`}
                    disabled={loading.signUp}
                  />
                </div>
              </div>

              <div className="customer-signup-input-group">
                <label htmlFor="phoneNumber" className="customer-signup-label">
                  Phone Number
                </label>
                <div className="customer-signup-input-container">
                  <MdPhone className="customer-signup-input-icon" />
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
                    className={`customer-signup-input ${errors.phoneNumber ? 'error' : ''}`}
                    disabled={loading.signUp}
                  />
                </div>
              </div>

              <div className="customer-signup-input-group">
                <label htmlFor="password" className="customer-signup-label">
                  Password
                </label>
                <div className="customer-signup-input-container">
                  <MdLock className="customer-signup-input-icon" />
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
                    className={`customer-signup-input ${errors.password ? 'error' : ''}`}
                    disabled={loading.signUp}
                  />
                  <IconButton
                    className="customer-signup-password-toggle"
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
                className="customer-signup-submit-btn"
                disabled={loading.signUp || !signUpName || !signUpPhoneNumber || !signUpPassword}
              >
                {loading.signUp ? (
                  <div>
                    <div className="customer-signup-btn-spinner"></div>
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
