-- V9: One-time backfill for the delivery-run stamping change.
--
-- orders.route_allocation_id already existed but was never populated. From this
-- deploy onward, a delivery person only sees orders explicitly stamped into their
-- gate-pass assignment (see RouteAllocationService.allocateDelivery), instead of
-- "any packed/dispatched order on my route."
--
-- Without this backfill, every order currently DISPATCHED (physically in a delivery
-- person's hands right now) would vanish from their app the instant this deploys,
-- since none of them have ever been stamped. This links each in-flight DISPATCHED
-- order to today's existing route allocation for its route, so nothing disappears
-- mid-delivery.
--
-- PACKED (not yet picked up) orders are intentionally left unstamped — after this
-- deploys, re-open Gate Pass -> Delivery Gate Pass and click "Assign" again for each
-- route that already has a delivery person set for today. That pulls today's
-- already-packed orders into the run. This is a required one-time manual step.
UPDATE orders o
SET route_allocation_id = ra.id
FROM customers c, route_allocations ra
WHERE o.customer_id = c.id
  AND o.route_allocation_id IS NULL
  AND o.status = 'DISPATCHED'
  AND ra.route_id = c.route_id
  AND ra.tenant_id = o.tenant_id
  AND ra.allocation_date = CURRENT_DATE;
