import React, { useState } from "react";
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Paper,
  ListItemIcon,
  ListItemText,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider,
} from "@mui/material";
import {
  ContentCut,
  Search,
  KeyboardArrowDown,
  Clear,
  AccessTime,
  LocalOffer,
  Star,
  TrendingUp,
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
    transition: "all 0.3s ease",
    cursor: "pointer",
    boxSizing: "border-box",
    color: "#333",
    fontSize: "1rem",
    textAlign: "left",
  },
  "& .MuiSelect-select:hover": {
    borderColor: "#baa173",
    boxShadow: "0 2px 4px rgba(186, 161, 115, 0.2)",
    transform: "translateY(-1px)",
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
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    backgroundColor: "#baa173",
    color: "#fff",
    transform: "translateY(-1px)",
    "& .MuiListItemIcon-root": {
      color: "#fff",
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
  maxHeight: "420px",
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

const EnhancedServiceDropdown = ({
  value,
  onChange,
  disabled,
  services,
  loading,
  errors,
  serviceBookingCounts = {}, // New prop for tracking service popularity
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Clear invalid values when services data changes
  React.useEffect(() => {
    if (value && Array.isArray(services) && services.length > 0) {
      const isValidValue = services.some(
        (service) => String(service.id) === String(value),
      );
      if (!isValidValue) {
        console.warn("🔧 [SERVICE DROPDOWN] Clearing invalid value:", value);
        onChange("");
      }
    }
    // Also clear value if services array becomes empty
    if (value && (!Array.isArray(services) || services.length === 0)) {
      console.warn(
        "🔧 [SERVICE DROPDOWN] Clearing value due to empty services array",
      );
      onChange("");
    }
  }, [services, value, onChange]);

  // Enhanced filtering: search by name
  const filteredServices = Array.isArray(services)
    ? services.filter((service) => {
        if (!service || !service.name) return false;
        const name = service.name.toLowerCase();
        const search = searchTerm.toLowerCase();

        // If search is single letter, match first letter
        if (search.length === 1 && /^[a-z]$/.test(search)) {
          return name.charAt(0) === search;
        }

        // Otherwise, search in the name
        return name.includes(search);
      })
    : [];

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    debugLog("Service selected:", selectedValue);

    // Validate that the selected value exists in services
    if (
      selectedValue === "" ||
      (Array.isArray(services) &&
        services.some(
          (service) => String(service.id) === String(selectedValue),
        ))
    ) {
      onChange(selectedValue);
    } else {
      console.warn("Invalid service value selected:", selectedValue);
      onChange(""); // Reset to empty value
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearchTerm("");
  };

  const selectedServiceData = Array.isArray(services)
    ? services.find((service) => String(service.id) === String(value))
    : null;

  // Format duration to display
  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}min`
        : `${hours}h`;
    }
  };

  // Format price to display
  const formatPrice = (price) => {
    return `RM ${parseFloat(price).toFixed(2)}`;
  };

  // Get service category icon
  const getServiceIcon = (serviceName) => {
    const name = serviceName.toLowerCase();
    if (name.includes("cut") || name.includes("trim")) {
      return <ContentCut sx={{ color: "#baa173", fontSize: "20px" }} />;
    } else if (name.includes("wash") || name.includes("shampoo")) {
      return <LocalOffer sx={{ color: "#baa173", fontSize: "20px" }} />;
    } else if (name.includes("style") || name.includes("treatment")) {
      return <Star sx={{ color: "#baa173", fontSize: "20px" }} />;
    } else {
      return <ContentCut sx={{ color: "#baa173", fontSize: "20px" }} />;
    }
  };

  // Determine if service is premium based on price
  const isPremiumService = (price) => {
    return parseFloat(price) > 50;
  };

  // Determine if service is popular based on overall booking count (not just current date)
  const isPopularService = (serviceId) => {
    const bookingCount = serviceBookingCounts[serviceId] || 0;
    // Consider a service popular if it has more than 10 overall bookings
    return bookingCount > 10;
  };

  // Group services by category for better organization
  const groupedServices = filteredServices.reduce((acc, service) => {
    const name = service.name.toLowerCase();
    let category = "Basic Services";

    if (
      name.includes("premium") ||
      name.includes("deluxe") ||
      isPremiumService(service.price)
    ) {
      category = "Premium Services";
    } else if (name.includes("wash") || name.includes("shampoo")) {
      category = "Wash & Care";
    } else if (name.includes("style") || name.includes("treatment")) {
      category = "Styling & Treatment";
    }

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {});

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
          Array.isArray(services) &&
          services.some((service) => String(service.id) === String(value))
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
                Select Service
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
              {getServiceIcon(selectedServiceData?.name || "")}
              {selectedServiceData?.name}
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
            placeholder="Search services..."
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
        {filteredServices.length === 0 && (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography
              sx={{
                fontFamily: "Quicksand, sans-serif",
                color: "#666",
                fontStyle: "italic",
              }}
            >
              No services found
            </Typography>
          </Box>
        )}

        {/* Default empty option */}
        <StyledMenuItem value="">
          <ListItemIcon>
            <ContentCut sx={{ color: "#baa173", fontSize: "20px" }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <span
                style={{
                  fontFamily: "Quicksand, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Select Service
              </span>
            }
          />
        </StyledMenuItem>

        {/* Grouped Services */}
        {Object.entries(groupedServices).map(([category, categoryServices]) => (
          <div key={category}>
            {/* Category Header */}
            <Box sx={{ px: 2, py: 1 }}>
              <Typography
                sx={{
                  fontFamily: "Quicksand, sans-serif",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#999",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {category}
              </Typography>
            </Box>

            {/* Services in Category */}
            {categoryServices.map((service) => {
              const isPremium = isPremiumService(service.price);
              const isPopular = isPopularService(service.id);

              return (
                <StyledMenuItem
                  key={service.id}
                  value={service.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    debugLog("Service clicked:", service.id, service.name);
                    onChange(service.id);
                    setOpen(false);
                  }}
                >
                  <ListItemIcon>{getServiceIcon(service.name)}</ListItemIcon>
                  <ListItemText
                    primary={
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontFamily: "Quicksand, sans-serif",
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        {service.name}
                        {isPremium && (
                          <Chip
                            label="Premium"
                            size="small"
                            sx={{
                              height: "16px",
                              fontSize: "10px",
                              backgroundColor: "#ff9800",
                              color: "#fff",
                              fontFamily: "Quicksand, sans-serif",
                              fontWeight: 500,
                            }}
                          />
                        )}
                        {isPopular && (
                          <Chip
                            label="Popular"
                            size="small"
                            sx={{
                              height: "16px",
                              fontSize: "10px",
                              backgroundColor: "#e91e63",
                              color: "#fff",
                              fontFamily: "Quicksand, sans-serif",
                              fontWeight: 500,
                            }}
                          />
                        )}
                      </span>
                    }
                    secondary={
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                          fontFamily: "Quicksand, sans-serif",
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <AccessTime
                            sx={{ fontSize: "12px", color: "#666" }}
                          />
                          <span>{formatDuration(service.duration)}</span>
                        </span>
                        <span
                          style={{
                            color: "#333",
                            fontWeight: 600,
                          }}
                        >
                          {formatPrice(service.price)}
                        </span>
                      </span>
                    }
                  />
                </StyledMenuItem>
              );
            })}

            {/* Divider between categories */}
            <Divider sx={{ margin: "8px 16px", borderColor: "#f0f0f0" }} />
          </div>
        ))}
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

export default EnhancedServiceDropdown;
