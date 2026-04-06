import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import logo from "../../assets/logo.PNG";
import defaultProfilePic from "../../assets/default-picture-cust.jpg";

const CustHeader = ({
  isLoggedIn,
  openSignInModal,
  scrollToSection,
  refs,
  loggedInUsername,
}) => {
  const navigate = useNavigate();
  const { updateProfile } = useProfile();
  const [activeSection, setActiveSection] = useState("hero");

  // Removed excessive logging that was causing performance issues
  // console.log("CustHeader props:", {
  //   isLoggedIn,
  //   loggedInUsername,
  //   profile: useProfile().profile,
  // });

  const handleLogout = () => {
    console.log('🧹 Logging out customer from CustHeader...');
    try {
      // Clear session storage
      sessionStorage.clear();
      
      // Use ProfileContext's proper logout method (handles localStorage properly)
      updateProfile(null);
      
      console.log('✅ Customer logged out successfully from CustHeader');
      
      // Navigate to home
      navigate("/", { replace: true });
      
      // Reload to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleNavClick = (section) => {
    console.log(`Nav button clicked: ${section}`);
    setActiveSection(section);
    scrollToSection(refs[`${section}Ref`]);
  };

  return (
    <header className="cust-header">
      <img src={logo} alt="HUUK Logo" className="cust-logo" />
      <nav className="cust-nav">
        <button 
          onClick={() => handleNavClick("hero")}
          className={activeSection === "hero" ? "active" : ""}
        >
          HOME
        </button>
        <button 
          onClick={() => handleNavClick("booking")}
          className={activeSection === "booking" ? "active" : ""}
        >
          BOOKING
        </button>
        {isLoggedIn && (
          <button 
            onClick={() => handleNavClick("bookingHistory")}
            className={activeSection === "bookingHistory" ? "active" : ""}
          >
            MY HISTORY
          </button>
        )}
        <button 
          onClick={() => handleNavClick("aboutUs")}
          className={activeSection === "aboutUs" ? "active" : ""}
        >
          ABOUT US
        </button>
        <button 
          onClick={() => handleNavClick("gallery")}
          className={activeSection === "gallery" ? "active" : ""}
        >
          GALLERY
        </button>
        <button 
          onClick={() => handleNavClick("location")}
          className={activeSection === "location" ? "active" : ""}
        >
          LOCATION
        </button>
        <button 
          onClick={() => handleNavClick("services")}
          className={activeSection === "services" ? "active" : ""}
        >
          SERVICE
        </button>
      </nav>
      <div className="cust-auth">
        {isLoggedIn ? (
          <div className="cust-auth-logged-in">
            <span className="cust-welcome-text">
              Welcome, {loggedInUsername || "User"}!
            </span>
            <a href="/profile" className="cust-profile-icon">
              <img
                src={defaultProfilePic}
                alt="Profile"
                className="cust-profile-pic"
              />
            </a>
            <button
              onClick={handleLogout}
              className="cust-logout-btn"
              style={{ cursor: "pointer" }}
            >
              LOGOUT
            </button>
          </div>
        ) : (
          <div className="cust-login-container">
            <a onClick={openSignInModal} className="cust-login-btn">
              Please Sign In/Sign Up
            </a>
            <img
              src={defaultProfilePic}
              alt="Default Profile"
              className="cust-default-profile-pic"
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default CustHeader;
