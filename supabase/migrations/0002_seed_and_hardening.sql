-- Run AFTER 0001. Synthetic fictional data; dates are relative to today so the demo always has overdue/upcoming items.
alter function my_role() set search_path = public;
alter function my_inst() set search_path = public;
create policy p_self_upd on profiles for update using(false);  -- profiles are admin/SQL managed only

insert into applications(id,institution_id,state) values
('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','under_scrutiny'),
('bbbbbbbb-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','correction_requested') on conflict do nothing;

insert into documents(id,institution_id,application_id,doc_type,storage_path,sha256,expiry_date) values
('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','Fire safety certificate (fictional)','synthetic/none','0',current_date+45),
('cccccccc-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002','Land document (fictional)','synthetic/none','0',current_date+20),
('cccccccc-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','Insurance policy (fictional)','synthetic/none','0',current_date+5) on conflict do nothing;

-- due_date = expiry - 30 calendar days (rule R-DOC-EXPIRY v1). Stored explanation records the exact calculation.
insert into obligations(id,institution_id,application_id,type,status,priority,responsible_role,trigger_event,rule_version_id,evidence_document_id,due_date,deadline_explanation,escalation_level)
select o.id::uuid, d.institution_id, d.application_id, 'Document renewal', 'open', o.prio, 'institution',
  'Document expiry date recorded: '||d.expiry_date, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, d.id, d.expiry_date-30,
  d.expiry_date||' -30 calendar day(s) = '||(d.expiry_date-30), o.esc
from (values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','medium',0),
             ('dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000002','high',1),
             ('dddddddd-0000-0000-0000-000000000003','cccccccc-0000-0000-0000-000000000003','critical',2)) o(id,doc,prio,esc)
join documents d on d.id=o.doc::uuid on conflict do nothing;
