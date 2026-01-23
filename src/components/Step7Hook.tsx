'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, HookType } from '@/contexts/WizardContext'

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
    description: 'Two types of liquidations',
    features: ['Gauge', 'Two types of liquidations']
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
    setError('')
    setLoading(true)

    try {
      if (!selectedHook) {
        throw new Error('Please select a hook implementation')
      }

      updateSelectedHook(selectedHook)

      // Mark step as completed
      markStepCompleted(7)

      // Move to next step
      router.push('/wizard?step=8')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=6')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 7: Hook Selection
        </h1>
        <p className="text-gray-300 text-lg">
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
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="hook"
                value={option.value}
                checked={selectedHook === option.value}
                onChange={(e) => setSelectedHook(e.target.value as HookType)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="font-semibold text-white text-lg">
                    {option.name}
                  </span>
                  {selectedHook === option.value && (
                    <span className="text-green-400 text-sm">✓ Selected</span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  {option.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {option.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
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
            <div className="text-red-400 text-sm">
              ✗ {error}
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={goToPreviousStep}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Fees</span>
          </button>
          <button
            type="submit"
            disabled={loading || !selectedHook}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
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
                <span>JSON Config</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
