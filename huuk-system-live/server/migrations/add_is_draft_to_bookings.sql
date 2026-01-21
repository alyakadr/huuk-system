-- Add is_draft column to bookings table
ALTER TABLE bookings ADD COLUMN is_draft TINYINT(1) DEFAULT 0;

-- Update existing bookings to not be drafts
UPDATE bookings SET is_draft = 0 WHERE is_draft IS NULL;

-- Add index for better performance when querying draft bookings
CREATE INDEX idx_bookings_is_draft ON bookings(is_draft); 