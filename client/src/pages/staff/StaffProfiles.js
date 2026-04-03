import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import http from "../../utils/httpClient";
import { FaEnvelope, FaPhoneAlt } from "react-icons/fa"; // Import the icons
import { OUTLET_NAMES_TITLE } from "../../constants/outlets";

const StaffProfiles = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);

  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useProfile();
  const [staffList, setStaffList] = useState([]);
  const [filteredStaffList, setFilteredStaffList] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Set to 6 profiles per page
  const navigate = useNavigate();

  const outlets = OUTLET_NAMES_TITLE;

  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        setLoading(true);
        setErr("");
        const token = localStorage.getItem("token");
        console.log("Token in StaffProfiles:", token);
        if (!token) {
          console.log("No token found, redirecting to login");
          navigate("/login");
          return;
        }
        const config = {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        };
        console.log("Request config:", config);
        const response = await http.get(
          "http://localhost:5000/api/users/staffs",
          config,
        );
        console.log(
          "Staff fetch response type:",
          typeof response.data,
          "isArray:",
          Array.isArray(response.data),
        );
        console.log("Staff fetch response:", response.data);
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.data || response.data?.staff || [];
        if (!Array.isArray(data)) {
          console.warn("Fetched data is not an array:", data);
          setErr("Unexpected data format from server");
          setStaffList([]);
          setFilteredStaffList([]);
        } else {
          setStaffList([...data]);
          setFilteredStaffList([...data]);
          setErr("");
          console.log("Staff list state updated:", data);
        }
      } catch (error) {
        console.error("Error fetching staff list:", error, error.response);
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to fetch staff list";
        setErr(errorMessage);
        if (
          errorMessage.toLowerCase().includes("token") ||
          errorMessage.toLowerCase().includes("login") ||
          error.response?.status === 401
        ) {
          console.log("Token-related error, redirecting to login");
          navigate("/login");
        }
      } finally {
        console.log("Fetch complete, setting loading to false");
        setLoading(false);
      }
    };
    fetchStaffList();
  }, [navigate]);

  const handlePagination = (direction) => {
    setCurrentPage((prevPage) => prevPage + direction);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredStaffList.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );

  const [menuOpen, setMenuOpen] = useState(null);

  const handleToggleMenu = (id) => {
    setMenuOpen((prev) => (prev === id ? null : id));
  };

  const viewProfile = (id) => {
    navigate(`/staff/${id}`);
  };

  const deleteProfile = (id) => {
    console.log("Delete profile ID:", id);
    // You can implement a delete confirmation here
  };

  useEffect(() => {
    console.log("Selected outlets:", selectedOutlets);
    console.log("Staff list before filtering:", staffList);
    if (selectedOutlets.length === 0) {
      setFilteredStaffList([...staffList]);
      console.log("Filtered staff list (all):", staffList);
    } else {
      const filtered = staffList.filter((staff) =>
        selectedOutlets.some(
          (outlet) =>
            staff.outlet &&
            staff.outlet.trim().toLowerCase() === outlet.trim().toLowerCase(),
        ),
      );
      setFilteredStaffList([...filtered]);
      console.log("Filtered staff list (by outlets):", filtered);
    }
  }, [selectedOutlets, staffList]);

  useEffect(() => {
    console.log("Loading state:", loading);
    console.log("Error state:", err);
    console.log("Staff list:", staffList);
    console.log("Filtered staff list:", filteredStaffList);
  }, [loading, err, staffList, filteredStaffList]);

  console.log("Profile:", profile, "Profile loading:", profileLoading);

  if (profileLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-white">Loading profile...</div>;
  }

  if (profileError) {
    return <div className="text-red-400">Error: {profileError}</div>;
  }

  if (!profile || !profile.role) {
    console.log(
      "Profile or role missing, redirecting to login. Profile:",
      profile,
    );
    navigate("/login");
    return null;
  }

  console.log("Profile role:", profile.role);

  if (profile.role !== "manager") {
    return <div className="text-white">You do not have permission to view this page.</div>;
  }

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-white">Loading staff list...</div>;
  }

  if (err) {
    return <div className="text-red-400">Error: {err}</div>;
  }

  console.log("Rendering filteredStaffList:", filteredStaffList);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 font-quicksand text-white">
      <h2 className="text-center mb-7 text-3xl font-bold">Staff Profiles</h2>
      <div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="btn-primary"
        >
          {showFilter ? "Close Filter" : "Filter by Outlet"}
        </button>
        {showFilter && (
          <div className="mt-3 bg-huuk-card rounded-huuk-md p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedOutlets.length === outlets.length}
                onChange={() => {
                  const isChecked = selectedOutlets.length === outlets.length;
                  setSelectedOutlets(isChecked ? [] : outlets);
                }}
              />
              Select All
            </label>
            {outlets.map((outlet, index) => (
              <label key={index} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={outlet}
                  checked={selectedOutlets.includes(outlet)}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setSelectedOutlets((prev) =>
                      isChecked
                        ? [...prev, outlet]
                        : prev.filter((o) => o !== outlet),
                    );
                  }}
                />
                {outlet}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-5 mt-5">
        {currentItems.length === 0 ? (
          <p>No staff members found.</p>
        ) : (
          currentItems.map((staff) => (
            <div className="bg-huuk-card rounded-huuk-md p-5 w-[280px] relative shadow-lg" key={staff.id}>
              <div
                className="absolute top-3 right-3 cursor-pointer text-white z-20"
                onClick={() => handleToggleMenu(staff.id)}
              >
                &#8942; {/* Three dots */}
              </div>

              {/* Make sure menuOpen is set correctly */}
              {menuOpen === staff.id && (
                <div className="absolute top-11 right-3 bg-huuk-bg rounded-huuk-sm overflow-hidden shadow-xl z-10">
                  <button onClick={() => viewProfile(staff.id)} className="block w-full px-4 py-2 bg-transparent border-none text-white text-left cursor-pointer hover:bg-white/20">
                    View full profile
                  </button>
                  <button onClick={() => deleteProfile(staff.id)} className="block w-full px-4 py-2 bg-transparent border-none text-white text-left cursor-pointer hover:bg-white/20">
                    Delete profile
                  </button>
                </div>
              )}

              <img
                src={
                  staff.profile_picture &&
                  staff.profile_picture !== "/uploads/profile_pictures/null"
                    ? `http://localhost:5000${staff.profile_picture}`
                    : "http://localhost:5000/uploads/profile_pictures/default.jpg"
                }
                alt={`${staff.fullname}'s Profile`}
                onError={(e) => {
                  e.target.src =
                    "http://localhost:5000/uploads/profile_pictures/default.jpg";
                }}
                className="w-[70px] h-[70px] rounded-full object-cover mb-2.5 bg-[#ccc]"
              />
              <p className="my-1.5">
                <strong>Name:</strong> {staff.username}
              </p>
              <p className="my-1.5">
                <strong>Outlet:</strong> {staff.outlet}
              </p>
              <p className="my-1.5 flex items-center gap-1">
                <FaEnvelope /> <strong>Email:</strong> {staff.email}
              </p>
              <p className="my-1.5 flex items-center gap-1">
                <FaPhoneAlt /> <strong>Phone:</strong>{" "}
                {staff.phone_number || "Not set"}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-center mt-7 gap-2.5 items-center">
        <button
          onClick={() => handlePagination(-1)}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-white/20 text-white border-none rounded-huuk-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-sm">Page {currentPage}</span>
        <button
          onClick={() => handlePagination(1)}
          disabled={currentPage * itemsPerPage >= filteredStaffList.length}
          className="px-4 py-2 bg-white/20 text-white border-none rounded-huuk-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default StaffProfiles;
