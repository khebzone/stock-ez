-- V10: Split the single shared route_allocations.status (ACTIVE/COMPLETED) into
-- independent per-role completion flags. Previously Sales, Delivery, and Warehouse
-- all shared one status on the same row — marking Sales "Complete" would silently
-- free up (or hide the route from) the Delivery/Warehouse person too, since every
-- conflict check and "my today allocation" query filtered on the same field.
ALTER TABLE route_allocations
    ADD COLUMN IF NOT EXISTS sales_completed     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivery_completed   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS warehouse_completed   BOOLEAN NOT NULL DEFAULT FALSE;

-- Historically the "Complete" button only ever existed on the Sales tab, so any
-- existing COMPLETED row was a sales completion — map it accordingly.
UPDATE route_allocations SET sales_completed = TRUE WHERE status = 'COMPLETED';
