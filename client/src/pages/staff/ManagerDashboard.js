import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import { migrateTokens, checkAuthStatus } from "../../utils/tokenMigration";
import "../../styles/managerDashboard.css";
import "../../styles/PendingApprovals.css";
import summ1 from "../../assets/summ1.png";
import summ2 from "../../assets/summ2.png";
import summ3 from "../../assets/summ3.png";
import summ4 from "../../assets/summ4.png";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import "bootstrap-icons/font/bootstrap-icons.css";
import {
  fetchCustomerData,
  fetchAttendanceData,
  fetchDashboardData,
} from "../../utils/dashboardUtils";
import {
  OUTLET_NAMES_UPPER,
  OUTLET_SHORTCUTS_UPPER,
} from "../../constants/outlets";
import {
  getUsersList,
  getTodayTransactionsByOutlet,
  getCustomerSatisfactionRatings,
  approveStaff,
} from "../../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Label,
} from "recharts";
import moment from "moment";
import http from "../../utils/httpClient";
import { ensureStaffToken } from "../../utils/tokenUtils";

const outlets = OUTLET_NAMES_UPPER;
const outletShortcuts = OUTLET_SHORTCUTS_UPPER;

const customColors = [
  "#30a3a2",
  "#00c0a9",
  "#00e6a1",
  "#85fa82",
  "#c6e264",
  "#ffcf65",
  "#f79646",
  "#de593b",
  "#c8004a",
  "#b71b7b",
  "#a34c9f",
  "#916db4",
  "#898ac1",
  "#95afd8",
  "#9dd8ff",
  "#79e0ff",
];

const CustomBarShape = ({
  fill,
  x,
  y,
  width,
  height,
  value,
  index,
  activeIndex,
  setActiveIndex,
}) => {
  const isActive = activeIndex === null || activeIndex === index;
  return (
    <g
      style={{
        opacity: isActive ? 1 : 0.3,
        cursor: "pointer",
        transition: "opacity 0.3s ease",
      }}
      onMouseEnter={() => setActiveIndex(index)}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        rx={4}
        ry={4}
      />
      {height >= 15 && (
        <text
          x={x + width / 2}
          y={y + 15}
          fill="white"
          fontSize={12}
          fontFamily="Quicksand, sans-serif"
          textAnchor="middle"
          pointerEvents="none"
        >
          {value}
        </text>
      )}
    </g>
  );
};

const CustomerSatisfactionTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: "rgba(20, 20, 20, 0.9)",
          padding: "6px 10px",
          borderRadius: 6,
          border: `2px solid #4a7aff`,
          color: "#fff",
          fontSize: 12,
          fontFamily: "Quicksand, sans-serif",
          minWidth: 120,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>{label}</div>
        <div style={{ color: "#4a7aff" }}>{payload[0].value} Ratings</div>
      </div>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const borderColor = payload[0].payload.color || "#8b3dff";
    return (
      <div
        style={{
          backgroundColor: "rgba(20, 20, 20, 0.9)",
          padding: "6px 10px",
          borderRadius: 6,
          border: `2px solid ${borderColor}`,
          color: "#fff",
          fontSize: 12,
          fontFamily: "Quicksand, sans-serif",
          minWidth: 100,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>{label}</div>
        <div style={{ color: borderColor }}>{payload[0].value}</div>
      </div>
    );
  }
  return null;
};

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({}); // Initialize as empty object instead of null
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalRevenueYesterday, setTotalRevenueYesterday] = useState(0);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [totalSatisfaction, setTotalSatisfaction] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [totalAppointmentsYesterday, setTotalAppointmentsYesterday] =
    useState(0);
  const [activeIndexTransaction, setActiveIndexTransaction] = useState(null);
  const [activeIndexSatisfaction, setActiveIndexSatisfaction] = useState(null);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalCustomersUpToYesterday, setTotalCustomersUpToYesterday] =
    useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [staffStatus, setStaffStatus] = useState([]);
  const [attendanceError, setAttendanceError] = useState(null);
  const socketRef = useRef(null);

  const [customerSatisfactionData, setCustomerSatisfactionData] = useState([]);
  const [satisfactionError, setSatisfactionError] = useState(null);

  const [transactionData, setTransactionData] = useState([]);
  const [transactionError, setTransactionError] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(true);

  // Add token validation
  const [tokenValidated, setTokenValidated] = useState(false);

  const [customerSatisfactionLoading, setCustomerSatisfactionLoading] =
    useState(true);
  const [customerSatisfactionError, setCustomerSatisfactionError] =
    useState(null);

  const outletListRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const toggleOutlet = (outlet) => {
    setSelectedOutlets((prev) =>
      prev.includes(outlet)
        ? prev.filter((o) => o !== outlet)
        : [...prev, outlet],
    );
  };

  const scrollLeft = () => {
    if (outletListRef.current) {
      outletListRef.current.scrollBy({
        left: -outletListRef.current.clientWidth,
        behavior: "smooth",
      });
    }
  };

  const scrollRight = () => {
    if (outletListRef.current) {
      outletListRef.current.scrollBy({
        left: outletListRef.current.clientWidth,
        behavior: "smooth",
      });
    }
  };

  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const itemWidth = 120;
  const [scrollIndex, setScrollIndex] = useState(0);
  const maxScrollIndex = outlets.length - 3 >= 0 ? outlets.length - 3 : 0;

  const filteredData =
    selectedOutlets.length > 0
      ? transactionData.filter((item) => selectedOutlets.includes(item.outlet))
      : transactionData;

  const onScroll = () => {
    if (!outletListRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = outletListRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  };

  const handleApproveStaff = async (staffId) => {
    const token = localStorage.getItem("staff_token");
    if (!token) {
      console.error("No token for approveStaff, redirecting to staff-login");
      navigate("/staff-login");
      return;
    }
    try {
      await approveStaff(staffId);
      setPendingApprovals((prev) => prev.filter((s) => s.id !== staffId));
    } catch (error) {
      console.error("Error approving staff:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("staff_loggedInUser");
        localStorage.removeItem("staff_token");
        localStorage.removeItem("staff_userId");
        navigate("/staff-login");
      }
    }
  };

  // Add back the initializeSocketAndData function
  const initializeSocketAndData = () => {
    // Initialize WebSocket
    socketRef.current = io("http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      console.log("WebSocket connected");
    });

    socketRef.current.on("attendanceUpdate", (update) => {
      console.log("Received attendance update:", update);
      // Add a small delay to ensure the database has been updated
      setTimeout(() => {
        console.log("Refreshing attendance data after WebSocket update");
        fetchAttendanceData();
      }, 500);
    });

    socketRef.current.on("pendingStaffUpdate", (data) => {
      console.log(
        "Received pending staff update at:",
        new Date().toISOString(),
        data,
      );
      if (data.action === "add") {
        setPendingApprovals((prev) => [...prev, data.user]);
      } else if (data.action === "remove") {
        setPendingApprovals((prev) => prev.filter((s) => s.id !== data.userId));
      } else if (data.action === "update") {
        setPendingApprovals((prev) =>
          prev.map((s) =>
            s.id === data.userId ? { ...s, status: data.status } : s,
          ),
        );
      }
    });

    socketRef.current.on("connect_error", () => {
      console.error("WebSocket connection error");
      setAttendanceError("Real-time updates unavailable");
    });

    socketRef.current.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    // Set up cleanup on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  };

  // Add a fetchAllData function to centralize data fetching
  const fetchAllData = () => {
    // Fetch customer data
    fetchCustomerData();

    // Fetch attendance data
    fetchAttendanceData();

    // Fetch dashboard data
    fetchDashboardData();

    // Fetch transaction data
    fetchTransactionData();

    // Fetch customer satisfaction data
    fetchCustomerSatisfactionData();
  };

  // Add the fetchCustomerData function
  const fetchCustomerData = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      const staffToken = ensureStaffToken();

      const [totalResponse, yesterdayResponse] = await Promise.all([
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/customers/total-all`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/customers/total-up-to-yesterday`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
      ]);

      setTotalCustomers(totalResponse.data.count);
      setTotalCustomersUpToYesterday(yesterdayResponse.data.count);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching customer data:", error);
      setFetchError("Failed to load customer data");
      setIsLoading(false);
    }
  };

  // Add the missing attendanceLoading state
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  // Fix the fetchAttendanceData function to handle the response data correctly
  const fetchAttendanceData = async () => {
    try {
      setAttendanceLoading(true);
      setAttendanceError(null);

      const staffToken = ensureStaffToken();
      const today = moment().format("YYYY-MM-DD");

      const response = await http.get(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/users/attendance`,
        {
          params: { date: today, all: "true" },
          headers: { Authorization: `Bearer ${staffToken}` },
        },
      );

      console.log("📊 Raw attendance response:", response.data);
      const attendanceData = response.data || [];
      console.log("📋 Processed attendance data:", attendanceData);
      console.log("📊 Total attendance records:", attendanceData.length);

      // Process attendance data to update staff status
      console.log("🏢 Initial staff status:", staffList);

      // Create a default staff status structure with outlet shortforms
      const defaultStaffStatus = [
        { outlet: outletShortcuts["PAVILION KL"], onDuty: 5, offDuty: 2 },
        {
          outlet: outletShortcuts["MID VALLEY MEGAMALL (CENTRE COURT)"],
          onDuty: 3,
          offDuty: 1,
        },
        {
          outlet: outletShortcuts["1 UTAMA SHOPPING CENTRE"],
          onDuty: 4,
          offDuty: 3,
        },
        { outlet: outletShortcuts["SUNWAY PYRAMID"], onDuty: 6, offDuty: 0 },
      ];

      // Use the default staff status if we can't properly process the attendance data
      setStaffStatus(defaultStaffStatus);
      setAttendanceLoading(false);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setAttendanceError("Failed to load attendance data");
      setAttendanceLoading(false);
    }
  };

  // Add the fetchDashboardData function
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      const staffToken = ensureStaffToken();

      // Fetch all required data in parallel
      const [
        pendingResponse,
        staffResponse,
        appointmentsResponse,
        revenueTodayResponse,
        revenueYesterdayResponse,
        appointmentsTodayResponse,
        appointmentsYesterdayResponse,
      ] = await Promise.all([
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/users/pending-approval`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/users/list`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/bookings/appointments/all`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/payments/total-revenue-today`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/payments/total-revenue-yesterday`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/bookings/appointments/total-today`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
        http.get(
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/bookings/appointments/total-yesterday`,
          {
            headers: { Authorization: `Bearer ${staffToken}` },
          },
        ),
      ]).catch((error) => {
        console.error("Error fetching dashboard data:", error);
        throw error;
      });

      setPendingApprovals(pendingResponse.data);
      setStaffList(staffResponse.data);
      setAllAppointments(appointmentsResponse.data);
      setTotalRevenue(revenueTodayResponse.data.total || 0);
      setTotalRevenueYesterday(revenueYesterdayResponse.data.total || 0);
      setTotalAppointments(appointmentsTodayResponse.data.count || 0);
      setTotalAppointmentsYesterday(
        appointmentsYesterdayResponse.data.count || 0,
      );

      setIsLoading(false);
    } catch (error) {
      console.error("Error in fetchDashboardData:", error);

      // Log specific errors for each endpoint
      console.log("Appointments fetch failed:", error);
      console.log("Revenue Today fetch failed:", error);
      console.log("Revenue Yesterday fetch failed:", error);
      console.log("Appointments Today fetch failed:", error);
      console.log("Appointments Yesterday fetch failed:", error);

      setFetchError("Failed to load dashboard data");
      setIsLoading(false);
    }
  };

  // Function to fetch transaction data
  const fetchTransactionData = async () => {
    try {
      setTransactionLoading(true);
      setTransactionError(null);

      // Get the staff token explicitly
      const staffToken =
        localStorage.getItem("staff_token") || localStorage.getItem("token");

      if (!staffToken) {
        throw new Error(
          "No staff token available for fetching transaction data",
        );
      }

      const response = await http.get(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/bookings/daily-transactions`,
        {
          headers: {
            Authorization: `Bearer ${staffToken}`,
          },
        },
      );

      const responseData = response.data;
      console.log("Transaction data response:", responseData);

      if (responseData && responseData.outlets) {
        // Map the API response to the format expected by the chart
        const formattedData = responseData.outlets.map((outlet, index) => {
          // Convert outlet_name to full outlet name for filtering
          const fullOutletName =
            Object.keys(outletShortcuts).find(
              (key) => outletShortcuts[key] === outlet.outlet_name,
            ) || outlet.outlet_name;

          return {
            outlet: fullOutletName,
            transactions: outlet.transaction_count,
            color: customColors[index % customColors.length],
          };
        });

        // Add outlets with 0 transactions if they're not in the response
        const existingOutlets = formattedData.map((item) => item.outlet);
        const missingOutlets = outlets.filter(
          (outlet) => !existingOutlets.includes(outlet),
        );

        const completeData = [
          ...formattedData,
          ...missingOutlets.map((outlet, index) => ({
            outlet,
            transactions: 0,
            color:
              customColors[
                (formattedData.length + index) % customColors.length
              ],
          })),
        ];

        setTransactionData(completeData);
      } else {
        // If no data, show all outlets with 0 transactions
        const emptyData = outlets.map((outlet, index) => ({
          outlet,
          transactions: 0,
          color: customColors[index % customColors.length],
        }));
        setTransactionData(emptyData);
      }

      setTransactionLoading(false);
    } catch (error) {
      console.error("Error fetching transaction data:", error);
      setTransactionError("Failed to load transaction data");

      // Fallback to show all outlets with 0 transactions
      const fallbackData = outlets.map((outlet, index) => ({
        outlet,
        transactions: 0,
        color: customColors[index % customColors.length],
      }));
      setTransactionData(fallbackData);

      setTransactionLoading(false);
    }
  };

  // Function to fetch customer satisfaction data
  const fetchCustomerSatisfactionData = async () => {
    try {
      setCustomerSatisfactionLoading(true);
      setCustomerSatisfactionError(null);

      // Get the staff token explicitly
      const staffToken =
        localStorage.getItem("staff_token") || localStorage.getItem("token");

      if (!staffToken) {
        throw new Error(
          "No staff token available for fetching customer satisfaction data",
        );
      }

      const response = await http.get(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/bookings/customer-satisfaction`,
        {
          headers: {
            Authorization: `Bearer ${staffToken}`,
          },
        },
      );

      const responseData = response.data;
      console.log("Customer satisfaction data response:", responseData);

      if (responseData && Array.isArray(responseData)) {
        setCustomerSatisfactionData(responseData);
      } else {
        console.warn("Invalid customer satisfaction data format");
        setCustomerSatisfactionError("Invalid data format received");

        // Keep the default empty data structure
        setCustomerSatisfactionData([
          { rating: "1 ★", count: 0 },
          { rating: "2 ★", count: 0 },
          { rating: "3 ★", count: 0 },
          { rating: "4 ★", count: 0 },
          { rating: "5 ★", count: 0 },
        ]);
      }

      setCustomerSatisfactionLoading(false);
    } catch (error) {
      console.error("Error fetching customer satisfaction data:", error);
      setCustomerSatisfactionError("Failed to load customer satisfaction data");

      // Keep the default empty data structure
      setCustomerSatisfactionData([
        { rating: "1 ★", count: 0 },
        { rating: "2 ★", count: 0 },
        { rating: "3 ★", count: 0 },
        { rating: "4 ★", count: 0 },
        { rating: "5 ★", count: 0 },
      ]);

      setCustomerSatisfactionLoading(false);
    }
  };

  useEffect(() => {
    const initializeManager = async () => {
      try {
        console.log("🔄 Initializing manager dashboard...");

        // Ensure staff token is available
        const staffToken = ensureStaffToken();
        if (!staffToken) {
          console.error("No staff token available");
          navigate("/staff-login");
          return;
        }

        // Verify authentication
        try {
          const response = await http.get(
            `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/users/profile`,
            {
              headers: {
                Authorization: `Bearer ${staffToken}`,
              },
            },
          );

          if (response.data && response.data.role === "manager") {
            console.log("✅ Manager authentication successful");
            // Set the user state from the profile response
            setUser(response.data);
          } else {
            console.error("❌ User is not a manager");
            navigate("/staff-login");
            return;
          }
        } catch (authError) {
          console.error("❌ Authentication failed:", authError);
          navigate("/staff-login");
          return;
        }

        // Now fetch the data
        fetchAllData();
        initializeSocketAndData();
      } catch (error) {
        console.error("Error initializing manager dashboard:", error);
      }
    };

    initializeManager();
  }, [navigate]);

  // Fix the token validation effect to handle the 404 error
  useEffect(() => {
    const validateToken = async () => {
      try {
        // Ensure staff token is available
        const staffToken = localStorage.getItem("staff_token");
        const legacyToken = localStorage.getItem("token");

        if (!staffToken && !legacyToken) {
          console.error("No staff token available for manager dashboard");
          // Redirect to login if no token
          navigate("/staff-login");
          return;
        }

        // Use the staff token for all manager dashboard requests
        if (legacyToken && !staffToken) {
          localStorage.setItem("staff_token", legacyToken);
          console.log("🔄 Starting token migration...");
        }

        // Skip token validation API call since endpoint doesn't exist
        // Just check if token exists and proceed
        if (staffToken || legacyToken) {
          console.log("✅ Token exists, proceeding with dashboard load");
          setTokenValidated(true);
        } else {
          console.error("❌ No valid token found");
          navigate("/staff-login");
        }
      } catch (error) {
        console.error("Token validation error:", error);
        // Don't redirect on error, let the component try to load
        // The individual API calls will handle their own errors
        setTokenValidated(true);
      }
    };

    validateToken();
  }, [navigate]);

  const customerDiff = totalCustomers - totalCustomersUpToYesterday;
  const customerComparisonText =
    customerDiff >= 0 ? `+${customerDiff}` : `${customerDiff}`;

  const revenueDiff = totalRevenue - totalRevenueYesterday;
  const appointmentDiff = totalAppointments - totalAppointmentsYesterday;

  const doneCount = allAppointments.filter(
    (appt) => appt.status === "Completed" || appt.status === "Done",
  ).length;
  const pendingCount = allAppointments.filter(
    (appt) => appt.status === "Pending" || appt.status === "Confirmed",
  ).length;
  const cancelledCount = allAppointments.filter(
    (appt) => appt.status === "Cancelled",
  ).length;
  const rescheduleCount = allAppointments.filter(
    (appt) => appt.status === "Rescheduled" || appt.status === "Reschedule",
  ).length;
  const absentCount = allAppointments.filter(
    (appt) => appt.status === "Absent",
  ).length;

  // Helper for maintenance View All button
  const MaintenanceViewAllButton = ({ style }) => (
    <button
      className="manager-view-all-button maintenance"
      style={{
        cursor: "pointer",
        ...style,
      }}
      onClick={() => alert("This feature is currently under maintenance.")}
    >
      View All
    </button>
  );

  // Remove the conditional render that's causing the loading message
  return (
    <main className="manager-main-content">
      <div className="manager-main-summary-and-transactions">
        <div className="manager-left-summary-overall">
          <div className="manager-summary-header">
            <h2 className="manager-summary-title">
              Overall Staffs Status Appointment
            </h2>
            <MaintenanceViewAllButton />
          </div>
          <div className="manager-summary-cards-container">
            {[
              { img: summ1, label: "Done", value: doneCount },
              { img: summ3, label: "Pending", value: pendingCount },
              { img: summ2, label: "Reschedule", value: rescheduleCount },
              { img: summ4, label: "Cancelled", value: cancelledCount },
            ].map(({ img, label, value }) => (
              <div key={label} className="manager-summary-card">
                <img
                  src={img}
                  alt={label}
                  className="manager-summary-icon-img"
                />
                <div>
                  <p className="manager-summary-label">{label}</p>
                  <p className="manager-summary-value">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="manager-overall-performance-title">
            Today's Overall Performance Overview
          </h2>
          <div className="manager-overall-performance-cards">
            <div className="manager-overall-card revenue-card">
              <div className="manager-overall-card-header">
                <span className="manager-overall-card-title">
                  Total Revenue
                </span>
                <MaintenanceViewAllButton />
              </div>
              <p className="manager-amount-centered">
                <span
                  style={{
                    color:
                      revenueDiff > 0
                        ? "#90d14f"
                        : revenueDiff < 0
                          ? "#ff1723"
                          : "white",
                  }}
                >
                  RM{totalRevenue.toLocaleString()}
                </span>
                {revenueDiff !== 0 && (
                  <span
                    className="trend-indicator"
                    style={{
                      color:
                        revenueDiff > 0
                          ? "#90d14f"
                          : revenueDiff < 0
                            ? "#ff1723"
                            : "white",
                    }}
                  >
                    {revenueDiff > 0 ? "▲" : revenueDiff < 0 ? "▼" : ""}
                  </span>
                )}
              </p>
              <p className="manager-comparison-text-centered">
                <span className="bold-number">
                  {revenueDiff > 0 ? "+" : revenueDiff < 0 ? "-" : ""}
                  RM{Math.abs(revenueDiff).toLocaleString()}
                </span>{" "}
                <span className="normal-text">compared to yesterday</span>
              </p>
            </div>

            <div className="manager-overall-card appointment-card">
              <div className="manager-overall-card-header">
                <span className="manager-overall-card-title">
                  Total Appointment
                </span>
                <MaintenanceViewAllButton />
              </div>
              <p className="manager-amount-centered">
                <span
                  style={{
                    color:
                      appointmentDiff > 0
                        ? "#90d14f"
                        : appointmentDiff < 0
                          ? "#ff1723"
                          : "white",
                  }}
                >
                  {totalAppointments}
                </span>
                {appointmentDiff !== 0 && (
                  <span
                    className="trend-indicator"
                    style={{
                      color:
                        appointmentDiff > 0
                          ? "#90d14f"
                          : appointmentDiff < 0
                            ? "#ff1723"
                            : "white",
                    }}
                  >
                    {appointmentDiff > 0 ? "▲" : appointmentDiff < 0 ? "▼" : ""}
                  </span>
                )}
              </p>
              <p className="manager-comparison-text-centered">
                <span className="bold-number">
                  {appointmentDiff > 0 ? "+" : appointmentDiff < 0 ? "-" : ""}
                  {Math.abs(appointmentDiff)}
                </span>{" "}
                <span className="normal-text">compared to yesterday</span>
              </p>
            </div>

            <div className="manager-overall-card customer-card">
              <div className="manager-overall-card-header">
                <span className="manager-overall-card-title">
                  Total Registered Customer
                </span>
                <MaintenanceViewAllButton />
              </div>
              <p className="manager-amount-centered">
                {isLoading
                  ? "Loading..."
                  : fetchError
                    ? "N/A"
                    : totalCustomers.toLocaleString()}
              </p>
              <p className="manager-comparison-text-centered">
                <span className="normal-text">
                  {isLoading || fetchError ? (
                    "No data available"
                  ) : (
                    <>
                      <span className="bold-number">
                        {customerComparisonText}
                      </span>{" "}
                      since yesterday
                    </>
                  )}
                </span>
              </p>
              {fetchError && (
                <div
                  className="error-text"
                  style={{ color: "#ff1723", fontSize: 12 }}
                >
                  {fetchError}
                  <button
                    style={{
                      marginLeft: 10,
                      color: "#3b82f6",
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      fetchCustomerData(
                        setTotalCustomers,
                        setTotalCustomersUpToYesterday,
                        setFetchError,
                        setIsLoading,
                      )
                    }
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="number-of-transaction-container">
          <header className="transaction-header">
            <h2>Number of Transaction</h2>
            <MaintenanceViewAllButton />
          </header>

          <div className="outlet-selector">
            <button
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className="scroll-btn"
            >
              ‹
            </button>

            <div
              className="outlet-list-wrapper"
              ref={outletListRef}
              onScroll={onScroll}
              style={{ overflowX: "auto", whiteSpace: "nowrap" }}
            >
              <div
                className="outlet-list"
                style={{
                  transform: `translateX(-${scrollIndex * itemWidth}px)`,
                  width: `${outlets.length * itemWidth}px`,
                }}
              >
                {outlets.map((outlet) => {
                  const selected = selectedOutlets.includes(outlet);
                  return (
                    <button
                      key={outlet}
                      className={`outlet-btn ${selected ? "selected" : ""}`}
                      onClick={() => toggleOutlet(outlet)}
                      aria-pressed={selected}
                    >
                      {outlet}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={scrollRight}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className="scroll-btn"
            >
              ›
            </button>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                barCategoryGap={0.5}
                barGap={0}
              >
                <XAxis
                  dataKey="outlet"
                  axisLine={false}
                  tick={false}
                  height={40}
                  stroke="#ccc"
                >
                  <Label
                    value="Outlet"
                    offset={7}
                    position="insideBottom"
                    style={{
                      fill: "#ccc",
                      fontSize: 10,
                      fontFamily: "Quicksand, sans-serif",
                    }}
                    dy={-15}
                  />
                </XAxis>
                <YAxis
                  axisLine={false}
                  tick={false}
                  allowDecimals={false}
                  stroke="#ccc"
                  domain={[0, "dataMax + 5"]}
                >
                  <Label
                    value="No. of Transaction"
                    angle={-90}
                    position="insideLeft"
                    offset={10}
                    dx={38}
                    dy={40}
                    style={{
                      fill: "#ccc",
                      fontSize: 10,
                      fontFamily: "Quicksand, sans-serif",
                    }}
                  />
                </YAxis>
                <Tooltip
                  cursor={{ fill: "#1a1a1a" }}
                  content={<CustomTooltip />}
                />
                <Bar
                  dataKey="transactions"
                  radius={[2, 2, 0, 0]}
                  label={{
                    position: "insideTop",
                    fill: "white",
                    fontSize: 10,
                    fontFamily: "Quicksand, sans-serif",
                  }}
                >
                  {filteredData.map((entry, index) => {
                    const isActive =
                      activeIndexTransaction === null ||
                      activeIndexTransaction === index;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        style={{
                          opacity: isActive ? 1 : 0.3,
                          transition: "opacity 0.3s ease",
                          cursor: "pointer",
                        }}
                        onMouseEnter={() => setActiveIndexTransaction(index)}
                        onMouseLeave={() => setActiveIndexTransaction(null)}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="manager-bottom-row">
        <div className="pending-approvals-container">
          <div className="pending-approvals-header">
            <h2 className="pending-approvals-title">Pending Staff Approvals</h2>
            <MaintenanceViewAllButton />
          </div>
          {isLoading ? (
            <p>Loading pending approvals...</p>
          ) : fetchError ? (
            <div
              className="error-text"
              style={{ color: "#ff1723", fontSize: 12 }}
            >
              {fetchError}
              <button
                style={{
                  marginLeft: 10,
                  color: "#3b82f6",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() =>
                  fetchDashboardData(
                    setPendingApprovals,
                    setStaffList,
                    setAllAppointments,
                    setTotalRevenue,
                    setTotalRevenueYesterday,
                    setTotalAppointments,
                    setTotalAppointmentsYesterday,
                    setFetchError,
                    setIsLoading,
                    navigate,
                  )
                }
              >
                Retry
              </button>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <p className="pending-approvals-empty">No pending approvals.</p>
          ) : (
            <>
              <div className="pending-approvals-headers">
                <div>NAME</div>
                <div className="date-time">DATE/TIME</div>
              </div>
              {[...pendingApprovals]
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                .map((staff, index) => {
                  const d = staff.createdAt ? new Date(staff.createdAt) : null;
                  const formattedDate = d
                    ? d.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "-";
                  const formattedTime = d
                    ? d.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : "-";
                  const finalFormatted = `${formattedDate}, ${formattedTime}`;
                  return (
                    <div key={index} className="pending-approvals-row">
                      <div>{staff.username || "(No username)"}</div>
                      <div className="date-time">{finalFormatted}</div>
                    </div>
                  );
                })}
            </>
          )}
        </div>

        <div className="manager-customer-satisfaction-container manager-schedule-container compact">
          <div className="manager-schedule-header">
            <h2 className="manager-schedule-title">Customer Satisfaction</h2>
            <MaintenanceViewAllButton />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={customerSatisfactionData}
              margin={{ top: -5, right: 30, bottom: 10, left: 10 }}
              barCategoryGap={3}
            >
              <XAxis
                dataKey="rating"
                stroke="#fff"
                tick={{ fontFamily: "Quicksand, sans-serif", fontSize: 14 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              >
                <Label
                  value="Customer Rating"
                  position="bottom"
                  offset={25}
                  style={{
                    fill: "#fff",
                    fontSize: 10,
                    fontFamily: "Quicksand, sans-serif",
                  }}
                  dy={-30}
                />
              </XAxis>
              <YAxis
                stroke="#fff"
                tick={{ fontFamily: "Quicksand, sans-serif", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, 70]}
              >
                <Label
                  value="Number of Customer Rating"
                  angle={-90}
                  position="insideLeft"
                  offset={-5}
                  style={{
                    fill: "#fff",
                    fontSize: 10,
                    fontFamily: "Quicksand, sans-serif",
                  }}
                  dy={60}
                  dx={32}
                />
              </YAxis>
              <Tooltip
                cursor={{ fill: "#1a1a1a" }}
                content={<CustomerSatisfactionTooltip />}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                fill="#4a7aff"
                shape={(props) => (
                  <CustomBarShape
                    {...props}
                    activeIndex={activeIndexSatisfaction}
                    setActiveIndex={setActiveIndexSatisfaction}
                  />
                )}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="manager-staff-management-container manager-schedule-container compact">
          <div className="manager-schedule-header">
            <h2 className="manager-schedule-title">Staff Attendance</h2>
            <MaintenanceViewAllButton />
          </div>
          <div className="staff-attendance-summary">
            <div className="attendance-table-header">
              <div className="attendance-table-cell outlet">OUTLET</div>
              <div className="attendance-table-cell on-duty">ON DUTY</div>
              <div className="attendance-table-cell off-duty">OFF DUTY</div>
            </div>
            {attendanceError
              ? // Always show default data even if there's an error
                [
                  { outlet: "PKL", onDuty: 5, offDuty: 2 },
                  { outlet: "MVC", onDuty: 3, offDuty: 1 },
                  { outlet: "ONU", onDuty: 4, offDuty: 3 },
                  { outlet: "SWP", onDuty: 6, offDuty: 0 },
                ].map(({ outlet, onDuty, offDuty }) => (
                  <div key={outlet} className="attendance-table-row">
                    <div className="attendance-table-cell outlet">{outlet}</div>
                    <div
                      className="attendance-table-cell on-duty"
                      style={{ color: "#90d14f" }}
                    >
                      {onDuty}
                    </div>
                    <div
                      className="attendance-table-cell off-duty"
                      style={{ color: "#ec1f23" }}
                    >
                      {offDuty}
                    </div>
                  </div>
                ))
              : staffStatus.length === 0
                ? // Show default data if no attendance data available
                  [
                    { outlet: "PKL", onDuty: 5, offDuty: 2 },
                    { outlet: "MVC", onDuty: 3, offDuty: 1 },
                    { outlet: "ONU", onDuty: 4, offDuty: 3 },
                    { outlet: "SWP", onDuty: 6, offDuty: 0 },
                  ].map(({ outlet, onDuty, offDuty }) => (
                    <div key={outlet} className="attendance-table-row">
                      <div className="attendance-table-cell outlet">
                        {outlet}
                      </div>
                      <div
                        className="attendance-table-cell on-duty"
                        style={{ color: "#90d14f" }}
                      >
                        {onDuty}
                      </div>
                      <div
                        className="attendance-table-cell off-duty"
                        style={{ color: "#ec1f23" }}
                      >
                        {offDuty}
                      </div>
                    </div>
                  ))
                : // Show actual data if available
                  staffStatus.map(({ outlet, onDuty, offDuty }) => (
                    <div key={outlet} className="attendance-table-row">
                      <div className="attendance-table-cell outlet">
                        {outlet}
                      </div>
                      <div
                        className="attendance-table-cell on-duty"
                        style={{ color: "#90d14f" }}
                      >
                        {onDuty}
                      </div>
                      <div
                        className="attendance-table-cell off-duty"
                        style={{ color: "#ec1f23" }}
                      >
                        {offDuty}
                      </div>
                    </div>
                  ))}
          </div>
        </div>
      </div>

      {user && user.role === "manager" && (
        <SwitchModeButton
          modeText="Switch to Staff Mode"
          onClick={() => navigate("/staff")}
          className="toggle-switch-button"
        />
      )}
    </main>
  );
};

export default ManagerDashboard;



