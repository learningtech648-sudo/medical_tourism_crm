// src/types/index.ts
// Auto-mirrors the Supabase schema — update if schema changes

export type PipelineStage =
  | 'new_lead'
  | 'qualified'
  | 'consult_scheduled'
  | 'consult_done'
  | 'quote_sent'
  | 'deposit_paid'
  | 'arrival_confirmed'
  | 'surgery_done'
  | 'post_care'

export type LeadSource = 'whatsapp' | 'email' | 'booking_form' | 'ad'
export type CommsChannel = 'whatsapp' | 'kakaotalk' | 'telegram' | 'instagram' | 'line' | 'wechat' | 'email'
export type ConversionProbability = 'low' | 'medium' | 'high'
export type UserRole = 'admin' | 'coordinator' | 'country_rep' | 'cs_staff'
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'other'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  market: string | null
  created_at: string
}

export interface Clinic {
  id: string
  name: string
  surgery_types: string[]
  contact_info: string | null
  is_partner: boolean
  created_at: string
}

export interface Patient {
  id: string
  name: string
  country: string
  language: string
  lead_source: LeadSource
  preferred_channel: CommsChannel
  surgery_type: string
  conversion_probability: ConversionProbability
  assigned_rep: string | null
  assigned_coordinator: string | null
  pipeline_stage: PipelineStage
  korea_arrival_date: string | null
  surgery_date: string | null
  clinic_id: string | null
  deposit_amount: number | null
  deposit_currency: string
  payment_method: PaymentMethod | null
  airport_pickup: boolean
  hotel_name: string | null
  hotel_checkin: string | null
  hotel_checkout: string | null
  car_arranged: boolean
  quote_sent_via: CommsChannel | null
  quote_sent_at: string | null
  happy_call_date: string | null
  happy_call_outcome: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields (optional)
  clinic?: Clinic
  assigned_rep_profile?: Profile
  assigned_coordinator_profile?: Profile
}

export interface Consultation {
  id: string
  patient_id: string
  scheduled_at: string
  meet_link: string
  dominic_memo: string | null
  clinic_recommended: string | null
  reminder_sent: boolean
  completed: boolean
  created_at: string
  // Joined
  patient?: Patient
  clinic?: Clinic
}

// UI helpers
export const PIPELINE_STAGES: { key: PipelineStage; label: string; color: string }[] = [
  { key: 'new_lead',          label: 'New Lead',          color: '#6366f1' },
  { key: 'qualified',         label: 'Qualified',          color: '#8b5cf6' },
  { key: 'consult_scheduled', label: 'Consult Scheduled',  color: '#3b82f6' },
  { key: 'consult_done',      label: 'Consult Done',       color: '#06b6d4' },
  { key: 'quote_sent',        label: 'Quote Sent',         color: '#f59e0b' },
  { key: 'deposit_paid',      label: 'Deposit Paid',       color: '#10b981' },
  { key: 'arrival_confirmed', label: 'Arrival Confirmed',  color: '#14b8a6' },
  { key: 'surgery_done',      label: 'Surgery Done',       color: '#22c55e' },
  { key: 'post_care',         label: 'Post-Care',          color: '#84cc16' },
]

export const CHANNEL_LABELS: Record<CommsChannel, string> = {
  whatsapp:  'WhatsApp',
  kakaotalk: 'KakaoTalk',
  telegram:  'Telegram',
  instagram: 'Instagram',
  line:      'Line',
  wechat:    'WeChat',
  email:     'Email',
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp:     'WhatsApp',
  email:        'Email',
  booking_form: 'Booking Form',
  ad:           'Ad',
}
