-- ORDERS_DELETE was a dead permission: never checked by any endpoint, no delete
-- action exists for orders (only ORDERS_CANCEL, which sets status to CANCELLED).
-- Removing the Java enum constant, so any granted rows must go first — otherwise
-- Hibernate would fail to deserialize a CustomRole that still has it stored.
DELETE FROM role_permissions WHERE permission = 'ORDERS_DELETE';
