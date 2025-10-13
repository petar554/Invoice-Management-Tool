-- =====================================================
-- CLEANUP SCRIPT - Remove Old Single-Tenant Schema
-- =====================================================
-- This script removes all tables, functions, views, and types
-- from the previous single-tenant architecture (001 & 002 migrations)
-- to prepare for the new multi-tenant foundation.
--
-- IMPORTANT: This will DELETE ALL DATA!
-- Only run this in development or when migrating to multi-tenant.
-- =====================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS documents_with_metadata CASCADE;

-- Drop functions (they may depend on tables/types)
DROP FUNCTION IF EXISTS search_documents(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS search_documents_enhanced(text, document_type, timestamp with time zone, timestamp with time zone, uuid) CASCADE;
DROP FUNCTION IF EXISTS classify_document(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_document_statistics(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS update_dokumenti_updated_at ON dokumenti;
DROP TRIGGER IF EXISTS update_email_configurations_updated_at ON email_configurations;

-- Drop RLS policies before dropping tables
-- Dokumenti policies
DROP POLICY IF EXISTS "Users can view own documents" ON dokumenti;
DROP POLICY IF EXISTS "Users can insert own documents" ON dokumenti;
DROP POLICY IF EXISTS "Users can update own documents" ON dokumenti;
DROP POLICY IF EXISTS "Users can delete own documents" ON dokumenti;

-- Email configurations policies
DROP POLICY IF EXISTS "Users can view own email configs" ON email_configurations;
DROP POLICY IF EXISTS "Users can insert own email configs" ON email_configurations;
DROP POLICY IF EXISTS "Users can update own email configs" ON email_configurations;
DROP POLICY IF EXISTS "Users can delete own email configs" ON email_configurations;

-- Email processing logs policies
DROP POLICY IF EXISTS "Users can view own email logs" ON email_processing_logs;
DROP POLICY IF EXISTS "Users can insert own email logs" ON email_processing_logs;

-- Storage policies (for documents bucket)
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS email_processing_logs CASCADE;
DROP TABLE IF EXISTS document_classification_rules CASCADE;
DROP TABLE IF EXISTS email_configurations CASCADE;
DROP TABLE IF EXISTS dokumenti CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;

-- Drop storage bucket (optional - uncomment if you want to remove bucket)
-- DELETE FROM storage.buckets WHERE id = 'documents';

-- Drop indexes (should be auto-removed with tables, but explicit for safety)
-- These will fail if tables are already dropped, hence IF EXISTS
DROP INDEX IF EXISTS idx_dokumenti_type CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_status CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_created_at CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_filename CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_user CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_ocr_text_fts CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_extracted_data CASCADE;
DROP INDEX IF EXISTS idx_dokumenti_email_metadata CASCADE;
DROP INDEX IF EXISTS idx_email_configs_user CASCADE;
DROP INDEX IF EXISTS idx_email_configs_active CASCADE;
DROP INDEX IF EXISTS idx_email_logs_user CASCADE;
DROP INDEX IF EXISTS idx_email_logs_status CASCADE;
DROP INDEX IF EXISTS idx_email_logs_date CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Cleanup completed successfully!';
    RAISE NOTICE 'Removed: views, functions, triggers, policies, tables, types';
    RAISE NOTICE 'Database is now ready for multi-tenant migration (003_multi_tenant_foundation.sql)';
    RAISE NOTICE 'All old data has been deleted. Proceed with migration.';
END $$;
