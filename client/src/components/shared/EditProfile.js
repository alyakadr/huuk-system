import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useProfile } from "../../ProfileContext";
import { useNavigate } from "react-router-dom";
import defaultProfile from "../../assets/default-picture.jpg";
import ChangePasswordModal from "./ChangePasswordModal";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useForm } from "../../hooks/useForm";
import { useFetch } from "../../hooks/useFetch";
import "../../styles/editProfile.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const PROFILE_IMAGE_CANVAS_SIZE = 130;
const IMAGE_SCALE_STEP = 0.1;
const IMAGE_SCALE_MIN = 0.5;
const IMAGE_SCALE_MAX = 3;

const EditProfile = () => {
  const { profile: globalProfile, updateProfile } = useProfile();
  const {
    values: profile,
    setValues: setProfile,
    handleInputChange,
  } = useForm(globalProfile || {});
  const { token: authToken, clearSession } = useAuthSession();
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const safeProfile = profile || {};
  const safeGlobalProfile = globalProfile || {};
  const profileUserId = safeProfile.id || safeGlobalProfile.id || null;

  const fetchProfileRequest = useCallback(async () => {
    const response = await axios.get(`${API_BASE_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    return response.data;
  }, [authToken]);

  const handleFetchProfileSuccess = useCallback(
    (data) => {
      updateProfile(data);
      setProfile(data);
    },
    [updateProfile, setProfile],
  );

  const handleFetchProfileError = useCallback((error) => {
    console.error("Error fetching profile:", error);
    alert(
      "Failed to load profile: " +
        (error.response?.data?.message || error.message),
    );
  }, []);

  const { loading, execute: fetchProfile } = useFetch({
    request: fetchProfileRequest,
    onSuccess: handleFetchProfileSuccess,
    onError: handleFetchProfileError,
  });

  const getDashboardPath = useCallback(() => {
    const userRole = safeProfile.role || safeGlobalProfile.role;
    if (userRole === "manager") return "/manager";
    if (userRole === "staff") return "/staff";
    return "/";
  }, [safeProfile.role, safeGlobalProfile.role]);

  useEffect(() => {
    if (!safeProfile.id && authToken) {
      fetchProfile();
    }
  }, [safeProfile.id, authToken, fetchProfile]);

  useEffect(() => {
    if (globalProfile?.id) {
      setProfile(globalProfile);
    }
  }, [globalProfile, setProfile]);

  const handleChange = useCallback(
    (event) => {
      handleInputChange(event);
    },
    [handleInputChange],
  );

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target.result);
      setImagePosition({ x: 0, y: 0 });
      setImageScale(1);
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    const initialPos = { ...imagePosition };

    const handleMouseMove = (moveEvent) => {
      const newX = initialPos.x + (moveEvent.clientX - rect.left - startX);
      const newY = initialPos.y + (moveEvent.clientY - rect.top - startY);
      setImagePosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? IMAGE_SCALE_STEP : -IMAGE_SCALE_STEP;
    const newScale = Math.min(
      Math.max(imageScale + delta, IMAGE_SCALE_MIN),
      IMAGE_SCALE_MAX,
    );
    setImageScale(newScale);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!selectedImage && !profile.profile_picture)) return;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    if (!ctx || !img || !img.complete) return;

    const size = PROFILE_IMAGE_CANVAS_SIZE;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const scale = Math.max(size / img.width, size / img.height) * imageScale;
    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;
    const dx = imagePosition.x + (size - imgWidth) / 2;
    const dy = imagePosition.y + (size - imgHeight) / 2;
    ctx.drawImage(img, dx, dy, imgWidth, imgHeight);
  }, [selectedImage, imagePosition, imageScale, profile.profile_picture]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    if (!authToken) {
      alert("Session expired. Please log in again.");
      navigate("/staff-login");
      return;
    }

    if (!profileUserId) {
      alert("Profile is still loading. Please try again.");
      return;
    }

    const formData = new FormData();
    formData.append(
      "address",
      safeProfile.address || safeGlobalProfile.address || "",
    );
    formData.append(
      "phone_number",
      safeProfile.phone_number || safeGlobalProfile.phone_number || "",
    );

    if (selectedImage) {
      const canvas = canvasRef.current;
      if (canvas) {
        const blob = await new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
        });
        formData.append("profile_picture", blob, "profile.jpg");
      }
    }

    try {
      console.log("Updating profile for ID:", profileUserId);

      const response = await axios.patch(
        `${API_BASE_URL}/api/users/update-profile/${profileUserId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );
      // Update the global profile context immediately with token
      const updatedProfile = {
        ...safeGlobalProfile,
        ...response.data,
        token: authToken,
      };
      console.log("Updating profile context with:", updatedProfile);
      updateProfile(updatedProfile);

      // Force a small delay to ensure context updates
      setTimeout(() => {
        alert("Profile updated successfully");
      }, 100);

      navigate(getDashboardPath());
    } catch (err) {
      console.error("Error updating profile:", err);
      console.error("Error details:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      if (err.response?.status === 401) {
        alert("Your session has expired. Please log in again.");
        clearSession();
        navigate("/staff-login");
        return;
      }

      if (err.response?.status === 500) {
        alert(
          "Server error occurred. Please try again later or contact support.",
        );
        return;
      }

      alert(
        "Failed to update profile: " +
          (err.response?.data?.message || err.message),
      );
    }
  };

  const handleCancel = () => {
    navigate(getDashboardPath());
  };

  if (loading) {
    return (
      <div
        className="staff-edit-profile-loading"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          margin: 0,
          padding: 0,
        }}
      >
        <div className="staff-loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="staff-edit-profile-container">
      <div className="staff-edit-profile-header">
        <div className="staff-header-left">
          <button className="staff-back-button" onClick={handleCancel}>
            <span className="material-icons">arrow_back</span>
          </button>
          <div className="staff-header-title">
            <h1>Profile Settings</h1>
            <span className="staff-header-subtitle">
              Manage your account information
            </span>
          </div>
        </div>
        <div className="staff-brand-logo">
          <div className="staff-logo-icon">H</div>
          <span className="staff-logo-text">HUUK</span>
        </div>
      </div>

      <div className="staff-edit-profile-content">
        {/* Profile Card */}
        <div className="staff-profile-card">
          <div className="staff-profile-picture-section">
            <div className="staff-profile-picture-container">
              <img
                src={
                  selectedImage ||
                  (safeProfile.profile_picture
                    ? `http://localhost:5000${safeProfile.profile_picture}`
                    : defaultProfile)
                }
                alt="Profile"
                className="staff-profile-picture"
              />
              <div className="staff-profile-picture-overlay">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="staff-file-input"
                  id="staff-profile-picture-input"
                />
                <label
                  htmlFor="staff-profile-picture-input"
                  className="staff-change-picture-btn"
                >
                  <span className="material-icons">photo_camera</span>
                </label>
              </div>
            </div>
            <div className="staff-profile-info">
              <h2 className="staff-profile-name">
                {safeProfile.fullname || "Staff Member"}
              </h2>
              <span className="staff-profile-role">
                {(safeProfile.role || "Staff").toUpperCase()}
              </span>
              <button
                className="staff-change-password-btn"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <span className="material-icons">lock</span>
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="staff-form-card">
          <div className="staff-card-header">
            <h3>Account Details</h3>
            <span className="staff-card-subtitle">
              Update your personal information
            </span>
          </div>

          <form onSubmit={handleProfileSubmit} className="staff-profile-form">
            <div className="staff-form-group">
              <label>Full Name</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">person</span>
                <input
                  type="text"
                  value={safeProfile.fullname || ""}
                  readOnly
                  className="staff-form-input readonly"
                  placeholder="Full name"
                />
              </div>
              <small className="staff-input-note">
                This field cannot be modified
              </small>
            </div>

            <div className="staff-form-group">
              <label>Username</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">
                  alternate_email
                </span>
                <input
                  type="text"
                  value={safeProfile.username || ""}
                  readOnly
                  className="staff-form-input readonly"
                  placeholder="Username"
                />
              </div>
              <small className="staff-input-note">
                This field cannot be modified
              </small>
            </div>

            <div className="staff-form-group">
              <label>Email Address</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">email</span>
                <input
                  type="email"
                  value={safeProfile.email || ""}
                  readOnly
                  className="staff-form-email-input readonly"
                  placeholder="Email address"
                />
              </div>
              <small className="staff-input-note">
                This field cannot be modified
              </small>
            </div>

            <div className="staff-form-group">
              <label>Address</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">
                  location_on
                </span>
                <input
                  type="text"
                  name="address"
                  value={safeProfile.address || ""}
                  onChange={handleChange}
                  placeholder="Enter your address"
                  className="staff-form-input"
                />
              </div>
            </div>

            <div className="staff-form-group">
              <label>Phone Number</label>
              <div className="staff-phone-input-wrapper">
                <span className="staff-input-icon material-icons">phone</span>
                <div className="staff-phone-input-group">
                  <span className="staff-country-code">+60</span>
                  <input
                    type="text"
                    name="phone_number"
                    value={safeProfile.phone_number || ""}
                    onChange={handleChange}
                    placeholder="10-123456789"
                    className="staff-form-input staff-phone-input"
                  />
                </div>
              </div>
            </div>

            <div className="staff-form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="staff-cancel-btn"
              >
                <span className="material-icons">close</span>
                Cancel
              </button>
              <button type="submit" className="staff-update-btn">
                <span className="material-icons">check</span>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        userId={safeProfile.id || safeGlobalProfile.id || ""}
      />

      {/* Hidden elements for image processing */}
      {selectedImage && (
        <div style={{ display: "none" }}>
          <canvas ref={canvasRef} />
          <img
            ref={imgRef}
            src={selectedImage}
            alt="Processing"
            onLoad={() => {
              if (canvasRef.current) {
                const ctx = canvasRef.current.getContext("2d");
                const img = imgRef.current;
                if (ctx && img && img.complete) {
                  const size = 130;
                  canvasRef.current.width = size;
                  canvasRef.current.height = size;
                  ctx.clearRect(0, 0, size, size);
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, size, size);
                  const scale = Math.max(size / img.width, size / img.height);
                  const imgWidth = img.width * scale;
                  const imgHeight = img.height * scale;
                  const dx = (size - imgWidth) / 2;
                  const dy = (size - imgHeight) / 2;
                  ctx.drawImage(img, dx, dy, imgWidth, imgHeight);
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default EditProfile;
