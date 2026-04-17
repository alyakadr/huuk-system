import React, { useState, useEffect, useCallback } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement } from "chart.js";
import api from "../../utils/api";
import moment from "moment";

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
          (_, index) => PIE_COLORS[index % PIE_COLORS.length],
        ),
        borderWidth: 2,
        borderColor: "#1a1a1a",
        hoverBackgroundColor: (salesData.labels || []).map(
          (_, index) => PIE_COLORS[index % PIE_COLORS.length] + "CC",
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
          padding: 14,
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
              (sum, currentValue) => sum + currentValue,
              0,
            );
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
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
      event.native.target.style.cursor = elements.length > 0 ? "pointer" : "default";
    },
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-bold text-white">Sales Report</h3>
          <p className="m-0 mt-1 text-sm text-white/80">
            Today's Sales {salesData.totalSales > 0 && `(Total: RM${salesData.totalSales})`}
          </p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={() =>
            alert(
              "This feature is currently under maintenance. Please check back later.",
            )
          }
        >
          View All
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-start">
        {loadingSales ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
            <p className="m-0 mt-3 text-sm text-huuk-muted">Loading sales data...</p>
          </div>
        ) : !salesData.labels || salesData.labels.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-2xl">📊</div>
            <p className="m-0 mt-2 text-sm text-white">No sales data available</p>
            <p className="m-0 mt-1 text-xs text-huuk-muted">
              Sales data will appear here once services are completed
            </p>
          </div>
        ) : (
          <div className="h-[180px] w-full shrink-0">
            <Pie data={chartData} options={options} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BarberSalesReport;
