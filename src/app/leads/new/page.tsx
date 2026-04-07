'use client'
// src/app/leads/new/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPatient } from '@/lib/db'
import type { LeadSource, CommsChannel, ConversionProbability } from '@/types'

const CHANNELS: CommsChannel[] = ['whatsapp', 'kakaotalk', 'telegram', 'instagram', 'line', 'wechat', 'email']
const SOURCES: LeadSource[]    = ['whatsapp', 'email', 'booking_form', 'ad']
const SURGERY_TYPES = ['Eyes', 'Nose', 'Face', 'Breast', 'Body', 'Other']

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name:                   '',
    country:                '',
    language:               '',
    lead_source:            'whatsapp' as LeadSource,
    preferred_channel:      'whatsapp' as CommsChannel,
    surgery_type:           '',
    conversion_probability: 'medium' as ConversionProbability,
    korea_arrival_date:     '',
    notes:                  '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name || !form.country || !form.surgery_type) {
      setError('Name, country, and surgery type are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const patient = await createPatient({
        ...form,
        language: form.language || form.country,
        pipeline_stage: 'new_lead',
        deposit_currency: 'USD',
        airport_pickup: false,
        car_arranged: false,
        assigned_rep: null,
        assigned_coordinator: null,
        clinic_id: null,
        deposit_amount: null,
        payment_method: null,
        hotel_name: null,
        hotel_checkin: null,
        hotel_checkout: null,
        quote_sent_via: null,
        quote_sent_at: null,
        happy_call_date: null,
        happy_call_outcome: null,
        korea_arrival_date: form.korea_arrival_date || null,
        surgery_date: null,
      })
      router.push(`/patients/${patient.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">New Lead</h1>
          <p className="text-gray-500 mt-1 text-sm">Capture inbound contact details</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">

          {/* Section: Patient */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Patient</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Full name *</Label>
                <Input value={form.name} onChange={v => set('name', v)} placeholder="Kim Soo-jin" />
              </div>
              <div>
                <Label>Country *</Label>
                <Input value={form.country} onChange={v => set('country', v)} placeholder="Indonesia" />
              </div>
              <div>
                <Label>Language</Label>
                <Input value={form.language} onChange={v => set('language', v)} placeholder="Bahasa Indonesia" />
              </div>
            </div>
          </div>

          {/* Section: Lead */}
          <div className="pt-4 border-t border-gray-50">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Lead info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lead source</Label>
                <Select value={form.lead_source} onChange={v => set('lead_source', v)}>
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </div>
              <div>
                <Label>Preferred comms channel</Label>
                <Select value={form.preferred_channel} onChange={v => set('preferred_channel', v)}>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Surgery type *</Label>
                <Select value={form.surgery_type} onChange={v => set('surgery_type', v)}>
                  <option value="">Select…</option>
                  {SURGERY_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label>Conversion probability</Label>
                <Select value={form.conversion_probability} onChange={v => set('conversion_probability', v)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Section: Travel */}
          <div className="pt-4 border-t border-gray-50">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Travel</h2>
            <div>
              <Label>Planned arrival in Korea</Label>
              <Input
                type="date"
                value={form.korea_arrival_date}
                onChange={v => set('korea_arrival_date', v)}
              />
              <p className="text-xs text-gray-400 mt-1">Most critical qualifying factor per spec</p>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-4 border-t border-gray-50">
            <Label>Notes</Label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={3}
              placeholder="Any additional context from the initial contact…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
            >
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tiny shared form primitives
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 mb-1.5">{children}</label>
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
    />
  )
}

function Select({ value, onChange, children }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    >
      {children}
    </select>
  )
}
