export const resolveBookingDuration = (
  bookingLike,
  services = [],
  fallbackDuration = 60,
) => {
  const directDuration =
    Number(bookingLike?.serviceDuration) ||
    Number(bookingLike?.service_duration) ||
    Number(bookingLike?.duration);

  if (directDuration) {
    return directDuration;
  }

  const matchedService = Array.isArray(services)
    ? services.find(
        (service) =>
          String(service.id) === String(bookingLike?.service_id) ||
          service.name === bookingLike?.service ||
          service.name === bookingLike?.service_name,
      )
    : null;

  return Number(matchedService?.duration) || Number(fallbackDuration) || 60;
};

export const formatBookingTimeRange = (startTime, durationMinutes) => {
  if (!startTime) {
    return "N/A";
  }

  const [hours, minutes] = String(startTime).split(":").map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);

  const endDate = new Date(
    startDate.getTime() + Number(durationMinutes || 60) * 60000,
  );
  const formatTime = (value) =>
    value.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
};
