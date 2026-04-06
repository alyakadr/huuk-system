import React, { useState, useEffect } from "react";
import http from "../../utils/httpClient";
import moment from "moment";
import { API_BASE_URL } from "../../utils/constants";
import api from "../../utils/api";
import RescheduleBookingModal from "../../components/RescheduleBookingModal";
import { io } from "socket.io-client";
import { fetchOutlets } from "../../utils/bookingUtils";
import {
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  Button,
} from "@mui/material";

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

const StatusIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="9,11 12,14 22,4" />
    <path d="M21,12v7a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h11" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="23,4 23,10 17,10" />
    <polyline points="1,20 1,14 7,14" />
    <path d="M20.49,9A9,9 0 0,0 5.64,5.64L1,10m22,4a9,9 0 0,1 -14.85,3.36L23,14" />
  </svg>
);

const CancelIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const ManagerAppointmentManagement = () => {
  const [selectedLocation, setSelectedLocation] = useState("");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [appointments, setAppointments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  // 1. Add a new state for the date picker
  const [selectedDate, setSelectedDate] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [outletLoading, setOutletLoading] = useState(false);
  const [outletError, setOutletError] = useState("");
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);

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
  const ITEMS_PER_PAGE = 4; // Changed from 5 to 4
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

      setAppointments(validAppointments);
      return validAppointments;
    } catch (error) {
      console.error(
        "Error fetching appointments:",
        error.response?.status,
        error.response?.data,
      );
      throw error;
    }
  };

  // Function to refresh all data
  const refreshData = async () => {
    setRefreshing(true);
    setError(null);

    try {
      await Promise.all([fetchAppointments()]);
      console.log("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError(error.message || "Failed to load data");
    } finally {
      setRefreshing(false);
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
    const socket = io(API_BASE_URL);
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

  // Fetch outlets on mount
  useEffect(() => {
    fetchOutlets(setOutletLoading, setOutlets, setOutletError);
  }, []);

  // Dynamic filtering function for appointments by outlet and date
  useEffect(() => {
    const filterAppointments = () => {
      let filtered = [...appointments];

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

      // Dynamic date filtering
      if (selectedDate) {
        const today = moment();
        const beforeFilter = filtered.length;

        filtered = filtered.filter((appointment) => {
          if (!appointment.date) return false;

          const appointmentDate = moment(appointment.date);

          if (!appointmentDate.isValid()) {
            console.log(
              "Invalid date for appointment:",
              appointment.id,
              appointment.date,
            );
            return false;
          }

          const selectedDateMoment = moment(selectedDate);

          if (selectedDateMoment.isSame(appointmentDate, "day")) {
            return true;
          }

          return false;
        });

        console.log(
          `Date filter '${selectedDate}': ${beforeFilter} -> ${filtered.length} appointments`,
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
        dateFilter: selectedDate,
      });

      setFilteredAppointments(sortedFiltered);
    };

    filterAppointments();
  }, [appointments, selectedLocation, selectedDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocation, selectedDate]);

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
      const response = await http.put(
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

  const getStatusClass = (status) => {
    switch (status) {
      case "Overdue":
        return "status-overdue";
      case "Completed":
        return "status-completed";
      case "In Progress":
        return "status-in-progress";
      default:
        return "";
    }
  };

  const getActionButtons = (appointment) => {
    if (
      ["Completed", "Cancelled", "Absent", "Rescheduled"].includes(
        appointment.status,
      )
    ) {
      return (
        <div className="flex items-center justify-center">
          <span
            className="italic font-normal text-xs"
            style={{
              fontStyle: "italic",
              fontFamily: "Quicksand, sans-serif",
              fontWeight: 400,
              fontSize: "12px",
              color:
                appointment.status === "Completed"
                  ? "#4caf50"
                  : appointment.status === "Rescheduled"
                    ? "#ff9800"
                    : "#f44336",
            }}
          >
            {appointment.status}
          </span>
        </div>
      );
    }

    return (
        <div className="flex gap-1 justify-center items-center flex-wrap m-0">
        <button
            className="bg-white text-huuk-card border border-[#ddd] px-3 py-1.5 rounded text-[13px] font-bold font-quicksand cursor-pointer mr-2 min-w-[100px] max-w-[100px] h-[34px] transition-all duration-200 box-border text-center inline-block hover:bg-[#f5f5f5] hover:border-[#999]"
          onClick={() => handleReschedule(appointment.id)}
        >
          Reschedule
        </button>
        <button
            className="bg-[#d32f2f] text-white border border-[#d32f2f] px-3 py-1.5 rounded text-[13px] font-bold font-quicksand cursor-pointer min-w-[100px] max-w-[100px] h-[34px] transition-all duration-200 box-border text-center inline-block hover:bg-[#b71c1c] hover:border-[#b71c1c]"
          onClick={() => handleOpenCancelDialog(appointment.id)}
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

  // 1. Compute unique dates and unique outlets from appointments
  const uniqueDates = Array.from(
    new Set(
      appointments
        .map((a) => (a.date ? a.date.split("T")[0] : null))
        .filter(Boolean),
    ),
  ).sort();
  const uniqueOutlets = Array.from(
    new Set(
      appointments
        .map((a) => a.outlet || a.outlet_shortform || a.shortform || a.branch)
        .filter(Boolean),
    ),
  );

  return (
    <div className="bg-transparent text-white h-[calc(100vh-160px)] p-4 font-quicksand relative overflow-hidden flex flex-col gap-4 box-border">
      {/* Location Tabs */}
      {/* 2. Outlet filter bar: show all unique outlets as filter buttons */}
      {/* Use locations array for outlet filter bar, so all outlets are shown even if they have no bookings */}
      <div
        className="flex gap-1 flex-nowrap shrink-0 p-0 mb-0 rounded-huuk-sm box-border w-full overflow-hidden"
        style={{
          background: "#1a1a1a",
          color: "white",
          width: "100%",
          marginBottom: 8,
          borderRadius: 8,
          display: "flex",
          flexWrap: "nowrap",
          padding: "0 4px",
          gap: "4px",
          overflow: "hidden",
        }}
      >
        <button
          className="font-bold font-quicksand border-none whitespace-nowrap min-w-0 flex-1 py-2.5 rounded-[6px] cursor-pointer transition-all duration-200"
          style={{
            background: selectedLocation === "" ? "#ffa500" : "#232323",
            color: selectedLocation === "" ? "#1a1a1a" : "#fff",
            fontWeight: "bold",
            fontFamily: "Quicksand, sans-serif",
            border: "none",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
            padding: "10px 0",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onClick={() => setSelectedLocation("")}
        >
          ALL
        </button>
        {outlets.map((outlet) => (
          <button
            key={outlet.shortform || outlet.id || outlet.name}
            className="font-bold font-quicksand border-none whitespace-nowrap min-w-0 flex-1 py-2.5 rounded-[6px] cursor-pointer transition-all duration-200"
            style={{
              background:
                selectedLocation === (outlet.shortform || outlet.name)
                  ? "#ffa500"
                  : "#232323",
              color:
                selectedLocation === (outlet.shortform || outlet.name)
                  ? "#1a1a1a"
                  : "#fff",
              fontWeight: "bold",
              fontFamily: "Quicksand, sans-serif",
              border: "none",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
              padding: "10px 0",
              borderRadius: 6,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => setSelectedLocation(outlet.shortform || outlet.name)}
          >
            {outlet.shortform || outlet.name}
          </button>
        ))}
      </div>

      {/* Selected Location Header */}
      {/* In location-header, move the date filter to the right side, next to the appointment count badge */}
      <div
        className="flex justify-between items-center w-full"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Header text container: only as wide as needed */}
        <div
          className="inline-flex flex-col items-start min-w-0"
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "flex-start",
            minWidth: 0,
          }}
        >
          <h2 style={{ whiteSpace: "nowrap", margin: 0 }}>
            {selectedLocation
              ? `${outlets.find((outlet) => (outlet.shortform || outlet.name) === selectedLocation)?.name || selectedLocation} (${selectedLocation})`
              : "All Locations"}
          </h2>
          <div className="flex items-center gap-2">
            <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold border border-orange-500/30">
              {filteredAppointments.length} appointments
            </span>
          </div>
        </div>
        {/* Date filter at far right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#232323",
            borderRadius: 6,
            padding: "6px 12px",
            marginLeft: "auto",
          }}
        >
          <CalendarIcon />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: "transparent",
              color: "white",
              border: "none",
              outline: "none",
              fontFamily: "Quicksand, sans-serif",
              fontWeight: "bold",
              fontSize: 15,
              padding: "4px 0",
              minWidth: 120,
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 card-dark rounded-huuk-md">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p>Loading appointments and outlets...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-600/20 border border-red-500 text-red-300 px-4 py-3 rounded-huuk-sm">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Appointments Table */}
      {!loading && !error && (
        <div
          className="min-h-[340px] h-[340px] max-h-[340px] overflow-hidden box-border w-full mb-0 bg-[rgba(25,25,25,0.8)] rounded-huuk-sm border border-white/10 flex flex-col"
          style={{
            minHeight: "340px", // 4 rows * 80-85px per row + header
            height: "340px",
            maxHeight: "340px",
            overflow: "hidden",
            boxSizing: "border-box",
            width: "100%",
            marginBottom: 0,
            background: "rgba(25, 25, 25, 0.8)",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="grid bg-orange-500/10 px-4 py-3 font-semibold text-[11px] text-white uppercase tracking-wide border-b border-orange-500/30 shrink-0 w-full max-w-full box-border"
            style={{
              gridTemplateColumns: "0.8fr 0.8fr 1fr 1.2fr 1fr",
              overflow: "hidden",
            }}
          >
            <div className="flex items-center gap-1.5 text-ellipsis overflow-hidden whitespace-nowrap">
              <CalendarIcon />
              <span>DATE</span>
            </div>
            <div className="flex items-center gap-1.5 text-ellipsis overflow-hidden whitespace-nowrap">
              <ClockIcon />
              <span>TIME</span>
            </div>
            <div className="flex items-center gap-1.5 text-ellipsis overflow-hidden whitespace-nowrap">
              <UserIcon />
              <span>STAFF NAME</span>
            </div>
            <div className="flex items-center gap-1.5 text-ellipsis overflow-hidden whitespace-nowrap">
              <ScissorsIcon />
              <span>SERVICE</span>
            </div>
            <div className="flex items-center gap-1.5 text-ellipsis overflow-hidden whitespace-nowrap justify-center">
              <span>ACTIONS</span>
            </div>
          </div>
          <div
            className="flex-1 overflow-hidden bg-transparent"
            style={{ flex: 1, overflow: "hidden", background: "transparent" }}
          >
            {Array.from({ length: 4 }).map((_, i) => {
              // Changed from 5 to 4
              const appointment = paginatedAppointments[i];
              if (appointment) {
                return (
                  <div
                    key={appointment.id}
                    className="grid px-4 py-3 border-b border-white/5 items-center transition-all duration-200 hover:bg-white/5 w-full max-w-full box-border relative"
                    style={{
                      gridTemplateColumns: "0.8fr 0.8fr 1fr 1.2fr 1fr",
                      minHeight: 0,
                      height: "80px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="text-[13px] text-white font-medium flex items-center whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {appointment.date
                        ? formatDateForDisplay(appointment.date)
                        : "N/A"}
                    </div>
                    <div
                      className="text-[13px] text-white font-medium flex items-center whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {(() => {
                        if (
                          !appointment.start_time ||
                          !appointment.end_time ||
                          !appointment.date
                        )
                          return "N/A";
                        const dateOnly = appointment.date.split("T")[0];
                        const startDateTime = moment(
                          `${dateOnly}T${appointment.start_time}`,
                        );
                        const endDateTime = moment(
                          `${dateOnly}T${appointment.end_time}`,
                        );
                        if (!startDateTime.isValid() || !endDateTime.isValid())
                          return "Invalid Time";
                        const startTime = startDateTime.format("HH:mm");
                        const endTime = endDateTime.format("HH:mm");
                        return `${startTime} - ${endTime}`;
                      })()}
                    </div>
                    <div
                      className="text-[13px] text-white font-medium flex items-center whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {appointment.username ||
                      appointment.staff_username ||
                      appointment.user_name
                        ? appointment.username ||
                          appointment.staff_username ||
                          appointment.user_name
                        : appointment.staffName &&
                            appointment.staffName !== "-" &&
                            appointment.staffName.trim() !== ""
                          ? appointment.staffName
                          : "Unassigned"}
                    </div>
                    <div
                      className="text-[13px] text-white font-medium flex items-center whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {appointment.service}
                    </div>
                    <div className="text-[13px] text-white font-medium flex items-center justify-center text-center">
                      {getActionButtons(appointment)}
                    </div>
                  </div>
                );
              } else {
                // Render empty row for visual consistency
                return (
                  <div
                    key={`empty-row-${i}`}
                    className="grid px-4 py-3 border-b border-white/5 items-center w-full max-w-full box-border"
                    style={{
                      gridTemplateColumns: "0.8fr 0.8fr 1fr 1.2fr 1fr",
                      minHeight: 0,
                      height: "80px",
                      overflow: "hidden",
                      background: "transparent",
                    }}
                  >
                    <div className="text-[13px]" />
                    <div className="text-[13px]" />
                    <div className="text-[13px]" />
                    <div className="text-[13px]" />
                    <div className="text-[13px]" />
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      <div
        className="w-full flex justify-center items-center mt-[-15px]"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "-15px",
        }}
      >
        <button
          className="px-3 py-1 rounded-huuk-sm bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          style={{ marginRight: 12 }}
        >
          Prev
        </button>
        <span
          className="font-bold font-quicksand text-[15px]"
          style={{
            fontWeight: "bold",
            fontFamily: "Quicksand, sans-serif",
            fontSize: 15,
          }}
        >
          {currentPage}/{totalPages || 1}
        </span>
        <button
          className="px-3 py-1 rounded-huuk-sm bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
          style={{ marginLeft: 12 }}
        >
          Next
        </button>
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
        <DialogActions sx={{ borderTop: "1px solid #333", p: 2 }}>
          <Button
            onClick={() => setShowCancelConfirmation(false)}
            sx={{
              fontFamily: "Quicksand, sans-serif",
              textTransform: "none",
              fontWeight: "bold",
              minWidth: "120px",
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
              minWidth: "160px",
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
