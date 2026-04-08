import React, { useState, useEffect } from "react";
import moment from "moment";
import logo from "../../assets/logo.PNG";

const Header = ({
  logoSrc,
  username,
  role,
  minimized,
  pageTitle,
  mode,
  isMobile = false,
  isTablet = false,
  layoutLeftOffset,
  layoutWidth,
}) => {
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(moment().format("HH:mm"));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeDisplay(moment().format("HH:mm")), 1000);
    return () => clearInterval(timer);
  }, []);

  const getDate = () => moment().format("dddd, D MMMM YYYY");

  const sampleNotifications = [
    { id: 1, type: "appointment", message: "New appointment scheduled for tomorrow", time: "5 min ago", unread: true },
    { id: 2, type: "reminder", message: "Staff meeting in 30 minutes", time: "10 min ago", unread: true },
    { id: 3, type: "update", message: "System update completed successfully", time: "1 hour ago", unread: false },
  ];

  const leftOffset = layoutLeftOffset || (isMobile ? "72px" : minimized ? "77px" : "285px");
  const headerWidth = layoutWidth || (isMobile
    ? "calc(100% - 72px)"
    : minimized
      ? "calc(100% - 77px)"
      : "calc(100% - 285px)");
  const mobileSearchWidth = "min(52vw, 210px)";
  const tabletSearchWidth = "min(32vw, 240px)";

  return (
    <header
      className="flex justify-between items-start z-[1000] box-border"
      style={{
        position: "fixed",
        top: 0,
        left: leftOffset,
        width: headerWidth,
        marginTop: isMobile ? "0" : "-20px",
        marginLeft: isMobile ? "0" : "-15px",
        transition: "left 0.3s ease, width 0.3s ease",
        background: "transparent",
        padding: isMobile ? "10px 8px 0 8px" : isTablet ? "8px 18px 0 6px" : "0",
      }}
    >
      {/* Left: logo + title + date */}
      <div className="flex flex-col items-start gap-2">
        <div className="flex-shrink-0">
          <img
            src={logo}
            alt="Company Logo"
            className={isMobile ? "h-[68px] w-auto block" : isTablet ? "h-[86px] w-auto block" : "h-[120px] w-auto block"}
          />
        </div>
        <div className="text-left flex-1" style={{ marginLeft: isMobile ? "4px" : isTablet ? "12px" : "20px", marginTop: isMobile ? "-10px" : isTablet ? "-12px" : "-20px", maxWidth: isMobile ? "calc(100vw - 190px)" : isTablet ? "calc(100vw - 360px)" : "none" }}>
          <h1 className={isMobile ? "text-base font-bold text-white text-left m-0 leading-snug" : isTablet ? "text-2xl font-bold text-white text-left m-0 leading-snug" : "text-3xl font-bold text-white text-left m-0"} style={{ fontFamily: "Montserrat, sans-serif" }}>
            {pageTitle || `Welcome back, ${username}!`}{" "}
            {role === "manager" && mode && (
              <span className={isMobile ? "inline-flex items-center text-[#ababab] font-bold text-[11px] ml-1.5 px-2 py-0.5 rounded-[16px] select-none" : "inline-flex items-center text-[#ababab] font-bold text-[15px] ml-2.5 px-3 py-1 rounded-[20px] select-none"}>
                <i className={isMobile ? "bi bi-eye text-[14px] mr-1.5" : "bi bi-eye text-[25px] mr-2.5"} />
                {mode}
              </span>
            )}
          </h1>
          <p className={isMobile ? "text-[#ffc50f] font-semibold text-[11px] m-0" : isTablet ? "text-[#ffc50f] font-semibold text-sm m-0" : "text-[#ffc50f] font-semibold text-lg m-0"} style={{ fontFamily: "Montserrat, sans-serif" }}>
            {getDate()}, {currentTimeDisplay}
          </p>
        </div>
      </div>

      {/* Right: search + notifications */}
      <div
        className="absolute flex items-center gap-2 flex-row-reverse"
        style={{ right: isMobile ? "8px" : isTablet ? "24px" : "300px", top: isMobile ? "10px" : isTablet ? "28px" : "50px", flexWrap: "nowrap" }}
      >
        {/* Search bar */}
        <div
          className="relative z-[1100]"
          style={{ width: isMobile ? mobileSearchWidth : isTablet ? tabletSearchWidth : "220px", minWidth: isMobile ? "120px" : isTablet ? "170px" : "180px" }}
        >
          <div
            className="relative w-full flex items-center rounded-[18px] transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, rgba(30,41,59,0.95) 0%,rgba(15,23,42,0.95) 100%)",
              border: searchFocused ? "2px solid #3b82f6" : "2px solid transparent",
              backdropFilter: "blur(15px)",
              boxShadow: searchFocused
                ? "0 0 0 4px rgba(59,130,246,0.12),0 12px 32px -8px rgba(59,130,246,0.25)"
                : "0 4px 12px -2px rgba(0,0,0,0.12)",
            }}
          >
            <i className="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none z-[1]" />
            <input
              type="text"
              className="w-full bg-transparent outline-none font-quicksand placeholder-slate-500 rounded-[16px]"
              style={{
                padding: isMobile ? "10px 34px" : isTablet ? "9px 44px" : "8px 50px",
                color: "white",
                fontSize: isMobile ? "12px" : isTablet ? "13px" : "14px",
              }}
              placeholder={isMobile ? "Search..." : isTablet ? "Search staff or bookings..." : "Search customers, appointments, staff..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchQuery && (
              <i
                className="bi bi-x-circle absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg cursor-pointer hover:text-red-400 z-[1]"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>
        </div>

        {/* Bell icon */}
        <div className="relative flex-shrink-0">
          <button
            className="flex items-center justify-center rounded-[16px] cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
            style={{
              width: isMobile ? "42px" : isTablet ? "44px" : "44px",
              height: isMobile ? "42px" : isTablet ? "44px" : "44px",
              background: "linear-gradient(135deg,rgba(30,41,59,0.9) 0%,rgba(15,23,42,0.9) 100%)",
              border: "2px solid transparent",
              backdropFilter: "blur(15px)",
              boxShadow: "0 4px 12px -2px rgba(0,0,0,0.12)",
              color: "white",
            }}
            aria-label="Open notifications"
            onClick={() => setNotificationOpen(!notificationOpen)}
          >
            <i className={isMobile ? "bi bi-bell text-[18px] leading-none" : isTablet ? "bi bi-bell text-[20px] leading-none" : "bi bi-bell text-[22px] leading-none"} />
          </button>

          {notificationOpen && (
            <div
              className="absolute right-0 top-[calc(100%+8px)] rounded-[20px] overflow-hidden flex flex-col z-[1300]"
              style={{
                width: isMobile ? "min(320px, calc(100vw - 84px))" : "400px",
                maxWidth: "calc(100vw - 84px)",
                background: "linear-gradient(145deg,rgba(255,255,255,0.98) 0%,rgba(248,250,252,0.98) 100%)",
                color: "#1f2937",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
                border: "2px solid rgba(255,255,255,0.2)",
                backdropFilter: "blur(24px)",
                animation: "fadeInDown 0.3s ease",
              }}
            >
              <h3 className="text-lg font-bold m-0 px-6 py-5 border-b border-gray-200 text-gray-900 font-quicksand">
                Notifications
              </h3>
              <ul className="list-none p-0 m-0 overflow-y-auto max-h-[300px]">
                {sampleNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 px-6 py-3 border-b border-gray-100 last:border-b-0 ${n.unread ? "bg-blue-50/50" : ""}`}
                  >
                    <i className={`bi bi-${n.type === "appointment" ? "calendar" : n.type === "reminder" ? "clock" : "info-circle"} text-huuk-blue text-lg mt-0.5`} />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 m-0">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5 m-0">{n.time}</p>
                    </div>
                    {n.unread && <span className="w-2 h-2 rounded-full bg-huuk-blue mt-1 flex-shrink-0" />}
                  </li>
                ))}
              </ul>
              <div className="px-6 py-3 border-t border-gray-200">
                <button className="flex items-center gap-1 text-huuk-blue text-sm font-bold bg-transparent border-none cursor-pointer hover:underline font-quicksand">
                  <i className="bi bi-check2-all" /> Mark all as read
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
