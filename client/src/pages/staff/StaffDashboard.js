import React, { useEffect, useState } from "react";
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
  SOCKET_URL,
  OPERATIONAL_HOURS,
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../../utils/constants";
import { getSocketConnectOptions } from "../../utils/socketClient";

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
  className = "",
}) => {
  return (
    <div
      className={`card-dark flex h-full min-h-0 flex-col ${className}`.trim()}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
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
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
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
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <table className="huuk-table w-full table-fixed">
            <thead>
              <tr>
                <th className="huuk-th w-[38%]">CUSTOMER NAME</th>
                <th className="huuk-th w-[38%]">PAYMENT METHOD</th>
                <th className="huuk-th w-[24%]">STATUS</th>
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
                    <td className="huuk-td truncate">
                      {payment.customer_name}
                    </td>
                    <td className="huuk-td truncate">
                      {payment.payment_method}
                    </td>
                    <td
                      className={`huuk-td truncate font-semibold ${payment.payment_status === "Paid" ? "text-green-400" : "text-yellow-300"}`}
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

      const sortedScheduleResponse = (scheduleResponse.data || []).sort(
        (a, b) => {
          if (a.start_time === "-" && b.start_time === "-") return 0;
          if (a.start_time === "-") return 1;
          if (b.start_time === "-") return -1;
          return a.start_time.localeCompare(b.start_time);
        },
      );
      setScheduleData(sortedScheduleResponse);

      setBarChartData(barChartResponse.data || { labels: [], data: [] });
    } catch (error) {
      console.error("Error fetching data:", error);
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

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    const socket = io(SOCKET_URL, getSocketConnectOptions());
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
            bookingId,
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
      console.error("Error marking booking as done:", error);
      alert("Failed to mark booking as done. Please try again.");
      await Promise.all([fetchAllData(), fetchBlockedSlots()]);
    }
  };

  const handlePaymentPaid = async (payment) => {
    try {
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
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);
        await markBookingAsDone(payment.bookingId);
        alert("Payment marked as Paid successfully!");
      }
    } catch (error) {
      let message = "Failed to update payment status. Please try again.";
      if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      alert(message);
      fetchPaymentData();
    }
  };

  const handlePaymentUnpaid = async (payment) => {
    try {
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
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);
        await markBookingAsDone(payment.bookingId);
        alert(
          "Booking marked as completed. Payment status kept as Pending. Please collect payment when customer is ready.",
        );
      }
    } catch (error) {
      let message = "Failed to update payment status. Please try again.";
      if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      alert(message);
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
          title(context) {
            return context[0].label;
          },
          label(context) {
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
        display(context) {
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
      console.error("Error fetching blocked slots:", error);
      setBlockedSlots([]);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBlockedSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggleSlotBlocking = async (time) => {
    if (!user?.id) return;

    const isCurrentlyBlocked = blockedSlots.includes(time);
    if (isCurrentlyBlocked) {
      alert("This time slot is already blocked and cannot be unblocked.");
      return;
    }

    try {
      setBlockedSlots((prev) => [...prev, time]);

      const response = await api.post(
        `/staff/toggle-slot-blocking`,
        {
          staff_id: user.id,
          date: moment().format("YYYY-MM-DD"),
          time,
          action: "block",
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("staff_token")}`,
          },
        },
      );

      if (response.status === 200) {
        alert(`Time slot ${time} blocked successfully.`);
        await fetchBlockedSlots();
      }
    } catch (error) {
      console.error("Error blocking slot:", error);
      setBlockedSlots((prev) => prev.filter((slotTime) => slotTime !== time));

      if (error.response?.data?.message) {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes("already blocked")) {
          alert("This time slot is already blocked.");
          setBlockedSlots((prev) =>
            prev.includes(time) ? prev : [...prev, time],
          );
        } else {
          alert(`Failed to block time slot: ${errorMessage}`);
        }
      } else {
        alert("Failed to block time slot. Please try again.");
      }
    }
  };

  const handleBookingSubmit = async () => {
    try {
      setShowAddBookingModal(false);
      setSelectedSlotForBooking(null);
      await fetchAllData();
      await fetchBlockedSlots();
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Failed to submit booking. Please try again.");
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    const now = moment();
    const currentMinutes = now.minutes();
    let startTime;

    if (currentMinutes <= 30) {
      startTime = moment().minutes(30).seconds(0);
    } else {
      startTime = moment().add(1, "hour").minutes(0).seconds(0);
    }

    const slotTime = startTime.clone();
    for (let index = 0; index < 7; index += 1) {
      slots.push(slotTime.format("HH:mm"));
      slotTime.add(30, "minutes");
    }

    return slots;
  };

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
    return slotTime.isBetween(operationalStart, operationalEnd, null, "[");
  };

  const availableSlots = generateTimeSlots();

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
        className="block text-center text-base font-bold"
        style={{
          fontFamily: "Quicksand, sans-serif",
          fontWeight: "bold",
          fontSize: "16px",
          color,
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
      return aIsActive ? -1 : 1;
    }
    return (a.start_time || "").localeCompare(b.start_time || "");
  });
  const sliced = sortedSchedule.slice(0, 3);
  const emptyRow = {
    id: null,
    customer_name: "-",
    phone_number: "-",
    service_name: "-",
    start_time: "-",
    end_time: "-",
    _empty: true,
  };
  const limitedSchedule = [
    ...sliced,
    ...Array(Math.max(0, 3 - sliced.length))
      .fill(null)
      .map((_, i) => ({ ...emptyRow, _key: `empty-${i}` })),
  ];
  const hasActiveBooking = scheduleData.some(
    (b) => !completedStatuses.includes(b.status),
  );

  return (
    <div className="staff-dashboard min-w-0 overflow-x-hidden bg-huuk-bg pt-2 text-white font-quicksand">
      <div className="w-full min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-12 xl:items-stretch">
          <div className="xl:col-span-8 grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              {
                img: summ1,
                label: "Done",
                value: loadingSummary ? "..." : summaryData.done.toString(),
              },
              {
                img: summ3,
                label: "Pending",
                value: loadingSummary ? "..." : summaryData.pending.toString(),
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
                className="card-dark flex min-w-0 items-center gap-2 rounded-[16px] px-3 py-2"
              >
                <img
                  src={img}
                  alt={label}
                  className="h-8 w-8 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-bold leading-snug">
                    {label}
                  </p>
                  <p className="m-0 text-sm font-bold leading-snug">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-3 xl:col-span-4 xl:col-start-9 xl:row-span-2">
            <div className="card-dark flex h-28 shrink-0 flex-col items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-center">
              <div className="flex min-w-0 max-w-full items-center justify-center gap-2">
                <img
                  src={isTimeInConfirmed ? donereminder : remindreminder}
                  alt="Attendance Reminder"
                  className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
                />
                <p className="m-0 text-lg font-bold leading-snug sm:text-xl">
                  {isTimeInConfirmed
                    ? "Already Updated Time-In"
                    : "Not Yet Updated Time-In"}
                </p>
              </div>
              {!isTimeInConfirmed && (
                <button
                  className="btn-primary shrink-0 px-5 py-1.5 text-sm"
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

            <div className="card-dark flex-1 rounded-huuk-lg">
              <div>
                <h3 className="m-0 text-base font-bold">
                  Appointment Management
                </h3>
                <p className="m-0 mt-0.5 text-xs text-huuk-muted">
                  View Time Slots Status
                </p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
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
                    if (!startTime.isValid() || !endTime.isValid()) {
                      return false;
                    }
                    return (
                      slotMoment.isSameOrAfter(startTime) &&
                      slotMoment.isBefore(endTime)
                    );
                  });
                  const isBlocked = blockedSlots.includes(time);
                  const isWithinHours = isWithinOperationalHours(time);
                  const isClickable = !isBooked && isWithinHours && !isBlocked;

                  const buttonClass = isBooked
                    ? "bg-[#c0392b] text-white"
                    : !isWithinHours
                      ? "bg-[#454545] text-white/65"
                      : isBlocked
                        ? "bg-[#6f6f6f] text-white"
                        : "bg-[#8ddd53] text-white hover:bg-[#a4eb67]";

                  return (
                    <button
                      key={time}
                      onDoubleClick={() => {
                        if (isClickable) {
                          toggleSlotBlocking(time);
                        }
                      }}
                      className={`rounded-full py-1 text-[18px] font-normal transition-colors ${buttonClass}`}
                      disabled={!isClickable}
                      style={{
                        cursor: isClickable ? "pointer" : "not-allowed",
                        opacity: !isWithinHours ? 0.65 : 1,
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
                  className="btn-ghost self-center text-center text-sm"
                  onClick={() => navigate("/staff/appointments")}
                >
                  View all
                </button>
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 min-w-0">
            <div className="card-dark min-w-0 rounded-huuk-lg">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 text-lg font-bold leading-none">
                  <span className="inline-flex items-center gap-2">
                    <span className="leading-none">My Schedule</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-normal italic leading-none text-huuk-muted">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${hasActiveBooking ? "bg-[#00ff00]" : "bg-[#ff0000]"}`}
                        style={{ animation: "pulse 2s infinite" }}
                        title={
                          hasActiveBooking
                            ? "Active bookings"
                            : "No active bookings"
                        }
                      />
                      <span className="leading-none">Active Booking</span>
                    </span>
                  </span>
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
                        key={booking._key || booking.id || index}
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
                        {!booking._empty && (
                          <div className="mt-3">
                            {renderScheduleAction(booking)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="min-w-0 -mx-4 pb-4">
                  <table className="huuk-table w-full table-fixed">
                    <thead>
                      <tr>
                        <th className="huuk-th w-[21%]">CUSTOMER NAME</th>
                        <th className="huuk-th w-[20%]">PHONE NUMBER</th>
                        <th className="huuk-th w-[25%]">SERVICE</th>
                        <th className="huuk-th w-[18%]">TIME</th>
                        <th className="huuk-th w-[16%] text-center">ACTION</th>
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
                        limitedSchedule.map((booking, index) => (
                          <tr
                            key={booking._key || booking.id || index}
                            className="huuk-tr border-b border-white/10"
                          >
                            <td className="huuk-td truncate">
                              {booking.customer_name}
                            </td>
                            <td className="huuk-td truncate">
                              {booking.phone_number}
                            </td>
                            <td className="huuk-td truncate">
                              {booking.service_name}
                            </td>
                            <td className="huuk-td truncate">
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
                              {booking._empty
                                ? "-"
                                : renderScheduleAction(booking)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 xl:col-span-8 xl:h-full">
            <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 xl:h-full xl:grid-cols-[minmax(0,1.55fr)_minmax(240px,0.9fr)] xl:items-stretch xl:[grid-auto-rows:minmax(0,1fr)]">
              <div className="flex min-h-0 min-w-0">
                <PaymentManagementTable
                  loadingPayment={loadingPayment}
                  paymentData={paymentData}
                  isMobileView={isMobileView}
                  className="mt-0"
                />
              </div>
              <div className="flex min-h-0 min-w-0">
                <div className="card-dark flex min-h-0 min-w-0 flex-1 flex-col rounded-huuk-lg">
                  <BarberSalesReport />
                </div>
              </div>
            </div>
          </div>
          <div className="min-h-0 min-w-0 w-full xl:col-span-4 xl:col-start-9 xl:h-full xl:self-stretch">
            <div className="card-dark flex h-full min-h-[170px] w-full min-w-0 flex-col rounded-huuk-lg">
              <div className="mb-2 shrink-0">
                <h3 className="m-0 text-base font-bold">
                  Today's Appointments by All Staff
                </h3>
              </div>
              {loadingBarChart ? (
                <div className="flex min-h-[170px] flex-1 flex-col items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  <p className="mt-3 text-sm text-huuk-muted">
                    Loading chart data...
                  </p>
                </div>
              ) : !barChartData.labels || barChartData.labels.length === 0 ? (
                <div className="flex min-h-[170px] flex-1 flex-col items-center justify-center text-center">
                  <i className="bi bi-bar-chart-line-fill text-3xl text-[#8fb6d0]"></i>
                  <p className="mt-2 text-sm">
                    No appointments scheduled for today
                  </p>
                  <p className="mt-1 text-xs text-huuk-muted">
                    Check back later or view all appointments
                  </p>
                </div>
              ) : (
                <div className="h-[190px] w-full shrink-0">
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

      {showPaymentConfirmation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="relative z-[10000] w-[90%] max-w-[400px] rounded-huuk-sm bg-white p-5 shadow-xl">
            <button
              className="absolute right-2.5 top-2.5 cursor-pointer border-none bg-transparent text-xl"
              onClick={() => {
                setShowPaymentConfirmation(false);
                setPaymentConfirmationData(null);
              }}
              aria-label="Close popup without completing booking"
              title="Close without completing booking"
            >
              <i className="bi bi-x"></i>
            </button>

            <div className="mb-5 text-center">
              <i
                className="bi bi-credit-card"
                style={{
                  fontSize: "32px",
                  color: "#3b82f6",
                  marginBottom: "10px",
                }}
              ></i>
              <h3
                className="m-0 text-lg text-huuk-card"
                style={{
                  fontSize: "18px",
                }}
              >
                Payment Confirmation
              </h3>
            </div>

            <div className="mb-5">
              <div className="text-center">
                <p
                  className="m-0 mb-1 text-base"
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
                  className="m-0 mb-4 text-sm text-[#666]"
                  style={{
                    fontSize: "14px",
                  }}
                >
                  {paymentConfirmationData?.serviceName || "Service"}
                </p>
                <p
                  className="mb-0 mt-4 text-base font-bold"
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

            <div
              className="flex justify-between gap-2.5"
              style={{ flexDirection: isMobileView ? "column" : "row" }}
            >
              <button
                className="flex flex-1 items-center justify-center gap-1 rounded-huuk-sm border-none bg-emerald-500 p-3 font-bold text-white cursor-pointer"
                style={{ minHeight: 46 }}
                onClick={() => handlePaymentPaid(paymentConfirmationData)}
              >
                <i className="bi bi-check-lg"></i> Yes, Paid
              </button>

              <button
                className="flex flex-1 items-center justify-center gap-1 rounded-huuk-sm border-none bg-amber-500 p-3 font-bold text-white cursor-pointer"
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
