-- DB-enforced workflow transitions. ILLUSTRATIVE states; mirrors packages/shared/src/workflow.ts.
create table workflow_transitions(from_state text not null, to_state text not null, roles text[] not null, needs_reason boolean not null default false, primary key(from_state,to_state));
alter table workflow_transitions enable row level security;
create policy p_wt on workflow_transitions for select using(auth.uid() is not null);
insert into workflow_transitions values
('draft','submitted','{institution}',false),('submitted','initial_validation','{officer}',false),('initial_validation','under_scrutiny','{officer}',false),
('under_scrutiny','correction_requested','{officer}',true),('under_scrutiny','evc_pending','{officer}',false),('correction_requested','resubmitted','{institution}',false),
('resubmitted','under_scrutiny','{officer}',false),('evc_pending','evc_scheduled','{evc}',false),('evc_scheduled','evc_completed','{evc}',false),
('evc_scheduled','evc_scheduled','{evc}',true),('evc_completed','awaiting_decision','{officer}',false),('awaiting_decision','approved','{officer}',true),
('awaiting_decision','rejected','{officer}',true),('approved','closed','{officer,admin}',false),('rejected','closed','{officer,admin}',false);

create function transition_application(p_app uuid, p_to text, p_expected_version int, p_reason text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r text := my_role(); a applications%rowtype; t workflow_transitions%rowtype; corr uuid := gen_random_uuid();
begin
  if auth.uid() is null or r is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from applications where id=p_app for update;
  if not found or (r='institution' and a.institution_id is distinct from my_inst()) then raise exception 'NOT_FOUND'; end if;
  if a.version<>p_expected_version then raise exception 'CONFLICT: stale version (current %)', a.version; end if;
  select * into t from workflow_transitions where from_state=a.state and to_state=p_to;
  if not found then raise exception 'PROHIBITED: % -> %', a.state, p_to; end if;
  if not (r = any(t.roles)) then raise exception 'FORBIDDEN: role % cannot % -> %', r, a.state, p_to; end if;
  if t.needs_reason and coalesce(btrim(p_reason),'')='' then raise exception 'REASON_REQUIRED'; end if;
  update applications set state=p_to, version=version+1 where id=p_app;
  insert into audit_events(entity_type,entity_id,event_type,actor_id,actor_role,correlation_id,prev_state,new_state,metadata)
    values('application',p_app,'transition',auth.uid(),r,corr,a.state,p_to,jsonb_build_object('reason',p_reason,'version',a.version+1));
  insert into notification_outbox(idempotency_key,institution_id,recipient,body)
    values('app:'||p_app||':'||p_to||':v'||(a.version+1),a.institution_id,'institution-contact@example.invalid','Application moved to '||p_to) on conflict(idempotency_key) do nothing;
  return jsonb_build_object('state',p_to,'version',a.version+1,'correlation_id',corr);
end $$;
revoke all on function transition_application(uuid,text,int,text) from public, anon;
grant execute on function transition_application(uuid,text,int,text) to authenticated;
