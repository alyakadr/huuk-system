import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useProfile } from "../../ProfileContext";
import { useNavigate } from "react-router-dom";
import defaultProfile from "../../assets/default-picture.jpg";
import ChangePasswordModal from "./ChangePasswordModal";
import "../../styles/editProfile.css";

const EditProfile = () => {
  const { profile: globalProfile, updateProfile } = useProfile();
  const [profile, setProfile] = useState(globalProfile || {});
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  
  // Get the appropriate token based on current interface
  const getToken = () => {
    const currentPath = window.location.pathname;
    const isStaffInterface = currentPath.includes('/staff') || currentPath.includes('/manager');
    
    if (isStaffInterface) {
      return localStorage.getItem("staff_token") || localStorage.getItem("token");
    } else {
      return localStorage.getItem("customer_token") || localStorage.getItem("token");
    }
  };

  useEffect(() => {
    if (!profile.id) {
      const fetchProfile = async () => {
        try {
          setLoading(true);
          const response = await axios.get(
            "http://localhost:5000/api/users/profile",
            {
              headers: { Authorization: `Bearer ${getToken()}` },
            }
          );
          const data = response.data;
          updateProfile(data);
          setProfile(data);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching profile:", error);
          alert(
            "Failed to load profile: " +
              (error.response?.data?.message || error.message)
          );
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [profile.id, updateProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

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
    const scaleStep = 0.1;
    const minScale = 0.5;
    const maxScale = 3;
    const delta = e.deltaY < 0 ? scaleStep : -scaleStep;
    const newScale = Math.min(Math.max(imageScale + delta, minScale), maxScale);
    setImageScale(newScale);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!selectedImage && !profile.profile_picture)) return;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    if (!ctx || !img || !img.complete) return;

    const size = 130;
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
    
    // Get fresh token
    const currentToken = getToken();
    if (!currentToken) {
      alert("Session expired. Please log in again.");
      navigate("/staff-login");
      return;
    }
    
    const formData = new FormData();
    formData.append("address", profile.address || globalProfile.address || "");
    formData.append(
      "phone_number",
      profile.phone_number || globalProfile.phone_number || ""
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
      const profileId = profile.id || globalProfile.id;
      console.log('Updating profile for ID:', profileId);
      
      const response = await axios.patch(
        `http://localhost:5000/api/users/update-profile/${profileId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      // Update the global profile context immediately with token
      const updatedProfile = {
        ...globalProfile,
        ...response.data,
        token: currentToken // Preserve the token
      };
      console.log('Updating profile context with:', updatedProfile);
      updateProfile(updatedProfile);
      
      // Force a small delay to ensure context updates
      setTimeout(() => {
        alert("Profile updated successfully");
      }, 100);
      
      const userRole = profile.role || globalProfile.role;
      if (userRole === "manager") {
        navigate("/manager");
      } else if (userRole === "staff") {
        navigate("/staff");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      console.error("Error details:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      
      if (err.response?.status === 401) {
        alert("Your session has expired. Please log in again.");
        // Clear all possible tokens
        localStorage.removeItem("token");
        localStorage.removeItem("staff_token");
        localStorage.removeItem("customer_token");
        localStorage.removeItem("loggedInUser");
        localStorage.removeItem("staff_loggedInUser");
        localStorage.removeItem("customer_loggedInUser");
        navigate("/staff-login");
        return;
      }
      
      if (err.response?.status === 500) {
        alert("Server error occurred. Please try again later or contact support.");
        return;
      }
      
      alert(
        "Failed to update profile: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  const handleCancel = () => {
    const userRole = profile.role || globalProfile.role;
    if (userRole === "manager") {
      navigate("/manager");
    } else if (userRole === "staff") {
      navigate("/staff");
    } else {
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="staff-edit-profile-loading" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        margin: 0,
        padding: 0
      }}>
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
            <span className="staff-header-subtitle">Manage your account information</span>
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
                  (profile.profile_picture
                    ? `http://localhost:5000${profile.profile_picture}`
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
                <label htmlFor="staff-profile-picture-input" className="staff-change-picture-btn">
                  <span className="material-icons">photo_camera</span>
                </label>
              </div>
            </div>
            <div className="staff-profile-info">
              <h2 className="staff-profile-name">{profile.fullname || 'Staff Member'}</h2>
              <span className="staff-profile-role">{(profile.role || 'Staff').toUpperCase()}</span>
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
            <span className="staff-card-subtitle">Update your personal information</span>
          </div>
          
          <form onSubmit={handleProfileSubmit} className="staff-profile-form">
            <div className="staff-form-group">
              <label>Full Name</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">person</span>
                <input
                  type="text"
                  value={profile.fullname || ""}
                  readOnly
                  className="staff-form-input readonly"
                  placeholder="Full name"
                />
              </div>
              <small className="staff-input-note">This field cannot be modified</small>
            </div>

            <div className="staff-form-group">
              <label>Username</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">alternate_email</span>
                <input
                  type="text"
                  value={profile.username || ""}
                  readOnly
                  className="staff-form-input readonly"
                  placeholder="Username"
                />
              </div>
              <small className="staff-input-note">This field cannot be modified</small>
            </div>

            <div className="staff-form-group">
              <label>Email Address</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">email</span>
                <input
                  type="email"
                  value={profile.email || ""}
                  readOnly
                  className="staff-form-email-input readonly"
                  placeholder="Email address"
                />
              </div>
              <small className="staff-input-note">This field cannot be modified</small>
            </div>

            <div className="staff-form-group">
              <label>Address</label>
              <div className="staff-input-wrapper">
                <span className="staff-input-icon material-icons">location_on</span>
                <input
                  type="text"
                  name="address"
                  value={profile.address || ""}
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
                    value={profile.phone_number || ""}
                    onChange={handleChange}
                    placeholder="10-123456789"
                    className="staff-form-input staff-phone-input"
                  />
                </div>
              </div>
            </div>

            <div className="staff-form-actions">
              <button type="button" onClick={handleCancel} className="staff-cancel-btn">
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
        userId={profile.id || globalProfile.id}
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
