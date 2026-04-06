import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../utils/httpClient";
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
    <div className="flex flex-col items-start w-full p-1 box-border font-quicksand">
      <div className="p-2 max-w-full w-full ml-0 bg-huuk-card text-white rounded-huuk-md h-[calc(100vh-30px)] overflow-hidden flex flex-col">
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <>
            {successMessage && (
              <p className="text-green-400 font-bold">{successMessage}</p>
            )}
            {sortedApprovals.length === 0 ? (
              <p>No approval records.</p>
            ) : (
              <>
                <table className="w-full border-collapse table-fixed flex-grow mb-1">
                  <thead>
                    <tr>
                      <th
                        className="px-2 py-1 text-center font-extrabold uppercase border-b-2 border-[#1f1e1e]"
                        style={{ PaddingLeft: "20px" }}
                      >
                        Name
                      </th>
                      <th className="px-2 py-1 text-center font-extrabold uppercase border-b-2 border-[#1f1e1e]">
                        Email
                      </th>
                      <th className="px-2 py-1 text-center font-extrabold uppercase border-b-2 border-[#1f1e1e]">
                        Outlet
                      </th>
                      <th className="px-2 py-1 text-center font-extrabold uppercase border-b-2 border-[#1f1e1e]">
                        Date/Time
                      </th>
                      <th className="px-2 py-1 text-center font-extrabold uppercase border-b-2 border-[#1f1e1e]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((staff, index) => (
                      <tr key={staff.id ?? staff.email ?? index}>
                        <td className="px-2 py-1 text-center font-extrabold overflow-hidden">
                          {staff.username || "(No username)"}
                        </td>
                        <td className="px-2 py-1 text-center font-extrabold overflow-hidden">
                          {staff.email}
                        </td>
                        <td className="px-2 py-1 text-center font-extrabold overflow-hidden">
                          {outletShortforms[staff.outlet] ||
                            staff.outlet ||
                            "(No outlet)"}
                        </td>
                        <td className="px-2 py-1 text-center font-extrabold overflow-hidden">
                          {staff.createdAt
                            ? new Date(staff.createdAt).toLocaleString()
                            : "(No date)"}
                        </td>
                        <td className="relative flex justify-center items-center px-2 py-1">
                          {staff.status === "pending" ? (
                            <div className="relative inline-block">
                              <button
                                className="bg-huuk-bg px-2.5 py-1.5 rounded-huuk-sm text-white cursor-pointer text-sm w-[140px] mx-auto"
                                onClick={() => toggleDropdown(staff.id)}
                              >
                                PENDING <span className="triangle">▼</span>
                              </button>
                              {openDropdown === staff.id && (
                                <div className="block absolute bg-huuk-bg px-2 py-1.5 rounded-huuk-sm z-10 min-w-[100px] w-[140px] text-center top-full left-0 mt-0">
                                  <button
                                    className="block w-full px-3 py-1.5 border-none bg-transparent text-center cursor-pointer text-white hover:bg-white/20"
                                    onClick={() =>
                                      handleStatusChange(staff.id, "approved")
                                    }
                                  >
                                    APPROVE
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 border-none bg-transparent text-center cursor-pointer text-white hover:bg-white/20"
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
                                <span className="text-white bg-huuk-bg px-2.5 py-1.5 rounded-huuk-sm flex items-center justify-center gap-2 text-sm w-[140px] text-center mx-auto">
                                  APPROVED
                                  <img
                                    src="/tick-transparent.png"
                                    alt="Approved icon"
                                    className="inline-block ml-2 w-4 h-4 align-middle"
                                  />
                                </span>
                              ) : (
                                <span className="text-white bg-huuk-bg px-2.5 py-1.5 rounded-huuk-sm flex items-center justify-center gap-2 text-sm w-[140px] text-center mx-auto">
                                  REJECTED
                                  <img
                                    src="/x-transparent.png"
                                    alt="Rejected icon"
                                    className="inline-block ml-2 w-4 h-4 align-middle"
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
                <div className="mt-0 flex gap-2 items-center justify-center font-quicksand font-extrabold py-1 shrink-0">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    className="px-3 py-1.5 bg-white/30 cursor-pointer text-sm font-bold disabled:bg-huuk-card disabled:cursor-not-allowed disabled:text-white"
                  >
                    Prev
                  </button>
                  <span className="px-1.5">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    className="px-3 py-1.5 bg-white/30 cursor-pointer text-sm font-bold disabled:bg-huuk-card disabled:cursor-not-allowed disabled:text-white"
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
