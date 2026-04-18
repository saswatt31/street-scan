-- =============================================================
-- StreetScan Full Production Schema
-- Run AFTER 001_schema.sql (or drop and replace entirely)
-- =============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================
do $$ begin
  create type user_role       as enum ('citizen','admin','repair_team','iot_device');
  create type damage_type     as enum ('pothole','crack','subsidence','structural','flooding','other');
  create type severity_level  as enum ('low','medium','high','critical');
  create type report_source   as enum ('iot','camera','citizen','dashcam');
  create type report_status   as enum ('pending','validated','rejected','clustered','assigned','resolved');
  create type ticket_status   as enum ('reported','verified','assigned','in_progress','resolved','rejected');
  create type notif_type      as enum ('new_report','ticket_assigned','ticket_resolved','critical_alert','escalation');
  create type notif_channel   as enum ('in_app','email','sms');
exception when duplicate_object then null; end $$;

-- =============================================================
-- USERS  (extends Supabase auth.users)
-- =============================================================
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  email         text not null,
  full_name     text,
  phone         text,
  role          user_role not null default 'citizen',
  avatar_url    text,
  zone          text,          -- assigned operational zone for repair teams
  is_active     boolean default true,
  last_login_at timestamptz,
  metadata      jsonb default '{}'
);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"    on public.users for select  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"    on public.users for update  using (auth.uid() = id);

drop policy if exists "admin_all_users" on public.users;
create policy "admin_all_users"     on public.users for all     using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- =============================================================
-- DEVICES
-- =============================================================
create table if not exists public.devices (
  id             uuid primary key default uuid_generate_v4(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  device_key     text unique not null default encode(gen_random_bytes(32), 'hex'),
  name           text not null,
  type           text not null check (type in ('vehicle','building','static')),
  owner_id       uuid references public.users(id),
  zone           text,
  latitude       double precision,
  longitude      double precision,
  address        text,
  is_active      boolean default true,
  last_seen_at   timestamptz,
  firmware_ver   text,
  battery_pct    integer,
  metadata       jsonb default '{}'
);

alter table public.devices enable row level security;
drop policy if exists "devices_admin_all" on public.devices;
create policy "devices_admin_all" on public.devices for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','repair_team'))
);

-- =============================================================
-- IOT_DATA  (raw sensor events)
-- =============================================================
create table if not exists public.iot_data (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  device_id       uuid not null references public.devices(id) on delete cascade,
  -- Location
  latitude        double precision,
  longitude       double precision,
  gps_accuracy    float,
  -- Sensor readings
  accel_x         float,
  accel_y         float,
  accel_z         float,
  gyro_x          float,
  gyro_y          float,
  gyro_z          float,
  vibration_rms   float not null default 0,
  frequency_hz    float,
  magnitude       float,
  temperature_c   float,
  -- Classification
  event_type      text check (event_type in ('pothole','vibration','structural','impact','normal')),
  threshold_exceeded boolean default false,
  -- Processing
  processed       boolean default false,
  report_id       uuid,          -- set after clustering/processing
  batch_id        uuid,          -- for batch uploads
  raw_payload     jsonb          -- full raw data preserved
);

-- Ensure columns exist for older schemas
do $$ begin
  alter table public.iot_data add column if not exists report_id uuid;
  alter table public.iot_data add column if not exists batch_id uuid;
exception when others then null; end $$;

create index if not exists iot_data_device_idx    on public.iot_data (device_id);
create index if not exists iot_data_processed_idx on public.iot_data (processed) where processed = false;
create index if not exists iot_data_location_idx  on public.iot_data (latitude, longitude) where latitude is not null;
create index if not exists iot_data_created_idx   on public.iot_data (created_at desc);

alter table public.iot_data enable row level security;
-- Devices can insert their own data (matched by device_key in middleware, not RLS)
drop policy if exists "iot_data_admin_read" on public.iot_data;
create policy "iot_data_admin_read" on public.iot_data for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','repair_team'))
);

-- =============================================================
-- REPORTS
-- =============================================================
create table if not exists public.reports (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  -- Reporter
  reporter_id      uuid references public.users(id),   -- null for IoT/anonymous
  source           report_source not null,
  source_device_id uuid references public.devices(id),
  -- Location
  latitude         double precision not null,
  longitude        double precision not null,
  address          text,
  geohash          text,           -- for clustering queries
  cluster_id       uuid,           -- references cluster group
  -- Damage
  damage_type      damage_type not null,
  severity         severity_level not null default 'medium',
  severity_score   integer default 50 check (severity_score between 0 and 100),
  description      text,
  -- Media
  image_url        text,
  image_path       text,           -- storage path
  -- Status
  status           report_status not null default 'pending',
  -- AI analysis
  ai_validated     boolean default false,
  ai_confidence    float default 0 check (ai_confidence between 0 and 1),
  ai_damage        boolean,
  ai_severity      severity_level,
  ai_notes         text,
  ai_processed_at  timestamptz,
  -- Recurrence / clustering
  recurrence_count integer default 1,
  first_reported_at timestamptz default now(),
  last_reported_at  timestamptz default now(),
  -- Relations
  ticket_id        uuid,
  merged_into      uuid references public.reports(id)  -- if duplicate, merged into this
);

-- Ensure columns exist for older schemas
do $$ begin
  alter table public.reports add column if not exists geohash text;
  alter table public.reports add column if not exists cluster_id uuid;
  alter table public.reports add column if not exists ticket_id uuid;
  alter table public.reports add column if not exists recurrence_count integer default 1;
  alter table public.reports add column if not exists first_reported_at timestamptz default now();
  alter table public.reports add column if not exists last_reported_at timestamptz default now();
  alter table public.reports add column if not exists merged_into uuid references public.reports(id);
exception when others then null; end $$;

create index if not exists reports_location_idx   on public.reports (latitude, longitude);
create index if not exists reports_status_idx     on public.reports (status);
create index if not exists reports_severity_idx   on public.reports (severity);
create index if not exists reports_source_idx     on public.reports (source);
create index if not exists reports_created_idx    on public.reports (created_at desc);
create index if not exists reports_cluster_idx    on public.reports (cluster_id) where cluster_id is not null;
create index if not exists reports_geohash_idx    on public.reports (geohash) where geohash is not null;

alter table public.reports enable row level security;
drop policy if exists "reports_select_authenticated" on public.reports;
create policy "reports_select_authenticated" on public.reports for select using (auth.role() = 'authenticated');

drop policy if exists "reports_insert_authenticated" on public.reports;
create policy "reports_insert_authenticated" on public.reports for insert with check (auth.role() = 'authenticated');

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"         on public.reports for update using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','repair_team'))
);

-- =============================================================
-- CLUSTERS  (grouped duplicate reports)
-- =============================================================
create table if not exists public.clusters (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  -- Centroid location (avg of member reports)
  latitude        double precision not null,
  longitude       double precision not null,
  radius_m        float default 15,
  -- Aggregate severity
  damage_type     damage_type not null,
  severity        severity_level not null,
  severity_score  integer,
  -- Stats
  report_count    integer default 1,
  first_seen_at   timestamptz default now(),
  last_seen_at    timestamptz default now(),
  -- Status
  is_active       boolean default true,
  ticket_id       uuid
);

-- Ensure columns exist for older schemas
do $$ begin
  alter table public.clusters add column if not exists ticket_id uuid;
exception when others then null; end $$;

create index if not exists clusters_location_idx on public.clusters (latitude, longitude);

-- =============================================================
-- TICKETS
-- =============================================================
create sequence if not exists ticket_seq start 1000;

create table if not exists public.tickets (
  id                   uuid primary key default uuid_generate_v4(),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  ticket_number        text unique not null default
    'SS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('ticket_seq')::text, 4, '0'),
  -- Source
  report_id            uuid references public.reports(id),
  cluster_id           uuid references public.clusters(id),
  -- Content
  title                text not null,
  description          text,
  priority             severity_level not null default 'medium',
  -- Workflow status
  status               ticket_status not null default 'reported',
  -- Assignment
  assigned_team        text,
  assigned_to          uuid references public.users(id),
  assigned_at          timestamptz,
  -- Location (denormalised for quick queries)
  latitude             double precision,
  longitude            double precision,
  address              text,
  zone                 text,
  -- Resolution
  resolved_at          timestamptz,
  resolution_image_url text,
  resolution_image_path text,
  resolution_notes     text,
  ai_verified_resolved boolean default false,
  verified_at          timestamptz,
  -- SLA
  due_at               timestamptz,          -- computed from priority
  sla_breached         boolean default false
);

-- Ensure columns exist for older schemas
do $$ begin
  alter table public.tickets add column if not exists report_id uuid references public.reports(id);
  alter table public.tickets add column if not exists cluster_id uuid references public.clusters(id);
  alter table public.tickets add column if not exists sla_breached boolean default false;
  alter table public.tickets add column if not exists ai_verified_resolved boolean default false;
exception when others then null; end $$;

create index if not exists tickets_status_idx   on public.tickets (status);
create index if not exists tickets_priority_idx on public.tickets (priority);
create index if not exists tickets_assigned_idx on public.tickets (assigned_to);
create index if not exists tickets_created_idx  on public.tickets (created_at desc);

alter table public.tickets enable row level security;
drop policy if exists "tickets_select_auth" on public.tickets;
create policy "tickets_select_auth" on public.tickets for select using (auth.role() = 'authenticated');

drop policy if exists "tickets_update_team" on public.tickets;
create policy "tickets_update_team" on public.tickets for update using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','repair_team'))
);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz default now(),
  user_id      uuid not null references public.users(id) on delete cascade,
  type         notif_type not null,
  channel      notif_channel not null default 'in_app',
  title        text not null,
  body         text not null,
  data         jsonb default '{}',    -- ticket_id, report_id, etc.
  is_read      boolean default false,
  sent_at      timestamptz,
  read_at      timestamptz
);

create index if not exists notif_user_idx    on public.notifications (user_id, is_read);
create index if not exists notif_created_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notif_own" on public.notifications;
create policy "notif_own" on public.notifications for all using (user_id = auth.uid());

-- =============================================================
-- API_KEYS  (for IoT devices — separate from user auth)
-- =============================================================
create table if not exists public.api_keys (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz default now(),
  key_hash     text unique not null,    -- sha256 of the actual key
  key_prefix   text not null,           -- first 8 chars for lookup
  device_id    uuid references public.devices(id) on delete cascade,
  name         text,
  scopes       text[] default array['iot:write'],
  last_used_at timestamptz,
  expires_at   timestamptz,
  is_active    boolean default true
);

create index if not exists api_keys_prefix_idx on public.api_keys (key_prefix) where is_active = true;

-- =============================================================
-- JOBS  (async background job queue)
-- =============================================================
create table if not exists public.jobs (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  type         text not null,     -- 'ai_analyze','cluster','notify','ticket_create'
  payload      jsonb not null,
  status       text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts     integer default 0,
  max_attempts integer default 3,
  error        text,
  run_after    timestamptz default now(),
  completed_at timestamptz
);

create index if not exists jobs_pending_idx on public.jobs (status, run_after) where status = 'pending';

-- =============================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================

-- updated_at trigger (universal)
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace trigger users_updated_at    before update on public.users    for each row execute function touch_updated_at();
create or replace trigger devices_updated_at  before update on public.devices  for each row execute function touch_updated_at();
create or replace trigger reports_updated_at  before update on public.reports  for each row execute function touch_updated_at();
create or replace trigger tickets_updated_at  before update on public.tickets  for each row execute function touch_updated_at();
create or replace trigger clusters_updated_at before update on public.clusters for each row execute function touch_updated_at();

-- Auto-create user profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'citizen')
  );
  return new;
end $$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- SLA computation on ticket insert
create or replace function set_ticket_sla()
returns trigger language plpgsql as $$
begin
  new.due_at := case new.priority
    when 'critical' then now() + interval '4 hours'
    when 'high'     then now() + interval '24 hours'
    when 'medium'   then now() + interval '72 hours'
    else                  now() + interval '168 hours'
  end;
  return new;
end $$;

create or replace trigger tickets_sla before insert on public.tickets
  for each row execute function set_ticket_sla();

-- Geohash helper (7-char ~ 150m precision)
create or replace function geohash(lat float, lng float, p_precision int default 7)
returns text language plpgsql immutable as $$
declare
  chars  text := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_lo float := -90; lat_hi float := 90;
  lng_lo float := -180; lng_hi float := 180;
  result text := '';
  bits   int := 0; ch int := 0;
  is_lng boolean := true; mid float;
begin
  while length(result) < p_precision loop
    if is_lng then
      mid := (lng_lo + lng_hi) / 2;
      if lng > mid then ch := ch * 2 + 1; lng_lo := mid;
      else              ch := ch * 2;     lng_hi := mid; end if;
    else
      mid := (lat_lo + lat_hi) / 2;
      if lat > mid then ch := ch * 2 + 1; lat_lo := mid;
      else              ch := ch * 2;     lat_hi := mid; end if;
    end if;
    is_lng := not is_lng;
    bits := bits + 1;
    if bits = 5 then
      result := result || substr(chars, ch + 1, 1);
      bits := 0; ch := 0;
    end if;
  end loop;
  return result;
end $$;

-- =============================================================
-- ANALYTICS VIEWS
-- =============================================================
create or replace view public.v_hotspots as
select
  c.id, c.latitude, c.longitude, c.radius_m,
  c.damage_type, c.severity, c.severity_score,
  c.report_count, c.first_seen_at, c.last_seen_at,
  c.ticket_id,
  t.status as ticket_status
from public.clusters c
left join public.tickets t on t.id = c.ticket_id
where c.is_active = true
order by c.severity_score desc, c.report_count desc;

create or replace view public.v_ticket_stats as
select
  count(*) filter (where status = 'reported')    as reported,
  count(*) filter (where status = 'verified')    as verified,
  count(*) filter (where status = 'assigned')    as assigned,
  count(*) filter (where status = 'in_progress') as in_progress,
  count(*) filter (where status = 'resolved')    as resolved,
  count(*) filter (where status = 'rejected')    as rejected,
  count(*) filter (where priority = 'critical' and status not in ('resolved','rejected')) as critical_open,
  count(*) filter (where sla_breached = true and status not in ('resolved','rejected'))   as sla_breached,
  count(*) filter (where created_at > now() - interval '24h') as created_today,
  count(*) filter (where resolved_at > now() - interval '24h') as resolved_today,
  avg(extract(epoch from (resolved_at - created_at)) / 3600) filter (where resolved_at is not null) as avg_resolution_hours
from public.tickets;

create or replace view public.v_report_stats as
select
  count(*)                                                        as total,
  count(*) filter (where status = 'pending')                      as pending,
  count(*) filter (where status = 'validated')                    as validated,
  count(*) filter (where status = 'resolved')                     as resolved,
  count(*) filter (where source = 'iot')                          as from_iot,
  count(*) filter (where source = 'citizen')                      as from_citizen,
  count(*) filter (where source in ('camera','dashcam'))          as from_camera,
  count(*) filter (where severity = 'critical')                   as critical,
  count(*) filter (where recurrence_count >= 3)                   as recurring,
  count(*) filter (where created_at > now() - interval '24h')     as today,
  count(*) filter (where created_at > now() - interval '7 days')  as this_week
from public.reports;

-- =============================================================
-- STORAGE BUCKETS (run in Supabase dashboard or here)
-- =============================================================
-- insert into storage.buckets (id, name, public) values
--   ('report-images',     'report-images',     true),
--   ('resolution-images', 'resolution-images', true)
-- on conflict do nothing;
