import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import api from "../../utils/api";
import { OUTLET_NAMES_TITLE } from "../../constants/outlets";

const ITEMS_PER_PAGE = 6;

// Hardcoded fallback so the layout renders cleanly without requiring a
// live API. Swap / extend freely — the component will prefer server data
// whenever the outlet+date lookup succeeds.
// Remarks use a structured shape: { category, reason, attachment? }.
// The column shows the category; clicking opens a modal with the full
// reason and any attachment. Strings are still accepted for back-compat.
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
    return { category: trimmed, reason: "", attachment: null };
  }
  if (typeof value === "object" && value.category) {
    return {
      category: value.category,
      reason: value.reason || "",
      attachment: value.attachment || null,
      submittedAt: value.submittedAt || null,
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

const ManageStaffAttendance = () => {
  const navigate = useNavigate();

  const [outlet, setOutlet] = useState("Setia City Mall");
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [outlets, setOutlets] = useState(OUTLET_NAMES_TITLE);
  const [attendance, setAttendance] = useState(SAMPLE_ATTENDANCE);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRemark, setActiveRemark] = useState(null);

  useEffect(() => {
    if (!activeRemark) return;
    const handleKey = (event) => {
      if (event.key === "Escape") setActiveRemark(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeRemark]);

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

  const totalPages = Math.max(
    1,
    Math.ceil(attendance.length / ITEMS_PER_PAGE),
  );

  const pagedRows = useMemo(() => {
    const end = page * ITEMS_PER_PAGE;
    return attendance.slice(end - ITEMS_PER_PAGE, end);
  }, [attendance, page]);

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
        </div>

        {/* Records table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: "25%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "30%" }} />
            </colgroup>
            <thead>
              <tr className="text-[12px] font-bold uppercase tracking-wide text-white/90">
                <th className="border-b border-white/15 px-3 py-3">
                  Staff Name
                </th>
                <th className="border-b border-white/15 px-3 py-3">Time-In</th>
                <th className="border-b border-white/15 px-3 py-3">Time-Out</th>
                <th className="border-b border-white/15 px-3 py-3">Status</th>
                <th className="border-b border-white/15 px-3 py-3 text-center">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-[14px] text-white/70"
                  >
                    Loading attendance records...
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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

                  return (
                    <tr
                      key={row.id ?? `${row.fullname}-${row.time_in || "x"}`}
                      className="text-[14px] text-white"
                    >
                      <td className="px-3 py-4 font-bold">
                        {row.fullname || "--"}
                      </td>
                      <td className="px-3 py-4 font-bold">
                        {formatTime(row.time_in)}
                      </td>
                      <td className="px-3 py-4 font-bold">
                        {formatTime(row.time_out)}
                      </td>
                      <td className={`px-3 py-4 font-bold ${statusClass}`}>
                        {status}
                      </td>
                      <td className="max-w-0 min-w-0 overflow-hidden px-3 py-4 text-center">
                        {(() => {
                          const remark = normaliseRemarks(row.remarks);
                          if (!remark) {
                            return (
                              <span className="font-bold text-[14px]">--</span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveRemark({
                                  ...remark,
                                  staffName: row.fullname,
                                  date,
                                })
                              }
                              title={remark.reason || remark.category}
                              className="block w-full truncate border-none bg-transparent p-0 text-center font-bold text-[14px] text-[#3b82f6] underline decoration-[#3b82f6]/50 underline-offset-2 hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/50"
                            >
                              {remark.category}
                            </button>
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
            <h3 className="mt-1 text-[20px] font-bold leading-tight text-[#3b82f6]">
              {activeRemark.category}
            </h3>

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
                Reason
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">
                {activeRemark.reason || "No additional reason provided."}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStaffAttendance;
