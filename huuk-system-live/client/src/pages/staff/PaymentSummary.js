import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const PaymentSummary = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    paymentMethod: 'all',
    paymentStatus: 'all',
    dateRange: '7days'
  });

  useEffect(() => {
    fetchPayments();
  }, [filters]);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/bookings/manager/payments', {
        params: filters,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setPayments(response.data.payments || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Failed to fetch payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `RM ${parseFloat(amount).toFixed(2)}`;
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      case 'refunded': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'stripe':
      case 'online payment':
        return 'bi-credit-card';
      case 'pay at outlet':
        return 'bi-cash';
      case 'fpx':
        return 'bi-bank';
      default:
        return 'bi-question-circle';
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const totalAmount = payments.reduce((sum, payment) => {
    return sum + (payment.payment_status === 'Paid' ? parseFloat(payment.amount) : 0);
  }, 0);

  const onlinePayments = payments.filter(p => 
    p.payment_method === 'Stripe' || 
    p.payment_method === 'Online Payment' ||
    p.payment_method === 'FPX'
  );

  const outletPayments = payments.filter(p => p.payment_method === 'Pay at Outlet');

  if (loading) {
    return (
      <div className="payment-summary-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-summary-container">
      <div className="payment-header">
        <h1>Payment Management</h1>
        <p>Monitor and manage all payment transactions</p>
      </div>

      {error && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="payment-summary-cards">
        <div className="summary-card">
          <i className="bi bi-cash-stack"></i>
          <div>
            <h4>Total Revenue</h4>
            <p>{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <div className="summary-card">
          <i className="bi bi-credit-card"></i>
          <div>
            <h4>Online Payments</h4>
            <p>{onlinePayments.length}</p>
          </div>
        </div>
        <div className="summary-card">
          <i className="bi bi-shop"></i>
          <div>
            <h4>Outlet Payments</h4>
            <p>{outletPayments.length}</p>
          </div>
        </div>
        <div className="summary-card">
          <i className="bi bi-receipt"></i>
          <div>
            <h4>Total Transactions</h4>
            <p>{payments.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="payment-filters">
        <div className="filter-group">
          <label>Payment Method:</label>
          <select 
            value={filters.paymentMethod} 
            onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
          >
            <option value="all">All Methods</option>
            <option value="Stripe">Online Payment</option>
            <option value="FPX">FPX</option>
            <option value="Pay at Outlet">Pay at Outlet</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Payment Status:</label>
          <select 
            value={filters.paymentStatus} 
            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Date Range:</label>
          <select 
            value={filters.dateRange} 
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="payments-table-container">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Amount</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Date</th>
              <th>Staff</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-payments">
                  <i className="bi bi-receipt"></i>
                  No payments found for the selected criteria.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.booking_id} className="payment-row">
                  <td className="booking-id-cell">
                    #{String(payment.booking_id).padStart(7, '0')}
                  </td>
                  <td className="customer-cell">
                    <div className="customer-info">
                      <span className="customer-name">{payment.customer_name}</span>
                      <span className="customer-phone">{payment.phone_number}</span>
                    </div>
                  </td>
                  <td className="service-cell">{payment.service_name}</td>
                  <td className="amount-cell">
                    <span className="amount">{formatCurrency(payment.amount)}</span>
                  </td>
                  <td className="payment-method-cell">
                    <div className="payment-method">
                      <i className={`bi ${getPaymentMethodIcon(payment.payment_method)}`}></i>
                      <span>{payment.payment_method}</span>
                    </div>
                  </td>
                  <td className="status-cell">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getPaymentStatusColor(payment.payment_status) }}
                    >
                      {payment.payment_status}
                    </span>
                  </td>
                  <td className="date-cell">{formatDate(payment.booking_date)}</td>
                  <td className="staff-cell">{payment.staff_name}</td>
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
