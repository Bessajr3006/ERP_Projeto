ALTER TABLE transactions
ADD COLUMN received_at DATETIME NULL AFTER status;
