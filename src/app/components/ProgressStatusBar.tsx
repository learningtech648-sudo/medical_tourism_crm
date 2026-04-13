// src/app/components/ProgressStatusBar.tsx
// Pipeline progress tracker — shows patient journey across all stages

import { PIPELINE_STAGES } from '@/types'
import type { PipelineStage } from '@/types'

interface ProgressStatusBarProps {
  currentStage: PipelineStage
}

export default function ProgressStatusBar({ currentStage }: ProgressStatusBarProps) {
  const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === currentStage)
  const progressPct = Math.round(((currentIndex) / (PIPELINE_STAGES.length - 1)) * 100)

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-5">
      <div className="max-w-5xl mx-auto">

        {/* Label row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Patient Journey
          </p>
          <span className="text-xs font-semibold text-indigo-600">
            {progressPct}% complete
          </span>
        </div>

        {/* Thin progress fill bar */}
        <div className="relative w-full h-1.5 bg-gray-100 rounded-full mb-5">
          <div
            className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Stage dots + labels */}
        <div className="flex items-start">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentIndex
            const isCurrent  = idx === currentIndex

            return (
              <div key={stage.key} className="flex items-center flex-1 last:flex-none">

                {/* Dot + label */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-indigo-600'
                        : isCurrent
                        ? 'bg-white border-2 border-indigo-600 ring-4 ring-indigo-100'
                        : 'bg-gray-200'
                    }`}
                  >
                    {isCompleted && (
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`text-[9px] mt-1.5 font-medium text-center leading-tight max-w-[52px] ${
                      isCurrent
                        ? 'text-indigo-600'
                        : isCompleted
                        ? 'text-gray-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>

                {/* Connector line */}
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-1 -mt-4 ${
                      idx < currentIndex ? 'bg-indigo-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
