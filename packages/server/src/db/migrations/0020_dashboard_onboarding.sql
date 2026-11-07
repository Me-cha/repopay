CREATE TABLE user_onboarding (
 gh_id text PRIMARY KEY,
 dashboard_tour_seen_at timestamptz NOT NULL DEFAULT now()
);
