import React, { useState, useEffect, useCallback } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement } from "chart.js";
import api from "../../utils/api";
import moment from "moment";

// Register ArcElement needed for Pie chart
ChartJS.register(ArcElement);

const PIE_COLORS = [
  "#A8D8EA",
  "#B6E5F0",
  "#C7E9F4",
  "#D4F1F8",
  "#9FD3E7",
  "#8BCBDE",
  "#7BC4D6",
  "#6BB6CE",
  "#5BA8C6",
  "#4B9ABE",
  "#3B8CB6",
  "#2B7EAE",
  "#1B70A6",
  "#0B629E",
  "#005496",
];

const BarberSalesReport = () => {
  const [salesData, setSalesData] = useState({
    labels: [],
    data: [],
    totalSales: 0,
  });
  const [loadingSales, setLoadingSales] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchSalesData = useCallback(async () => {
    if (hasFetched) return;
    setLoadingSales(true);
    try {
      const response = await api.get("/bookings/sales-report", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("staff_token")}`,
        },
        params: { date: moment().format("YYYY-MM-DD") },
      });
      const responseData = response.data || {};
      setSalesData({
        labels: responseData.labels || [],
        data: responseData.data || [],
        totalSales: responseData.totalSales || 0,
      });
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setSalesData({ labels: [], data: [], totalSales: 0 });
    } finally {
      setLoadingSales(false);
      setHasFetched(true);
    }
  }, [hasFetched]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const chartData = {
    labels: salesData.labels || [],
    datasets: [
      {
        data: salesData.data || [],
        backgroundColor: (salesData.labels || []).map(
          (_, i) => PIE_COLORS[i % PIE_COLORS.length],
        ),
        borderWidth: 2,
        borderColor: "#1a1a1a",
        hoverBackgroundColor: (salesData.labels || []).map(
          (_, i) => PIE_COLORS[i % PIE_COLORS.length] + "CC",
        ),
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
        titleFont: { family: "Quicksand, sans-serif", size: 12, weight: "600" },
        bodyFont: { family: "Quicksand, sans-serif", size: 11 },
        callbacks: {
          label(context) {
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce(
              (sum, val) => sum + val,
              0,
            );
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
      datalabels: { display: false },
    },
    maintainAspectRatio: false,
    responsive: true,
    animation: { duration: 1000, easing: "easeInOutQuart" },
    onHover: (event, elements) => {
      event.native.target.style.cursor =
        elements.length > 0 ? "pointer" : "default";
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
          onClick={() =>
            alert(
              "This feature is currently under maintenance. Please check back later.",
            )
          }
        >
          View All
        </button>
      </div>

      <p className="staff-dashboard-sales-report-subtitle">
        Today's Sales{" "}
        {salesData.totalSales > 0 && `(Total: RM${salesData.totalSales})`}
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
          <Pie data={chartData} options={options} />
        )}
      </div>
    </div>
  );
};

export default BarberSalesReport;
