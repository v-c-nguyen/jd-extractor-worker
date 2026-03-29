-- Application users (credentials auth; create accounts via script, not public signup).
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX app_users_email_lower_idx ON app_users (lower(email));

-- One report per user per calendar day (local date chosen in UI, stored as DATE).
CREATE TABLE user_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_date)
);

CREATE INDEX user_daily_reports_user_date_idx ON user_daily_reports (user_id, report_date DESC);
