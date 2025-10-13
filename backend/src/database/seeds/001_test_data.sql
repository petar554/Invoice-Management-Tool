-- =====================================================
-- SEED SCRIPT - Test Data for Multi-Tenant Development
-- =====================================================
-- Creates test organizations, users, clients, and documents
-- for development and testing purposes.
-- 
-- IMPORTANT: Only run this in DEVELOPMENT environment!
-- =====================================================

-- =====================================================
-- 1. TEST ORGANIZATIONS
-- =====================================================

-- Test Organization 1: Premium Računovodstvo (Professional tier)
INSERT INTO organizations (
    id,
    name,
    tax_id,
    email,
    phone,
    address,
    city,
    country,
    subscription_tier,
    subscription_status,
    trial_ends_at,
    max_clients,
    max_documents_per_month,
    max_users,
    max_storage_gb
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Premium Računovodstvo DOO',
    '12345678', -- PIB
    'admin@premium-racunovodstvo.me',
    '+382 67 123 456',
    'Bulevar Ivana Crnojevića 25',
    'Podgorica',
    'Montenegro',
    'professional',
    'active',
    NULL,
    50, -- max clients
    1000, -- max docs/month
    10, -- max users
    50 -- max GB
);

-- Test Organization 2: Startup Bookkeeping (Trial tier)
INSERT INTO organizations (
    id,
    name,
    tax_id,
    email,
    phone,
    address,
    city,
    country,
    subscription_tier,
    subscription_status,
    trial_ends_at,
    max_clients,
    max_documents_per_month,
    max_users,
    max_storage_gb
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Startup Bookkeeping',
    '87654321',
    'contact@startup-bookkeeping.me',
    '+382 69 987 654',
    'Trg Republike 5',
    'Nikšić',
    'Montenegro',
    'trial',
    'trial',
    NOW() + INTERVAL '14 days',
    5,
    100,
    3,
    5
);

-- =====================================================
-- 2. TEST USERS IN AUTH.USERS
-- =====================================================

-- Create test users in auth.users table
-- Password: Test123! (encrypted_password is a placeholder, real auth happens via Supabase)

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
) VALUES 
-- User 1: Admin for Premium Računovodstvo
(
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@premium-racunovodstvo.me',
    crypt('Test123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Premium"}',
    NOW(),
    NOW(),
    '',
    ''
),
-- User 2: Accountant for Premium Računovodstvo
(
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'accountant@premium-racunovodstvo.me',
    crypt('Test123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Računovođa Premium"}',
    NOW(),
    NOW(),
    '',
    ''
),
-- User 3: Admin for Startup Bookkeeping
(
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@startup-bookkeeping.me',
    crypt('Test123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Startup"}',
    NOW(),
    NOW(),
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. TEST ORGANIZATION MEMBERS
-- =====================================================

-- Premium Računovodstvo - Admin
INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    can_manage_clients,
    can_manage_users,
    can_view_all_documents,
    can_manage_billing
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'org_admin',
    true,
    true,
    true,
    true
);

-- Premium Računovodstvo - Accountant
INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    can_manage_clients,
    can_manage_users,
    can_view_all_documents,
    can_manage_billing
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'accountant',
    true,
    false,
    true,
    false
);

-- Startup Bookkeeping - Admin
INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    can_manage_clients,
    can_manage_users,
    can_view_all_documents,
    can_manage_billing
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'org_admin',
    true,
    true,
    true,
    true
);

-- =====================================================
-- 4. TEST CLIENTS (sa PIB-ovima za OCR routing)
-- =====================================================

-- Premium Računovodstvo - Clients

-- Client 1: Café Montenegro
INSERT INTO clients (
    id,
    organization_id,
    name,
    tax_id,
    alternative_names,
    email,
    phone,
    address,
    city,
    industry,
    assigned_accountant_id,
    is_active
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Café Montenegro DOO',
    '11223344',
    ARRAY['Cafe Montenegro', 'Café MNE', 'Kafe Crna Gora'],
    'info@cafe-montenegro.me',
    '+382 20 123 456',
    'Slobode 12',
    'Podgorica',
    'Ugostiteljstvo',
    'a0000000-0000-0000-0000-000000000002',
    true
);

-- Client 2: TechStart Solutions
INSERT INTO clients (
    id,
    organization_id,
    name,
    tax_id,
    alternative_names,
    email,
    phone,
    address,
    city,
    industry,
    assigned_accountant_id,
    is_active
) VALUES (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'TechStart Solutions DOO',
    '22334455',
    ARRAY['TechStart', 'Tech Start Solutions'],
    'contact@techstart.me',
    '+382 69 234 567',
    'Bulevar Revolucije 45',
    'Podgorica',
    'IT/Software',
    'a0000000-0000-0000-0000-000000000002',
    true
);

-- Client 3: Prodavnica Sve za Dom
INSERT INTO clients (
    id,
    organization_id,
    name,
    tax_id,
    alternative_names,
    email,
    phone,
    address,
    city,
    industry,
    assigned_accountant_id,
    is_active
) VALUES (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Prodavnica Sve za Dom',
    '33445566',
    ARRAY['Sve za Dom', 'Shop Sve za Dom'],
    'prodaja@svezadom.me',
    '+382 30 345 678',
    'Njegoševa 78',
    'Nikšić',
    'Trgovina',
    'a0000000-0000-0000-0000-000000000002',
    true
);

-- Client 4: M&M Production (from your example documents)
INSERT INTO clients (
    id,
    organization_id,
    name,
    tax_id,
    alternative_names,
    email,
    phone,
    address,
    city,
    industry,
    assigned_accountant_id,
    is_active
) VALUES (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'M&M Production DOO',
    '44556677',
    ARRAY['M and M Production', 'M&M Productions', 'MM Production'],
    'office@mmproduction.me',
    '+382 67 456 789',
    'Vasa Raičkovića 12',
    'Podgorica',
    'Proizvodnja',
    'a0000000-0000-0000-0000-000000000002',
    true
);

-- Client 5: ARGELLA (from your example documents)
INSERT INTO clients (
    id,
    organization_id,
    name,
    tax_id,
    alternative_names,
    email,
    phone,
    address,
    city,
    industry,
    assigned_accountant_id,
    is_active
) VALUES (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'ARGELLA DOO',
    '55667788',
    ARRAY['Argella', 'ARGELLA Podgorica'],
    'info@argella.me',
    '+382 20 567 890',
    'Bulevar Svetog Petra Cetinjskog 95',
    'Podgorica',
    'Trgovina',
    'a0000000-0000-0000-0000-000000000002',
    true
);

-- Startup Bookkeeping - Clients

-- Client 1: Small Bakery
INSERT INTO clients (
    id,
    organization_id,
    name,
    tax_id,
    alternative_names,
    email,
    phone,
    address,
    city,
    industry,
    assigned_accountant_id,
    is_active
) VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'Pekara Hleb i Sol',
    '99887766',
    ARRAY['Pekara Hljeb i Sol', 'Bakery Hleb i Sol'],
    'pekara@hlebisol.me',
    '+382 68 111 222',
    'Trg Nikole Kovačevića 3',
    'Nikšić',
    'Pekarska industrija',
    'a0000000-0000-0000-0000-000000000003',
    true
);

-- =====================================================
-- 5. TEST EMAIL CONFIGURATIONS
-- =====================================================

-- Premium Računovodstvo - Email config for bank statements
INSERT INTO email_configurations (
    id,
    organization_id,
    email_address,
    description,
    imap_host,
    imap_port,
    use_tls,
    mailbox_name,
    encrypted_password, -- In production, this should be properly encrypted
    auto_process,
    process_interval_minutes,
    is_active,
    created_by
) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'dokumenti@premium-racunovodstvo.me',
    'Email za bankarske izvode i fakture',
    'imap.gmail.com',
    993,
    true,
    'INBOX',
    'encrypted_password_here', -- Replace with actual encrypted password
    true,
    5,
    true,
    'a0000000-0000-0000-0000-000000000001'
);

-- Startup Bookkeeping - Email config
INSERT INTO email_configurations (
    id,
    organization_id,
    email_address,
    description,
    imap_host,
    imap_port,
    use_tls,
    mailbox_name,
    encrypted_password,
    auto_process,
    process_interval_minutes,
    is_active,
    created_by
) VALUES (
    'e0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'docs@startup-bookkeeping.me',
    'Glavni email za dokumente',
    'imap.gmail.com',
    993,
    true,
    'INBOX',
    'encrypted_password_here',
    true,
    10,
    true,
    'a0000000-0000-0000-0000-000000000003'
);

-- =====================================================
-- 6. TEST DOCUMENTS (Sample auto-assigned documents)
-- =====================================================

-- Document 1: Faktura za Café Montenegro (auto-assigned by PIB)
INSERT INTO dokumenti (
    id,
    organization_id,
    client_id,
    filename,
    original_filename,
    file_path,
    file_size,
    mime_type,
    document_type,
    document_status,
    ocr_text,
    extracted_data,
    auto_assigned,
    assignment_confidence,
    assignment_method,
    email_metadata,
    created_by
) VALUES (
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', -- Café Montenegro
    'faktura-2025-001.pdf',
    'Faktura_Café_Montenegro_januar_2025.pdf',
    '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/faktura-2025-001.pdf',
    245678,
    'application/pdf',
    'faktura',
    'processed',
    'FAKTURA BR. 2025/001... PIB: 11223344... Kupac: Café Montenegro DOO...',
    '{"invoice_number": "2025/001", "amount": 1250.50, "tax_id": "11223344", "date": "2025-01-15"}'::jsonb,
    true,
    1.00,
    'tax_id',
    '{"from": "supplier@example.com", "subject": "Faktura januar 2025", "date": "2025-01-16"}'::jsonb,
    'a0000000-0000-0000-0000-000000000002'
);

-- Document 2: Izvod za TechStart Solutions (auto-assigned by name matching)
INSERT INTO dokumenti (
    id,
    organization_id,
    client_id,
    filename,
    original_filename,
    file_path,
    file_size,
    mime_type,
    document_type,
    document_status,
    ocr_text,
    extracted_data,
    auto_assigned,
    assignment_confidence,
    assignment_method,
    email_metadata,
    created_by
) VALUES (
    'd0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', -- TechStart Solutions
    'izvod-ckb-15012025.pdf',
    'Izvod_CKB_TechStart_15.01.2025.pdf',
    '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002/izvod-ckb-15012025.pdf',
    189456,
    'application/pdf',
    'izvod',
    'processed',
    'IZVOD RAČUNA... Vlasnik: TechStart Solutions DOO... Broj računa: 520-123456...',
    '{"account_number": "520-123456", "balance": 45678.90, "date": "2025-01-15"}'::jsonb,
    true,
    0.85,
    'name_match',
    '{"from": "ckb@ckb.me", "subject": "Izvod računa 15.01.2025", "date": "2025-01-16"}'::jsonb,
    'a0000000-0000-0000-0000-000000000002'
);

-- Document 3: Unassigned document (PIB not found)
INSERT INTO dokumenti (
    id,
    organization_id,
    client_id,
    filename,
    original_filename,
    file_path,
    file_size,
    mime_type,
    document_type,
    document_status,
    ocr_text,
    extracted_data,
    auto_assigned,
    assignment_confidence,
    assignment_method,
    created_by
) VALUES (
    'd0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    NULL, -- Unassigned
    'faktura-nepoznat-klijent.pdf',
    'Faktura_Novi_Dobavljač_2025.pdf',
    '00000000-0000-0000-0000-000000000001/unassigned/faktura-nepoznat-klijent.pdf',
    156789,
    'application/pdf',
    'faktura',
    'processed',
    'FAKTURA BR. 2025/555... PIB: 00000000... (PIB not in system)...',
    '{"invoice_number": "2025/555", "amount": 3456.00, "tax_id": "00000000"}'::jsonb,
    false,
    0.00,
    NULL,
    'a0000000-0000-0000-0000-000000000002'
);

-- Document 4: Ugovor for M&M Production
INSERT INTO dokumenti (
    id,
    organization_id,
    client_id,
    filename,
    original_filename,
    file_path,
    file_size,
    mime_type,
    document_type,
    document_status,
    ocr_text,
    extracted_data,
    auto_assigned,
    assignment_confidence,
    assignment_method,
    created_by
) VALUES (
    'd0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004', -- M&M Production
    'ugovor-mmproduction-2025.docx',
    'Ugovor_o_saradnji_M&M_Production.docx',
    '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000004/ugovor-mmproduction-2025.docx',
    98765,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ugovor',
    'processed',
    'UGOVOR O SARADNJI... M&M Production DOO... PIB: 44556677...',
    '{"contract_type": "saradnja", "tax_id": "44556677", "start_date": "2025-02-01"}'::jsonb,
    true,
    1.00,
    'tax_id',
    'a0000000-0000-0000-0000-000000000002'
);

-- =====================================================
-- 7. TEST EMAIL PROCESSING LOGS
-- =====================================================

INSERT INTO email_processing_logs (
    organization_id,
    email_config_id,
    email_uid,
    email_subject,
    email_from,
    email_date,
    attachments_count,
    processed_attachments_count,
    processing_status,
    documents_created,
    documents_auto_assigned
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    '12345',
    'Fakture januar 2025',
    'supplier@example.com',
    NOW() - INTERVAL '2 days',
    3,
    3,
    'completed',
    3,
    2
);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Seed data created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '   - 3 Test Users (in auth.users)';
    RAISE NOTICE '   - 2 Test Organizations';
    RAISE NOTICE '   - 3 Organization Members';
    RAISE NOTICE '   - 6 Test Clients (with PIB for OCR testing)';
    RAISE NOTICE '   - 2 Email Configurations';
    RAISE NOTICE '   - 4 Test Documents (3 auto-assigned, 1 unassigned)';
    RAISE NOTICE '   - 1 Email Processing Log';
    RAISE NOTICE '';
    RAISE NOTICE 'Test User Credentials:';
    RAISE NOTICE '   Email: admin@premium-racunovodstvo.me';
    RAISE NOTICE '   Email: accountant@premium-racunovodstvo.me';
    RAISE NOTICE '   Email: admin@startup-bookkeeping.me';
    RAISE NOTICE '   Password: Test123! (for all users)';
    RAISE NOTICE '';
    RAISE NOTICE 'Test PIB numbers for OCR testing:';
    RAISE NOTICE '   - Café Montenegro: 11223344';
    RAISE NOTICE '   - TechStart Solutions: 22334455';
    RAISE NOTICE '   - Sve za Dom: 33445566';
    RAISE NOTICE '   - M&M Production: 44556677';
    RAISE NOTICE '   - ARGELLA: 55667788';
END $$;

-- =====================================================
-- HELPER QUERIES FOR TESTING
-- =====================================================

-- Verify organizations
-- SELECT id, name, subscription_tier, subscription_status FROM organizations;

-- Verify clients with PIB
-- SELECT c.name, c.tax_id, o.name as organization 
-- FROM clients c 
-- JOIN organizations o ON c.organization_id = o.id;

-- Test OCR routing by PIB
-- SELECT * FROM find_client_by_tax_id('11223344', '00000000-0000-0000-0000-000000000001');

-- Test OCR routing by name
-- SELECT * FROM find_client_by_name('Café', '00000000-0000-0000-0000-000000000001');

-- Check quota usage
-- SELECT * FROM get_organization_quota_usage('00000000-0000-0000-0000-000000000001');

-- Check organization statistics
-- SELECT * FROM get_organization_statistics('00000000-0000-0000-0000-000000000001');

-- View all documents with auto-assignment info
-- SELECT 
--     d.original_filename,
--     c.name as client_name,
--     d.auto_assigned,
--     d.assignment_confidence,
--     d.assignment_method
-- FROM dokumenti d
-- LEFT JOIN clients c ON d.client_id = c.id
-- ORDER BY d.created_at DESC;
