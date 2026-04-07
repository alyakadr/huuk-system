import React, { useState, useEffect, useRef } from "react";
import { useProfile } from "../../ProfileContext";
import { useNavigate } from "react-router-dom";
import client from "../../api/client";

const SettingsPage = () => {
  const { profile: globalProfile, updateProfile } = useProfile();
  const [profile, setProfile] = useState(globalProfile || {});
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1); // State for image scale (zoom)
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  // Fetch profile data if not available
  useEffect(() => {
    if (!profile.id) {
      const fetchProfile = async () => {
        try {
          setLoading(true);
          const response = await client.get("/users/profile");
          updateProfile(response.data);
          setProfile(response.data);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching profile:", error);
          alert("Failed to load profile");
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [profile.id, token, updateProfile]);

  // Handle changes to form fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // Handle image file selection and reset position/scale
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSelectedImage(event.target.result);
        setImagePosition({ x: 0, y: 0 }); // Reset position
        setImageScale(1); // Reset scale to default
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Handle image positioning with mouse drag
  const handleMouseDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
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

  // Handle image scaling with mouse wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const scaleStep = 0.1; // Adjust scale by 10% per wheel movement
    const minScale = 0.5; // Minimum scale (50%)
    const maxScale = 3; // Maximum scale (300%)
    const delta = e.deltaY < 0 ? scaleStep : -scaleStep; // Scroll up to zoom in, down to zoom out
    const newScale = Math.min(Math.max(imageScale + delta, minScale), maxScale);
    setImageScale(newScale);
  };

  // Render and resize image to canvas
  useEffect(() => {
    if (!selectedImage && !profile.profile_picture) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    const size = 130; // Fixed size for profile picture box

    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff"; // White background for transparency
    ctx.fillRect(0, 0, size, size);

    if (img.complete) {
      const scale = Math.max(size / img.width, size / img.height) * imageScale;
      const imgWidth = img.width * scale;
      const imgHeight = img.height * scale;
      const dx = imagePosition.x + (size - imgWidth) / 2;
      const dy = imagePosition.y + (size - imgHeight) / 2;
      ctx.drawImage(img, dx, dy, imgWidth, imgHeight);
    }
  }, [selectedImage, imagePosition, imageScale, profile.profile_picture]);

  // Submit the form to update the profile
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("address", profile.address || globalProfile.address || "");
    formData.append(
      "phone_number",
      profile.phone_number || globalProfile.phone_number || "",
    );

    if (selectedImage) {
      const canvas = canvasRef.current;
      const blob = await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
      });
      formData.append("profile_picture", blob, "profile.jpg");
    }

    try {
      const response = await client.patch(
        `/users/update-profile/${profile.id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      updateProfile(response.data);
      alert("Profile updated successfully");

      if (response.data.role === "staff") {
        navigate("/staff-dashboard");
      } else if (response.data.role === "manager") {
        navigate("/manager-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      alert(
        "Failed to update profile: " +
          (err.response?.data?.message || err.message),
      );
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 500, margin: "auto" }}>
      <h2>Settings</h2>
      <form onSubmit={handleProfileSubmit}>
        <label>Fullname (read-only)</label>
        <input
          type="text"
          value={profile.fullname || ""}
          readOnly
          style={{ backgroundColor: "#eee" }}
        />
        <label>Username (read-only)</label>
        <input
          type="text"
          value={profile.username || ""}
          readOnly
          style={{ backgroundColor: "#eee" }}
        />
        <label>Email (read-only)</label>
        <input
          type="email"
          value={profile.email || ""}
          readOnly
          style={{ backgroundColor: "#eee" }}
        />
        <label>Address</label>
        <input
          type="text"
          name="address"
          value={profile.address || ""}
          onChange={handleChange}
          placeholder="Enter your home address"
        />
        <label>Phone Number</label>
        <input
          type="text"
          name="phone_number"
          value={profile.phone_number || ""}
          onChange={handleChange}
          placeholder="Enter your phone number"
        />
        <label>Profile Picture</label>
        <input type="file" accept="image/*" onChange={handleImageChange} />
        {(selectedImage || profile.profile_picture) && (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <p>Drag to adjust position, scroll to zoom in/out</p>
            <canvas
              ref={canvasRef}
              style={{
                width: 130,
                height: 130,
                borderRadius: "50%",
                cursor: "move",
                border: "1px solid #ccc",
              }}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
            />
            <img
              ref={imgRef}
              src={
                selectedImage ||
                `${process.env.REACT_APP_API_URL || "http://localhost:5000"}${profile.profile_picture}`
              }
              alt="Profile Preview"
              style={{ display: "none" }}
              onLoad={() => {
                if (canvasRef.current) {
                  const ctx = canvasRef.current.getContext("2d");
                  const img = imgRef.current;
                  const size = 130;
                  ctx.clearRect(0, 0, size, size);
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, size, size);
                  const scale =
                    Math.max(size / img.width, size / img.height) * imageScale;
                  const imgWidth = img.width * scale;
                  const imgHeight = img.height * scale;
                  const dx = imagePosition.x + (size - imgWidth) / 2;
                  const dy = imagePosition.y + (size - imgHeight) / 2;
                  ctx.drawImage(img, dx, dy, imgWidth, imgHeight);
                }
              }}
            />
          </div>
        )}
        <button type="submit" style={{ marginTop: 15 }}>
          Save Profile Changes
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
