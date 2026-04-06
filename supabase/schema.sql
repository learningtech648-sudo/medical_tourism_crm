-- ============================================================
-- Medical Tourism CRM — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE pipeline_stage AS ENUM (
  'new_lead',
  'qualified',
  'consult_scheduled',
  'consult_done',
  'quote_sent',
  'deposit_paid',
  'arrival_confirmed',
  'surgery_done',
  'post_care'
);

CREATE TYPE lead_source AS ENUM (
  'whatsapp',
  'email',
  'booking_form',
  'ad'
);

CREATE TYPE comms_channel AS ENUM (
  'whatsapp',
  'kakaotalk',
  'telegram',
  'instagram',
  'line',
  'wechat',
  'email'
);

CREATE TYPE conversion_probability AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'coordinator',
  'country_rep',
  'cs_staff'
);

CREATE TYPE payment_method AS ENUM (
  'card',
  'bank_transfer',
  'cash',
  'other'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Users (mirrors auth.users, stores role + market)
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'country_rep',
  market        TEXT,                    -- e.g. 'Indonesia', 'Thailand', 'Vietnam'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Clinic directory
CREATE TABLE public.clinics (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  surgery_types TEXT[] NOT NULL DEFAULT '{}',  -- ['eyes', 'nose', 'face']
  contact_info  TEXT,
  is_partner    BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Core patient / lead record
CREATE TABLE public.patients (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  name                  TEXT NOT NULL,
  country               TEXT NOT NULL,
  language              TEXT NOT NULL,

  -- Lead info
  lead_source           lead_source NOT NULL,
  preferred_channel     comms_channel NOT NULL,
  surgery_type          TEXT NOT NULL,
  conversion_probability conversion_probability DEFAULT 'medium',

  -- Assignment
  assigned_rep          UUID REFERENCES public.profiles(id),
  assigned_coordinator  UUID REFERENCES public.profiles(id),

  -- Pipeline
  pipeline_stage        pipeline_stage NOT NULL DEFAULT 'new_lead',

  -- Logistics (filled in progressively)
  korea_arrival_date    DATE,
  surgery_date          DATE,
  clinic_id             UUID REFERENCES public.clinics(id),

  -- Deposit
  deposit_amount        NUMERIC(12, 2),
  deposit_currency      TEXT DEFAULT 'USD',
  payment_method        payment_method,

  -- Logistics flags
  airport_pickup        BOOLEAN DEFAULT FALSE,
  hotel_name            TEXT,
  hotel_checkin         DATE,
  hotel_checkout        DATE,
  car_arranged          BOOLEAN DEFAULT FALSE,

  -- Quote
  quote_sent_via        comms_channel,
  quote_sent_at         TIMESTAMPTZ,

  -- Post-care
  happy_call_date       DATE,
  happy_call_outcome    TEXT,

  -- Meta
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Consultation records
CREATE TABLE public.consultations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at          TIMESTAMPTZ NOT NULL,
  meet_link             TEXT NOT NULL DEFAULT 'https://meet.google.com/YOUR-FIXED-LINK',
  dominic_memo          TEXT,
  clinic_recommended    UUID REFERENCES public.clinics(id),
  reminder_sent         BOOLEAN DEFAULT FALSE,
  completed             BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_patients_stage         ON public.patients(pipeline_stage);
CREATE INDEX idx_patients_rep           ON public.patients(assigned_rep);
CREATE INDEX idx_patients_coordinator   ON public.patients(assigned_coordinator);
CREATE INDEX idx_patients_arrival       ON public.patients(korea_arrival_date);
CREATE INDEX idx_consultations_patient  ON public.consultations(patient_id);
CREATE INDEX idx_consultations_time     ON public.consultations(scheduled_at);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: get current user's market
CREATE OR REPLACE FUNCTION get_my_market()
RETURNS TEXT AS $$
  SELECT market FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: users can read their own; admin reads all
CREATE POLICY "profiles_self_read"   ON public.profiles FOR SELECT USING (id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Clinics: everyone can read, only admin writes
CREATE POLICY "clinics_read_all"     ON public.clinics FOR SELECT USING (TRUE);
CREATE POLICY "clinics_admin_write"  ON public.clinics FOR ALL USING (get_my_role() = 'admin');

-- Patients: role-based access
CREATE POLICY "patients_admin_all" ON public.patients FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "patients_coord_assigned" ON public.patients FOR ALL
  USING (get_my_role() = 'coordinator' AND assigned_coordinator = auth.uid());

CREATE POLICY "patients_rep_market" ON public.patients FOR SELECT
  USING (get_my_role() = 'country_rep' AND country = get_my_market());

CREATE POLICY "patients_cs_read" ON public.patients FOR SELECT
  USING (get_my_role() = 'cs_staff');

-- Consultations: follow patient access
CREATE POLICY "consults_admin_all" ON public.consultations FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "consults_cs_all" ON public.consultations FOR ALL
  USING (get_my_role() = 'cs_staff');

CREATE POLICY "consults_coord_patient" ON public.consultations FOR SELECT
  USING (
    get_my_role() = 'coordinator' AND
    patient_id IN (SELECT id FROM public.patients WHERE assigned_coordinator = auth.uid())
  );

-- ============================================================
-- 15-MIN REMINDER CRON JOB (pg_cron)
-- Runs every minute, marks reminder_sent on upcoming consults
-- ============================================================

SELECT cron.schedule(
  '15min-consult-reminder',
  '* * * * *',
  $$
    UPDATE public.consultations
    SET reminder_sent = TRUE
    WHERE
      scheduled_at BETWEEN NOW() + INTERVAL '14 minutes' AND NOW() + INTERVAL '16 minutes'
      AND reminder_sent = FALSE
      AND completed = FALSE;
  $$
);

-- ============================================================
-- SEED: insert the fixed Google Meet link as a setting
-- and a few starter clinics
-- ============================================================

INSERT INTO public.clinics (name, surgery_types, is_partner) VALUES
  ('BK Plastic Surgery', ARRAY['eyes', 'nose', 'face'], TRUE),
  ('JW Plastic Surgery', ARRAY['eyes', 'nose', 'breast', 'body'], TRUE),
  ('THE PLUS Plastic Surgery', ARRAY['eyes', 'nose', 'face'], TRUE);
