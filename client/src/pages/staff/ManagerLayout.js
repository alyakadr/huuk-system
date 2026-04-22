import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/shared/Sidebar";
import Header from "../../components/shared/Header";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import { useProfile } from "../../ProfileContext";

const managerNavItems = [
  { icon: "dashboard", label: "Dashboard", path: "/manager" },
  {
    icon: "group",
    label: "Staff Management",
    path: "/manager/staff-profile",
    subNav: [
      { label: "Profiles", path: "/manager/staff-profile" },
      {
        label: "Attendance",
        path: "/manager/staff-attendance",
      },
    ],
  },
  {
    icon: "check_circle",
    label: "Staff Approvals",
    path: "/manager/staff-approval",
  },
  {
    icon: "event",
    label: "Appointment Management",
    path: "/manager/appointment-management",
  },
  {
    icon: "business",
    label: "Customer Management",
    path: "/manager/customer-management",
    disabled: true,
  },
  {
    icon: "payment",
    label: "Payment Summary",
    path: "/manager/payment-summary",
    disabled: true,
  },
  {
    icon: "assessment",
    label: "Sales Report",
    path: "/manager/sales-report",
    disabled: true,
  },
];

const COLLAPSED_SIDEBAR_WIDTH = 72;
const EXPANDED_SIDEBAR_WIDTH = 248;

const ManagerLayout = () => {
  const [user, setUser] = useState(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();

  const isPhone = viewportWidth <= 768;
  const isCompactLayout = viewportWidth <= 1024;
  const isTablet = viewportWidth > 768 && viewportWidth <= 1100;
  const sidebarWidth =
    isCompactLayout || isSidebarMinimized
      ? COLLAPSED_SIDEBAR_WIDTH
      : EXPANDED_SIDEBAR_WIDTH;

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev);
  };

  const getPageTitle = () => {
    const username = profile?.username || user?.username || "User";

    if (location.pathname === "/manager") {
      return `Welcome back, ${username}!`;
    }

    for (const item of managerNavItems) {
      if (item.path === location.pathname) {
        return item.label;
      }
      if (item.subNav) {
        const subItem = item.subNav.find(
          (candidate) => candidate.path === location.pathname,
        );
        if (subItem) {
          return item.label;
        }
      }
    }

    return `Welcome back, ${username}!`;
  };

  const getMode = () =>
    location.pathname.startsWith("/manager") ? "Manager Mode" : "Staff Mode";

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Force the whole manager app to fit exactly one viewport with no
  // page-level scrolling. Restore on unmount so other layouts (customer,
  // booking, etc.) keep their natural scroll behaviour.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };
    html.style.overflow = "hidden";
    html.style.height = "100vh";
    body.style.overflow = "hidden";
    body.style.height = "100vh";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  useEffect(() => {
    if (isCompactLayout) {
      setIsSidebarMinimized(true);
    }
  }, [isCompactLayout]);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("staff_loggedInUser") ||
      localStorage.getItem("loggedInUser");
    if (!storedUser) {
      navigate("/staff-login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== "manager") {
        navigate("/staff-login");
        return;
      }
      setUser(parsedUser);
    } catch (error) {
      console.error("Error parsing user data:", error);
      navigate("/staff-login");
    }
  }, [navigate]);

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white">
        Loading user data...
      </div>
    );
  }

  const mainColumnPadding = isPhone
    ? "0 10px 14px 6px"
    : isTablet
      ? "0 18px 20px 12px"
      : "0 24px 24px 10px";

  const mainColumnStyles = {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
    height: "100vh",
    maxHeight: "100vh",
    overflow: "hidden",
    backgroundColor: "#0e0d0f",
    marginLeft: `${sidebarWidth}px`,
    width: `calc(100% - ${sidebarWidth}px)`,
    boxSizing: "border-box",
    transition: "margin-left 0.3s ease, width 0.3s ease",
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        maxHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        backgroundColor: "#0e0d0f",
      }}
    >
      <Sidebar
        user={user}
        navItems={managerNavItems}
        minimized={isCompactLayout ? true : isSidebarMinimized}
        toggleSidebar={toggleSidebar}
      />
      <div style={mainColumnStyles}>
        <Header
          isMobile={isPhone}
          isTablet={isTablet}
          minimized={isCompactLayout ? true : isSidebarMinimized}
          sticky
          layoutLeftOffset={`${sidebarWidth}px`}
          layoutWidth={`calc(100% - ${sidebarWidth}px)`}
          username={profile?.username || user?.username || "User"}
          role={user.role}
          pageTitle={getPageTitle()}
          mode={getMode()}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            padding: mainColumnPadding,
            overflow: "hidden",
          }}
        >
          <Outlet />
        </div>
      </div>
      <SwitchModeButton />
    </div>
  );
};

export default ManagerLayout;
