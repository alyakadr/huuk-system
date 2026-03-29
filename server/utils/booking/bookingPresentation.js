"use strict";

const OPERATING_HOURS_START = "10:00:00";
const OPERATING_HOURS_END = "21:00:00";
const OUTSIDE_OPERATING_HOURS_MESSAGE =
  "Slot outside operating hours (10:00 AM - 9:00 PM UTC)";

const formatDateForDb = (date) => {
  const parsedDate = new Date(date);
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const year = parsedDate.getFullYear();
  return `${day}/${month}/${year}`;
};

const isOutsideOperatingHours = (date, slotStart) => {
  const operatingStart = new Date(`${date}T${OPERATING_HOURS_START}Z`);
  const operatingEnd = new Date(`${date}T${OPERATING_HOURS_END}Z`);
  return slotStart < operatingStart || slotStart > operatingEnd;
};

const toPaymentMethodLabel = (paymentMethod) => {
  return paymentMethod === "Stripe" ? "Online Payment" : paymentMethod;
};

const buildBookingPaymentDetails = ({
  id,
  outlet,
  service,
  date,
  time,
  customer_name,
  staff_name,
  price,
  payment_method,
  payment_status,
}) => {
  return {
    id,
    outlet: outlet || "",
    service: service || "",
    date: formatDateForDb(date),
    time,
    customer_name,
    staff_name: staff_name || "",
    price: price || 0,
    payment_method: toPaymentMethodLabel(payment_method),
    payment_status,
  };
};

module.exports = {
  formatDateForDb,
  isOutsideOperatingHours,
  OUTSIDE_OPERATING_HOURS_MESSAGE,
  toPaymentMethodLabel,
  buildBookingPaymentDetails,
};
