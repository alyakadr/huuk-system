import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Modal from "react-modal";
import { useSpring, animated } from "@react-spring/web";
import http from "../../utils/httpClient";
import {
  MdPhone,
  MdLock,
  MdEmail,
  MdPerson,
  MdVisibility,
  MdVisibilityOff,
  MdErrorOutline,
} from "react-icons/md";
import "../../styles/customerHomepage.css";
import styles from "../../styles/homepage.module.css";
import logo from "../../assets/logo.PNG";
import heroImage from "../../assets/bannercust1.png";
import modalImage from "../../assets/modalcust1.jpg";
import CustHeader from "../../components/shared/CustHeader";
import AboutUs from "./AboutUs";
import Gallery from "./Gallery";
import Location from "./Location";
import Services from "./Services";
import Booking from "../../components/bookings/Booking";
import BookingHistory from "./BookingHistory";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import { useProfile } from "../../ProfileContext";

Modal.setAppElement("#root");

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const CustomerHomepage = () => {
  const { profile, setIsSignInOpen } = useProfile();
  const isLoggedIn = !!profile;
  const loggedInUsername = profile?.username || profile?.fullname || "User";

  // Restore sign-up state (sign-in is now centralized)
  const [isSignUpOpen, setSignUpOpen] = useState(false);
  const [signUpPhoneNumber, setSignUpPhoneNumber] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signUpErrors, setSignUpErrors] = useState({
    email: "",
    username: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState({
    signUp: false,
  });
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] =
    useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const loginRequired = query.get("loginRequired") === "true";

  const heroRef = useRef(null);
  const aboutUsRef = useRef(null);
  const galleryRef = useRef(null);
  const locationRef = useRef(null);
  const servicesRef = useRef(null);
  const bookingRef = useRef(null);
  const bookingHistoryRef = useRef(null);

  // Remove loginRequired query param after processing to prevent modal reopening on refresh
  useEffect(() => {
    if (loginRequired) {
      const params = new URLSearchParams(location.search);
      params.delete("loginRequired");
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [loginRequired, navigate, location.search]);

  // Add event listener for opening sign-up modal from sign-in modal
  useEffect(() => {
    const handleOpenSignUpModal = () => {
      setSignUpOpen(true);
    };

    window.addEventListener("open-signup-modal", handleOpenSignUpModal);

    return () => {
      window.removeEventListener("open-signup-modal", handleOpenSignUpModal);
    };
  }, []);

  // Remove this useEffect to prevent excessive logging and potential re-render triggers
  // useEffect(() => {
  //   console.log(
  //     "CustomerHomepage re-rendered, isLoggedIn=",
  //     isLoggedIn,
  //     "username=",
  //     loggedInUsername,
  //     "profile=",
  //     profile,
  //     "bookingHistoryVisible=",
  //     isLoggedIn
  //   );
  // }, [isLoggedIn, loggedInUsername, profile]);

  // Hide scrollbars but keep scroll functionality
  useEffect(() => {
    // Add custom scrollbar styles to hide scrollbars
    const style = document.createElement("style");
    style.textContent = `
      /* Hide scrollbars for webkit browsers */
      ::-webkit-scrollbar {
        width: 0px;
        height: 0px;
        background: transparent;
      }
      
      /* Hide scrollbars for Firefox */
      * {
        scrollbar-width: none;
        scrollbar-color: transparent transparent;
      }
      
      /* Ensure scrolling still works */
      body, html {
        overflow: auto;
        -ms-overflow-style: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      // Cleanup: remove custom styles when component unmounts
      document.head.removeChild(style);
    };
  }, []);

  const scrollToSection = (ref) => {
    ref.current.scrollIntoView({ behavior: "smooth" });
  };

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePassword = (password) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;
    return re.test(password);
  };

  // Remove all sign-in modal state, handlers, and JSX
  // Only keep sign-up modal and its state/handlers
  // To open sign-in modal, use: const { setIsSignInOpen } = useProfile(); setIsSignInOpen(true);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, signUp: true }));
    setSignUpErrors({
      email: "",
      username: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    });

    let newErrors = {
      email: "",
      username: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    };

    if (!validateEmail(signUpEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!signUpUsername || signUpUsername.trim() === "") {
      newErrors.username = "Username is required.";
    }

    if (!signUpPhoneNumber || signUpPhoneNumber.trim() === "") {
      newErrors.phoneNumber = "Phone number is required.";
    }

    if (!validatePassword(signUpPassword)) {
      newErrors.password =
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    }

    if (signUpPassword !== signUpConfirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.values(newErrors).some((e) => e !== "")) {
      setSignUpErrors(newErrors);
      setLoading((prev) => ({ ...prev, signUp: false }));
      return;
    }

    try {
      console.log("[FRONTEND DEBUG] Sending signup request with data:", {
        phone_number: signUpPhoneNumber,
        password: signUpPassword ? "[PROVIDED]" : "[MISSING]",
        username: signUpUsername,
        email: signUpEmail,
        url: `${API_BASE_URL}/auth/customer/signup`,
      });

      const response = await http.post(
        `${API_BASE_URL}/auth/customer/signup`,
        {
          phone_number: signUpPhoneNumber,
          password: signUpPassword,
          username: signUpUsername,
          email: signUpEmail,
        },
      );
      if (response.data.message) {
        alert(response.data.message);
        setSignUpOpen(false);
        setSignUpPhoneNumber("");
        setSignUpPassword("");
        setSignUpEmail("");
        setSignUpUsername("");
        setSignUpConfirmPassword("");
        setSignUpErrors({
          email: "",
          username: "",
          phoneNumber: "",
          password: "",
          confirmPassword: "",
        });
        setIsSignInOpen(true);
      }
    } catch (error) {
      // Support multiple field errors from backend (object)
      const errData = error.response?.data;
      if (
        errData &&
        typeof errData === "object" &&
        (errData.email ||
          errData.username ||
          errData.phoneNumber ||
          errData.password ||
          errData.confirmPassword)
      ) {
        setSignUpErrors({
          email: errData.email || "",
          username: errData.username || "",
          phoneNumber: errData.phoneNumber || "",
          password: errData.password || "",
          confirmPassword: errData.confirmPassword || "",
        });
      } else {
        const message = error.response?.data?.message || "Sign-up failed";
        // Try to parse which field the error is about
        if (message.toLowerCase().includes("email")) {
          setSignUpErrors({
            email: message,
            username: "",
            phoneNumber: "",
            password: "",
            confirmPassword: "",
          });
        } else if (message.toLowerCase().includes("username")) {
          setSignUpErrors({
            email: "",
            username: message,
            phoneNumber: "",
            password: "",
            confirmPassword: "",
          });
        } else if (message.toLowerCase().includes("phone")) {
          setSignUpErrors({
            email: "",
            username: "",
            phoneNumber: message,
            password: "",
            confirmPassword: "",
          });
        } else if (message.toLowerCase().includes("password")) {
          setSignUpErrors({
            email: "",
            username: "",
            phoneNumber: "",
            password: message,
            confirmPassword: "",
          });
        } else {
          setSignUpErrors({
            email: message,
            username: "",
            phoneNumber: "",
            password: "",
            confirmPassword: "",
          });
        }
      }
    } finally {
      setLoading((prev) => ({ ...prev, signUp: false }));
    }
  };

  const openSignInModal = () => {
    setSignUpOpen(false); // Close sign-up modal first
    setIsSignInOpen(true);
  };
  const closeSignInModal = () => setIsSignInOpen(false);

  const openSignUpModal = () => {
    setSignUpOpen(true);
  };
  const closeSignUpModal = () => {
    setSignUpOpen(false);
    setSignUpEmail("");
    setSignUpUsername("");
    setSignUpPhoneNumber("");
    setSignUpPassword("");
    setSignUpConfirmPassword("");
    setSignUpErrors({
      email: "",
      username: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    });
  };

  const signUpAnimation = useSpring({
    opacity: isSignUpOpen ? 1 : 0.7,
    transform: isSignUpOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  // console.log("Modal image path:", modalImage); // Debug image path - commented to reduce console spam

  return (
    <div className="cust-homepage" style={{ width: "100vw", height: "100vh" }}>
      <CustHeader
        isLoggedIn={isLoggedIn}
        openSignInModal={openSignInModal}
        scrollToSection={scrollToSection}
        refs={{
          heroRef,
          aboutUsRef,
          galleryRef,
          locationRef,
          servicesRef,
          bookingRef,
          bookingHistoryRef,
        }}
        loggedInUsername={loggedInUsername}
      />

      <section className="cust-hero" ref={heroRef}>
        <img src={heroImage} alt="Barbershop" className="cust-img" />
        <div className="cust-hero-content">
          <img src={logo} alt="HUUK Logo" className="cust-hero-logo" />
          <h1>HUUK HAIRCUT, SHAVE & POMADE</h1>
          <p>
            A barbershop isn’t just a place to get a haircut—it’s a sanctuary
            where conversations flow, friendships bloom, and every client walks
            out feeling refreshed, confident, and ready to take on the world.
          </p>
          <div className="cust-hero-buttons">
            <button
              onClick={() => scrollToSection(bookingRef)}
              className="cust-btn cust-book-now"
            >
              BOOK NOW
            </button>
            <button
              onClick={() => scrollToSection(servicesRef)}
              className="cust-btn cust-view-services"
            >
              VIEW SERVICES
            </button>
          </div>
          <div className="cust-cta-section">
            <button
              onClick={() => scrollToSection(aboutUsRef)}
              className="cust-btn cust-discover"
            >
              DISCOVER MORE
            </button>
            <p>
              Take A Tour Around Our Barbershops And Find Your New Hairstyle
              Here
            </p>
          </div>
        </div>
      </section>

      <section className="cust-section" ref={bookingRef}>
        <Booking
          scrollToSection={scrollToSection}
          bookingHistoryRef={bookingHistoryRef}
        />
      </section>

      {isLoggedIn && (
        <section className="cust-section" ref={bookingHistoryRef}>
          <BookingHistory />
        </section>
      )}

      <section className="cust-section" ref={aboutUsRef}>
        <AboutUs />
      </section>

      <section className="cust-section" ref={galleryRef}>
        <Gallery />
      </section>

      <section className="cust-section" ref={locationRef}>
        <Location />
      </section>

      <section className="cust-section" ref={servicesRef}>
        <Services />
      </section>

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
            width: "1000px",
            height: "600px",
            maxWidth: "100vw",
            minWidth: "320px",
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
            {loading.signUp && <div>Loading...</div>}
            <form
              className={styles["sign-up-form-homepage"]}
              onSubmit={handleSignUp}
            >
              <label htmlFor="email">Email</label>
              <div style={{ position: "relative", marginBottom: "18px" }}>
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
                  placeholder="Enter your email"
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
                  disabled={loading.signUp}
                />
              </div>
              {signUpErrors.email && (
                <p className={styles["error-homepage"]}>{signUpErrors.email}</p>
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
                  value={signUpUsername}
                  placeholder="Enter your username"
                  onChange={(e) => {
                    setSignUpUsername(e.target.value);
                  }}
                  required
                  style={{
                    paddingLeft: "40px",
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
                  disabled={loading.signUp}
                />
              </div>
              {signUpErrors.username && (
                <p className={styles["error-homepage"]}>
                  {signUpErrors.username}
                </p>
              )}

              <label htmlFor="phoneNumber">Phone Number</label>
              <div style={{ position: "relative" }}>
                <MdPhone
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
                  type="tel"
                  id="phoneNumber"
                  value={signUpPhoneNumber}
                  placeholder="01234567890"
                  onChange={(e) => {
                    setSignUpPhoneNumber(e.target.value);
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
                  disabled={loading.signUp}
                />
              </div>
              {signUpErrors.phoneNumber && (
                <p className={styles["error-homepage"]}>
                  {signUpErrors.phoneNumber}
                </p>
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
                  placeholder="Enter your password"
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
                  disabled={loading.signUp}
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
              {signUpErrors.password && (
                <p className={styles["error-homepage"]}>
                  {signUpErrors.password}
                </p>
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
                  placeholder="Confirm your password"
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
                  disabled={loading.signUp}
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
              {signUpErrors.confirmPassword && (
                <p className={styles["error-homepage"]}>
                  {signUpErrors.confirmPassword}
                </p>
              )}

              <button
                type="submit"
                className={styles["sign-up-btn-homepage"]}
                disabled={loading.signUp}
              >
                {loading.signUp ? "Signing Up..." : "Sign Up"}
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
      <SwitchModeButton />
    </div>
  );
};

export default CustomerHomepage;



