'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { ethers } from 'ethers'
import OwnerSelectionBlock from '@/components/OwnerSelectionBlock'
import Button from '@/components/Button'

export default function Step6OracleIrmOwner() {
  const router = useRouter()
  const { wizardData, updateManageableOracleOwnerAddress, markStepCompleted } = useWizard()

  const needsOwner = wizardData.manageableOracle || true
  const hasValidOwner = !!(wizardData.manageableOracleOwnerAddress && ethers.isAddress(wizardData.manageableOracleOwnerAddress) && wizardData.manageableOracleOwnerAddress !== ethers.ZeroAddress)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (needsOwner && !hasValidOwner) return
    markStepCompleted(6)
    router.push('/wizard?step=7')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=5')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 6: Oracle/IRM Owner
        </h1>
        <p className="text-gray-300 text-lg">
          {needsOwner
            ? 'Owner for Manageable Oracle (oracle updates) and for Kink IRM. Only this address can propose changes.'
            : 'Neither Oracle nor IRM is manageable, so an owner is not required.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {needsOwner ? (
          <div className="mb-6">
            <OwnerSelectionBlock
              value={wizardData.manageableOracleOwnerAddress}
              onChange={updateManageableOracleOwnerAddress}
              chainId={wizardData.networkInfo?.chainId}
              networkName={wizardData.networkInfo?.networkName}
            />
          </div>
        ) : (
          <div className="silo-callout-info mb-6 p-6">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-[var(--silo-accent)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="silo-text-main font-medium">Owner not required</p>
                <p className="text-gray-400 text-sm mt-1">
                  Manageable Oracle is disabled and IRM is not Kink, so no owner address is needed for this configuration.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="secondary" size="lg" onClick={goToPreviousStep}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>IRM Selection</span>
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={needsOwner && !hasValidOwner}>
            <span>Borrow Setup</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </form>
    </div>
  )
}
