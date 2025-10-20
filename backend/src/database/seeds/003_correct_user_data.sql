-- =====================================================
-- SEED DATA for your actual user ID
-- =====================================================

-- Insert organization
INSERT INTO organizations (
    id,
    name,
    email,
    tax_id,
    phone,
    address,
    city,
    subscription_tier,
    subscription_status,
    trial_ends_at,
    max_clients,
    max_documents_per_month,
    max_users,
    is_active
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'Petar Računovodstvo',
    'petarfis554@gmail.com',
    '12345678',
    '+382 67 123 456',
    'Njegoševa 12',
    'Podgorica',
    'professional',
    'active',
    NOW() + INTERVAL '90 days',
    50,
    1000,
    10,
    true
) ON CONFLICT (id) DO NOTHING;

-- Add user as ORG_ADMIN with CORRECT UID
INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    can_manage_clients,
    can_manage_users,
    can_view_all_documents,
    can_manage_billing
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    '6281f2e6-20c3-446e-a12d-c549847f1ef7',
    'org_admin',
    true,
    true,
    true,
    true
) ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = 'org_admin',
    can_manage_clients = true,
    can_manage_users = true,
    can_view_all_documents = true,
    can_manage_billing = true;

-- Insert test clients
INSERT INTO clients (
    organization_id,
    name,
    tax_id,
    email,
    phone,
    address,
    city,
    industry,
    is_active
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440001',
    'ARGELLA DOO',
    '03058271',
    'info@argella.me',
    '+382 20 123 456',
    'Bulevar Svetog Petra Cetinjskog 1',
    'Podgorica',
    'IT Services',
    true
),
(
    '550e8400-e29b-41d4-a716-446655440001',
    'M&M Production Montenegro',
    '02654321',
    'info@mmprod.me',
    '+382 20 654 321',
    'Moskovska 15',
    'Podgorica',
    'Media Production',
    true
),
(
    '550e8400-e29b-41d4-a716-446655440001',
    'Café Montenegro DOO',
    '02987654',
    'cafe@montenegro.me',
    '+382 30 987 654',
    'Trg Sunca 5',
    'Budva',
    'Hospitality',
    true
)
ON CONFLICT (organization_id, tax_id) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Test data created with correct UID!';
    RAISE NOTICE 'User ID: 6281f2e6-20c3-446e-a12d-c549847f1ef7';
    RAISE NOTICE 'Organization: Petar Računovodstvo';
    RAISE NOTICE 'Clients: 3 test clients added';
END $$;