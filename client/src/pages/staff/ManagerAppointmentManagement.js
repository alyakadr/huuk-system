import React, { useState, useEffect, useMemo } from "react";
import http from "../../utils/httpClient";
import moment from "moment";
import { API_BASE_URL, SOCKET_URL } from "../../utils/constants";
import { getSocketConnectOptions } from "../../utils/socketClient";
import RescheduleBookingModal from "../../components/RescheduleBookingModal";
import { io } from "socket.io-client";
import { fetchOutlets } from "../../utils/bookingUtils";
import {
  OUTLET_SHORTCUTS_TITLE,
  OUTLET_SHORTCUTS_UPPER,
} from "../../constants/outlets";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  Button,
} from "@mui/material";

// Default outlet list shown before/when the /outlets API returns no data.
const DEFAULT_OUTLETS = Object.entries(OUTLET_SHORTCUTS_TITLE).map(
  ([name, shortform]) => ({ id: shortform, name, shortform }),
);

// Hardcoded fallback appointments so the table always has content, even when
// the API is unavailable. Swap / extend freely — the component prefers
// server data whenever the API call succeeds with a non-empty list.
const TODAY = new Date().toISOString().slice(0, 10);
const SAMPLE_APPOINTMENTS = [
  {
    id: "sample-1",
    date: TODAY,
    start_time: "10:00",
    end_time: "10:30",
    username: "Addy",
    service: "Haircut Adult",
    status: "Overdue",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-2",
    date: TODAY,
    start_time: "10:00",
    end_time: "10:30",
    username: "Chunkz",
    service: "Kids Haircut",
    status: "Completed",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-3",
    date: TODAY,
    start_time: "10:00",
    end_time: "10:30",
    username: "Haziq",
    service: "Waxing",
    status: "Completed",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-4",
    date: TODAY,
    start_time: "10:30",
    end_time: "11:00",
    username: "Danial",
    service: "Bear Colour",
    status: "In Progress",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-5",
    date: TODAY,
    start_time: "10:30",
    end_time: "11:30",
    username: "Haziq",
    service: "Hair colour",
    status: "In Progress",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-6",
    date: TODAY,
    start_time: "11:00",
    end_time: "12:00",
    username: "Addy",
    service: "Haircut & Wash",
    status: "In Progress",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-7",
    date: TODAY,
    start_time: "12:00",
    end_time: "12:30",
    username: "Irfan",
    service: "Haircut Adult",
    status: "Upcoming",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-8",
    date: TODAY,
    start_time: "09:30",
    end_time: "10:00",
    username: "Jordan",
    service: "Beard Trim",
    status: "Cancelled",
    outlet: "Setia City Mall",
    outlet_shortform: "SCM",
  },
  {
    id: "sample-9",
    date: TODAY,
    start_time: "11:00",
    end_time: "11:30",
    username: "Luqman",
    service: "Kids Haircut",
    status: "In Progress",
    outlet: "Pavilion KL",
    outlet_shortform: "PKL",
  },
  {
    id: "sample-10",
    date: TODAY,
    start_time: "11:30",
    end_time: "12:00",
    username: "Kai",
    service: "Hair colour",
    status: "Upcoming",
    outlet: "Pavilion KL",
    outlet_shortform: "PKL",
  },
  {
    id: "sample-11",
    date: TODAY,
    start_time: "13:00",
    end_time: "13:30",
    username: "Danial",
    service: "Haircut Adult",
    status: "Upcoming",
    outlet: "Lot 10 Shopping Centre",
    outlet_shortform: "L10",
  },
  {
    id: "sample-12",
    date: TODAY,
    start_time: "14:00",
    end_time: "14:30",
    username: "Addy",
    service: "Waxing",
    status: "Upcoming",
    outlet: "Mid Valley Megamall (Centre Court)",
    outlet_shortform: "MVC",
  },
];

// Icon components (you can replace these with actual icon library imports)
const CalendarIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const UserIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ScissorsIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const ManagerAppointmentManagement = () => {
  const [selectedLocation, setSelectedLocation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [appointments, setAppointments] = useState(SAMPLE_APPOINTMENTS);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  // Filters
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);
  const [, setOutletLoading] = useState(false);
  const [, setOutletError] = useState("");
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const [isTabletView, setIsTabletView] = useState(
    window.innerWidth > 768 && window.innerWidth <= 1100,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
      setIsTabletView(window.innerWidth > 768 && window.innerWidth <= 1100);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isCondensedView = isMobileView || isTabletView;

  // Resolve the staff name for an appointment using the same priority as the table cell.
  const getStaffName = (appointment) => {
    const direct =
      appointment?.username ||
      appointment?.staff_username ||
      appointment?.user_name;
    if (direct) return direct;
    const fallback = appointment?.staffName;
    if (fallback && fallback !== "-" && String(fallback).trim() !== "") {
      return fallback;
    }
    return "Unassigned";
  };

  // Resolve an outlet to its 3-letter shortform (SCM / PKL / ...).
  const getOutletShortform = (appointment) => {
    const explicit =
      appointment?.outlet_shortform ||
      appointment?.shortform ||
      appointment?.outlet_code ||
      appointment?.branch_code;
    if (explicit) return String(explicit).toUpperCase();

    const rawName = appointment?.outlet || appointment?.branch || "";
    if (!rawName) return "--";
    const upper = String(rawName).toUpperCase();
    if (OUTLET_SHORTCUTS_UPPER[upper]) return OUTLET_SHORTCUTS_UPPER[upper];
    if (OUTLET_SHORTCUTS_TITLE[rawName]) return OUTLET_SHORTCUTS_TITLE[rawName];
    // Fall back to the raw name if it's already short (<= 4 chars), else first 3 letters.
    return rawName.length <= 4 ? upper : upper.slice(0, 3);
  };

  // Build dropdown option sets from the appointments visible for the selected outlet.
  const appointmentsForOutlet = useMemo(() => {
    if (!selectedLocation) return appointments;
    return appointments.filter(
      (a) =>
        a.outlet === selectedLocation ||
        a.outlet_shortform === selectedLocation ||
        a.shortform === selectedLocation ||
        a.branch === selectedLocation,
    );
  }, [appointments, selectedLocation]);

  const staffOptions = useMemo(() => {
    const set = new Set();
    appointmentsForOutlet.forEach((a) => {
      const name = getStaffName(a);
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentsForOutlet]);

  const serviceOptions = useMemo(() => {
    const set = new Set();
    appointmentsForOutlet.forEach((a) => {
      if (a.service) set.add(a.service);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [appointmentsForOutlet]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    appointmentsForOutlet.forEach((a) => {
      if (a.status) set.add(a.status);
    });
    return Array.from(set);
  }, [appointmentsForOutlet]);

  // Function to handle submission from RescheduleBookingModal
  const handleRescheduleSubmit = async (rescheduleData) => {
    try {
      console.log("Reschedule data being sent:", rescheduleData);

      const token =
        localStorage.getItem("staff_token") || localStorage.getItem("token");
      console.log("Using token:", token ? "Token exists" : "No token found");

      const response = await http.put(
        `${API_BASE_URL}/bookings/staff/appointment/${rescheduleData.id}/reschedule`,
        {
          booking_date: rescheduleData.newDate,
          start_time: rescheduleData.newTime,
          date: rescheduleData.newDate,
          time: rescheduleData.newTime,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("Reschedule response:", response.data);

      // Update local state
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === rescheduleData.id
            ? {
                ...apt,
                booking_date: rescheduleData.newDate,
                start_time: rescheduleData.newTime,
              }
            : apt,
        ),
      );
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      alert("Appointment rescheduled successfully!");
      await fetchAppointments();
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      alert("Failed to reschedule appointment. Please try again.");
    }
  };

  // Pagination settings
  const ITEMS_PER_PAGE = 6;
  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedAppointments = filteredAppointments.slice(
    startIndex,
    endIndex,
  );

  // Function to get authentication token
  const getAuthToken = () => {
    // Try to get token directly
    const token = localStorage.getItem("token");

    // Try to get staff token from staff_loggedInUser object
    let staffToken = null;
    try {
      const staffUser = JSON.parse(
        localStorage.getItem("staff_loggedInUser") || "{}",
      );
      staffToken = staffUser.token;
    } catch (e) {
      console.error("Error parsing staff_loggedInUser:", e);
    }

    // Try to get token from loggedInUser object (legacy)
    let legacyToken = null;
    try {
      const legacyUser = JSON.parse(
        localStorage.getItem("loggedInUser") || "{}",
      );
      legacyToken = legacyUser.token;
    } catch (e) {
      console.error("Error parsing loggedInUser:", e);
    }

    // Return the first available token
    const finalToken = token || staffToken || legacyToken;

    if (!finalToken) {
      console.error("No authentication token found in any storage location");
    }

    return finalToken;
  };

  // Function to fetch all appointments dynamically
  const fetchAppointments = async () => {
    try {
      const finalToken = getAuthToken();

      if (!finalToken) {
        throw new Error("No authentication token found");
      }

      console.log("Fetching all appointments dynamically...");
      const response = await http.get(
        `${API_BASE_URL}/bookings/appointments/all`,
        {
          headers: {
            Authorization: `Bearer ${finalToken}`,
          },
        },
      );

      console.log(
        "Raw appointments data:",
        response.data.length,
        "total appointments",
      );

      // Filter appointments that have a service (either service_id or service name) and are not draft
      const validAppointments = response.data.filter((appointment) => {
        const hasService =
          appointment.service_id != null ||
          (appointment.service &&
            appointment.service !== "" &&
            appointment.service !== null);
        // No longer need to check for draft status since is_draft field is removed
        const notDraft = true;
        return hasService && notDraft;
      });

      console.log(
        "Valid appointments after filtering:",
        validAppointments.length,
      );

      // Log outlet distribution
      const outletCounts = validAppointments.reduce((acc, apt) => {
        const outlet = apt.outlet || "Unknown";
        acc[outlet] = (acc[outlet] || 0) + 1;
        return acc;
      }, {});
      console.log("Appointments by outlet:", outletCounts);

      if (validAppointments.length > 0) {
        setAppointments(validAppointments);
        return validAppointments;
      }
      // Keep the hardcoded fallback visible when the API returns nothing.
      setAppointments(SAMPLE_APPOINTMENTS);
      return SAMPLE_APPOINTMENTS;
    } catch (error) {
      console.error(
        "Error fetching appointments:",
        error.response?.status,
        error.response?.data,
      );
      // Silent fallback to the hardcoded sample so the UI always has data.
      setAppointments(SAMPLE_APPOINTMENTS);
      return SAMPLE_APPOINTMENTS;
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([fetchAppointments()]);
      } catch (error) {
        console.error("Error loading initial data:", error);
        setError(error.message || "Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, getSocketConnectOptions());
    socket.on("bookingUpdated", () => {
      fetchAppointments();
    });
    socket.on("booking_updated", () => {
      fetchAppointments();
    });
    socket.on("slotUpdate", () => {
      fetchAppointments();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch outlets on mount. Only overwrite defaults when the API returns a
  // non-empty list; otherwise keep the DEFAULT_OUTLETS seed so the tabs
  // always render.
  useEffect(() => {
    const guardedSetOutlets = (value) => {
      const next =
        typeof value === "function" ? value(DEFAULT_OUTLETS) : value;
      if (Array.isArray(next) && next.length > 0) {
        setOutlets(next);
      }
    };
    fetchOutlets(setOutletLoading, guardedSetOutlets, setOutletError);
  }, []);

  // Dynamic filtering function for appointments by outlet and date
  useEffect(() => {
    const filterAppointments = () => {
      // Only show appointments for today (across all outlets by default).
      const todayStr = moment().format("YYYY-MM-DD");
      let filtered = appointments.filter((apt) => {
        const raw = apt?.date || apt?.booking_date || "";
        if (!raw) return false;
        const aptDay = String(raw).split("T")[0];
        return aptDay === todayStr;
      });

      // Dynamic outlet filtering - more robust outlet matching
      if (selectedLocation) {
        filtered = filtered.filter((appointment) => {
          // Try multiple outlet field variations for robust filtering
          const outletMatches =
            appointment.outlet === selectedLocation ||
            appointment.outlet_shortform === selectedLocation ||
            appointment.shortform === selectedLocation ||
            appointment.branch === selectedLocation;

          return outletMatches;
        });
        console.log(
          `Filtered by outlet '${selectedLocation}':`,
          filtered.length,
          "appointments",
        );
      }

      // Staff filter
      if (selectedStaff) {
        filtered = filtered.filter(
          (appointment) => getStaffName(appointment) === selectedStaff,
        );
      }

      // Service filter
      if (selectedService) {
        filtered = filtered.filter(
          (appointment) => (appointment.service || "") === selectedService,
        );
      }

      // Status filter
      if (selectedStatus) {
        filtered = filtered.filter(
          (appointment) => (appointment.status || "") === selectedStatus,
        );
      }

      // Smart sorting with priority-based logic
      const sortedFiltered = filtered.sort((a, b) => {
        const statusPriority = {
          Upcoming: 1,
          Confirmed: 1,
          Scheduled: 1,
          "In Progress": 2,
          Overdue: 3,
          Completed: 4,
          Cancelled: 4,
          Absent: 4,
          Rescheduled: 4,
        };

        const aPriority = statusPriority[a.status] || 1;
        const bPriority = statusPriority[b.status] || 1;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Sort by date/time within same priority
        if (aPriority < 4) {
          const aDateTime = moment(`${a.date?.split("T")[0]}T${a.start_time}`);
          const bDateTime = moment(`${b.date?.split("T")[0]}T${b.start_time}`);

          if (aDateTime.isValid() && bDateTime.isValid()) {
            return aDateTime.diff(bDateTime);
          }
        } else {
          const aDateTime = moment(`${a.date?.split("T")[0]}T${a.start_time}`);
          const bDateTime = moment(`${b.date?.split("T")[0]}T${b.start_time}`);

          if (aDateTime.isValid() && bDateTime.isValid()) {
            return bDateTime.diff(aDateTime);
          }
        }

        return 0;
      });

      console.log("Final dynamic filtering result:", {
        total: appointments.length,
        filtered: sortedFiltered.length,
        outlet: selectedLocation || "ALL",
      });

      setFilteredAppointments(sortedFiltered);
    };

    filterAppointments();
  }, [
    appointments,
    selectedLocation,
    selectedStaff,
    selectedService,
    selectedStatus,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocation, selectedStaff, selectedService, selectedStatus]);

  const handleReschedule = (appointmentId) => {
    const appointment = appointments.find((apt) => apt.id === appointmentId);
    setSelectedAppointment(appointment);
    setShowRescheduleModal(true);
  };

  // Open cancel confirmation dialog
  const handleOpenCancelDialog = (appointmentId) => {
    const appointment = appointments.find((apt) => apt.id === appointmentId);
    setAppointmentToCancel(appointment);
    setShowCancelConfirmation(true);
  };

  // Handle cancel booking
  const handleCancel = async () => {
    if (!appointmentToCancel) return;

    try {
      await http.put(
        `${API_BASE_URL}/bookings/staff/appointment/${appointmentToCancel.id}/status`,
        {
          status: "cancelled",
        },
        {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        },
      );

      // Update local state to mark as cancelled instead of removing
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentToCancel.id
            ? { ...apt, status: "cancelled" }
            : apt,
        ),
      );

      // Refresh appointments from server to ensure data consistency
      await fetchAppointments();

      // Close the dialog
      setShowCancelConfirmation(false);
    } catch (error) {
      alert("Failed to cancel the appointment. Please try again.");
    }
  };

  const getActionButtons = (appointment) => {
    const disabled = [
      "Completed",
      "Cancelled",
      "Absent",
      "Rescheduled",
      "Overdue",
    ].includes(appointment.status);

    const baseBtn =
      "px-2 py-1 rounded text-[12px] font-bold font-quicksand min-w-[82px] max-w-[82px] h-[28px] leading-none transition-all duration-200 box-border text-center inline-block";

    return (
      <div className="flex gap-1.5 justify-center items-center flex-nowrap m-0">
        <button
          disabled={disabled}
          aria-disabled={disabled}
          className={`${baseBtn} ${
            disabled
              ? "bg-[#3a3a3a] text-[#9a9a9a] border border-[#3a3a3a] cursor-not-allowed"
              : "bg-[#1e7cff] text-white border border-[#1e7cff] cursor-pointer hover:bg-[#1668d6]"
          }`}
          onClick={() => !disabled && handleReschedule(appointment.id)}
        >
          Reschedule
        </button>
        <button
          disabled={disabled}
          aria-disabled={disabled}
          className={`${baseBtn} ${
            disabled
              ? "bg-[#3a3a3a] text-[#9a9a9a] border border-[#3a3a3a] cursor-not-allowed"
              : "bg-[#e53935] text-white border border-[#e53935] cursor-pointer hover:bg-[#c62828]"
          }`}
          onClick={() => !disabled && handleOpenCancelDialog(appointment.id)}
        >
          Cancel
        </button>
      </div>
    );
  };

  // Helper function to format date as DD-MM-YYYY
  const formatDateForDisplay = (dateValue) => {
    if (!dateValue) return "N/A";
    let dateString = dateValue;
    if (typeof dateValue === "string" && dateValue.includes("T")) {
      dateString = dateValue.split("T")[0];
    }
    const [year, month, day] = dateString.split("-");
    return `${day}-${month}-${year}`;
  };

  const outletTitle = selectedLocation
    ? `${outlets.find((o) => (o.shortform || o.name) === selectedLocation)?.name || selectedLocation} (${selectedLocation})`
    : "All Locations";

  const formatTimeRange = (appointment) => {
    if (!appointment.start_time || !appointment.end_time || !appointment.date) {
      return "N/A";
    }
    const dateOnly = appointment.date.split("T")[0];
    const startDateTime = moment(`${dateOnly}T${appointment.start_time}`);
    const endDateTime = moment(`${dateOnly}T${appointment.end_time}`);
    if (!startDateTime.isValid() || !endDateTime.isValid()) return "Invalid Time";
    return `${startDateTime.format("HH:mm")} - ${endDateTime.format("HH:mm")}`;
  };

  const renderStatusCell = (status) => {
    if (!status) return <span className="font-bold text-white/70">--</span>;

    // Color each status so staff can scan the column at a glance.
    const colorByStatus = {
      Upcoming: "#38bdf8",        // sky-400
      Confirmed: "#38bdf8",
      Scheduled: "#38bdf8",
      "In Progress": "#f59e0b",   // amber-500
      Overdue: "#ef4444",         // red-500
      Completed: "#22c55e",       // green-500
      Cancelled: "#f87171",       // red-400 (softer)
      Absent: "#ef4444",
      Rescheduled: "#a78bfa",     // violet-400
    };

    const color = colorByStatus[status] || "#ffffff";

    return (
      <span
        className="font-bold uppercase tracking-[0.3px]"
        style={{ color }}
      >
        {status}
      </span>
    );
  };

  return (
    <div
      className="w-full pb-3 pl-0 pr-1 pt-3 font-quicksand text-white relative"
      style={{
        marginLeft: "3px",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Outlet tabs — stretch to fill the row, no right-hand gap */}
      <div className="mb-3 flex w-full gap-1">
        <button
          type="button"
          onClick={() => setSelectedLocation("")}
          className="inline-flex flex-1 min-w-0 items-center justify-center rounded-[6px] px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.5px] transition-colors"
          style={{
            background: selectedLocation === "" ? "#ffc800" : "#1a1a1a",
            color: selectedLocation === "" ? "#1a1a1a" : "#fff",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          ALL
        </button>
        {outlets.map((outlet) => {
          const code = outlet.shortform || outlet.name;
          const active = selectedLocation === code;
          return (
            <button
              key={outlet.shortform || outlet.id || outlet.name}
              type="button"
              onClick={() => setSelectedLocation(code)}
              className="inline-flex flex-1 min-w-0 items-center justify-center rounded-[6px] px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.5px] transition-colors"
              style={{
                background: active ? "#ffc800" : "#1a1a1a",
                color: active ? "#1a1a1a" : "#fff",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {code}
            </button>
          );
        })}
      </div>

      {/* Main card */}
      <div className="rounded-[18px] bg-[#171717] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
        {/* Header row: title (left) + filter pills (right) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col items-start gap-1">
            <h2
              className="m-0 text-[18px] font-bold uppercase tracking-[0.5px]"
              style={{ color: "#ffc800", lineHeight: 1.2 }}
            >
              {outletTitle}
            </h2>
            <span className="rounded-full border border-orange-500/30 bg-orange-500/20 px-3 py-[3px] text-[11px] font-semibold text-orange-400">
              {filteredAppointments.length} appointments
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Staff filter */}
            <div className="relative">
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="h-[32px] w-[140px] appearance-none rounded-[8px] border border-white/15 bg-white pl-3 pr-7 text-[11px] font-bold uppercase tracking-[0.5px] text-[#171717] outline-none"
              >
                <option value="">BY ALL STAFF</option>
                {staffOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#171717]">
                <i className="bi bi-chevron-down text-[10px]" />
              </span>
            </div>

            {/* Service filter */}
            <div className="relative">
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="h-[32px] w-[150px] appearance-none rounded-[8px] border border-white/15 bg-white pl-3 pr-7 text-[11px] font-bold uppercase tracking-[0.5px] text-[#171717] outline-none"
              >
                <option value="">BY ALL SERVICE</option>
                {serviceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#171717]">
                <i className="bi bi-chevron-down text-[10px]" />
              </span>
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-[32px] w-[140px] appearance-none rounded-[8px] border border-white/15 bg-white pl-3 pr-7 text-[11px] font-bold uppercase tracking-[0.5px] text-[#171717] outline-none"
              >
                <option value="">BY ALL STATUS</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#171717]">
                <i className="bi bi-chevron-down text-[10px]" />
              </span>
            </div>
          </div>
        </div>

        {/* Loading / error states */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="m-0 text-[13px]">
              Loading appointments and outlets...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="mb-3 rounded-[10px] border border-red-500 bg-red-600/20 px-4 py-3 text-red-300">
            <p className="m-0 text-[13px]"><i className="bi bi-exclamation-triangle-fill mr-1" />{error}</p>
          </div>
        )}

        {/* Appointments table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "21%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "25%" }} />
              </colgroup>
              <thead>
                <tr className="text-[12px] font-bold uppercase tracking-wide text-white/90">
                  <th className="border-b border-white/15 px-3 py-2">Time</th>
                  <th className="border-b border-white/15 px-3 py-2">
                    Staff Name
                  </th>
                  <th className="border-b border-white/15 px-3 py-2">
                    Service
                  </th>
                  <th className="border-b border-white/15 pl-1 pr-3 py-2">
                    Outlet
                  </th>
                  <th className="border-b border-white/15 px-3 py-2">Status</th>
                  <th className="border-b border-white/15 px-3 py-2 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAppointments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-[14px] text-white/70"
                    >
                      No appointments found.
                    </td>
                  </tr>
                ) : (
                  Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => {
                    const appointment = paginatedAppointments[i];
                    if (!appointment) {
                      return (
                        <tr
                          key={`empty-row-${i}`}
                          className="text-[14px] text-white"
                        >
                          <td className="px-3 py-2" style={{ height: 48 }} />
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={appointment.id}
                        className="text-[14px] text-white"
                      >
                        <td className="px-3 py-2 font-bold">
                          {formatTimeRange(appointment)}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          {getStaffName(appointment)}
                        </td>
                        <td className="px-3 py-2 font-bold truncate">
                          {appointment.service || "--"}
                        </td>
                        <td className="pl-1 pr-3 py-2 font-bold uppercase tracking-[0.3px] text-white">
                          {getOutletShortform(appointment)}
                        </td>
                        <td className="px-3 py-2">
                          {renderStatusCell(appointment.status)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center">
                            {getActionButtons(appointment)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="min-w-[80px] rounded-md border border-white/15 bg-transparent px-4 py-1.5 text-[14px] font-bold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Prev
            </button>

            <span className="min-w-[48px] text-center text-[15px] font-bold text-white">
              {currentPage}/{totalPages || 1}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage(Math.min(totalPages || 1, currentPage + 1))
              }
              disabled={currentPage >= (totalPages || 1)}
              className="min-w-[80px] rounded-md border border-white/15 bg-transparent px-4 py-1.5 text-[14px] font-bold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Reschedule Booking Modal */}
      <RescheduleBookingModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setSelectedAppointment(null);
        }}
        selectedBooking={selectedAppointment}
        onSubmit={handleRescheduleSubmit}
      />

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={showCancelConfirmation}
        onClose={() => setShowCancelConfirmation(false)}
        className="reschedule-dialog"
        maxWidth="sm"
        PaperProps={{
          sx: {
            width: isMobileView ? "calc(100vw - 24px)" : undefined,
            maxWidth: isMobileView ? "calc(100vw - 24px)" : undefined,
            margin: isMobileView ? "12px" : undefined,
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Box
            sx={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "rgba(236, 31, 35, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography sx={{ color: "#ec1f23", fontSize: "20px" }}>
              !
            </Typography>
          </Box>
          <Typography sx={{ fontWeight: "bold" }}>
            Confirm Cancellation
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: "medium" }}>
            Are you sure you want to cancel this booking?
          </Typography>
          <Typography
            variant="body2"
            sx={{ mb: 3, color: "#ff6b4a", fontStyle: "italic" }}
          >
            This action cannot be undone and the customer will be notified of
            the cancellation.
          </Typography>
          {appointmentToCancel && (
            <Box
              sx={{
                p: 2,
                bgcolor: "rgba(255,255,255,0.05)",
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Booking ID:</strong> #
                {String(appointmentToCancel.id).padStart(7, "0")}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Service:</strong> {appointmentToCancel.service}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Date:</strong>{" "}
                {formatDateForDisplay(
                  appointmentToCancel.date || appointmentToCancel.booking_date,
                )}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Time:</strong> {appointmentToCancel.start_time} -{" "}
                {appointmentToCancel.end_time}
              </Typography>
              <Typography variant="body2">
                <strong>Staff:</strong>{" "}
                {appointmentToCancel.username ||
                  appointmentToCancel.staffName ||
                  "Unassigned"}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: "1px solid #333",
            p: 2,
            flexWrap: isMobileView ? "wrap" : "nowrap",
            gap: isMobileView ? 1 : 0,
          }}
        >
          <Button
            onClick={() => setShowCancelConfirmation(false)}
            sx={{
              fontFamily: "Quicksand, sans-serif",
              textTransform: "none",
              fontWeight: "bold",
              minWidth: isMobileView ? "100%" : "120px",
              backgroundColor: "transparent",
              color: "#fff",
              border: "1px solid #fff",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              },
            }}
          >
            Keep Booking
          </Button>
          <Button
            onClick={handleCancel}
            sx={{
              bgcolor: "#ec1f23 !important",
              "&:hover": { bgcolor: "#d81b1f !important" },
              fontFamily: "Quicksand, sans-serif",
              textTransform: "none",
              fontWeight: "bold",
              minWidth: isMobileView ? "100%" : "160px",
              color: "#fff",
            }}
          >
            Yes, Cancel Booking
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ManagerAppointmentManagement;
