'use client'
// src/app/leads/import/page.tsx
// Bulk CSV import for leads — upload → preview & validate → insert

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { importPatients } from '@/lib/db'
import type { LeadSource, CommsChannel, ConversionProbability } from '@/types'

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_SOURCES:  LeadSource[]           = ['whatsapp', 'email', 'booking_form', 'ad']
const VALID_CHANNELS: CommsChannel[]         = ['whatsapp', 'kakaotalk', 'telegram', 'instagram', 'line', 'wechat', 'email']
const VALID_PROBS:    ConversionProbability[] = ['low', 'medium', 'high']

const TEMPLATE_CSV = [
  'name,country,language,surgery_type,lead_source,preferred_channel,conversion_probability,korea_arrival_date,notes',
  'Kim Soo-jin,South Korea,Korean,nose,whatsapp,kakaotalk,high,2025-08-15,Interested in rhinoplasty',
  'Siti Rahma,Indonesia,Bahasa Indonesia,eyes,booking_form,whatsapp,medium,,LASIK enquiry from website',
  'Maria Santos,Philippines,Filipino,face,ad,instagram,low,,Saw our Instagram ad',
].join('\n')

const COLUMNS = [
  { col: 'name',                   required: true },
  { col: 'country',                required: true },
  { col: 'surgery_type',           required: true },
  { col: 'language',               required: false },
  { col: 'lead_source',            required: false },
  { col: 'preferred_channel',      required: false },
  { col: 'conversion_probability', required: false },
  { col: 'korea_arrival_date',     required: false },
  { col: 'notes',                  required: false },
]

// ── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim())

  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  )

  return lines.slice(1)
    .map(line => {
      const vals = parseCSVLine(line)
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
    })
    .filter(row => Object.values(row).some(v => v !== ''))
}

// Look up a value from multiple possible column name aliases
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k]
  return ''
}

// ── Row type and mapper ──────────────────────────────────────────────────────

interface ParsedRow {
  index:                number
  name:                 string
  country:              string
  language:             string
  surgery_type:         string
  lead_source:          LeadSource
  preferred_channel:    CommsChannel
  conversion_probability: ConversionProbability
  korea_arrival_date:   string | null
  notes:                string
  errors:               string[]
}

function mapRow(raw: Record<string, string>, index: number): ParsedRow {
  const errors: string[] = []

  const name         = pick(raw, 'name', 'full_name', 'patient_name')
  const country      = pick(raw, 'country')
  const surgery_type = pick(raw, 'surgery_type', 'surgery')

  if (!name)         errors.push('Name is required')
  if (!country)      errors.push('Country is required')
  if (!surgery_type) errors.push('Surgery type is required')

  const rawSource  = pick(raw, 'lead_source', 'source')
  const rawChannel = pick(raw, 'preferred_channel', 'channel')
  const rawProb    = pick(raw, 'conversion_probability', 'probability', 'prob')
  const rawArrival = pick(raw, 'korea_arrival_date', 'arrival_date', 'arrival')

  return {
    index,
    name,
    country,
    language:               pick(raw, 'language') || country,
    surgery_type,
    lead_source:            VALID_SOURCES.includes(rawSource as LeadSource)   ? rawSource as LeadSource   : 'email',
    preferred_channel:      VALID_CHANNELS.includes(rawChannel as CommsChannel) ? rawChannel as CommsChannel : 'email',
    conversion_probability: VALID_PROBS.includes(rawProb as ConversionProbability) ? rawProb as ConversionProbability : 'medium',
    korea_arrival_date:     rawArrival || null,
    notes:                  pick(raw, 'notes', 'note'),
    errors,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'leads_import_template.csv' })
  a.click()
  URL.revokeObjectURL(url)
}

const PROB_STYLE: Record<ConversionProbability, string> = {
  high:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-red-100 text-red-700',
}

// ── Component ────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [stage,     setStage]     = useState<Stage>('idle')
  const [rows,      setRows]      = useState<ParsedRow[]>([])
  const [fileName,  setFileName]  = useState('')
  const [dragging,  setDragging]  = useState(false)
  const [fileError, setFileError] = useState('')
  const [progress,  setProgress]  = useState({ done: 0, total: 0, failed: 0 })

  // ── File processing ────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    setFileError('')
    if (!file.name.endsWith('.csv')) {
      setFileError('Please upload a .csv file.')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const raw  = parseCSV(text)
      if (raw.length === 0) {
        setFileError('No data rows found. Make sure the file has a header row and at least one data row.')
        return
      }
      setRows(raw.map((r, i) => mapRow(r, i + 1)))
      setStage('preview')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const resetToIdle = () => {
    setStage('idle')
    setRows([])
    setFileName('')
    setFileError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  const validRows   = rows.filter(r => r.errors.length === 0)
  const invalidRows = rows.filter(r => r.errors.length > 0)

  const handleImport = async () => {
    setStage('importing')
    setProgress({ done: 0, total: validRows.length, failed: 0 })

    let failed = 0
    const BATCH = 50

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map(r => ({
        name:                   r.name,
        country:                r.country,
        language:               r.language,
        surgery_type:           r.surgery_type,
        lead_source:            r.lead_source,
        preferred_channel:      r.preferred_channel,
        conversion_probability: r.conversion_probability,
        pipeline_stage:         'new_lead' as const,
        korea_arrival_date:     r.korea_arrival_date,
        notes:                  r.notes || null,
        deposit_currency:       'USD',
        airport_pickup:         false,
        car_arranged:           false,
        assigned_rep:           null,
        assigned_coordinator:   null,
        clinic_id:              null,
        deposit_amount:         null,
        payment_method:         null,
        hotel_name:             null,
        hotel_checkin:          null,
        hotel_checkout:         null,
        surgery_date:           null,
        quote_sent_via:         null,
        quote_sent_at:          null,
        happy_call_date:        null,
        happy_call_outcome:     null,
      }))

      try {
        await importPatients(batch)
      } catch {
        failed += batch.length
      }

      setProgress(p => ({ ...p, done: Math.min(i + BATCH, validRows.length) }))
    }

    setProgress(p => ({ ...p, failed }))
    setStage('done')
  }

  // ── Render: importing ──────────────────────────────────────────────────────

  if (stage === 'importing') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="font-semibold text-gray-900 mb-1">Importing leads…</p>
          <p className="text-sm text-gray-400 mb-4">{progress.done} of {progress.total}</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Render: done ───────────────────────────────────────────────────────────

  if (stage === 'done') {
    const imported = progress.total - progress.failed
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">
            ✓
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import complete</h2>
          <p className="text-gray-500 text-sm mb-1">
            <span className="font-semibold text-emerald-600">{imported}</span> lead{imported !== 1 ? 's' : ''} imported successfully
          </p>
          {progress.failed > 0 && (
            <p className="text-red-500 text-sm mb-4">{progress.failed} batch{progress.failed !== 1 ? 'es' : ''} failed</p>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={resetToIdle}
              className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Import more
            </button>
            <Link
              href="/dashboard"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors inline-flex items-center justify-center"
            >
              View Pipeline →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: idle + preview ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Leads</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Bulk-upload patients from a CSV file
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            ↓ Download Template
          </button>
        </div>

        {/* ── IDLE: drop zone + column guide ── */}
        {stage === 'idle' && (
          <>
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
              }`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="text-5xl mb-4">📂</div>
              <p className="text-gray-800 font-semibold text-lg">Drop your CSV file here</p>
              <p className="text-gray-400 text-sm mt-2">or click to browse</p>
              {fileError && (
                <p className="mt-4 text-sm text-red-500 font-medium">{fileError}</p>
              )}
            </div>

            {/* Column reference */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Expected columns
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COLUMNS.map(({ col, required }) => (
                  <div key={col} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${required ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                    <code className="text-xs text-gray-700">{col}</code>
                    {required && <span className="text-xs text-indigo-500 font-medium">required</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Column names are case-insensitive. Unrecognised values fall back to sensible defaults.
              </p>
            </div>
          </>
        )}

        {/* ── PREVIEW: table ── */}
        {stage === 'preview' && (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-5 mb-5">
              <span className="text-sm text-gray-500">
                File: <span className="font-semibold text-gray-900">{fileName}</span>
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  {invalidRows.length} with errors
                </span>
              )}
            </div>

            {/* Preview table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['#', 'Name', 'Country', 'Surgery', 'Source', 'Channel', 'Prob.', 'Arrival', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map(row => {
                      const ok = row.errors.length === 0
                      return (
                        <tr key={row.index} className={ok ? '' : 'bg-red-50'}>
                          <td className="px-4 py-2.5 text-gray-400">{row.index}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            {row.name || <span className="text-red-400 italic">missing</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {row.country || <span className="text-red-400 italic">missing</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {row.surgery_type || <span className="text-red-400 italic">missing</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{row.lead_source}</td>
                          <td className="px-4 py-2.5 text-gray-500">{row.preferred_channel}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${PROB_STYLE[row.conversion_probability]}`}>
                              {row.conversion_probability}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            {row.korea_arrival_date ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {ok
                              ? <span className="text-emerald-600 font-semibold">✓ OK</span>
                              : (
                                <span className="text-red-500" title={row.errors.join(' · ')}>
                                  ⚠ {row.errors.join(' · ')}
                                </span>
                              )
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetToIdle}
                className="border border-gray-200 text-gray-700 rounded-xl px-5 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                ← Choose different file
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
              >
                Import {validRows.length} Lead{validRows.length !== 1 ? 's' : ''} →
              </button>
              {invalidRows.length > 0 && validRows.length > 0 && (
                <p className="text-xs text-gray-400">
                  {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} with errors will be skipped
                </p>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
