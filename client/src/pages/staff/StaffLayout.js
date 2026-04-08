import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/shared/Sidebar";
import Header from "../../components/shared/Header";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import api from "../../utils/api"; // Updated import
import moment from "moment";

const staffNavItems = [
  { icon: "dashboard", label: "Dashboard", path: "/staff" },
  { icon: "check_circle", label: "Attendance", path: "/staff/attendance", disabled: true },
  { icon: "event_note", label: "My Schedule", path: "/staff/schedule" },
  {
    icon: "event",
    label: "Appointment Management",
    path: "/staff/appointments",
  },
  { icon: "payment", label: "Payment Management", path: "/staff/payments", disabled: true },
  { icon: "assessment", label: "Sales Report", path: "/staff/reports", disabled: true },
];

const StaffLayout = () => {
  const [user, setUser] = useState(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const navigate = useNavigate();
  const location = useLocation();
  const isPhone = viewportWidth <= 768;
  const isCompactLayout = viewportWidth <= 1024;
  const isTablet = viewportWidth > 768 && viewportWidth <= 1100;
  // Get token from staff_loggedInUser object or fallback to direct token
  const getToken = () => {
    const staffUser = localStorage.getItem('staff_loggedInUser');
    if (staffUser) {
      try {
        const parsed = JSON.parse(staffUser);
        return parsed.token;
      } catch (error) {
        console.error('Error parsing staff_loggedInUser:', error);
      }
    }
    return localStorage.getItem('staff_token') || localStorage.getItem('token');
  };
  
  const getUserId = () => {
    const staffUser = localStorage.getItem('staff_loggedInUser');
    if (staffUser) {
      try {
        const parsed = JSON.parse(staffUser);
        return parsed.id;
      } catch (error) {
        console.error('Error parsing staff_loggedInUser:', error);
      }
    }
    return null;
  };
  
  const token = getToken();

  const toggleSidebar = () => {
    setIsSidebarMinimized(!isSidebarMinimized);
  };

  const getPageTitle = () => {
    if (location.pathname === "/staff") {
      return `Welcome back, ${user?.username || "User"}!`;
    }
    const currentItem = staffNavItems.find(
      (item) => item.path === location.pathname
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
    console.log("Validating attendance in StaffLayout for staff_id:", staffId);
    try {
      const response = await api.get("/users/attendance", {
        params: {
          date: moment().format("YYYY-MM-DD"),
          staff_id: staffId,
          page: 1,
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data.attendance || [];
      console.log("StaffLayout attendance validation data:", data);
      const todayRecord = data.find(
        (record) =>
          record.staff_id === staffId &&
          moment(record.created_date).format("YYYY-MM-DD") ===
            moment().format("YYYY-MM-DD") &&
          record.time_in
      );
      if (todayRecord) {
        console.log("StaffLayout found today record:", todayRecord);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem(
          "timeIn",
          moment(todayRecord.time_in).format("HH:mm")
        );
      } else {
        console.log("StaffLayout no today record found");
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
      }
    } catch (error) {
      console.error("StaffLayout attendance check error:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isCompactLayout) {
      setIsSidebarMinimized(true);
    }
  }, [isCompactLayout]);

  useEffect(() => {
    // Check if logout is in progress to prevent interference
    const logoutInProgress = localStorage.getItem('FORCE_LOGOUT_IN_PROGRESS');
    if (logoutInProgress) {
      console.log('Logout in progress, allowing logout process to complete');
      return;
    }
    
    // Check if we're in a logout process or have no session data
    const staffUser = localStorage.getItem('staff_loggedInUser');
    const staffToken = localStorage.getItem('staff_token');
    
    if (!token || !staffUser || !staffToken) {
      console.log('No valid staff session found, redirecting to login');
      setUser(null);
      // Clear any remaining session data
      localStorage.removeItem('staff_loggedInUser');
      localStorage.removeItem('staff_token');
      localStorage.removeItem('staff_userId');
      // Use window.location for a clean redirect
      window.location.href = "/staff-login";
      return;
    }

    const fetchUserAndAttendance = async () => {
      try {
        // Try to get user from staff_loggedInUser first, then loggedInUser
        const staffUser = localStorage.getItem("staff_loggedInUser");
        const regularUser = localStorage.getItem("loggedInUser");
        let currentUser = null;
        
        if (staffUser) {
          try {
            currentUser = JSON.parse(staffUser);
          } catch (error) {
            console.error('Error parsing staff_loggedInUser:', error);
          }
        }
        
        if (!currentUser && regularUser) {
          try {
            currentUser = JSON.parse(regularUser);
          } catch (error) {
            console.error('Error parsing loggedInUser:', error);
          }
        }

        const res = await api.get("/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fetchedUser = {
          ...res.data,
          profilePicture: res.data.profile_picture || null,
          token: currentUser?.token || token, // Preserve token
        };
        if (fetchedUser.role !== "staff" && fetchedUser.role !== "manager") {
          setUser(null);
          navigate("/staff-login");
        } else {
          setUser(fetchedUser);
          // Store in both locations for consistency
          localStorage.setItem("loggedInUser", JSON.stringify(fetchedUser));
          localStorage.setItem("staff_loggedInUser", JSON.stringify(fetchedUser));
          // Also store token separately for backward compatibility
          localStorage.setItem("token", fetchedUser.token);
          validateAttendance(fetchedUser.id);
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        setUser(null);
        navigate("/staff-login");
      }
    };

    fetchUserAndAttendance();
  }, [token, navigate]);

  useEffect(() => {
    if (user) {
      console.log("Location changed to:", location.pathname);
      if (location.pathname.startsWith("/staff")) {
        validateAttendance(user.id);
      }
      // Restrict staff role to only certain pages
      if (user.role === "staff") {
        const allowedPaths = [
          "/staff",
          "/staff/schedule",
          "/staff/appointments"
        ];
        const isAllowed = allowedPaths.some((path) => location.pathname === path || location.pathname.startsWith(path + "/"));
        if (!isAllowed) {
          navigate("/staff");
        }
      }
    }
  }, [user, location.pathname, navigate]);

  if (!user)
    return (
      <div>
        Session expired. Please <a href="/staff-login">log in again</a>.
      </div>
    );

  const staffLayoutStyles = {
    display: 'flex',
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: '#0e0d0f'
  };
  
  const staffContentStyles = {
    flexGrow: 1,
    overflow: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#0e0d0f',
    padding: isPhone ? '12px' : isTablet ? '16px 16px 16px 12px' : '20px 20px 20px 10px',
    paddingTop: isPhone ? '112px' : isCompactLayout ? '132px' : '150px',
    marginLeft: isCompactLayout ? '77px' : (isSidebarMinimized ? '77px' : '285px'),
    width: isCompactLayout ? 'calc(100% - 77px)' : (isSidebarMinimized ? 'calc(100% - 77px)' : 'calc(100% - 285px)'),
    boxSizing: 'border-box',
    transition: 'margin-left 0.3s ease, width 0.3s ease',
    position: 'relative',
    zIndex: 900
  };

  return (
    <div style={staffLayoutStyles}>
      <Sidebar
        user={user}
        navItems={staffNavItems}
        minimized={isSidebarMinimized}
        toggleSidebar={toggleSidebar}
      />
      <Header
        isMobile={isPhone}
        isTablet={isTablet}
        minimized={isCompactLayout ? true : isSidebarMinimized}
        layoutLeftOffset={isCompactLayout ? '77px' : (isSidebarMinimized ? '77px' : '285px')}
        layoutWidth={isCompactLayout ? 'calc(100% - 77px)' : (isSidebarMinimized ? 'calc(100% - 77px)' : 'calc(100% - 285px)')}
        logoSrc={
          user.profilePicture
            ? `http://localhost:5000${user.profilePicture}`
            : "/path/to/logo.png"
        }
        username={user.username}
        role={user.role}
        pageTitle={getPageTitle()}
        mode={getMode()}
      />
      <div style={staffContentStyles}>
        <Outlet />
      </div>
      <SwitchModeButton />
    </div>
  );
};

export default StaffLayout;
