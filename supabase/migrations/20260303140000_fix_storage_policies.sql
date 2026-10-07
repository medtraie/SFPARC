-- Ensure RLS is enabled for storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload files to 'tourism-assets' bucket
CREATE POLICY "Allow authenticated users to upload to tourism-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tourism-assets');

-- Policy to allow authenticated users to update files in 'tourism-assets' bucket
CREATE POLICY "Allow authenticated users to update in tourism-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tourism-assets')
WITH CHECK (bucket_id = 'tourism-assets');

-- Policy to allow public access to read files from 'tourism-assets' bucket
CREATE POLICY "Allow public access to read from tourism-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tourism-assets');

-- Policy to allow authenticated users to delete files from 'tourism-assets' bucket
CREATE POLICY "Allow authenticated users to delete from tourism-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tourism-assets');
