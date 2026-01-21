-- Add phone_number column to bookings table
ALTER TABLE bookings 
ADD COLUMN phone_number VARCHAR(20);

-- Optional: Add comment for documentation
-- COMMENT ON COLUMN bookings.phone_number IS 'Customer phone number for the booking';
