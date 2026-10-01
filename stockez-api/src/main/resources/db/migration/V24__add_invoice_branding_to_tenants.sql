-- V24: Per-tenant invoice branding — logo/extra image, payment QR, bank details,
-- GST state code and a footer note, so each tenant's printed invoice can match
-- the layout their customers already recognise (see Santhi Traders SI-8982).
-- logo_url already exists; it was stored but never rendered on the PDF.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS extra_image_url      VARCHAR(500);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_qr_image_url VARCHAR(500);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_name            VARCHAR(120);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_account_name    VARCHAR(120);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_account_number  VARCHAR(40);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_branch          VARCHAR(120);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_ifsc            VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state_code           VARCHAR(2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_footer_note  VARCHAR(500);
