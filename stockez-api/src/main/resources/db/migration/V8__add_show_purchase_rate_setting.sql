-- V8: Toggle to hide/show Purchase Rate (PR) on Sales Order and Counter Sale product cards.
-- Defaults to TRUE so existing tenants keep current behaviour unless they turn it off.
ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS show_purchase_rate_to_sales BOOLEAN NOT NULL DEFAULT TRUE;
