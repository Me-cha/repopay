CREATE TABLE reconciliation_checkpoints (
 name text PRIMARY KEY,
 cursor text NOT NULL DEFAULT '0',
 generation integer NOT NULL DEFAULT 0 CHECK (generation >= 0),
 next_run_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
