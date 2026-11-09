CREATE TABLE verification_publications (
 verification_id bigint PRIMARY KEY REFERENCES verifications(id),
 title text NOT NULL,
 summary text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz
);
