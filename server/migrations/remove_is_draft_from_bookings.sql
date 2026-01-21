-- Remove is_draft column from bookings table

-- First, drop the index on is_draft
DROP INDEX idx_bookings_is_draft ON bookings;

-- Then remove the is_draft column
ALTER TABLE bookings DROP COLUMN is_draft; 