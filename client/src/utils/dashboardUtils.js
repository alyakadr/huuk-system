import {
  fetchWithRetry,
  getUsersList,
  getPendingApprovals,
  getAllAttendance,
  getTotalCustomersAll,
  getTotalCustomersUpToYesterday,
  getAllAppointments,
  getTotalRevenueToday,
  getTotalRevenueYesterday,
  getTotalAppointmentsToday,
  getTotalAppointmentsYesterday,
} from "../api/client";
import moment from "moment";
import {
  OUTLET_SHORTCUTS_UPPER,
  OUTLET_NAMES_UPPER,
} from "../constants/outlets";

const outletShortcuts = OUTLET_SHORTCUTS_UPPER;
const outlets = OUTLET_NAMES_UPPER;

export const fetchCustomerData = async (
  setTotalCustomers,
  setTotalCustomersUpToYesterday,
  setFetchError,
  setIsLoading,
) => {
  try {
    setIsLoading(true);
    setFetchError(null);
    const [allCount, upToYesterdayCount] = await Promise.all([
      fetchWithRetry(getTotalCustomersAll),
      fetchWithRetry(getTotalCustomersUpToYesterday),
    ]);
    setTotalCustomers(allCount.data.count ?? 0);
    setTotalCustomersUpToYesterday(upToYesterdayCount.data.count ?? 0);
  } catch (error) {
    const errorMessage =
      error.response?.status === 404
        ? "Customer data endpoints not found. Check backend."
        : error.response?.status === 401
          ? "Authentication failed. Please log in as a manager."
          : error.response?.status === 500
            ? `Server error: ${error.response?.data?.message || error.message}`
            : `Failed to load customer data: ${error.message}`;
    setFetchError(errorMessage);
    setTotalCustomers(0);
    setTotalCustomersUpToYesterday(0);
  } finally {
    setIsLoading(false);
  }
};

export const fetchAttendanceData = async (
  setStaffStatus,
  setAttendanceError,
  navigate,
) => {
  try {
    console.log("🔍 Starting fetchAttendanceData...");
    const storedUser =
      localStorage.getItem("staff_loggedInUser") ||
      localStorage.getItem("loggedInUser");
    if (!storedUser) throw new Error("No user data in localStorage");
    const user = JSON.parse(storedUser);
    if (user.role !== "manager")
      throw new Error("Invalid user role: " + user.role);

    const date = moment().format("YYYY-MM-DD");
    console.log("🗓️ Fetching attendance for date:", date);

    const response = await fetchWithRetry(() => getAllAttendance(date));
    console.log("📊 Raw attendance response:", response.data);

    const attendanceData = Array.isArray(response.data.attendance)
      ? response.data.attendance
      : [];
    console.log("📋 Processed attendance data:", attendanceData);
    console.log("📊 Total attendance records:", attendanceData.length);

    const statusByOutlet = outlets.reduce((acc, outlet) => {
      const shortOutlet = outletShortcuts[outlet] || outlet;
      acc[shortOutlet] = { onDuty: 0, offDuty: 0, lastUpdated: null };
      return acc;
    }, {});
    console.log("🏢 Initial outlet status:", statusByOutlet);

    attendanceData.forEach((record) => {
      const outlet = record.outlet ? record.outlet.toUpperCase() : "Unknown";
      const outletName = outletShortcuts[outlet] || outlet;
      console.log("Processing attendance record:", {
        record,
        outlet,
        outletName,
        hasTimeIn: !!record.time_in,
        hasTimeOut: !!record.time_out,
      });

      if (!statusByOutlet[outletName]) {
        statusByOutlet[outletName] = {
          onDuty: 0,
          offDuty: 0,
          lastUpdated: null,
        };
      }

      if (record.time_in && !record.time_out) {
        statusByOutlet[outletName].onDuty += 1;
        console.log(
          `Incremented ON DUTY for ${outletName}: ${statusByOutlet[outletName].onDuty}`,
        );
      } else if (record.time_in && record.time_out) {
        statusByOutlet[outletName].offDuty += 1;
        console.log(
          `Incremented OFF DUTY for ${outletName}: ${statusByOutlet[outletName].offDuty}`,
        );
      }

      const updateTime = new Date(
        record.time_in || record.time_out || record.created_date,
      ).getTime();
      statusByOutlet[outletName].lastUpdated = Math.max(
        statusByOutlet[outletName].lastUpdated || 0,
        updateTime,
      );
    });

    const staffStatus = Object.entries(statusByOutlet)
      .map(([outlet, { onDuty, offDuty, lastUpdated }]) => ({
        outlet,
        onDuty,
        offDuty,
        lastUpdated,
      }))
      .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

    const paddedStatus = [
      ...staffStatus,
      ...Array(Math.max(0, 4 - staffStatus.length))
        .fill()
        .map((_, i) => ({
          outlet: `N/A ${i + 1}`,
          onDuty: 0,
          offDuty: 0,
          lastUpdated: null,
        })),
    ].slice(0, 4);

    console.log("✅ Final staff status to be set:", paddedStatus);
    setStaffStatus(paddedStatus);
    setAttendanceError(null);
    console.log("🎯 fetchAttendanceData completed successfully");
  } catch (error) {
    const errorMessage =
      error.response?.status === 401
        ? "Authentication failed. Please log in again."
        : error.response?.status === 400
          ? error.response?.data?.message || "Invalid request parameters."
          : error.response?.status === 404
            ? "Attendance endpoint not found."
            : error.response?.status === 500
              ? `Server error: ${error.response?.data?.message || error.message}`
              : `Failed to load attendance data: ${error.message}`;
    setAttendanceError(errorMessage);
    setStaffStatus([]);
    if (error.response?.status === 401) {
      localStorage.removeItem("loggedInUser");
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      navigate("/staff-login");
    }
  }
};

export const fetchDashboardData = async (
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
) => {
  try {
    setIsLoading(true);
    setFetchError(null);
    const token =
      localStorage.getItem("staff_token") || localStorage.getItem("token");
    if (!token) throw new Error("No token found");

    // Use Promise.allSettled for parallel execution with individual error handling
    const [
      pendingApprovalsResult,
      staffListResult,
      appointmentsResult,
      revenueTodayResult,
      revenueYesterdayResult,
      appointmentsTodayResult,
      appointmentsYesterdayResult,
    ] = await Promise.allSettled([
      fetchWithRetry(getPendingApprovals, 3, 1000, 30000), // Reduced retries and timeout
      fetchWithRetry(getUsersList, 3, 1000, 30000),
      fetchWithRetry(getAllAppointments, 3, 1000, 30000),
      fetchWithRetry(getTotalRevenueToday, 3, 1000, 30000),
      fetchWithRetry(getTotalRevenueYesterday, 3, 1000, 30000),
      fetchWithRetry(getTotalAppointmentsToday, 3, 1000, 30000),
      fetchWithRetry(getTotalAppointmentsYesterday, 3, 1000, 30000),
    ]);

    // Process results with fallback data
    const pendingApprovalsData =
      pendingApprovalsResult.status === "fulfilled" &&
      Array.isArray(pendingApprovalsResult.value.data)
        ? pendingApprovalsResult.value.data
        : [];
    const staffListData =
      staffListResult.status === "fulfilled" &&
      Array.isArray(staffListResult.value.data)
        ? staffListResult.value.data
        : [];
    const appointmentsData =
      appointmentsResult.status === "fulfilled" &&
      Array.isArray(appointmentsResult.value.data)
        ? appointmentsResult.value.data
        : [];
    const revenueToday =
      revenueTodayResult.status === "fulfilled"
        ? revenueTodayResult.value.data.total || 0
        : 0;
    const revenueYesterday =
      revenueYesterdayResult.status === "fulfilled"
        ? revenueYesterdayResult.value.data.total || 0
        : 0;
    const appointmentsToday =
      appointmentsTodayResult.status === "fulfilled"
        ? appointmentsTodayResult.value.data.count || 0
        : 0;
    const appointmentsYesterday =
      appointmentsYesterdayResult.status === "fulfilled"
        ? appointmentsYesterdayResult.value.data.count || 0
        : 0;

    // Log any failures for debugging
    if (pendingApprovalsResult.status === "rejected")
      console.warn(
        "Pending Approvals fetch failed:",
        pendingApprovalsResult.reason,
      );
    if (staffListResult.status === "rejected")
      console.warn("Staff List fetch failed:", staffListResult.reason);
    if (appointmentsResult.status === "rejected")
      console.warn("Appointments fetch failed:", appointmentsResult.reason);
    if (revenueTodayResult.status === "rejected")
      console.warn("Revenue Today fetch failed:", revenueTodayResult.reason);
    if (revenueYesterdayResult.status === "rejected")
      console.warn(
        "Revenue Yesterday fetch failed:",
        revenueYesterdayResult.reason,
      );
    if (appointmentsTodayResult.status === "rejected")
      console.warn(
        "Appointments Today fetch failed:",
        appointmentsTodayResult.reason,
      );
    if (appointmentsYesterdayResult.status === "rejected")
      console.warn(
        "Appointments Yesterday fetch failed:",
        appointmentsYesterdayResult.reason,
      );

    setPendingApprovals(pendingApprovalsData);
    setStaffList(staffListData);
    setAllAppointments(appointmentsData);
    setTotalRevenue(revenueToday);
    setTotalRevenueYesterday(revenueYesterday);
    setTotalAppointments(appointmentsToday);
    setTotalAppointmentsYesterday(appointmentsYesterday);
  } catch (error) {
    const errorMessage =
      error.response?.status === 401
        ? "Authentication failed. Please log in again."
        : error.response?.status === 500
          ? `Server error: ${error.response?.data?.message || error.message}`
          : `Failed to load dashboard data: ${error.message}`;
    setFetchError(errorMessage);
    if (error.response?.status === 401) {
      localStorage.removeItem("loggedInUser");
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      navigate("/staff-login");
    }
  } finally {
    setIsLoading(false);
  }
};
