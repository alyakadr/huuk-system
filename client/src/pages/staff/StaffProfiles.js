import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsThreeDots } from "react-icons/bs";
import { FaEnvelope, FaFilter, FaPhoneAlt } from "react-icons/fa";
import { useProfile } from "../../ProfileContext";
import { OUTLET_NAMES_TITLE } from "../../constants/outlets";
import http from "../../utils/httpClient";

const DEFAULT_PROFILE_IMAGE =
  "data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='80' cy='80' r='80' fill='%23d1d5db'/%3E%3Ccircle cx='80' cy='54' r='22' fill='%236b7280'/%3E%3Cpath d='M32 136c0-26.51 21.49-48 48-48s48 21.49 48 48v8H32v-8z' fill='%236b7280'/%3E%3C/svg%3E";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const ITEMS_PER_PAGE = 6;

const StaffProfiles = () => {
  const navigate = useNavigate();
  const outlets = OUTLET_NAMES_TITLE;

  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useProfile();

  const [staffList, setStaffList] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        setLoading(true);
        setErr("");

        const token =
          localStorage.getItem("staff_token") || localStorage.getItem("token");

        if (!token) {
          navigate("/staff-login");
          return;
        }

        const response = await http.get(`${API_BASE}/api/users/staffs`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });

        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.data || response.data?.staff || [];

        if (!Array.isArray(data)) {
          setErr("Unexpected data format from server");
          setStaffList([]);
          return;
        }

        setStaffList(data);
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.message ||
          "Failed to fetch staff list";
        setErr(message);

        if (
          message.toLowerCase().includes("token") ||
          message.toLowerCase().includes("login") ||
          error.response?.status === 401
        ) {
          navigate("/staff-login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStaffList();
  }, [navigate]);

  useEffect(() => {
    const handleOutsideClick = () => setMenuOpen(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const filteredStaffList = useMemo(() => {
    if (selectedOutlets.length === 0) {
      return staffList;
    }

    return staffList.filter((staff) => {
      const outlet = (staff.outlet || "").trim().toLowerCase();
      return selectedOutlets.some(
        (selected) => outlet === selected.trim().toLowerCase(),
      );
    });
  }, [selectedOutlets, staffList]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStaffList.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOutlets]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const startIndex = endIndex - ITEMS_PER_PAGE;
    return filteredStaffList.slice(startIndex, endIndex);
  }, [currentPage, filteredStaffList]);

  const toggleOutlet = (outlet) => {
    setSelectedOutlets((prev) =>
      prev.includes(outlet)
        ? prev.filter((item) => item !== outlet)
        : [...prev, outlet],
    );
  };

  const handleToggleMenu = (event, staffId) => {
    event.stopPropagation();
    setMenuOpen((prev) => (prev === staffId ? null : staffId));
  };

  const viewProfile = (id) => {
    navigate(`/staff/${id}`);
  };

  const deleteProfile = (id) => {
    // Preserve current behavior until delete endpoint is confirmed.
    console.log("Delete profile requested:", id);
  };

  const getProfileImage = (staff) => {
    if (
      !staff.profile_picture ||
      staff.profile_picture === "/uploads/profile_pictures/null"
    ) {
      return DEFAULT_PROFILE_IMAGE;
    }

    if (staff.profile_picture.startsWith("http")) {
      return staff.profile_picture;
    }

    return `${API_BASE}${staff.profile_picture}`;
  };

  if (profileLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white">
        Loading profile...
      </div>
    );
  }

  if (profileError) {
    return <div className="text-red-400">Error: {profileError}</div>;
  }

  if (!profile || profile.role !== "manager") {
    return (
      <div className="text-white">You do not have permission to view this page.</div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white">
        Loading staff list...
      </div>
    );
  }

  if (err) {
    return <div className="text-red-400">Error: {err}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-2 pb-6 pt-1 font-quicksand text-white">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-[36px] font-bold leading-tight text-white">
            Staff Profiles
          </h2>
          <p className="mt-1 text-[24px] font-bold leading-tight text-huuk-accent">
            Staff Management &gt; Profiles
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilter((prev) => !prev)}
            className="flex items-center gap-3 rounded-lg bg-[#1f2126] px-4 py-2 text-[22px] font-semibold text-white transition-colors hover:bg-[#2a2d34]"
          >
            <FaFilter className="text-[18px]" />
            Filter
            <span className="material-icons text-[22px]">
              {showFilter ? "expand_less" : "expand_more"}
            </span>
          </button>

          {showFilter && (
            <div className="absolute right-0 z-30 mt-2 w-[260px] rounded-xl border border-white/10 bg-[#171717] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={selectedOutlets.length === outlets.length}
                  onChange={() => {
                    const allSelected = selectedOutlets.length === outlets.length;
                    setSelectedOutlets(allSelected ? [] : outlets);
                  }}
                />
                Select all outlets
              </label>

              <div className="max-h-[220px] overflow-auto pr-1">
                {outlets.map((outlet) => (
                  <label
                    key={outlet}
                    className="mb-2 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOutlets.includes(outlet)}
                      onChange={() => toggleOutlet(outlet)}
                    />
                    {outlet}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {currentItems.length === 0 ? (
          <div className="col-span-full rounded-xl bg-[#171717] p-10 text-center text-white/85">
            No staff members found.
          </div>
        ) : (
          currentItems.map((staff) => (
            <article
              key={staff.id}
              className="relative min-h-[220px] rounded-[18px] bg-[#171717] px-6 py-5 shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
            >
              <button
                type="button"
                onClick={(event) => handleToggleMenu(event, staff.id)}
                className="absolute right-5 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-xl text-white/90"
              >
                <BsThreeDots />
              </button>

              {menuOpen === staff.id && (
                <div
                  className="absolute right-5 top-12 z-20 overflow-hidden rounded-lg bg-[#45464a] text-[14px] shadow-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => viewProfile(staff.id)}
                    className="block w-full border-none bg-transparent px-4 py-2 text-left text-white hover:bg-black/20"
                  >
                    View full profile
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProfile(staff.id)}
                    className="block w-full border-none bg-transparent px-4 py-2 text-left text-white hover:bg-black/20"
                  >
                    Delete profile
                  </button>
                </div>
              )}

              <div className="mb-4 flex items-center gap-4">
                <img
                  src={getProfileImage(staff)}
                  alt={`${staff.fullname || staff.username || "Staff"} profile`}
                  onError={(event) => {
                    if (event.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                      event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                    }
                  }}
                  className="h-[84px] w-[84px] rounded-full bg-[#d1d5db] object-cover"
                />
                <div>
                  <h3 className="m-0 text-[36px] font-bold leading-none text-white">
                    {staff.fullname || staff.username || "Name"}
                  </h3>
                  <p className="mt-2 text-[34px] font-medium text-white/90">
                    {staff.outlet || "Outlet"}
                  </p>
                </div>
              </div>

              <p className="mb-2 flex items-center gap-3 text-[16px] text-white">
                <FaEnvelope className="text-[17px]" />
                <strong className="font-bold">Email:</strong>
                <span className="truncate">{staff.email || "-"}</span>
              </p>

              <p className="m-0 flex items-center gap-3 text-[16px] text-white">
                <FaPhoneAlt className="text-[16px]" />
                <strong className="font-bold">Phone:</strong>
                <span>{staff.phone_number || ""}</span>
              </p>
            </article>
          ))
        )}
      </div>

      <div className="mt-9 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="min-w-[108px] rounded-lg border-none bg-[#1b1f24] px-5 py-2 text-[36px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
        >
          Prev
        </button>

        <span className="min-w-[92px] text-center text-[36px] font-bold text-white">
          {currentPage}/{totalPages}
        </span>

        <button
          type="button"
          onClick={() =>
            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
          }
          disabled={currentPage === totalPages}
          className="min-w-[108px] rounded-lg border-none bg-[#3f3f44] px-5 py-2 text-[36px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default StaffProfiles;
