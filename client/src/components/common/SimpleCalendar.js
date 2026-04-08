import React, { useState } from "react";
import { Box, Typography, Paper, Fade } from "@mui/material";

const SimpleCalendar = ({
  value,
  onChange,
  open,
  onClose,
  minDate,
  shouldDisableDate,
}) => {
  const [currentDate, setCurrentDate] = useState(
    value ? new Date(value) : new Date(),
  );

  if (!open) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of the month and how many days in the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Create array of days to display, including previous and next month days
  const days = [];

  // Add days from previous month
  const prevMonth = new Date(year, month - 1, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      isPrevMonth: true,
      isNextMonth: false,
    });
  }

  // Add days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      day: day,
      isCurrentMonth: true,
      isPrevMonth: false,
      isNextMonth: false,
    });
  }

  // Add days from next month to fill the grid (6 rows × 7 days = 42 days)
  const totalCells = 42;
  const remainingCells = totalCells - days.length;
  for (let day = 1; day <= remainingCells; day++) {
    days.push({
      day: day,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true,
    });
  }

  const handleDateClick = (dayObj) => {
    if (dayObj.isCurrentMonth) {
      const selectedDate = new Date(year, month, dayObj.day);

      // Check if the date is disabled (past dates or custom disabled dates)
      if (!isDateDisabled(dayObj)) {
        onChange(selectedDate);
        // Don't close the calendar automatically
      }
    }
  };

  const isDateDisabled = (dayObj) => {
    if (!dayObj.isCurrentMonth) return false;
    const dateToCheck = new Date(year, month, dayObj.day);

    // Check if date is before minDate (normalize both dates to midnight for comparison)
    let isBeforeMinDate = false;
    if (minDate) {
      const normalizedMinDate = new Date(
        minDate.getFullYear(),
        minDate.getMonth(),
        minDate.getDate(),
      );
      const normalizedDateToCheck = new Date(
        dateToCheck.getFullYear(),
        dateToCheck.getMonth(),
        dateToCheck.getDate(),
      );
      isBeforeMinDate = normalizedDateToCheck < normalizedMinDate;
    }

    // Check custom shouldDisableDate function
    const isCustomDisabled = shouldDisableDate
      ? shouldDisableDate(dateToCheck)
      : false;

    return isBeforeMinDate || isCustomDisabled;
  };

  const isDateSelected = (dayObj) => {
    if (!dayObj.isCurrentMonth || !value) return false;
    const selectedDate = new Date(value);
    return (
      selectedDate.getDate() === dayObj.day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToNextYear = () => {
    setCurrentDate(new Date(year + 1, month, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    // Also select today's date
    onChange(today);
    // Don't close the calendar, just navigate to today
  };

  return (
    <Fade in={open} timeout={200}>
      <Paper
        elevation={8}
        sx={{
          position: "absolute",
          top: "100%",
          left: 0,
          zIndex: 1300,
          width: "280px",
          padding: "16px",
          marginTop: "8px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          border: "none",
          fontFamily: "Quicksand, sans-serif",
        }}
      >
        {/* Close button */}
        <Box display="flex" justifyContent="flex-end" mb={1}>
          <Typography
            onClick={onClose}
            sx={{
              fontSize: "12px",
              color: "#1976d2 !important",
              cursor: "pointer",
              fontFamily: "Quicksand, sans-serif",
              margin: 0,
              padding: 0,
              "&:hover": {
                textDecoration: "underline",
                color: "#1565c0 !important",
              },
            }}
          >
            Close
          </Typography>
        </Box>

        {/* Header with month/year and navigation */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={1}
        >
          <Typography
            onClick={goToPreviousMonth}
            sx={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1976d2 !important",
              fontFamily: "Quicksand, sans-serif",
              cursor: "pointer",
              lineHeight: 1.2,
              userSelect: "none",
              "&:hover": {
                textDecoration: "underline",
                color: "#1565c0 !important",
              },
              margin: 0,
              padding: 0,
            }}
          >
            {"<"}
          </Typography>

          <Typography
            sx={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1a1a1a !important",
              fontFamily: "Quicksand, sans-serif",
              textAlign: "center",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {monthNames[month]} {year}
          </Typography>

          <Typography
            onClick={goToNextMonth}
            sx={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1976d2 !important",
              fontFamily: "Quicksand, sans-serif",
              cursor: "pointer",
              lineHeight: 1.2,
              userSelect: "none",
              "&:hover": {
                textDecoration: "underline",
                color: "#1565c0 !important",
              },
              margin: 0,
              padding: 0,
            }}
          >
            {">"}
          </Typography>
        </Box>

        {/* Day names header */}
        <Box
          display="grid"
          gridTemplateColumns="repeat(7, 1fr)"
          gap={"3px"}
          mb={1}
        >
          {dayNames.map((dayName) => (
            <Box
              key={dayName}
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{
                height: "28px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#666",
                fontFamily: "Quicksand, sans-serif",
              }}
            >
              {dayName}
            </Box>
          ))}
        </Box>

        {/* Calendar days */}
        <Box
          display="grid"
          gridTemplateColumns="repeat(7, 1fr)"
          gap={"3px"}
          mb={1}
        >
          {days.map((dayObj, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{
                height: "32px",
                cursor:
                  dayObj.isCurrentMonth && !isDateDisabled(dayObj)
                    ? "pointer"
                    : "default",
                backgroundColor: isDateSelected(dayObj)
                  ? "#6B46C1"
                  : "transparent",
                color: isDateSelected(dayObj)
                  ? "white"
                  : !dayObj.isCurrentMonth
                    ? "#bbb"
                    : isDateDisabled(dayObj)
                      ? "#ddd"
                      : "#333",
                "&:hover":
                  dayObj.isCurrentMonth && !isDateDisabled(dayObj)
                    ? {
                        backgroundColor: isDateSelected(dayObj)
                          ? "#5B3BA1"
                          : "#f5f5f5",
                        transform: "scale(1.05)",
                      }
                    : {},
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: isDateSelected(dayObj) ? 600 : 400,
                transition: "all 0.2s ease-in-out",
                fontFamily: "Quicksand, sans-serif",
                opacity: dayObj.isCurrentMonth ? 1 : 0.6,
              }}
              onClick={() => handleDateClick(dayObj)}
            >
              {dayObj.day}
            </Box>
          ))}
        </Box>

        {/* Year navigation and Today text */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mt={0}
        >
          <Typography
            onClick={goToToday}
            sx={{
              fontSize: "8px",
              fontWeight: 500,
              color: "#1976d2 !important",
              fontFamily: "Quicksand, sans-serif",
              cursor: "pointer",
              lineHeight: 1.2,
              userSelect: "none",
              "&:hover": {
                textDecoration: "underline",
                color: "#1565c0 !important",
              },
              margin: 0,
              padding: 0,
            }}
          >
            Today
          </Typography>

          <Typography
            onClick={goToNextYear}
            sx={{
              fontSize: "8px",
              fontWeight: 500,
              color: "#1976d2 !important",
              fontFamily: "Quicksand, sans-serif",
              cursor: "pointer",
              lineHeight: 1.2,
              userSelect: "none",
              "&:hover": {
                textDecoration: "underline",
                color: "#1565c0 !important",
              },
              margin: 0,
              padding: 0,
            }}
          >
            Next Year
          </Typography>
        </Box>
      </Paper>
    </Fade>
  );
};

export default SimpleCalendar;
