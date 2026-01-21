import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/sidebar.css";
import { useProfile } from "../../ProfileContext";
import Cookies from "js-cookie";

// Create a default profile picture as data URL
const defaultProfile = "data:image/svg+xml,%3Csvg width='130' height='130' viewBox='0 0 130 130' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='130' height='130' rx='65' fill='%23e5e7eb'/%3E%3Ccircle cx='65' cy='45' r='18' fill='%239ca3af'/%3E%3Cpath d='M35 100c0-16.57 13.43-30 30-30s30 13.43 30 30v10H35v-10z' fill='%239ca3af'/%3E%3C/svg%3E";

const Sidebar = ({ user, navItems, minimized, toggleSidebar }) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, updateProfile, setIsLoggingOut } = useProfile();
  const baseURL = "http://localhost:5000";

  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  // Sync profile context with user data
  useEffect(() => {
    if (user && user.id && (!profile || profile.id !== user.id)) {
      console.log('Syncing profile context with user data:', user);
      updateProfile(user);
    }
  }, [user?.id, profile?.id, updateProfile]);

  // Track profile picture changes for smooth updates
  const [profileImageUrl, setProfileImageUrl] = useState(defaultProfile);
  const [imageLoading, setImageLoading] = useState(false);
  const [failedUrls, setFailedUrls] = useState(new Set());
  
  // Update profile image URL when profile changes
  useEffect(() => {
    const profilePicture = profile?.profile_picture || user?.profile_picture;
    
    // If profile picture is default or null, use default immediately
    if (!profilePicture || profilePicture === '/Uploads/profile_pictures/default.jpg') {
      if (profileImageUrl !== defaultProfile) {
        console.log('Using default profile picture');
        setProfileImageUrl(defaultProfile);
        setImageLoading(false);
        // Clear failed URLs for future attempts
        setFailedUrls(new Set());
      }
      return;
    }
    
    // Ensure the URL is properly formatted
    const url = profilePicture.startsWith('http') 
      ? profilePicture 
      : `${baseURL}${profilePicture}`;
    
    // Force refresh on profile picture changes - clear failed URLs cache
    const profileChanged = profile?.profile_picture && profile.profile_picture !== user?.profile_picture;
    if (profileChanged) {
      console.log('Profile picture changed, clearing failed URLs cache');
      setFailedUrls(new Set());
    }
    
    // Check if this URL has already failed before (skip if profile just changed)
    if (!profileChanged && failedUrls.has(url)) {
      console.log('Profile picture URL previously failed, using default:', url);
      setProfileImageUrl(defaultProfile);
      return;
    }
    
    // Update if URL has changed or if we need to force refresh
    if (url !== profileImageUrl && !imageLoading) {
      console.log('Profile picture URL updated:', url);
      setImageLoading(true);
      
      // Test if the image can be loaded with better error handling
      const img = new Image();
      
      // Add cache busting for new uploads
      const cacheBustedUrl = profileChanged ? `${url}?t=${Date.now()}` : url;
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.warn('Profile image load timeout, marking as failed:', url);
        setFailedUrls(prev => new Set([...prev, url]));
        setProfileImageUrl(defaultProfile);
        setImageLoading(false);
      }, 5000); // Increased timeout for new uploads
      
      img.onload = () => {
        clearTimeout(timeoutId);
        console.log('Profile image loaded successfully:', url);
        setProfileImageUrl(url);
        setImageLoading(false);
        // Remove from failed URLs if it was there
        setFailedUrls(prev => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      };
      img.onerror = (error) => {
        clearTimeout(timeoutId);
        console.warn('Profile image failed to load, marking as failed:', url);
        setFailedUrls(prev => new Set([...prev, url]));
        setProfileImageUrl(defaultProfile);
        setImageLoading(false);
      };
      
      // Set source with cache busting if needed
      img.src = cacheBustedUrl;
    }
  }, [profile?.profile_picture, user?.profile_picture, profileImageUrl, imageLoading, failedUrls, baseURL]);
  
  // Get the profile picture URL
  const getProfilePictureUrl = () => {
    return profileImageUrl;
  };

  const handleLogout = () => {
    // Set a flag to prevent any re-authentication attempts during logout
    localStorage.setItem('FORCE_LOGOUT_IN_PROGRESS', 'true');
    
    // Set logging out flag to prevent auto re-login in ProfileContext
    if (setIsLoggingOut) {
      setIsLoggingOut(true);
    }
    
    // STEP 1: Clear ProfileContext first to prevent re-authentication
    try {
      updateProfile(null);
    } catch (error) {
      console.error('Error clearing ProfileContext:', error);
    }
    
    // STEP 2: Clear all authentication cookies
    try {
      Cookies.remove("email");
    } catch (error) {
      console.error('Error clearing cookies:', error);
    }
    
    // STEP 3: Aggressively clear ALL localStorage items that could contain auth data
    const keysToRemove = [
      'staff_loggedInUser', 'staff_token', 'staff_userId',
      'customer_loggedInUser', 'customer_token', 'customer_userId',
      'loggedInUser', 'token', 'userId',
      'isTimeInConfirmed', 'timeIn',
      'lastVisitedPage', 'switchModeTimestamp',
      'FORCE_LOGOUT_IN_PROGRESS' // Clear this last
    ];
    
    keysToRemove.forEach(key => {
      try {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.error(`Error removing ${key}:`, error);
      }
    });
    
    // STEP 4: Clear session storage completely
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
    
    // STEP 5: Force immediate redirect to clean login interface
    setTimeout(() => {
      try {
        // Final cleanup of the logout flag
        localStorage.removeItem('FORCE_LOGOUT_IN_PROGRESS');
        // Redirect with fromLogout parameter to show clean login interface
        window.location.replace('/staff-login?fromLogout=true');
      } catch (error) {
        console.error('Error during redirect:', error);
        // Fallback redirect with parameter
        window.location.href = '/staff-login?fromLogout=true';
      }
    }, 250); // Small delay to ensure all cleanup is complete
  };

  const handleEditProfile = () => {
    if (user?.role === "manager") {
      navigate("/manager/edit-profile");
    } else if (user?.role === "staff") {
      navigate("/staff/edit-profile");
    } else {
      navigate("/edit-profile");
    }
  };

  return (
    <div
      key={location.pathname}
      className={`sidebar ${minimized ? "minimized" : ""}`}
    >
      <div className="sidebar-top-sticky">
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={minimized ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="material-icons">
            {minimized ? "chevron_right" : "chevron_left"}
          </span>
        </button>

        <div
          className="sidebar-profile"
          onClick={handleEditProfile}
          style={{
            position: "relative",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          <img
            src={getProfilePictureUrl()}
            alt="Profile"
            className={`profile-img ${minimized ? "small" : ""}`}
            onError={(e) => {
              console.log('Profile image onError triggered, using default');
              // Prevent infinite loop by only setting default if not already default
              if (e.target.src !== defaultProfile) {
                e.target.src = defaultProfile;
              }
            }}
          />
          <div
            className="edit-profile-overlay"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.7)",
              borderRadius: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.3s ease",
              color: "white",
              fontSize: "12px",
              fontWeight: "bold",
              zIndex: 10,
            }}
          >
            {!minimized && (
              <>
                <span
                  className="material-icons"
                  style={{
                    fontSize: "20px",
                    marginBottom: "4px",
                  }}
                >
                  edit
                </span>
                <span>Edit Profile</span>
              </>
            )}
            {minimized && (
              <span
                className="material-icons"
                style={{
                  fontSize: "20px",
                }}
              >
                edit
              </span>
            )}
          </div>
          {!minimized && (
            <>
              <h2 className="profile-name">{profile?.username || user?.username || "User"}</h2>
              <p className="profile-role" style={{ marginBottom: "15px", marginTop: "0px" }}>
                {(profile?.role || user?.role)
                  ? (profile?.role || user?.role).charAt(0).toUpperCase() + (profile?.role || user?.role).slice(1)
                  : "Role"}
              </p>
              {(profile?.role || user?.role) === "staff" && (
                <p className="profile-outlet">{profile?.outlet || user?.outlet || "Outlet"}</p>
              )}
            </>
          )}
        </div>
      </div>

      <nav className="sidebar-nav-scroll">
        <ul>
          {navItems.map((item) => {
            const hasSubNav = !!item.subNav;
            const isOpen = openDropdown === item.label;
            const isActive =
              item.path === location.pathname ||
              (hasSubNav &&
                item.subNav.some((sub) => sub.path === location.pathname));

            return (
              <li key={item.label}>
                <div
                  className={`sidebar-item ${isActive ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                  onClick={() => {
                    if (item.disabled) {
                      return; // Prevent navigation for disabled items
                    }
                    if (hasSubNav) {
                      setOpenDropdown(isOpen ? null : item.label);
                    } else if (item.path) {
                      navigate(item.path);
                      setOpenDropdown(null);
                    }
                  }}
                  title={minimized ? (item.disabled ? `${item.label} (Disabled)` : item.label) : undefined}
                  style={{
                    cursor: item.disabled ? "not-allowed" : (hasSubNav || item.path ? "pointer" : "default"),
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  <span className="material-icons sidebar-icon">
                    {item.icon}
                  </span>
                  {!minimized && item.label}
                </div>

                {isOpen && hasSubNav && !minimized && (
                  <ul className="sidebar-subnav">
                    {item.subNav.map((subItem) => (
                      <li
                        key={subItem.label}
                        className={`sidebar-subnav-item ${
                          subItem.path === location.pathname ? "active" : ""
                        } ${subItem.disabled ? "disabled" : ""}`}
                        onClick={() => {
                          if (subItem.disabled) {
                            return; // Prevent navigation for disabled subnav items
                          }
                          navigate(subItem.path);
                          setOpenDropdown(null);
                        }}
                        style={{
                          cursor: subItem.disabled ? "not-allowed" : "pointer",
                          opacity: subItem.disabled ? 0.5 : 1,
                        }}
                      >
                        {subItem.label}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {!openDropdown && (
        <nav className="sidebar-footer-nav sticky-footer">
          <ul>
            <li className="sidebar-item" title="Help">
              <span className="material-icons sidebar-icon">help_outline</span>
              {!minimized && "Help"}
            </li>
            <li
              className="sidebar-item"
              title="Setting"
              onClick={() => {
                if (user?.role === "manager") navigate("/manager/settings");
                else if (user?.role === "staff") navigate("/staff/settings");
                else navigate("/");
              }}
            >
              <span className="material-icons sidebar-icon">settings</span>
              {!minimized && "Setting"}
            </li>
            <li
              className="sidebar-item"
              onClick={handleLogout}
              style={{ cursor: "pointer" }}
              title="Log Out"
            >
              <span className="material-icons sidebar-icon">logout</span>
              {!minimized && "Log Out"}
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
};

export default Sidebar;
