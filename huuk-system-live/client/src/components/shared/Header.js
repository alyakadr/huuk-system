import React, { useState, useEffect } from "react";
import moment from "moment";
import "../../styles/header.css";
import logo from "../../assets/logo.PNG";

const Header = ({
  logoSrc,
  username,
  role,
  minimized,
  pageTitle,
  mode, // Add mode prop
}) => {
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(
    moment().format("HH:mm")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    setCurrentTimeDisplay(moment().format("HH:mm"));
    const timer = setInterval(() => {
      setCurrentTimeDisplay(moment().format("HH:mm"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getDate = () => {
    return moment().format("dddd, D MMMM YYYY");
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchClear = () => {
    setSearchQuery("");
  };

  const handleNotificationToggle = () => {
    setNotificationOpen(!notificationOpen);
  };

  const sampleNotifications = [
    {
      id: 1,
      type: "appointment",
      message: "New appointment scheduled for tomorrow",
      time: "5 min ago",
      unread: true
    },
    {
      id: 2,
      type: "reminder",
      message: "Staff meeting in 30 minutes",
      time: "10 min ago",
      unread: true
    },
    {
      id: 3,
      type: "update",
      message: "System update completed successfully",
      time: "1 hour ago",
      unread: false
    }
  ];

  return (
    <header className={`header ${minimized ? "minimized" : ""}`}>
      <div className="header-left">
        <div className="header-logo-container">
          <img src={logo} alt="Company Logo" className="header-logo" />
        </div>
        <div className="header-text">
          <h1 className="header-title">
            {pageTitle || `Welcome back, ${username}!`} {" "}
            {role === "manager" && mode && (
              <span className="header-mode-badge">
                <span className="bi bi-eye header-mode-badge-icon"></span>{" "}
                {mode}
              </span>
            )}
          </h1>
          <p className="header-date">
            {getDate()}, {currentTimeDisplay}
          </p>
        </div>
      </div>
      <div className="header-actions">
        {/* Search Bar */}
        <div className={`header-search-bar-container ${searchFocused ? 'focused' : ''}`}>
          <div className="header-search-input-wrapper">
            <input
              type="text"
              className="header-search-bar"
              placeholder="Search customers, appointments, staff..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <i className="bi bi-search header-search-icon"></i>
            {searchQuery && (
              <i 
                className="bi bi-x-circle header-clear-icon"
                onClick={handleSearchClear}
              ></i>
            )}
          </div>
        </div>

        {/* Notification Icon */}
        <div className="header-notification-container">
          <button 
            className="header-notification-button"
            onClick={handleNotificationToggle}
          >
            <i className="bi bi-bell header-notification-icon"></i>
          </button>
          
          {notificationOpen && (
            <div className="header-notification-dropdown">
              <h3 className="header-notification-title">Notifications</h3>
              <div className="header-notification-content">
                {sampleNotifications.length > 0 ? (
                  <ul className="header-notification-list">
                    {sampleNotifications.map((notification) => (
                      <li key={notification.id} className={`header-notification-item ${notification.unread ? 'unread' : ''}`}>
                        <div className="header-notification-icon-wrapper">
                          <i className={`bi bi-${notification.type === 'appointment' ? 'calendar' : notification.type === 'reminder' ? 'clock' : 'info-circle'} header-notification-type-icon`}></i>
                        </div>
                        <div className="header-notification-body">
                          <div className="header-notification-text">{notification.message}</div>
                          <div className="header-notification-time">{notification.time}</div>
                        </div>
                        {notification.unread && <div className="header-notification-unread-indicator"></div>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="header-notification-empty">
                    <i className="bi bi-bell-slash" style={{fontSize: '48px', marginBottom: '12px', opacity: '0.5'}}></i>
                    <p>No notifications</p>
                  </div>
                )}
              </div>
              <div className="header-notification-actions">
                <button className="header-mark-all-read">
                  <i className="bi bi-check2-all"></i>
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
