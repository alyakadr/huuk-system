import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProfile } from "../../ProfileContext";

const SwitchModeButton = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();

  // Only show the button if user is a manager
  if (!profile || profile.role !== "manager") {
    return null;
  }

  const isInStaffMode = location.pathname.startsWith("/staff");

  const modeText = isInStaffMode
    ? "Switch to Manager Mode"
    : "Switch to Staff Mode";

  const handleModeSwitch = () => {
    // Store current page context in localStorage
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const currentHash = location.hash;
    const fullCurrentPath = `${currentPath}${currentSearch}${currentHash}`;

    localStorage.setItem("lastVisitedPage", fullCurrentPath);
    localStorage.setItem("switchModeTimestamp", Date.now().toString());

    if (isInStaffMode) {
      // Switch to manager mode
      // Try to find equivalent manager page, otherwise go to dashboard
      const managerEquivalentPaths = {
        "/staff": "/manager",
        "/staff/attendance": "/manager",
        "/staff/schedule": "/manager",
        "/staff/appointments": "/manager/appointment-management",
        "/staff/payments": "/manager/payment-summary",
        "/staff/reports": "/manager/sales-report",
        "/staff/settings": "/manager/settings",
        "/staff/edit-profile": "/manager/edit-profile",
      };

      const targetPath = managerEquivalentPaths[currentPath] || "/manager";
      navigate(targetPath);
    } else {
      // Switch to staff mode
      // Try to find equivalent staff page, otherwise go to dashboard
      const staffEquivalentPaths = {
        "/manager": "/staff",
        "/manager/appointment-management": "/staff/appointments",
        "/manager/payment-summary": "/staff/payments",
        "/manager/sales-report": "/staff/reports",
        "/manager/settings": "/staff/settings",
        "/manager/edit-profile": "/staff/edit-profile",
      };

      const targetPath = staffEquivalentPaths[currentPath] || "/staff";
      navigate(targetPath);
    }
  };

  return (
    <div
      className={`switch-mode-container ${className || ""}`}
      onClick={handleModeSwitch}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleModeSwitch();
        }
      }}
      aria-label={modeText}
    >
      <button className="switch-mode-button" type="button">
        <span className="icon-plus">+</span>

        <div className="icon-close-wrapper">
          <div className="icon-arrow-text">
            <svg
              className="icon-user-arrow"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="24px"
              height="24px"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="8"></circle>
              <circle cx="12" cy="11" r="3"></circle>
              <path d="M16.94,18.29a5,5,0,0,0-9.88,0"></path>
              <polyline points="6 1 3 4 12 4"></polyline>
              <polyline points="18 23 21 20 12 20"></polyline>
            </svg>
            <span className="switch-mode-tooltip">{modeText}</span>
          </div>

          <span className="icon-close">+</span>
        </div>
      </button>
    </div>
  );
};

export default SwitchModeButton;
