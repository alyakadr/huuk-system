import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/shared/Sidebar";
import Header from "../../components/shared/Header";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import { useProfile } from "../../ProfileContext";
import logo from "../../assets/logo.PNG"; // Import logo

const managerNavItems = [
  { icon: "dashboard", label: "Dashboard", path: "/manager" },
  {
    icon: "group",
    label: "Staff Management",
    disabled: true,
    subNav: [
      { label: "Profiles", path: "/manager/staff-profile", disabled: true },
      { label: "Staff Attendance", path: "/manager/staff-attendance", disabled: true },
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
  { icon: "assessment", label: "Sales Report", path: "/manager/sales-report", disabled: true },
];

const ManagerLayout = () => {
  const [user, setUser] = useState(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();

  // Sample notifications (move to state management or API if dynamic)
  const notifications = [
    { id: 1, text: "New Appointment!", type: "new", time: "11:11" },
    { id: 2, text: "New Appointment!", type: "new", time: "11:10" },
    {
      id: 3,
      text: "Notice: Kamal Adli has cancelled the booking at 11:30 AM",
      type: "cancel",
      time: "11:00",
    },
    {
      id: 4,
      text: "Reminder: Customer booking in 15 minutes at 11:15 AM",
      type: "reminder",
      time: "10:45",
    },
  ];
  const unreadCount = notifications.length;

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev);
  };

  const handleSearch = (query) => {
    setSearchText(query);
    // Implement search logic if needed
  };

  const toggleNotifications = (isOpen) => {
    setIsNotiOpen(isOpen);
  };

  const getPageTitle = () => {
    // Get username from profile context or user state
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
          (sub) => sub.path === location.pathname
        );
        if (subItem) {
          return item.label;
        }
      }
    }
    return `Welcome back, ${username}!`;
  };

  const getMode = () => {
    return location.pathname.startsWith("/manager")
      ? "Manager Mode"
      : "Staff Mode";
  };

  useEffect(() => {
    // Check for user data in both legacy and new storage keys
    const storedUser = localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
    if (!storedUser) {
      navigate("/staff-login");
      return;
    }
    
    try {
      const user = JSON.parse(storedUser);
      if (user.role !== "manager") {
        navigate("/staff-login");
        return;
      }
      setUser(user);
    } catch (error) {
      console.error("Error parsing user data:", error);
      navigate("/staff-login");
    }
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-white">
        Loading user data...
      </div>
    );
  }

  const isMobile = window.innerWidth <= 768;
  const managerContentStyles = {
    flexGrow: 1,
    overflow: "auto",
    backgroundColor: "#0e0d0f",
    paddingTop: "170px",
    marginLeft: isMobile ? "72px" : (isSidebarMinimized ? "72px" : "270px"),
    width: isMobile ? "calc(100% - 72px)" : (isSidebarMinimized ? "calc(100% - 72px)" : "calc(100% - 270px)"),
    boxSizing: "border-box",
    transition: "margin-left 0.3s ease, width 0.3s ease",
    zIndex: 1000,
  };

  return (
    <div className="flex h-screen overflow-hidden box-border bg-transparent">
      <Sidebar
        user={user}
        navItems={managerNavItems}
        minimized={isSidebarMinimized}
        toggleSidebar={toggleSidebar}
      />
      <div style={managerContentStyles}>
        <Header
          minimized={isSidebarMinimized}
          logoSrc={logo}
          username={profile?.username || user?.username || "User"}
          role={user.role}
          pageTitle={getPageTitle()}
          mode={getMode()}
          onSearch={handleSearch}
          notifications={notifications}
          onNotificationToggle={toggleNotifications}
          unreadCount={unreadCount}
        />
        <main className="w-full h-full">
          <Outlet />
        </main>
      </div>
      <SwitchModeButton />
    </div>
  );
};

export default ManagerLayout;
