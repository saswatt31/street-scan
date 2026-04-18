-- StreetScan Database Schema
-- Run this in your Supabase SQL editor

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- ===========================
-- REPORTS TABLE
-- ===========================
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Location
  latitude double precision not null,
  longitude double precision not null,
  address text,
  location_name text,

  -- Damage info
  damage_type text not null check (damage_type in ('pothole', 'crack', 'subsidence', 'structural', 'flooding', 'other')),
  description text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  severity_score integer default 50 check (severity_score between 0 and 100),

  -- Source
  source text not null check (source in ('iot', 'camera', 'citizen', 'dashcam')),
  source_device_id text,
  image_url text,

  -- Status
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'resolved', 'false_positive')),

  -- AI analysis
  ai_validated boolean default false,
  ai_confidence float default 0,
  ai_notes text,

  -- Recurrence
  recurrence_count integer default 1,
  first_reported_at timestamptz default now(),
  last_reported_at timestamptz default now(),

  -- Relations
  ticket_id uuid
);

-- ===========================
-- TICKETS TABLE
-- ===========================
create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  ticket_number text unique not null,
  report_id uuid references reports(id) on delete cascade,

  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed')),

  -- Assignment
  assigned_team text,
  assigned_to text,

  -- Resolution
  resolved_at timestamptz,
  resolution_image_url text,
  resolution_notes text,
  ai_verified_resolved boolean default false
);

-- ===========================
-- IOT EVENTS TABLE
-- ===========================
create table if not exists iot_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),

  device_id text not null,
  device_type text default 'vehicle' check (device_type in ('vehicle', 'building', 'static')),

  latitude double precision,
  longitude double precision,

  -- Sensor data
  accel_x float,
  accel_y float,
  accel_z float,
  vibration_rms float,
  frequency_hz float,

  -- Thresholds
  threshold_exceeded boolean default false,
  event_type text default 'vibration' check (event_type in ('pothole', 'vibration', 'structural', 'impact')),
  magnitude float,

  -- Processed
  processed boolean default false,
  report_id uuid references reports(id)
);

-- ===========================
-- STATS VIEW
-- ===========================
create or replace view stats_summary as
select
  count(*) filter (where status != 'resolved' and status != 'false_positive') as open_reports,
  count(*) filter (where status = 'resolved') as resolved_reports,
  count(*) filter (where severity = 'critical' and status != 'resolved') as critical_reports,
  count(*) filter (where source = 'citizen') as citizen_reports,
  count(*) filter (where source = 'iot') as iot_reports,
  count(*) filter (where source = 'camera' or source = 'dashcam') as camera_reports,
  count(*) filter (where recurrence_count >= 3) as recurring_hotspots,
  count(*) filter (where created_at > now() - interval '24 hours') as reports_today
from reports;

-- ===========================
-- TICKET NUMBER TRIGGER
-- ===========================
create or replace function generate_ticket_number()
returns trigger as $$
begin
  new.ticket_number := 'SS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('ticket_seq')::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create sequence if not exists ticket_seq start 1;

create trigger set_ticket_number
  before insert on tickets
  for each row
  when (new.ticket_number is null or new.ticket_number = '')
  execute function generate_ticket_number();

-- ===========================
-- UPDATED_AT TRIGGER
-- ===========================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger reports_updated_at before update on reports
  for each row execute function update_updated_at();

create trigger tickets_updated_at before update on tickets
  for each row execute function update_updated_at();

-- ===========================
-- SEED DATA (demo)
-- ===========================
insert into reports (latitude, longitude, address, damage_type, severity, severity_score, source, status, ai_validated, ai_confidence, recurrence_count, description) values
(20.2961, 85.8245, 'Rasulgarh, Bhubaneswar', 'pothole', 'critical', 92, 'iot', 'open', true, 0.94, 5, 'Large pothole detected repeatedly. Road surface severely degraded.'),
(20.3000, 85.8200, 'Saheed Nagar, Bhubaneswar', 'crack', 'high', 74, 'citizen', 'assigned', true, 0.87, 2, 'Wide longitudinal cracks across carriageway.'),
(20.2800, 85.8400, 'Patia, Bhubaneswar', 'pothole', 'medium', 55, 'camera', 'in_progress', true, 0.78, 1, 'Medium pothole near junction.'),
(20.3100, 85.8100, 'Nayapalli, Bhubaneswar', 'structural', 'high', 80, 'iot', 'open', true, 0.91, 3, 'Structural vibration anomaly detected in bridge span.'),
(20.2700, 85.8300, 'Damana, Bhubaneswar', 'pothole', 'low', 28, 'citizen', 'resolved', true, 0.65, 1, 'Small pothole, reported by citizen.'),
(20.3050, 85.8350, 'Chandrasekharpur, Bhubaneswar', 'subsidence', 'critical', 95, 'iot', 'open', true, 0.96, 7, 'CRITICAL: Ground subsidence detected. Recurring for 7 weeks. Escalated.'),
(20.2850, 85.8150, 'Old Town, Bhubaneswar', 'crack', 'medium', 60, 'dashcam', 'open', false, 0.55, 1, 'Surface cracks visible on dashcam footage.'),
(20.3200, 85.8250, 'Khandagiri, Bhubaneswar', 'pothole', 'high', 78, 'citizen', 'assigned', true, 0.83, 2, 'Deep pothole causing vehicle damage.');

insert into tickets (ticket_number, title, priority, status, assigned_team, description)
select 
  'SS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(row_number() over ()::text, 4, '0'),
  'Repair: ' || damage_type || ' at ' || coalesce(address, 'Unknown location'),
  severity,
  case status 
    when 'assigned' then 'assigned'
    when 'in_progress' then 'in_progress'
    when 'resolved' then 'resolved'
    else 'open'
  end,
  case severity
    when 'critical' then 'Emergency Response Unit'
    when 'high' then 'Road Maintenance Team A'
    else 'Road Maintenance Team B'
  end,
  description
from reports
where status != 'false_positive';
