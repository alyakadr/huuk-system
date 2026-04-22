import React, { useEffect, useState } from "react";
import moment from "moment";
import logo from "../../assets/logo.PNG";

const Header = ({
  username,
  role,
  minimized,
  pageTitle,
  mode,
  isMobile = false,
  isTablet = false,
  /** When true, header is sticky at the top of the main scroll column (preferred). */
  sticky = true,
  layoutLeftOffset,
  layoutWidth,
}) => {
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(
    moment().format("HH:mm"),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeDisplay(moment().format("HH:mm"));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const sampleNotifications = [
    {
      id: 1,
      type: "appointment",
      message: "New appointment scheduled for tomorrow",
      time: "5 min ago",
      unread: true,
    },
    {
      id: 2,
      type: "reminder",
      message: "Staff meeting in 30 minutes",
      time: "10 min ago",
      unread: true,
    },
    {
      id: 3,
      type: "update",
      message: "System update completed successfully",
      time: "1 hour ago",
      unread: false,
    },
  ];

  const getDate = () => moment().format("dddd, D MMMM YYYY");
  const leftOffset = layoutLeftOffset || (isMobile ? "72px" : minimized ? "72px" : "236px");
  const headerWidth =
    layoutWidth ||
    (isMobile
      ? "calc(100% - 72px)"
      : minimized
        ? "calc(100% - 72px)"
        : "calc(100% - 236px)");
  const searchWidth = isMobile
    ? "min(42vw, 180px)"
    : isTablet
      ? "min(32vw, 220px)"
      : "240px";

  const stickyMode = Boolean(sticky);

  return (
    <header
      className="box-border z-[1000] w-full flex-shrink-0"
      style={{
        position: stickyMode ? "sticky" : "fixed",
        top: 0,
        left: stickyMode ? undefined : leftOffset,
        width: stickyMode ? "100%" : headerWidth,
        transition: stickyMode ? undefined : "left 0.3s ease, width 0.3s ease",
        padding: isMobile
          ? "0 10px 0 0"
          : isTablet
            ? "0 18px 0 0"
            : "0 24px 0 0",
        pointerEvents: "none",
        backgroundColor: "#0e0d0f",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="pointer-events-auto flex min-w-0 flex-col items-start gap-0">
          <img
            src={logo}
            alt="Company Logo"
            className={`m-0 block w-auto ${
              isMobile
                ? "h-[96px]"
                : isTablet
                  ? "h-[112px]"
                  : "h-[130px]"
            }`}
          />
          <div
            className="min-w-0 text-left"
            style={{
              marginLeft: isMobile ? "10px" : isTablet ? "14px" : "18px",
              marginTop: isMobile ? "-14px" : isTablet ? "-18px" : "-22px",
            }}
          >
            <h1
              className={
                isMobile
                  ? "m-0 text-[15px] font-bold leading-tight text-white"
                  : isTablet
                    ? "m-0 text-[30px] font-bold leading-tight text-white"
                    : "m-0 text-[42px] font-bold leading-tight text-white"
              }
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {pageTitle || `Welcome back, ${username}!`}
              {role === "manager" && mode && (
                <span
                  className={
                    isMobile
                      ? "ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#ababab]"
                      : "ml-3 inline-flex items-center gap-2 text-[18px] font-bold text-[#ababab]"
                  }
                >
                  <i
                    className={
                      isMobile ? "bi bi-eye text-[12px]" : "bi bi-eye text-[18px]"
                    }
                  />
                  {mode}
                </span>
              )}
            </h1>
            <p
              className={
                isMobile
                  ? "m-0 text-[11px] font-semibold text-[#ffc50f]"
                  : isTablet
                    ? "m-0 text-sm font-semibold text-[#ffc50f]"
                    : "m-0 text-[18px] font-semibold text-[#ffc50f]"
              }
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {getDate()}, {currentTimeDisplay}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-[48px] w-[48px] items-center justify-center rounded-[16px] border border-white/5 text-white transition-transform duration-200 hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,30,56,0.96) 0%, rgba(15,23,42,0.96) 100%)",
              boxShadow: "0 10px 24px -16px rgba(0,0,0,0.7)",
            }}
            aria-label="Open notifications"
            onClick={() => setNotificationOpen((prev) => !prev)}
          >
            <i className={isMobile ? "bi bi-bell text-[18px]" : "bi bi-bell text-[20px]"} />
          </button>

          <div className="relative" style={{ width: searchWidth }}>
            <div
              className="relative flex w-full items-center rounded-[18px] border transition-all duration-200"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,30,56,0.96) 0%, rgba(15,23,42,0.96) 100%)",
                borderColor: searchFocused
                  ? "rgba(59,130,246,0.65)"
                  : "rgba(255,255,255,0.04)",
                boxShadow: searchFocused
                  ? "0 0 0 4px rgba(59,130,246,0.12)"
                  : "0 10px 24px -16px rgba(0,0,0,0.7)",
              }}
            >
              <i className="bi bi-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                placeholder={isMobile ? "Search" : "Search customers"}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full rounded-[18px] border-none bg-transparent font-quicksand text-white outline-none placeholder:text-slate-500"
                style={{
                  padding: isMobile ? "11px 38px" : "12px 42px",
                  fontSize: isMobile ? "12px" : "14px",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 border-none bg-transparent p-0 text-slate-500 transition-colors hover:text-red-400"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-circle text-base" />
                </button>
              )}
            </div>

            {notificationOpen && (
              <div
                className="absolute right-[calc(100%+12px)] top-0 flex max-h-[320px] w-[320px] flex-col overflow-hidden rounded-[20px] border border-white/20 bg-white text-slate-800 shadow-2xl"
                style={{
                  maxWidth: isMobile ? "min(300px, calc(100vw - 110px))" : "320px",
                }}
              >
                <h3 className="m-0 border-b border-slate-200 px-5 py-4 text-base font-bold font-quicksand text-slate-900">
                  Notifications
                </h3>
                <ul className="m-0 max-h-[248px] list-none overflow-y-auto p-0">
                  {sampleNotifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`flex items-start gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0 ${notification.unread ? "bg-blue-50/60" : "bg-white"}`}
                    >
                      <i
                        className={`bi bi-${notification.type === "appointment" ? "calendar" : notification.type === "reminder" ? "clock" : "info-circle"} mt-0.5 text-huuk-blue`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm text-slate-800">
                          {notification.message}
                        </p>
                        <p className="m-0 mt-1 text-xs text-slate-400">
                          {notification.time}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
