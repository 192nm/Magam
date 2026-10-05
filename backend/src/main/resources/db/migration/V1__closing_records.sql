CREATE TABLE magam.closing_reports (
    id UUID PRIMARY KEY,
    closing_date DATE NOT NULL,
    salon_name VARCHAR(60) NOT NULL,
    report_text TEXT NOT NULL,
    total BIGINT NOT NULL CHECK (total >= 0),
    item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 200),
    sample BOOLEAN NOT NULL,
    include_service BOOLEAN NOT NULL,
    compact BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE magam.closing_items (
    report_id UUID NOT NULL REFERENCES magam.closing_reports(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name VARCHAR(80) NOT NULL,
    service VARCHAR(120) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount BETWEEN 0 AND 100000000),
    PRIMARY KEY (report_id, position)
);

CREATE INDEX closing_reports_created_at_idx ON magam.closing_reports(created_at DESC, id DESC);

-- This schema is for the Java backend only. Do not expose it through Supabase Data API.
REVOKE ALL ON SCHEMA magam FROM PUBLIC;
