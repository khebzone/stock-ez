-- V5: Replace free-text closed_by with a proper FK to users
-- Safe: ADD COLUMN IF NOT EXISTS so it is idempotent if somehow already present.
-- Old VARCHAR column is left intact (harmless extra column) to avoid data loss on existing rows.

ALTER TABLE day_closures
    ADD COLUMN IF NOT EXISTS closed_by_id UUID REFERENCES users(id);
