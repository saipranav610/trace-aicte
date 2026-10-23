-- Private 'evidence' bucket policies. NOT testable locally (needs Supabase storage schema) - verify in the dashboard.
-- Object path convention: <institution_id>/<file>. No update/delete policies = no overwrite or removal.
create policy ev_insert on storage.objects for insert to authenticated with check(bucket_id='evidence' and my_role()='institution' and (storage.foldername(name))[1]=my_inst()::text);
create policy ev_select on storage.objects for select to authenticated using(bucket_id='evidence' and (my_role() in('admin','officer','auditor') or (storage.foldername(name))[1]=my_inst()::text));
