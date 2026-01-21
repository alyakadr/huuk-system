import React from "react";
import Modal from "react-modal";
import { MdEmail, MdLock, MdPerson } from "react-icons/md";

const SimpleSignUpModal = ({
  isOpen,
  onClose,
  signUpFormData,
  setSignUpFormData,
  handleSignUp,
  errors,
  setSignUpErrors,
  loading,
  onShowSignIn,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Sign Up Modal"
      style={{
        content: {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1100,
          width: "400px",
          maxWidth: "90vw",
          height: "auto",
          maxHeight: "90vh",
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "20px",
          border: "1px solid #ccc",
          overflow: "auto",
        },
        overlay: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1090,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        },
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-10px",
            right: "-10px",
            background: "none",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            color: "#999",
          }}
        >
          ×
        </button>
        
        <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#1a1a1a" }}>
          Sign Up
        </h2>
        
        <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", color: "#1a1a1a" }}>
              Full Name
            </label>
            <div style={{ position: "relative" }}>
              <MdPerson
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "10px",
                  transform: "translateY(-50%)",
                  color: errors.name ? "red" : "#1a1a1a",
                  fontSize: "1.2rem",
                }}
              />
              <input
                type="text"
                value={signUpFormData.name}
                onChange={(e) => {
                  setSignUpFormData((prev) => ({ ...prev, name: e.target.value }));
                  setSignUpErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="Full Name"
                required
                style={{
                  width: "100%",
                  padding: "10px 10px 10px 35px",
                  border: errors.name ? "2px solid red" : "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: errors.name ? "red" : "#1a1a1a",
                  boxSizing: "border-box",
                }}
                disabled={loading.signUp}
              />
            </div>
            {errors.name && (
              <p style={{ color: "red", fontSize: "12px", margin: "5px 0 0 0" }}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", color: "#1a1a1a" }}>
              Phone Number
            </label>
            <div style={{ position: "relative" }}>
              <MdEmail
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "10px",
                  transform: "translateY(-50%)",
                  color: errors.phoneNumber ? "red" : "#1a1a1a",
                  fontSize: "1.2rem",
                }}
              />
              <input
                type="tel"
                value={signUpFormData.phoneNumber}
                onChange={(e) => {
                  setSignUpFormData((prev) => ({ ...prev, phoneNumber: e.target.value }));
                  setSignUpErrors((prev) => ({ ...prev, phoneNumber: "" }));
                }}
                placeholder="Phone Number"
                required
                style={{
                  width: "100%",
                  padding: "10px 10px 10px 35px",
                  border: errors.phoneNumber ? "2px solid red" : "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: errors.phoneNumber ? "red" : "#1a1a1a",
                  boxSizing: "border-box",
                }}
                disabled={loading.signUp}
              />
            </div>
            {errors.phoneNumber && (
              <p style={{ color: "red", fontSize: "12px", margin: "5px 0 0 0" }}>
                {errors.phoneNumber}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", color: "#1a1a1a" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <MdLock
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "10px",
                  transform: "translateY(-50%)",
                  color: errors.password ? "red" : "#1a1a1a",
                  fontSize: "1.2rem",
                }}
              />
              <input
                type="password"
                value={signUpFormData.password}
                onChange={(e) => {
                  setSignUpFormData((prev) => ({ ...prev, password: e.target.value }));
                  setSignUpErrors((prev) => ({ ...prev, password: "" }));
                }}
                placeholder="Password"
                required
                style={{
                  width: "100%",
                  padding: "10px 10px 10px 35px",
                  border: errors.password ? "2px solid red" : "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: errors.password ? "red" : "#1a1a1a",
                  boxSizing: "border-box",
                }}
                disabled={loading.signUp}
              />
            </div>
            {errors.password && (
              <p style={{ color: "red", fontSize: "12px", margin: "5px 0 0 0" }}>
                {errors.password}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", color: "#1a1a1a" }}>
              Confirm Password
            </label>
            <div style={{ position: "relative" }}>
              <MdLock
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "10px",
                  transform: "translateY(-50%)",
                  color: errors.confirmPassword ? "red" : "#1a1a1a",
                  fontSize: "1.2rem",
                }}
              />
              <input
                type="password"
                value={signUpFormData.confirmPassword}
                onChange={(e) => {
                  setSignUpFormData((prev) => ({ ...prev, confirmPassword: e.target.value }));
                  setSignUpErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
                placeholder="Confirm Password"
                required
                style={{
                  width: "100%",
                  padding: "10px 10px 10px 35px",
                  border: errors.confirmPassword ? "2px solid red" : "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: errors.confirmPassword ? "red" : "#1a1a1a",
                  boxSizing: "border-box",
                }}
                disabled={loading.signUp}
              />
            </div>
            {errors.confirmPassword && (
              <p style={{ color: "red", fontSize: "12px", margin: "5px 0 0 0" }}>
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading.signUp}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: loading.signUp ? "#ccc" : "#1a1a1a",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              cursor: loading.signUp ? "not-allowed" : "pointer",
              marginTop: "10px",
            }}
          >
            {loading.signUp ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        {onShowSignIn && (
          <p style={{ textAlign: "center", marginTop: "15px", color: "#666" }}>
            Already have an account?{" "}
            <span
              onClick={onShowSignIn}
              style={{ color: "#1a1a1a", cursor: "pointer", textDecoration: "underline" }}
            >
              Sign In
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
};

export default SimpleSignUpModal;
