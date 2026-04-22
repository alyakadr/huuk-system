import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import api from "../../utils/api";
import { OUTLET_NAMES_TITLE } from "../../constants/outlets";

const ITEMS_PER_PAGE = 6;

// Categories staff can choose from when submitting a leave/remark.
// The "None" option maps to rows without a remark (e.g. normal on-duty).
const REMARK_CATEGORIES = [
  "Emergency Leave",
  "Medical Leave",
  "Absent with Permission",
  "Absent without Notice",
  "Half-day",
];

const FILTER_OPTIONS = ["All", ...REMARK_CATEGORIES, "None"];

// Hardcoded fallback so the layout renders cleanly without requiring a
// live API. Swap / extend freely — the component will prefer server data
// whenever the outlet+date lookup succeeds.
// Remarks use a structured shape:
//   { category, reason?, attachment?, submittedAt?, approvalStatus }
// - category: one of REMARK_CATEGORIES
// - reason: optional free-text note (staff can leave it blank when applying)
// - attachment: optional file reference shown in the modal
// - approvalStatus: "pending" | "approved" | "rejected"
const SAMPLE_ATTENDANCE = [
  {
    id: "sample-1",
    fullname: "Addy",
    outlet: "Setia City Mall",
    time_in: "09:45",
    time_out: null,
    remarks: {
      category: "Medical Leave",
      reason:
        "MC submitted — 3-day medical cert from Klinik Mediviron. Will resume duty on Monday. Manager notified in writing on WhatsApp. Replacement shift confirmed with Fiza for Sat/Sun. Kindly file under sick leave, not no-pay.",
      attachment: {
        name: "medical_cert_addy.pdf",
        url: "#",
        type: "pdf",
      },
      submittedAt: "2026-04-22 09:12",
      approvalStatus: "approved",
    },
  },
  {
    id: "sample-2",
    fullname: "Chunkz",
    outlet: "Setia City Mall",
    time_in: "10:01",
    time_out: "15:30",
    remarks: {
      category: "Half-day",
      reason:
        "Left early for dental appointment at 15:45. Manager approved verbally at 14:30.",
      attachment: null,
      submittedAt: "2026-04-22 14:30",
      approvalStatus: "approved",
    },
  },
  {
    id: "sample-3",
    fullname: "Danial",
    outlet: "Setia City Mall",
    time_in: null,
    time_out: null,
    remarks: {
      category: "Absent with Permission",
      reason:
        "Attending sibling's wedding in Johor Bahru. Leave request submitted 2 weeks in advance and approved by HR.",
      attachment: {
        name: "leave_form_danial.pdf",
        url: "#",
        type: "pdf",
      },
      submittedAt: "2026-04-08 17:45",
      approvalStatus: "pending",
    },
  },
  {
    id: "sample-4",
    fullname: "Haziq",
    outlet: "Setia City Mall",
    time_in: "09:57",
    time_out: null,
    remarks: null,
  },
  {
    id: "sample-5",
    fullname: "Irfan",
    outlet: "Setia City Mall",
    time_in: "09:50",
    time_out: null,
    remarks: null,
  },
  {
    id: "sample-6",
    fullname: "Jordan",
    outlet: "Setia City Mall",
    time_in: "10:12",
    time_out: "16:00",
    remarks: {
      category: "Half-day",
      reason: "Personal errand in the afternoon; informed manager in person.",
      attachment: null,
      submittedAt: "2026-04-22 15:55",
      approvalStatus: "pending",
    },
  },
  {
    id: "sample-7",
    fullname: "Kai",
    outlet: "Setia City Mall",
    time_in: null,
    time_out: null,
    remarks: {
      category: "Medical Leave",
      reason:
        "Food poisoning — visited Klinik 24 Jam, advised 1-day rest. MC attached.",
      attachment: {
        name: "mc_kai.jpg",
        url: "#",
        type: "image",
      },
      submittedAt: "2026-04-22 07:40",
      approvalStatus: "pending",
    },
  },
  {
    id: "sample-8",
    fullname: "Luqman",
    outlet: "Setia City Mall",
    time_in: "09:32",
    time_out: null,
    remarks: null,
  },
];

// Normalise remark data (strings are accepted for backward compat).
const normaliseRemarks = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return {
      category: trimmed,
      reason: "",
      attachment: null,
      approvalStatus: "pending",
    };
  }
  if (typeof value === "object" && value.category) {
    return {
      category: value.category,
      reason: value.reason || "",
      attachment: value.attachment || null,
      submittedAt: value.submittedAt || null,
      approvalStatus: value.approvalStatus || "pending",
    };
  }
  return null;
};

const formatTime = (value) => {
  if (!value) return "--:--";
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) return value;
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format("HH:mm") : "--:--";
};

const deriveStatus = (row) => {
  if (row.time_in && !row.time_out) return "On Duty";
  if (row.time_in && row.time_out) return "Off Duty";
  return "Off Duty";
};

// Returns hours worked as a `5.25h` style string, or `--` when we cannot
// compute (no time_in, no time_out, or invalid values).
const computeWorkingHours = (row, referenceDate) => {
  if (!row.time_in || !row.time_out) return "--";

  const base = moment(referenceDate || moment(), "YYYY-MM-DD").isValid()
    ? moment(referenceDate || moment(), "YYYY-MM-DD").format("YYYY-MM-DD")
    : moment().format("YYYY-MM-DD");

  const parse = (value) => {
    if (/^\d{2}:\d{2}$/.test(value)) {
      return moment(`${base} ${value}`, "YYYY-MM-DD HH:mm");
    }
    return moment(value);
  };

  const inMoment = parse(row.time_in);
  const outMoment = parse(row.time_out);
  if (!inMoment.isValid() || !outMoment.isValid()) return "--";

  const diff = outMoment.diff(inMoment, "minutes") / 60;
  if (Number.isNaN(diff) || diff <= 0) return "--";
  return `${diff.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")}h`;
};

// Inline SVG icons so the approval chip renders the same on every
// machine/browser (independent of any icon-font / bootstrap-icons load).
const CheckIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="2.5 6.5 5 9 9.5 3.5" />
  </svg>
);

const CrossIcon = () => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="3" y1="3" x2="9" y2="9" />
    <line x1="9" y1="3" x2="3" y2="9" />
  </svg>
);

const ChevronIcon = ({ up }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ transform: up ? "rotate(180deg)" : "none" }}
  >
    <polyline points="3 4.5 6 7.5 9 4.5" />
  </svg>
);

// Pill-style approval selector. Shows the current status in a fixed-size
// dark rounded chip (150×30) with a coloured indicator dot trailing the
// label. Clicking opens a dropdown where the manager can switch the
// decision. The parent owns `isOpen` so only one row is expanded at a time.
const ApprovalSelect = ({ rowId, status, isOpen, onToggle, onSelect }) => {
  const renderIndicator = () => {
    if (status === "approved") {
      return (
        <span
          className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white"
          aria-hidden="true"
        >
          <CheckIcon />
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span
          className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white"
          aria-hidden="true"
        >
          <CrossIcon />
        </span>
      );
    }
    return (
      <span
        className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80"
        aria-hidden="true"
      >
        <ChevronIcon up={isOpen} />
      </span>
    );
  };

  const label =
    status === "approved"
      ? "Approved"
      : status === "rejected"
        ? "Rejected"
        : "Pending";

  const options = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div
      className="relative inline-block"
      data-approval-menu
      data-row-id={rowId}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex h-[30px] w-[150px] items-center justify-center rounded-[6px] border-none bg-[#0f0f0f] px-3 text-[12px] font-bold uppercase tracking-[1px] text-white transition-colors hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        {label}
        {renderIndicator()}
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-[150px] -translate-x-1/2 overflow-hidden rounded-[8px] border border-white/10 bg-[#0f0f0f] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
        >
          {options.map((option) => {
            const isActive = option.value === status;
            const dot =
              option.value === "approved" ? (
                <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white">
                  <CheckIcon />
                </span>
              ) : option.value === "rejected" ? (
                <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white">
                  <CrossIcon />
                </span>
              ) : (
                <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70">
                  <ChevronIcon />
                </span>
              );
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(option.value)}
                className={`flex w-full items-center justify-between rounded-[6px] border-none bg-transparent px-3 py-1.5 text-[12px] font-bold uppercase tracking-[1px] text-white transition-colors hover:bg-white/10 ${isActive ? "bg-white/10" : ""}`}
              >
                <span>{option.label}</span>
                {dot}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ManageStaffAttendance = () => {
  const navigate = useNavigate();

  const [outlet, setOutlet] = useState("Setia City Mall");
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [outlets, setOutlets] = useState(OUTLET_NAMES_TITLE);
  const [attendance, setAttendance] = useState(SAMPLE_ATTENDANCE);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRemark, setActiveRemark] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [openApprovalRowId, setOpenApprovalRowId] = useState(null);

  useEffect(() => {
    if (!activeRemark) return;
    const handleKey = (event) => {
      if (event.key === "Escape") setActiveRemark(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeRemark]);

  useEffect(() => {
    if (!openApprovalRowId) return;
    const handleClickOutside = (event) => {
      if (!event.target.closest?.("[data-approval-menu]")) {
        setOpenApprovalRowId(null);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setOpenApprovalRowId(null);
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [openApprovalRowId]);

  // Fetch outlets (fall back to constant list on failure — no popup).
  useEffect(() => {
    let cancelled = false;
    api
      .get("/users/outlets")
      .then((response) => {
        if (cancelled) return;
        const list = response.data?.outlets;
        if (Array.isArray(list) && list.length > 0) {
          setOutlets(list);
        }
      })
      .catch(() => {
        // Silent fallback to OUTLET_NAMES_TITLE already seeded in state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch attendance whenever outlet/date changes; fall back to sample.
  useEffect(() => {
    if (!outlet || !date) return;
    let cancelled = false;

    const role = (() => {
      try {
        return JSON.parse(localStorage.getItem("loggedInUser") || "null")?.role;
      } catch {
        return null;
      }
    })();
    if (role && role !== "manager") {
      // Non-managers shouldn't be here; redirect silently.
      navigate("/staff");
      return;
    }

    setIsLoading(true);
    api
      .get("/users/attendance", { params: { outlet, date, page: 1 } })
      .then((response) => {
        if (cancelled) return;
        const rows = response.data?.attendance;
        setAttendance(
          Array.isArray(rows) && rows.length > 0 ? rows : SAMPLE_ATTENDANCE,
        );
        setPage(1);
      })
      .catch(() => {
        if (cancelled) return;
        setAttendance(SAMPLE_ATTENDANCE);
        setPage(1);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [outlet, date, navigate]);

  const filteredAttendance = useMemo(() => {
    if (categoryFilter === "All") return attendance;

    return attendance.filter((row) => {
      const remark = normaliseRemarks(row.remarks);
      if (categoryFilter === "None") return !remark;
      return remark?.category === categoryFilter;
    });
  }, [attendance, categoryFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const end = page * ITEMS_PER_PAGE;
    return filteredAttendance.slice(end - ITEMS_PER_PAGE, end);
  }, [filteredAttendance, page]);

  const updateApproval = (rowId, nextStatus) => {
    setAttendance((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const remark = normaliseRemarks(row.remarks);
        if (!remark) return row;
        return {
          ...row,
          remarks: { ...remark, approvalStatus: nextStatus },
        };
      }),
    );
    setActiveRemark((prev) =>
      prev && prev.rowId === rowId
        ? { ...prev, approvalStatus: nextStatus }
        : prev,
    );
  };

  return (
    <div
      className="w-full pb-3 pl-0 pr-1 pt-3 font-quicksand text-white"
      style={{ marginLeft: "3px" }}
    >
      <div className="rounded-[18px] bg-[#171717] p-5 shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
        {/* Filter row — outlet + date selectors styled as white pills */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={outlet}
              onChange={(event) => setOutlet(event.target.value)}
              className="h-[42px] w-[220px] appearance-none rounded-[10px] border border-white/15 bg-white px-4 pr-10 text-[14px] font-semibold text-[#171717] outline-none"
            >
              <option value="">Select Outlet</option>
              {outlets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#171717]">
              <i className="bi bi-chevron-down text-[12px]" />
            </span>
          </div>

          <input
            type="date"
            value={date}
            max={moment().format("YYYY-MM-DD")}
            onChange={(event) => setDate(event.target.value)}
            className="h-[42px] w-[200px] rounded-[10px] border border-white/15 bg-white px-4 text-[14px] font-semibold text-[#171717] outline-none [color-scheme:light]"
          />

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-[42px] w-[220px] appearance-none rounded-[10px] border border-white/15 bg-white px-4 pr-10 text-[14px] font-semibold text-[#171717] outline-none"
              aria-label="Filter by category"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "All"
                    ? "All categories"
                    : option === "None"
                      ? "No remark"
                      : option}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#171717]">
              <i className="bi bi-funnel text-[12px]" />
            </span>
          </div>
        </div>

        {/* Records table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "26%" }} />
            </colgroup>
            <thead>
              <tr className="text-[12px] font-bold uppercase tracking-wide text-white/90">
                <th className="border-b border-white/15 px-3 py-3">
                  Staff Name
                </th>
                <th className="border-b border-white/15 px-3 py-3">
                  Time-In
                </th>
                <th className="border-b border-white/15 px-3 py-3">
                  Time-Out
                </th>
                <th className="border-b border-white/15 px-3 py-3">Hours</th>
                <th className="border-b border-white/15 px-3 py-3">Status</th>
                <th className="border-b border-white/15 px-3 py-3">
                  Remarks
                </th>
                <th className="border-b border-white/15 px-3 py-3 text-center">
                  Approval
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[14px] text-white/70"
                  >
                    Loading attendance records...
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[14px] text-white/70"
                  >
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const status = deriveStatus(row);
                  const statusClass =
                    status === "On Duty"
                      ? "text-[#22c55e]"
                      : "text-[#ef4444]";
                  const workingHours = computeWorkingHours(row, date);
                  const remark = normaliseRemarks(row.remarks);

                  return (
                    <tr
                      key={row.id ?? `${row.fullname}-${row.time_in || "x"}`}
                      className="text-[14px] text-white"
                    >
                      <td className="px-3 py-3 font-bold">
                        {row.fullname || "--"}
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {formatTime(row.time_in)}
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {formatTime(row.time_out)}
                      </td>
                      <td className="px-3 py-3 font-bold">{workingHours}</td>
                      <td className={`px-3 py-3 font-bold ${statusClass}`}>
                        {status}
                      </td>
                      <td className="max-w-0 min-w-0 overflow-hidden px-3 py-3">
                        {!remark ? (
                          <span className="font-bold text-[14px]">--</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveRemark({
                                ...remark,
                                rowId: row.id,
                                staffName: row.fullname,
                                date,
                              })
                            }
                            title={remark.reason || remark.category}
                            className="block w-full truncate border-none bg-transparent p-0 text-left font-bold text-[14px] text-[#3b82f6] underline decoration-[#3b82f6]/50 underline-offset-2 hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/50"
                          >
                            {remark.category}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {!remark ? (
                          <span className="font-bold text-[14px] text-white/40">
                            --
                          </span>
                        ) : (
                          <ApprovalSelect
                            rowId={row.id}
                            status={remark.approvalStatus}
                            isOpen={openApprovalRowId === row.id}
                            onToggle={() =>
                              setOpenApprovalRowId((prev) =>
                                prev === row.id ? null : row.id,
                              )
                            }
                            onSelect={(next) => {
                              updateApproval(row.id, next);
                              setOpenApprovalRowId(null);
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="min-w-[80px] rounded-md border border-white/15 bg-transparent px-4 py-1.5 text-[14px] font-bold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Prev
          </button>

          <span className="min-w-[48px] text-center text-[15px] font-bold text-white">
            {page}/{totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="min-w-[80px] rounded-md border border-white/15 bg-transparent px-4 py-1.5 text-[14px] font-bold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </div>

      {activeRemark && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActiveRemark(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-[480px] rounded-[18px] bg-[#1f2126] p-6 text-white shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Remark details"
          >
            <button
              type="button"
              onClick={() => setActiveRemark(null)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent text-[18px] text-white/80 hover:bg-white/10 hover:text-white"
            >
              <i className="bi bi-x-lg" />
            </button>

            <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-white/50">
              Remark
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[20px] font-bold leading-tight text-[#3b82f6]">
                {activeRemark.category}
              </h3>
              {activeRemark.approvalStatus === "approved" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#22c55e]">
                  <i className="bi bi-check-circle-fill text-[10px]" />
                  Approved
                </span>
              ) : activeRemark.approvalStatus === "rejected" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#ef4444]">
                  <i className="bi bi-x-circle-fill text-[10px]" />
                  Rejected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">
                  <i className="bi bi-hourglass-split text-[10px]" />
                  Pending
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p className="m-0 text-white/50">Staff</p>
                <p className="m-0 font-semibold text-white">
                  {activeRemark.staffName || "--"}
                </p>
              </div>
              <div>
                <p className="m-0 text-white/50">Date</p>
                <p className="m-0 font-semibold text-white">
                  {activeRemark.date
                    ? moment(activeRemark.date).format("D MMMM YYYY")
                    : "--"}
                </p>
              </div>
              {activeRemark.submittedAt && (
                <div className="col-span-2">
                  <p className="m-0 text-white/50">Submitted</p>
                  <p className="m-0 font-semibold text-white">
                    {moment(activeRemark.submittedAt).isValid()
                      ? moment(activeRemark.submittedAt).format(
                          "D MMMM YYYY, HH:mm",
                        )
                      : activeRemark.submittedAt}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-white/50">
                Reason{" "}
                <span className="text-[10px] font-medium normal-case text-white/40">
                  (optional)
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">
                {activeRemark.reason ||
                  "Staff did not provide an additional reason."}
              </p>
            </div>

            <div className="mt-4">
              <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-white/50">
                Attachment
              </p>
              {activeRemark.attachment ? (
                <a
                  href={activeRemark.attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[13px] font-semibold text-[#3b82f6] transition-colors hover:bg-white/10"
                >
                  <i
                    className={`bi bi-${
                      activeRemark.attachment.type === "image"
                        ? "image"
                        : activeRemark.attachment.type === "pdf"
                          ? "file-earmark-pdf"
                          : "paperclip"
                    }`}
                  />
                  {activeRemark.attachment.name}
                </a>
              ) : (
                <p className="mt-1 text-[13px] text-white/60">
                  No attachment provided.
                </p>
              )}
            </div>

            {activeRemark.rowId && (
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                {activeRemark.approvalStatus === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        updateApproval(activeRemark.rowId, "rejected");
                        setActiveRemark(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-1.5 text-[13px] font-bold text-[#ef4444] transition-colors hover:bg-[#ef4444]/20"
                    >
                      <i className="bi bi-x-lg text-[12px]" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateApproval(activeRemark.rowId, "approved");
                        setActiveRemark(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#22c55e]/40 bg-[#22c55e]/15 px-3 py-1.5 text-[13px] font-bold text-[#22c55e] transition-colors hover:bg-[#22c55e]/25"
                    >
                      <i className="bi bi-check-lg text-[14px]" />
                      Approve
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      updateApproval(activeRemark.rowId, "pending");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] font-bold text-white/80 transition-colors hover:bg-white/10"
                  >
                    <i className="bi bi-arrow-counterclockwise text-[13px]" />
                    Reset to Pending
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStaffAttendance;
