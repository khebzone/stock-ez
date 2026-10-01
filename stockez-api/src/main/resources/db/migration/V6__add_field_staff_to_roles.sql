-- V6: Mark a custom role as "field staff" so its users get the mobile field layout
-- instead of the office/admin sidebar. Office roles stay FALSE (default).
ALTER TABLE custom_roles
    ADD COLUMN IF NOT EXISTS field_staff BOOLEAN NOT NULL DEFAULT FALSE;
