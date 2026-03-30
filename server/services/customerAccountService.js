"use strict";

const bcrypt = require("bcryptjs");
const User = require("../models/User");

const DEFAULT_PASSWORD = "defaultpassword123";

const buildFallbackEmail = (phoneNumber, customerName) => {
  if (phoneNumber) {
    return `customer_${phoneNumber}_${Date.now()}@huuksystem.com`;
  }

  const normalizedName = (customerName || "guest")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();

  return `customer_${normalizedName}_${Date.now()}@huuksystem.com`;
};

const resolveOrCreateCustomerUser = async ({
  providedUserId,
  phoneNumber,
  customerName,
  isApproved = 1,
}) => {
  if (providedUserId) {
    return providedUserId;
  }

  if (phoneNumber) {
    const existingUser = await User.findOne({
      phone_number: phoneNumber,
      role: "customer",
    }).lean();
    if (existingUser) {
      return existingUser._id.toString();
    }
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const normalizedName = (customerName || "").trim();

  const createdUser = await User.create({
    phone_number: phoneNumber || null,
    password: passwordHash,
    email: buildFallbackEmail(phoneNumber, normalizedName),
    fullname: normalizedName,
    username: normalizedName,
    role: "customer",
    outlet: "N/A",
    isApproved,
  });

  return createdUser._id.toString();
};

module.exports = {
  resolveOrCreateCustomerUser,
};
