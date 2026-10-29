-- Idempotent finances table migration for TrackOps
CREATE TABLE IF NOT EXISTS finance_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL CHECK (trim(category) <> ''),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    record_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI')),
    note TEXT CHECK (note IS NULL OR length(note) <= 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient date range and type filtering
CREATE INDEX IF NOT EXISTS idx_finance_records_record_date ON finance_records (record_date);
CREATE INDEX IF NOT EXISTS idx_finance_records_type ON finance_records (type);
CREATE INDEX IF NOT EXISTS idx_finance_records_date_type ON finance_records (record_date, type);

-- Ensure constraints and defaults on existing table
DO $$
BEGIN
    ALTER TABLE finance_records ALTER COLUMN record_date SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_finance_records_category_not_empty'
    ) THEN
        ALTER TABLE finance_records ADD CONSTRAINT chk_finance_records_category_not_empty CHECK (trim(category) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_finance_records_note_length'
    ) THEN
        ALTER TABLE finance_records ADD CONSTRAINT chk_finance_records_note_length CHECK (note IS NULL OR length(note) <= 200);
    END IF;
END $$;
