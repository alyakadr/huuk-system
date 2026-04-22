import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/shared/Sidebar";
import Header from "../../components/shared/Header";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import api from "../../utils/api";
import moment from "moment";

const staffNavItems = [
  { icon: "dashboard", label: "Dashboard", path: "/staff" },
  {
    icon: "check_circle",
    label: "Attendance",
    path: "/staff/attendance",
  },
  { icon: "event_note", label: "My Schedule", path: "/staff/schedule" },
  {
    icon: "event",
    label: "Appointment Management",
    path: "/staff/appointments",
  },
  {
    icon: "payment",
    label: "Payment Management",
    path: "/staff/payments",
    disabled: true,
  },
  {
    icon: "assessment",
    label: "Sales Report",
    path: "/staff/reports",
    disabled: true,
  },
];

const COLLAPSED_SIDEBAR_WIDTH = 72;
const EXPANDED_SIDEBAR_WIDTH = 248;

const StaffLayout = () => {
  const [user, setUser] = useState(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const navigate = useNavigate();
  const location = useLocation();

  const isPhone = viewportWidth <= 768;
  const isCompactLayout = viewportWidth <= 1024;
  const isTablet = viewportWidth > 768 && viewportWidth <= 1100;

  const getToken = () => {
    const staffUser = localStorage.getItem("staff_loggedInUser");
    if (staffUser) {
      try {
        const parsed = JSON.parse(staffUser);
        return (
          parsed.token ||
          localStorage.getItem("staff_token") ||
          localStorage.getItem("token")
        );
      } catch (error) {
        console.error("Error parsing staff_loggedInUser:", error);
      }
    }
    return localStorage.getItem("staff_token") || localStorage.getItem("token");
  };

  const getUserId = () => {
    const staffUser = localStorage.getItem("staff_loggedInUser");
    if (staffUser) {
      try {
        const parsed = JSON.parse(staffUser);
        return parsed.id;
      } catch (error) {
        console.error("Error parsing staff_loggedInUser:", error);
      }
    }
    return null;
  };

  const token = getToken();
  const sidebarWidth =
    isCompactLayout || isSidebarMinimized
      ? COLLAPSED_SIDEBAR_WIDTH
      : EXPANDED_SIDEBAR_WIDTH;

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev);
  };

  const getPageTitle = () => {
    if (location.pathname === "/staff") {
      return `Welcome back, ${user?.username || "User"}!`;
    }
    const currentItem = staffNavItems.find(
      (item) => item.path === location.pathname,
    );
    return currentItem
      ? currentItem.label
      : `Welcome back, ${user?.username || "User"}!`;
  };

  const getMode = () => {
    return user?.role === "manager" && location.pathname.startsWith("/staff")
      ? "Staff Mode"
      : user?.role === "manager"
        ? "Manager Mode"
        : "Staff Mode";
  };

  const validateAttendance = async (userId) => {
    const staffId = getUserId() || userId;
    try {
      const attendanceHeaders = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const response = await api.get("/users/attendance", {
        params: {
          date: moment().format("YYYY-MM-DD"),
          staff_id: staffId,
          page: 1,
        },
        headers: attendanceHeaders,
      });
      const data = response.data.attendance || [];
      const todayRecord = data.find(
        (record) =>
          record.staff_id === staffId &&
          moment(record.created_date).format("YYYY-MM-DD") ===
            moment().format("YYYY-MM-DD") &&
          record.time_in,
      );
      if (todayRecord) {
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem(
          "timeIn",
          moment(todayRecord.time_in).format("HH:mm"),
        );
      } else {
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
      }
    } catch (error) {
      console.error("StaffLayout attendance check error:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Force the whole staff app to fit exactly one viewport with no
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
    const logoutInProgress = localStorage.getItem("FORCE_LOGOUT_IN_PROGRESS");
    if (logoutInProgress) {
      return;
    }

    const staffUser = localStorage.getItem("staff_loggedInUser");

    if (!staffUser) {
      setUser(null);
      localStorage.removeItem("staff_loggedInUser");
      localStorage.removeItem("staff_token");
      localStorage.removeItem("staff_userId");
      window.location.href = "/staff-login";
      return;
    }

    const fetchUserAndAttendance = async () => {
      try {
        const storedStaffUser = localStorage.getItem("staff_loggedInUser");
        const regularUser = localStorage.getItem("loggedInUser");
        let currentUser = null;

        if (storedStaffUser) {
          try {
            currentUser = JSON.parse(storedStaffUser);
          } catch (error) {
            console.error("Error parsing staff_loggedInUser:", error);
          }
        }

        if (!currentUser && regularUser) {
          try {
            currentUser = JSON.parse(regularUser);
          } catch (error) {
            console.error("Error parsing loggedInUser:", error);
          }
        }

        const profileHeaders = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await api.get("/users/profile", {
          headers: profileHeaders,
        });
        const fetchedUser = {
          ...response.data,
          profilePicture: response.data.profile_picture || null,
        };
        delete fetchedUser.token;

        if (fetchedUser.role !== "staff" && fetchedUser.role !== "manager") {
          setUser(null);
          navigate("/staff-login");
        } else {
          setUser(fetchedUser);
          localStorage.setItem("loggedInUser", JSON.stringify(fetchedUser));
          localStorage.setItem(
            "staff_loggedInUser",
            JSON.stringify(fetchedUser),
          );
          validateAttendance(fetchedUser.id);
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        setUser(null);
        navigate("/staff-login");
      }
    };

    fetchUserAndAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  useEffect(() => {
    if (!user) return;

    if (location.pathname.startsWith("/staff")) {
      validateAttendance(user.id);
    }

    if (user.role === "staff") {
      const allowedPaths = [
        "/staff",
        "/staff/schedule",
        "/staff/appointments",
        "/staff/attendance",
      ];
      const isAllowed = allowedPaths.some(
        (path) =>
          location.pathname === path ||
          location.pathname.startsWith(`${path}/`),
      );
      if (!isAllowed) {
        navigate("/staff");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, navigate]);

  if (!user) {
    return (
      <div>
        Session expired. Please <a href="/staff-login">log in again</a>.
      </div>
    );
  }

  const mainColumnPadding = isPhone
    ? "0 10px 14px"
    : isTablet
      ? "0 18px 20px"
      : "0 24px 24px 18px";

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
        navItems={staffNavItems}
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
          username={user.username}
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

export default StaffLayout;
