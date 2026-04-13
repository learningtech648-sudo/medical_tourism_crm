'use client'
// src/app/components/Navbar.tsx
// Global navigation bar — Home button + section links

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/dashboard',     label: 'Pipeline' },
  { href: '/consultations', label: 'Consultations' },
  { href: '/analytics',     label: 'Analytics' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-gray-100 px-6 sticky top-0 z-30">
      <div className="max-w-[1800px] mx-auto flex items-center gap-5 h-14">

        {/* Home button */}
        <Link
          href="/"
          className="flex items-center gap-2 group mr-2"
          aria-label="Go to home"
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
            <span className="text-white text-xs font-bold">MT</span>
          </div>
          <span className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors hidden sm:block">
            Home
          </span>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Section links */}
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium h-14 flex items-center border-b-2 transition-colors ${
              pathname.startsWith(link.href)
                ? 'text-indigo-600 border-indigo-600'
                : 'text-gray-500 hover:text-indigo-600 border-transparent hover:border-indigo-300'
            }`}
          >
            {link.label}
          </Link>
        ))}

      </div>
    </nav>
  )
}
