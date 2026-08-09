create policy "agent docs read" on storage.objects for select to authenticated
using (
  bucket_id = 'agent-documents' and (
    public.is_staff(auth.uid())
    or exists (select 1 from public.agents a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1])
  )
);
create policy "agent docs insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'agent-documents' and (
    public.is_staff(auth.uid())
    or exists (select 1 from public.agents a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1])
  )
);
create policy "agent docs update" on storage.objects for update to authenticated
using (
  bucket_id = 'agent-documents' and (
    public.is_staff(auth.uid())
    or exists (select 1 from public.agents a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1])
  )
);
create policy "agent docs delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'agent-documents' and (
    public.is_staff(auth.uid())
    or exists (select 1 from public.agents a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1])
  )
);