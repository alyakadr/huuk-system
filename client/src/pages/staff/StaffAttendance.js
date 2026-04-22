import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api"; // Correct import path
import moment from "moment";
import { jwtDecode } from "jwt-decode";
import { restrictToRoles } from "../../utils/authUtils";
import { fetchWithRetry } from "../../api/client";

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
      setError("Failed to validate attendance. Please try again.");
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
      const response = await fetchWithRetry(() =>
        api.get("/users/attendance", {
          params: {
            staff_id: storedUserId,
            page: 1,
          },
        }),
      );

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
    } catch (error) {
      console.error(
        "Fetch attendance error:",
        error.response?.data || error.message,
      );
      setError(
        error.response?.status === 400
          ? error.response.data.message || "Invalid staff ID."
          : error.response?.status === 401
            ? "Session expired. Please log in again."
            : error.response?.status === 404
              ? null
              : error.response?.data?.message ||
                "Failed to load attendance data.",
      );
      if (error.response?.status === 404) {
        setAttendanceData([]);
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

  if (error && (!userRole || !isApproved)) {
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
    <div className="flex h-full min-h-0 w-full flex-col gap-5 bg-huuk-bg px-1 pb-2 text-white font-quicksand">
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

      {/* Date Range Selector */}
      <div className="flex justify-end">
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
        ) : attendanceData.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-white/60">
            <i className="fas fa-calendar-times text-2xl" />
            <p>No attendance records found.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse font-quicksand bg-transparent">
              <thead>
                <tr>
                  {[
                    "DATE",
                    "TIME-IN",
                    "TIME-OUT",
                    "TOTAL HOUR",
                    "REMARK",
                    "UPLOAD",
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
                {attendanceData.map((data, index) => {
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
                      <td className="px-5 py-4 text-sm text-white">
                        {data.document_path ? (
                          <span className="font-semibold">
                            {data.remarks || "--"}
                          </span>
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
                        {data.document_path ? (
                          <button
                            className={`inline-flex items-center gap-1.5 rounded-huuk-sm px-4 py-1.5 text-xs font-semibold ${
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
                        ) : (
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
