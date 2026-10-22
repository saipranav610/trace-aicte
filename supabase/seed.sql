-- Minimal synthetic seed (fictional data). Extend to ~8 institutions / 20 applications.
insert into institutions(id,name) values('11111111-1111-1111-1111-111111111111','Demo Institute of Technology (fictional)'),('22222222-2222-2222-2222-222222222222','Sample College of Engineering (fictional)') on conflict do nothing;
insert into rule_versions(id,rule_id,version,name,config,source_ref,status,change_reason,published_at) values
('aaaaaaaa-0000-0000-0000-000000000001','R-DOC-EXPIRY',1,'Document expiry reminder','{"offsetDays":-30,"policy":"calendar"}','ILLUSTRATIVE - not official','published','initial',now()),
('aaaaaaaa-0000-0000-0000-000000000002','R-DOC-EXPIRY',2,'Document expiry reminder','{"offsetDays":-45,"policy":"calendar"}','ILLUSTRATIVE - not official','draft','proposal',null) on conflict do nothing;
