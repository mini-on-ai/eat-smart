-- Receipt image storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict do nothing;

-- Only household members can upload/view their own receipts
create policy "receipts: upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts' and
    (storage.foldername(name))[1] in (
      select household_id::text from household_members where user_id = auth.uid()
    )
  );

create policy "receipts: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts' and
    (storage.foldername(name))[1] in (
      select household_id::text from household_members where user_id = auth.uid()
    )
  );

create policy "receipts: delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts' and
    (storage.foldername(name))[1] in (
      select household_id::text from household_members where user_id = auth.uid()
    )
  );
