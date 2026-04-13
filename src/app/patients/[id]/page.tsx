'use client'
// src/app/patients/[id]/page.tsx

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getPatient, updatePatient, getClinics, getConsultationsForPatient } from '@/lib/db'
import type { Patient, Clinic, Consultation, PipelineStage } from '@/types'
import { PIPELINE_STAGES, CHANNEL_LABELS } from '@/types'
import Link from 'next/link'
import ProgressStatusBar from '@/app/components/ProgressStatusBar'

const STAGE_COLOR: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map(s => [s.key, s.color])
)

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Partial<Patient>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    Promise.all([getPatient(id), getClinics(), getConsultationsForPatient(id)])
      .then(([p, c, cons]) => {
        setPatient(p as Patient)
        setClinics(c as Clinic[])
        setConsultations(cons)
      })
      .finally(() => setLoading(false))
  }, [id])

  const set = (k: keyof Patient, v: unknown) => {
    setEdits(e => ({ ...e, [k]: v }))
    setDirty(true)
  }

  const val = (k: keyof Patient) => (edits[k] !== undefined ? edits[k] : patient?.[k]) as string

  const save = async () => {
    if (!patient || !dirty) return
    setSaving(true)
    try {
      const updated = await updatePatient(patient.id, edits)
      setPatient(updated)
      setEdits({})
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!patient) return <div className="p-8 text-gray-400">Patient not found</div>

  const stage = val('pipeline_stage') as PipelineStage
  const stageColor = STAGE_COLOR[stage] ?? '#6366f1'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-14 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{patient.name}</h1>
              <p className="text-xs text-gray-400">{patient.country} · {patient.surgery_type}</p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full text-white"
              style={{ backgroundColor: stageColor }}
            >
              {PIPELINE_STAGES.find(s => s.key === stage)?.label}
            </span>
          </div>
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {/* Progress status bar */}
      <ProgressStatusBar currentStage={stage} />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-6">

        {/* Left column — core info */}
        <div className="col-span-2 space-y-5">

          <Section title="Pipeline stage">
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              value={val('pipeline_stage')}
              onChange={e => set('pipeline_stage', e.target.value)}
            >
              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Section>

          <Section title="Patient details">
            <Grid2>
              <Field label="Full name">
                <Input value={val('name')} onChange={v => set('name', v)} />
              </Field>
              <Field label="Country">
                <Input value={val('country')} onChange={v => set('country', v)} />
              </Field>
              <Field label="Language">
                <Input value={val('language')} onChange={v => set('language', v)} />
              </Field>
              <Field label="Surgery type">
                <Input value={val('surgery_type')} onChange={v => set('surgery_type', v)} />
              </Field>
              <Field label="Preferred channel">
                <SelectField value={val('preferred_channel')} onChange={v => set('preferred_channel', v)}>
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </SelectField>
              </Field>
              <Field label="Conversion probability">
                <SelectField value={val('conversion_probability')} onChange={v => set('conversion_probability', v)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </SelectField>
              </Field>
            </Grid2>
          </Section>

          <Section title="Logistics">
            <Grid2>
              <Field label="Korea arrival">
                <Input type="date" value={val('korea_arrival_date') ?? ''} onChange={v => set('korea_arrival_date', v)} />
              </Field>
              <Field label="Surgery date">
                <Input type="date" value={val('surgery_date') ?? ''} onChange={v => set('surgery_date', v)} />
              </Field>
              <Field label="Clinic">
                <SelectField value={val('clinic_id') ?? ''} onChange={v => set('clinic_id', v)}>
                  <option value="">Not selected</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>
              </Field>
              <Field label="Hotel">
                <Input value={val('hotel_name') ?? ''} onChange={v => set('hotel_name', v)} placeholder="Hotel name" />
              </Field>
              <Field label="Check-in">
                <Input type="date" value={val('hotel_checkin') ?? ''} onChange={v => set('hotel_checkin', v)} />
              </Field>
              <Field label="Check-out">
                <Input type="date" value={val('hotel_checkout') ?? ''} onChange={v => set('hotel_checkout', v)} />
              </Field>
            </Grid2>
            <div className="mt-4 flex gap-6">
              <Checkbox
                label="Airport pickup arranged"
                checked={!!(edits.airport_pickup ?? patient.airport_pickup)}
                onChange={v => set('airport_pickup', v)}
              />
              <Checkbox
                label="Car / transfer arranged"
                checked={!!(edits.car_arranged ?? patient.car_arranged)}
                onChange={v => set('car_arranged', v)}
              />
            </div>
          </Section>

          <Section title="Deposit">
            <Grid2>
              <Field label="Amount">
                <Input
                  type="number"
                  value={val('deposit_amount') ?? ''}
                  onChange={v => set('deposit_amount', parseFloat(v) || null)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Currency">
                <Input value={val('deposit_currency') ?? 'USD'} onChange={v => set('deposit_currency', v)} />
              </Field>
              <Field label="Payment method">
                <SelectField value={val('payment_method') ?? ''} onChange={v => set('payment_method', v)}>
                  <option value="">Not paid</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </SelectField>
              </Field>
              <Field label="Quote sent via">
                <SelectField value={val('quote_sent_via') ?? ''} onChange={v => set('quote_sent_via', v)}>
                  <option value="">Not sent</option>
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </SelectField>
              </Field>
            </Grid2>
          </Section>

          <Section title="Post-care (happy call)">
            <Grid2>
              <Field label="Happy call date">
                <Input type="date" value={val('happy_call_date') ?? ''} onChange={v => set('happy_call_date', v)} />
              </Field>
              <Field label="Outcome">
                <Input value={val('happy_call_outcome') ?? ''} onChange={v => set('happy_call_outcome', v)} placeholder="Patient satisfied, healing well…" />
              </Field>
            </Grid2>
          </Section>

          <Section title="Notes">
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={4}
              value={val('notes') ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Internal notes…"
            />
          </Section>
        </div>

        {/* Right column — consultations + meta */}
        <div className="space-y-5">
          <Section title="Consultations">
            <Link
              href={`/consultations?patient=${patient.id}`}
              className="block text-xs text-indigo-600 font-medium hover:underline mb-3"
            >
              + Schedule consultation
            </Link>
            {consultations.length === 0 ? (
              <p className="text-xs text-gray-300 py-4 text-center">None yet</p>
            ) : (
              <div className="space-y-2">
                {consultations.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-700">
                      {new Date(c.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {c.completed && <span className="text-xs text-emerald-600">✓ Completed</span>}
                    {c.dominic_memo && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.dominic_memo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Record info">
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{new Date(patient.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{new Date(patient.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Source</span>
                <span className="capitalize">{patient.lead_source.replace('_', ' ')}</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

// Shared primitives
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string | number | null | undefined
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
    />
  )
}

function SelectField({ value, onChange, children }: {
  value: string | null | undefined
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    >
      {children}
    </select>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-indigo-600"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}
