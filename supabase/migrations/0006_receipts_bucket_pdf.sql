-- Allow PDF uploads to the receipts bucket. Originally only images were
-- accepted, but the scan-receipt Edge Function now supports PDFs (sent to
-- Claude as a document content block).
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'receipts';
