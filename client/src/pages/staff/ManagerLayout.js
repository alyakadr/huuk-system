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
    disabled: true,
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
  const sidebarWidth = isCompactLayout || isSidebarMinimized
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

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#0e0d0f]">
      <Sidebar
        user={user}
        navItems={managerNavItems}
        minimized={isCompactLayout ? true : isSidebarMinimized}
        toggleSidebar={toggleSidebar}
      />
      <Header
        isMobile={isPhone}
        isTablet={isTablet}
        minimized={isCompactLayout ? true : isSidebarMinimized}
        layoutLeftOffset={`${sidebarWidth}px`}
        layoutWidth={`calc(100% - ${sidebarWidth}px)`}
        username={profile?.username || user?.username || "User"}
        role={user.role}
        pageTitle={getPageTitle()}
        mode={getMode()}
      />
      <div
        style={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          backgroundColor: "#0e0d0f",
          padding: isPhone
            ? "104px 10px 14px"
            : isTablet
              ? "126px 18px 20px"
              : "148px 24px 24px 18px",
          marginLeft: `${sidebarWidth}px`,
          width: `calc(100% - ${sidebarWidth}px)`,
          boxSizing: "border-box",
          transition: "margin-left 0.3s ease, width 0.3s ease",
        }}
      >
        <main className="h-full w-full min-w-0">
          <Outlet />
        </main>
      </div>
      <SwitchModeButton />
    </div>
  );
};

export default ManagerLayout;
