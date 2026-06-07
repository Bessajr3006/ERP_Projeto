ALTER TABLE companies
ADD COLUMN allow_print_without_confirmation TINYINT(1) NOT NULL DEFAULT 0;
