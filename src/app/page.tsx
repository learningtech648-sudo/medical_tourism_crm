// src/app/page.tsx
// CRM home — quick overview and entry points

import Link from 'next/link'

const QUICK_LINKS = [
  {
    href: '/dashboard',
    title: 'Patient Pipeline',
    description: 'View and manage patients across all pipeline stages.',
    icon: '🗂',
    color: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300',
    iconBg: 'bg-indigo-100',
  },
  {
    href: '/consultations',
    title: 'Consultations',
    description: 'Schedule, track and record consultation memos.',
    icon: '📋',
    color: 'bg-blue-50 border-blue-100 hover:border-blue-300',
    iconBg: 'bg-blue-100',
  },
  {
    href: '/analytics',
    title: 'Analytics',
    description: 'Monitor conversion rates, revenue and lead sources.',
    icon: '📊',
    color: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    iconBg: 'bg-emerald-100',
  },
  {
    href: '/leads/new',
    title: 'Add New Lead',
    description: 'Register a new patient enquiry into the pipeline.',
    icon: '➕',
    color: 'bg-amber-50 border-amber-100 hover:border-amber-300',
    iconBg: 'bg-amber-100',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100 px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-5">
            <span className="text-white text-xl font-bold">MT</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Medical Tourism CRM
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Manage patient enquiries, consultations and the full journey from first contact to post-care — all in one place.
          </p>
        </div>
      </div>

      {/* Quick-access cards */}
      <div className="max-w-4xl mx-auto w-full px-6 py-10">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 ${link.color}`}
            >
              <div className={`w-10 h-10 rounded-xl ${link.iconBg} flex items-center justify-center text-lg flex-shrink-0`}>
                {link.icon}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{link.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{link.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
