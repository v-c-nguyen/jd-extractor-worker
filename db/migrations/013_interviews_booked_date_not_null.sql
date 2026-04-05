-- Booked date is required for interview rows; align existing NULLs with interview_date.

UPDATE interviews SET booked_date = interview_date WHERE booked_date IS NULL;

ALTER TABLE interviews ALTER COLUMN booked_date SET NOT NULL;
