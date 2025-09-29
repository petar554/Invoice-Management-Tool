-- Invoice Management Tool - Database Schema for MVP
-- This extends the existing schema with email integration and document processing features

-- first, verify we have the basic schema in place
-- if running fresh, run 001_initial_schema.sql first

--  Email configuration table for storing user email settings
CREATE TABLE IF NOT EXISTS email_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    use_tls BOOLEAN NOT NULL DEFAULT true,
    mailbox_name VARCHAR(100) NOT NULL DEFAULT 'INBOX',
    encrypted_password TEXT NOT NULL, -- AES encrypted password
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_imap_port CHECK (imap_port > 0 AND imap_port <= 65535),
    CONSTRAINT valid_email_format CHECK (email_address ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT unique_user_email UNIQUE(user_id, email_address)
);

-- Enable RLS for email configurations
ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;

-- RLS policies for email configurations
CREATE POLICY "Users can view own email configs" ON email_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email configs" ON email_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email configs" ON email_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email configs" ON email_configurations
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes for email configurations
CREATE INDEX idx_email_configs_user ON email_configurations(user_id);
CREATE INDEX idx_email_configs_active ON email_configurations(is_active);

-- Add email processing log table
CREATE TABLE IF NOT EXISTS email_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_config_id UUID REFERENCES email_configurations(id) ON DELETE CASCADE,
    email_uid VARCHAR(100) NOT NULL,
    email_subject TEXT,
    email_from VARCHAR(255),
    email_date TIMESTAMP WITH TIME ZONE,
    attachments_count INTEGER DEFAULT 0,
    processed_attachments_count INTEGER DEFAULT 0,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, error
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_email_processing UNIQUE(email_config_id, email_uid)
);

-- Enable RLS for email processing logs
ALTER TABLE email_processing_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email processing logs
CREATE POLICY "Users can view own email logs" ON email_processing_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email logs" ON email_processing_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for email processing logs
CREATE INDEX idx_email_logs_user ON email_processing_logs(user_id);
CREATE INDEX idx_email_logs_status ON email_processing_logs(processing_status);
CREATE INDEX idx_email_logs_date ON email_processing_logs(processed_at DESC);

-- Add document classification rules table
CREATE TABLE IF NOT EXISTS document_classification_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(100) NOT NULL,
    document_type document_type NOT NULL,
    filename_patterns TEXT[] NOT NULL DEFAULT '{}',
    content_keywords TEXT[] NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_priority CHECK (priority > 0)
);

-- default classification rules based on MVP documentation
INSERT INTO document_classification_rules (rule_name, document_type, filename_patterns, content_keywords, priority) VALUES
-- Fakture rules
('Fakture - Filename', 'faktura', ARRAY['%faktura%', '%invoice%', '%račun%'], ARRAY['faktura', 'invoice', 'broj fakture', 'iznos', 'PDV', 'kupac', 'prodavac'], 1),

-- Izvodi rules  
('Izvodi - Filename', 'izvod', ARRAY['%izvod%', '%račun%', '%promet%', '%POS%'], ARRAY['izvod', 'račun', 'banka', 'transakcija', 'saldo', 'broj računa'], 1),

-- Ugovori rules
('Ugovori - Filename', 'ugovor', ARRAY['%ugovor%', '%contract%'], ARRAY['ugovor', 'contract', 'zaposleni', 'poslodavac', 'član', 'zakon'], 1)

ON CONFLICT DO NOTHING;

-- enhanced search function that includes classification
CREATE OR REPLACE FUNCTION search_documents_enhanced(
    search_query text DEFAULT '',
    doc_type document_type DEFAULT NULL,
    date_from timestamp with time zone DEFAULT NULL,
    date_to timestamp with time zone DEFAULT NULL,
    user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
    id uuid,
    filename varchar,
    original_filename varchar,
    document_type document_type,
    document_status document_status,
    extracted_data jsonb,
    file_path varchar,
    created_at timestamp with time zone,
    rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.filename,
        d.original_filename,
        d.document_type,
        d.document_status,
        d.extracted_data,
        d.file_path,
        d.created_at,
        CASE 
            WHEN search_query = '' THEN 1.0
            ELSE ts_rank(to_tsvector('simple', COALESCE(d.ocr_text, '')), plainto_tsquery('simple', search_query))
        END as rank
    FROM dokumenti d
    WHERE 
        d.created_by = user_id
        AND (doc_type IS NULL OR d.document_type = doc_type)
        AND (date_from IS NULL OR d.created_at >= date_from)
        AND (date_to IS NULL OR d.created_at <= date_to)
        AND (
            search_query = '' OR
            to_tsvector('simple', COALESCE(d.ocr_text, '')) @@ plainto_tsquery('simple', search_query) OR
            d.filename ILIKE '%' || search_query || '%' OR
            d.original_filename ILIKE '%' || search_query || '%' OR
            d.extracted_data::text ILIKE '%' || search_query || '%'
        )
    ORDER BY 
        CASE WHEN search_query = '' THEN d.created_at END DESC,
        CASE WHEN search_query != '' THEN rank END DESC,
        d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- function that classify documents based on rules (v1.0 MVP)
CREATE OR REPLACE FUNCTION classify_document(
    doc_filename text,
    doc_content text DEFAULT ''
)
RETURNS document_type AS $$
DECLARE
    rule_record RECORD;
    pattern text;
    keyword text;
    filename_lower text;
    content_lower text;
BEGIN
    filename_lower := LOWER(doc_filename);
    content_lower := LOWER(doc_content);
    
    -- loop through classification rules by priority
    FOR rule_record IN 
        SELECT * FROM document_classification_rules 
        WHERE is_active = true 
        ORDER BY priority ASC, rule_name ASC
    LOOP
        -- check filename patterns
        FOREACH pattern IN ARRAY rule_record.filename_patterns
        LOOP
            IF filename_lower LIKE LOWER(pattern) THEN
                RETURN rule_record.document_type;
            END IF;
        END LOOP;
        
        -- check content keywords if content is provided
        IF content_lower != '' THEN
            FOREACH keyword IN ARRAY rule_record.content_keywords
            LOOP
                IF content_lower LIKE '%' || LOWER(keyword) || '%' THEN
                    RETURN rule_record.document_type;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
    
    -- default to undefined if no rules match
    RETURN 'undefined'::document_type;
END;
$$ LANGUAGE plpgsql;

-- function that get document statistics
CREATE OR REPLACE FUNCTION get_document_statistics(user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
    total_documents bigint,
    documents_by_type jsonb,
    recent_documents_count bigint,
    processing_status_count jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM dokumenti WHERE created_by = user_id) as total_documents,
        (SELECT jsonb_object_agg(document_type, count) 
         FROM (
             SELECT document_type, COUNT(*) as count 
             FROM dokumenti 
             WHERE created_by = user_id 
             GROUP BY document_type
         ) t) as documents_by_type,
        (SELECT COUNT(*) 
         FROM dokumenti 
         WHERE created_by = user_id 
         AND created_at >= NOW() - INTERVAL '7 days') as recent_documents_count,
        (SELECT jsonb_object_agg(document_status, count) 
         FROM (
             SELECT document_status, COUNT(*) as count 
             FROM dokumenti 
             WHERE created_by = user_id 
             GROUP BY document_status
         ) t) as processing_status_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- grant permissions on new functions
GRANT EXECUTE ON FUNCTION search_documents_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION classify_document TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_statistics TO authenticated;

-- create updated_at trigger for email_configurations
CREATE TRIGGER update_email_configurations_updated_at 
    BEFORE UPDATE ON email_configurations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- comments for documentation
COMMENT ON TABLE email_configurations IS 'Stores user email IMAP configuration for document processing';
COMMENT ON TABLE email_processing_logs IS 'Logs email processing activities and results';
COMMENT ON TABLE document_classification_rules IS 'Rules for automatic document classification based on MVP requirements';
COMMENT ON FUNCTION search_documents_enhanced IS 'Enhanced search with filtering by type, date range, and full-text search';
COMMENT ON FUNCTION classify_document IS 'Classifies documents based on filename and content using predefined rules';
COMMENT ON FUNCTION get_document_statistics IS 'Returns comprehensive statistics about user documents';

-- view for easy document access with classification info
CREATE OR REPLACE VIEW documents_with_metadata AS
SELECT 
    d.id,
    d.filename,
    d.original_filename,
    d.document_type,
    d.document_status,
    d.ocr_text,
    d.extracted_data,
    d.file_path,
    d.file_size,
    d.mime_type,
    d.email_metadata,
    d.created_at,
    d.updated_at,
    d.created_by,
    -- Add derived fields
    CASE 
        WHEN d.email_metadata->>'from' IS NOT NULL THEN 'email'
        ELSE 'manual'
    END as source_type,
    EXTRACT(EPOCH FROM (NOW() - d.created_at))/86400 as days_since_created
FROM dokumenti d;

-- grant access to the view
GRANT SELECT ON documents_with_metadata TO authenticated;

COMMENT ON VIEW documents_with_metadata IS 'Enhanced view of documents with additional metadata and derived fields';

-- success messages
DO $$
BEGIN
    RAISE NOTICE 'Enhanced database schema for MVP successfully created/updated!';
    RAISE NOTICE 'Tables: dokumenti, email_configurations, email_processing_logs, document_classification_rules';
    RAISE NOTICE 'Functions: search_documents_enhanced, classify_document, get_document_statistics';
    RAISE NOTICE 'View: documents_with_metadata';
END $$;