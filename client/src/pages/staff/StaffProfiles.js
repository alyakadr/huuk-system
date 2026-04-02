import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import http from "../../utils/httpClient";
import styles from "../../styles/StaffProfiles.css";
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
    return <div>Loading profile...</div>;
  }

  if (profileError) {
    return <div style={{ color: "red" }}>Error: {profileError}</div>;
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
    return <div>You do not have permission to view this page.</div>;
  }

  if (loading) {
    return <div>Loading staff list...</div>;
  }

  if (err) {
    return <div style={{ color: "red" }}>Error: {err}</div>;
  }

  console.log("Rendering filteredStaffList:", filteredStaffList);

  return (
    <div className="staff-profiles">
      <h2>Staff Profiles</h2>
      <div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="filter-button"
        >
          {showFilter ? "Close Filter" : "Filter by Outlet"}
        </button>
        {showFilter && (
          <div className="filter-container">
            <label>
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
              <label key={index}>
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

      <div className="profile-container">
        {currentItems.length === 0 ? (
          <p>No staff members found.</p>
        ) : (
          currentItems.map((staff) => (
            <div className="profile-card" key={staff.id}>
              <div
                className="icon-menu"
                onClick={() => handleToggleMenu(staff.id)}
              >
                &#8942; {/* Three dots */}
              </div>

              {/* Make sure menuOpen is set correctly */}
              {menuOpen === staff.id && (
                <div className="dropdown-menu">
                  <button onClick={() => viewProfile(staff.id)}>
                    View full profile
                  </button>
                  <button onClick={() => deleteProfile(staff.id)}>
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
              />
              <p>
                <strong>Name:</strong> {staff.username}
              </p>
              <p>
                <strong>Outlet:</strong> {staff.outlet}
              </p>
              <p>
                <FaEnvelope /> <strong>Email:</strong> {staff.email}
              </p>
              <p>
                <FaPhoneAlt /> <strong>Phone:</strong>{" "}
                {staff.phone_number || "Not set"}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="pagination">
        <button
          onClick={() => handlePagination(-1)}
          disabled={currentPage === 1}
        >
          Prev
        </button>
        <span>Page {currentPage}</span>
        <button
          onClick={() => handlePagination(1)}
          disabled={currentPage * itemsPerPage >= filteredStaffList.length}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default StaffProfiles;
