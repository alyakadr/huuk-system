import React, { useState } from 'react';
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
  Alert,
} from '@mui/material';
import {
  AccessTime,
  Search,
  KeyboardArrowDown,
  Clear,
  Schedule,
  WbSunny,
  WbTwilight,
  NightsStay,
  Favorite,
  TrendingUp,
  Close,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { debugLog } from '../../utils/debugLog';

// Styled components for enhanced UI
const StyledSelect = styled(Select)(({ theme }) => ({
  fontFamily: 'Quicksand, sans-serif',
  width: '100%',
  maxWidth: '280px',
  '& .MuiSelect-select': {
    fontFamily: 'Quicksand, sans-serif',
    fontWeight: 500,
    padding: '0 24px 0 10px',
    height: '38px',
    lineHeight: '38px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '5px',
    cursor: 'pointer',
    boxSizing: 'border-box',
    color: '#333',
    fontSize: '1rem',
    textAlign: 'left',
  },
  '& .MuiSelect-select:hover': {
    borderColor: '#baa173',
    boxShadow: '0 2px 4px rgba(186, 161, 115, 0.2)',
    transform: 'translateY(-1px)',
  },
  '& .MuiSelect-select:focus': {
    outline: 'none',
    borderColor: '#baa173',
    boxShadow: '0 0 0 2px rgba(186, 161, 115, 0.2)',
  },
  '& .MuiSelect-select.Mui-disabled': {
    backgroundColor: '#d3d3d3',
    color: '#666',
    cursor: 'not-allowed',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiSelect-icon': {
    right: '8px',
    color: '#666',
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontFamily: 'Quicksand, sans-serif',
  padding: '12px 16px',
  margin: '2px 8px',
  borderRadius: '8px',
  transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: '#baa173',
    color: '#fff',
    transform: 'translateY(-1px)',
    '& .MuiListItemIcon-root': {
      color: '#fff',
    },
  },
  '&.Mui-selected': {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    fontWeight: 600,
    '&:hover': {
      backgroundColor: '#bbdefb',
    },
  },
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  border: '1px solid #f0f0f0',
  marginTop: '8px',
  maxHeight: '450px',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f1f1',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#c1c1c1',
    borderRadius: '10px',
    '&:hover': {
      background: '#a8a8a8',
    },
  },
}));

const SearchField = styled(TextField)(({ theme }) => ({
  fontFamily: 'Quicksand, sans-serif',
  '& .MuiOutlinedInput-root': {
    fontFamily: 'Quicksand, sans-serif',
    borderRadius: '12px',
    '& fieldset': {
      borderColor: '#e0e0e0',
    },
    '&:hover fieldset': {
      borderColor: '#baa173',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#baa173',
    },
  },
  '& .MuiInputBase-input': {
    fontFamily: 'Quicksand, sans-serif',
    fontWeight: 500,
  },
}));

const EnhancedTimeSlotDropdown = ({ 
  value, 
  onChange, 
  disabled, 
  timeSlots, 
  loading,
  errors,
  timeSlotBookingCounts = {}, // New prop for tracking time slot popularity
  onTimeSlotSelected, // Callback to remove selected time slot
  selectedTimeSlots = [], // New prop for tracking selected time slots
  isEditMode = false, // New prop to indicate if we're in edit mode
  originalBookingTime = null, // New prop for the original booking time when editing
  selectedDate = null // New prop for the selected date
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);


  // Reduced prop logging frequency
  React.useEffect(() => {
    if (Math.random() < 0.1) {
      debugLog('[TIME SLOT DROPDOWN] Props updated:', {
        timeSlots: Array.isArray(timeSlots) ? timeSlots.length : 'not array',
        loading,
        disabled,
        errors,
        value,
        selectedDate: selectedDate ? selectedDate.toISOString() : null
      });
    }
  }, [timeSlots, loading, disabled, errors, value, selectedDate]);

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    debugLog('Time slot selected:', selectedValue);
    
    // Validate that the selected value exists in timeSlots or is empty
    if (selectedValue === '' || (Array.isArray(timeSlots) && timeSlots.some(slot => String(slot) === String(selectedValue)))) {
      onChange(selectedValue);
      
      // Remove the selected time slot from available slots for better UX
      if (selectedValue !== '' && onTimeSlotSelected) {
        onTimeSlotSelected(selectedValue);
      }
    } else {
      console.warn('Invalid time slot value selected:', selectedValue);
      onChange(''); // Reset to empty value
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
  };

  // Format time for display
  const formatTime = (timeSlot) => {
    return new Date(`1970-01-01T${timeSlot}`).toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );
  };

  // Get time period icon based on hour
  const getTimeIcon = (timeSlot) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    if (hour >= 6 && hour < 12) {
      return <WbSunny sx={{ color: '#ffa726', fontSize: '18px' }} />;
    } else if (hour >= 12 && hour < 17) {
      return <WbTwilight sx={{ color: '#ff9800', fontSize: '18px' }} />;
    } else if (hour >= 17 && hour < 20) {
      return <WbTwilight sx={{ color: '#f57c00', fontSize: '18px' }} />;
    } else {
      return <NightsStay sx={{ color: '#5c6bc0', fontSize: '18px' }} />;
    }
  };

  // Get time period label
  const getTimePeriod = (timeSlot) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    if (hour >= 6 && hour < 12) {
      return 'Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Afternoon';
    } else if (hour >= 17 && hour < 20) {
      return 'Evening';
    } else {
      return 'Night';
    }
  };

  // Check if time is popular based on overall booking data (not just current date)
  const isPopularTime = (timeSlot) => {
    const bookingCount = timeSlotBookingCounts[timeSlot] || 0;
    // Consider a time slot popular if it has more than 5 overall bookings
    return bookingCount > 5;
  };

  // Enhanced filtering: search by time or period and exclude selected slots (but not booked slots - server handles that)
  const filteredSlots = React.useMemo(() => {
    if (!Array.isArray(timeSlots)) {
      console.warn('🔧 [TIME SLOT DROPDOWN] timeSlots is not an array:', timeSlots);
      return [];
    }
    
    // Only filter by search term and previously selected slots in multi-booking scenarios
    // Don't filter by existing bookings - the server already handles availability checking
    const selectedTimes = selectedTimeSlots || [];
    
    // Reduced filtering logging frequency
    if (Math.random() < 0.1) {
      debugLog('[TIME SLOT FILTERING] Filtering process:', {
        totalTimeSlots: timeSlots.length,
        selectedTimesCount: selectedTimes.length,
        searchTerm: searchTerm
      });
    }

    const filtered = timeSlots.filter(slot => {
      try {
        const timeStr = formatTime(slot);
        const period = getTimePeriod(slot);
        const search = searchTerm.toLowerCase();
        
        // Check if slot matches search criteria
        const matchesSearch = timeStr.includes(search) || period.toLowerCase().includes(search);
        
        // Only exclude slots that were already selected in this session (for multi-booking)
        // Do NOT exclude slots based on existing bookings - server handles that
        const isNotSelected = !selectedTimes.some(selectedSlot => String(selectedSlot) === String(slot));
        
        const shouldInclude = matchesSearch && isNotSelected;
        
        if (!shouldInclude && searchTerm) {
          debugLog('🔍 [TIME SLOT FILTERING] Excluding slot due to search:', slot, 'searchTerm:', searchTerm);
        }
        if (!shouldInclude && selectedTimes.some(selectedSlot => String(selectedSlot) === String(slot))) {
          debugLog('🔍 [TIME SLOT FILTERING] Excluding slot - already selected:', slot);
        }
        
        return shouldInclude;
      } catch (error) {
        console.error('🔧 [TIME SLOT DROPDOWN] Error filtering slot:', slot, error);
        return false;
      }
    });
    
    // Reduced filtering result logging frequency
    if (Math.random() < 0.1) {
      debugLog('[TIME SLOT FILTERING] Result:', {
        inputSlots: timeSlots.length,
        filteredSlots: filtered.length,
        removedCount: timeSlots.length - filtered.length
      });
    }
    
    return filtered;
  }, [timeSlots, searchTerm, selectedTimeSlots]);

  // Group time slots by period
  const groupedSlots = React.useMemo(() => {
    if (!Array.isArray(filteredSlots) || filteredSlots.length === 0) {
      return {};
    }
    
    return filteredSlots.reduce((acc, slot) => {
      try {
        const period = getTimePeriod(slot);
        if (!acc[period]) {
          acc[period] = [];
        }
        acc[period].push(slot);
        return acc;
      } catch (error) {
        console.error('🔧 [TIME SLOT DROPDOWN] Error grouping slot:', slot, error);
        return acc;
      }
    }, {});
  }, [filteredSlots]);

  // Check current time status
  const getCurrentTimeStatus = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Check if the selected date is today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const selectedDateObj = selectedDate ? new Date(selectedDate) : null;
    if (selectedDateObj) {
      selectedDateObj.setHours(0, 0, 0, 0);
    }
    
    const isToday = selectedDateObj && selectedDateObj.getTime() === today.getTime();
    
    // Only apply isPastTenPM check if the selected date is today
    const isPastTenPM = isToday && (currentHour > 22 || (currentHour === 22 && currentMinute > 0));
    
    debugLog('📅 [TIME STATUS] Current time status:', {
      now: now.toISOString(),
      today: today.toISOString(),
      selectedDate: selectedDateObj ? selectedDateObj.toISOString() : null,
      isToday,
      currentHour,
      currentMinute,
      isPastTenPM
    });
    
    return { isPastTenPM, isToday, currentHour, currentMinute };
  };

  const { isPastTenPM, isToday } = getCurrentTimeStatus();

  // Check if we have no time slots available
  const noSlotsAvailable = !Array.isArray(timeSlots) || timeSlots.length === 0;

  return (
    <Box sx={{ width: '100%', maxWidth: 280, fontFamily: 'Quicksand, sans-serif', position: 'relative' }}>
      {/* Add Quicksand font import */}
      <link
        href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      
      <StyledSelect
        value={Array.isArray(timeSlots) && timeSlots.some(slot => String(slot) === String(value)) ? value : ''}
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
              <span style={{
                color: '#999',
                fontFamily: 'Quicksand, sans-serif',
                fontWeight: 400,
                fontSize: '1rem'
              }}>
                Select Time
              </span>
            );
          }
          
          return (
            <span style={{
              fontFamily: 'Quicksand, sans-serif',
              fontWeight: 500,
              fontSize: '1rem',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {getTimeIcon(selected)}
              {formatTime(selected)}
            </span>
          );
        }}
        MenuProps={{
          PaperProps: {
            component: StyledPaper,
          },
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
        }}
      >
        {/* Search Field */}
        <Box sx={{ p: 2, pb: 1 }}>
          <SearchField
            size="small"
            placeholder="Search time slots..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#666', fontSize: '20px' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Business Hours Status - Only show for today */}
        {isPastTenPM && (
          <Box sx={{ p: 2, pb: 1 }}>
            <Alert 
              severity="error" 
              sx={{ 
                borderRadius: '8px', 
                fontSize: '12px',
                fontFamily: 'Quicksand, sans-serif',
                '& .MuiAlert-message': {
                  fontFamily: 'Quicksand, sans-serif',
                  fontWeight: 500
                }
              }}
            >
              We're closed for today! Please book for tomorrow.
            </Alert>
          </Box>
        )}

        {/* Default empty option */}
        <StyledMenuItem 
          value=""
          onClick={(e) => {
            debugLog('🔴 [DIRECT CLICK] Clear selection clicked');
            e.preventDefault();
            e.stopPropagation();
            
            const syntheticEvent = {
              target: { value: '' },
              preventDefault: () => {},
              stopPropagation: () => {}
            };
            
            handleChange(syntheticEvent);
          }}
        >
          <ListItemIcon>
            <Schedule sx={{ color: '#baa173', fontSize: '20px' }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <span style={{ 
                fontFamily: 'Quicksand, sans-serif',
                fontWeight: 600,
                fontSize: '14px'
              }}>
                Select Time
              </span>
            }
          />
        </StyledMenuItem>

        {/* Closed message - Only show for today */}
        {isPastTenPM && (
          <StyledMenuItem disabled>
            <ListItemIcon>
              <Close sx={{ color: '#f44336', fontSize: '20px' }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <span style={{ 
                  fontFamily: 'Quicksand, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#f44336',
                  fontStyle: 'italic'
                }}>
                  CLOSED FOR TODAY!
                </span>
              }
            />
          </StyledMenuItem>
        )}

        {/* No slots available message */}
        {!isPastTenPM && noSlotsAvailable && (
          <StyledMenuItem disabled>
            <ListItemIcon>
              <Schedule sx={{ color: '#999', fontSize: '20px' }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <span style={{ 
                  fontFamily: 'Quicksand, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  No Available Slots
                </span>
              }
            />
          </StyledMenuItem>
        )}

        {/* No filtered results message */}
        {!isPastTenPM && !noSlotsAvailable && filteredSlots.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography 
              sx={{ 
                fontFamily: 'Quicksand, sans-serif',
                color: '#666',
                fontStyle: 'italic'
              }}
            >
              No time slots found
            </Typography>
          </Box>
        )}

        {/* Grouped Time Slots */}
        {!isPastTenPM && Object.entries(groupedSlots).map(([period, slots]) => (
          <div key={period}>
            {/* Period Header */}
            <Box sx={{ px: 2, py: 1 }}>
              <Typography 
                sx={{ 
                  fontFamily: 'Quicksand, sans-serif',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {period}
              </Typography>
            </Box>

            {/* Time Slots in Period */}
            {slots.map((slot) => {
              const isPopular = isPopularTime(slot);
              
              return (
                <StyledMenuItem 
                  key={slot} 
                  value={slot}
                  onClick={(e) => {
                    debugLog('🔴 [DIRECT CLICK] Time slot clicked:', slot);
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Create a synthetic event to match the Select component's expected format
                    const syntheticEvent = {
                      target: { value: slot },
                      preventDefault: () => {},
                      stopPropagation: () => {}
                    };
                    
                    handleChange(syntheticEvent);
                  }}
                >
                  <ListItemIcon>
                    {getTimeIcon(slot)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontFamily: 'Quicksand, sans-serif',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}>
                          {formatTime(slot)}
                        </span>
                        {isPopular && (
                          <Chip 
                            label="Popular" 
                            size="small" 
                            sx={{ 
                              height: '16px', 
                              fontSize: '10px',
                              backgroundColor: '#e91e63',
                              color: '#fff',
                              fontFamily: 'Quicksand, sans-serif',
                              fontWeight: 500
                            }} 
                          />
                        )}
                      </span>
                    }
                    secondary={
                      <span style={{ 
                        fontFamily: 'Quicksand, sans-serif',
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {period} slot
                      </span>
                    }
                  />
                </StyledMenuItem>
              );
            })}

            {/* Divider between periods */}
            <Divider sx={{ margin: '8px 16px', borderColor: '#f0f0f0' }} />
          </div>
        ))}
      </StyledSelect>
      
      {/* Clear button positioned next to dropdown arrow */}
      {value && (
        <IconButton
          size="small"
          onClick={handleClear}
          sx={{ 
            position: 'absolute',
            right: '32px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '2px',
            zIndex: 2,
            backgroundColor: 'transparent !important',
            border: 'none',
            boxShadow: 'none',
            minWidth: 'auto',
            width: '20px',
            height: '20px',
            '&:hover': {
              backgroundColor: 'transparent !important'
            },
            '&:focus': {
              backgroundColor: 'transparent !important'
            },
            '& .MuiTouchRipple-root': {
              display: 'none'
            }
          }}
        >
          <Clear 
            fontSize="small" 
            sx={{ 
              color: '#999', 
              fontSize: '16px',
              opacity: 0.7,
              '&:hover': {
                opacity: 1,
                color: '#666'
              }
            }} 
          />
        </IconButton>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {/* Error messages */}
      {errors && (
        <Typography color="error" sx={{ mt: 1, fontSize: '0.875rem' }}>
          {errors}
        </Typography>
      )}
    </Box>
  );
};

export default EnhancedTimeSlotDropdown;
