-- Migration: Add import tracking columns for rollback capability
-- Run this BEFORE your first production import
-- These columns allow you to track and rollback specific import batches

-- Add columns to inward_reinsurance table
ALTER TABLE inward_reinsurance
ADD COLUMN IF NOT EXISTS import_batch_id TEXT,
ADD COLUMN IF NOT EXISTS import_source TEXT;

-- Add columns to legal_entities table
ALTER TABLE legal_entities
ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

-- Create indexes for faster rollback queries
CREATE INDEX IF NOT EXISTS idx_inward_reinsurance_import_batch
ON inward_reinsurance(import_batch_id)
WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_entities_import_batch
ON legal_entities(import_batch_id)
WHERE import_batch_id IS NOT NULL;

-- Verify columns were added
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('inward_reinsurance', 'legal_entities')
AND column_name IN ('import_batch_id', 'import_source')
ORDER BY table_name, column_name;
