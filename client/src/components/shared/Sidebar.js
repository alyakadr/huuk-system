import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProfile } from "../../ProfileContext";
import Cookies from "js-cookie";

const defaultProfile =
  "data:image/svg+xml,%3Csvg width='130' height='130' viewBox='0 0 130 130' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='130' height='130' rx='65' fill='%23e5e7eb'/%3E%3Ccircle cx='65' cy='45' r='18' fill='%239ca3af'/%3E%3Cpath d='M35 100c0-16.57 13.43-30 30-30s30 13.43 30 30v10H35v-10z' fill='%239ca3af'/%3E%3C/svg%3E";

const Sidebar = ({ user, navItems, minimized, toggleSidebar }) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, updateProfile, setIsLoggingOut } = useProfile();
  const baseURL = "http://localhost:5000";

  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!user || !user.id) return;
    const shouldSyncProfile =
      !profile ||
      profile.id !== user.id ||
      profile.username !== user.username ||
      profile.role !== user.role ||
      profile.outlet !== user.outlet ||
      profile.profile_picture !== user.profile_picture;
    if (shouldSyncProfile) updateProfile(user);
  }, [
    user?.id,
    user?.username,
    user?.role,
    user?.outlet,
    user?.profile_picture,
    profile?.id,
    profile?.username,
    profile?.role,
    profile?.outlet,
    profile?.profile_picture,
    updateProfile,
  ]);

  const rawRole = profile?.role || user?.role || "";
  const normalizedRole = String(rawRole).trim().toLowerCase();

  const resolveDisplayedOutlet = () => {
    if (profile?.outlet) return profile.outlet;
    if (user?.outlet) return user.outlet;
    try {
      const stored = JSON.parse(
        localStorage.getItem("staff_loggedInUser") || "{}",
      );
      return stored?.outlet || "";
    } catch {
      return "";
    }
  };

  const displayedOutlet = resolveDisplayedOutlet();
  const shouldShowOutlet =
    normalizedRole === "staff" || normalizedRole === "manager";

  const [profileImageUrl, setProfileImageUrl] = useState(defaultProfile);
  const [imageLoading, setImageLoading] = useState(false);
  const [failedUrls, setFailedUrls] = useState(new Set());

  useEffect(() => {
    const profilePicture = profile?.profile_picture || user?.profile_picture;
    if (
      !profilePicture ||
      profilePicture === "/Uploads/profile_pictures/default.jpg"
    ) {
      if (profileImageUrl !== defaultProfile) {
        setProfileImageUrl(defaultProfile);
        setImageLoading(false);
        setFailedUrls(new Set());
      }
      return;
    }
    const url = profilePicture.startsWith("http")
      ? profilePicture
      : `${baseURL}${profilePicture}`;
    const profileChanged =
      profile?.profile_picture &&
      profile.profile_picture !== user?.profile_picture;
    if (profileChanged) setFailedUrls(new Set());
    if (!profileChanged && failedUrls.has(url)) {
      setProfileImageUrl(defaultProfile);
      return;
    }
    if (url !== profileImageUrl && !imageLoading) {
      setImageLoading(true);
      const img = new Image();
      const cacheBustedUrl = profileChanged ? `${url}?t=${Date.now()}` : url;
      const timeoutId = setTimeout(() => {
        setFailedUrls((prev) => new Set([...prev, url]));
        setProfileImageUrl(defaultProfile);
        setImageLoading(false);
      }, 5000);
      img.onload = () => {
        clearTimeout(timeoutId);
        setProfileImageUrl(url);
        setImageLoading(false);
        setFailedUrls((prev) => {
          const s = new Set(prev);
          s.delete(url);
          return s;
        });
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        setFailedUrls((prev) => new Set([...prev, url]));
        setProfileImageUrl(defaultProfile);
        setImageLoading(false);
      };
      img.src = cacheBustedUrl;
    }
  }, [
    profile?.profile_picture,
    user?.profile_picture,
    profileImageUrl,
    imageLoading,
    failedUrls,
    baseURL,
  ]);

  const handleLogout = () => {
    localStorage.setItem("FORCE_LOGOUT_IN_PROGRESS", "true");
    if (setIsLoggingOut) setIsLoggingOut(true);
    try {
      updateProfile(null);
    } catch (e) {
      console.error(e);
    }
    try {
      Cookies.remove("email");
    } catch (e) {
      console.error(e);
    }
    [
      "staff_loggedInUser",
      "staff_token",
      "staff_userId",
      "customer_loggedInUser",
      "customer_token",
      "customer_userId",
      "loggedInUser",
      "token",
      "userId",
      "isTimeInConfirmed",
      "timeIn",
      "lastVisitedPage",
      "switchModeTimestamp",
      "FORCE_LOGOUT_IN_PROGRESS",
    ].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        console.error(e);
      }
    });
    try {
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      try {
        localStorage.removeItem("FORCE_LOGOUT_IN_PROGRESS");
        window.location.replace("/staff-login?fromLogout=true");
      } catch {
        window.location.href = "/staff-login?fromLogout=true";
      }
    }, 250);
  };

  const handleEditProfile = () => {
    if (user?.role === "manager") navigate("/manager/edit-profile");
    else if (user?.role === "staff") navigate("/staff/edit-profile");
    else navigate("/edit-profile");
  };

  const navItemCls = (isActive, disabled) =>
    [
      "flex items-center px-5 py-1 mb-1 text-sm font-quicksand transition-all duration-200 list-none",
      isActive
        ? "bg-huuk-accent text-huuk-card font-bold"
        : "bg-huuk-card text-white",
      !disabled
        ? "hover:bg-huuk-accent hover:text-huuk-card hover:font-bold cursor-pointer"
        : "cursor-not-allowed",
    ].join(" ");

  const footerItems = [
    { icon: "help_outline", label: "Help", onClick: undefined },
    {
      icon: "settings",
      label: "Setting",
      onClick: () => {
        if (user?.role === "manager") navigate("/manager/settings");
        else if (user?.role === "staff") navigate("/staff/settings");
        else navigate("/");
      },
    },
    { icon: "logout", label: "Log Out", onClick: handleLogout },
  ];

  return (
    <div
      key={location.pathname}
      className={`fixed left-0 top-0 h-screen bg-huuk-card text-white flex flex-col rounded-[25px] font-quicksand z-[1200] transition-all duration-300 ease-in-out overflow-hidden ${minimized ? "w-[72px]" : "w-[280px]"}`}
    >
      {/* Toggle button */}
      <button
        className="absolute top-3 left-5 bg-white border-none rounded-full w-8 h-8 cursor-pointer flex justify-center items-center shadow z-[1100]"
        onClick={toggleSidebar}
        title={minimized ? "Expand sidebar" : "Collapse sidebar"}
        aria-label="Toggle sidebar"
      >
        <span className="material-icons text-base">
          {minimized ? "chevron_right" : "chevron_left"}
        </span>
      </button>

      {/* Profile section */}
      <div
        className={`flex flex-col items-center text-center cursor-pointer relative group ${minimized ? "pt-5 mt-6" : "mt-7 mb-2.5"}`}
        onClick={handleEditProfile}
      >
        <div className="relative inline-block">
          <img
            src={profileImageUrl}
            alt="Profile"
            className={`${minimized ? "w-12 h-12" : "w-[130px] h-[130px]"} rounded-full object-cover transition-transform duration-300 hover:scale-105`}
            onError={(e) => {
              if (e.target.src !== defaultProfile)
                e.target.src = defaultProfile;
            }}
          />
          <div className="absolute inset-0 bg-black/70 rounded-full flex flex-col items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <span className="material-icons text-xl mb-1">edit</span>
            {!minimized && <span>Edit Profile</span>}
          </div>
        </div>
        {!minimized && (
          <>
            <h2 className="text-white text-base font-bold mt-2 mb-0">
              {profile?.username || user?.username || "User"}
            </h2>
            <p className="text-white text-sm mb-4 mt-0">
              {rawRole
                ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
                : "Role"}
            </p>
            {shouldShowOutlet && (
              <p className="text-white text-sm">
                {displayedOutlet || "Outlet not assigned"}
              </p>
            )}
          </>
        )}
      </div>

      {/* Main nav */}
      <nav className="overflow-y-auto flex-1">
        <ul className="list-none p-0 m-0">
          {navItems.map((item) => {
            const hasSubNav = !!item.subNav;
            const isOpen = openDropdown === item.label;
            const isActive =
              item.path === location.pathname ||
              (hasSubNav &&
                item.subNav.some((s) => s.path === location.pathname));
            return (
              <li key={item.label} className="list-none">
                <div
                  className={navItemCls(isActive, item.disabled)}
                  style={{ opacity: item.disabled ? 0.5 : 1 }}
                  title={
                    minimized
                      ? item.disabled
                        ? `${item.label} (Disabled)`
                        : item.label
                      : undefined
                  }
                  onClick={() => {
                    if (item.disabled) return;
                    if (hasSubNav) setOpenDropdown(isOpen ? null : item.label);
                    else if (item.path) {
                      navigate(item.path);
                      setOpenDropdown(null);
                    }
                  }}
                >
                  <span
                    className={`material-icons mr-2 text-xl transition-colors duration-200 ${isActive ? "text-huuk-card" : "text-white"}`}
                  >
                    {item.icon}
                  </span>
                  {!minimized && item.label}
                </div>
                {isOpen && hasSubNav && !minimized && (
                  <ul className="list-none m-0 mb-2.5 ml-10 pl-4 border-l-2 border-huuk-accent p-0">
                    {item.subNav.map((sub) => (
                      <li
                        key={sub.label}
                        className={[
                          "text-sm py-1 list-none",
                          sub.path === location.pathname
                            ? "text-huuk-accent font-bold"
                            : "text-white",
                          !sub.disabled
                            ? "cursor-pointer hover:text-huuk-accent"
                            : "cursor-not-allowed opacity-50",
                        ].join(" ")}
                        style={{ opacity: sub.disabled ? 0.5 : 1 }}
                        onClick={() => {
                          if (sub.disabled) return;
                          navigate(sub.path);
                          setOpenDropdown(null);
                        }}
                      >
                        {sub.label}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer nav */}
      {!openDropdown && (
        <nav className="mt-auto pt-4 border-t border-gray-700">
          <ul className="list-none p-0 m-0">
            {footerItems.map(({ icon, label, onClick }) => (
              <li
                key={label}
                className="flex items-center px-5 py-1 mb-1 text-sm text-white bg-huuk-card cursor-pointer hover:bg-huuk-accent hover:text-huuk-card hover:font-bold transition-all duration-200 list-none"
                title={minimized ? label : undefined}
                onClick={onClick}
              >
                <span className="material-icons mr-2 text-xl">{icon}</span>
                {!minimized && label}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
};

export default Sidebar;
