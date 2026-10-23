-- Evidence registration/review + outbox processor (simulated provider). Also closes missing RLS on notification_attempts.
alter table notification_attempts enable row level security;
create policy p_att on notification_attempts for select using(my_role() in('admin','officer'));
create table evidence_reviews(id uuid primary key default gen_random_uuid(), document_id uuid not null references documents(id), reviewer_id uuid not null references profiles(id),
  decision text not null check(decision in('approved','needs_correction','rejected')), reason text, confirmed_fields jsonb not null default '{}', at timestamptz not null default now());
alter table evidence_reviews enable row level security;
create policy p_rev on evidence_reviews for select using(my_role()<>'institution' or exists(select 1 from documents d where d.id=document_id and d.institution_id=my_inst()));

create function register_document(p_app uuid, p_doc_type text, p_path text, p_sha256 text, p_expiry date default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r text := my_role(); a applications%rowtype; d uuid := gen_random_uuid();
begin
  if auth.uid() is null or r is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from applications where id=p_app;
  if not found or (r='institution' and a.institution_id is distinct from my_inst()) then raise exception 'NOT_FOUND'; end if;
  if r not in('institution','officer','admin') then raise exception 'FORBIDDEN: role % cannot register documents', r; end if;
  if coalesce(btrim(p_doc_type),'')='' or length(p_sha256)<>64 then raise exception 'INVALID_INPUT'; end if;
  if p_path like '%..%' or split_part(p_path,'/',1)<>a.institution_id::text then raise exception 'INVALID_PATH'; end if;
  insert into documents(id,institution_id,application_id,doc_type,storage_path,sha256,expiry_date) values(d,a.institution_id,p_app,p_doc_type,p_path,p_sha256,p_expiry);
  insert into audit_events(entity_type,entity_id,event_type,actor_id,actor_role,correlation_id,new_state,metadata)
    values('document',d,'document_registered',auth.uid(),r,gen_random_uuid(),'pending',jsonb_build_object('application_id',p_app,'sha256',p_sha256));
  return jsonb_build_object('document_id',d);
end $$;

create function review_document(p_doc uuid, p_decision text, p_reason text default null, p_fields jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare r text := my_role(); d documents%rowtype; rid uuid := gen_random_uuid();
begin
  if auth.uid() is null or r is null then raise exception 'UNAUTHENTICATED'; end if;
  if r not in('officer','admin') then raise exception 'FORBIDDEN: role % cannot review', r; end if;
  select * into d from documents where id=p_doc for update; if not found then raise exception 'NOT_FOUND'; end if;
  if p_decision not in('approved','needs_correction','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision<>'approved' and coalesce(btrim(p_reason),'')='' then raise exception 'REASON_REQUIRED'; end if;
  insert into evidence_reviews(id,document_id,reviewer_id,decision,reason,confirmed_fields) values(rid,p_doc,auth.uid(),p_decision,p_reason,p_fields);
  update documents set review_status=p_decision where id=p_doc;
  insert into audit_events(entity_type,entity_id,event_type,actor_id,actor_role,correlation_id,prev_state,new_state,metadata)
    values('document',p_doc,'document_reviewed',auth.uid(),r,gen_random_uuid(),d.review_status,p_decision,jsonb_build_object('reason',p_reason,'review_id',rid));
  return jsonb_build_object('review_id',rid,'status',p_decision);
end $$;

-- Simulated provider: p_fail=true makes every attempt fail. Backoff 2^n minutes, max 3 attempts. Never creates new outbox rows.
create function process_outbox(p_now timestamptz, p_fail boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r text := my_role(); n notification_outbox%rowtype; done int := 0; fails int := 0;
begin
  if r not in('admin','officer') then raise exception 'FORBIDDEN'; end if;
  for n in select * from notification_outbox where status in('pending','retry_scheduled') and next_attempt_at<=p_now order by next_attempt_at for update skip locked loop
    if p_fail then
      insert into notification_attempts(outbox_id,outcome,detail) values(n.id,'failed','simulated provider failure');
      if n.attempts+1>=3 then update notification_outbox set attempts=attempts+1,status='failed' where id=n.id;
      else update notification_outbox set attempts=attempts+1,status='retry_scheduled',next_attempt_at=p_now+(power(2,n.attempts+1)||' minutes')::interval where id=n.id; end if;
      fails := fails+1;
    else
      insert into notification_attempts(outbox_id,outcome,detail) values(n.id,'delivered','simulated provider ok');
      update notification_outbox set attempts=attempts+1,status='delivered' where id=n.id; done := done+1;
    end if;
  end loop;
  return jsonb_build_object('delivered',done,'failed_attempts',fails);
end $$;
revoke all on function register_document(uuid,text,text,text,date), review_document(uuid,text,text,jsonb), process_outbox(timestamptz,boolean) from public, anon;
grant execute on function register_document(uuid,text,text,text,date), review_document(uuid,text,text,jsonb), process_outbox(timestamptz,boolean) to authenticated;
