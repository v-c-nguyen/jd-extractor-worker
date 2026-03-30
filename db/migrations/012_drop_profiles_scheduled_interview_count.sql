-- Interview detail targets come from SUM(bidder_work_entries.interview_count) per profile, not this column.

ALTER TABLE profiles DROP COLUMN IF EXISTS scheduled_interview_count;
