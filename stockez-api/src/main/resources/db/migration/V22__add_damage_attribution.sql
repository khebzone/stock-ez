-- Damage/Loss attribution: where the damage came from (SUPPLIER / WAREHOUSE / TRANSIT / CUSTOMER)
-- and which staff member is held responsible. Supplier-caused damage becomes a recoverable claim
-- (money owed back by the supplier) instead of a plain internal loss.
ALTER TABLE goods_returns
    ADD COLUMN damage_source         VARCHAR(20),
    ADD COLUMN responsible_person_id UUID REFERENCES users(id);
