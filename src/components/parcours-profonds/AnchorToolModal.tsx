// components/parcours-profonds/AnchorToolModal.tsx
'use client'

import { useState } from 'react'
import type { DeepJourneyAnchorTool } from '@/lib/deepJourneys'

interface AnchorToolModalProps {
  tool: DeepJourneyAnchorTool
  onClose: () => void
}

export default function AnchorToolModal({ tool, onClose }: AnchorToolModalProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const isLastStep = currentStep === tool.steps.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 pb-4 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anchor-tool-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-cream p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <h2 id="anchor-tool-title" className="text-lg font-medium text-[#4D7257] pr-4">
            {tool.title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex-shrink-0 w-9 h-9 rounded-full bg-[#EAF1E8] flex items-center justify-center text-[#4D7257] text-lg"
          >
            ×
          </button>
        </div>

        {tool.context_note && (
          <p className="text-sm text-[#6B6B66] italic mb-4 leading-relaxed">
            {tool.context_note}
          </p>
        )}

        <div className="rounded-2xl bg-[#EAF1E8] p-5 mb-5 min-h-[100px] flex items-center">
          <p className="text-[15px] text-[#3A3A36] leading-relaxed">
            {tool.steps[currentStep]}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {tool.steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentStep ? 'w-6 bg-[#8FAE8E]' : 'w-1.5 bg-[#D8E3D6]'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(s => s - 1)}
              className="flex-1 py-3 rounded-xl border border-[#C3D6C2] text-[#4D7257] text-sm font-medium"
            >
              Précédent
            </button>
          )}

          {!isLastStep ? (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              className="flex-1 py-3 rounded-xl bg-[#8FAE8E] text-white text-sm font-medium"
            >
              Suivant
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-[#8FAE8E] text-white text-sm font-medium"
            >
              Je continue
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full text-center text-xs text-[#6B6B66] mt-4 underline"
        >
          Je préfère faire une pause et revenir plus tard
        </button>
      </div>
    </div>
  )
}