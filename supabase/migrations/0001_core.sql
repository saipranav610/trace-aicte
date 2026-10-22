-- TRACE-AICTE core schema (UNTESTED against a live Supabase project). Rules shown are ILLUSTRATIVE.
create table institutions(id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz default now());
create table profiles(id uuid primary key references auth.users(id), role text not null check(role in('admin','officer','evc','institution','auditor')), institution_id uuid references institutions(id));
create table rule_versions(id uuid primary key default gen_random_uuid(), rule_id text not null, version int not null, name text not null, config jsonb not null, source_ref text not null,
  status text not null check(status in('draft','published','retired')), change_reason text, published_by uuid references profiles(id), published_at timestamptz, unique(rule_id,version));
create table applications(id uuid primary key default gen_random_uuid(), institution_id uuid not null references institutions(id), state text not null default 'draft', version int not null default 1,
  assigned_officer uuid references profiles(id), created_at timestamptz default now());
create table documents(id uuid primary key default gen_random_uuid(), institution_id uuid not null references institutions(id), application_id uuid references applications(id),
  doc_type text not null, storage_path text not null, sha256 text not null, expiry_date date, review_status text default 'pending', created_at timestamptz default now());
create table obligations(id uuid primary key default gen_random_uuid(), institution_id uuid not null references institutions(id), application_id uuid references applications(id),
  type text not null, status text not null default 'open', priority text default 'medium', responsible_role text not null, trigger_event text not null,
  rule_version_id uuid not null references rule_versions(id), evidence_document_id uuid references documents(id), due_date date not null, deadline_explanation text not null,
  escalation_level int default 0, created_at timestamptz default now(), updated_at timestamptz default now());
create table audit_events(id bigint generated always as identity primary key, entity_type text not null, entity_id uuid not null, event_type text not null, actor_id uuid, actor_role text,
  correlation_id uuid, prev_state text, new_state text, rule_version_id uuid, metadata jsonb default '{}', at timestamptz default now());
create table notification_outbox(id uuid primary key default gen_random_uuid(), idempotency_key text not null unique, institution_id uuid not null references institutions(id), recipient text not null,
  body text not null, status text not null default 'pending', attempts int default 0, next_attempt_at timestamptz default now());
create table notification_attempts(id bigint generated always as identity primary key, outbox_id uuid references notification_outbox(id), outcome text, detail text, at timestamptz default now());
create index on obligations(institution_id,status,due_date); create index on audit_events(entity_type,entity_id);

create function forbid_mutation() returns trigger language plpgsql as $$ begin raise exception 'immutable record'; end $$;
create trigger audit_append_only before update or delete on audit_events for each row execute function forbid_mutation();
create function guard_published() returns trigger language plpgsql as $$ begin
  if old.status='published' and (new.config<>old.config or new.version<>old.version) then raise exception 'published rule versions are immutable'; end if; return new; end $$;
create trigger rule_immutable before update on rule_versions for each row execute function guard_published();

create function my_role() returns text language sql stable security definer as $$ select role from profiles where id=auth.uid() $$;
create function my_inst() returns uuid language sql stable security definer as $$ select institution_id from profiles where id=auth.uid() $$;
alter table institutions enable row level security; alter table profiles enable row level security; alter table rule_versions enable row level security; alter table applications enable row level security;
alter table documents enable row level security; alter table obligations enable row level security; alter table audit_events enable row level security; alter table notification_outbox enable row level security;
create policy p_self on profiles for select using(id=auth.uid());
create policy p_rules on rule_versions for select using(auth.uid() is not null);
create policy p_rules_admin on rule_versions for insert with check(my_role()='admin');
create policy p_inst on institutions for select using(my_role()<>'institution' or id=my_inst());
create policy p_app on applications for select using(my_role()<>'institution' or institution_id=my_inst());
create policy p_doc on documents for select using(my_role()<>'institution' or institution_id=my_inst());
create policy p_obl on obligations for select using(my_role()<>'institution' or institution_id=my_inst());
create policy p_aud on audit_events for select using(my_role() in('admin','auditor','officer'));
create policy p_out on notification_outbox for select using(my_role() in('admin','officer'));
-- TODO: write policies and transition RPC (SECURITY DEFINER) enforcing the state machine in SQL; storage bucket policies.
