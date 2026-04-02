import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../utils/httpClient";
import "../../styles/staffApproval.css";
import { OUTLET_SHORTCUTS_TITLE } from "../../constants/outlets";

const StaffApproval = () => {
  const navigate = useNavigate();
  const [allApprovals, setAllApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const itemsPerPage = 7;

  const outletShortforms = OUTLET_SHORTCUTS_TITLE;

  // Check user role and token
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("loggedInUser");

    if (!token || !storedUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(storedUser);
    if (user.role !== "manager") {
      navigate("/staff");
    }
  }, [navigate]);

  // Fetch all approvals
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No authentication token found. Please log in.");
      setIsLoading(false);
      navigate("/login");
      return;
    }

    http
      .get("http://localhost:5000/api/users/all-approvals", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        console.log("API response:", res.data); // Debug response
        setAllApprovals(res.data);
        setIsLoading(false);
      })
      .catch((err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || err.message;
        setError(
          `Failed to fetch data: ${message} (Status: ${status || "N/A"})`,
        );
        setIsLoading(false);
        if (status === 401) {
          navigate("/login");
        }
      });
  }, [navigate]);

  // Handle dropdown toggle
  const toggleDropdown = (staffId) => {
    setOpenDropdown(openDropdown === staffId ? null : staffId);
  };

  // Handle status change
  const handleStatusChange = (staffId, newStatus) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No authentication token found. Please log in.");
      navigate("/login");
      return;
    }

    // Close dropdown after selection
    setOpenDropdown(null);

    http
      .post(
        `http://localhost:5000/api/users/update-status/${staffId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then(() => {
        setAllApprovals((prev) =>
          prev.map((s) => (s.id === staffId ? { ...s, status: newStatus } : s)),
        );
        setSuccessMessage(`Staff ${newStatus} successfully!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch((err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || err.message;
        setError(
          `Failed to update status: ${message} (Status: ${status || "N/A"})`,
        );
        if (status === 401) {
          navigate("/login");
        }
      });
  };

  // Sort and paginate data
  const sortedApprovals = [...allApprovals].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const totalPages = Math.ceil(sortedApprovals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = sortedApprovals.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="layout-container">
      <div className="staff-approval-container">
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : (
          <>
            {successMessage && (
              <p style={{ color: "green", fontWeight: "bold" }}>
                {successMessage}
              </p>
            )}
            {sortedApprovals.length === 0 ? (
              <p>No approval records.</p>
            ) : (
              <>
                <table className="staff-approval-table">
                  <thead>
                    <tr>
                      <th style={{ PaddingLeft: "20px" }}>Name</th>
                      <th>Email</th>
                      <th>Outlet</th>
                      <th>Date/Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((staff, index) => (
                      <tr key={staff.id ?? staff.email ?? index}>
                        <td>{staff.username || "(No username)"}</td>
                        <td>{staff.email}</td>
                        <td>
                          {outletShortforms[staff.outlet] ||
                            staff.outlet ||
                            "(No outlet)"}
                        </td>
                        <td>
                          {staff.createdAt
                            ? new Date(staff.createdAt).toLocaleString()
                            : "(No date)"}
                        </td>
                        <td className="status-cell">
                          {staff.status === "pending" ? (
                            <div className="dropdown">
                              <button
                                className="dropdown-toggle"
                                onClick={() => toggleDropdown(staff.id)}
                              >
                                PENDING <span className="triangle">▼</span>
                              </button>
                              {openDropdown === staff.id && (
                                <div className="dropdown-menu">
                                  <button
                                    onClick={() =>
                                      handleStatusChange(staff.id, "approved")
                                    }
                                  >
                                    APPROVE
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleStatusChange(staff.id, "rejected")
                                    }
                                  >
                                    REJECT
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              className={`status-indicator ${
                                staff.status === "approved"
                                  ? "approved"
                                  : "rejected"
                              }`}
                            >
                              {staff.status === "approved" ? (
                                <span className="status-approved">
                                  APPROVED
                                  <img
                                    src="/tick-transparent.png"
                                    alt="Approved icon"
                                    className="icon-right"
                                  />
                                </span>
                              ) : (
                                <span className="status-rejected">
                                  REJECTED
                                  <img
                                    src="/x-transparent.png"
                                    alt="Rejected icon"
                                    className="icon-right"
                                  />
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                  >
                    Prev
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default StaffApproval;



