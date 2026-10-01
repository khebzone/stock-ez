-- Snapshot of a delivery run's outcome, captured when it is marked complete (manually or
-- auto when the last order is delivered). Stored so the historical "Completed · X/Y" status
-- stays accurate even though live order counts drift over time.
ALTER TABLE route_allocations ADD COLUMN delivery_completed_at TIMESTAMP;
ALTER TABLE route_allocations ADD COLUMN delivery_delivered_count INTEGER;
ALTER TABLE route_allocations ADD COLUMN delivery_pending_count INTEGER;
ALTER TABLE route_allocations ADD COLUMN delivery_total_count INTEGER;
