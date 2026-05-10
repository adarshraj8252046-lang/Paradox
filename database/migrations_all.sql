-- File: 20260420074814_338b7127-aba0-4007-8ce8-f09226533fd5.sql
-- =====================================================================
-- WelfareConnect — Initial Schema, RLS, Storage, Seed Data
-- =====================================================================

-- ---------- Helper: updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  dob DATE,
  aadhar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- schemes ----------
CREATE TABLE public.schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  benefit_amount TEXT,
  eligibility_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_documents TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT true,
  official_portal_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schemes are public"  ON public.schemes FOR SELECT USING (true);

-- ---------- ngos ----------
CREATE TABLE public.ngos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  focus_area TEXT,
  rating NUMERIC(2,1) DEFAULT 4.5,
  km_from_user NUMERIC(4,1) DEFAULT 5.0,
  testimonial TEXT,
  testimonial_author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NGOs are public" ON public.ngos FOR SELECT USING (true);

-- ---------- scheme_ngo_map ----------
CREATE TABLE public.scheme_ngo_map (
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  ngo_id    UUID NOT NULL REFERENCES public.ngos(id)   ON DELETE CASCADE,
  PRIMARY KEY (scheme_id, ngo_id)
);
ALTER TABLE public.scheme_ngo_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mappings are public" ON public.scheme_ngo_map FOR SELECT USING (true);

-- ---------- applications ----------
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheme_id UUID REFERENCES public.schemes(id) ON DELETE SET NULL,
  ngo_id    UUID REFERENCES public.ngos(id)    ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Submitted'
    CHECK (status IN ('Draft','Submitted','Under Review','Approved','Rejected')),
  aadhar TEXT,
  message TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own apps"   ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own apps" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own apps" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own apps" ON public.applications FOR DELETE USING (auth.uid() = user_id);

-- ---------- application_documents ----------
CREATE TABLE public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own docs" ON public.application_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Users insert own docs" ON public.application_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Users delete own docs" ON public.application_documents FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));

-- ---------- notifications ----------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body  TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifs"   ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifs" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notifs" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifs" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- ---------- Storage bucket: application-docs (private) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-docs', 'application-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own files" ON storage.objects FOR SELECT
  USING (bucket_id = 'application-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'application-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own files" ON storage.objects FOR DELETE
  USING (bucket_id = 'application-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================================
-- SEED DATA — Schemes, NGOs, mappings
-- =====================================================================

-- 7 Indian welfare schemes
WITH s AS (
  INSERT INTO public.schemes (name, category, description, benefit_amount, eligibility_criteria, required_documents, official_portal_url)
  VALUES
  ('Swasthya Raksha Yojana', 'Health',
    'Comprehensive health insurance coverage for low-income families across India, covering hospitalisation, surgeries, and critical care up to ₹5 lakh per family per year.',
    'Up to ₹5,00,000 / year',
    '{"min_age":18,"max_age":75,"max_income":250000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb,
    ARRAY['Aadhar Card','Income Certificate','Family Photo','Bank Passbook','Address Proof'],
    'https://pmjay.gov.in'),

  ('Vidyarthi Vikas Scholarship', 'Education',
    'Merit-cum-means scholarship for school and college students from economically weaker sections to support tuition, books, and educational materials.',
    '₹12,000 – ₹50,000 / year',
    '{"min_age":10,"max_age":30,"max_income":300000,"categories":["General","OBC","SC","ST"],"occupations":["Student"],"disability_required":false}'::jsonb,
    ARRAY['Aadhar Card','Income Certificate','School/College ID','Mark Sheet','Bank Account Details'],
    'https://scholarships.gov.in'),

  ('Kisan Sahay', 'Agriculture',
    'Direct income support of ₹6,000 per year to small and marginal farmer families, paid in three equal instalments through Direct Benefit Transfer.',
    '₹6,000 / year',
    '{"min_age":18,"max_age":80,"max_income":200000,"categories":["General","OBC","SC","ST"],"occupations":["Farmer"],"disability_required":false}'::jsonb,
    ARRAY['Aadhar Card','Land Records','Bank Passbook','Income Certificate'],
    'https://pmkisan.gov.in'),

  ('Bengal Women Empowerment', 'Women Empowerment',
    'Monthly financial assistance and skill-development support for women heads of household, designed to promote economic independence.',
    '₹1,000 / month',
    '{"min_age":25,"max_age":60,"max_income":120000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false,"gender_required":"Female"}'::jsonb,
    ARRAY['Aadhar Card','Bank Passbook','Address Proof','Income Certificate'],
    'https://wbsocialwelfare.gov.in'),

  ('Aparajita Disability Support', 'Disability',
    'Monthly pension and assistive-device subsidy for persons with 40%+ disability. Includes free travel pass on state transport.',
    '₹2,500 / month + assistive aids',
    '{"min_age":18,"max_age":99,"max_income":300000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":true}'::jsonb,
    ARRAY['Aadhar Card','Disability Certificate','Income Certificate','Bank Passbook','Photograph'],
    'https://disabilityaffairs.gov.in'),

  ('Skill India Yuva', 'Education',
    'Free vocational training in 200+ trades for unemployed youth aged 18–35, with placement assistance and stipend during training.',
    'Free training + ₹1,500 stipend',
    '{"min_age":18,"max_age":35,"max_income":400000,"categories":["General","OBC","SC","ST"],"occupations":["Unemployed","Student"],"disability_required":false}'::jsonb,
    ARRAY['Aadhar Card','Education Certificate','Address Proof','Photograph'],
    'https://skillindia.gov.in'),

  ('Annapurna Food Security', 'Health',
    'Subsidised foodgrains (rice, wheat, pulses) at ₹1–₹3 per kg for BPL families through fair-price shops, ensuring nutritional security.',
    'Subsidised grains 35 kg / month',
    '{"min_age":0,"max_age":120,"max_income":150000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb,
    ARRAY['Aadhar Card','Ration Card','Income Certificate','Address Proof'],
    'https://nfsa.gov.in')
  RETURNING id, name
)
SELECT * FROM s;

-- 5 Kolkata NGOs
INSERT INTO public.ngos (name, location, focus_area, rating, km_from_user, testimonial, testimonial_author)
VALUES
  ('Kolkata Care Foundation', 'Salt Lake, Kolkata', 'Health & Family Welfare', 4.8, 3.2,
    'They guided me through every step of my mother''s health insurance application. Got approval in 3 weeks!',
    'Priya Sen, Beneficiary'),
  ('Bengal Women Empowerment Trust', 'Park Street, Kolkata', 'Women & Child Development', 4.7, 5.1,
    'The team helped me start my tailoring business with the women''s scheme grant. Forever grateful.',
    'Sunita Devi, Entrepreneur'),
  ('Kisan Sahay Kolkata', 'Behala, Kolkata', 'Agriculture & Rural Livelihood', 4.6, 8.4,
    'They explained every document I needed for Kisan Sahay and helped me open my first bank account.',
    'Ramesh Mondal, Farmer'),
  ('Aparajita Disability Network', 'Howrah', 'Disability Inclusion', 4.9, 6.7,
    'Got my wheelchair and disability pension approved within a month. Truly life-changing support.',
    'Anwar Hussain, Beneficiary'),
  ('Vidya Jyoti Education Trust', 'Jadavpur, Kolkata', 'Education & Scholarships', 4.7, 4.3,
    'My daughter received the Vidyarthi Vikas scholarship — covered her entire first-year college fees.',
    'Meera Banerjee, Parent');

-- Map schemes to NGOs (each scheme: 1–3 NGOs; each NGO: 1–2 schemes)
INSERT INTO public.scheme_ngo_map (scheme_id, ngo_id)
SELECT s.id, n.id FROM public.schemes s, public.ngos n
WHERE
  (s.name = 'Swasthya Raksha Yojana'        AND n.name IN ('Kolkata Care Foundation','Aparajita Disability Network'))
  OR (s.name = 'Vidyarthi Vikas Scholarship' AND n.name IN ('Vidya Jyoti Education Trust','Bengal Women Empowerment Trust'))
  OR (s.name = 'Kisan Sahay'                 AND n.name IN ('Kisan Sahay Kolkata'))
  OR (s.name = 'Bengal Women Empowerment'    AND n.name IN ('Bengal Women Empowerment Trust','Kolkata Care Foundation'))
  OR (s.name = 'Aparajita Disability Support' AND n.name IN ('Aparajita Disability Network','Kolkata Care Foundation'))
  OR (s.name = 'Skill India Yuva'            AND n.name IN ('Vidya Jyoti Education Trust','Bengal Women Empowerment Trust'))
  OR (s.name = 'Annapurna Food Security'     AND n.name IN ('Kolkata Care Foundation','Kisan Sahay Kolkata'));

-- File: 20260420082024_2ed5b367-d1bb-4583-8f3a-8ea1b19e7b38.sql
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- File: 20260420111340_defb92b4-1f7f-4783-a6d2-b689830b1c99.sql
-- Add new geographic + economic targeting columns to schemes
ALTER TABLE public.schemes
  ADD COLUMN IF NOT EXISTS allowed_states text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS target_area text NOT NULL DEFAULT 'Any',
  ADD COLUMN IF NOT EXISTS requires_bpl boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subcategory text;

-- Sanity constraint: target_area should be one of the three known values
ALTER TABLE public.schemes
  DROP CONSTRAINT IF EXISTS schemes_target_area_check;
ALTER TABLE public.schemes
  ADD CONSTRAINT schemes_target_area_check
  CHECK (target_area IN ('Any','Urban','Rural'));

-- Index to speed up the future "filter by category" UI on the Schemes page
CREATE INDEX IF NOT EXISTS schemes_category_idx ON public.schemes (category);

-- File: 20260420114200_2f194cf4-8142-4224-b4f5-f62d7922cfd5.sql
-- Create the eligibility_submissions table to persist logged-in users' eligibility form submissions.
-- Includes all fields from the eligibility form, with the new BPL-conditional ones explicitly listed.
CREATE TABLE IF NOT EXISTS public.eligibility_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Core profile fields
  full_name text,
  age integer,
  gender text,
  state_of_residence text,
  area_type text,
  category text,
  occupation text,
  disability boolean DEFAULT false,
  annual_income numeric,
  -- Sprint 5 BPL-conditional additions
  is_bpl boolean,
  is_distressed boolean,
  family_annual_income numeric,
  guardian_annual_income numeric,
  guardian_not_applicable boolean DEFAULT false,
  -- Optional priority search captured for future analytics
  priority_search text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eligibility_submissions ENABLE ROW LEVEL SECURITY;

-- Each authenticated user can manage only their own submissions
CREATE POLICY "Users insert own submissions"
  ON public.eligibility_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own submissions"
  ON public.eligibility_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own submissions"
  ON public.eligibility_submissions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS eligibility_submissions_user_id_idx
  ON public.eligibility_submissions (user_id, created_at DESC);

-- File: 20260420121029_750913ff-6bf2-4a12-a098-7e9402f8833f.sql
-- ============================================================================
-- 1. APPLICATIONS — add consultation booking fields, drop ngo_id NOT NULL
-- ============================================================================
alter table public.applications
  add column if not exists consultation_date date,
  add column if not exists consultation_time_slot text,
  add column if not exists consultation_status text default 'Pending'
    check (consultation_status in ('Pending','Confirmed','Completed','Cancelled'));

-- ngo_id was already nullable in the schema dump, but enforce explicitly so
-- the new NGO-less flow cannot regress.
alter table public.applications
  alter column ngo_id drop not null;

-- ============================================================================
-- 2. ELIGIBILITY_SUBMISSIONS — add 6 new profile fields
-- ============================================================================
alter table public.eligibility_submissions
  add column if not exists marital_status text,
  add column if not exists is_gov_employee boolean,
  add column if not exists gov_employee_id text,
  add column if not exists is_minority boolean,
  add column if not exists is_dbt_eligible boolean,
  add column if not exists preferred_benefit_type text
    check (preferred_benefit_type in ('Cash','Kind','Composite'));

-- ============================================================================
-- 3. SUBSCRIPTIONS — premium tier table + RLS
-- ============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  plan text not null default 'annual_1500',
  payment_method text,
  payment_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Each policy is split per-command (clearer + matches existing project style)
drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own subscription" on public.subscriptions;
create policy "Users create own subscription" on public.subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own subscription" on public.subscriptions;
create policy "Users update own subscription" on public.subscriptions
  for update using (auth.uid() = user_id);

-- updated_at trigger reuses the existing helper from earlier migrations
drop trigger if exists update_subscriptions_updated_at on public.subscriptions;
create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- 4. UPCOMING_CONSULTATIONS — read-only join view for the consultant team
-- ============================================================================
-- security_invoker = on so the view respects the caller's RLS on the underlying
-- tables (defense in depth — no one can read other users' bookings via the view).
create or replace view public.upcoming_consultations
with (security_invoker = on) as
select
  a.id              as application_id,
  a.user_id,
  p.full_name,
  p.phone,
  s.name            as scheme_name,
  a.aadhar,
  a.consultation_date,
  a.consultation_time_slot,
  a.consultation_status,
  a.applied_at
from public.applications a
join public.profiles p on p.id = a.user_id
join public.schemes   s on s.id = a.scheme_id
where a.consultation_date >= current_date
  and a.consultation_status in ('Pending','Confirmed')
order by a.consultation_date asc, a.consultation_time_slot asc;

-- File: 20260420133640_5745ebf5-bd2f-429e-b705-0b8ce0ff4d23.sql
-- ============================================================================
-- Two-tier paid plan migration
-- ============================================================================

-- 1. Extend subscriptions with new plan metadata + quota counters
alter table public.subscriptions
  add column if not exists plan_type text;

-- Add the constraint separately so it can be safely re-applied
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_plan_type_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_plan_type_check
      check (plan_type is null or plan_type in ('saathi_plus_annual'));
  end if;
end $$;

alter table public.subscriptions
  add column if not exists calls_total int default 15,
  add column if not exists calls_used int default 0,
  add column if not exists visits_total int default 3,
  add column if not exists visits_used int default 0,
  add column if not exists amount_paid numeric,
  add column if not exists concession_applied boolean default false;

-- Grandfather existing annual_1500 subscriptions as Saathi Plus so paid users
-- don't get re-paywalled after this rollout.
update public.subscriptions
set plan_type = 'saathi_plus_annual',
    calls_total = coalesce(calls_total, 15),
    visits_total = coalesce(visits_total, 3),
    calls_used = coalesce(calls_used, 0),
    visits_used = coalesce(visits_used, 0),
    amount_paid = coalesce(amount_paid, 1500)
where plan = 'annual_1500' and plan_type is null;

-- 2. Per-scheme Saathi Packs
create table if not exists public.scheme_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  amount_paid numeric,
  concession_applied boolean default false,
  calls_total int default 3,
  calls_used int default 0,
  visits_total int default 1,
  visits_used int default 0,
  is_active boolean default true,
  payment_reference text
);

alter table public.scheme_packs enable row level security;

drop policy if exists "Users read own packs" on public.scheme_packs;
create policy "Users read own packs" on public.scheme_packs
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own packs" on public.scheme_packs;
create policy "Users create own packs" on public.scheme_packs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own packs" on public.scheme_packs;
create policy "Users update own packs" on public.scheme_packs
  for update using (auth.uid() = user_id);

create index if not exists scheme_packs_user_scheme_idx
  on public.scheme_packs(user_id, scheme_id);

-- 3. Top-up purchases (always full price)
create table if not exists public.topup_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  purchased_at timestamptz not null default now(),
  topup_type text not null check (topup_type in ('extra_call','extra_visit')),
  units_added int default 1,
  amount_paid numeric,
  applies_to text check (applies_to in ('saathi_plus_annual','scheme_pack')),
  scheme_pack_id uuid references public.scheme_packs(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payment_reference text
);

alter table public.topup_purchases enable row level security;

drop policy if exists "Users read own topups" on public.topup_purchases;
create policy "Users read own topups" on public.topup_purchases
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own topups" on public.topup_purchases;
create policy "Users create own topups" on public.topup_purchases
  for insert with check (auth.uid() = user_id);

-- 4. Track whether the user requested an in-person agent visit on the application
alter table public.applications
  add column if not exists visit_requested boolean default false;

-- 5. Revenue analytics view
create or replace view public.revenue_summary as
select date_trunc('day', purchased_at) as day,
       'scheme_pack'::text as source,
       count(*) as units,
       sum(amount_paid) as gross_revenue
from public.scheme_packs
group by 1
union all
select date_trunc('day', started_at) as day,
       'saathi_plus_annual'::text as source,
       count(*) as units,
       sum(amount_paid) as gross_revenue
from public.subscriptions
where plan_type = 'saathi_plus_annual'
group by 1
union all
select date_trunc('day', purchased_at) as day,
       topup_type as source,
       count(*) as units,
       sum(amount_paid) as gross_revenue
from public.topup_purchases
group by 1, topup_type
order by day desc;

-- File: 20260420133704_e601728e-b6f7-4e5e-b11d-89166e2dcc05.sql
-- Recreate views with security_invoker so RLS applies based on the querying user
alter view public.revenue_summary set (security_invoker = true);
alter view public.upcoming_consultations set (security_invoker = true);

-- File: 20260420145031_1a9b003f-1645-45d2-9790-00fa0893a378.sql
-- Agents table: our internal consultants who handle scheme applications
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  specialization text[] default '{}',
  languages text[] default '{English,Hindi}',
  is_active boolean default true,
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;

-- Any signed-in user can read the agent roster (needed for Change Agent modal etc)
create policy "Agents readable by all authenticated users"
  on public.agents
  for select
  to authenticated
  using (true);

-- Seed dummy agents so assignment logic always has candidates
insert into public.agents (full_name, phone, email, specialization) values
  ('Ravi Kumar',       '+91-90000-10001', 'ravi@welfareconnect.in',      array['Agriculture','Food Security']),
  ('Priya Sharma',     '+91-90000-10002', 'priya@welfareconnect.in',     array['Women Empowerment','Health']),
  ('Arjun Banerjee',   '+91-90000-10003', 'arjun@welfareconnect.in',     array['Education','Skill Development']),
  ('Meena Das',        '+91-90000-10004', 'meena@welfareconnect.in',     array['Disability','Health']),
  ('Suresh Iyer',      '+91-90000-10005', 'suresh@welfareconnect.in',    array['Agriculture','Food Security']),
  ('Kavita Ghosh',     '+91-90000-10006', 'kavita@welfareconnect.in',    array['Education','Women Empowerment']),
  ('Amit Chatterjee',  '+91-90000-10007', 'amit@welfareconnect.in',      array['Health','Food Security']),
  ('Shreya Menon',     '+91-90000-10008', 'shreya@welfareconnect.in',    array['Skill Development','Disability'])
on conflict do nothing;

-- Per-scheme agent continuity + when this scheme's support window ends
alter table public.applications
  add column if not exists assigned_agent_id uuid references public.agents(id),
  add column if not exists agent_assigned_at timestamptz,
  add column if not exists support_expires_at timestamptz;

-- Interactions table: every event that happens on an application (timeline source)
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  agent_id uuid references public.agents(id),
  interaction_type text not null check (interaction_type in (
    'call_booked','call_completed','visit_booked','visit_completed',
    'documents_reviewed','status_update','note','agent_changed'
  )),
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by text not null default 'user' check (created_by in ('user','agent','system'))
);

alter table public.interactions enable row level security;

-- A user can read interactions only for their own applications
create policy "Users read own interactions"
  on public.interactions
  for select
  using (
    exists (
      select 1 from public.applications a
      where a.id = interactions.application_id
        and a.user_id = auth.uid()
    )
  );

-- A user can insert interactions only for their own applications
create policy "Users insert own interactions"
  on public.interactions
  for insert
  with check (
    exists (
      select 1 from public.applications a
      where a.id = interactions.application_id
        and a.user_id = auth.uid()
    )
  );

-- A user can update interactions only for their own applications (used when
-- the Change Agent modal silently re-routes future bookings to a new agent).
create policy "Users update own interactions"
  on public.interactions
  for update
  using (
    exists (
      select 1 from public.applications a
      where a.id = interactions.application_id
        and a.user_id = auth.uid()
    )
  );

-- Helpful index for timeline ordering and agent-availability lookups
create index if not exists idx_interactions_app on public.interactions(application_id);
create index if not exists idx_interactions_agent_sched on public.interactions(agent_id, scheduled_at);

-- View: which slots is each agent currently booked into?
-- Used by the Book Next Call modal to filter the time-slot dropdown.
create or replace view public.agent_bookings as
select
  agent_id,
  (scheduled_at at time zone 'UTC')::date as booking_date,
  to_char(scheduled_at at time zone 'UTC', 'HH24:MI') as slot_start
from public.interactions
where interaction_type in ('call_booked','visit_booked')
  and scheduled_at >= now() - interval '1 day'
  and completed_at is null;

-- File: 20260420145101_3144b80e-82d5-46b1-93ec-290dad0eed57.sql
-- Re-create with security_invoker=on so it respects the caller's RLS, not the
-- view owner's. This addresses the linter's "Security Definer View" warning.
drop view if exists public.agent_bookings;

create view public.agent_bookings
with (security_invoker = on)
as
select
  agent_id,
  (scheduled_at at time zone 'UTC')::date as booking_date,
  to_char(scheduled_at at time zone 'UTC', 'HH24:MI') as slot_start
from public.interactions
where interaction_type in ('call_booked','visit_booked')
  and scheduled_at >= now() - interval '1 day'
  and completed_at is null;

-- File: 20260422065257_eb09acc3-20db-474f-bf9a-cb9aa05d6653.sql
-- Scheme table extensions for scalability
ALTER TABLE public.schemes
  ADD COLUMN IF NOT EXISTS state_specific TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS launch_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS ministry TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Full-text search vector for faster priority search
ALTER TABLE public.schemes
  ADD COLUMN IF NOT EXISTS fts_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(ministry, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS schemes_fts_idx ON public.schemes USING GIN(fts_vector);
CREATE INDEX IF NOT EXISTS schemes_category_idx ON public.schemes(category);

-- 10 Additional Indian Welfare Schemes
INSERT INTO public.schemes (name, category, description, benefit_amount, eligibility_criteria, required_documents, official_portal_url, ministry, tags) VALUES
('PM Awas Yojana (Urban)', 'Housing', 'Financial assistance for construction or enhancement of houses for urban poor living in slums and informal settlements across India.', 'Up to ₹2,50,000 subsidy', '{"min_age":18,"max_age":80,"max_income":300000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','Income Certificate','Address Proof','Bank Passbook','Land Documents'], 'https://pmaymis.gov.in', 'Ministry of Housing and Urban Affairs', ARRAY['housing','urban','shelter','slum']),
('PM Awas Yojana (Gramin)', 'Housing', 'Housing scheme for rural households to construct pucca houses with basic amenities. Direct benefit transfer of ₹1.2 lakh in plains and ₹1.3 lakh in hilly areas.', '₹1,20,000 – ₹1,30,000', '{"min_age":18,"max_age":80,"max_income":200000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','SECC Data Proof','Bank Passbook','Land Records'], 'https://pmayg.nic.in', 'Ministry of Rural Development', ARRAY['housing','rural','gramin','shelter']),
('National Social Assistance Programme (NSAP)', 'Social Security', 'Pension support for old age persons, widows, and disabled persons from BPL households through monthly cash transfer.', '₹200 – ₹500 / month', '{"min_age":60,"max_age":120,"max_income":100000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','BPL Certificate','Age Proof','Bank Passbook'], 'https://nsap.nic.in', 'Ministry of Rural Development', ARRAY['pension','elderly','widow','old age','social security']),
('Janani Suraksha Yojana', 'Women Empowerment', 'Safe motherhood intervention for reducing maternal and neo-natal mortality by promoting institutional delivery among poor pregnant women.', '₹1,400 (Urban) / ₹1,400 (Rural)', '{"min_age":14,"max_age":45,"max_income":150000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false,"gender_required":"Female"}'::jsonb, ARRAY['Aadhar Card','Mother and Child Protection Card','BPL Certificate','Bank Passbook'], 'https://nhm.gov.in', 'Ministry of Health and Family Welfare', ARRAY['maternity','pregnancy','women','motherhood','health']),
('Pradhan Mantri Kaushal Vikas Yojana (PMKVY)', 'Skill Development', 'Flagship scheme for skill certification and reward to youth for training in industry-relevant skills. Includes recognition of prior learning.', 'Free training + certification', '{"min_age":15,"max_age":45,"max_income":500000,"categories":["General","OBC","SC","ST"],"occupations":["Unemployed","Student"],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','Education Certificate','Address Proof','Photograph'], 'https://www.pmkvyofficial.org', 'Ministry of Skill Development and Entrepreneurship', ARRAY['skill','training','employment','youth','vocational']),
('Atal Pension Yojana', 'Social Security', 'Guaranteed pension scheme for unorganised sector workers providing monthly pension of ₹1,000 to ₹5,000 after age 60 based on contribution.', '₹1,000 – ₹5,000 / month after 60', '{"min_age":18,"max_age":40,"max_income":0,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','Bank Account','Mobile Number'], 'https://www.npscra.nsdl.co.in', 'Ministry of Finance', ARRAY['pension','retirement','unorganised sector','atal']),
('Sukanya Samriddhi Yojana', 'Education', 'Small savings scheme for the girl child providing high interest rate returns and tax benefits, promoting education and welfare of girl children.', '8.2% interest per annum', '{"min_age":0,"max_age":10,"max_income":0,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false,"gender_required":"Female"}'::jsonb, ARRAY['Birth Certificate','Aadhar Card','Guardian ID Proof','Address Proof'], 'https://www.india.gov.in/sukanya-samriddhi-yojana', 'Ministry of Finance', ARRAY['girl child','savings','education','sukanya']),
('Pradhan Mantri Mudra Yojana', 'Agriculture', 'Loans up to ₹10 lakh to non-corporate, non-farm small/micro enterprises. Three categories: Shishu (up to ₹50K), Kishore (₹50K–5L), Tarun (₹5L–10L).', 'Loans up to ₹10,00,000', '{"min_age":18,"max_age":65,"max_income":0,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','PAN Card','Business Plan','Address Proof','Bank Statement'], 'https://www.mudra.org.in', 'Ministry of Finance', ARRAY['loan','business','micro enterprise','mudra','self employment']),
('Deen Dayal Upadhyaya Gram Jyoti Yojana', 'Agriculture', 'Rural electrification scheme providing electricity connections to households in rural areas not having access to power.', 'Free electricity connection', '{"min_age":18,"max_age":80,"max_income":200000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','Address Proof','BPL Certificate','Photograph'], 'https://www.ddugjy.gov.in', 'Ministry of Power', ARRAY['electricity','rural','power','village','ddugjy']),
('Stand Up India Scheme', 'Women Empowerment', 'Bank loans of ₹10 lakh to ₹1 crore to at least one SC/ST borrower and one woman borrower per bank branch for setting up a greenfield enterprise.', '₹10,00,000 – ₹1,00,00,000 loan', '{"min_age":18,"max_age":65,"max_income":0,"categories":["SC","ST"],"occupations":[],"disability_required":false}'::jsonb, ARRAY['Aadhar Card','PAN Card','Business Plan','Address Proof','Bank Statement','Caste Certificate'], 'https://www.standupmitra.in', 'Ministry of Finance', ARRAY['loan','business','women','SC','ST','enterprise','startup']);

-- File: 20260422065429_6977dfd2-5fd8-408a-a859-33739f46b564.sql
-- 1. Link agents to Supabase auth users
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Agent-scoped RLS policies (Postgres pre-15 doesn't support IF NOT EXISTS on CREATE POLICY,
--    so drop-then-create for idempotency).
DROP POLICY IF EXISTS "Agents read assigned applications" ON public.applications;
CREATE POLICY "Agents read assigned applications"
  ON public.applications FOR SELECT
  USING (assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

DROP POLICY IF EXISTS "Agents update assigned applications" ON public.applications;
CREATE POLICY "Agents update assigned applications"
  ON public.applications FOR UPDATE
  USING (assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

DROP POLICY IF EXISTS "Agents read assigned docs" ON public.application_documents;
CREATE POLICY "Agents read assigned docs"
  ON public.application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id
        AND a.assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
    )
  );

DROP POLICY IF EXISTS "Agents read assigned interactions" ON public.interactions;
CREATE POLICY "Agents read assigned interactions"
  ON public.interactions FOR SELECT
  USING (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

DROP POLICY IF EXISTS "Agents insert interactions" ON public.interactions;
CREATE POLICY "Agents insert interactions"
  ON public.interactions FOR INSERT
  WITH CHECK (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

DROP POLICY IF EXISTS "Agents update interactions" ON public.interactions;
CREATE POLICY "Agents update interactions"
  ON public.interactions FOR UPDATE
  USING (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

-- 3. Extend applications with applied_via flag
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS applied_via TEXT
  CHECK (applied_via IN ('saathi_plus_annual', 'scheme_pack'))
  DEFAULT 'saathi_plus_annual';

-- 4. Extend application_documents with MIME type and verification flag
ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS file_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;


