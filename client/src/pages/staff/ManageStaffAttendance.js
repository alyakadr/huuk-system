import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api"; // Updated import
import moment from "moment";

const ManageStaffAttendance = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);

  const [outlet, setOutlet] = useState("");
  const [date, setDate] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = JSON.parse(localStorage.getItem("loggedInUser"))?.role;
    if (!token || role !== "manager") {
      setError("Please log in as a manager to view attendance.");
      navigate("/login?loginRequired=true");
      return;
    }

    api
      .get("/users/outlets")
      .then((response) => {
        setOutlets(response.data.outlets || []);
      })
      .catch((error) => {
        console.error("Error fetching outlets:", error.response || error);
        setError("Failed to load outlets.");
      });
  }, [navigate]);

  useEffect(() => {
    if (outlet && date) {
      fetchAttendanceData();
    }
  }, [outlet, date, pagination.page]);

  const fetchAttendanceData = () => {
    if (!outlet || !date) return;
    setIsLoading(true);
    console.log("Fetching attendance with params:", {
      outlet,
      date,
      page: pagination.page,
    });

    api
      .get("/users/attendance", {
        params: { outlet, date, page: pagination.page },
      })
      .then((response) => {
        console.log("Attendance fetch response:", response.data);
        setAttendanceData(response.data.attendance || []);
        setPagination({
          page: response.data.page,
          totalPages: response.data.totalPages,
        });
        setError(null);
      })
      .catch((error) => {
        console.error("Error fetching attendance:", error.response || error);
        if (error.response?.status === 401) {
          setError("Session expired. Please log in again.");
          localStorage.clear();
          navigate("/login?loginRequired=true");
        } else {
          setError(
            error.response?.data?.message || "Failed to load attendance data."
          );
        }
      })
      .finally(() => setIsLoading(false));
  };

  const handleOutletChange = (event) => {
    setOutlet(event.target.value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleDateChange = (event) => {
    setDate(event.target.value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const getRemarksDisplay = (data) => {
    if (!data.time_in) {
      const attendanceDate = moment(data.date).format("YYYY-MM-DD");
      const dateThreshold = moment(attendanceDate).add(3, "days");
      if (moment().isAfter(dateThreshold)) {
        return "Absent without notice";
      }
      return "--:--";
    }
    return data.remarks || "--:--";
  };

  const getDocumentDisplay = (data) => {
    if (data.document_path) {
      return (
        <a
          href={`http://localhost:5000${data.document_path}`}
          className="text-huuk-blue underline hover:opacity-80"
          download
          title="Click to download document"
        >
          View Document
        </a>
      );
    }
    return "-";
  };

  return (
    <div className="card-dark rounded-huuk-lg min-h-[60vh]">
      <h1 className="text-2xl font-bold mb-4">Manage Staff Attendance</h1>
      {isLoading && <p className="text-huuk-muted">Loading...</p>}
      {error && <p className="text-red-400">{error}</p>}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm font-semibold">Outlet:</label>
        <select value={outlet} onChange={handleOutletChange} className="bg-white/10 border border-white/20 rounded-huuk-sm px-3 py-2 text-sm text-white">
          <option value="">Select Outlet</option>
          {outlets.map((outletOption) => (
            <option key={outletOption} value={outletOption}>
              {outletOption}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm font-semibold">Date:</label>
        <input
          type="date"
          value={date}
          onChange={handleDateChange}
          max={moment().format("YYYY-MM-DD")}
          className="bg-white/10 border border-white/20 rounded-huuk-sm px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <h2 className="text-lg font-bold mb-2">Staff Attendance Records</h2>
        {!outlet || !date ? (
          <p className="text-huuk-muted">-SELECT OUTLET FIRST-</p>
        ) : attendanceData.length === 0 && !isLoading ? (
          <p className="text-huuk-muted">No attendance records found.</p>
        ) : (
          <table className="huuk-table">
            <thead>
              <tr>
                <th className="huuk-th">Staff Name</th>
                <th className="huuk-th">Time In</th>
                <th className="huuk-th">Time Out</th>
                <th className="huuk-th">Remarks</th>
                <th className="huuk-th">Document</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((data, index) => (
                <tr key={index} className="huuk-tr border-b border-white/10">
                  <td className="huuk-td">{data.fullname}</td>
                  <td className="huuk-td">
                    {data.time_in
                      ? moment(data.time_in).format("HH:mm")
                      : "--:--"}
                  </td>
                  <td className="huuk-td">
                    {data.time_out
                      ? moment(data.time_out).format("HH:mm")
                      : "--:--"}
                  </td>
                  <td className="huuk-td">{getRemarksDisplay(data)}</td>
                  <td className="huuk-td">{getDocumentDisplay(data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {attendanceData.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            disabled={pagination.page === 1 || isLoading}
            onClick={() => handlePageChange(pagination.page - 1)}
            className="px-3 py-1 rounded-huuk-sm bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-huuk-muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page === pagination.totalPages || isLoading}
            onClick={() => handlePageChange(pagination.page + 1)}
            className="px-3 py-1 rounded-huuk-sm bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ManageStaffAttendance;
