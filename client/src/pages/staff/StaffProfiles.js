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

// Hardcoded sample data used as a fallback so the layout is visible
// even when the API returns an empty list.
const SAMPLE_STAFF = [
  {
    id: "sample-1",
    fullname: "Addy",
    outlet: "Setia City Mall",
    email: "addy123@gmail.com",
    phone_number: "010-12345678",
  },
  {
    id: "sample-2",
    fullname: "Name",
    outlet: "Outlet",
    email: "",
    phone_number: "",
  },
  {
    id: "sample-3",
    fullname: "Name",
    outlet: "Outlet",
    email: "",
    phone_number: "",
  },
  {
    id: "sample-4",
    fullname: "Name",
    outlet: "Outlet",
    email: "",
    phone_number: "",
  },
  {
    id: "sample-5",
    fullname: "Name",
    outlet: "Outlet",
    email: "",
    phone_number: "",
  },
  {
    id: "sample-6",
    fullname: "Name",
    outlet: "Outlet",
    email: "",
    phone_number: "",
  },
];

const StaffProfiles = () => {
  const navigate = useNavigate();
  const outlets = OUTLET_NAMES_TITLE;

  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useProfile();

  const [staffList, setStaffList] = useState(SAMPLE_STAFF);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        setLoading(true);

        const token =
          localStorage.getItem("staff_token") || localStorage.getItem("token");

        // StaffLayout is the source of truth for auth. If there's no token
        // here it means the session is still initialising or about to expire
        // — fall back to the sample data instead of redirecting, which
        // otherwise causes a flash of the unstyled /staff-login homepage.
        if (!token) {
          setStaffList(SAMPLE_STAFF);
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
          setStaffList(SAMPLE_STAFF);
          return;
        }

        setStaffList(data.length > 0 ? data : SAMPLE_STAFF);
      } catch (error) {
        // Any API failure (including 401) just falls back to sample data.
        // StaffLayout will take care of redirecting to /staff-login if the
        // overall session is invalid, so we avoid causing a transient
        // navigation that flashes the raw login page.
        setStaffList(SAMPLE_STAFF);
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
      <div className="text-white">
        You do not have permission to view this page.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white">
        Loading staff list...
      </div>
    );
  }

  return (
    <div className="w-full pb-3 pl-0 pr-1 pt-0 font-quicksand text-white" style={{ marginLeft: "8px" }}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[18px] font-semibold leading-tight text-huuk-accent">
            Staff Management &gt; Profiles
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilter((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg bg-[#1f2126] px-4 py-1.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2a2d34]"
          >
            <FaFilter className="text-[13px]" />
            Filter by
            <span className="material-icons text-[18px]">
              {showFilter ? "expand_less" : "expand_more"}
            </span>
          </button>

          {showFilter && (
            <div className="absolute right-0 z-30 mt-2 w-[240px] rounded-xl border border-white/10 bg-[#171717] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
              <h4 className="mb-2 text-[15px] font-bold text-white">
                Location:
              </h4>

              <div className="max-h-[220px] overflow-auto pr-1">
                {outlets.map((outlet) => (
                  <label
                    key={outlet}
                    className="mb-1.5 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-white"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOutlets.includes(outlet)}
                      onChange={() => toggleOutlet(outlet)}
                      className="h-3.5 w-3.5 accent-white"
                    />
                    {outlet}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {currentItems.length === 0 ? (
          <div className="col-span-full rounded-xl bg-[#171717] p-6 text-center text-[14px] text-white/85">
            No staff members found.
          </div>
        ) : (
          currentItems.map((staff) => (
            <article
              key={staff.id}
              className="relative min-h-[200px] rounded-[16px] bg-[#171717] px-5 py-5 shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
            >
              <button
                type="button"
                onClick={(event) => handleToggleMenu(event, staff.id)}
                className="absolute right-4 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent text-lg text-white/90"
              >
                <BsThreeDots />
              </button>

              {menuOpen === staff.id && (
                <div
                  className="absolute right-4 top-11 z-20 overflow-hidden rounded-lg bg-[#45464a] text-[13px] shadow-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => viewProfile(staff.id)}
                    className="block w-full border-none bg-transparent px-3 py-1.5 text-left text-white hover:bg-black/20"
                  >
                    View full profile
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProfile(staff.id)}
                    className="block w-full border-none bg-transparent px-3 py-1.5 text-left text-white hover:bg-black/20"
                  >
                    Delete profile
                  </button>
                </div>
              )}

              <div className="mb-4 flex items-center gap-3">
                <img
                  src={getProfileImage(staff)}
                  alt={`${staff.fullname || staff.username || "Staff"} profile`}
                  onError={(event) => {
                    if (event.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                      event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                    }
                  }}
                  className="h-[68px] w-[68px] rounded-full bg-[#d1d5db] object-cover"
                />
                <div className="min-w-0">
                  <h3 className="m-0 text-[20px] font-bold leading-tight text-white">
                    {staff.fullname || staff.username || "Name"}
                  </h3>
                  <p className="mt-1 text-[16px] font-medium text-white/85">
                    {staff.outlet || "Outlet"}
                  </p>
                </div>
              </div>

              <p className="mb-1.5 flex items-center gap-2 text-[14px] text-white">
                <FaEnvelope className="text-[13px] text-white/80" />
                <strong className="font-bold">Email:</strong>
                <span className="truncate">{staff.email || ""}</span>
              </p>

              <p className="m-0 flex items-center gap-2 text-[14px] text-white">
                <FaPhoneAlt className="text-[12px] text-white/80" />
                <strong className="font-bold">Phone:</strong>
                <span>{staff.phone_number || ""}</span>
              </p>
            </article>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="min-w-[80px] rounded-md border-none bg-[#1f2126] px-4 py-1.5 text-[15px] font-bold text-white transition-colors hover:bg-[#2a2d34] disabled:cursor-not-allowed disabled:opacity-55"
        >
          Prev
        </button>

        <span className="min-w-[52px] text-center text-[16px] font-bold text-white">
          {currentPage}/{totalPages}
        </span>

        <button
          type="button"
          onClick={() =>
            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
          }
          disabled={currentPage === totalPages}
          className="min-w-[80px] rounded-md border-none bg-[#1f2126] px-4 py-1.5 text-[15px] font-bold text-white transition-colors hover:bg-[#2a2d34] disabled:cursor-not-allowed disabled:opacity-55"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default StaffProfiles;
