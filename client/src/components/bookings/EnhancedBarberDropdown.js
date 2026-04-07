import React, { useState } from "react";
import {
  Select,
  MenuItem,
  Box,
  Typography,
  Paper,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Avatar,
  Divider,
} from "@mui/material";
import {
  Search,
  KeyboardArrowDown,
  Clear,
  PersonOutline,
  Group,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { debugLog } from "../../utils/debugLog";

// Styled components for enhanced UI
const StyledSelect = styled(Select)(({ theme }) => ({
  fontFamily: "Quicksand, sans-serif",
  width: "100%",
  maxWidth: "280px",
  "& .MuiSelect-select": {
    fontFamily: "Quicksand, sans-serif",
    fontWeight: 500,
    padding: "0 24px 0 10px",
    height: "38px",
    lineHeight: "38px",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fff",
    border: "1px solid #ccc",
    borderRadius: "5px",
    cursor: "pointer",
    boxSizing: "border-box",
    color: "#333",
    fontSize: "1rem",
    textAlign: "left",
  },
  "& .MuiSelect-select:hover": {
    borderColor: "#baa173",
    boxShadow: "0 2px 4px rgba(186, 161, 115, 0.2)",
  },
  "& .MuiSelect-select:focus": {
    outline: "none",
    borderColor: "#baa173",
    boxShadow: "0 0 0 2px rgba(186, 161, 115, 0.2)",
  },
  "& .MuiSelect-select.Mui-disabled": {
    backgroundColor: "#d3d3d3",
    color: "#666",
    cursor: "not-allowed",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    border: "none",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    border: "none",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "none",
  },
  "& .MuiSelect-icon": {
    right: "8px",
    color: "#666",
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontFamily: "Quicksand, sans-serif",
  padding: "12px 16px",
  margin: "2px 8px",
  borderRadius: "8px",
  position: "relative",
  "&:hover": {
    backgroundColor: "#baa173",
    color: "#fff",
    "& .MuiListItemIcon-root": {
      color: "#fff",
    },
    "& .cancel-button": {
      display: "block",
    },
  },
  "&.Mui-selected": {
    backgroundColor: "#e3f2fd",
    color: "#1976d2",
    fontWeight: 600,
    "&:hover": {
      backgroundColor: "#bbdefb",
    },
  },
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
  border: "1px solid #f0f0f0",
  marginTop: "8px",
  maxHeight: "400px",
  "&::-webkit-scrollbar": {
    width: "6px",
  },
  "&::-webkit-scrollbar-track": {
    background: "#f1f1f1",
    borderRadius: "10px",
  },
  "&::-webkit-scrollbar-thumb": {
    background: "#c1c1c1",
    borderRadius: "10px",
    "&:hover": {
      background: "#a8a8a8",
    },
  },
}));

const SearchField = styled(TextField)(({ theme }) => ({
  fontFamily: "Quicksand, sans-serif",
  "& .MuiOutlinedInput-root": {
    fontFamily: "Quicksand, sans-serif",
    borderRadius: "12px",
    "& fieldset": {
      borderColor: "#e0e0e0",
    },
    "&:hover fieldset": {
      borderColor: "#baa173",
    },
    "&.Mui-focused fieldset": {
      borderColor: "#baa173",
    },
  },
  "& .MuiInputBase-input": {
    fontFamily: "Quicksand, sans-serif",
    fontWeight: 500,
  },
}));

const EnhancedBarberDropdown = ({
  value,
  onChange,
  disabled,
  staff,
  loading,
  errors,
  staffAvailabilities = {},
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Clear invalid values when staff data changes
  React.useEffect(() => {
    if (value && value !== "any" && Array.isArray(staff) && staff.length > 0) {
      const isValidValue = staff.some((member) => member.id === value);
      if (!isValidValue) {
        console.warn(
          "[BARBER DROPDOWN] Clearing invalid value:",
          value,
          "Available staff:",
          staff.map((s) => ({ id: s.id, name: s.username })),
        );
        onChange("");
      }
    }
    // Also clear value if staff array becomes empty
    if (
      value &&
      value !== "any" &&
      (!Array.isArray(staff) || staff.length === 0)
    ) {
      console.warn("[BARBER DROPDOWN] Clearing value due to empty staff array");
      onChange("");
    }
  }, [staff, value, onChange]);

  // Enhanced filtering: search by name
  const filteredStaff = staff.filter((member) => {
    const name = member.username.toLowerCase();
    const search = searchTerm.toLowerCase();

    // If search is single letter, match first letter
    if (search.length === 1 && /^[a-z]$/.test(search)) {
      return name.charAt(0) === search;
    }

    // Otherwise, search in the name
    return name.includes(search);
  });

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    debugLog("Barber selected:", selectedValue);

    // Validate that the selected value exists in staff or is valid special value
    if (
      selectedValue === "" ||
      selectedValue === "any" ||
      (Array.isArray(staff) &&
        staff.some((member) => member.id === selectedValue))
    ) {
      onChange(selectedValue);
    } else {
      console.warn("Invalid barber value selected:", selectedValue);
      onChange(""); // Reset to empty value
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearchTerm("");
  };

  const selectedStaffData = staff.find((member) => member.id === value);

  // Generate initials for avatar
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get availability count for a staff member
  const getAvailabilityCount = (staffId) => {
    const availability = staffAvailabilities[staffId];
    return availability ? availability.length : 0;
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 280,
        fontFamily: "Quicksand, sans-serif",
        position: "relative",
      }}
    >
      {/* Add Quicksand font import */}
      <link
        href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <StyledSelect
        value={
          value === "any" ||
          (Array.isArray(staff) && staff.some((member) => member.id === value))
            ? value
            : ""
        }
        onChange={handleChange}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        disabled={disabled}
        displayEmpty
        fullWidth
        IconComponent={KeyboardArrowDown}
        renderValue={(selected) => {
          if (!selected) {
            return (
              <span
                style={{
                  color: "#999",
                  fontFamily: "Quicksand, sans-serif",
                  fontWeight: 400,
                  fontSize: "1rem",
                }}
              >
                Select Barber
              </span>
            );
          }

          if (selected === "any") {
            return (
              <span
                style={{
                  fontFamily: "Quicksand, sans-serif",
                  fontWeight: 500,
                  fontSize: "1rem",
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Group style={{ color: "#baa173", fontSize: "18px" }} />
                Any Barber
              </span>
            );
          }

          return (
            <span
              style={{
                fontFamily: "Quicksand, sans-serif",
                fontWeight: 500,
                fontSize: "1rem",
                color: "#333",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: "10px",
                  bgcolor: "#baa173",
                  color: "#fff",
                }}
              >
                {selectedStaffData
                  ? getInitials(selectedStaffData.username)
                  : "?"}
              </Avatar>
              {selectedStaffData?.username}
            </span>
          );
        }}
        MenuProps={{
          PaperProps: {
            component: StyledPaper,
          },
          anchorOrigin: {
            vertical: "bottom",
            horizontal: "left",
          },
          transformOrigin: {
            vertical: "top",
            horizontal: "left",
          },
        }}
      >
        {/* Search Field */}
        <Box sx={{ p: 2, pb: 1 }}>
          <SearchField
            size="small"
            placeholder="Search barbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "#666", fontSize: "20px" }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* No results message */}
        {filteredStaff.length === 0 && (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography
              sx={{
                fontFamily: "Quicksand, sans-serif",
                color: "#666",
                fontStyle: "italic",
              }}
            >
              No barbers found
            </Typography>
          </Box>
        )}

        {/* Default empty option */}
        <StyledMenuItem value="">
          <ListItemIcon>
            <PersonOutline sx={{ color: "#baa173", fontSize: "20px" }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography
                sx={{
                  fontFamily: "Quicksand, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Select Barber
              </Typography>
            }
          />
        </StyledMenuItem>

        {/* Any Barber option */}
        <StyledMenuItem value="any">
          <ListItemIcon>
            <Group sx={{ color: "#baa173", fontSize: "20px" }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography
                sx={{
                  fontFamily: "Quicksand, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Any Barber
              </Typography>
            }
            secondary={
              <Typography
                sx={{
                  fontFamily: "Quicksand, sans-serif",
                  fontSize: "12px",
                  color: "#666",
                  fontStyle: "italic",
                }}
              >
                Let us choose the best available barber
              </Typography>
            }
          />
        </StyledMenuItem>

        {/* Divider */}
        {staff.length > 0 && (
          <Divider sx={{ margin: "8px 16px", borderColor: "#f0f0f0" }} />
        )}

        {/* Staff List */}
        {filteredStaff.map((member) => {
          const availabilityCount = getAvailabilityCount(member.id);

          return (
            <StyledMenuItem key={member.id} value={member.id}>
              <ListItemIcon>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: "12px",
                    bgcolor: "#baa173",
                    color: "#fff",
                  }}
                >
                  {getInitials(member.username)}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      fontFamily: "Quicksand, sans-serif",
                      fontWeight: 600,
                      fontSize: "14px",
                    }}
                  >
                    {member.username}
                  </Typography>
                }
                secondary={
                  <Typography
                    sx={{
                      fontFamily: "Quicksand, sans-serif",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    {availabilityCount > 0
                      ? `${availabilityCount} slots available`
                      : "Limited availability"}
                  </Typography>
                }
              />
            </StyledMenuItem>
          );
        })}
      </StyledSelect>

      {/* Clear button positioned next to dropdown arrow */}
      {value && (
        <IconButton
          size="small"
          onClick={handleClear}
          sx={{
            position: "absolute",
            right: "32px",
            top: "50%",
            transform: "translateY(-50%)",
            padding: "2px",
            zIndex: 2,
            backgroundColor: "transparent !important",
            border: "none",
            boxShadow: "none",
            minWidth: "auto",
            width: "20px",
            height: "20px",
            "&:hover": {
              backgroundColor: "transparent !important",
            },
            "&:focus": {
              backgroundColor: "transparent !important",
            },
            "& .MuiTouchRipple-root": {
              display: "none",
            },
          }}
        >
          <Clear
            fontSize="small"
            sx={{
              color: "#999",
              fontSize: "16px",
              opacity: 0.7,
              "&:hover": {
                opacity: 1,
                color: "#666",
              },
            }}
          />
        </IconButton>
      )}

      {/* Loading indicator */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Error messages */}
      {errors && (
        <Typography color="error" sx={{ mt: 1, fontSize: "0.875rem" }}>
          {errors}
        </Typography>
      )}
    </Box>
  );
};

export default EnhancedBarberDropdown;
