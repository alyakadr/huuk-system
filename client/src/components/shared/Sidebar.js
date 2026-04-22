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
    const parentWithActiveSubNav = navItems.find(
      (item) =>
        item.subNav &&
        item.subNav.some((subItem) => subItem.path === location.pathname),
    );

    setOpenDropdown(
      parentWithActiveSubNav ? parentWithActiveSubNav.label : null,
    );
  }, [location.pathname, navItems]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const next = new Set(prev);
          next.delete(url);
          return next;
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
    } catch (error) {
      console.error(error);
    }

    try {
      Cookies.remove("email");
    } catch (error) {
      console.error(error);
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
    ].forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(error);
      }
    });

    try {
      sessionStorage.clear();
    } catch (error) {
      console.error(error);
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
      "mb-0.5 box-border flex w-full min-h-[34px] items-center py-1.5 text-[15px] md:text-[14px] font-quicksand transition-[padding,background-color,color] duration-300 ease-in-out",
      minimized ? "justify-center px-0" : "px-3",
      isActive
        ? "bg-huuk-accent font-bold text-huuk-card"
        : "bg-transparent text-white/92",
      !disabled
        ? "cursor-pointer hover:bg-huuk-accent hover:font-bold hover:text-huuk-card"
        : "cursor-not-allowed opacity-50",
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
    <aside
      key={location.pathname}
      className={`fixed left-0 top-0 z-[1200] flex h-screen min-h-0 flex-col overflow-x-hidden rounded-r-[28px] bg-huuk-card font-quicksand text-white transition-[width] duration-300 ease-in-out ${minimized ? "w-[72px]" : "w-[248px]"}`}
    >
      <button
        className="absolute left-4 top-3 z-[1300] flex h-8 w-8 items-center justify-center rounded-full border-none bg-white shadow"
        onClick={toggleSidebar}
        title={minimized ? "Expand sidebar" : "Collapse sidebar"}
        aria-label="Toggle sidebar"
      >
        <span className="material-icons text-base text-black">
          {minimized ? "chevron_right" : "chevron_left"}
        </span>
      </button>

      <div
        className={`relative flex cursor-pointer flex-col items-center border-b border-white/10 px-4 text-center transition-[margin,padding] duration-300 ease-in-out ${minimized ? "mt-14 pb-4 pt-2" : "mt-6 pb-5 pt-3"}`}
        onClick={handleEditProfile}
      >
        <div className="group relative inline-block">
          <img
            src={profileImageUrl}
            alt="Profile"
            className={`rounded-full object-cover transition-[width,height,transform] duration-300 ease-in-out group-hover:scale-105 ${minimized ? "h-12 w-12" : "h-[108px] w-[108px]"}`}
            onError={(event) => {
              if (event.target.src !== defaultProfile) {
                event.target.src = defaultProfile;
              }
            }}
          />
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="material-icons mb-1 text-xl">edit</span>
            {!minimized && <span>Edit Profile</span>}
          </div>
        </div>

        <div
          className={`grid w-full overflow-hidden transition-[grid-template-rows,opacity,margin-top] duration-300 ease-in-out ${minimized ? "mt-0 grid-rows-[0fr] opacity-0" : "mt-4 grid-rows-[1fr] opacity-100"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <h2 className="mb-0 text-[17px] font-bold text-white">
              {profile?.username || user?.username || "User"}
            </h2>
            <p className="m-0 text-sm font-semibold text-white/90">
              {rawRole
                ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
                : "Role"}
            </p>
            {shouldShowOutlet && (
              <p className="mt-4 text-sm text-white/85">
                {displayedOutlet || "Outlet not assigned"}
              </p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="m-0 list-none p-0">
          {navItems.map((item) => {
            const hasSubNav = !!item.subNav;
            const isOpen = openDropdown === item.label;
            const hasActiveSubNav =
              hasSubNav &&
              item.subNav.some((subItem) => subItem.path === location.pathname);
            const isActive = item.path === location.pathname;
            const isParentOrSelfActive = isActive || hasActiveSubNav;

            return (
              <li key={item.label} className="list-none">
                <div
                  className={navItemCls(isParentOrSelfActive, item.disabled)}
                  title={minimized ? item.label : undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    if (hasSubNav) {
                      setOpenDropdown(isOpen ? null : item.label);
                      if (
                        !isOpen &&
                        item.path &&
                        item.path !== location.pathname
                      ) {
                        navigate(item.path);
                      }
                    } else if (item.path) {
                      navigate(item.path);
                      setOpenDropdown(null);
                    }
                  }}
                >
                  <span
                    className={`flex min-w-0 items-center ${minimized ? "justify-center" : "flex-1"}`}
                  >
                    <span className="material-icons shrink-0 text-[21px]">
                      {item.icon}
                    </span>
                    <span
                      className={`overflow-hidden whitespace-nowrap leading-tight transition-[max-width,opacity,margin-left] duration-300 ease-in-out ${minimized ? "ml-0 max-w-0 opacity-0" : "ml-2.5 max-w-[180px] opacity-100"}`}
                    >
                      {item.label}
                    </span>
                  </span>
                  {hasSubNav && (
                    <span
                      className={`material-icons shrink-0 overflow-hidden text-[20px] transition-[max-width,opacity] duration-300 ease-in-out ${minimized ? "max-w-0 opacity-0" : "max-w-[20px] opacity-100"}`}
                    >
                      {isOpen ? "expand_less" : "expand_more"}
                    </span>
                  )}
                </div>

                {isOpen && hasSubNav && !minimized && (
                  <ul className="mb-1 ml-[30px] mt-0.5 list-none border-l-2 border-huuk-accent pl-3">
                    {item.subNav.map((subItem) => (
                      <li
                        key={subItem.label}
                        className={[
                          "my-0.5 min-h-[30px] rounded-[2px] px-3 py-1 text-[15px] leading-tight break-words transition-colors duration-150",
                          subItem.path === location.pathname
                            ? "bg-huuk-accent font-bold text-huuk-card"
                            : "text-white/90 hover:rounded-[2px] hover:bg-huuk-accent hover:font-bold hover:text-huuk-card",
                          subItem.disabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer",
                        ].join(" ")}
                        onClick={() => {
                          if (subItem.disabled) return;
                          navigate(subItem.path);
                          setOpenDropdown(null);
                        }}
                      >
                        {subItem.label}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="mt-auto shrink-0 border-t border-white/10 pb-4 pt-5">
        <ul className="m-0 list-none p-0">
          {footerItems.map(({ icon, label, onClick }) => (
            <li
              key={label}
              className={`mb-0.5 flex min-h-[34px] cursor-pointer items-center py-1.5 text-[15px] text-white/92 transition-[padding,background-color,color] duration-300 ease-in-out hover:bg-huuk-accent hover:font-bold hover:text-huuk-card ${minimized ? "justify-center px-0" : "px-3"}`}
              title={minimized ? label : undefined}
              onClick={onClick}
            >
              <span className="material-icons shrink-0 text-[21px]">
                {icon}
              </span>
              <span
                className={`overflow-hidden whitespace-nowrap leading-tight transition-[max-width,opacity,margin-left] duration-300 ease-in-out ${minimized ? "ml-0 max-w-0 opacity-0" : "ml-2.5 max-w-[180px] opacity-100"}`}
              >
                {label}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
