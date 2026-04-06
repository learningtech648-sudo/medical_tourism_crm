'use client'
// src/app/analytics/page.tsx

import { useEffect, useState } from 'react'
import { getPipelineCounts, getMonthlyVolume, getLeadSourceBreakdown } from '@/lib/db'
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

export default function AnalyticsPage() {
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [monthly, setMonthly] = useState<{ month: string; leads: number; surgeries: number }[]>([])
  const [sources, setSources] = useState<{ source: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPipelineCounts(), getMonthlyVolume(), getLeadSourceBreakdown()])
      .then(([s, m, src]) => { setStageCounts(s); setMonthly(m); setSources(src as typeof sources) })
      .finally(() => setLoading(false))
  }, [])

  const funnelData = PIPELINE_STAGES.map(s => ({
    label: s.label,
    count: stageCounts[s.key] ?? 0,
    color: s.color,
  }))

  const totalLeads    = Object.values(stageCounts).reduce((a, b) => a + b, 0)
  const totalSurgeries = (stageCounts['surgery_done'] ?? 0) + (stageCounts['post_care'] ?? 0)
  const depositPaid   = Object.entries(stageCounts)
    .filter(([k]) => ['deposit_paid', 'arrival_confirmed', 'surgery_done', 'post_care'].includes(k))
    .reduce((a, [, v]) => a + v, 0)
  const convRate = totalLeads > 0 ? ((depositPaid / totalLeads) * 100).toFixed(1) : '0'

  const sourceData = sources.map(s => ({
    name: SOURCE_LABELS[s.source as keyof typeof SOURCE_LABELS] ?? s.source,
    count: s.count,
  }))

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Analytics</h1>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total leads', value: totalLeads, sub: 'all time' },
            { label: 'Surgeries done', value: totalSurgeries, sub: 'surgery_done + post_care' },
            { label: 'Deposit conversion', value: `${convRate}%`, sub: 'leads → deposit paid' },
            { label: 'Active pipeline', value: totalLeads - totalSurgeries, sub: 'pre-surgery' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs text-gray-400 font-medium mb-1">{k.label}</p>
              <p className="text-3xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-300 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Stage funnel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">Pipeline funnel</h2>
            <div className="space-y-2">
              {funnelData.map(({ label, count, color }) => {
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{label}</span>
                      <span className="font-medium text-gray-700">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lead sources */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">Lead sources</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                  cursor={{ fill: '#f3f4f6' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly volume */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm">Monthly volume — last 6 months</h2>
          {monthly.length === 0 ? (
            <p className="text-sm text-gray-300 py-8 text-center">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Leads" />
                <Line type="monotone" dataKey="surgeries" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Surgeries" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
