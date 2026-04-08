import React, { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import BarberSalesReport from "../../components/staff/BarberSalesReport";
import { useNavigate } from "react-router-dom";
import summ1 from "../../assets/summ1.png";
import summ2 from "../../assets/summ2.png";
import summ3 from "../../assets/summ3.png";
import summ4 from "../../assets/summ4.png";
import remindreminder from "../../assets/remindreminder.png";
import donereminder from "../../assets/donereminder.png";
import "bootstrap-icons/font/bootstrap-icons.css";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import api from "../../utils/api";
import moment from "moment";
import AddBookingModal from "../../components/AddBookingModal";
import { TIME_SLOTS } from "../../utils/timeSlotUtils";
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

import ChartDataLabels from "chartjs-plugin-datalabels";
import { io } from "socket.io-client";
import {
  API_BASE_URL,
  OPERATIONAL_HOURS,
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../../utils/constants";

ChartJS.defaults.font.family = "Quicksand, sans-serif";
ChartJS.register(
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ChartDataLabels,
);

const PaymentManagementTable = ({
  loadingPayment,
  paymentData,
  isMobileView,
}) => {
  return (
    <div className="card-dark mt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Payment Management</h3>
        <button
          className="btn-ghost text-sm"
          onClick={() =>
            alert(
              "This feature is currently under maintenance. Please check back later.",
            )
          }
        >
          View all
        </button>
      </div>
      {isMobileView ? (
        <div className="mt-3 space-y-2">
          {loadingPayment ? (
            <div className="huuk-td text-center">Loading payment data...</div>
          ) : paymentData.length === 0 ? (
            <div className="huuk-td text-center">No payment data available</div>
          ) : (
            paymentData.slice(0, 3).map((payment, index) => (
              <div
                key={payment.id || index}
                className="rounded-huuk-sm border border-white/10 bg-white/5 p-3"
              >
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-huuk-muted">Customer</span>
                  <span>{payment.customer_name}</span>
                  <span className="text-huuk-muted">Method</span>
                  <span>{payment.payment_method}</span>
                  <span className="text-huuk-muted">Status</span>
                  <span
                    className={
                      payment.payment_status === "Paid"
                        ? "font-semibold text-green-400"
                        : "font-semibold text-yellow-300"
                    }
                  >
                    {payment.payment_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="huuk-table min-w-[560px]">
            <thead>
              <tr>
                <th className="huuk-th">CUSTOMER NAME</th>
                <th className="huuk-th">PAYMENT METHOD</th>
                <th className="huuk-th">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loadingPayment ? (
                <tr>
                  <td colSpan="3" className="huuk-td text-center">
                    Loading payment data...
                  </td>
                </tr>
              ) : paymentData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="huuk-td text-center">
                    No payment data available
                  </td>
                </tr>
              ) : (
                paymentData.slice(0, 3).map((payment, index) => (
                  <tr
                    key={payment.id || index}
                    className="huuk-tr border-b border-white/10"
                  >
                    <td className="huuk-td">{payment.customer_name}</td>
                    <td className="huuk-td">{payment.payment_method}</td>
                    <td
                      className={`huuk-td font-semibold ${payment.payment_status === "Paid" ? "text-green-400" : "text-yellow-300"}`}
                    >
                      {payment.payment_status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isTimeInConfirmed, setIsTimeInConfirmed] = useState(false);
  const [summaryData, setSummaryData] = useState({
    done: 0,
    pending: 0,
    cancelled: 0,
    rescheduled: 0,
    absent: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [barChartData, setBarChartData] = useState({ labels: [], data: [] });
  const [loadingBarChart, setLoadingBarChart] = useState(true);
  const [paymentData, setPaymentData] = useState([]);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [paymentConfirmationData, setPaymentConfirmationData] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchAllData = async () => {
    setLoadingSummary(true);
    setLoadingSchedule(true);
    setLoadingBarChart(true);
    try {
      const token = localStorage.getItem("staff_token");
      const headers = { Authorization: `Bearer ${token}` };

      let outletParam = null;
      if (user && user.outlet) {
        outletParam = user.outlet;
      } else if (user && user.outlet_id) {
        outletParam = user.outlet_id;
      }

      // Fetch all three in parallel
      const [summaryResponse, scheduleResponse, barChartResponse] =
        await Promise.all([
          api.get("/bookings/summary", { headers }),
          api.get("/bookings/staff/schedule", { headers }),
          api.get("/bookings/todays-appointments-by-staff", {
            headers,
            params: outletParam ? { outlet: outletParam } : {},
          }),
        ]);

      setSummaryData(
        summaryResponse.data || {
          done: 0,
          pending: 0,
          cancelled: 0,
          rescheduled: 0,
          absent: 0,
        },
      );

      const sortedSchedule = (scheduleResponse.data || []).sort((a, b) => {
        if (a.start_time === "-" && b.start_time === "-") return 0;
        if (a.start_time === "-") return 1;
        if (b.start_time === "-") return -1;
        return a.start_time.localeCompare(b.start_time);
      });
      setScheduleData(sortedSchedule);

      setBarChartData(barChartResponse.data || { labels: [], data: [] });
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      // Set default values on error
      setSummaryData({
        done: 0,
        pending: 0,
        cancelled: 0,
        rescheduled: 0,
        absent: 0,
      });
      setScheduleData([]);
      setBarChartData({ labels: [], data: [] });
    } finally {
      setLoadingSummary(false);
      setLoadingSchedule(false);
      setLoadingBarChart(false);
    }
  };

  const fetchPaymentData = async () => {
    setLoadingPayment(true);
    try {
      const response = await api.get("/payments/payment-management", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}`,
        },
        params: {
          limit: 10,
          sort_by: "created_at",
          sort_order: "desc",
          include_all_types: true,
          include_pay_at_outlet: true,
          include_online_payment: true,
        },
      });

      const processedPayments = Array.isArray(response.data)
        ? response.data.map((payment) => ({
            ...payment,
            payment_method:
              payment.payment_method === PAYMENT_METHODS.PAY_AT_OUTLET
                ? "Pay at Outlet"
                : payment.payment_method === PAYMENT_METHODS.ONLINE
                  ? "Online Payment"
                  : payment.payment_method || "Unknown",
            payment_status:
              payment.payment_status === PAYMENT_STATUSES.PAID
                ? "Paid"
                : payment.payment_status === PAYMENT_STATUSES.PENDING
                  ? "Pending"
                  : payment.payment_status || "Unknown",
          }))
        : [];

      setPaymentData(processedPayments);
    } catch (error) {
      console.error("Error fetching payment data:", error);
      setPaymentData([]);
    } finally {
      setLoadingPayment(false);
    }
  };

  const checkAttendance = async (userId) => {
    try {
      const response = await api.get("/users/attendance", {
        params: {
          date: moment().format("YYYY-MM-DD"),
          staff_id: userId,
          page: 1,
        },
      });
      const data = response.data.attendance || [];
      const todayRecord = data.find(
        (record) =>
          record.staff_id === userId &&
          moment(record.created_date).format("YYYY-MM-DD") ===
            moment().format("YYYY-MM-DD") &&
          record.time_in,
      );
      if (todayRecord) {
        setIsTimeInConfirmed(true);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem(
          "timeIn",
          moment(todayRecord.time_in).format("HH:mm"),
        );
      } else {
        setIsTimeInConfirmed(false);
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
      }
    } catch (error) {
      console.error("StaffDashboard check attendance error:", error);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("staff_loggedInUser");
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      if (
        !userObj ||
        (userObj.role !== "staff" && userObj.role !== "manager")
      ) {
        navigate("/");
      } else {
        setUser(userObj);
        const storedTimeInConfirmed = localStorage.getItem("isTimeInConfirmed");
        setIsTimeInConfirmed(storedTimeInConfirmed === "true");
        checkAttendance(userObj.id);
        fetchAllData();
        fetchPaymentData();
      }
    } else {
      navigate("/");
    }

    // Cleanup function
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Simple polling for data updates
  useEffect(() => {
    const socket = io(API_BASE_URL);
    socket.on("bookingUpdated", () => {
      fetchAllData();
      fetchPaymentData();
      fetchBlockedSlots();
    });
    socket.on("booking_updated", () => {
      fetchAllData();
      fetchPaymentData();
      fetchBlockedSlots();
    });
    socket.on("slotUpdate", () => {
      fetchAllData();
      fetchPaymentData();
      fetchBlockedSlots();
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPaymentConfirmation = async (bookingId) => {
    try {
      const token =
        localStorage.getItem("staff_token") || localStorage.getItem("token");

      if (!token) {
        alert("Authentication required. Please log in again.");
        return;
      }

      const response = await api.get(`/bookings/booking-details/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200) {
        const bookingData = response.data;
        const shouldShowPaymentConfirmation =
          (bookingData.paymentMethod === "Pay at Outlet" ||
            bookingData.paymentMethod === PAYMENT_METHODS.PAY_AT_OUTLET ||
            bookingData.isWalkIn === true ||
            bookingData.paymentStatus === "Pending") &&
          bookingData.paymentStatus !== "Paid";

        if (shouldShowPaymentConfirmation) {
          const confirmationData = {
            bookingId: bookingId,
            paymentMethod: bookingData.paymentMethod || "Pay at Outlet",
            customerName: bookingData.customerName || "Customer",
            serviceName: bookingData.serviceName || "Service",
            totalAmount: bookingData.totalAmount || "0.00",
            paymentStatus: bookingData.paymentStatus || "Pending",
            isWalkIn: bookingData.isWalkIn || false,
          };
          setPaymentConfirmationData(confirmationData);
          setShowPaymentConfirmation(true);
        } else {
          await markBookingAsDone(bookingId);
        }
      }
    } catch (error) {
      console.error("Error checking payment confirmation:", error);
      await markBookingAsDone(bookingId);
    }
  };

  // Separate function to actually mark booking as done
  const markBookingAsDone = async (bookingId) => {
    try {
      const response = await api.post(
        "/bookings/staff/mark-done",
        { booking_id: bookingId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("staff_token")}`,
          },
        },
      );

      if (response.status === 200) {
        await Promise.all([
          fetchAllData(),
          fetchPaymentData(),
          fetchBlockedSlots(),
        ]);
      }
    } catch (error) {
      console.error("❌ Error marking booking as done:", error);
      alert("Failed to mark booking as done. Please try again.");
      await Promise.all([fetchAllData(), fetchBlockedSlots()]);
    }
  };

  // Update payment handlers to accept payment object
  const handlePaymentPaid = async (payment) => {
    try {
      // Mark as paid
      const response = await api.post(
        "/payments/update-payment-status",
        {
          booking_id: payment.bookingId,
          payment_status: "Paid",
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}`,
          },
        },
      );
      if (response.status === 200) {
        // Close the payment confirmation popup
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);

        // Mark the booking as done after payment is confirmed
        await markBookingAsDone(payment.bookingId);

        alert("Payment marked as Paid successfully!");
      }
    } catch (error) {
      let msg = "Failed to update payment status. Please try again.";
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        msg = error.response.data.message;
      }
      alert(msg);
      fetchPaymentData();
    }
  };

  const handlePaymentUnpaid = async (payment) => {
    try {
      // Mark as unpaid
      const response = await api.post(
        "/payments/update-payment-status",
        {
          booking_id: payment.bookingId,
          payment_status: "Pending",
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}`,
          },
        },
      );
      if (response.status === 200) {
        // Close the payment confirmation popup
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);

        // Mark the booking as done after payment status is updated
        await markBookingAsDone(payment.bookingId);

        alert(
          "Booking marked as completed. Payment status kept as Pending. Please collect payment when customer is ready.",
        );
      }
    } catch (error) {
      let msg = "Failed to update payment status. Please try again.";
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        msg = error.response.data.message;
      }
      alert(msg);
      fetchPaymentData();
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Services",
          color: "white",
          font: { family: "Quicksand, sans-serif", size: 11, weight: "normal" },
        },
        ticks: {
          color: "white",
          stepSize: 1,
          maxTicksLimit: 10,
          font: { family: "Quicksand, sans-serif", size: 10 },
        },
        grid: {
          display: false,
        },
      },
      x: {
        title: {
          display: true,
          text: "Staff Members",
          color: "white",
          font: { family: "Quicksand, sans-serif", size: 11, weight: "normal" },
        },
        ticks: {
          color: "white",
          font: { family: "Quicksand, sans-serif", size: 10 },
          maxRotation: 0,
          minRotation: 0,
        },
        grid: {
          display: false,
        },
        barPercentage: 0.6,
        categoryPercentage: 0.8,
        maxBarThickness: 35,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(26, 26, 26, 0.95)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "#6661ae",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { family: "Quicksand, sans-serif", size: 12, weight: "600" },
        bodyFont: { family: "Quicksand, sans-serif", size: 11 },
        padding: 12,
        callbacks: {
          title: function (context) {
            return context[0].label;
          },
          label: function (context) {
            const value = context.parsed.y;
            return `${value} appointment${value !== 1 ? "s" : ""} today`;
          },
        },
      },
      datalabels: {
        anchor: "center",
        align: "center",
        color: "white",
        backgroundColor: "transparent",
        borderRadius: 0,
        font: { size: 12, family: "Quicksand, sans-serif", weight: "600" },
        formatter: (value) => (value > 0 ? value : ""),
        padding: 0,
        display: function (context) {
          return context && context.parsed && context.parsed.y > 0;
        },
      },
    },
    elements: {
      bar: {
        borderRadius: {
          topLeft: 6,
          topRight: 6,
          bottomLeft: 0,
          bottomRight: 0,
        },
        borderSkipped: false,
      },
    },
    animation: {
      duration: 1000,
      easing: "easeInOutQuart",
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor =
        elements.length > 0 ? "pointer" : "default";
    },
  };

  // Fetch blocked slots from API
  const fetchBlockedSlots = async () => {
    if (!user?.id) return;
    try {
      const response = await api.get(`/staff/blocked-slots`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("staff_token")}`,
        },
        params: {
          staff_id: user.id,
          date: moment().format("YYYY-MM-DD"),
        },
      });

      const rawBlockedSlots = response.data.blocked_slots || [];
      const processedBlockedSlots = rawBlockedSlots.map((slot) =>
        typeof slot === "object" ? slot.time : slot,
      );
      setBlockedSlots(processedBlockedSlots);
    } catch (error) {
      console.error("❌ Error fetching blocked slots:", error);
      setBlockedSlots([]);
    }
  };

  // Fetch blocked slots when user changes
  useEffect(() => {
    if (user?.id) {
      fetchBlockedSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Toggle slot blocking via API
  const toggleSlotBlocking = async (time) => {
    if (!user?.id) return;

    const isCurrentlyBlocked = blockedSlots.includes(time);

    // Prevent unblocking of already blocked slots
    if (isCurrentlyBlocked) {
      alert("This time slot is already blocked and cannot be unblocked.");
      return;
    }

    const action = "block";

    try {
      // Optimistically update UI first
      setBlockedSlots((prev) => [...prev, time]);

      const response = await api.post(
        `/staff/toggle-slot-blocking`,
        {
          staff_id: user.id,
          date: moment().format("YYYY-MM-DD"),
          time: time,
          action: action,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("staff_token")}`,
          },
        },
      );

      // Confirm the block was successful
      if (response.status === 200) {
        alert(`Time slot ${time} blocked successfully.`);
        // Refresh blocked slots from server to ensure accurate state
        await fetchBlockedSlots();
      }
    } catch (error) {
      console.error(`❌ Error ${action}ing slot:`, error);

      // Revert optimistic update on error
      setBlockedSlots((prev) => prev.filter((t) => t !== time));

      // Handle specific error cases
      if (error.response?.data?.message) {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes("already blocked") && action === "block") {
          alert("This time slot is already blocked.");
          // Ensure the slot shows as blocked
          setBlockedSlots((prev) =>
            prev.includes(time) ? prev : [...prev, time],
          );
        } else {
          alert(`Failed to ${action} time slot: ${errorMessage}`);
        }
      } else {
        alert(`Failed to ${action} time slot. Please try again.`);
      }
    }
  };

  // Handle slot click for adding booking
  // Handle booking submission
  const handleBookingSubmit = async (formData) => {
    try {
      // Close modal
      setShowAddBookingModal(false);
      setSelectedSlotForBooking(null);

      // Refresh data
      await fetchAllData();
      await fetchBlockedSlots(); // Refresh blocked slots to ensure UI sync
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Failed to submit booking. Please try again.");
    }
  };

  // Generate time slots for the day (30-minute intervals, 7 slots in sliding window)
  const generateTimeSlots = () => {
    const slots = [];
    const now = moment();

    // Round current time to current or next 30-minute interval
    const currentMinutes = now.minutes();
    let startTime;

    if (currentMinutes <= 30) {
      // If we're at or before 30 minutes, start from current hour:30
      startTime = moment().minutes(30).seconds(0);
    } else {
      // If we're after 30 minutes, start from next hour:00
      startTime = moment().add(1, "hour").minutes(0).seconds(0);
    }

    // Generate exactly 7 slots starting from the calculated start time
    const slotTime = startTime.clone();
    for (let i = 0; i < 7; i++) {
      slots.push(slotTime.format("HH:mm"));
      slotTime.add(30, "minutes");
    }

    return slots;
  };

  // Helper function to check if a time slot is within operational hours
  const isWithinOperationalHours = (time) => {
    const operationalStart = moment()
      .hour(OPERATIONAL_HOURS.start.h)
      .minute(OPERATIONAL_HOURS.start.m)
      .second(0);
    const operationalEnd = moment()
      .hour(OPERATIONAL_HOURS.end.h)
      .minute(OPERATIONAL_HOURS.end.m)
      .second(59);
    const slotTime = moment(time, "HH:mm");
    return slotTime.isBetween(operationalStart, operationalEnd, null, "[)");
  };

  const availableSlots = generateTimeSlots();

  // Bar chart data from backend with enhanced styling
  const todaysAppointmentBarData = {
    labels: barChartData.labels,
    datasets: [
      {
        label: "Today's Appointments",
        data: barChartData.data,
        backgroundColor: "#6e9fc0",
        borderColor: "#6661ae",
        borderWidth: 0,
        hoverBackgroundColor: "#7a75c4",
        hoverBorderColor: "#8a7fd4",
        hoverBorderWidth: 2,
      },
    ],
  };

  const statusColorMap = {
    [BOOKING_STATUSES.COMPLETED]: "#90d14f",
    [BOOKING_STATUSES.CANCELLED]: "#ec1f23",
    [BOOKING_STATUSES.RESCHEDULED]: "#ffbf05",
  };

  const renderScheduleAction = (booking) => {
    const displayStatus = booking.status;
    const color = statusColorMap[displayStatus] || "#f44336";

    if (displayStatus === BOOKING_STATUSES.CONFIRMED) {
      return (
        <button
          className="btn-primary"
          style={{
            padding: "6px 0",
            minWidth: "90px",
            maxWidth: "120px",
            fontSize: "14px",
            boxShadow: "0 2px 8px rgba(25, 118, 210, 0.08)",
            letterSpacing: "0.5px",
            transition: "background 0.2s",
            margin: "0 auto",
            display: "block",
          }}
          onClick={() => checkPaymentConfirmation(booking.id)}
        >
          Done
        </button>
      );
    }

    return (
      <span
        className="font-bold text-base block text-center"
        style={{
          fontFamily: "Quicksand, sans-serif",
          fontWeight: "bold",
          fontSize: "16px",
          color,
          display: "block",
          textAlign: "center",
          textTransform: "none",
        }}
      >
        {displayStatus}
      </span>
    );
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white font-quicksand">
        Loading user data...
      </div>
    );
  }

  const completedStatuses = [
    BOOKING_STATUSES.COMPLETED,
    BOOKING_STATUSES.CANCELLED,
    BOOKING_STATUSES.RESCHEDULED,
    BOOKING_STATUSES.ABSENT,
  ];
  const sortedSchedule = [...scheduleData].sort((a, b) => {
    const aIsActive = !completedStatuses.includes(a.status);
    const bIsActive = !completedStatuses.includes(b.status);
    if (aIsActive !== bIsActive) {
      return aIsActive ? -1 : 1; // Active bookings first
    }
    // Both are the same type (active or completed), sort by start_time ascending
    return (a.start_time || "").localeCompare(b.start_time || "");
  });
  const limitedSchedule = sortedSchedule.slice(0, 5);

  return (
    <div className="bg-huuk-bg text-white font-quicksand">
      <div className="w-full">
        <div className="w-full">
          {/* Header section with summary cards and attendance reminder */}
          <div className="mb-4">
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                {[
                  {
                    img: summ1,
                    label: "Done",
                    value: loadingSummary ? "..." : summaryData.done.toString(),
                  },
                  {
                    img: summ3,
                    label: "Pending",
                    value: loadingSummary
                      ? "..."
                      : summaryData.pending.toString(),
                  },
                  {
                    img: summ4,
                    label: "Cancelled",
                    value: loadingSummary
                      ? "..."
                      : summaryData.cancelled.toString(),
                  },
                  {
                    img: summ2,
                    label: "Reschedule",
                    value: loadingSummary
                      ? "..."
                      : summaryData.rescheduled.toString(),
                  },
                ].map(({ img, label, value }) => (
                  <div
                    key={label}
                    className="card-dark rounded-huuk-lg flex items-center gap-3"
                  >
                    <img
                      src={img}
                      alt={label}
                      className="w-8 h-8 object-contain"
                    />
                    <div>
                      <p className="text-sm font-bold m-0">{label}</p>
                      <p className="text-sm font-bold m-0">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Attendance reminder in header */}
              <div className="w-full xl:max-w-md">
                <div className="card-dark rounded-huuk-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={isTimeInConfirmed ? donereminder : remindreminder}
                      alt="Attendance Reminder"
                      className="w-12 h-12 object-contain"
                    />
                    <div>
                      <p className="font-bold text-sm m-0">
                        {isTimeInConfirmed
                          ? "Already Updated Time-In"
                          : "Not Yet Updated Time-In"}
                      </p>
                      {isTimeInConfirmed && (
                        <p className="text-xs text-huuk-muted m-0 mt-1">
                          Great! Your time-in has been successfully recorded.
                        </p>
                      )}
                    </div>
                  </div>
                  {!isTimeInConfirmed && (
                    <button
                      className="btn-primary"
                      onClick={() =>
                        alert(
                          "This feature is currently under maintenance. Please check back later.",
                        )
                      }
                    >
                      Update
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main appointment management layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Left side - Appointment List */}
            <div className="xl:col-span-8 space-y-4">
              <div className="card-dark rounded-huuk-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold flex items-center">
                    My Schedule
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          backgroundColor: "#00ff00",
                          borderRadius: "50%",
                          marginLeft: "8px",
                          animation: "pulse 2s infinite",
                        }}
                        title="Real-time updates enabled"
                      />
                      <span className="ml-2 text-huuk-muted italic text-sm font-normal">
                        Active Booking
                      </span>
                    </>
                  </h3>
                  <button
                    className="btn-ghost text-sm"
                    onClick={() => navigate("/staff/schedule")}
                  >
                    View All
                  </button>
                </div>
                {isMobileView ? (
                  <div className="space-y-2">
                    {loadingSchedule ? (
                      <div className="huuk-td text-center">Loading...</div>
                    ) : (
                      limitedSchedule.map((booking, index) => (
                        <div
                          key={booking.id || index}
                          className="rounded-huuk-sm border border-white/10 bg-white/5 p-3"
                        >
                          <div className="grid grid-cols-2 gap-y-1 text-sm">
                            <span className="text-huuk-muted">Customer</span>
                            <span>{booking.customer_name}</span>
                            <span className="text-huuk-muted">Phone</span>
                            <span>{booking.phone_number}</span>
                            <span className="text-huuk-muted">Service</span>
                            <span>{booking.service_name}</span>
                            <span className="text-huuk-muted">Time</span>
                            <span>
                              {booking.start_time !== "-" &&
                              booking.end_time !== "-"
                                ? `${booking.start_time} - ${booking.end_time}`
                                : "-"}
                            </span>
                          </div>
                          <div className="mt-3">
                            {renderScheduleAction(booking)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="huuk-table min-w-[760px]">
                      <thead>
                        <tr>
                          <th className="huuk-th">CUSTOMER NAME</th>
                          <th className="huuk-th">PHONE NUMBER</th>
                          <th className="huuk-th">SERVICE</th>
                          <th className="huuk-th">TIME</th>
                          <th className="huuk-th text-center">ACTION</th>
                        </tr>
                      </thead>

                      <tbody>
                        {loadingSchedule ? (
                          <tr>
                            <td colSpan="5" className="huuk-td text-center">
                              Loading...
                            </td>
                          </tr>
                        ) : (
                          limitedSchedule.map((booking, index) => {
                            return (
                              <tr
                                key={booking.id || index}
                                className="huuk-tr border-b border-white/10"
                              >
                                <td className="huuk-td">
                                  {booking.customer_name}
                                </td>
                                <td className="huuk-td">
                                  {booking.phone_number}
                                </td>
                                <td className="huuk-td">
                                  {booking.service_name}
                                </td>
                                <td className="huuk-td">
                                  {booking.start_time !== "-" &&
                                  booking.end_time !== "-"
                                    ? `${booking.start_time} - ${booking.end_time}`
                                    : "-"}
                                </td>
                                <td
                                  className="huuk-td"
                                  style={{
                                    textAlign: "center",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {renderScheduleAction(booking)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment Management and Sales Report */}
              <div className="grid grid-cols-1 gap-4 mt-5">
                <PaymentManagementTable
                  loadingPayment={loadingPayment}
                  paymentData={paymentData}
                  isMobileView={isMobileView}
                />

                <div className="card-dark rounded-huuk-lg">
                  <BarberSalesReport />
                </div>
              </div>
            </div>

            {/* Right side - Booking Time Slot */}
            <div className="xl:col-span-4 space-y-4 mt-5 xl:mt-0">
              <div className="card-dark rounded-huuk-lg">
                <h3 className="text-lg font-bold">Appointment Management</h3>
                <p className="text-sm text-huuk-muted mt-1">
                  View Time Slots Status
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {availableSlots.map((time) => {
                    const isBooked = scheduleData.some((booking) => {
                      if (
                        booking.status === "Cancelled" ||
                        booking.status === "Rescheduled" ||
                        booking.status === "-" ||
                        booking.start_time === "-" ||
                        booking.end_time === "-"
                      ) {
                        return false;
                      }
                      const slotMoment = moment(time, "HH:mm");
                      const startTime = moment(booking.start_time, "HH:mm");
                      const endTime = moment(booking.end_time, "HH:mm");
                      if (!startTime.isValid() || !endTime.isValid())
                        return false;
                      // Block slot if slotMoment >= startTime and slotMoment < endTime
                      return (
                        slotMoment.isSameOrAfter(startTime) &&
                        slotMoment.isBefore(endTime)
                      );
                    });
                    const isBlocked = blockedSlots.includes(time);
                    const isWithinHours = isWithinOperationalHours(time);

                    const getButtonClass = () => {
                      if (isBooked) return "bg-huuk-red/80 text-white";
                      if (!isWithinHours) return "bg-gray-500 text-white";
                      if (isBlocked) return "bg-huuk-yellow text-huuk-card";
                      return "bg-huuk-card-light text-huuk-card hover:bg-white";
                    };

                    const isClickable =
                      !isBooked && isWithinHours && !isBlocked;

                    return (
                      <button
                        key={time}
                        onDoubleClick={() => {
                          if (isClickable) {
                            toggleSlotBlocking(time);
                          }
                        }}
                        className={`rounded-huuk-sm px-2 py-2 text-sm font-semibold transition-colors ${getButtonClass()}`}
                        disabled={!isClickable}
                        style={{
                          cursor: isClickable ? "pointer" : "not-allowed",
                          opacity: isBooked ? 0.6 : 1,
                          backgroundColor: !isWithinHours
                            ? "#6c757d"
                            : undefined, // Grey for out of hours
                          color: !isWithinHours ? "white" : undefined,
                        }}
                        title={
                          !isWithinHours
                            ? "Outside operational hours"
                            : isBooked
                              ? "Already booked"
                              : isBlocked
                                ? "Blocked slot"
                                : "Double-click to block this slot"
                        }
                      >
                        {time}
                      </button>
                    );
                  })}
                  <button
                    className="btn-ghost mt-2"
                    onClick={() => {
                      navigate("/staff/appointments");
                    }}
                  >
                    View all
                  </button>
                </div>
              </div>

              {/* Today's Appointments by All Staff under Appointment Management */}
              <div className="card-dark rounded-huuk-lg mt-0">
                <div className="mb-2">
                  <h3
                    className="text-lg font-bold"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Today's Appointments by All Staff
                  </h3>
                </div>
                {loadingBarChart ? (
                  <div className="min-h-[220px] flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <p className="text-sm text-huuk-muted mt-3">
                      Loading chart data...
                    </p>
                  </div>
                ) : !barChartData.labels || barChartData.labels.length === 0 ? (
                  <div className="min-h-[220px] flex flex-col items-center justify-center text-center">
                    <div className="text-2xl">📊</div>
                    <p className="text-sm mt-2">
                      No appointments scheduled for today
                    </p>
                    <p className="text-xs text-huuk-muted mt-1">
                      Check back later or view all appointments
                    </p>
                  </div>
                ) : (
                  <div className="h-[260px]">
                    <Bar
                      key={`bar-chart-${JSON.stringify(barChartData)}`}
                      data={todaysAppointmentBarData}
                      options={barChartOptions}
                      redraw={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {user?.role === "manager" && (
            <SwitchModeButton
              modeText="Switch to Manager Mode"
              onClick={() => navigate("/manager")}
            />
          )}
        </div>
      </div>

      {/* Add Booking Modal */}
      <AddBookingModal
        isOpen={showAddBookingModal}
        onClose={() => {
          setShowAddBookingModal(false);
          setSelectedSlotForBooking(null);
        }}
        selectedSlot={selectedSlotForBooking}
        onSubmit={handleBookingSubmit}
        currentUser={user}
        timeSlots={TIME_SLOTS}
        bookings={scheduleData}
        blockedSlots={blockedSlots.map((time) => ({
          time,
          date: moment().format("YYYY-MM-DD"),
        }))}
      />

      {/* Minimal Payment Confirmation Popup */}
      {showPaymentConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-huuk-sm p-5 w-[90%] max-w-[400px] shadow-xl relative z-[10000]">
            {/* Close button */}
            <button
              className="absolute top-2.5 right-2.5 bg-transparent border-none text-xl cursor-pointer"
              onClick={() => {
                // Close popup without marking booking as done
                setShowPaymentConfirmation(false);
                setPaymentConfirmationData(null);
                // Note: Booking remains in its original state (not marked as done)
              }}
              aria-label="Close popup without completing booking"
              title="Close without completing booking"
            >
              <i className="bi bi-x"></i>
            </button>

            {/* Header */}
            <div className="text-center mb-5">
              <i
                className="bi bi-credit-card"
                style={{
                  fontSize: "32px",
                  color: "#3b82f6",
                  marginBottom: "10px",
                }}
              ></i>
              <h3
                className="text-lg text-huuk-card m-0"
                style={{
                  fontSize: "18px",
                }}
              >
                Payment Confirmation
              </h3>
            </div>

            {/* Content */}
            <div className="mb-5">
              <div className="text-center">
                <p
                  className="text-base m-0 mb-1"
                  style={{
                    fontSize: "16px",
                  }}
                >
                  <strong>
                    {paymentConfirmationData?.customerName ||
                      "Walk-in Customer"}
                  </strong>
                </p>
                <p
                  className="text-sm text-[#666] m-0 mb-4"
                  style={{
                    fontSize: "14px",
                  }}
                >
                  {paymentConfirmationData?.serviceName || "Service"}
                </p>
                <p
                  className="text-base font-bold mt-4 mb-0"
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    margin: "15px 0 0 0",
                  }}
                >
                  Has the customer paid?
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className="flex justify-between gap-2.5"
              style={{ flexDirection: isMobileView ? "column" : "row" }}
            >
              <button
                className="flex-1 p-3 bg-emerald-500 text-white border-none rounded-huuk-sm font-bold cursor-pointer flex items-center justify-center gap-1"
                style={{ minHeight: 46 }}
                onClick={() => handlePaymentPaid(paymentConfirmationData)}
              >
                <i className="bi bi-check-lg"></i> Yes, Paid
              </button>

              <button
                className="flex-1 p-3 bg-amber-500 text-white border-none rounded-huuk-sm font-bold cursor-pointer flex items-center justify-center gap-1"
                style={{ minHeight: 46 }}
                onClick={() => handlePaymentUnpaid(paymentConfirmationData)}
              >
                <i className="bi bi-clock"></i> Not Yet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
