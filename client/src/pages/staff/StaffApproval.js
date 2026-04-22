import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import http from "../../utils/httpClient";
import { OUTLET_SHORTCUTS_TITLE } from "../../constants/outlets";

const ITEMS_PER_PAGE = 7;

// Small inline check-circle icon (filled green).
const CheckCircleIcon = () => (
  <span
    className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white"
    aria-hidden="true"
  >
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2.5 6.5 5 9 9.5 3.5" />
    </svg>
  </span>
);

// Small inline x-circle icon (filled red).
const XCircleIcon = () => (
  <span
    className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white"
    aria-hidden="true"
  >
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="3" x2="9" y2="9" />
      <line x1="9" y1="3" x2="3" y2="9" />
    </svg>
  </span>
);

const StaffApproval = () => {
  const navigate = useNavigate();
  const [allApprovals, setAllApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  const outletShortforms = OUTLET_SHORTCUTS_TITLE;

  // Role / token gate
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
        setAllApprovals(Array.isArray(res.data) ? res.data : []);
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

  // Close dropdown on outside click
  useEffect(() => {
    if (openDropdown === null) return;
    const handleClickAway = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener("mousedown", handleClickAway);
    return () => window.removeEventListener("mousedown", handleClickAway);
  }, [openDropdown]);

  const toggleDropdown = (staffId) => {
    setOpenDropdown((prev) => (prev === staffId ? null : staffId));
  };

  const handleStatusChange = (staffId, newStatus) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No authentication token found. Please log in.");
      navigate("/login");
      return;
    }

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

  // Pending first, then newest first
  const sortedApprovals = useMemo(() => {
    return [...allApprovals].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [allApprovals]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedApprovals.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedApprovals.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, sortedApprovals]);

  const formatDateTime = (value) => {
    if (!value) return "(No date)";
    const m = moment(value);
    if (!m.isValid()) return "(Invalid date)";
    return m.format("D MMMM YYYY, HH:mm");
  };

  const getOutletCode = (outletValue) => {
    if (!outletValue) return "--";
    return (
      outletShortforms[outletValue] ||
      outletShortforms[
        Object.keys(outletShortforms).find(
          (key) => key.toLowerCase() === String(outletValue).toLowerCase(),
        )
      ] ||
      outletValue
    );
  };

  return (
    <div
      className="relative w-full pb-3 pl-0 pr-1 pt-3 font-quicksand text-white"
      style={{
        marginLeft: "3px",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div className="relative rounded-[18px] bg-[#171717] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="m-0 text-[13px]">Loading approvals...</p>
          </div>
        ) : error ? (
          <div className="rounded-[10px] border border-red-500 bg-red-600/20 px-4 py-3 text-red-300">
            <p className="m-0 text-[13px]">
              <i className="bi bi-exclamation-triangle-fill mr-1" />
              {error}
            </p>
          </div>
        ) : (
          <>
            {successMessage && (
              <div className="mb-3 rounded-[10px] border border-green-500/40 bg-green-500/15 px-4 py-2 text-[13px] font-semibold text-green-300">
                {successMessage}
              </div>
            )}

            {sortedApprovals.length === 0 ? (
              <div className="px-3 py-10 text-center text-[14px] text-white/70">
                No approval records.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-left">
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                    </colgroup>
                    <thead>
                      <tr className="text-[12px] font-extrabold uppercase tracking-[1px] text-white/90">
                        <th className="border-b border-white/15 px-3 py-3 text-left">
                          Name
                        </th>
                        <th className="border-b border-white/15 px-3 py-3 text-left">
                          Email
                        </th>
                        <th className="border-b border-white/15 px-3 py-3 text-left">
                          Outlet
                        </th>
                        <th className="border-b border-white/15 px-3 py-3 text-left">
                          Date/Time
                        </th>
                        <th className="border-b border-white/15 px-3 py-3 text-center">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => {
                        const staff = currentItems[i];
                        if (!staff) {
                          return (
                            <tr
                              key={`empty-row-${i}`}
                              className="text-[14px] text-white"
                            >
                              <td className="px-3 py-2" style={{ height: 48 }} />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                            </tr>
                          );
                        }

                        const displayUsername =
                          staff.username || staff.name || "(No username)";
                        const fullName =
                          staff.fullname ||
                          staff.full_name ||
                          staff.name ||
                          staff.username ||
                          "";

                        return (
                          <tr
                            key={staff.id ?? staff.email ?? i}
                            className="text-[14px] text-white"
                          >
                            <td className="px-3 py-2 text-left font-bold">
                              <span className="group relative inline-block">
                                <span className="cursor-default underline decoration-white/70 decoration-[1.5px] underline-offset-[3px]">
                                  {displayUsername}
                                </span>
                                {fullName && fullName !== displayUsername && (
                                  <span
                                    role="tooltip"
                                    className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 whitespace-nowrap rounded-md bg-[#5a5b60] px-3 py-1 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                                  >
                                    {fullName}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-left font-semibold text-white/95">
                              <span className="block truncate">
                                {staff.email || "--"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-left font-bold uppercase tracking-[0.5px]">
                              {getOutletCode(staff.outlet)}
                            </td>
                            <td className="px-3 py-2 text-left font-semibold">
                              {formatDateTime(staff.createdAt)}
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <div className="flex items-center justify-center">
                                {staff.status === "pending" ? (
                                  <div
                                    className="relative inline-block"
                                    ref={
                                      openDropdown === staff.id
                                        ? dropdownRef
                                        : null
                                    }
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleDropdown(staff.id)}
                                      className="flex h-[30px] w-[150px] items-center justify-center gap-2 rounded-[6px] bg-[#0f0f0f] px-3 text-[12px] font-bold uppercase tracking-[1px] text-white transition-colors hover:bg-[#1d1d1d]"
                                    >
                                      <span>Pending</span>
                                      <span className="text-[10px] leading-none">
                                        {openDropdown === staff.id ? "▲" : "▼"}
                                      </span>
                                    </button>
                                    {openDropdown === staff.id && (
                                      <div className="absolute left-0 top-full z-20 mt-1 w-[150px] overflow-hidden rounded-[6px] bg-[#0f0f0f] shadow-[0_10px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleStatusChange(
                                              staff.id,
                                              "approved",
                                            )
                                          }
                                          className="block w-full border-0 bg-transparent px-3 py-1.5 text-center text-[12px] font-bold uppercase tracking-[1px] text-white hover:bg-white/15"
                                        >
                                          Approved
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleStatusChange(
                                              staff.id,
                                              "rejected",
                                            )
                                          }
                                          className="block w-full border-0 bg-transparent px-3 py-1.5 text-center text-[12px] font-bold uppercase tracking-[1px] text-white hover:bg-white/15"
                                        >
                                          Rejected
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : staff.status === "approved" ? (
                                  <span className="flex h-[30px] w-[150px] items-center justify-center rounded-[6px] bg-[#0f0f0f] px-3 text-[12px] font-bold uppercase tracking-[1px] text-white">
                                    Approved
                                    <CheckCircleIcon />
                                  </span>
                                ) : (
                                  <span className="flex h-[30px] w-[150px] items-center justify-center rounded-[6px] bg-[#0f0f0f] px-3 text-[12px] font-bold uppercase tracking-[1px] text-white">
                                    Rejected
                                    <XCircleIcon />
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="min-w-[80px] rounded-md border border-white/15 bg-transparent px-4 py-1.5 text-[14px] font-bold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Prev
                  </button>

                  <span className="min-w-[48px] text-center text-[15px] font-bold text-white">
                    {currentPage}/{totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(totalPages, prev + 1),
                      )
                    }
                    disabled={currentPage === totalPages}
                    className="min-w-[80px] rounded-md border border-white/15 bg-transparent px-4 py-1.5 text-[14px] font-bold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
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
