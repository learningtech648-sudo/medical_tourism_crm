'use client'
// src/app/dashboard/page.tsx
// Pipeline kanban board — main view for coordinators and CS staff

import { useEffect, useState, useCallback } from 'react'
import { getPatients, updateStage } from '@/lib/db'
import type { Patient, PipelineStage } from '@/types'
import { PIPELINE_STAGES } from '@/types'
import Link from 'next/link'

const PROB_COLOR: Record<string, string> = {
  high:   'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  low:    'bg-red-100 text-red-800',
}

function PatientCard({ patient, onStageChange }: {
  patient: Patient
  onStageChange: (id: string, stage: PipelineStage) => void
}) {
  const stageInfo = PIPELINE_STAGES.find(s => s.key === patient.pipeline_stage)

  return (
    <div className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer">
      <Link href={`/patients/${patient.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{patient.country} · {patient.surgery_type}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PROB_COLOR[patient.conversion_probability]}`}>
            {patient.conversion_probability}
          </span>
        </div>

        {patient.korea_arrival_date && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-gray-400">✈</span>
            <span className="text-xs text-gray-600">
              {new Date(patient.korea_arrival_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}

        {patient.clinic && (
          <p className="text-xs text-indigo-600 mt-1 font-medium">{patient.clinic.name}</p>
        )}
      </Link>

      <div className="mt-3 pt-3 border-t border-gray-50">
        <select
          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={patient.pipeline_stage}
          onChange={e => onStageChange(patient.id, e.target.value as PipelineStage)}
          onClick={e => e.stopPropagation()}
        >
          {PIPELINE_STAGES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function StageColumn({ stage, patients, onStageChange }: {
  stage: typeof PIPELINE_STAGES[0]
  patients: Patient[]
  onStageChange: (id: string, stage: PipelineStage) => void
}) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-semibold text-gray-700">{stage.label}</h3>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {patients.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto pb-4 max-h-[calc(100vh-200px)]">
        {patients.length === 0 ? (
          <div className="border-2 border-dashed border-gray-100 rounded-xl p-6 text-center">
            <p className="text-xs text-gray-300">No patients</p>
          </div>
        ) : (
          patients.map(p => (
            <PatientCard key={p.id} patient={p} onStageChange={onStageChange} />
          ))
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStage, setFilterStage] = useState<PipelineStage | 'all'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPatients()
      setPatients(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleStageChange = async (id: string, stage: PipelineStage) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, pipeline_stage: stage } : p))
    await updateStage(id, stage)
  }

  const filtered = patients.filter(p => {
    const matchStage = filterStage === 'all' || p.pipeline_stage === filterStage
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.country.toLowerCase().includes(search.toLowerCase())
    return matchStage && matchSearch
  })

  const byStage = (stage: PipelineStage) =>
    filtered.filter(p => p.pipeline_stage === stage)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-14 z-10">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Patient Pipeline</h1>
            {!loading && (
              <span className="text-sm text-gray-400">{patients.length} total</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search patients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={filterStage}
              onChange={e => setFilterStage(e.target.value as PipelineStage | 'all')}
            >
              <option value="all">All stages</option>
              {PIPELINE_STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <Link
              href="/leads/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Lead
            </Link>
          </div>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto px-6 py-6">
          <div className="flex gap-5 min-w-max">
            {PIPELINE_STAGES.map(stage => (
              <StageColumn
                key={stage.key}
                stage={stage}
                patients={byStage(stage.key)}
                onStageChange={handleStageChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
