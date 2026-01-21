import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

const ProfileContext = createContext();

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "http://localhost:5000/api";

  // Memoize setProfile to prevent rapid updates - remove logging that causes re-renders
  const debounceSetProfile = useCallback((newProfile) => {
    // Only log when there's a significant profile change
    if (newProfile?.id !== profile?.id || (!newProfile && profile)) {
      console.log("Setting profile:", newProfile?.id ? `[User ID: ${newProfile.id}]` : "[Logged out]");
    }
    setProfile(newProfile);
  }, [profile?.id]);

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
    <ProfileContext.Provider value={{ profile, updateProfile, loading, error, setIsLoggingOut }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  return useContext(ProfileContext);
};
