'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { ethers } from 'ethers'
import OwnerSelectionBlock from '@/components/OwnerSelectionBlock'
import Button from '@/components/Button'

export default function Step8HookOwner() {
  const router = useRouter()
  const { wizardData, updateHookOwnerAddress, markStepCompleted } = useWizard()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasValidOwner = !!(
    wizardData.hookOwnerAddress &&
    ethers.isAddress(wizardData.hookOwnerAddress) &&
    wizardData.hookOwnerAddress !== ethers.ZeroAddress
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasValidOwner) {
      setError('Please enter a valid address or a name from the supported list')
      return
    }

    setError('')
    setLoading(true)

    try {
      markStepCompleted(10)
      router.push('/wizard?step=11')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=9')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 10: Hook Owner Selection
        </h1>
        <p className="text-gray-300 text-lg">
          Enter the address of the hook owner. This applies to all hook types. The same owner will be used for Gauge (Silo Incentive Controllers).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <OwnerSelectionBlock
          value={wizardData.hookOwnerAddress}
          onChange={updateHookOwnerAddress}
          chainId={wizardData.networkInfo?.chainId}
          networkName={wizardData.networkInfo?.networkName}
          shortcuts={[{ label: 'DAO', value: 'DAO' }]}
          repositoryLinkLabelNoChain="in the repository (connect wallet for network-specific list)"
        />

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
            <span>Hook</span>
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={loading || !hasValidOwner}>
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
          </Button>
        </div>
      </form>
    </div>
  )
}
