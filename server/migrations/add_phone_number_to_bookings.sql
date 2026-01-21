-- Migration: Add phone_number column to bookings table
-- Date: 2025-07-20
-- Description: Adds phone_number VARCHAR(20) column to the bookings table

USE huuk_database;

-- Add phone_number column to bookings table
ALTER TABLE bookings 
ADD COLUMN phone_number VARCHAR(20);

-- Optional: Add index on phone_number for better query performance
-- CREATE INDEX idx_bookings_phone_number ON bookings(phone_number);

-- Verify the column was added
DESCRIBE bookings;
