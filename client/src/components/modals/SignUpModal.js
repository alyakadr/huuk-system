import React, { useEffect } from "react";
import { Typography, Button, TextField } from "@mui/material";
import Modal from "react-modal";
import { animated, useSpring } from "@react-spring/web";
import { MdPhone, MdLock, MdBadge, MdPerson } from "react-icons/md";

Modal.setAppElement("#root");

const SignUpModal = ({
  isOpen,
  onClose,
  signUpPhone,
  setSignUpPhone,
  signUpPassword,
  setSignUpPassword,
  signUpConfirmPassword,
  setSignUpConfirmPassword,
  fullname,
  setFullname,
  username,
  setUsername,
  handleSignUp,
  errors = {
    phone: "",
    password: "",
    confirmPassword: "",
    fullname: "",
    username: "",
  },
  setErrors = () => {},
  loading,
  navigate,
  isSubmitted,
  openSignInModal,
}) => {
  const modalAnimation = useSpring({
    opacity: isOpen ? 1 : 0.7,
    transform: isOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  // Reset loading state on unmount to prevent stuck loading
  useEffect(() => {
    return () => {
      setErrors({
        phone: "",
        password: "",
        confirmPassword: "",
        fullname: "",
        username: "",
      });
      setSignUpPhone("");
      setSignUpPassword("");
      setSignUpConfirmPassword("");
      setFullname("");
      setUsername("");
    };
  }, [
    setErrors,
    setSignUpPhone,
    setSignUpPassword,
    setSignUpConfirmPassword,
    setFullname,
    setUsername,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Sign Up Modal"
      className="sign-in-modal"
      overlayClassName="cust-overlay"
      onRequestClose={onClose}
    >
      <animated.div style={modalAnimation} className="sign-in-modal-container">
        <div className="sign-in-left-section">
          <h2 className="sign-in-h2">Hello</h2>
          <h2 className="sign-in-h2">Newcomer!</h2>
          <p className="sign-in-subheading">Create your own account</p>
          <p>
            <span className="sign-in-no-account">
              Already have an account?{" "}
            </span>
            <span onClick={openSignInModal} className="sign-in-sign-up-text">
              Sign In
            </span>
          </p>
        </div>
        <div className="sign-in-right-section">
          <h2 className="sign-in-heading">Sign Up</h2>
          {loading && <Typography>Loading...</Typography>}
          <form onSubmit={handleSignUp} className="sign-in-form">
            <TextField
              label="Full Name"
              type="text"
              value={fullname}
              onChange={(e) => {
                setFullname(e.target.value);
                setErrors((prev) => ({ ...prev, fullname: "" }));
              }}
              fullWidth
              required
              disabled={loading}
              error={!!(isSubmitted && errors.fullname)}
              helperText={isSubmitted && errors.fullname}
              InputProps={{
                startAdornment: (
                  <MdBadge
                    style={{
                      color: isSubmitted && errors.fullname ? "red" : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrors((prev) => ({ ...prev, username: "" }));
              }}
              fullWidth
              required
              disabled={loading}
              error={!!(isSubmitted && errors.username)}
              helperText={isSubmitted && errors.username}
              InputProps={{
                startAdornment: (
                  <MdPerson
                    style={{
                      color: isSubmitted && errors.username ? "red" : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Phone Number"
              type="tel"
              value={signUpPhone}
              onChange={(e) => {
                setSignUpPhone(e.target.value);
                setErrors((prev) => ({ ...prev, phone: "" }));
              }}
              fullWidth
              required
              disabled={loading}
              error={!!(isSubmitted && errors.phone)}
              helperText={isSubmitted && errors.phone}
              InputProps={{
                startAdornment: (
                  <MdPhone
                    style={{
                      color: isSubmitted && errors.phone ? "red" : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              value={signUpPassword}
              onChange={(e) => {
                setSignUpPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              fullWidth
              required
              disabled={loading}
              error={!!(isSubmitted && errors.password)}
              helperText={isSubmitted && errors.password}
              InputProps={{
                startAdornment: (
                  <MdLock
                    style={{
                      color: isSubmitted && errors.password ? "red" : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Confirm Password"
              type="password"
              value={signUpConfirmPassword}
              onChange={(e) => {
                setSignUpConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              fullWidth
              required
              disabled={loading}
              error={!!(isSubmitted && errors.confirmPassword)}
              helperText={isSubmitted && errors.confirmPassword}
              InputProps={{
                startAdornment: (
                  <MdLock
                    style={{
                      color:
                        isSubmitted && errors.confirmPassword
                          ? "red"
                          : "#1a1a1a",
                      fontSize: "1.2rem",
                      marginRight: "8px",
                    }}
                  />
                ),
              }}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              className="sign-in-btn"
              disabled={loading}
              sx={{ backgroundColor: "#1a1a1a", color: "#baa173", mt: 2 }}
            >
              {loading ? "Signing Up..." : "Sign Up"}
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

export default SignUpModal;
