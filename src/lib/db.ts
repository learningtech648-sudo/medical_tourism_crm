// src/lib/db.ts
// All Supabase queries live here — import these in your pages/components

import { getSupabaseClient } from './supabase'
import type { Patient, Consultation, PipelineStage } from '@/types'

const db = () => getSupabaseClient()

// ── PATIENTS ────────────────────────────────────────────────

export async function getPatients(filters?: {
  stage?: PipelineStage
  rep?: string
  coordinator?: string
}) {
  let query = db()
    .from('patients')
    .select(`
      *,
      clinic:clinics(id, name, surgery_types),
      assigned_rep_profile:profiles!assigned_rep(id, full_name, market),
      assigned_coordinator_profile:profiles!assigned_coordinator(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (filters?.stage)       query = query.eq('pipeline_stage', filters.stage)
  if (filters?.rep)         query = query.eq('assigned_rep', filters.rep)
  if (filters?.coordinator) query = query.eq('assigned_coordinator', filters.coordinator)

  const { data, error } = await query
  if (error) throw error
  return data as Patient[]
}

export async function getPatient(id: string) {
  const { data, error } = await db()
    .from('patients')
    .select(`
      *,
      clinic:clinics(*),
      assigned_rep_profile:profiles!assigned_rep(*),
      assigned_coordinator_profile:profiles!assigned_coordinator(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Patient
}

export async function createPatient(patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await db()
    .from('patients')
    .insert(patient)
    .select()
    .single()
  if (error) throw error
  return data as Patient
}

export async function updatePatient(id: string, updates: Partial<Patient>) {
  const { data, error } = await db()
    .from('patients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Patient
}

export async function updateStage(id: string, stage: PipelineStage) {
  return updatePatient(id, { pipeline_stage: stage })
}

// ── CONSULTATIONS ────────────────────────────────────────────

export async function getConsultations(upcoming = true) {
  let query = db()
    .from('consultations')
    .select(`*, patient:patients(id, name, country, surgery_type)`)
    .order('scheduled_at', { ascending: true })

  if (upcoming) query = query.gte('scheduled_at', new Date().toISOString())

  const { data, error } = await query
  if (error) throw error
  return data as Consultation[]
}

export async function getConsultationsForPatient(patientId: string) {
  const { data, error } = await db()
    .from('consultations')
    .select('*')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: false })
  if (error) throw error
  return data as Consultation[]
}

export async function createConsultation(c: {
  patient_id: string
  scheduled_at: string
  meet_link?: string
}) {
  const { data, error } = await db()
    .from('consultations')
    .insert({
      ...c,
      meet_link: c.meet_link ?? process.env.NEXT_PUBLIC_GOOGLE_MEET_LINK,
    })
    .select()
    .single()
  if (error) throw error
  return data as Consultation
}

export async function saveConsultationMemo(id: string, memo: string, clinicId?: string) {
  const { data, error } = await db()
    .from('consultations')
    .update({ dominic_memo: memo, clinic_recommended: clinicId ?? null, completed: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Consultation
}

// ── ANALYTICS ────────────────────────────────────────────────

export async function getPipelineCounts() {
  const { data, error } = await db()
    .from('patients')
    .select('pipeline_stage')
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.pipeline_stage] = (counts[row.pipeline_stage] ?? 0) + 1
  }
  return counts
}

export async function getMonthlyVolume() {
  const { data, error } = await db()
    .from('patients')
    .select('created_at, pipeline_stage')
    .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
  if (error) throw error

  // Group by month
  const byMonth: Record<string, { leads: number; surgeries: number }> = {}
  for (const row of data) {
    const month = row.created_at.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { leads: 0, surgeries: 0 }
    byMonth[month].leads++
    if (row.pipeline_stage === 'surgery_done' || row.pipeline_stage === 'post_care') {
      byMonth[month].surgeries++
    }
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))
}

export async function getLeadSourceBreakdown() {
  const { data, error } = await db().from('patients').select('lead_source')
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.lead_source] = (counts[row.lead_source] ?? 0) + 1
  }
  return Object.entries(counts).map(([source, count]) => ({ source, count }))
}

// ── CLINICS & PROFILES ───────────────────────────────────────

export async function getClinics() {
  const { data, error } = await db().from('clinics').select('*').eq('is_partner', true)
  if (error) throw error
  return data
}

export async function getProfiles(role?: string) {
  let query = db().from('profiles').select('*')
  if (role) query = query.eq('role', role)
  const { data, error } = await query
  if (error) throw error
  return data
}
