import React from "react";
import Modal from "react-modal";
import { MdEmail, MdLock } from "react-icons/md";

const SimpleSignInModal = ({
  isOpen,
  onClose,
  signInPhoneNumber,
  setSignInPhoneNumber,
  signInPassword,
  setSignInPassword,
  handleSignIn,
  errors,
  setSignInErrors,
  loading,
  onShowSignUp,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Sign In Modal"
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
          Sign In
        </h2>
        
        <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
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
                value={signInPhoneNumber}
                onChange={(e) => {
                  setSignInPhoneNumber(e.target.value);
                  setSignInErrors((prev) => ({ ...prev, phoneNumber: "" }));
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
                disabled={loading.signIn}
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
                value={signInPassword}
                onChange={(e) => {
                  setSignInPassword(e.target.value);
                  setSignInErrors((prev) => ({ ...prev, password: "" }));
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
                disabled={loading.signIn}
              />
            </div>
            {errors.password && (
              <p style={{ color: "red", fontSize: "12px", margin: "5px 0 0 0" }}>
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading.signIn}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: loading.signIn ? "#ccc" : "#1a1a1a",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              cursor: loading.signIn ? "not-allowed" : "pointer",
              marginTop: "10px",
            }}
          >
            {loading.signIn ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {onShowSignUp && (
          <p style={{ textAlign: "center", marginTop: "15px", color: "#666" }}>
            Don't have an account?{" "}
            <span
              onClick={onShowSignUp}
              style={{ color: "#1a1a1a", cursor: "pointer", textDecoration: "underline" }}
            >
              Sign Up
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
};

export default SimpleSignInModal;
