'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, HookType } from '@/contexts/WizardContext'
import Button from '@/components/Button'

interface HookOption {
  value: HookType
  name: string
  description: string
  features: string[]
}

const hookOptions: HookOption[] = [
  {
    value: 'SiloHookV1',
    name: 'SiloHookV1',
    description: 'Standard liquidation',
    features: ['Gauge', 'Standard liquidation']
  },
  {
    value: 'SiloHookV2',
    name: 'SiloHookV2',
    description: 'Standard and defaulting liquidations',
    features: ['Gauge', 'Standard liquidation', 'Defaulting liquidation']
  },
  {
    value: 'SiloHookV3',
    name: 'SiloHookV3',
    description: 'Only defaulting liquidation',
    features: ['Gauge', 'Only defaulting liquidation']
  }
]

export default function Step7Hook() {
  const router = useRouter()
  const { wizardData, updateSelectedHook, markStepCompleted } = useWizard()
  
  const [selectedHook, setSelectedHook] = useState<HookType | null>(wizardData.selectedHook)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load existing selection if available
  useEffect(() => {
    if (wizardData.selectedHook) {
      setSelectedHook(wizardData.selectedHook)
    }
  }, [wizardData.selectedHook])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []
    if (!selectedHook) errors.push('Please select a hook implementation')

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }

    setError('')
    setLoading(true)

    try {
      updateSelectedHook(selectedHook!)

      // Mark step as completed
      markStepCompleted(9)

      // Move to next step
      router.push('/wizard?step=10')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=8')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 9: Hook Selection
        </h1>
        <p className="silo-text-soft text-lg">
          Choose a hook implementation for your market
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hook Options */}
        <div className="space-y-4">
          {hookOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-start space-x-4 p-6 rounded-lg border cursor-pointer transition-all ${
                selectedHook === option.value
                  ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_46%,var(--silo-surface))]'
                  : 'border-[var(--silo-border)] bg-[var(--silo-surface)] hover:border-[var(--silo-accent)]/45 hover:bg-[var(--silo-surface)]'
              }`}
            >
              <input
                type="radio"
                name="hook"
                value={option.value}
                checked={selectedHook === option.value}
                onChange={(e) => setSelectedHook(e.target.value as HookType)}
                className="mt-1 accent-[var(--silo-accent)]"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="font-semibold silo-text-main text-lg">
                    {option.name}
                  </span>
                  {selectedHook === option.value && (
                    <span className="status-muted-success text-sm">✓ Selected</span>
                  )}
                </div>
                <p className="text-sm silo-text-soft mb-3">
                  {option.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {option.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs rounded border border-[var(--silo-border)] bg-[var(--silo-surface)] silo-text-soft"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <p className="text-red-400 font-medium mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-red-400 text-sm space-y-1">
              {error.split('\n').map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="secondary" size="lg" onClick={goToPreviousStep}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Fees</span>
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={loading}>
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Hook Owner</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
