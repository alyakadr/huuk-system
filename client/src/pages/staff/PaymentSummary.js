import React, { useState, useEffect } from "react";
import api from "../../utils/api";

const PaymentSummary = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    paymentMethod: "all",
    paymentStatus: "all",
    dateRange: "7days",
  });

  useEffect(() => {
    fetchPayments();
  }, [filters]);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/bookings/manager/payments", {
        params: filters,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      setPayments(response.data.payments || []);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError("Failed to fetch payments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `RM ${parseFloat(amount).toFixed(2)}`;
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "failed":
        return "#ef4444";
      case "refunded":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case "stripe":
      case "online payment":
        return "bi-credit-card";
      case "pay at outlet":
        return "bi-cash";
      case "fpx":
        return "bi-bank";
      default:
        return "bi-question-circle";
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
    }));
  };

  const totalAmount = payments.reduce((sum, payment) => {
    return (
      sum + (payment.payment_status === "Paid" ? parseFloat(payment.amount) : 0)
    );
  }, 0);

  const onlinePayments = payments.filter(
    (p) =>
      p.payment_method === "Stripe" ||
      p.payment_method === "Online Payment" ||
      p.payment_method === "FPX",
  );

  const outletPayments = payments.filter(
    (p) => p.payment_method === "Pay at Outlet",
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center text-white">
          <div className="w-10 h-10 border-4 border-white/20 border-t-huuk-blue rounded-full animate-spin mb-3"></div>
          <p>Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full text-white font-quicksand space-y-4"
      style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}
    >
      <div className="card-dark rounded-huuk-lg">
        <h1 className="text-2xl font-bold">Payment Management</h1>
        <p className="text-sm text-huuk-muted mt-1">
          Monitor and manage all payment transactions
        </p>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded-huuk-sm flex items-center gap-2">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="card-dark rounded-huuk-lg flex items-center gap-3">
          <i className="bi bi-cash-stack"></i>
          <div>
            <h4 className="text-sm font-semibold">Total Revenue</h4>
            <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <div className="card-dark rounded-huuk-lg flex items-center gap-3">
          <i className="bi bi-credit-card"></i>
          <div>
            <h4 className="text-sm font-semibold">Online Payments</h4>
            <p className="text-lg font-bold">{onlinePayments.length}</p>
          </div>
        </div>
        <div className="card-dark rounded-huuk-lg flex items-center gap-3">
          <i className="bi bi-shop"></i>
          <div>
            <h4 className="text-sm font-semibold">Outlet Payments</h4>
            <p className="text-lg font-bold">{outletPayments.length}</p>
          </div>
        </div>
        <div className="card-dark rounded-huuk-lg flex items-center gap-3">
          <i className="bi bi-receipt"></i>
          <div>
            <h4 className="text-sm font-semibold">Total Transactions</h4>
            <p className="text-lg font-bold">{payments.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-dark rounded-huuk-lg grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">Payment Method:</label>
          <select
            className="bg-white/10 border border-white/20 rounded-huuk-sm px-3 py-2 text-sm text-white"
            value={filters.paymentMethod}
            onChange={(e) =>
              handleFilterChange("paymentMethod", e.target.value)
            }
          >
            <option value="all">All Methods</option>
            <option value="Stripe">Online Payment</option>
            <option value="FPX">Online Payment</option>
            <option value="Pay at Outlet">Pay at Outlet</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">Payment Status:</label>
          <select
            className="bg-white/10 border border-white/20 rounded-huuk-sm px-3 py-2 text-sm text-white"
            value={filters.paymentStatus}
            onChange={(e) =>
              handleFilterChange("paymentStatus", e.target.value)
            }
          >
            <option value="all">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">Date Range:</label>
          <select
            className="bg-white/10 border border-white/20 rounded-huuk-sm px-3 py-2 text-sm text-white"
            value={filters.dateRange}
            onChange={(e) => handleFilterChange("dateRange", e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card-dark rounded-huuk-lg overflow-x-auto">
        <table className="huuk-table">
          <thead>
            <tr>
              <th className="huuk-th">Booking ID</th>
              <th className="huuk-th">Customer</th>
              <th className="huuk-th">Service</th>
              <th className="huuk-th">Amount</th>
              <th className="huuk-th">Payment Method</th>
              <th className="huuk-th">Status</th>
              <th className="huuk-th">Date</th>
              <th className="huuk-th">Staff</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan="8" className="huuk-td text-center py-8">
                  <i className="bi bi-receipt"></i>
                  No payments found for the selected criteria.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr
                  key={payment.booking_id}
                  className="huuk-tr border-b border-white/10"
                >
                  <td className="huuk-td">
                    #{String(payment.booking_id).padStart(7, "0")}
                  </td>
                  <td className="huuk-td">
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {payment.customer_name}
                      </span>
                      <span className="text-xs text-huuk-muted">
                        {payment.phone_number}
                      </span>
                    </div>
                  </td>
                  <td className="huuk-td">{payment.service_name}</td>
                  <td className="huuk-td">
                    <span className="font-semibold">
                      {formatCurrency(payment.amount)}
                    </span>
                  </td>
                  <td className="huuk-td">
                    <div className="flex items-center gap-2">
                      <i
                        className={`bi ${getPaymentMethodIcon(payment.payment_method)}`}
                      ></i>
                      <span>{payment.payment_method}</span>
                    </div>
                  </td>
                  <td className="huuk-td">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                      style={{
                        backgroundColor: getPaymentStatusColor(
                          payment.payment_status,
                        ),
                      }}
                    >
                      {payment.payment_status}
                    </span>
                  </td>
                  <td className="huuk-td">
                    {formatDate(payment.booking_date)}
                  </td>
                  <td className="huuk-td">{payment.staff_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentSummary;
