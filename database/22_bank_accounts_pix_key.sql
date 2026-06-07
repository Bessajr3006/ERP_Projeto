ALTER TABLE bank_accounts
    ADD COLUMN pix_key VARCHAR(255) DEFAULT NULL AFTER account_number;
