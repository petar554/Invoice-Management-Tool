-- Invoice Management Tool - Initial Database Schema

-- enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- custom types
CREATE TYPE document_type AS ENUM ('faktura', 'izvod', 'ugovor', 'undefined');
CREATE TYPE document_status AS ENUM ('pending', 'processed', 'error');

CREATE TABLE dokumenti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    document_type document_type DEFAULT 'undefined',
    document_status document_status DEFAULT 'pending',
    ocr_text TEXT,
    extracted_data JSONB DEFAULT '{}',
    file_path VARCHAR(500), -- Path in Supabase Storage
    file_size BIGINT,
    mime_type VARCHAR(100),
    email_metadata JSONB DEFAULT '{}',
    processing_errors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    CONSTRAINT valid_file_size CHECK (file_size > 0),
    CONSTRAINT valid_filename CHECK (LENGTH(filename) > 0)
);

CREATE INDEX idx_dokumenti_type ON dokumenti(document_type);
CREATE INDEX idx_dokumenti_status ON dokumenti(document_status);
CREATE INDEX idx_dokumenti_created_at ON dokumenti(created_at DESC);
CREATE INDEX idx_dokumenti_filename ON dokumenti(filename);
CREATE INDEX idx_dokumenti_user ON dokumenti(created_by);

-- full-text search index on OCR text
CREATE INDEX idx_dokumenti_ocr_text_fts ON dokumenti USING gin(to_tsvector('simple', ocr_text));

-- GIN index for JSONB fields
CREATE INDEX idx_dokumenti_extracted_data ON dokumenti USING gin(extracted_data);
CREATE INDEX idx_dokumenti_email_metadata ON dokumenti USING gin(email_metadata);

-- create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- create trigger for updated_at
CREATE TRIGGER update_dokumenti_updated_at 
    BEFORE UPDATE ON dokumenti 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- row Level Security (RLS) policies
ALTER TABLE dokumenti ENABLE ROW LEVEL SECURITY;

-- policy: users can only see their own documents
CREATE POLICY "Users can view own documents" ON dokumenti
    FOR SELECT USING (auth.uid() = created_by);

-- policy: users can insert their own documents
CREATE POLICY "Users can insert own documents" ON dokumenti
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- policy: users can update their own documents
CREATE POLICY "Users can update own documents" ON dokumenti
    FOR UPDATE USING (auth.uid() = created_by);

-- policy: users can delete their own documents
CREATE POLICY "Users can delete own documents" ON dokumenti
    FOR DELETE USING (auth.uid() = created_by);

-- storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- storage policies for documents bucket
CREATE POLICY "Users can view own documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own documents" ON storage.objects
    FOR UPDATE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents" ON storage.objects
    FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- create function for full-text search
CREATE OR REPLACE FUNCTION search_documents(search_query text, user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
    id uuid,
    filename varchar,
    document_type document_type,
    extracted_data jsonb,
    created_at timestamp with time zone,
    rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.filename,
        d.document_type,
        d.extracted_data,
        d.created_at,
        ts_rank(to_tsvector('simple', d.ocr_text), plainto_tsquery('simple', search_query)) as rank
    FROM dokumenti d
    WHERE 
        d.created_by = user_id
        AND (
            to_tsvector('simple', d.ocr_text) @@ plainto_tsquery('simple', search_query)
            OR d.filename ILIKE '%' || search_query || '%'
            OR d.extracted_data::text ILIKE '%' || search_query || '%'
        )
    ORDER BY rank DESC, d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- grant permissions
GRANT EXECUTE ON FUNCTION search_documents TO authenticated;

COMMENT ON TABLE dokumenti IS 'Stores document metadata and extracted information';
COMMENT ON COLUMN dokumenti.extracted_data IS 'JSONB field storing extracted document data like invoice numbers, amounts, dates';
COMMENT ON COLUMN dokumenti.email_metadata IS 'JSONB field storing email information when document comes from email';
COMMENT ON FUNCTION search_documents IS 'Full-text search function for documents with ranking';
