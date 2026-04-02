import { loadStripe } from "@stripe/stripe-js";

export const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

export const OPERATIONAL_HOURS = {
  start: { h: 9, m: 30 },
  end: { h: 21, m: 59 },
};

export const BOOKING_STATUSES = {
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
  ABSENT: "Absent",
};

export const PAYMENT_METHODS = {
  PAY_AT_OUTLET: "pay_at_outlet",
  ONLINE: "online_payment",
};

export const PAYMENT_STATUSES = {
  PAID: "paid",
  PENDING: "pending",
};

export const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ||
    "pk_test_51Rb0DWGh67kryOQJ96a7bK6mzQyCnoM9A8ecTT4VzPmV9E4lZnMz8zDexcTITwQOzoqy3Zm6QFUQ17cBgJXJ2eb6003T7jPdVJ",
);
