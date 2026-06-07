ALTER TABLE transactions
MODIFY COLUMN status ENUM('pending', 'progress', 'paid', 'cancelled') NOT NULL DEFAULT 'paid';
