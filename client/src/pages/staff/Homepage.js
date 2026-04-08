import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Modal from "react-modal";
import { useSpring, animated } from "@react-spring/web";
import logo from "../../assets/logo.PNG";
import banner1 from "../../assets/banner1.png";
import banner2 from "../../assets/banner2.png";
import banner3 from "../../assets/banner3.png";
import banner4 from "../../assets/banner4.png";
import banner5 from "../../assets/banner5.png";
import Cookies from "js-cookie";
import http from "../../utils/httpClient";
import {
  MdEmail,
  MdLock,
  MdBadge,
  MdPerson,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import { useProfile } from "../../ProfileContext";

Modal.setAppElement("#root");

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const STAFF_REMEMBER_EMAIL_KEY = "staff_remember_email";

// Use plain class names while preserving existing styles["..."] references.
const styles = new Proxy(
  {},
  {
    get: (_, prop) => String(prop),
  },
);

const Homepage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Helper function to check if we're showing clean login interface
  const isCleanLoginInterface = () => {
    const urlParams = new URLSearchParams(location.search);
    const fromLogout = urlParams.get("fromLogout");
    const sessionExpired = urlParams.get("sessionExpired");
    return fromLogout === "true" || sessionExpired === "true";
  };
  const [isChecked, setIsChecked] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("staff");
  const [currentBanner, setCurrentBanner] = useState(0);
  const [fullname, setFullname] = useState("");
  const [outlet, setOutlet] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signInErrors, setSignInErrors] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isSignInOpen, setSignInOpen] = useState(false);
  const [isSignUpOpen, setSignUpOpen] = useState(false);
  const {
    profile,
    updateProfile,
    loading: profileLoading,
    setIsLoggingOut,
  } = useProfile();
  const [loading, setLoading] = useState(false);
  const banners = [banner1, banner2, banner3, banner4, banner5];
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] =
    useState(false);

  const preloadRememberedEmail = () => {
    const rememberedEmail =
      localStorage.getItem(STAFF_REMEMBER_EMAIL_KEY) || Cookies.get("email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setIsChecked(true);
      return;
    }
    setIsChecked(false);
  };

  useEffect(() => {
    if (isSignInOpen) {
      preloadRememberedEmail();
    }
  }, [isSignInOpen]);

  // Handle clean redirect without showing modals for certain scenarios
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const signupRequired = urlParams.get("signupRequired");
    const fromLogout = urlParams.get("fromLogout");
    const sessionExpired = urlParams.get("sessionExpired");

    if (location.pathname === "/staff-login" && !profile) {
      // Skip modal for logout and session expiry - show clean login interface
      if (fromLogout === "true" || sessionExpired === "true") {
        console.log(
          "Clean redirect detected, showing login interface without modal",
        );
        // Don't open any modal - user will see the clean login interface
        return;
      }

      // Normal flow - open appropriate modal
      if (signupRequired === "true") {
        setSignUpOpen(true);
      } else {
        setSignInOpen(true);
      }
    }
  }, [location, profile]);

  const validateFullName = (fullname) => {
    const regex = /^[A-Za-z\s\-'/]+$/;
    return regex.test(fullname);
  };

  const validateUsername = (username) => {
    if (username.length > 8) return "Username must be 8 characters or less.";
    if (!/^[A-Z]/.test(username))
      return "Username must start with an uppercase letter.";
    const regex = /^[A-Za-z]+$/;
    if (!regex.test(username))
      return "Username can only contain alphabetic characters.";
    return "";
  };

  const signInAnimation = useSpring({
    opacity: isSignInOpen ? 1 : 0.7,
    transform: isSignInOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  const signUpAnimation = useSpring({
    opacity: isSignUpOpen ? 1 : 0.7,
    transform: isSignUpOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  useEffect(() => {
    // Check if logout is in progress to prevent automatic redirects
    const logoutInProgress = localStorage.getItem("FORCE_LOGOUT_IN_PROGRESS");
    if (logoutInProgress) {
      console.log("Logout in progress, skipping profile-based redirect");
      return;
    }

    // Check if we're showing clean login interface (from logout or session expiry)
    const urlParams = new URLSearchParams(location.search);
    const fromLogout = urlParams.get("fromLogout");
    const sessionExpired = urlParams.get("sessionExpired");

    if (fromLogout === "true" || sessionExpired === "true") {
      console.log(
        "Clean login interface active, skipping profile-based redirect",
      );
      // Clear the profile if it exists to prevent redirect loops
      if (profile) {
        console.log("Clearing existing profile for clean login interface");
        updateProfile(null);
      }
      return;
    }

    if (profile && !profileLoading) {
      // Only redirect if we're not already showing a modal and not in the middle of logging out
      // Also check if we're on the exact staff-login path to prevent redirect loops
      if (
        location.pathname === "/staff-login" &&
        !isSignInOpen &&
        !isSignUpOpen
      ) {
        console.log(
          "Profile detected on staff-login page, redirecting to dashboard",
        );
        if (profile.role === "staff") {
          navigate("/staff/attendance");
        } else if (profile.role === "manager") {
          navigate("/manager");
        }
      }
    }
  }, [
    profile,
    profileLoading,
    navigate,
    location.pathname,
    isSignInOpen,
    isSignUpOpen,
    updateProfile,
    location.search,
  ]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSignInErrors({ email: "", password: "" });
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await http.post(`${API_BASE_URL}/auth/staff/signin`, {
        email: normalizedEmail,
        password,
      });
      if (response.data.success) {
        const { token, user } = response.data;
        const userData = {
          ...user,
          token,
        };
        // Let ProfileContext handle all storage - it will use role-specific keys
        updateProfile(userData);
        if (isChecked) {
          localStorage.setItem(STAFF_REMEMBER_EMAIL_KEY, normalizedEmail);
          Cookies.set("email", normalizedEmail, { expires: 7 });
        } else {
          localStorage.removeItem(STAFF_REMEMBER_EMAIL_KEY);
          Cookies.remove("email");
        }
        setSignInOpen(false);
        if (user.role === "staff") {
          navigate("/staff/attendance");
        } else if (user.role === "manager") {
          navigate("/manager");
        } else {
          alert("Unrecognized user role.");
        }
      } else {
        throw new Error("Sign-in response not successful");
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "An unexpected error occurred. Please try again.";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (password) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;
    return re.test(password);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    let newErrors = {
      fullname: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    };

    if (!validateFullName(fullname)) {
      newErrors.fullname =
        "Full Name can only contain letters, spaces, hyphens, apostrophes, and components.";
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      newErrors.username = usernameError;
    } else {
      try {
        const response = await http.post(
          `${API_BASE_URL}/users/checkUsername`,
          {
            username,
          },
        );
        if (response.data.exists) {
          newErrors.username = "Username is already taken.";
        }
      } catch (error) {
        newErrors.username =
          error.response?.data?.message ||
          "Error checking username availability.";
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signUpEmail)) {
      newErrors.email = "Invalid email address.";
    } else {
      try {
        const response = await http.post(`${API_BASE_URL}/users/checkEmail`, {
          email: signUpEmail,
        });
        if (response.data.exists) {
          newErrors.email = "Email is already registered.";
        }
      } catch (error) {
        newErrors.email =
          error.response?.data?.message || "Error checking email availability.";
      }
    }

    if (!validatePassword(signUpPassword)) {
      newErrors.password =
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    }

    if (signUpPassword !== signUpConfirmPassword) {
      newErrors.confirmPassword = "Passwords do not match!";
    }

    setErrors(newErrors);
    if (Object.values(newErrors).some((e) => e !== "")) {
      setLoading(false);
      return;
    }

    try {
      const response = await http.post(`${API_BASE_URL}/auth/signup`, {
        email: signUpEmail,
        password: signUpPassword,
        userType,
        fullname,
        outlet,
        username,
      });
      if (response.data.message) {
        setSignUpOpen(false);
        setSignUpEmail("");
        setSignUpPassword("");
        setSignUpConfirmPassword("");
        setFullname("");
        setOutlet("");
        setUsername("");
        setErrors({
          fullname: "",
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
        });
        setSignInOpen(true);
      }
    } catch (error) {
      // Support multiple field errors from backend (object)
      const errData = error.response?.data;
      if (
        errData &&
        typeof errData === "object" &&
        (errData.fullname ||
          errData.username ||
          errData.email ||
          errData.password ||
          errData.confirmPassword)
      ) {
        setErrors({
          fullname: errData.fullname || "",
          username: errData.username || "",
          email: errData.email || "",
          password: errData.password || "",
          confirmPassword: errData.confirmPassword || "",
        });
      } else {
        alert(error.response?.data?.message || "Sign-up failed");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prevBanner) => (prevBanner + 1) % banners.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    if (isSignUpOpen) {
      // Fetch outlets when signup modal is opened
      http
        .get(`${API_BASE_URL}/bookings/outlets`)
        .then((response) => {
          if (Array.isArray(response.data)) {
            setOutlets(response.data.map((o) => o.name || o));
          } else if (Array.isArray(response.data.outlets)) {
            setOutlets(response.data.outlets.map((o) => o.name || o));
          } else {
            setOutlets([]);
          }
        })
        .catch((error) => {
          console.error("Error fetching outlets for signup:", error);
          setOutlets([]);
        });
    }
  }, [isSignUpOpen]);

  const openSignInModal = (e) => {
    setSignUpOpen(false);
    setSignInOpen(true);
  };

  const openSignUpModal = (e) => {
    setSignInOpen(false);
    setSignUpOpen(true);
  };

  const closeSignInModal = () => {
    setSignInOpen(false);
    // Don't clear profile on modal close - only clear on explicit logout
    // This prevents the redirect loop issue when modal is closed
  };

  const closeSignUpModal = () => {
    setSignUpOpen(false);
    // Don't clear profile on modal close - only clear on explicit logout
    // This prevents the redirect loop issue when modal is closed
  };

  const handleLogout = () => {
    // Set logging out flag to prevent auto re-login
    if (setIsLoggingOut) {
      setIsLoggingOut(true);
    }

    // Set flag to prevent automatic redirects during logout
    localStorage.setItem("FORCE_LOGOUT_IN_PROGRESS", "true");

    // Clear cookies
    Cookies.remove("email");

    // Clear session storage
    sessionStorage.clear();

    // Use ProfileContext's proper logout method
    updateProfile(null);

    // Force a hard navigation to clean login page with fromLogout parameter
    setTimeout(() => {
      // Clean up logout flag
      localStorage.removeItem("FORCE_LOGOUT_IN_PROGRESS");

      if (setIsLoggingOut) {
        setIsLoggingOut(false);
      }

      // Redirect to clean login interface with fromLogout parameter
      window.location.href = "/staff-login?fromLogout=true";
    }, 50); // Reduced timeout for faster logout
  };

  return (
    <div className={styles["homepage-module"]}>
      <div className={styles["homepage-container"]}>
        <div className={styles["header-homepage"]}>
          <img src={logo} alt="Huuk Logo" className={styles["logo-homepage"]} />
          {profile && !isCleanLoginInterface() && (
            <button
              onClick={handleLogout}
              className={styles["logout-btn-homepage"]}
            >
              Logout
            </button>
          )}
        </div>

        <div className={styles["left-side-homepage"]}>
          <h1 className={styles["h1-wel-homepage"]}>WELCOME TO HUUK </h1>
          <h1 className={styles["h1-wel2-homepage"]}>STAFF SYSTEM!</h1>
          <p className={styles["p-homepage"]}>
            Please sign in or create an account to access your dashboard.
          </p>
          <div className={styles["auth-buttons-homepage"]}>
            {profile && !isCleanLoginInterface() ? (
              <div>
                <p style={{ color: "#1a1a1a", marginBottom: "10px" }}>
                  Already signed in as {profile.role}:{" "}
                  {profile.username || profile.fullname || ""}
                </p>
                <button
                  className={styles["logout-btn-homepage"]}
                  onClick={handleLogout}
                  disabled={loading}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                {/* Always show styled modal buttons */}
                <button
                  className={styles["signup-btn-homepage"]}
                  onClick={openSignUpModal}
                  disabled={loading}
                >
                  Sign Up
                </button>
                <button
                  className={styles["signin-btn-homepage"]}
                  onClick={openSignInModal}
                  disabled={loading}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles["right-side-homepage"]}>
          <div className={styles["carousel-homepage"]}>
            {banners.map((banner, index) => (
              <img
                key={index}
                src={banner}
                alt={`Banner ${index + 1}`}
                className={`${styles["carousel-image-homepage"]} ${
                  currentBanner === index
                    ? styles["fadeIn-homepage"]
                    : styles["fadeOut-homepage"]
                }`}
                style={{
                  zIndex: currentBanner === index ? 2 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sign In Modal */}
      <Modal
        isOpen={isSignInOpen}
        onRequestClose={closeSignInModal}
        onAfterClose={() => setSignInOpen(false)}
        contentLabel="Sign In Modal"
        className={styles["homepage-signin-modal"]}
        overlayClassName={styles["homepage-signin-overlay"]}
        parentSelector={() => document.body}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        preventScroll={true}
        style={{
          content: {
            width: "840px",
            height: "600px",
            maxWidth: "740px",
            maxHeight: "600px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            margin: "0",
            border: "none",
            borderRadius: "8px",
            overflow: "hidden",
          },
        }}
      >
        <animated.div
          style={{
            ...signInAnimation,
            width: "1000px",
            maxWidth: "100vw",
            minWidth: "320px",
          }}
          className={styles["homepage-signin-modal-container"]}
        >
          <div className={styles["homepage-signin-left-section"]}>
            <div className={styles["h2-wrapper-homepage"]}>
              <h2 className={styles["h2he-homepage"]}>WELCOME</h2>
              <h2 className={styles["h2he2-homepage"]}>BACK!</h2>
            </div>
            <p className={styles["create-account-heading-homepage"]}>
              Log in to your existing account
            </p>
            <div className={styles["modal-link-container"]}>
              <span className={styles["no-account-homepage"]}>
                Don't have an account?{" "}
              </span>
              <span
                onClick={openSignUpModal}
                className={styles["sign-up-text-homepage"]}
                style={{ fontWeight: "bold", textDecoration: "underline" }}
              >
                Sign Up
              </span>
            </div>
          </div>

          <div className={styles["homepage-signin-right-section"]}>
            <h2 className={styles["sign-up-heading-homepage"]}>Sign In</h2>
            {loading && <div>Loading...</div>}
            <form
              onSubmit={handleSignIn}
              className={styles["sign-up-form-homepage"]}
            >
              <label htmlFor="email">Email</label>
              <div style={{ position: "relative" }}>
                <MdEmail
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  placeholder="Enter your email"
                  required
                  style={{
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    paddingLeft: "40px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
              </div>
              {signInErrors.email && (
                <p className={styles["error-homepage"]}>{signInErrors.email}</p>
              )}

              <label htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <MdLock
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type={showSignInPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  placeholder="Enter your password"
                  required
                  style={{
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    paddingLeft: "40px",
                    paddingRight: "40px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
                <span
                  onClick={() => setShowSignInPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "10px",
                    transform: "translateY(-50%)",
                    cursor: "pointer",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={
                    showSignInPassword ? "Hide password" : "Show password"
                  }
                >
                  {showSignInPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </span>
              </div>
              {signInErrors.password && (
                <p className={styles["error-homepage"]}>
                  {signInErrors.password}
                </p>
              )}

              <div className={styles["remember-container-homepage"]}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={isChecked}
                  onChange={() => setIsChecked(!isChecked)}
                  className={styles["remember-checkbox-homepage"]}
                  disabled={loading}
                />
                <label
                  htmlFor="rememberMe"
                  className={styles["remember-label-homepage"]}
                >
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                className={styles["sign-up-btn-homepage"]}
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>

              <p
                className={styles["forgot-password-homepage"]}
                style={{ marginTop: "14px" }}
              >
                <a
                  href="/forgot-password"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate("/forgot-password");
                  }}
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                >
                  Forgot Password?
                </a>
              </p>
            </form>
          </div>

          <button
            className={styles["close-btn-homepage"]}
            onClick={closeSignInModal}
          >
            x
          </button>
        </animated.div>
      </Modal>

      {/* Sign Up Modal */}
      <Modal
        isOpen={isSignUpOpen}
        onRequestClose={closeSignUpModal}
        onAfterClose={() => setSignUpOpen(false)}
        contentLabel="Sign Up Modal"
        className={styles["homepage-signup-modal"]}
        overlayClassName={styles["homepage-signup-overlay"]}
        parentSelector={() => document.body}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        preventScroll={true}
        style={{
          content: {
            width: "840px",
            height: "600px",
            maxWidth: "740px",
            maxHeight: "600px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            margin: "0",
            border: "none",
            borderRadius: "8px",
            overflow: "hidden",
          },
        }}
      >
        <animated.div
          style={{
            ...signUpAnimation,
            width: "1000px",
            maxWidth: "100vw",
            minWidth: "320px",
          }}
          className={styles["homepage-signup-modal-container"]}
        >
          <div className={styles["homepage-signup-left-section"]}>
            <div className={styles["h2-wrapper-homepage"]}>
              <h2 className={styles["h2he-homepage"]}>Hello</h2>
              <h2 className={styles["h2he2-homepage"]}>Newcomer!</h2>
            </div>
            <p className={styles["create-account-heading-homepage"]}>
              Create your own account
            </p>
            <label htmlFor="userType" className={styles["label-left-homepage"]}>
              <span className={styles["text-field-homepage"]}>
                Who are you?
              </span>
            </label>
            <select
              id="userType"
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className={styles["select-field-homepage"]}
              disabled={loading}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
            <label htmlFor="outlet" className={styles["label-left-homepage"]}>
              <span className={styles["text-field-homepage"]}>Outlet</span>
            </label>
            <select
              id="outlet"
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className={styles["select-field-homepage"]}
              disabled={loading}
            >
              <option value="">Select Outlet</option>
              {outlets.map((outlet, index) => (
                <option key={index} value={outlet}>
                  {outlet}
                </option>
              ))}
            </select>
            <div className={styles["modal-link-container"]}>
              <span className={styles["have-account-homepage"]}>
                Already have an account?{" "}
              </span>
              <span
                onClick={openSignInModal}
                className={styles["sign-in-text-homepage"]}
              >
                Sign In
              </span>
            </div>
          </div>

          <div className={styles["homepage-signup-right-section"]}>
            <h2 className={styles["sign-up-heading-homepage"]}>Sign Up</h2>
            {loading && <div>Loading...</div>}
            <form
              onSubmit={handleSignUp}
              className={styles["sign-up-form-homepage"]}
            >
              <label htmlFor="fullname">Fullname</label>
              <div style={{ position: "relative" }}>
                <MdBadge
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="text"
                  id="fullname"
                  value={fullname}
                  placeholder="As per IC"
                  onChange={(e) => {
                    setFullname(e.target.value);
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
              </div>
              {errors.fullname && (
                <p className={styles["error-homepage"]}>{errors.fullname}</p>
              )}

              <label htmlFor="username">Username</label>
              <div style={{ position: "relative" }}>
                <MdPerson
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="text"
                  id="username"
                  value={username}
                  placeholder="Choose a unique username"
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
              </div>
              {errors.username && (
                <p className={styles["error-homepage"]}>{errors.username}</p>
              )}

              <label htmlFor="email">Email</label>
              <div style={{ position: "relative" }}>
                <MdEmail
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="email"
                  id="email"
                  value={signUpEmail}
                  placeholder="staffone@gmail.com"
                  onChange={(e) => {
                    setSignUpEmail(e.target.value);
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className={styles["error-homepage"]}>{errors.email}</p>
              )}

              <label htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <MdLock
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type={showSignUpPassword ? "text" : "password"}
                  id="password"
                  value={signUpPassword}
                  placeholder="Password"
                  onChange={(e) => {
                    setSignUpPassword(e.target.value);
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
                <span
                  onClick={() => setShowSignUpPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "10px",
                    transform: "translateY(-50%)",
                    cursor: "pointer",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={
                    showSignUpPassword ? "Hide password" : "Show password"
                  }
                >
                  {showSignUpPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </span>
              </div>
              {errors.password && (
                <p className={styles["error-homepage"]}>{errors.password}</p>
              )}

              <label htmlFor="confirmPassword">Confirm Password</label>
              <div style={{ position: "relative" }}>
                <MdLock
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type={showSignUpConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  value={signUpConfirmPassword}
                  placeholder="Confirm Password"
                  onChange={(e) => {
                    setSignUpConfirmPassword(e.target.value);
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
                    color: "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: "1px solid #1a1a1a",
                    fontFamily: "Quicksand, sans-serif",
                    padding: "12px",
                    margin: "2px 0 8px 0",
                    width: "220px",
                    height: "40px",
                    borderRadius: "1px",
                    fontSize: "0.9rem",
                    boxShadow: "0px 7px 8px rgba(0, 0, 0, 0.4)",
                    boxSizing: "border-box",
                  }}
                  disabled={loading}
                />
                <span
                  onClick={() => setShowSignUpConfirmPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "10px",
                    transform: "translateY(-50%)",
                    cursor: "pointer",
                    color: "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={
                    showSignUpConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showSignUpConfirmPassword ? (
                    <MdVisibilityOff />
                  ) : (
                    <MdVisibility />
                  )}
                </span>
              </div>
              {errors.confirmPassword && (
                <p className={styles["error-homepage"]}>
                  {errors.confirmPassword}
                </p>
              )}

              <button
                type="submit"
                className={styles["sign-up-btn-homepage"]}
                disabled={loading}
              >
                {loading ? "Signing Up..." : "Sign Up"}
              </button>
            </form>
          </div>

          <button
            className={styles["close-btn-homepage"]}
            onClick={closeSignUpModal}
          >
            x
          </button>
        </animated.div>
      </Modal>
    </div>
  );
};

export default Homepage;
