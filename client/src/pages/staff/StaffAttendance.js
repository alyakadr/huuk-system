import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api"; // Correct import path
import moment from "moment";
import { jwtDecode } from "jwt-decode";
import { restrictToRoles } from "../../utils/authUtils";
import { fetchWithRetry } from "../../api/client";
import {
  addLeave,
  loadLeavesForUser,
  removeLeave,
  subscribeToLeaves,
  updateLeave,
} from "../../utils/leaveStore";

const getSessionToken = () => {
  try {
    const staffUser = JSON.parse(
      localStorage.getItem("staff_loggedInUser") || "{}",
    );
    return (
      staffUser.token ||
      localStorage.getItem("staff_token") ||
      localStorage.getItem("token") ||
      null
    );
  } catch {
    return (
      localStorage.getItem("staff_token") || localStorage.getItem("token") || null
    );
  }
};

const getSessionUserId = () => {
  try {
    const staffUser = JSON.parse(
      localStorage.getItem("staff_loggedInUser") || "{}",
    );
    if (staffUser && staffUser.id) return String(staffUser.id);
  } catch {
    /* ignore */
  }
  return (
    localStorage.getItem("staff_userId") ||
    localStorage.getItem("userId") ||
    null
  );
};

const LEAVE_CATEGORIES = [
  "Annual Leave",
  "Emergency Leave",
  "Medical Leave",
  "Absent with Permission",
  "Absent without Notice",
  "Half-day",
  "No remark",
];

const getSessionProfile = () => {
  try {
    return (
      JSON.parse(localStorage.getItem("staff_loggedInUser") || "{}") || {}
    );
  } catch {
    return {};
  }
};

const StaffAttendance = () => {
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [isTimeInConfirmed, setIsTimeInConfirmed] = useState(false);
  const [isTimeOutConfirmed, setIsTimeOutConfirmed] = useState(false);
  const [averageWorkingHours, setAverageWorkingHours] = useState(0);
  const [averageInTime, setAverageInTime] = useState("N/A");
  const [averageOutTime, setAverageOutTime] = useState("N/A");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isApproved, setIsApproved] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [remark, setRemark] = useState("");
  const [isViewMode, setIsViewMode] = useState(false);
  const [viewFilePath, setViewFilePath] = useState(null);
  const [viewRemark, setViewRemark] = useState("");
  const [uploadCount, setUploadCount] = useState({});
  const [leaveRequests, setLeaveRequests] = useState(() => {
    const profile = getSessionProfile();
    return loadLeavesForUser(getSessionUserId(), profile.username);
  });
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: LEAVE_CATEGORIES[0],
    startDate: "",
    endDate: "",
    reason: "",
    attachment: null,
  });
  const [leaveError, setLeaveError] = useState("");
  // When set, the leave modal is editing an existing pending leave
  // rather than creating a new one.
  const [editingLeaveId, setEditingLeaveId] = useState(null);

  const leaveInlineFileRef = useRef(null);
  const [leaveInlineUploadTargetId, setLeaveInlineUploadTargetId] =
    useState(null);

  const navigate = useNavigate();

  const validateAttendance = async (userId) => {
    console.log("Validating attendance for staff_id:", userId);
    const storedTimeInConfirmed = localStorage.getItem("isTimeInConfirmed");

    // Ensure we have a valid userId
    if (!userId) {
      console.error("Missing staff_id for attendance validation");
      return false;
    }

    try {
      // Get the most reliable staff token and userId
      const staffUser = JSON.parse(
        localStorage.getItem("staff_loggedInUser") || "{}",
      );
      const token =
        staffUser.token ||
        localStorage.getItem("staff_token") ||
        localStorage.getItem("token");
      const staffId = staffUser.id || userId;

      if (!token) {
        console.error("No authentication token available");
        return false;
      }

      // Set authorization header manually to ensure token is sent
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // Make direct API call with retry
      const response = await fetchWithRetry(() =>
        api.get("/users/attendance", {
          params: {
            date: moment().format("YYYY-MM-DD"),
            staff_id: staffId,
            page: 1,
          },
          headers,
        }),
      );

      // Log the full response for debugging
      console.log("Attendance API response:", response);

      const data = response.data.attendance || [];
      console.log("Attendance validation data:", data);

      // If no records found but we should have some, create a new day record
      if (data.length === 0) {
        console.log("No attendance records found for staff_id:", userId);
        try {
          console.log("Attempting to create a new day record");
          await api.post(
            "/users/attendance/new-day",
            { staff_id: userId },
            { headers },
          );
          console.log("New day record created successfully");

          // Fetch the newly created record
          const newResponse = await api.get("/users/attendance", {
            params: {
              date: moment().format("YYYY-MM-DD"),
              staff_id: userId,
              page: 1,
            },
            headers,
          });

          // Update data with new record
          const newData = newResponse.data.attendance || [];
          console.log("New attendance data after record creation:", newData);

          if (newData.length > 0) {
            data.push(...newData);
          }
        } catch (createError) {
          console.error("Failed to create new day record:", createError);
        }
      }

      const todayRecord = data.find(
        (record) =>
          String(record.staff_id) === String(userId) &&
          moment(record.created_date || record.created_at).format(
            "YYYY-MM-DD",
          ) === moment().format("YYYY-MM-DD") &&
          record.time_in,
      );

      if (todayRecord) {
        console.log("Found today record:", todayRecord);
        setIsTimeInConfirmed(true);
        const formattedTimeIn = moment(todayRecord.time_in).format("HH:mm");
        setTimeIn(formattedTimeIn);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem("timeIn", formattedTimeIn);
        return true;
      } else if (storedTimeInConfirmed === "true") {
        console.log("Keeping isTimeInConfirmed true from localStorage");
        setIsTimeInConfirmed(true);
        setTimeIn(localStorage.getItem("timeIn") || moment().format("HH:mm"));
        return true;
      } else {
        console.log("No today record found with time_in");
        setIsTimeInConfirmed(false);
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
        setTimeIn(moment().format("HH:mm"));
        return false;
      }
    } catch (error) {
      console.error("Attendance validation error:", error.response || error);

      // Check if error is due to 404 (no records found)
      if (error.response && error.response.status === 404) {
        console.log(
          "No attendance records found (404), attempting to create new day record",
        );
        try {
          const token =
            localStorage.getItem("staff_token") ||
            localStorage.getItem("token");
          await api.post(
            "/users/attendance/new-day",
            { staff_id: userId },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          console.log("New day record created after 404");
          setTimeout(() => refreshAttendance(), 500);
        } catch (createError) {
          console.error(
            "Failed to create new day record after 404:",
            createError,
          );
        }
      }

      if (storedTimeInConfirmed === "true") {
        console.log("Keeping isTimeInConfirmed true despite error");
        setIsTimeInConfirmed(true);
        setTimeIn(localStorage.getItem("timeIn") || moment().format("HH:mm"));
        return true;
      }
      // Don't surface validation errors as a page-blocking error — let
      // refreshAttendance handle fetch errors with a clearer message.
      return false;
    }
  };

  useEffect(() => {
    console.log("Mounting StaffAttendance");
    const storedTimeInConfirmed = localStorage.getItem("isTimeInConfirmed");
    const storedTimeIn = localStorage.getItem("timeIn");
    console.log("Initial localStorage:", {
      storedTimeInConfirmed,
      storedTimeIn,
    });

    const storedUserId = getSessionUserId();
    if (storedUserId) {
      setIsLoading(true);
      if (storedTimeInConfirmed === "true" && storedTimeIn) {
        setIsTimeInConfirmed(true);
        setTimeIn(storedTimeIn);
      } else {
        setTimeIn(moment().format("HH:mm"));
      }
      validateAttendance(storedUserId).finally(() => setIsLoading(false));
    } else {
      setError("Session expired. Please log in again.");
      navigate("/staff-login");
    }
  }, [navigate]);

  useEffect(() => {
    if (!restrictToRoles(["staff", "manager"], navigate)) {
      setError("Access denied. Only staff or managers can access this page.");
      return;
    }

    const token = getSessionToken();
    const storedUserId = getSessionUserId();
    if (!token || !storedUserId) {
      setError("Session expired. Please log in again.");
      navigate("/staff-login");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (String(storedUserId) !== String(decoded.userId)) {
        setError("Session mismatch. Please log in again.");
        navigate("/staff-login");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      fetchWithRetry(() => api.get("/users/profile", { headers }))
        .then((response) => {
          const { role, status } = response.data;
          setUserRole(role);
          setIsApproved(status === "approved");
          if (!["staff", "manager"].includes(role) || status !== "approved") {
            setError(
              "Access denied. Only approved staff or managers can access this page.",
            );
            navigate("/staff-login");
            return;
          }
          refreshAttendance();
        })
        .catch((error) => {
          console.error(
            "Profile fetch error:",
            error.response?.data || error.message,
          );
          setError("Failed to load user profile. Please try again or log in.");
          navigate("/staff-login");
        });
    } catch (err) {
      console.error("JWT decode error:", err.message);
      setError("Invalid session. Please log in again.");
      navigate("/staff-login");
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = moment().format("HH:mm");
      console.log("Clock tick:", {
        isTimeInConfirmed,
        timeIn,
        isTimeOutConfirmed,
        timeOut,
      });
      if (!isTimeInConfirmed) {
        setTimeIn(now);
      }
      if (isTimeInConfirmed && !isTimeOutConfirmed) {
        setTimeOut(now);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimeInConfirmed, isTimeOutConfirmed]);

  useEffect(() => {
    const checkNewDay = setInterval(() => {
      const now = moment();
      if (now.hour() === 0 && now.minute() === 0) {
        console.log("Midnight reset triggered");
        setIsTimeInConfirmed(false);
        setIsTimeOutConfirmed(false);
        setTimeIn("");
        setTimeOut("");
        localStorage.removeItem("isTimeInConfirmed");
        localStorage.removeItem("timeIn");
        refreshAttendance();
      }
    }, 60000);
    return () => clearInterval(checkNewDay);
  }, []);

  // Auto-generate new day attendance record
  useEffect(() => {
    const checkOrCreateTodayRecord = async () => {
      const token = getSessionToken();
      const userId = getSessionUserId();
      if (!token || !userId || !userRole || !isApproved) return;

      const today = moment().format("YYYY-MM-DD");
      const existingRecord = attendanceData.find(
        (record) =>
          record.staff_id === userId &&
          moment(record.created_date).format("YYYY-MM-DD") === today,
      );

      if (!existingRecord && attendanceData.length > 0) {
        try {
          console.log("Generating new day record for:", today);
          await api.post(
            "/users/attendance/new-day",
            {
              staff_id: userId,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          console.log("New day record generated for today.");
          setTimeout(() => refreshAttendance(), 500);
        } catch (error) {
          console.error("Error generating new day record:", error);
          // Don't show error to user as this is background operation
        }
      }
    };

    if (attendanceData.length > 0) {
      checkOrCreateTodayRecord();
    }
  }, [attendanceData, userRole, isApproved]);

  const refreshAttendance = async () => {
    const storedUserId = getSessionUserId();
    if (!storedUserId) {
      setError("User not authenticated.");
      return;
    }

    console.log("Refreshing attendance for staff_id:", storedUserId);
    setIsLoading(true);
    try {
      const response = await api.get("/users/attendance", {
        params: {
          staff_id: storedUserId,
          page: 1,
        },
      });

      setError(null);
      const data = response.data.attendance || [];
      console.log("Attendance refresh data:", data);
      setAttendanceData(
        data.sort(
          (a, b) => new Date(b.created_date) - new Date(a.created_date),
        ),
      );

      const today = moment().format("YYYY-MM-DD");
      const todayRecord = data.find(
        (record) =>
          record.staff_id === storedUserId &&
          moment(record.created_date).format("YYYY-MM-DD") === today &&
          record.time_in,
      );

      console.log("Today record:", todayRecord);
      const storedTimeInConfirmed = localStorage.getItem("isTimeInConfirmed");
      if (todayRecord) {
        setIsTimeInConfirmed(true);
        const formattedTimeIn = moment(todayRecord.time_in).format("HH:mm");
        setTimeIn(formattedTimeIn);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem("timeIn", formattedTimeIn);
        console.log("Time In confirmed from backend:", {
          isTimeInConfirmed: true,
          timeIn: formattedTimeIn,
        });
        if (todayRecord.time_out) {
          setIsTimeOutConfirmed(true);
          setTimeOut(moment(todayRecord.time_out).format("HH:mm"));
        } else {
          setIsTimeOutConfirmed(false);
          setTimeOut(moment().format("HH:mm"));
        }
      } else if (storedTimeInConfirmed === "true") {
        console.log("Keeping isTimeInConfirmed true from localStorage");
        setIsTimeInConfirmed(true);
        setTimeIn(localStorage.getItem("timeIn") || moment().format("HH:mm"));
      } else {
        setIsTimeInConfirmed(false);
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
        setTimeIn(moment().format("HH:mm"));
        console.log("No Time In record for today, isTimeInConfirmed:", false);
      }

      const validRecords = data.filter(
        (record) =>
          record.time_in &&
          record.time_out &&
          moment(record.created_date).isAfter(moment().subtract(30, "days")),
      );
      const totalHours = validRecords.reduce(
        (acc, record) =>
          acc +
          moment(record.time_out).diff(moment(record.time_in), "hours", true),
        0,
      );
      setAverageWorkingHours(
        validRecords.length ? totalHours / validRecords.length : 0,
      );

      const validInTimes = data.filter(
        (record) =>
          record.time_in &&
          moment(record.created_date).isAfter(moment().subtract(30, "days")),
      );
      if (validInTimes.length > 0) {
        const totalInMinutes = validInTimes.reduce((acc, record) => {
          const timeInMoment = moment(record.time_in);
          return acc + (timeInMoment.hour() * 60 + timeInMoment.minute());
        }, 0);
        const averageInMinutes = totalInMinutes / validInTimes.length;
        const averageInHour = Math.floor(averageInMinutes / 60);
        const averageInMinute = Math.round(averageInMinutes % 60);
        setAverageInTime(
          `${averageInHour.toString().padStart(2, "0")}:${averageInMinute
            .toString()
            .padStart(2, "0")}`,
        );
      } else {
        setAverageInTime("N/A");
      }

      const validOutTimes = data.filter(
        (record) =>
          record.time_out &&
          moment(record.created_date).isAfter(moment().subtract(30, "days")),
      );
      if (validOutTimes.length > 0) {
        const totalOutMinutes = validOutTimes.reduce((acc, record) => {
          const timeOutMoment = moment(record.time_out);
          return acc + (timeOutMoment.hour() * 60 + timeOutMoment.minute());
        }, 0);
        const averageOutMinutes = totalOutMinutes / validOutTimes.length;
        const averageOutHour = Math.floor(averageOutMinutes / 60);
        const averageOutMinute = Math.round(averageOutMinutes % 60);
        setAverageOutTime(
          `${averageOutHour.toString().padStart(2, "0")}:${averageOutMinute
            .toString()
            .padStart(2, "0")}`,
        );
      } else {
        setAverageOutTime("N/A");
      }
    } catch (err) {
      console.error(
        "Fetch attendance error:",
        err.response?.data || err.message,
        err,
      );
      const status = err?.response?.status;
      const backendMsg = err?.response?.data?.message || err?.message;
      if (status === 404) {
        setAttendanceData([]);
        setError(null);
      } else if (status === 401) {
        setError("Session expired. Please log in again.");
      } else {
        setError(backendMsg || "Failed to load attendance data.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const confirmTimeIn = async () => {
    const userId = getSessionUserId();
    const token = getSessionToken();
    if (!userId || !token) {
      setError("Session expired. Please log in again.");
      return;
    }

    if (!["staff", "manager"].includes(userRole) || !isApproved) {
      setError(
        "Access denied. Only approved staff or managers can log attendance.",
      );
      return;
    }

    if (isTimeInConfirmed) {
      setError("Time In already logged today.");
      return;
    }

    console.log("Checking for existing Time In for staff_id:", userId);
    setIsLoading(true);

    try {
      const response = await fetchWithRetry(() =>
        api.get("/users/attendance", {
          params: {
            staff_id: userId,
            page: 1,
          },
        }),
      );

      setAttendanceData(
        response.data.attendance.sort(
          (a, b) => new Date(b.created_date) - new Date(a.created_date),
        ),
      );

      const data = response.data.attendance || [];
      console.log("Pre-check attendance data:", data);
      const todayRecord = data.find(
        (record) =>
          record.staff_id === userId &&
          moment(record.created_date).format("YYYY-MM-DD") ===
            moment().format("YYYY-MM-DD") &&
          record.time_in,
      );

      if (todayRecord) {
        console.error("Existing Time In found:", todayRecord);
        setIsTimeInConfirmed(true);
        const formattedTimeIn = moment(todayRecord.time_in).format("HH:mm");
        setTimeIn(formattedTimeIn);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem("timeIn", formattedTimeIn);
        setError("Time In already logged today.");
        return;
      }

      console.log("Confirming Time In for staff_id:", userId);
      const currentTime = moment().format("HH:mm");
      setTimeIn(currentTime);
      setIsTimeInConfirmed(true);
      localStorage.setItem("isTimeInConfirmed", "true");
      localStorage.setItem("timeIn", currentTime);
      console.log("Pre-API Time In state:", {
        isTimeInConfirmed: true,
        timeIn: currentTime,
      });

      const postData = {
        staff_id: String(userId),
        time_in: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      console.log("POST data:", postData);

      const postResponse = await fetchWithRetry(() =>
        api.post("/users/attendance", postData),
      );
      console.log("Time In API response:", postResponse.data);
      const formattedTimeIn = moment(postResponse.data.time_in).format("HH:mm");
      setTimeIn(formattedTimeIn);
      localStorage.setItem("timeIn", formattedTimeIn);
      setError(null);
      alert("Time In logged successfully.");
      setTimeout(refreshAttendance, 1000);
    } catch (error) {
      console.error("Time In error:", error.response?.data || error.message);
      if (
        error.response?.status === 400 &&
        error.response?.data?.message === "Time In already logged for today"
      ) {
        console.log("Time In already logged, setting isTimeInConfirmed true");
        setIsTimeInConfirmed(true);
        const currentTime = moment().format("HH:mm");
        setTimeIn(currentTime);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem("timeIn", currentTime);
        setError("Time In already logged today.");
      } else {
        setIsTimeInConfirmed(false);
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
        setTimeIn(moment().format("HH:mm"));
        setError(
          error.response?.status === 401
            ? "Session expired. Please log in again."
            : error.response?.data?.message || "Failed to log Time In.",
        );
      }
    } finally {
      setIsLoading(false);
      console.log(
        "confirmTimeIn finished, isTimeInConfirmed:",
        isTimeInConfirmed,
      );
    }
  };

  const confirmTimeOut = async () => {
    const userId = getSessionUserId();
    const token = getSessionToken();
    if (!userId || !token) {
      setError("Session expired. Please log in again.");
      return;
    }

    if (!["staff", "manager"].includes(userRole) || !isApproved) {
      setError(
        "Access denied. Only approved staff or managers can log attendance.",
      );
      return;
    }

    if (!isTimeInConfirmed) {
      setError("Please confirm Time In first.");
      return;
    }

    if (isTimeOutConfirmed) {
      setError("Time Out already logged today.");
      return;
    }

    console.log("Confirming Time Out for staff_id:", userId);
    setIsLoading(true);
    try {
      const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
      const data = {
        staff_id: String(userId),
        time_out: currentTime,
      };

      const response = await fetchWithRetry(() =>
        api.post("/users/attendance", data),
      );
      console.log("Time Out response:", response.data);
      setIsTimeOutConfirmed(true);
      setTimeOut(moment(response.data.time_out).format("HH:mm"));
      setError(null);
      console.log("Time Out confirmed, state:", {
        isTimeOutConfirmed: true,
        timeOut,
      });
      alert("Time Out logged successfully.");
      setTimeout(refreshAttendance, 1000);
    } catch (error) {
      console.error("Time Out error:", error.response?.data || error.message);
      setError(
        error.response?.status === 401
          ? "Session expired. Please log in again."
          : error.response?.data?.message || "Failed to log Time Out.",
      );
    } finally {
      setIsLoading(false);
      console.log("confirmTimeOut finished");
    }
  };

  useEffect(() => {
    const refresh = () => {
      const profile = getSessionProfile();
      const userId = getSessionUserId();
      setLeaveRequests(loadLeavesForUser(userId, profile.username));
    };
    refresh();
    const unsubscribe = subscribeToLeaves(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const openLeaveModal = (existingLeave = null) => {
    const today = moment().format("YYYY-MM-DD");
    const isRealLeave =
      existingLeave &&
      typeof existingLeave === "object" &&
      typeof existingLeave.id === "string" &&
      existingLeave.id.startsWith("leave_");

    if (isRealLeave) {
      setLeaveForm({
        type: existingLeave.type || LEAVE_CATEGORIES[0],
        startDate: existingLeave.startDate || today,
        endDate: existingLeave.endDate || existingLeave.startDate || today,
        reason: existingLeave.reason || "",
        attachment: existingLeave.attachment || null,
      });
      setEditingLeaveId(existingLeave.id);
    } else {
      setLeaveForm({
        type: LEAVE_CATEGORIES[0],
        startDate: today,
        endDate: today,
        reason: "",
        attachment: null,
      });
      setEditingLeaveId(null);
    }
    setLeaveError("");
    setIsLeaveModalOpen(true);
  };

  const closeLeaveModal = () => {
    setIsLeaveModalOpen(false);
    setLeaveError("");
    setEditingLeaveId(null);
  };

  const cancelLeaveRequest = (leaveId) => {
    if (!leaveId) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      "Cancel this leave application? This cannot be undone.",
    );
    if (!ok) return;
    removeLeave(leaveId);
    const profile = getSessionProfile();
    setLeaveRequests(
      loadLeavesForUser(getSessionUserId(), profile.username),
    );
  };

  const updateLeaveForm = (field, value) =>
    setLeaveForm((prev) => ({ ...prev, [field]: value }));

  const handleLeaveAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      setLeaveError(
        "Invalid file type. Please attach a PNG, JPG, JPEG, or PDF.",
      );
      event.target.value = "";
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setLeaveError("Attachment too large. Maximum size is 2MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLeaveError("");
      updateLeaveForm("attachment", {
        name: file.name,
        type: file.type === "application/pdf" ? "pdf" : "image",
        mime: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => {
      setLeaveError("Failed to read attachment. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const clearLeaveAttachment = () => updateLeaveForm("attachment", null);

  const triggerLeaveInlineUpload = (leaveId) => {
    if (!leaveId) return;
    setLeaveInlineUploadTargetId(leaveId);
    requestAnimationFrame(() => leaveInlineFileRef.current?.click());
  };

  const onLeaveInlineFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const targetId = leaveInlineUploadTargetId;
    setLeaveInlineUploadTargetId(null);
    if (!file || !targetId) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please use PNG, JPG, JPEG, or PDF.");
      return;
    }
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("Attachment too large. Maximum size is 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      updateLeave(targetId, {
        attachment: {
          name: file.name,
          type: file.type === "application/pdf" ? "pdf" : "image",
          mime: file.type,
          size: file.size,
          dataUrl: reader.result,
        },
        updatedAt: new Date().toISOString(),
      });
      const profile = getSessionProfile();
      setLeaveRequests(
        loadLeavesForUser(getSessionUserId(), profile.username),
      );
    };
    reader.onerror = () =>
      setError("Failed to read attachment. Please try again.");
    reader.readAsDataURL(file);
  };

  const submitLeaveRequest = () => {
    const { type, startDate, endDate, reason, attachment } = leaveForm;
    if (!type || !startDate || !endDate || !reason.trim()) {
      setLeaveError("Please fill in all fields before submitting.");
      return;
    }
    if (moment(endDate).isBefore(moment(startDate))) {
      setLeaveError("End date cannot be earlier than the start date.");
      return;
    }
    if (moment(startDate).isBefore(moment().startOf("day"), "day")) {
      setLeaveError("Start date cannot be in the past.");
      return;
    }

    const profile = getSessionProfile();
    const userId = getSessionUserId();
    const staffUsername =
      profile.username || profile.user_name || profile.userName || "";
    const staffName =
      profile.fullname ||
      profile.full_name ||
      profile.name ||
      staffUsername ||
      "Staff";
    const outlet = profile.outlet || profile.outlet_name || "";

    if (editingLeaveId) {
      // Editing an existing pending leave — patch it in place and
      // reset approval to "pending" so the manager re-reviews.
      updateLeave(editingLeaveId, {
        type,
        startDate,
        endDate,
        reason: reason.trim(),
        attachment: attachment || null,
        status: "pending",
        updatedAt: new Date().toISOString(),
      });
      // eslint-disable-next-line no-console
      console.log("[leave] updated", editingLeaveId);
      setLeaveRequests(loadLeavesForUser(userId, staffUsername));
      setIsLeaveModalOpen(false);
      setEditingLeaveId(null);
      return;
    }

    const newLeave = {
      id: `leave_${Date.now()}`,
      userId,
      staffName,
      staffUsername,
      outlet,
      type,
      startDate,
      endDate,
      reason: reason.trim(),
      attachment: attachment || null,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    // Log so it's easy to confirm the write reached localStorage when
    // triaging "nothing happens on submit" complaints.
    // eslint-disable-next-line no-console
    console.log("[leave] submitting", newLeave);
    addLeave(newLeave);
    setLeaveRequests(loadLeavesForUser(userId, staffUsername));
    setIsLeaveModalOpen(false);

    // Half-day leave for today → auto clock-out if the staff is already timed in.
    const today = moment().format("YYYY-MM-DD");
    if (
      type === "Half-day" &&
      startDate === today &&
      isTimeInConfirmed &&
      !isTimeOutConfirmed
    ) {
      setTimeout(() => {
        confirmTimeOut();
      }, 150);
    }
  };

  const leaveStatusStyle = (status) => {
    switch (status) {
      case "approved":
        return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30";
      case "rejected":
        return "bg-red-500/15 text-red-300 border border-red-400/30";
      default:
        return "bg-amber-400/15 text-amber-300 border border-amber-400/30";
    }
  };

  // Attendance rows + leave-only rows. If a leave covers a date that already
  // has a clock-in row (e.g. half-day), merge into that row instead of a second
  // line. Leave days with no attendance stay as compact synthetic rows (one
  // row for the full range, or one row per contiguous gap when only some days
  // have attendance).
  const displayRows = useMemo(() => {
    const toCalendarDayKey = (value) => {
      if (value == null || value === "") return null;
      let m = moment(value, "YYYY-MM-DD", true);
      if (!m.isValid()) m = moment(value, "YYYY-MM-DD HH:mm:ss", true);
      if (!m.isValid()) m = moment(value);
      if (!m.isValid()) return null;
      return m.format("YYYY-MM-DD");
    };

    const parseLeaveBounds = (leave) => {
      if (!leave.startDate) return null;
      let start = moment(leave.startDate, "YYYY-MM-DD", true);
      if (!start.isValid()) start = moment(leave.startDate);
      const endRaw = leave.endDate || leave.startDate;
      let end = moment(endRaw, "YYYY-MM-DD", true);
      if (!end.isValid()) end = moment(endRaw);
      if (!start.isValid() || !end.isValid()) return null;
      return { start, end };
    };

    const byDateKey = new Map();
    attendanceData.forEach((row) => {
      const key = toCalendarDayKey(row.created_date);
      if (!key) return;
      byDateKey.set(key, {
        ...row,
        _mergedLeaves: [],
        _sortKey: key,
      });
    });

    const dayKeysInRange = (startM, endM) => {
      const keys = [];
      const c = startM.clone();
      while (c.isSameOrBefore(endM, "day")) {
        keys.push(c.format("YYYY-MM-DD"));
        c.add(1, "day");
      }
      return keys;
    };

    const contiguousBlocksFromKeys = (keys) => {
      const sorted = [...keys].sort();
      if (!sorted.length) return [];
      const blocks = [];
      let startIdx = 0;
      for (let i = 1; i <= sorted.length; i++) {
        if (
          i === sorted.length ||
          moment(sorted[i]).diff(moment(sorted[i - 1]), "days") !== 1
        ) {
          blocks.push([sorted[startIdx], sorted[i - 1]]);
          startIdx = i;
        }
      }
      return blocks;
    };

    const extraSynthetic = [];

    leaveRequests.forEach((leave) => {
      const bounds = parseLeaveBounds(leave);
      if (!bounds) return;
      const { start, end } = bounds;

      const rangeKeys = dayKeysInRange(start, end);
      const overlapKeys = rangeKeys.filter((k) => byDateKey.has(k));
      const missingKeys = rangeKeys.filter((k) => !byDateKey.has(k));

      overlapKeys.forEach((key) => {
        const entry = byDateKey.get(key);
        if (!entry._mergedLeaves.some((l) => l.id === leave.id)) {
          entry._mergedLeaves.push(leave);
        }
      });

      if (missingKeys.length === 0) return;

      if (overlapKeys.length === 0) {
        extraSynthetic.push({
          id: `leave-${leave.id}`,
          created_date: leave.startDate,
          time_in: null,
          time_out: null,
          document_path: null,
          remarks: null,
          _syntheticLeave: true,
          _leave: leave,
          _displayStart: leave.startDate,
          _displayEnd: leave.endDate || leave.startDate,
          _sortKey: leave.startDate,
        });
        return;
      }

      const blocks = contiguousBlocksFromKeys(missingKeys);
      blocks.forEach(([blockStart, blockEnd], bi) => {
        extraSynthetic.push({
          id: `leave-${leave.id}-gap-${bi}`,
          created_date: blockStart,
          time_in: null,
          time_out: null,
          document_path: null,
          remarks: null,
          _syntheticLeave: true,
          _leave: leave,
          _displayStart: blockStart,
          _displayEnd: blockEnd,
          _sortKey: blockStart,
        });
      });
    });

    const rows = [...byDateKey.values(), ...extraSynthetic];
    return rows.sort((a, b) =>
      (b._sortKey || "").localeCompare(a._sortKey || ""),
    );
  }, [attendanceData, leaveRequests]);

  const openUploadModal = (attendanceId) => {
    setSelectedAttendanceId(attendanceId);
    setIsModalOpen(true);
    setIsViewMode(false);
    setSelectedFile(null);
    setRemark("");
  };

  const openViewModal = (attendanceId, filePath, remark) => {
    setSelectedAttendanceId(attendanceId);
    setViewFilePath(filePath);
    setViewRemark(remark);
    setIsViewMode(true);
    setIsModalOpen(true);
    setSelectedFile(null);
    setRemark("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAttendanceId(null);
    setIsViewMode(false);
    setViewFilePath(null);
    setViewRemark("");
    setSelectedFile(null);
    setRemark("");
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (
      file &&
      ["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(
        file.type,
      )
    ) {
      setSelectedFile(file);
    } else {
      setError("Invalid file type. Please select PNG, JPG, JPEG, or PDF.");
      setSelectedFile(null);
    }
  };

  const handleRemarkChange = (event) => {
    const value = event.target.value;
    if (value.length <= 55) {
      setRemark(value);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !remark) {
      setError("Please select a file and enter a remark.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("attendance_id", selectedAttendanceId);
    formData.append("reason", remark);

    try {
      const response = await fetchWithRetry(() =>
        api.post("/users/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        }),
      );
      console.log("File Upload successful:", response.data);
      alert("Document uploaded successfully.");
      setAttendanceData((prev) =>
        prev.map((record) =>
          record.id === selectedAttendanceId
            ? {
                ...record,
                document_path: response.data.filePath,
                remarks: `Absent with notice (${remark})`,
              }
            : record,
        ),
      );
      setUploadCount((prev) => ({
        ...prev,
        [selectedAttendanceId]: (prev[selectedAttendanceId] || 0) + 1,
      }));
      closeModal();
    } catch (error) {
      console.error(
        "File upload error:",
        error.response?.data || error.message,
      );
      setError(error.response?.data?.message || "Failed to upload document.");
    } finally {
      setIsLoading(false);
    }
  };

  const isUploadEnabled = (attendanceDate, timeIn, timeOut) => {
    const isOnDuty = timeIn && timeOut;
    const nextDay = moment(attendanceDate).add(1, "days").startOf("day");
    const isAfterNextDay = moment().isAfter(nextDay);
    const uploadEnabled = !isOnDuty && isAfterNextDay;
    console.log("isUploadEnabled:", {
      attendanceDate,
      timeIn,
      timeOut,
      isOnDuty,
      isAfterNextDay,
      uploadEnabled,
    });
    return uploadEnabled;
  };

  const isViewButtonEnabled = (attendanceId) => {
    return (uploadCount[attendanceId] || 0) < 2;
  };

  const getTotalHours = (data) => {
    if (data.time_in && data.time_out) {
      const hours = moment(data.time_out).diff(
        moment(data.time_in),
        "hours",
        true,
      );
      return hours.toFixed(1) === "0.0" ? "0" : hours.toFixed(1);
    }
    return 0;
  };

  if (isLoading) return <div>Loading...</div>;

  const isAuthBlockingError =
    !!error &&
    (error.includes("Session expired") ||
      error.includes("Session mismatch") ||
      error.includes("Invalid session") ||
      error.includes("Access denied"));

  if (isAuthBlockingError && (!userRole || !isApproved)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card-dark rounded-huuk-lg max-w-xl w-full">
          <h1 className="text-xl font-bold mb-2">Staff Attendance</h1>
          <p className="text-red-400 mb-3">{error}</p>
          <a href="/staff-login" className="btn-ghost">
            Log in again
          </a>
        </div>
      </div>
    );
  }

  const timeInPillBorder = isTimeInConfirmed
    ? "border-white/25"
    : "border-white";
  const timeOutPillBorder =
    isTimeInConfirmed && !isTimeOutConfirmed
      ? "border-white"
      : "border-white/25";

  const timeInBtnClass = isTimeInConfirmed
    ? "bg-white/10 text-white/50 cursor-not-allowed"
    : "bg-huuk-blue text-white hover:opacity-90";
  const timeOutBtnDisabled = !isTimeInConfirmed || isTimeOutConfirmed;
  const timeOutBtnClass = timeOutBtnDisabled
    ? "bg-white/10 text-white/50 cursor-not-allowed"
    : "bg-huuk-blue text-white hover:opacity-90";

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-5 bg-huuk-bg px-1 pb-2 pt-5 text-white font-quicksand md:pt-6">
      {error && (
        <div className="flex items-center gap-2.5 rounded-huuk-sm bg-red-600 p-3 text-sm text-white">
          <i className="fas fa-exclamation-triangle" />
          {error}
          {error.includes("Session expired") && (
            <a href="/staff-login" className="underline text-white">
              {" "}
              Log in again
            </a>
          )}
        </div>
      )}

      {/* Time In/Out Section */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center gap-4 rounded-huuk-md bg-huuk-card px-5 py-3">
          <span className="min-w-[72px] text-sm font-bold uppercase tracking-wide text-white">
            TIME-IN
          </span>
          <div
            className={`flex h-10 flex-1 items-center justify-center rounded-full border ${timeInPillBorder} bg-transparent px-5 text-sm font-semibold text-white/90`}
          >
            {timeIn || "--:--"}
          </div>
          <button
            onClick={confirmTimeIn}
            disabled={isTimeInConfirmed || isLoading}
            className={`h-10 min-w-[96px] rounded-huuk-sm text-sm font-bold transition-opacity ${timeInBtnClass}`}
          >
            {isTimeInConfirmed ? "Confirmed" : "Confirm"}
          </button>
        </div>

        <div className="flex items-center gap-4 rounded-huuk-md bg-huuk-card px-5 py-3">
          <span className="min-w-[72px] text-sm font-bold uppercase tracking-wide text-white">
            TIME-OUT
          </span>
          <div
            className={`flex h-10 flex-1 items-center justify-center rounded-full border ${timeOutPillBorder} bg-transparent px-5 text-sm font-semibold text-white/90`}
          >
            {timeOut || "--:--"}
          </div>
          <button
            type="button"
            onClick={confirmTimeOut}
            disabled={timeOutBtnDisabled || isLoading}
            className={`h-10 min-w-[96px] rounded-huuk-sm text-sm font-bold transition-opacity ${timeOutBtnClass}`}
          >
            {isTimeOutConfirmed ? "Confirmed" : "Confirm"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: "fa-clock",
            value:
              averageWorkingHours > 0
                ? `${Math.floor(averageWorkingHours)
                    .toString()
                    .padStart(2, "0")}:${Math.round(
                    (averageWorkingHours % 1) * 60,
                  )
                    .toString()
                    .padStart(2, "0")}`
                : "--:--",
            label: "Average Working Hour",
          },
          {
            icon: "fa-sign-in-alt",
            value: averageInTime,
            label: "Average In Time",
          },
          {
            icon: "fa-sign-out-alt",
            value: averageOutTime,
            label: "Average Out Time",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="flex flex-col items-center justify-center gap-1.5 rounded-huuk-md bg-huuk-card px-4 py-4"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-huuk-blue text-white text-sm">
              <i className={`fas ${card.icon}`} />
            </div>
            <div className="text-xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-white/60">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Controls row: Apply Leave + Date Range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => openLeaveModal()}
          className="inline-flex items-center gap-2 rounded-huuk-sm bg-huuk-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <i className="fas fa-plus text-xs" />
          Apply Leave
        </button>
        <div className="relative">
          <select className="appearance-none rounded-huuk-sm bg-huuk-card px-4 pr-9 py-2 text-sm text-white outline-none border border-white/10">
            <option value="29/6/2025 - 5/7/2025">29/6/2025 - 5/7/2025</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60">
            <i className="fas fa-chevron-down text-xs" />
          </span>
        </div>
      </div>

      {/* Records Table */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-huuk-md bg-huuk-card">
        {isLoading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-white">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-huuk-blue"></div>
            <p>Loading attendance records...</p>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-white/60">
            <i className="fas fa-calendar-times text-2xl" />
            <p>No attendance records found.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <input
              ref={leaveInlineFileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={onLeaveInlineFileChange}
            />
            <table className="w-full border-collapse font-quicksand bg-transparent">
              <thead>
                <tr>
                  {[
                    "DATE",
                    "TIME-IN",
                    "TIME-OUT",
                    "TOTAL HOUR",
                    "STATUS",
                    "REMARK",
                    "UPLOAD",
                    "ACTION",
                  ].map((label) => (
                    <th
                      key={label}
                      className="sticky top-0 z-10 bg-huuk-card px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-white/70"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((data, index) => {
                  // Synthetic leave row → rendered as a single compact row
                  // that spans the applied-for date range (no per-day rows).
                  if (data._syntheticLeave && data._leave) {
                    const leave = data._leave;
                    const rangeStart =
                      data._displayStart ?? leave.startDate ?? null;
                    const rangeEnd =
                      data._displayEnd ??
                      leave.endDate ??
                      leave.startDate ??
                      rangeStart;
                    const startLabel = rangeStart
                      ? moment(rangeStart).format("DD MMMM YYYY")
                      : "--";
                    const endLabel = rangeEnd
                      ? moment(rangeEnd).format("DD MMMM YYYY")
                      : startLabel;
                    const isRange =
                      rangeEnd &&
                      rangeStart &&
                      rangeEnd !== rangeStart;

                    return (
                      <tr
                        key={data.id || index}
                        className="border-t border-white/5 bg-white/[0.015] transition-colors hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-4 text-sm font-semibold text-white">
                          {isRange ? (
                            <div className="flex flex-col leading-tight">
                              <span>{startLabel}</span>
                              <span className="text-[11px] font-medium text-white/60">
                                → {endLabel}
                              </span>
                            </div>
                          ) : (
                            startLabel
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-white/50">
                          --:--
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-white/50">
                          --:--
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-white/50">
                          --:--
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-xs font-semibold text-white/80">
                              {leave.type}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveStatusStyle(
                                leave.status,
                              )}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {leave.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-white">
                          {leave.reason ? (
                            <span
                              className="block text-xs leading-snug text-white/80"
                              title={leave.reason}
                            >
                              {leave.reason}
                            </span>
                          ) : (
                            <span className="text-xs italic text-white/50">
                              No remark
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {leave.attachment?.dataUrl ? (
                            <a
                              href={leave.attachment.dataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={leave.attachment.name}
                              className="inline-flex max-w-[180px] items-center gap-1.5 rounded-huuk-sm bg-[#1f1f23] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2a30]"
                            >
                              <i
                                className={`fas ${
                                  leave.attachment.type === "pdf"
                                    ? "fa-file-pdf"
                                    : "fa-file-image"
                                } text-[11px]`}
                              />
                              <span className="truncate">
                                {leave.attachment.name}
                              </span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => triggerLeaveInlineUpload(leave.id)}
                              className="inline-flex items-center gap-1.5 rounded-huuk-sm bg-[#1f1f23] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2a30]"
                            >
                              <i className="fas fa-upload text-[11px]" />
                              Upload
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {leave.status === "pending" ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openLeaveModal(leave)}
                                title="Edit this leave application"
                                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/15 hover:text-white"
                              >
                                <i className="fas fa-pen text-[9px]" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelLeaveRequest(leave.id)}
                                title="Cancel this leave application"
                                className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/25 hover:text-red-200"
                              >
                                <i className="fas fa-times text-[9px]" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/45">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  // Regular attendance row (may include merged leave on same day)
                  const mergedLeaves = data._mergedLeaves || [];
                  const hasMergedLeave = mergedLeaves.length > 0;

                  const uploadEnabled = isUploadEnabled(
                    data.created_date,
                    data.time_in,
                    data.time_out,
                  );
                  const viewEnabled = isViewButtonEnabled(data.id);
                  const isOnDuty = data.time_in && data.time_out;

                  return (
                    <tr
                      key={data.id || index}
                      className="border-t border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-white">
                        {data.created_date
                          ? moment(data.created_date).format("DD MMMM YYYY")
                          : "--"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-white">
                        {data.time_in
                          ? moment(data.time_in).format("HH:mm")
                          : "--:--"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-white">
                        {data.time_out
                          ? moment(data.time_out).format("HH:mm")
                          : "--:--"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-white">
                        {getTotalHours(data)
                          ? `${getTotalHours(data)}`
                          : "--:--"}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {hasMergedLeave ? (
                          <div className="flex flex-col items-start gap-2">
                            {mergedLeaves.map((leaveItem) => (
                              <div
                                key={leaveItem.id}
                                className="flex flex-col items-start gap-1"
                              >
                                <span className="text-xs font-semibold text-white/80">
                                  {leaveItem.type}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveStatusStyle(
                                    leaveItem.status,
                                  )}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {leaveItem.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-white/60">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {data.document_path ? (
                          <span className="font-semibold">
                            {data.remarks || "--"}
                          </span>
                        ) : hasMergedLeave &&
                          mergedLeaves.some((l) => l.reason) ? (
                          <div className="flex flex-col gap-1">
                            {mergedLeaves.map((l) =>
                              l.reason ? (
                                <span
                                  key={l.id}
                                  className="block text-xs leading-snug text-white/80"
                                  title={l.reason}
                                >
                                  {l.reason}
                                </span>
                              ) : null,
                            )}
                          </div>
                        ) : isOnDuty ? (
                          <span className="text-white/70">-</span>
                        ) : (
                          <span className="block text-xs italic leading-snug text-white/60">
                            Upload relevant supporting documents
                            <br />
                            (valid for 3 working days)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <div className="flex flex-col gap-2">
                          {data.document_path ? (
                            <button
                              className={`inline-flex w-fit items-center gap-1.5 rounded-huuk-sm px-4 py-1.5 text-xs font-semibold ${
                                !viewEnabled || isLoading
                                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                                  : "bg-[#1f1f23] text-white hover:bg-[#2a2a30]"
                              }`}
                              disabled={!viewEnabled || isLoading}
                              onClick={() =>
                                openViewModal(
                                  data.id,
                                  data.document_path,
                                  data.remarks,
                                )
                              }
                            >
                              <i className="fas fa-eye" /> View
                            </button>
                          ) : null}
                          {hasMergedLeave ? (
                            <div className="flex flex-col gap-2">
                              {mergedLeaves.map((l) =>
                                l.attachment?.dataUrl ? (
                                  <a
                                    key={l.id}
                                    href={l.attachment.dataUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={l.attachment.name}
                                    className="inline-flex max-w-[180px] items-center gap-1.5 rounded-huuk-sm bg-[#1f1f23] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2a30]"
                                  >
                                    <i
                                      className={`fas ${
                                        l.attachment.type === "pdf"
                                          ? "fa-file-pdf"
                                          : "fa-file-image"
                                      } text-[11px]`}
                                    />
                                    <span className="truncate">
                                      {l.attachment.name}
                                    </span>
                                  </a>
                                ) : (
                                  <button
                                    key={l.id}
                                    type="button"
                                    onClick={() =>
                                      triggerLeaveInlineUpload(l.id)
                                    }
                                    className="inline-flex w-fit items-center gap-1.5 rounded-huuk-sm bg-[#1f1f23] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2a30]"
                                  >
                                    <i className="fas fa-upload text-[11px]" />
                                    Upload
                                  </button>
                                ),
                              )}
                            </div>
                          ) : !data.document_path ? (
                            <button
                              className={`inline-flex items-center gap-1.5 rounded-huuk-sm px-4 py-1.5 text-xs font-semibold ${
                                !uploadEnabled || isLoading
                                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                                  : "bg-[#1f1f23] text-white hover:bg-[#2a2a30]"
                              }`}
                              disabled={!uploadEnabled || isLoading}
                              onClick={() => openUploadModal(data.id)}
                            >
                              <i className="fas fa-download" /> Add file
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {hasMergedLeave ? (
                          <div className="flex flex-col gap-2">
                            {mergedLeaves.map((leaveItem) => (
                              <div key={leaveItem.id}>
                                {leaveItem.status === "pending" ? (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openLeaveModal(leaveItem)
                                      }
                                      title="Edit this leave application"
                                      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/15 hover:text-white"
                                    >
                                      <i className="fas fa-pen text-[9px]" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        cancelLeaveRequest(leaveItem.id)
                                      }
                                      title="Cancel this leave application"
                                      className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/25 hover:text-red-200"
                                    >
                                      <i className="fas fa-times text-[9px]" />
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/45">
                                    —
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-white/60">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="w-[92%] max-w-xl rounded-huuk-md bg-white p-5 text-huuk-card shadow-xl">
            <h2 className="mb-4 text-lg font-bold">
              {editingLeaveId ? "Edit Leave Application" : "Apply for Leave"}
            </h2>
            {leaveError && (
              <div className="mb-3 rounded-huuk-sm bg-red-100 px-3 py-2 text-sm text-red-700">
                {leaveError}
              </div>
            )}
            <label className="mb-1 block text-sm font-semibold">
              Leave Type
            </label>
            <select
              value={leaveForm.type}
              onChange={(e) => updateLeaveForm("type", e.target.value)}
              className="mb-3 w-full rounded-huuk-sm border border-gray-300 px-3 py-2 text-sm"
            >
              {LEAVE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                  Start Date
                </label>
                <input
                  type="date"
                  value={leaveForm.startDate}
                  onChange={(e) =>
                    updateLeaveForm("startDate", e.target.value)
                  }
                  min={moment().format("YYYY-MM-DD")}
                  className="w-full rounded-huuk-sm border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">
                  End Date
                </label>
                <input
                  type="date"
                  value={leaveForm.endDate}
                  onChange={(e) => updateLeaveForm("endDate", e.target.value)}
                  min={leaveForm.startDate || moment().format("YYYY-MM-DD")}
                  className="w-full rounded-huuk-sm border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <label className="mb-1 block text-sm font-semibold">Reason</label>
            <textarea
              rows={3}
              value={leaveForm.reason}
              onChange={(e) => updateLeaveForm("reason", e.target.value)}
              maxLength={280}
              placeholder="Briefly describe the reason for your leave..."
              className="mb-3 w-full resize-none rounded-huuk-sm border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-sm font-semibold">
              Attachment{" "}
              <span className="font-normal text-gray-500">
                (optional — PNG, JPG, PDF, max 2MB)
              </span>
            </label>
            {leaveForm.attachment ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-huuk-sm border border-gray-300 bg-gray-50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <i
                    className={`fas ${
                      leaveForm.attachment.type === "pdf"
                        ? "fa-file-pdf text-red-500"
                        : "fa-file-image text-blue-500"
                    } text-base`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-huuk-card">
                      {leaveForm.attachment.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {(leaveForm.attachment.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearLeaveAttachment}
                  className="shrink-0 rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-huuk-card hover:bg-gray-300"
                  title="Remove attachment"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            ) : (
              <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-huuk-sm border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-600 hover:bg-gray-100">
                <i className="fas fa-paperclip" />
                <span>Choose file to attach</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleLeaveAttachmentChange}
                  className="hidden"
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeLeaveModal}
                className="rounded-huuk-sm bg-gray-200 px-4 py-2 text-sm font-semibold text-huuk-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitLeaveRequest}
                className="btn-primary"
              >
                {editingLeaveId ? "Save Changes" : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-huuk-md p-5 w-[92%] max-w-xl shadow-xl text-huuk-card">
            <h2 className="text-lg font-bold mb-4">
              {isViewMode ? "View Document" : "Upload Document"}
            </h2>
            {isViewMode ? (
              <>
                <div className="w-full h-[300px] bg-gray-100 rounded-huuk-sm overflow-hidden mb-3">
                  {viewFilePath && viewFilePath.endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:5000${viewFilePath}`}
                      title="File Preview"
                      className="w-full h-full"
                    ></iframe>
                  ) : (
                    <img
                      src={`http://localhost:5000${viewFilePath}`}
                      alt="File Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={viewRemark || "--"}
                  disabled
                  className="w-full border border-gray-300 rounded-huuk-sm px-3 py-2 mb-2"
                />
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFileChange}
                  className="w-full border border-gray-300 rounded-huuk-sm px-3 py-2 mb-2"
                />
                <input
                  type="text"
                  placeholder="Enter remark"
                  value={remark}
                  onChange={handleRemarkChange}
                  maxLength={55}
                  className="w-full border border-gray-300 rounded-huuk-sm px-3 py-2 mb-3"
                />
                <button
                  type="submit"
                  disabled={!selectedFile || !remark || isLoading}
                  onClick={handleFileUpload}
                  className="btn-primary mr-2"
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-huuk-sm bg-gray-200 text-huuk-card font-semibold"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFileChange}
                  className="w-full border border-gray-300 rounded-huuk-sm px-3 py-2 mb-2"
                />
                <input
                  type="text"
                  placeholder="Enter remark"
                  value={remark}
                  onChange={handleRemarkChange}
                  maxLength={55}
                  className="w-full border border-gray-300 rounded-huuk-sm px-3 py-2 mb-3"
                />
                <button
                  type="submit"
                  disabled={!selectedFile || !remark || isLoading}
                  onClick={handleFileUpload}
                  className="btn-primary mr-2"
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-huuk-sm bg-gray-200 text-huuk-card font-semibold"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendance;
