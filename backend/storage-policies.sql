-- Storage Policies za Invoice Management Tool

-- 1. Omogući anonimnim korisnicima da vide documents bucket
CREATE POLICY "Allow anon to view documents bucket"
ON storage.buckets FOR SELECT 
TO anon 
USING (name = 'documents');

-- 2. Omogući authenticated korisnicima da vide documents bucket
CREATE POLICY "Allow authenticated users to view documents bucket"
ON storage.buckets FOR SELECT 
TO authenticated 
USING (name = 'documents');

-- 3. Omogući anonimnim korisnicima da vide fajlove u documents bucket-u
CREATE POLICY "Allow anon to view documents files"
ON storage.objects FOR SELECT 
TO anon 
USING (bucket_id = 'documents');

-- 4. Omogući authenticated korisnicima da vide fajlove
CREATE POLICY "Allow authenticated users to view documents files"
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'documents');

-- 5. Omogući authenticated korisnicima da upload-uju fajlove
CREATE POLICY "Allow authenticated users to upload documents"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'documents');

-- 6. Omogući authenticated korisnicima da update-uju fajlove
CREATE POLICY "Allow authenticated users to update documents"
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'documents');

-- 7. Omogući authenticated korisnicima da brišu fajlove
CREATE POLICY "Allow authenticated users to delete documents"
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'documents');

-- 8. ZA RAZVOJ: Omogući anonimnim korisnicima upload (UKLONITI U PRODUKCIJI!)
CREATE POLICY "Allow anon to upload documents (DEV ONLY)"
ON storage.objects FOR INSERT 
TO anon 
WITH CHECK (bucket_id = 'documents');

-- 9. ZA RAZVOJ: Omogući anonimnim korisnicima update (UKLONITI U PRODUKCIJI!)
CREATE POLICY "Allow anon to update documents (DEV ONLY)"
ON storage.objects FOR UPDATE 
TO anon 
USING (bucket_id = 'documents');

-- 10. ZA RAZVOJ: Omogući anonimnim korisnicima brisanje (UKLONITI U PRODUKCIJI!)
CREATE POLICY "Allow anon to delete documents (DEV ONLY)"
ON storage.objects FOR DELETE 
TO anon 
USING (bucket_id = 'documents');

-- Note: 
-- Policies 8, 9, i 10 su samo za razvoj.
-- U produkciji, uklonite ih i koristite samo authenticated policies.