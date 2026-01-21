import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import Modal from "react-modal";
import { MdPhone, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { useSpring, animated } from "@react-spring/web";
import styles from "./styles/homepage.module.css";

const ProfileContext = createContext();

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Centralized login modal state and logic
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [signInPhoneNumber, setSignInPhoneNumber] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInErrors, setSignInErrors] = useState({ phoneNumber: "", password: "" });
  const [loadingSignIn, setLoadingSignIn] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Animation for modal
  const signInAnimation = useSpring({
    opacity: isSignInOpen ? 1 : 0.7,
    transform: isSignInOpen ? "scale(1)" : "scale(0.99)",
    config: { tension: 150, friction: 26 },
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "http://localhost:5000/api";

  // Memoize setProfile to prevent rapid updates - remove logging that causes re-renders
  const debounceSetProfile = useCallback((newProfile) => {
    // Only log when there's a significant profile change
    if (newProfile?.id !== profile?.id || (!newProfile && profile)) {
      console.log("Setting profile:", newProfile?.id ? `[User ID: ${newProfile.id}]` : "[Logged out]");
    }
    setProfile(newProfile);
  }, [profile?.id]);

  // Centralized sign-in handler
  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    setLoadingSignIn(true);
    setSignInErrors({ phoneNumber: "", password: "" });
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/customer/signin`,
        {
          phone_number: signInPhoneNumber,
          password: signInPassword,
        }
      );
      if (response.data.success) {
        const userWithToken = {
          ...response.data.user,
          token: response.data.token
        };
        localStorage.setItem('customer_token', response.data.token);
        localStorage.setItem('customer_loggedInUser', JSON.stringify(userWithToken));
        
        updateProfile(userWithToken);
        setIsSignInOpen(false);
        setSignInPhoneNumber("");
        setSignInPassword("");
        setSignInErrors({ phoneNumber: "", password: "" });
        
        // Check for saved booking data and trigger booking submission
        const tempBookingData = localStorage.getItem('TEMP_BOOKING_FORM_DATA');
        if (tempBookingData) {
          console.log('[SIGN IN] Found saved booking data, will restore and submit');
          // Use a small timeout to ensure token is fully set before booking submission
          setTimeout(() => {
            // Dispatch custom event to notify Booking component
            window.dispatchEvent(new CustomEvent('booking-login-success', {
              detail: { bookingData: JSON.parse(tempBookingData) }
            }));
          }, 300);
        }
      } else {
        setSignInErrors({ phoneNumber: "", password: "Invalid credentials" });
      }
    } catch (error) {
      const message = error.response?.data?.message || "Invalid credentials";
      setSignInErrors({ phoneNumber: "", password: message });
    } finally {
      setLoadingSignIn(false);
    }
  };

  // Add a function to close sign-in modal and open sign-up modal
  const openSignUpFromSignIn = () => {
    // Close the sign-in modal first
    setIsSignInOpen(false);
    
    // Wait a brief moment before opening the sign-up modal to allow animation to complete
    setTimeout(() => {
      // Signal to CustomerHomepage to open sign-up modal
      window.dispatchEvent(new CustomEvent('open-signup-modal'));
    }, 100);
  };
  
  // Handle forgot password
  const handleForgotPassword = () => {
    // Close the sign-in modal
    setIsSignInOpen(false);
    
    // You can implement the forgot password functionality here
    // For now, just show an alert
    alert("Please contact support to reset your password.");
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Check if logout is in progress to prevent re-authentication
        const logoutInProgress = localStorage.getItem('FORCE_LOGOUT_IN_PROGRESS');
        if (logoutInProgress) {
          console.log('Logout in progress, skipping profile load');
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // Additional check to prevent loading during logout process
        if (isLoggingOut) {
          console.log('Currently logging out, skipping profile load');
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setLoading(true);
        setError(null);
        
        // Check for customer session first
        const customerToken = localStorage.getItem("customer_token");
        const customerProfile = localStorage.getItem("customer_loggedInUser");
        
        // Check for staff session
        const staffToken = localStorage.getItem("staff_token");
        const staffProfile = localStorage.getItem("staff_loggedInUser");
        
        // NO FALLBACK TO LEGACY TOKENS - strict role separation
        let token = null;
        let storedProfile = null;
        
        // Check which interface is currently being accessed and load appropriate session
        // Both sessions can coexist - no clearing of other sessions
        const currentPath = window.location.pathname;
        const isStaffInterface = currentPath.includes('/staff') || currentPath.includes('/manager');
        const isCustomerInterface = !isStaffInterface; // Default to customer if not staff
        
        if (isStaffInterface && staffToken && staffProfile) {
          token = staffToken;
          storedProfile = staffProfile;
          console.log('Loading staff session for staff interface');
        } else if (isCustomerInterface && customerToken && customerProfile) {
          token = customerToken;
          storedProfile = customerProfile;
          // Reduced logging frequency
          if (Math.random() < 0.1) console.log('Loading customer session for customer interface');
        }
        // NO FALLBACKS - strict interface separation
        // Staff sessions should ONLY work on staff interfaces
        // Customer sessions should ONLY work on customer interfaces

        if (storedProfile) {
          try {
            const parsedProfile = JSON.parse(storedProfile);
            if (parsedProfile && parsedProfile.id && parsedProfile.role) {
              if (token) {
                // Reduce validation logging frequency
                if (Math.random() < 0.1) console.log("Validating token for user:", parsedProfile.id);
                axios
                  .get(`${API_BASE_URL}/auth/validate`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  .then(() => {
                    // Only log successful validation occasionally
                    if (Math.random() < 0.1) console.log("Token validated for user:", parsedProfile.id);
                    debounceSetProfile(parsedProfile);
                  })
                  .catch((error) => {
                    console.warn("Token validation failed, clearing storage for current session.", error.response?.status);
                    
                    // Clear storage based on which session was actually being validated
                    if (isStaffInterface && staffToken && staffProfile) {
                      console.log("Clearing expired staff session tokens");
                      localStorage.removeItem("staff_token");
                      localStorage.removeItem("staff_loggedInUser");
                      localStorage.removeItem("staff_userId");
                    } else if (isCustomerInterface && customerToken && customerProfile) {
                      console.log("Clearing expired customer session tokens");
                      localStorage.removeItem("customer_token");
                      localStorage.removeItem("customer_loggedInUser");
                      localStorage.removeItem("customer_userId");
                    } else {
                      // Fallback for legacy tokens or edge cases
                      console.log("Clearing expired legacy tokens as fallback");
                      localStorage.removeItem("token");
                      localStorage.removeItem("loggedInUser");
                      localStorage.removeItem("userId");
                    }
                    
                    // Clear additional session data
                    localStorage.removeItem("isTimeInConfirmed");
                    localStorage.removeItem("timeIn");
                    
                    debounceSetProfile(null);
                    
                    // Force redirect to clean login after token expiry
                    if (error.response?.status === 401) {
                      console.log("Token expired (401), forcing redirect to clean login");
                      // Only redirect if not already on the staff-login page
                      setTimeout(() => {
                        if (!window.location.pathname.startsWith('/staff-login')) {
                          window.location.href = '/staff-login?sessionExpired=true';
                        }
                        // If already on /staff-login, do nothing (prevents unwanted ?sessionExpired=true on fresh visits)
                      }, 100);
                    }
                  })
                  .finally(() => setLoading(false));
                return;
              } else {
                console.warn("No token found, clearing profile.");
                debounceSetProfile(null);
              }
            } else {
              console.warn("Invalid profile in localStorage:", parsedProfile);
              debounceSetProfile(null);
            }
          } catch (parseError) {
            console.error("Failed to parse stored profile:", parseError);
            debounceSetProfile(null);
          }
        } else {
          debounceSetProfile(null);
        }
        setLoading(false);
      } catch (error) {
        console.error("An unexpected error occurred in loadProfile:", error);
        setError(error.message || "Failed to load profile");
        debounceSetProfile(null);
        setLoading(false);
      }
    };
    loadProfile();
    const handleStorageUpdate = (e) => {
      // Ignore storage events during logout to prevent auto re-login
      if (isLoggingOut) {
        console.log("Ignoring storage event during logout:", e.key);
        return;
      }
      
      // Check current interface context
      const currentPath = window.location.pathname;
      const isStaffInterface = currentPath.includes('/staff') || currentPath.includes('/manager');
      const isCustomerInterface = !isStaffInterface;
      
      // Handle storage events with interface awareness
      if (e.key === "customer_loggedInUser" || e.key === "staff_loggedInUser") {
        console.log(`Storage event for ${e.key}:`, e.newValue);
        
        // Only respond to storage events that match the current interface
        const isCustomerEvent = e.key === "customer_loggedInUser";
        const isStaffEvent = e.key === "staff_loggedInUser";
        
        if ((isCustomerInterface && isStaffEvent) || (isStaffInterface && isCustomerEvent)) {
          console.log(`Ignoring ${e.key} event for ${isStaffInterface ? 'staff' : 'customer'} interface`);
          return;
        }
        
        // If the value is null/empty (cleared), don't restore profile
        if (!e.newValue) {
          console.log("Storage cleared, not restoring profile");
          debounceSetProfile(null);
          return;
        }
        
        try {
          const newProfile = JSON.parse(e.newValue);
          if (newProfile && newProfile.id && newProfile.role) {
            console.log(`Setting profile from ${e.key} for ${isStaffInterface ? 'staff' : 'customer'} interface:`, newProfile);
            debounceSetProfile(newProfile);
          } else {
            debounceSetProfile(null);
          }
        } catch (parseError) {
          console.error("Failed to parse updated profile:", parseError);
          debounceSetProfile(null);
        }
      }
      // Keep legacy support for backward compatibility
      else if (e.key === "loggedInUser") {
        console.log("Storage event for loggedInUser (legacy):", e.newValue);
        // If the value is null/empty (cleared), don't restore profile
        if (!e.newValue) {
          console.log("Legacy storage cleared, not restoring profile");
          debounceSetProfile(null);
          return;
        }
        
        // Only process legacy events if no role-specific storage exists
        const hasCustomerStorage = localStorage.getItem("customer_loggedInUser");
        const hasStaffStorage = localStorage.getItem("staff_loggedInUser");
        
        if (!hasCustomerStorage && !hasStaffStorage) {
          try {
            const newProfile = JSON.parse(e.newValue);
            if (newProfile && newProfile.id && newProfile.role) {
              debounceSetProfile(newProfile);
            } else {
              debounceSetProfile(null);
            }
          } catch (parseError) {
            console.error("Failed to parse updated profile:", parseError);
            debounceSetProfile(null);
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageUpdate);
    return () => window.removeEventListener("storage", handleStorageUpdate);
  }, [debounceSetProfile, isLoggingOut]);
  const updateProfile = useCallback(
    (updatedProfile) => {
      if (!updatedProfile) {
        console.log("Clearing profile data and all session storage");
        debounceSetProfile(null);
        
        // Clear ALL possible storage keys to prevent re-login
        const keysToRemove = [
          "loggedInUser", "customer_loggedInUser", "staff_loggedInUser",
          "token", "customer_token", "staff_token",
          "userId", "customer_userId", "staff_userId",
          "isTimeInConfirmed", "timeIn",
          "lastVisitedPage", "switchModeTimestamp"
        ];
        
        keysToRemove.forEach(key => {
          if (localStorage.getItem(key)) {
            console.log(`Removing ${key} from localStorage`);
            localStorage.removeItem(key);
          }
        });
        
        // Also clear sessionStorage
        sessionStorage.clear();
        
        console.log("All session data cleared successfully");
        return;
      }
      
      if (!updatedProfile.id || !updatedProfile.role) {
        console.warn("Invalid profile data, not updating:", updatedProfile);
        return;
      }
      
      console.log("Updating profile and storing in localStorage:", {
        profile: updatedProfile,
        role: updatedProfile.role,
        token: updatedProfile.token ? "[PRESENT]" : "[MISSING]",
      });
      
      // Merge with existing profile to preserve data
      const currentProfile = profile || {};
      const mergedProfile = {
        ...currentProfile,
        ...updatedProfile,
      };
      
      // Only update if the profile has actually changed
      const hasChanged = !profile || JSON.stringify(profile) !== JSON.stringify(mergedProfile);
      if (hasChanged) {
        debounceSetProfile(mergedProfile);
      } else {
        console.log('Profile data unchanged, skipping update');
        return;
      }
      
      // Store based on role - ONLY use role-specific keys (allow concurrent sessions)
      if (updatedProfile.role === 'customer') {
        console.log('Setting customer session tokens');
        localStorage.setItem("customer_loggedInUser", JSON.stringify(mergedProfile));
        if (updatedProfile.token) {
          localStorage.setItem("customer_token", updatedProfile.token);
        }
        localStorage.setItem("customer_userId", String(mergedProfile.id));
        console.log('Customer session tokens set');
      } else {
        // Staff or manager
        console.log('Setting staff session tokens');
        localStorage.setItem("staff_loggedInUser", JSON.stringify(mergedProfile));
        if (updatedProfile.token) {
          localStorage.setItem("staff_token", updatedProfile.token);
        }
        localStorage.setItem("staff_userId", String(mergedProfile.id));
        console.log('Staff session tokens set');
      }
      
      // Use role-specific storage event to prevent cross-role conflicts
      const storageKey = updatedProfile.role === 'customer' ? 'customer_loggedInUser' : 'staff_loggedInUser';
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: storageKey,
          newValue: JSON.stringify(mergedProfile),
        })
      );
    },
    [debounceSetProfile, profile]
  );

  return (
    <ProfileContext.Provider value={{
      profile,
      updateProfile,
      loading,
      error,
      setIsLoggingOut,
      // Centralized login modal and state
      isSignInOpen,
      setIsSignInOpen,
      handleSignIn,
      signInPhoneNumber,
      setSignInPhoneNumber,
      signInPassword,
      setSignInPassword,
      signInErrors,
      setSignInErrors,
      loadingSignIn,
      setLoadingSignIn,
      showSignInPassword,
      setShowSignInPassword,
      handleForgotPassword,
      openSignUpFromSignIn,
    }}>
      {children}
      {/* Centralized Login Modal */}
      <Modal
        isOpen={isSignInOpen}
        onRequestClose={() => setIsSignInOpen(false)}
        contentLabel="Sign In Modal"
        className={styles["homepage-signin-modal"]}
        overlayClassName={styles["homepage-signin-overlay"]}
        parentSelector={() => document.body}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        preventScroll={true}
      >
        <animated.div
          style={{
            ...signInAnimation,
            width: '1000px',
            maxWidth: '100vw',
            minWidth: '320px',
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
              <span className={styles["have-account-homepage"]}>
                Don't have an account?{" "}
              </span>
              <span
                onClick={openSignUpFromSignIn}
                className={styles["sign-in-text-homepage"]}
                style={{ fontWeight: "bold" }}
              >
                Sign Up
              </span>
            </div>
          </div>
          <div className={styles["homepage-signin-right-section"]}>
            <h2 className={styles["sign-up-heading-homepage"]}>Sign In</h2>
            {loadingSignIn && <div>Loading...</div>}
            <form onSubmit={handleSignIn} className={styles["sign-up-form-homepage"]}>
              <label htmlFor="signInPhoneNumber">Phone Number</label>
              <div style={{ position: "relative" }}>
                <MdPhone
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signInErrors.phoneNumber ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type="tel"
                  id="signInPhoneNumber"
                  value={signInPhoneNumber}
                  onChange={(e) => {
                    setSignInPhoneNumber(e.target.value);
                    setSignInErrors((prev) => ({ ...prev, phoneNumber: "" }));
                  }}
                  placeholder="Enter your phone number"
                  required
                  style={{
                    paddingLeft: "40px",
                    color: signInErrors.phoneNumber ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signInErrors.phoneNumber
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
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
                  disabled={loadingSignIn}
                />
              </div>
              {signInErrors.phoneNumber && (
                <p className={styles["error-homepage"]}>{signInErrors.phoneNumber}</p>
              )}
              <label htmlFor="signInPassword">Password</label>
              <div style={{ position: "relative" }}>
                <MdLock
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "10px",
                    transform: "translateY(-50%)",
                    color: signInErrors.password ? "red" : "#1a1a1a",
                    fontSize: "1.2rem",
                  }}
                />
                <input
                  type={showSignInPassword ? 'text' : 'password'}
                  id="signInPassword"
                  value={signInPassword}
                  onChange={(e) => {
                    setSignInPassword(e.target.value);
                    setSignInErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  placeholder="Enter your password"
                  required
                  style={{
                    paddingLeft: "40px",
                    color: signInErrors.password ? "red" : "#1a1a1a",
                    backgroundColor: "#ffffff",
                    border: signInErrors.password
                      ? "2px solid red"
                      : "1px solid #1a1a1a",
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
                    paddingRight: '40px',
                  }}
                  disabled={loadingSignIn}
                />
                <span
                  onClick={() => setShowSignInPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '10px',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#1a1a1a',
                    fontSize: '1.2rem'
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignInPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </span>
              </div>
              {signInErrors.password && (
                <p className={styles["error-homepage"]}>{signInErrors.password}</p>
              )}
              <button
                type="submit"
                className={styles["sign-up-btn-homepage"]}
                disabled={loadingSignIn}
              >
                {loadingSignIn ? "Signing In..." : "Sign In"}
              </button>
              
              <p className={styles["forgot-password-homepage"]}>
                <span 
                  onClick={handleForgotPassword}
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                >
                  Forgot Password?
                </span>
              </p>
            </form>
          </div>
          <button
            className={styles["close-btn-homepage"]}
            onClick={() => {
              setIsSignInOpen(false);
              setSignInPhoneNumber("");
              setSignInPassword("");
              setSignInErrors({ phoneNumber: "", password: "" });
              setLoadingSignIn(false);
            }}
          >
            x
          </button>
        </animated.div>
      </Modal>
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  return useContext(ProfileContext);
};
