import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Pie, Bar } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import summ1 from "../../assets/summ1.png";
import summ2 from "../../assets/summ2.png";
import summ3 from "../../assets/summ3.png";
import summ4 from "../../assets/summ4.png";
import remindreminder from "../../assets/remindreminder.png";
import donereminder from "../../assets/donereminder.png";
import "bootstrap-icons/font/bootstrap-icons.css";
import SwitchModeButton from "../../components/shared/SwitchModeButton";
import "../../styles/staffDashboard.css";
import "../../styles/dummyDashboard.css";
import api from "../../utils/api";
import moment from "moment";
import AddBookingModal from "../../components/AddBookingModal";
import { TIME_SLOTS } from "../../utils/timeSlotUtils";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

import ChartDataLabels from "chartjs-plugin-datalabels";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../../utils/constants";

ChartJS.defaults.font.family = "Quicksand, sans-serif";
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ChartDataLabels
);

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

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [isTimeInConfirmed, setIsTimeInConfirmed] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  
  const [summaryData, setSummaryData] = useState({
    done: 0,
    pending: 0,
    cancelled: 0,
    rescheduled: 0,
    absent: 0
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [barChartData, setBarChartData] = useState({ labels: [], data: [] });
  const [loadingBarChart, setLoadingBarChart] = useState(true);
  const [processingBookings, setProcessingBookings] = useState(new Set());
  const [paymentData, setPaymentData] = useState([]);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [paymentConfirmationData, setPaymentConfirmationData] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loadingBlockedSlots, setLoadingBlockedSlots] = useState(false);
  
  // Debug logging for state changes
  useEffect(() => {
    console.log('DEBUG: showPaymentConfirmation state changed to:', showPaymentConfirmation);
  }, [showPaymentConfirmation]);
  
  useEffect(() => {
    console.log('DEBUG: paymentConfirmationData state changed to:', paymentConfirmationData);
  }, [paymentConfirmationData]);
  
  // Debug logging for blocked slots state changes
  useEffect(() => {
    console.log('🚑 [BLOCKED SLOTS DEBUG] Blocked slots state changed to:', blockedSlots);
    console.log('🚑 [BLOCKED SLOTS DEBUG] Blocked slots count:', blockedSlots.length);
    console.log('🚑 [BLOCKED SLOTS DEBUG] Blocked slots list:', blockedSlots);
  }, [blockedSlots]);
  const pollingIntervalRef = useRef(null);
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState(null);
  


  const fetchAllData = async () => {
    setLoadingSummary(true);
    setLoadingSchedule(true);
    setLoadingBarChart(true);

    try {
      // Fetch summary data
      const summaryResponse = await api.get("/bookings/summary", {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` },
      });
      setSummaryData(summaryResponse.data || {
        done: 0,
        pending: 0,
        cancelled: 0,
        rescheduled: 0,
        absent: 0
      });

      // Fetch schedule data
      const scheduleResponse = await api.get("/bookings/staff/schedule", {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` },
      });
      const sortedSchedule = (scheduleResponse.data || []).sort((a, b) => {
        if (a.start_time === "-" && b.start_time === "-") return 0;
        if (a.start_time === "-") return 1;
        if (b.start_time === "-") return -1;
        return a.start_time.localeCompare(b.start_time);
      });
      setScheduleData(sortedSchedule);

      // Fetch bar chart data filtered by user's outlet/branch
      let outletParam = null;
      if (user && user.outlet) {
        outletParam = user.outlet;
      } else if (user && user.outlet_id) {
        outletParam = user.outlet_id;
      }
      const barChartResponse = await api.get("/bookings/todays-appointments-by-staff", {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` },
        params: outletParam ? { outlet: outletParam } : {},
      });
      setBarChartData(barChartResponse.data || { labels: [], data: [] });

    } catch (error) {
      console.error("❌ Error fetching data:", error);
      // Set default values on error
      setSummaryData({
        done: 0,
        pending: 0,
        cancelled: 0,
        rescheduled: 0,
        absent: 0
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
    console.log("Starting fetchPaymentData...");
    setLoadingPayment(true);
    try {
      // Fetch payment data with expanded parameters to ensure all payment types are included
      const response = await api.get("/payments/payment-management", {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` },
        params: {
          limit: 10, // Increased limit to show more payments
          sort_by: 'created_at',
          sort_order: 'desc',
          include_all_types: true, // Request all payment types
          include_pay_at_outlet: true, // Explicitly request Pay at Outlet payments
          include_online_payment: true, // Explicitly request Online payments
        },
      });
      
      console.log("Payment data response:", response.data);
      console.log("Payment data length:", response.data ? response.data.length : 0);
      
      // Process payment data to ensure consistent format
      const processedPayments = Array.isArray(response.data) ? response.data.map(payment => ({
        ...payment,
        // Normalize payment method values
        payment_method: payment.payment_method === "pay_at_outlet" ? "Pay at Outlet" : 
                       payment.payment_method === "online_payment" ? "Online Payment" : 
                       payment.payment_method || "Unknown",
        // Ensure payment status is capitalized consistently
        payment_status: payment.payment_status === "paid" ? "Paid" :
                       payment.payment_status === "pending" ? "Pending" :
                       payment.payment_status || "Unknown"
      })) : [];
      
      console.log("Processed payment data:", processedPayments);
      setPaymentData(processedPayments);
    } catch (error) {
      console.error("Error fetching payment data:", error);
      console.error("Payment API error response:", error.response?.data);
      console.error("Payment API error status:", error.response?.status);
      setPaymentData([]);
    } finally {
      setLoadingPayment(false);
      console.log("fetchPaymentData completed");
    }
  };

  const checkAttendance = async (userId) => {
    console.log("Checking attendance in StaffDashboard for staff_id:", userId);
    try {
      const response = await api.get("/users/attendance", {
        params: {
          date: moment().format("YYYY-MM-DD"),
          staff_id: userId,
          page: 1,
        },
      });
      const data = response.data.attendance || [];
      console.log("StaffDashboard attendance data:", data);
      const todayRecord = data.find(
        (record) =>
          record.staff_id === userId &&
          moment(record.created_date).format("YYYY-MM-DD") ===
            moment().format("YYYY-MM-DD") &&
          record.time_in
      );
      if (todayRecord) {
        console.log("StaffDashboard found today record:", todayRecord);
        setIsTimeInConfirmed(true);
        localStorage.setItem("isTimeInConfirmed", "true");
        localStorage.setItem(
          "timeIn",
          moment(todayRecord.time_in).format("HH:mm")
        );
      } else {
        console.log("StaffDashboard no today record found");
        setIsTimeInConfirmed(false);
        localStorage.setItem("isTimeInConfirmed", "false");
        localStorage.removeItem("timeIn");
      }
    } catch (error) {
      console.error("StaffDashboard check attendance error:", error);
    }
  };

  useEffect(() => {
    console.log("Mounting StaffDashboard");
    
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
        console.log(
          "StaffDashboard initial localStorage isTimeInConfirmed:",
          storedTimeInConfirmed
        );
        setIsTimeInConfirmed(storedTimeInConfirmed === "true");
        checkAttendance(userObj.id);
        fetchAllData();
        fetchPaymentData();
        fetchBlockedSlots();
      }
    } else {
      navigate("/");
    }
    
    // Cleanup function
    return () => {
      // Clear polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
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
  }, []);

  // Update the payment table component to better display payment information
  const PaymentManagementTable = () => {
    return (
      <div className="staff-dashboard-payment-management">
        <div className="staff-dashboard-payment-header">
          <h3 className="staff-dashboard-payment-title">
            Payment Management
          </h3>
          <button 
            className="staff-dashboard-button-view-all-button-sales"
            onClick={() => alert("This feature is currently under maintenance. Please check back later.")}
          >
            View all
          </button>
        </div>
        <table className="staff-dashboard-payment-table">
          <thead>
            <tr className="staff-dashboard-table-header">
              <th className="staff-dashboard-th">CUSTOMER NAME</th>
              <th className="staff-dashboard-th">PAYMENT METHOD</th>
              <th className="staff-dashboard-th">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loadingPayment ? (
              <tr>
                <td colSpan="3" style={{ textAlign: "center", color: "white" }}>Loading payment data...</td>
              </tr>
            ) : paymentData.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: "center", color: "white" }}>No payment data available</td>
              </tr>
            ) : (
              paymentData.slice(0, 3).map((payment, index) => {
                // Treat null/empty payment_method as 'Pay at Outlet'
                const normalizedMethod = !payment.payment_method || payment.payment_method === "pay_at_outlet" ? "Pay at Outlet" :
                  payment.payment_method === "Online Payment" || payment.payment_method === "online_payment" || payment.payment_method === "online" ? "Online Payment" : payment.payment_method;
                return (
                  <tr key={payment.id || index} className="staff-dashboard-table-row">
                    <td className="staff-dashboard-table-cell">
                      {payment.customer_name}
                    </td>
                    <td className="staff-dashboard-table-cell">
                      {normalizedMethod}
                    </td>
                    <td className={`staff-dashboard-table-cell staff-dashboard-status ${payment.payment_status === "Paid" ? "staff-dashboard-status-paid" : "staff-dashboard-status-unpaid"}`}>
                      {payment.payment_status}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };


  const handleSearch = (value) => {
    setSearchText(value);
  };

  const toggleNotifications = (isOpen) => {
    setIsNotiOpen(isOpen);
  };

  // New function to check if booking needs payment confirmation
  const checkPaymentConfirmation = async (bookingId) => {
    console.log('DEBUG: Starting payment confirmation check for booking ID:', bookingId);
    try {
      // First, get booking details to check if payment confirmation is needed
      const token = localStorage.getItem("staff_token") || localStorage.getItem("token");
      
      if (!token) {
        console.error('No authentication token available');
        alert('Authentication required. Please log in again.');
        return;
      }
      
      const response = await api.get(`/bookings/booking-details/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('DEBUG: Booking details API response:', response.data);
      
      if (response.status === 200) {
        const bookingData = response.data;
        console.log('DEBUG: Booking data extracted:', {
          paymentMethod: bookingData.paymentMethod,
          paymentStatus: bookingData.paymentStatus,
          isWalkIn: bookingData.isWalkIn,
          customerName: bookingData.customerName,
          serviceName: bookingData.serviceName,
          totalAmount: bookingData.totalAmount
        });
        
        // Force show payment confirmation for Pay at Outlet or pending payments
        const shouldShowPaymentConfirmation =
          (bookingData.paymentMethod === "Pay at Outlet" ||
           bookingData.paymentMethod === "pay_at_outlet" ||
           bookingData.isWalkIn === true ||
           bookingData.paymentStatus === "Pending") &&
          bookingData.paymentStatus !== "Paid";
        
        console.log('DEBUG: Should show payment confirmation?', shouldShowPaymentConfirmation);
        console.log('DEBUG: Condition breakdown:', {
          'paymentMethod === Pay at Outlet': bookingData.paymentMethod === "Pay at Outlet",
          'paymentMethod === pay_at_outlet': bookingData.paymentMethod === "pay_at_outlet",
          'paymentStatus === Pending': bookingData.paymentStatus === "Pending",
          'isWalkIn': bookingData.isWalkIn
        });
        
        if (shouldShowPaymentConfirmation) {
          console.log('SUCCESS: Showing payment confirmation popup');
          // Show payment confirmation popup BEFORE marking as done
          const confirmationData = {
            bookingId: bookingId,
            paymentMethod: bookingData.paymentMethod || "Pay at Outlet",
            customerName: bookingData.customerName || "Customer",
            serviceName: bookingData.serviceName || "Service",
            totalAmount: bookingData.totalAmount || "0.00",
            paymentStatus: bookingData.paymentStatus || "Pending",
            isWalkIn: bookingData.isWalkIn || false
          };
          console.log('DEBUG: Payment confirmation data:', confirmationData);
          
          // Make sure to set these in the correct order
          setPaymentConfirmationData(confirmationData);
          setTimeout(() => {
            setShowPaymentConfirmation(true);
            console.log('DEBUG: showPaymentConfirmation state set to true');
          }, 50); // Small delay to ensure state updates properly
        } else {
          console.log('INFO: No payment confirmation needed, marking as done directly');
          // No payment confirmation needed, mark as done directly
          await markBookingAsDone(bookingId);
        }
      }
    } catch (error) {
      console.error('ERROR: Error checking payment confirmation:', error);
      console.error('ERROR: Error response:', error.response?.data);
      console.error('ERROR: Error status:', error.response?.status);
      // If we can't check, proceed with marking as done
      await markBookingAsDone(bookingId);
    }
  };

  // Separate function to actually mark booking as done
  const markBookingAsDone = async (bookingId) => {
    try {
      const response = await api.post("/bookings/staff/mark-done", 
        { booking_id: bookingId },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` },
        }
      );
      
      if (response.status === 200) {
  // Refresh all data after marking as done
        await fetchAllData();
        await fetchPaymentData(); // Also refresh payment data
        await fetchBlockedSlots(); // Also refresh blocked slots to ensure UI sync
      }
    } catch (error) {
      console.error("❌ Error marking booking as done:", error);
      alert("Failed to mark booking as done. Please try again.");
      
      // Refresh data to ensure consistency
      await fetchAllData();
      await fetchBlockedSlots(); // Also refresh blocked slots
    }
  };

  // Update payment handlers to accept payment object
  const handlePaymentPaid = async (payment) => {
    try {
      // Mark as paid
      const response = await api.post("/payments/update-payment-status", {
        booking_id: payment.bookingId,
        payment_status: "Paid"
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` },
      });
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
      if (error.response && error.response.data && error.response.data.message) {
        msg = error.response.data.message;
      }
      alert(msg);
      fetchPaymentData();
    }
  };

  const handlePaymentUnpaid = async (payment) => {
    try {
      // Mark as unpaid
      const response = await api.post("/payments/update-payment-status", {
        booking_id: payment.bookingId,
        payment_status: "Pending"
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token") || localStorage.getItem("token")}` },
      });
      if (response.status === 200) {
        // Close the payment confirmation popup
        setShowPaymentConfirmation(false);
        setPaymentConfirmationData(null);
        
        // Mark the booking as done after payment status is updated
        await markBookingAsDone(payment.bookingId);
        
        alert("Booking marked as completed. Payment status kept as Pending. Please collect payment when customer is ready.");
      }
    } catch (error) {
      let msg = "Failed to update payment status. Please try again.";
      if (error.response && error.response.data && error.response.data.message) {
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
      mode: 'index',
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Services",
          color: "white",
          font: { family: "Quicksand, sans-serif", size: 11, weight: 'normal' },
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
          font: { family: "Quicksand, sans-serif", size: 11, weight: 'normal' },
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
        titleFont: { family: "Quicksand, sans-serif", size: 12, weight: '600' },
        bodyFont: { family: "Quicksand, sans-serif", size: 11 },
        padding: 12,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            const value = context.parsed.y;
            return `${value} appointment${value !== 1 ? 's' : ''} today`;
          }
        }
      },
      datalabels: {
        anchor: "center",
        align: "center",
        color: "white",
        backgroundColor: "transparent",
        borderRadius: 0,
        font: { size: 12, family: "Quicksand, sans-serif", weight: '600' },
        formatter: (value) => value > 0 ? value : '',
        padding: 0,
        display: function(context) {
          return context && context.parsed && context.parsed.y > 0;
        }
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
      easing: 'easeInOutQuart',
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    },
  };


  // Fetch blocked slots from API
  const fetchBlockedSlots = async () => {
    if (!user?.id) return;
    
    setLoadingBlockedSlots(true);
    try {
      const response = await api.get(`/staff/blocked-slots`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` },
        params: {
          staff_id: user.id,
          date: moment().format("YYYY-MM-DD")
        }
      });
      
      const rawBlockedSlots = response.data.blocked_slots || [];
      const processedBlockedSlots = rawBlockedSlots.map(slot => typeof slot === 'object' ? slot.time : slot);
      setBlockedSlots(processedBlockedSlots);
    } catch (error) {
      console.error("❌ Error fetching blocked slots:", error);
      setBlockedSlots([]);
    } finally {
      setLoadingBlockedSlots(false);
    }
  };

  // Fetch blocked slots when user changes
  useEffect(() => {
    if (user?.id) {
      fetchBlockedSlots();
    }
  }, [user?.id]);

  // Toggle slot blocking via API
  const toggleSlotBlocking = async (time) => {
    if (!user?.id) return;
    
    const isCurrentlyBlocked = blockedSlots.includes(time);
    
    // Prevent unblocking of already blocked slots
    if (isCurrentlyBlocked) {
      alert('This time slot is already blocked and cannot be unblocked.');
      return;
    }
    
    const action = 'block';
    
    try {
      // Optimistically update UI first
      setBlockedSlots(prev => [...prev, time]);
      
      const response = await api.post(`/staff/toggle-slot-blocking`, {
        staff_id: user.id,
        date: moment().format("YYYY-MM-DD"),
        time: time,
        action: action
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` }
      });
      
      // Confirm the block was successful
      if (response.status === 200) {
        alert(`Time slot ${time} blocked successfully.`);
        // Refresh blocked slots from server to ensure accurate state
        await fetchBlockedSlots();
      }
      
    } catch (error) {
      console.error(`❌ Error ${action}ing slot:`, error);
      
      // Revert optimistic update on error
      setBlockedSlots(prev => prev.filter(t => t !== time));
      
      // Handle specific error cases
      if (error.response?.data?.message) {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes('already blocked') && action === 'block') {
          alert('This time slot is already blocked.');
          // Ensure the slot shows as blocked
          setBlockedSlots(prev => prev.includes(time) ? prev : [...prev, time]);
        } else {
          alert(`Failed to ${action} time slot: ${errorMessage}`);
        }
      } else {
        alert(`Failed to ${action} time slot. Please try again.`);
      }
    }
  };

  // Handle slot click for adding booking
  const handleSlotClickForBooking = (time) => {
    const today = moment();
    const selectedDate = {
      display: "today",
      date: today.format('YYYY-MM-DD'),
      full: today.toDate().toDateString(),
    };

    setSelectedSlotForBooking({ day: selectedDate, time });
    setShowAddBookingModal(true);
  };

  // Handle booking submission
  const handleBookingSubmit = async (formData) => {
    try {
      // Submit booking logic here - similar to existing booking submission
      console.log('Submitting booking:', formData);
      
      // Close modal
      setShowAddBookingModal(false);
      setSelectedSlotForBooking(null);
      
      // Refresh data
      await fetchAllData();
      await fetchBlockedSlots(); // Refresh blocked slots to ensure UI sync
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('Failed to submit booking. Please try again.');
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
      startTime = moment().add(1, 'hour').minutes(0).seconds(0);
    }
    
    // Generate exactly 7 slots starting from the calculated start time
    const slotTime = startTime.clone();
    for (let i = 0; i < 7; i++) {
      slots.push(slotTime.format("HH:mm"));
      slotTime.add(30, 'minutes');
    }
    
    return slots;
  };

  // Helper function to check if a time slot is within operational hours
  const isWithinOperationalHours = (time) => {
    const operationalStart = moment().hour(9).minute(30).second(0);
    const operationalEnd = moment().hour(21).minute(59).second(59); // End before 10:00 PM
    const slotTime = moment(time, "HH:mm");
    
    return slotTime.isBetween(operationalStart, operationalEnd, null, '[)');
  };

  const availableSlots = generateTimeSlots();

  const toggleSlot = (time) => {
    if (blockedSlots.includes(time)) {
      setBlockedSlots(blockedSlots.filter((t) => t !== time));
    } else {
      setBlockedSlots([...blockedSlots, time]);
    }
  };

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

  const BarberSalesReport = () => {
    const [salesData, setSalesData] = useState({
      labels: [],
      data: [],
      totalSales: 0
    });
    const [loadingSales, setLoadingSales] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);

    const fetchSalesData = useCallback(async () => {
      if (hasFetched) return; // Prevent multiple calls
      
      console.log("Starting fetchSalesData...");
      const currentDate = moment().format("YYYY-MM-DD");
      console.log("Fetching sales data for date:", currentDate);
      setLoadingSales(true);
      try {
        // Fetch sales data
        const response = await api.get("/bookings/sales-report", {
          headers: { Authorization: `Bearer ${localStorage.getItem("staff_token")}` },
          params: {
            date: currentDate
          }
        });
        
        console.log("Sales data response:", response.data);
        const responseData = response.data || {};
        console.log("Processed sales data:", {
          labels: responseData.labels || [],
          data: responseData.data || [],
          totalSales: responseData.totalSales || 0
        });
        
        setSalesData({
          labels: responseData.labels || [],
          data: responseData.data || [],
          totalSales: responseData.totalSales || 0
        });
        setHasFetched(true);
      } catch (error) {
        console.error("Error fetching sales data:", error);
        console.error("Sales API error response:", error.response?.data);
        console.error("Sales API error status:", error.response?.status);
        
        setSalesData({
          labels: [],
          data: [],
          totalSales: 0
        });
        setHasFetched(true);
      } finally {
        setLoadingSales(false);
        console.log("fetchSalesData completed");
      }
    }, [hasFetched]);

    useEffect(() => {
      fetchSalesData();
    }, [fetchSalesData]);

    // Pastel blue color palette for the pie chart
    const pieColors = [
      "#A8D8EA", // Light Pastel Blue
      "#B6E5F0", // Very Light Blue
      "#C7E9F4", // Pale Blue
      "#D4F1F8", // Extra Light Blue
      "#9FD3E7", // Soft Blue
      "#8BCBDE", // Medium Pastel Blue
      "#7BC4D6", // Slightly Deeper Blue
      "#6BB6CE", // Mid Blue
      "#5BA8C6", // Deeper Pastel Blue
      "#4B9ABE", // Blue Gray
      "#3B8CB6", // Moderate Blue
      "#2B7EAE", // Deep Pastel Blue
      "#1B70A6", // Darker Blue
      "#0B629E", // Navy Blue
      "#005496"  // Deep Navy
    ];

    const data = {
      labels: salesData.labels || [],
      datasets: [
        {
          data: salesData.data || [],
          backgroundColor: (salesData.labels || []).map((_, index) => 
            pieColors[index % pieColors.length]
          ),
          borderWidth: 2,
          borderColor: "#1a1a1a",
          hoverBackgroundColor: (salesData.labels || []).map((_, index) => {
            const color = pieColors[index % pieColors.length];
            // Make hover color slightly darker
            return color + "CC"; // Add transparency
          }),
          hoverBorderWidth: 3,
          hoverBorderColor: "#ffffff",
        },
      ],
    };

    const options = {
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 10,
            font: { family: '"Quicksand", sans-serif', size: 8 },
            color: "white",
            padding: 15,
          },
        },
        tooltip: { 
          enabled: true,
          backgroundColor: "rgba(26, 26, 26, 0.95)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "#6661ae",
          borderWidth: 1,
          cornerRadius: 8,
          titleFont: { family: "Quicksand, sans-serif", size: 12, weight: '600' },
          bodyFont: { family: "Quicksand, sans-serif", size: 11 },
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        },
        datalabels: { 
          display: false
        },
      },
      maintainAspectRatio: false,
      responsive: true,
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart',
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      },
    };

    return (
      <div className="staff-dashboard-barber-sales-report-container">
        <div className="staff-dashboard-barber-sales-report-header">
          <h2 className="staff-dashboard-barber-sales-report-title">
            Sales Report
          </h2>
                  <button
                    className="staff-dashboard-button-view-all-button-sales"
                    onClick={() => {
                      alert("This feature is currently under maintenance. Please check back later.");
                    }}
                  >
                    View All
                  </button>
        </div>

        <p className="staff-dashboard-sales-report-subtitle">
          Today's Sales {salesData.totalSales > 0 && `(Total: RM${salesData.totalSales})`}
        </p>

        <div className="staff-dashboard-pie-chart">
          {loadingSales ? (
            <div className="staff-dashboard-chart-loading">
              <div className="staff-dashboard-loading-spinner"></div>
              <p className="staff-dashboard-no-appointments">
                Loading sales data...
              </p>
            </div>
          ) : !salesData.labels || salesData.labels.length === 0 ? (
            <div className="staff-dashboard-empty-state">
              <div className="staff-dashboard-empty-icon">📊</div>
              <p className="staff-dashboard-no-appointments">
                No sales data available
              </p>
              <p className="staff-dashboard-empty-subtext">
                Sales data will appear here once services are completed
              </p>
            </div>
          ) : (
            <Pie data={data} options={options} />
          )}
        </div>
      </div>
    );
  };

  // Add statusPriority for sorting
  const statusPriority = {
    'Upcoming': 1, 'Confirmed': 1, 'Scheduled': 1, 'In Progress': 2, 'Overdue': 3,
    'Completed': 4, 'Cancelled': 4, 'Absent': 4, 'Rescheduled': 4
  };

  const statusColorMap = {
    'Completed': '#90d14f',
    'Cancelled': '#ec1f23',
    'Rescheduled': '#ffbf05',
  };

  if (!user) {
    return <div className="staff-dashboard-loading">Loading user data...</div>;
  }

  // Filter out draft bookings before sorting and limiting
  const completedStatuses = ['Completed', 'Cancelled', 'Rescheduled', 'Absent'];
  const filteredSchedule = scheduleData;
  const sortedSchedule = [...filteredSchedule].sort((a, b) => {
    const aIsActive = !completedStatuses.includes(a.status);
    const bIsActive = !completedStatuses.includes(b.status);
    if (aIsActive !== bIsActive) {
      return aIsActive ? -1 : 1; // Active bookings first
    }
    // Both are the same type (active or completed), sort by start_time ascending
    return (a.start_time || '').localeCompare(b.start_time || '');
  });
  const limitedSchedule = sortedSchedule.slice(0, 5);

  // Before rendering the schedule table, add a debug log
  console.log('[My Schedule] Bookings being rendered:', limitedSchedule);

  return (
    <div className="staff-dashboard">
      <div className="staff-dashboard-dashboard-container">
        <div className="staff-dashboard-main-content">
          {/* Header section with summary cards and attendance reminder */}
          <div className="staff-dashboard-header-section">
            <div className="staff-dashboard-header-content">
              <div className="staff-dashboard-summary-cards-container">
                {[
                  { img: summ1, label: "Done", value: loadingSummary ? "..." : summaryData.done.toString() },
                  { img: summ3, label: "Pending", value: loadingSummary ? "..." : summaryData.pending.toString() },
                  { img: summ4, label: "Cancelled", value: loadingSummary ? "..." : summaryData.cancelled.toString() },
                  { img: summ2, label: "Reschedule", value: loadingSummary ? "..." : summaryData.rescheduled.toString() },
                ].map(({ img, label, value }) => (
                  <div key={label} className="staff-dashboard-summary-card">
                    <img
                      src={img}
                      alt={label}
                      className="staff-dashboard-summary-icon-img"
                    />
                    <div>
                      <p className="staff-dashboard-summary-label">{label}</p>
                      <p className="staff-dashboard-summary-value">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Attendance reminder in header */}
              <div className="staff-dashboard-attendance-reminder-container">
                <div className="staff-dashboard-attendance-reminder">
                  <div className="staff-dashboard-attendance-reminder-content">
                    <img
                      src={isTimeInConfirmed ? donereminder : remindreminder}
                      alt="Attendance Reminder"
                      className={
                        isTimeInConfirmed
                          ? "staff-dashboard-done-reminder-icon-img"
                          : "staff-dashboard-reminder-icon-img"
                      }
                    />
                    <div className="staff-dashboard-attendance-reminder-text">
                      <p
                        className={
                          isTimeInConfirmed
                            ? "staff-dashboard-attendance-done-label"
                            : "staff-dashboard-attendance-reminder-label"
                        }
                      >
                        {isTimeInConfirmed
                          ? "Already Updated Time-In"
                          : "Not Yet Updated Time-In"}
                      </p>
                      {isTimeInConfirmed && (
                        <p className="staff-dashboard-attendance-subtext">
                          Great! Your time-in has been successfully recorded.
                        </p>
                      )}
                    </div>
                  </div>
                  {!isTimeInConfirmed && (
                    <div className="staff-dashboard-attendance-reminder-button-container">
                      <button
                        className="staff-dashboard-attendance-button"
                        onClick={() => alert("This feature is currently under maintenance. Please check back later.")}
                      >
                        Update
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main appointment management layout */}
          <div className="staff-dashboard-appointment-layout">
            {/* Left side - Appointment List */}
            <div className="staff-dashboard-appointment-list-section">
              <div className="staff-dashboard-my-schedule-container">
                <div className="staff-dashboard-schedule-header">
                  <h3 className="staff-dashboard-schedule-title">
                    My Schedule
                    <>
                      <span 
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#00ff00',
                          borderRadius: '50%',
                          marginLeft: '8px',
                          animation: 'pulse 2s infinite'
                        }}
                        title="Real-time updates enabled"
                      />
                      <span 
                        style={{
                          marginLeft: '8px',
                          color: '#A0B2B8', // Glacial Indifference color
                          fontStyle: 'italic',
                          fontSize: '14px',
                          fontWeight: 'normal'
                        }}
                      >
                        Active Booking
                      </span>
                    </>
                  </h3>
                  <button
                    className="staff-dashboard-button-view-all-button-schedule"
                    onClick={() => navigate("/staff/schedule")}
                  >
                    View All
                  </button>
                </div>
                <div className="staff-dashboard-schedule-table-wrapper">
                  <table className="staff-dashboard-schedule-table">
                    <thead>
                      <tr className="staff-dashboard-table-header">
                        <th className="staff-dashboard-th">CUSTOMER NAME</th>
                        <th className="staff-dashboard-th">PHONE NUMBER</th>
                        <th className="staff-dashboard-th">SERVICE</th>
                        <th className="staff-dashboard-th">TIME</th>
                        <th className="staff-dashboard-th" style={{ textAlign: 'center' }}>ACTION</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loadingSchedule ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "white" }}>Loading...</td>
                        </tr>
                      ) : (
                        limitedSchedule.map((booking, index) => {
                          return (
                            <tr key={booking.id || index} className="flex-table-row">
                              <td className="staff-dashboard-table-cell" style={{ color: "white" }}>
                                {booking.customer_name}
                              </td>
                              <td className="staff-dashboard-table-cell" style={{ color: "white" }}>
                                {booking.phone_number}
                              </td>
                              <td className="staff-dashboard-table-cell" style={{ color: "white" }}>
                                {booking.service_name}
                              </td>
                              <td className="staff-dashboard-table-cell" style={{ color: "white" }}>
                                {booking.start_time !== "-" && booking.end_time !== "-" 
                                  ? `${booking.start_time} - ${booking.end_time}` 
                                  : "-"
                                }
                              </td>
                              <td className="staff-dashboard-table-cell" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                {(() => {
                                  let displayStatus = booking.status;
                                  let color = statusColorMap[displayStatus] || '#f44336';
                                  if (displayStatus === 'Confirmed') {
                                    return (
                                      <button
                                        className="done-btn"
                                        style={{
                                          backgroundColor: '#1976d2',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          padding: '6px 0',
                                          minWidth: '90px',
                                          maxWidth: '120px',
                                          fontWeight: 'bold',
                                          fontSize: '14px',
                                          fontFamily: 'Quicksand, sans-serif',
                                          cursor: 'pointer',
                                          boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)',
                                          letterSpacing: '0.5px',
                                          transition: 'background 0.2s',
                                          margin: '0 auto',
                                          display: 'block',
                                        }}
                                        onClick={() => checkPaymentConfirmation(booking.id)}
                                      >
                                        Done
                                      </button>
                                    );
                                  }
                                  return (
                                    <span
                                      className={`status-text ${displayStatus.toLowerCase()}`}
                                      style={{
                                        fontFamily: 'Quicksand, sans-serif',
                                        fontWeight: 'bold',
                                        fontSize: '16px',
                                        color,
                                        display: 'block',
                                        textAlign: 'center',
                                        textTransform: 'none', // Ensure original casing
                                      }}
                                    >
                                      {displayStatus}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Payment Management and Sales Report */}
              <div className="staff-dashboard-charts-container" style={{ marginTop: '20px' }}>
                <PaymentManagementTable />

                <div className="staff-dashboard-sales-report-container">
                  <BarberSalesReport />
                </div>
              </div>
            </div>

            {/* Right side - Booking Time Slot */}
            <div className="staff-dashboard-booking-slot-section" style={{ marginTop: '20px' }}>
              <div className="staff-dashboard-appointment-management-container">
                <h3 className="staff-dashboard-timeslots-title">
                  Appointment Management
                </h3>
                <p className="staff-dashboard-timeslots-subtitle">
                  View Time Slots Status
                </p>
                <div className="staff-dashboard-timeslots-grid">
                  {console.log("DEBUG: Data for slot grid (scheduleData):", scheduleData)}
                  {availableSlots.map((time) => {
                    const isBooked = scheduleData.some(booking => {
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
                      if (!startTime.isValid() || !endTime.isValid()) return false;
                      // Block slot if slotMoment >= startTime and slotMoment < endTime
                      return slotMoment.isSameOrAfter(startTime) && slotMoment.isBefore(endTime);
                    });
                    const isBlocked = blockedSlots.includes(time);
                    const isWithinHours = isWithinOperationalHours(time);
                    
                    const getButtonClass = () => {
                      if (isBooked) return 'staff-dashboard-booked';
                      if (!isWithinHours) return 'staff-dashboard-unavailable'; // Out of operational hours
                      if (isBlocked) return 'staff-dashboard-blocked';
                      return '';
                    };
                    
                    const isClickable = !isBooked && isWithinHours && !isBlocked;
                    
                    return (
                      <button
                        key={time}
                        onDoubleClick={() => {
                          if (isClickable) {
                            toggleSlotBlocking(time);
                          }
                        }}
                        className={`staff-dashboard-timeslot-button ${getButtonClass()}`}
                        disabled={!isClickable}
                        style={{
                          cursor: isClickable ? 'pointer' : 'not-allowed',
                          opacity: isBooked ? 0.6 : 1,
                          backgroundColor: !isWithinHours ? '#6c757d' : undefined, // Grey for out of hours
                          color: !isWithinHours ? 'white' : undefined
                        }}
                        title={!isWithinHours ? 'Outside operational hours' : isBooked ? 'Already booked' : isBlocked ? 'Blocked slot' : 'Double-click to block this slot'}
                      >
                        {time}
                      </button>
                    );
                  })}
                  <button
                    className="staff-dashboard-button-view-all-button-sales"
                    onClick={() => {
                      navigate("/staff/appointments");
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    View all
                  </button>
                </div>
              </div>
              
              {/* Today's Appointments by All Staff under Appointment Management */}
              <div className="staff-dashboard-todays-appointment-container" style={{ marginTop: '-10px', marginLeft: '0' }}>
                <div className="staff-dashboard-chart-header">
                  <h3 className="staff-dashboard-chart-title" style={{ whiteSpace: 'nowrap' }}>
                    Today's Appointments by All Staff
                  </h3>
                </div>
                {loadingBarChart ? (
                  <div className="staff-dashboard-chart-loading">
                    <div className="staff-dashboard-loading-spinner"></div>
                    <p className="staff-dashboard-no-appointments">
                      Loading chart data...
                    </p>
                  </div>
                ) : !barChartData.labels || barChartData.labels.length === 0 ? (
                  <div className="staff-dashboard-empty-state">
                    <div className="staff-dashboard-empty-icon">📊</div>
                    <p className="staff-dashboard-no-appointments">
                      No appointments scheduled for today
                    </p>
                    <p className="staff-dashboard-empty-subtext">
                      Check back later or view all appointments
                    </p>
                  </div>
                ) : (
                  <div className="staff-dashboard-chart-wrapper">
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
        blockedSlots={blockedSlots.map(time => ({ time, date: moment().format('YYYY-MM-DD') }))}
      />

      {/* Minimal Payment Confirmation Popup */}
      {showPaymentConfirmation && (
        <div className="payment-popup-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="payment-popup-container-minimal" style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            position: 'relative',
            zIndex: 10000
          }}>
            {/* Close button */}
            <button 
              className="payment-popup-close-minimal"
              onClick={() => {
                // Close popup without marking booking as done
                setShowPaymentConfirmation(false);
                setPaymentConfirmationData(null);
                // Note: Booking remains in its original state (not marked as done)
              }}
              aria-label="Close popup without completing booking"
              title="Close without completing booking"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              <i className="bi bi-x"></i>
            </button>
            
            {/* Header */}
            <div className="payment-popup-header-minimal" style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <i className="bi bi-credit-card payment-popup-icon-minimal" style={{
                fontSize: '32px',
                color: '#3b82f6',
                marginBottom: '10px'
              }}></i>
              <h3 className="payment-popup-title-minimal" style={{
                margin: '0',
                color: '#1a1a1a',
                fontSize: '18px'
              }}>Payment Confirmation</h3>
            </div>
            
            {/* Content */}
            <div className="payment-popup-content-minimal" style={{
              marginBottom: '20px'
            }}>
              <div className="payment-popup-info-minimal" style={{
                textAlign: 'center'
              }}>
                <p className="payment-popup-customer-minimal" style={{
                  fontSize: '16px',
                  margin: '0 0 5px 0'
                }}>
                  <strong>{paymentConfirmationData?.customerName || "Walk-in Customer"}</strong>
                </p>
                <p className="payment-popup-service-minimal" style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: '0 0 15px 0'
                }}>
                  {paymentConfirmationData?.serviceName || "Service"}
                </p>
                <p className="payment-popup-question-minimal" style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  margin: '15px 0 0 0'
                }}>
                  Has the customer paid?
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="payment-popup-actions-minimal" style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <button 
                className="payment-popup-btn-minimal payment-popup-paid-btn-minimal"
                onClick={() => handlePaymentPaid(paymentConfirmationData)}
                style={{
                  flex: '1',
                  padding: '12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <i className="bi bi-check-lg"></i> Yes, Paid
              </button>
              
              <button 
                className="payment-popup-btn-minimal payment-popup-pending-btn-minimal"
                onClick={() => handlePaymentUnpaid(paymentConfirmationData)}
                style={{
                  flex: '1',
                  padding: '12px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
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
