'use client'
// src/app/consultations/page.tsx

import { useEffect, useState } from 'react'
import { getConsultations, createConsultation, saveConsultationMemo, getPatients, getClinics } from '@/lib/db'
import type { Consultation, Patient, Clinic } from '@/types'

const MEET_LINK = process.env.NEXT_PUBLIC_GOOGLE_MEET_LINK ?? 'https://meet.google.com/your-fixed-link'

function needsReminder(c: Consultation) {
  const diff = new Date(c.scheduled_at).getTime() - Date.now()
  return diff > 0 && diff <= 16 * 60 * 1000 && !c.reminder_sent
}

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)

  // New consult form
  const [showForm, setShowForm] = useState(false)
  const [newPatientId, setNewPatientId] = useState('')
  const [newDatetime, setNewDatetime] = useState('')
  const [saving, setSaving] = useState(false)

  // Memo form
  const [memoConsultId, setMemoConsultId] = useState<string | null>(null)
  const [memoText, setMemoText] = useState('')
  const [memoClinic, setMemoClinic] = useState('')

  useEffect(() => {
    Promise.all([getConsultations(false), getPatients(), getClinics()])
      .then(([c, p, cl]) => { setConsultations(c); setPatients(p); setClinics(cl as Clinic[]) })
      .finally(() => setLoading(false))

    // Poll every 60s to surface reminder alerts
    const interval = setInterval(async () => {
      const fresh = await getConsultations(false)
      setConsultations(fresh)
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async () => {
    if (!newPatientId || !newDatetime) return
    setSaving(true)
    try {
      const c = await createConsultation({ patient_id: newPatientId, scheduled_at: new Date(newDatetime).toISOString() })
      setConsultations(prev => [c, ...prev])
      setShowForm(false)
      setNewPatientId('')
      setNewDatetime('')
    } finally {
      setSaving(false)
    }
  }

  const handleMemoSave = async (id: string) => {
    await saveConsultationMemo(id, memoText, memoClinic || undefined)
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, dominic_memo: memoText, completed: true } : c))
    setMemoConsultId(null)
    setMemoText('')
    setMemoClinic('')
  }

  const upcoming = consultations.filter(c => !c.completed && new Date(c.scheduled_at) >= new Date())
  const past     = consultations.filter(c => c.completed || new Date(c.scheduled_at) < new Date())
  const reminders = consultations.filter(needsReminder)

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Reminder alerts */}
        {reminders.map(c => (
          <div key={c.id} className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-500 text-lg">⏰</span>
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  Consultation in ~15 minutes — {c.patient?.name}
                </p>
                <p className="text-xs text-amber-700">
                  {new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <a
              href={c.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Join Meet
            </a>
          </div>
        ))}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultations</h1>
            <p className="text-sm text-gray-400 mt-0.5">Fixed Meet link · 15-min CS reminders</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            + Schedule
          </button>
        </div>

        {/* New consult form */}
        {showForm && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Schedule Consultation</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Patient</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  value={newPatientId}
                  onChange={e => setNewPatientId(e.target.value)}
                >
                  <option value="">Select patient…</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.country}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date & Time (patient timezone)</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={newDatetime}
                  onChange={e => setNewDatetime(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 bg-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-indigo-800">Fixed Google Meet link</p>
                <p className="text-xs text-indigo-600 font-mono mt-0.5">{MEET_LINK}</p>
              </div>
              <a
                href={MEET_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                Copy ↗
              </a>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                {saving ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        )}

        {/* Upcoming */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Section title="Upcoming" count={upcoming.length}>
              {upcoming.map(c => (
                <ConsultCard
                  key={c.id}
                  consult={c}
                  clinics={clinics}
                  onMemo={() => { setMemoConsultId(c.id); setMemoText(c.dominic_memo ?? '') }}
                  isMemo={memoConsultId === c.id}
                  memoText={memoText}
                  memoClinic={memoClinic}
                  onMemoText={setMemoText}
                  onMemoClinic={setMemoClinic}
                  onMemoSave={() => handleMemoSave(c.id)}
                  onMemoCancel={() => setMemoConsultId(null)}
                />
              ))}
            </Section>

            <Section title="Past" count={past.length}>
              {past.slice(0, 10).map(c => (
                <ConsultCard
                  key={c.id}
                  consult={c}
                  clinics={clinics}
                  onMemo={() => { setMemoConsultId(c.id); setMemoText(c.dominic_memo ?? '') }}
                  isMemo={memoConsultId === c.id}
                  memoText={memoText}
                  memoClinic={memoClinic}
                  onMemoText={setMemoText}
                  onMemoClinic={setMemoClinic}
                  onMemoSave={() => handleMemoSave(c.id)}
                  onMemoCancel={() => setMemoConsultId(null)}
                />
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-600">{title}</h2>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div className="space-y-3">
        {count === 0 && <p className="text-sm text-gray-300 py-4 text-center">None</p>}
        {children}
      </div>
    </div>
  )
}

function ConsultCard({ consult, clinics, onMemo, isMemo, memoText, memoClinic, onMemoText, onMemoClinic, onMemoSave, onMemoCancel }: {
  consult: Consultation
  clinics: Clinic[]
  onMemo: () => void
  isMemo: boolean
  memoText: string
  memoClinic: string
  onMemoText: (v: string) => void
  onMemoClinic: (v: string) => void
  onMemoSave: () => void
  onMemoCancel: () => void
}) {
  const dt = new Date(consult.scheduled_at)
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{consult.patient?.name ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}
            {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {consult.completed && (
            <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">Done</span>
          )}
          <a
            href={consult.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Join ↗
          </a>
          <button
            onClick={onMemo}
            className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Memo
          </button>
        </div>
      </div>

      {consult.dominic_memo && !isMemo && (
        <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Dominic's memo</p>
          <p className="text-sm text-gray-700">{consult.dominic_memo}</p>
        </div>
      )}

      {isMemo && (
        <div className="mt-3 space-y-3">
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            rows={3}
            placeholder="Post-call memo — summary and clinic recommendation…"
            value={memoText}
            onChange={e => onMemoText(e.target.value)}
          />
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            value={memoClinic}
            onChange={e => onMemoClinic(e.target.value)}
          >
            <option value="">Recommended clinic (optional)</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={onMemoCancel} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={onMemoSave} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700">Save memo</button>
          </div>
        </div>
      )}
    </div>
  )
}
