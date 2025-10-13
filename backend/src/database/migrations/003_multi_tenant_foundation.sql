-- =====================================================
-- MIGRATION 003: Multi-Tenant Foundation
-- =====================================================
-- Complete multi-tenant architecture for accounting firms SaaS
-- Organizations → Clients → Documents with OCR-based routing
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text matching
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption

-- =====================================================
-- ENUMS & CUSTOM TYPES
-- =====================================================

CREATE TYPE document_type AS ENUM ('faktura', 'izvod', 'ugovor', 'undefined');
CREATE TYPE document_status AS ENUM ('pending', 'processed', 'error');
CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'professional', 'business', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'suspended', 'cancelled', 'expired');
CREATE TYPE organization_role AS ENUM ('super_admin', 'org_admin', 'accountant', 'viewer', 'client');

-- =====================================================
-- 1. CORE MULTI-TENANT TABLES
-- =====================================================

-- Organizations (Računovodstvene firme)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50) UNIQUE, -- PIB organizacije
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Montenegro',
    
    -- Subscription Management
    subscription_tier subscription_tier DEFAULT 'trial',
    subscription_status subscription_status DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    subscription_started_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    
    -- Quota Limits (based on subscription tier)
    max_clients INTEGER DEFAULT 5,
    max_documents_per_month INTEGER DEFAULT 100,
    max_users INTEGER DEFAULT 3,
    max_storage_gb INTEGER DEFAULT 5,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_quota_limits CHECK (
        max_clients > 0 AND 
        max_documents_per_month > 0 AND 
        max_users > 0 AND 
        max_storage_gb > 0
    )
);

-- Organization Members (Računovođe, admini, korisnici)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role organization_role DEFAULT 'accountant',
    
    -- Permissions
    can_manage_clients BOOLEAN DEFAULT false,
    can_manage_users BOOLEAN DEFAULT false,
    can_view_all_documents BOOLEAN DEFAULT true,
    can_manage_billing BOOLEAN DEFAULT false,
    
    -- Metadata
    invited_by UUID REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    
    UNIQUE(organization_id, user_id)
);

-- Clients (Klijenti računovodstvenih firmi)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50), -- PIB klijenta - KLJUČNO za OCR routing!
    alternative_names TEXT[], -- Alternativni nazivi za fuzzy matching
    
    -- Contact Info
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    
    -- Business Info
    industry VARCHAR(100),
    company_size VARCHAR(50), -- small, medium, large
    
    -- Assignment
    assigned_accountant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Client Portal Access (optional - za buduće faze)
    portal_enabled BOOLEAN DEFAULT false,
    portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Settings
    notification_preferences JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_org_tax_id UNIQUE(organization_id, tax_id)
);

-- =====================================================
-- 2. DOCUMENTS TABLE (Ažurirano za Multi-Tenant)
-- =====================================================

CREATE TABLE dokumenti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Multi-Tenant Fields
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    
    -- File Info
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500), -- Path in Supabase Storage
    file_size BIGINT,
    mime_type VARCHAR(100),
    
    -- Document Classification
    document_type document_type DEFAULT 'undefined',
    document_status document_status DEFAULT 'pending',
    
    -- OCR & Extraction
    ocr_text TEXT,
    extracted_data JSONB DEFAULT '{}',
    
    -- Auto-Assignment (OCR Routing)
    auto_assigned BOOLEAN DEFAULT false,
    assignment_confidence DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00
    assignment_method VARCHAR(50), -- 'tax_id', 'name_match', 'manual', 'email_metadata'
    
    -- Email Metadata
    email_metadata JSONB DEFAULT '{}',
    email_config_id UUID, -- Will reference email_configurations
    
    -- Processing
    processing_errors TEXT[],
    processing_attempts INTEGER DEFAULT 0,
    last_processed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Tags & Notes
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    
    CONSTRAINT valid_file_size CHECK (file_size > 0),
    CONSTRAINT valid_filename CHECK (LENGTH(filename) > 0),
    CONSTRAINT valid_confidence CHECK (assignment_confidence >= 0.00 AND assignment_confidence <= 1.00)
);

-- =====================================================
-- 3. EMAIL CONFIGURATIONS (Ažurirano za Multi-Tenant)
-- =====================================================

CREATE TABLE email_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Email Settings
    email_address VARCHAR(255) NOT NULL,
    description TEXT, -- npr. "Email za banku - Erste Bank"
    
    -- IMAP Configuration
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    use_tls BOOLEAN NOT NULL DEFAULT true,
    mailbox_name VARCHAR(100) NOT NULL DEFAULT 'INBOX',
    encrypted_password TEXT NOT NULL, -- AES encrypted
    
    -- Processing Settings
    auto_process BOOLEAN DEFAULT true,
    process_interval_minutes INTEGER DEFAULT 5,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50), -- 'success', 'error', 'partial'
    last_error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_imap_port CHECK (imap_port > 0 AND imap_port <= 65535),
    CONSTRAINT valid_email_format CHECK (email_address ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT unique_org_email UNIQUE(organization_id, email_address),
    CONSTRAINT valid_interval CHECK (process_interval_minutes >= 1)
);

-- =====================================================
-- 4. EMAIL PROCESSING LOGS
-- =====================================================

CREATE TABLE email_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email_config_id UUID NOT NULL REFERENCES email_configurations(id) ON DELETE CASCADE,
    
    -- Email Info
    email_uid VARCHAR(100) NOT NULL,
    email_subject TEXT,
    email_from VARCHAR(255),
    email_date TIMESTAMPTZ,
    
    -- Processing Info
    attachments_count INTEGER DEFAULT 0,
    processed_attachments_count INTEGER DEFAULT 0,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, error
    processing_duration_ms INTEGER,
    
    -- Results
    documents_created INTEGER DEFAULT 0,
    documents_auto_assigned INTEGER DEFAULT 0,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_email_processing UNIQUE(email_config_id, email_uid)
);

-- =====================================================
-- 5. AUDIT LOG (Optional but recommended)
-- =====================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Action Info
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'assign', 'login', etc.
    table_name VARCHAR(50),
    record_id UUID,
    
    -- Details
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Organizations
CREATE INDEX idx_organizations_tax_id ON organizations(tax_id);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_tier, subscription_status);
CREATE INDEX idx_organizations_active ON organizations(is_active);

-- Organization Members
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(role);

-- Clients
CREATE INDEX idx_clients_organization ON clients(organization_id);
CREATE INDEX idx_clients_tax_id ON clients(tax_id);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_active ON clients(is_active);
CREATE INDEX idx_clients_accountant ON clients(assigned_accountant_id);

-- Dokumenti
CREATE INDEX idx_documents_organization ON dokumenti(organization_id);
CREATE INDEX idx_documents_client ON dokumenti(client_id);
CREATE INDEX idx_documents_type ON dokumenti(document_type);
CREATE INDEX idx_documents_status ON dokumenti(document_status);
CREATE INDEX idx_documents_created_at ON dokumenti(created_at DESC);
CREATE INDEX idx_documents_auto_assigned ON dokumenti(auto_assigned);
CREATE INDEX idx_documents_confidence ON dokumenti(assignment_confidence);

-- Full-text search on OCR text
CREATE INDEX idx_documents_ocr_text_fts ON dokumenti USING gin(to_tsvector('simple', ocr_text));

-- JSONB indexes
CREATE INDEX idx_documents_extracted_data ON dokumenti USING gin(extracted_data);
CREATE INDEX idx_documents_email_metadata ON dokumenti USING gin(email_metadata);

-- Email Configurations
CREATE INDEX idx_email_configs_org ON email_configurations(organization_id);
CREATE INDEX idx_email_configs_active ON email_configurations(is_active);

-- Email Processing Logs
CREATE INDEX idx_email_logs_org ON email_processing_logs(organization_id);
CREATE INDEX idx_email_logs_config ON email_processing_logs(email_config_id);
CREATE INDEX idx_email_logs_status ON email_processing_logs(processing_status);
CREATE INDEX idx_email_logs_date ON email_processing_logs(processed_at DESC);

-- Audit Log
CREATE INDEX idx_audit_org ON audit_log(organization_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function: Find client by PIB (Tax ID)
CREATE OR REPLACE FUNCTION find_client_by_tax_id(
    p_tax_id TEXT,
    p_organization_id UUID
)
RETURNS TABLE (
    client_id UUID,
    client_name VARCHAR,
    confidence DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        1.00::DECIMAL AS confidence
    FROM clients c
    WHERE c.organization_id = p_organization_id
    AND c.tax_id = p_tax_id
    AND c.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Find client by name (Fuzzy Matching)
CREATE OR REPLACE FUNCTION find_client_by_name(
    p_name TEXT,
    p_organization_id UUID
)
RETURNS TABLE (
    client_id UUID,
    client_name VARCHAR,
    confidence DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        CASE 
            -- Exact match (case insensitive)
            WHEN LOWER(c.name) = LOWER(p_name) THEN 1.00
            -- Full name contained in search or vice versa
            WHEN LOWER(c.name) LIKE '%' || LOWER(p_name) || '%' THEN 0.85
            WHEN LOWER(p_name) LIKE '%' || LOWER(c.name) || '%' THEN 0.85
            -- Trigram similarity (requires pg_trgm)
            WHEN similarity(LOWER(c.name), LOWER(p_name)) > 0.6 THEN 0.75
            -- Match in alternative names
            WHEN EXISTS (
                SELECT 1 FROM unnest(c.alternative_names) AS alt_name
                WHERE LOWER(alt_name) LIKE '%' || LOWER(p_name) || '%'
            ) THEN 0.80
            ELSE 0.50
        END::DECIMAL AS confidence
    FROM clients c
    WHERE c.organization_id = p_organization_id
    AND c.is_active = true
    AND (
        LOWER(c.name) LIKE '%' || LOWER(p_name) || '%'
        OR LOWER(p_name) LIKE '%' || LOWER(c.name) || '%'
        OR similarity(LOWER(c.name), LOWER(p_name)) > 0.5
        OR EXISTS (
            SELECT 1 FROM unnest(c.alternative_names) AS alt_name
            WHERE LOWER(alt_name) LIKE '%' || LOWER(p_name) || '%'
        )
    )
    ORDER BY confidence DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get organization quota usage
CREATE OR REPLACE FUNCTION get_organization_quota_usage(
    p_organization_id UUID
)
RETURNS TABLE (
    current_clients INTEGER,
    max_clients INTEGER,
    current_documents_this_month INTEGER,
    max_documents_per_month INTEGER,
    current_users INTEGER,
    max_users INTEGER,
    current_storage_gb NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM clients WHERE organization_id = p_organization_id AND is_active = true),
        o.max_clients,
        (SELECT COUNT(*)::INTEGER FROM dokumenti 
         WHERE organization_id = p_organization_id 
         AND created_at >= DATE_TRUNC('month', NOW())),
        o.max_documents_per_month,
        (SELECT COUNT(*)::INTEGER FROM organization_members WHERE organization_id = p_organization_id),
        o.max_users,
        (SELECT COALESCE(SUM(file_size), 0)::NUMERIC / (1024.0 * 1024.0 * 1024.0) 
         FROM dokumenti 
         WHERE organization_id = p_organization_id)
    FROM organizations o
    WHERE o.id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if organization can add more clients
CREATE OR REPLACE FUNCTION can_add_client(
    p_organization_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_clients INTEGER;
    v_max_clients INTEGER;
BEGIN
    SELECT current_clients, max_clients 
    INTO v_current_clients, v_max_clients
    FROM get_organization_quota_usage(p_organization_id);
    
    RETURN v_current_clients < v_max_clients;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if organization can upload more documents this month
CREATE OR REPLACE FUNCTION can_upload_document(
    p_organization_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_docs INTEGER;
    v_max_docs INTEGER;
BEGIN
    SELECT current_documents_this_month, max_documents_per_month 
    INTO v_current_docs, v_max_docs
    FROM get_organization_quota_usage(p_organization_id);
    
    RETURN v_current_docs < v_max_docs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get document statistics for organization
CREATE OR REPLACE FUNCTION get_organization_statistics(
    p_organization_id UUID
)
RETURNS TABLE (
    total_clients INTEGER,
    total_documents INTEGER,
    documents_this_month INTEGER,
    unassigned_documents INTEGER,
    auto_assigned_percentage NUMERIC,
    documents_by_type JSONB,
    documents_by_status JSONB,
    top_clients JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM clients WHERE organization_id = p_organization_id AND is_active = true),
        (SELECT COUNT(*)::INTEGER FROM dokumenti WHERE organization_id = p_organization_id),
        (SELECT COUNT(*)::INTEGER FROM dokumenti 
         WHERE organization_id = p_organization_id 
         AND created_at >= DATE_TRUNC('month', NOW())),
        (SELECT COUNT(*)::INTEGER FROM dokumenti 
         WHERE organization_id = p_organization_id 
         AND client_id IS NULL),
        (SELECT 
            CASE WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE auto_assigned = true)::NUMERIC / COUNT(*)) * 100, 2)
            ELSE 0 
            END
         FROM dokumenti 
         WHERE organization_id = p_organization_id),
        (SELECT jsonb_object_agg(document_type, count) 
         FROM (
             SELECT document_type, COUNT(*) as count 
             FROM dokumenti 
             WHERE organization_id = p_organization_id 
             GROUP BY document_type
         ) t),
        (SELECT jsonb_object_agg(document_status, count) 
         FROM (
             SELECT document_status, COUNT(*) as count 
             FROM dokumenti 
             WHERE organization_id = p_organization_id 
             GROUP BY document_status
         ) t),
        (SELECT jsonb_agg(row_to_json(t))
         FROM (
             SELECT c.name, COUNT(d.id) as document_count
             FROM clients c
             LEFT JOIN dokumenti d ON d.client_id = c.id
             WHERE c.organization_id = p_organization_id
             GROUP BY c.id, c.name
             ORDER BY document_count DESC
             LIMIT 10
         ) t);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Organizations Policies
-- =====================================================

CREATE POLICY "org_select" ON organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "org_insert" ON organizations
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL); -- Any authenticated user can create org

CREATE POLICY "org_update" ON organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- Organization Members Policies
-- =====================================================

CREATE POLICY "members_select" ON organization_members
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "members_insert" ON organization_members
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

CREATE POLICY "members_update" ON organization_members
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

CREATE POLICY "members_delete" ON organization_members
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- Clients Policies
-- =====================================================

CREATE POLICY "clients_select" ON clients
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "clients_insert" ON clients
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() 
            AND (role IN ('org_admin', 'accountant', 'super_admin') OR can_manage_clients = true)
        )
    );

CREATE POLICY "clients_update" ON clients
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() 
            AND (role IN ('org_admin', 'accountant', 'super_admin') OR can_manage_clients = true)
        )
    );

CREATE POLICY "clients_delete" ON clients
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- Dokumenti Policies
-- =====================================================

-- Select: Users see documents from their organization
CREATE POLICY "documents_select" ON dokumenti
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
        -- Optional: CLIENT role users only see their own documents
        AND (
            client_id IN (
                SELECT c.id FROM clients c
                WHERE c.portal_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.user_id = auth.uid() 
                AND om.organization_id = dokumenti.organization_id
                AND om.role != 'client'
            )
        )
    );

-- Insert: Members can upload documents
CREATE POLICY "documents_insert" ON dokumenti
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Update: Members can update documents
CREATE POLICY "documents_update" ON dokumenti
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Delete: Only admins can delete
CREATE POLICY "documents_delete" ON dokumenti
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- Email Configurations Policies
-- =====================================================

CREATE POLICY "email_config_select" ON email_configurations
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "email_config_all" ON email_configurations
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- Email Processing Logs Policies
-- =====================================================

CREATE POLICY "email_logs_select" ON email_processing_logs
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- Audit Log Policies
-- =====================================================

CREATE POLICY "audit_select" ON audit_log
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- 9. TRIGGERS
-- =====================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dokumenti_updated_at
    BEFORE UPDATE ON dokumenti
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_configurations_updated_at
    BEFORE UPDATE ON email_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. STORAGE BUCKET & POLICIES
-- =====================================================

-- Create documents bucket (organization/client/file structure)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'documents', 
    'documents', 
    false,
    52428800, -- 50MB limit per file
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

-- Storage policies for multi-tenant structure
-- Path format: {organization_id}/{client_id}/{filename}

CREATE POLICY "storage_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'documents' 
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT organization_id::text::uuid FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT organization_id::text::uuid FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_update" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT organization_id::text::uuid FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_delete" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT organization_id::text::uuid FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('org_admin', 'super_admin')
        )
    );

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE organizations IS 'Accounting firms using the SaaS platform';
COMMENT ON TABLE organization_members IS 'Users belonging to organizations with role-based permissions';
COMMENT ON TABLE clients IS 'Clients of accounting firms - target for document auto-assignment';
COMMENT ON TABLE dokumenti IS 'Documents with multi-tenant support and OCR-based auto-assignment';
COMMENT ON TABLE email_configurations IS 'Email IMAP configs per organization for document ingestion';
COMMENT ON TABLE email_processing_logs IS 'Logs of email processing activities';
COMMENT ON TABLE audit_log IS 'Audit trail for all important actions';

COMMENT ON FUNCTION find_client_by_tax_id IS 'OCR Routing: Find client by PIB (Tax ID) with 100% confidence';
COMMENT ON FUNCTION find_client_by_name IS 'OCR Routing: Find client by name using fuzzy matching';
COMMENT ON FUNCTION get_organization_quota_usage IS 'Returns current quota usage vs limits for organization';
COMMENT ON FUNCTION can_add_client IS 'Checks if organization can add more clients based on subscription';
COMMENT ON FUNCTION can_upload_document IS 'Checks if organization can upload more documents this month';
COMMENT ON FUNCTION get_organization_statistics IS 'Returns comprehensive statistics for organization dashboard';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Multi-Tenant Foundation migration completed successfully! ✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Created Tables:';
    RAISE NOTICE '   - organizations (with subscription management)';
    RAISE NOTICE '   - organization_members (role-based access)';
    RAISE NOTICE '   - clients (with PIB for OCR routing)';
    RAISE NOTICE '   - dokumenti (multi-tenant documents)';
    RAISE NOTICE '   - email_configurations (per organization)';
    RAISE NOTICE '   - email_processing_logs';
    RAISE NOTICE '   - audit_log';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Policies: Enabled and configured';
    RAISE NOTICE 'Indexes: Optimized for performance';
    RAISE NOTICE 'Helper Functions: OCR routing + quota management';
    RAISE NOTICE 'Storage: Multi-tenant bucket with policies';
    RAISE NOTICE '';
    RAISE NOTICE '   Next Steps:';
    RAISE NOTICE '   1. Run seed script to create test data';
    RAISE NOTICE '   2. Test RLS policies';
    RAISE NOTICE '   3. Proceed with Backend API implementation (Faza 1.2)';
END $$;
