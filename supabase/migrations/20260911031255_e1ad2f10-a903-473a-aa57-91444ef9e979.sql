CREATE POLICY "Owners can read their device screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'device-screenshots'
    AND EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.user_id = auth.uid()
      AND (storage.foldername(name))[1] = devices.id::text
    )
  );