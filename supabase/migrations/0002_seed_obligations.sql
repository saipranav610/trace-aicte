-- Synthetic data. Run after 0001 + seed.sql. Dates chosen relative to 2026-10-23 for the demo.
create or replace function my_role() returns text language sql stable security definer set search_path=public as $$ select role from profiles where id=auth.uid() $$;
create or replace function my_inst() returns uuid language sql stable security definer set search_path=public as $$ select institution_id from profiles where id=auth.uid() $$;
insert into applications(id,institution_id,state) values
('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','under_scrutiny'),
('bbbbbbbb-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','submitted') on conflict do nothing;
insert into documents(id,institution_id,application_id,doc_type,storage_path,sha256,expiry_date) values
('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','Fire safety certificate','demo/fire.pdf',repeat('a',64),'2026-11-15'),
('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','Insurance policy','demo/ins.pdf',repeat('b',64),'2026-11-29'),
('cccccccc-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002','Land document','demo/land.pdf',repeat('c',64),'2026-11-22'),
('cccccccc-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002','Affiliation letter','demo/aff.pdf',repeat('d',64),'2026-12-31') on conflict do nothing;
insert into obligations(id,institution_id,application_id,type,status,priority,responsible_role,trigger_event,rule_version_id,evidence_document_id,due_date,deadline_explanation) values
('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','Document renewal','open','high','institution','Document expiry date recorded as 2026-11-15','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','2026-10-16','2026-11-15 -30 calendar day(s) = 2026-10-16'),
('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','Document renewal','open','medium','institution','Document expiry date recorded as 2026-11-29','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','2026-10-30','2026-11-29 -30 calendar day(s) = 2026-10-30'),
('dddddddd-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002','Document renewal','open','high','institution','Document expiry date recorded as 2026-11-22','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','2026-10-23','2026-11-22 -30 calendar day(s) = 2026-10-23'),
('dddddddd-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002','Document renewal','open','low','institution','Document expiry date recorded as 2026-12-31','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000004','2026-12-01','2026-12-31 -30 calendar day(s) = 2026-12-01') on conflict do nothing;
