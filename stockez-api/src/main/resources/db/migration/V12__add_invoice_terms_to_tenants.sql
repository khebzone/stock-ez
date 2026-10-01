ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS invoice_terms TEXT;
