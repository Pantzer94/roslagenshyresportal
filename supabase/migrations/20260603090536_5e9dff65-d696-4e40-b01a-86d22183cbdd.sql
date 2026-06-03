
-- documents bucket: admin manages all; tenant reads own (folder = tenant_id)
CREATE POLICY "documents: admin all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "documents: tenant read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.user_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[1]
  )
);

-- ticket-attachments bucket: admin all; tenant read/insert on own tickets (folder = ticket_id)
CREATE POLICY "ticket-attachments: admin all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'ticket-attachments' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'ticket-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ticket-attachments: tenant read own ticket"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.maintenance_tickets mt
    JOIN public.tenants t ON t.id = mt.tenant_id
    WHERE t.user_id = auth.uid()
      AND mt.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "ticket-attachments: tenant insert own ticket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.maintenance_tickets mt
    JOIN public.tenants t ON t.id = mt.tenant_id
    WHERE t.user_id = auth.uid()
      AND mt.id::text = (storage.foldername(name))[1]
  )
);
