// dateUtils.js

// A mapping of day names to their full names for better display
const dayNameMapping = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

/**
 * Normalizes a time string to "HH:mm" format.
 * This ensures consistency across the application.
 *
 * @param {string} timeStr - The time string to normalize (e.g., "10:00:00").
 * @returns {string} The normalized time string (e.g., "10:00").
 */
export const normalizeTime = (timeStr) => {
  if (!timeStr) return "";
  return timeStr.substring(0, 5);
};

/**
 * Formats a Date object into a "YYYY-MM-DD" string.
 * This format is ideal for API requests and database queries.
 *
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
export const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Parses a date string into a local Date object.
 * This function handles both "YYYY-MM-DD" and full ISO strings.
 *
 * @param {string} dateString - The date string to parse.
 * @returns {Date} The parsed local date.
 */
export const parseBookingDateLocal = (dateString) => {
  if (!dateString) {
    return new Date(); // Fallback to current date
  }

  // For UTC timestamps, extract the date part to avoid timezone shifts
  if (dateString.includes("T")) {
    const datePart = dateString.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  // For "YYYY-MM-DD" format, parse directly as local date
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Generates an array of dates for the current week, starting from a given date.
 *
 * @param {Date} currentWeekStart - The start date of the week.
 * @returns {Array<Object>} An array of date objects for the week.
 */
export const getCurrentWeekDates = (currentWeekStart) => {
  const startOfWeek = new Date(currentWeekStart);
  const dates = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const localDateString = `${year}-${month}-${day}`;

    dates.push({
      date: localDateString,
      display: `${dayNames[date.getDay()]} ${date.getDate()}`,
      fullDate: date,
    });
  }
  return dates;
};

/**
 * Compares two dates to see if they are the same day.
 *
 * @param {Date} date1 - The first date.
 * @param {Date} date2 - The second date.
 * @returns {boolean} True if the dates are on the same day.
 */
export const isSameDay = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Gets today's date with the time set to the start of the day (00:00:00).
 *
 * @returns {Date} Today's date object.
 */
export const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}; 