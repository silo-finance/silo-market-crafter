'use client'

import React, { useState } from 'react'
import Button from '@/components/Button'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { NETWORK_CONFIGS } from '@/utils/networks'

export default function LandingPage() {
  const router = useRouter()
  const { resetWizardWithCache } = useWizard()
  const [cacheMessage, setCacheMessage] = useState('')

  const handleStartWizard = () => {
    router.push('/wizard?step=1')
  }

  const handleClearCache = () => {
    resetWizardWithCache()
    setCacheMessage('Cache cleared. You can retry Verify Market now.')
  }

  return (
    <div className="silo-page flex items-center justify-center px-4 py-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold silo-text-main mb-4">
            Silo Market Crafter
          </h1>
          <p className="text-xl silo-text-soft">
            Create Silo market configurations
          </p>
        </div>

        {/* Main Options */}
        <div className="max-w-2xl mx-auto">
          {/* Start New Wizard */}
          <div className="silo-panel silo-top-card p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--silo-accent-soft)] text-[var(--silo-accent)]">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold silo-text-main mb-4">
                Start New Market
              </h2>
              <p className="silo-text-soft mb-6">
                Create a new Silo market in few easy steps.
              </p>
              <Button
                fullWidth
                variant="primaryDark"
                size="md"
                onClick={handleStartWizard}
              >
                Create New Market
              </Button>
              <div className="mt-8 pt-6 border-t border-[var(--silo-border)] text-left">
                <p className="text-sm font-medium silo-text-main mb-3">
                  Supported blockchains:
                </p>
                <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm silo-text-soft">
                  {NETWORK_CONFIGS.map((network) => (
                    <li key={network.chainId}>
                      {network.displayName} ({network.chainId})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12 silo-text-soft text-sm space-y-4">
          <p>
            Make sure your wallet is connected to determine the correct blockchain for token resolution.
          </p>
          <div className="max-w-2xl mx-auto silo-panel-soft p-4">
            <p className="silo-text-main mb-3">
              If you see UI/runtime errors while opening pages (for example Verify Market), clear local cache and retry.
            </p>
            <Button variant="orange" size="sm" onClick={handleClearCache}>
              Clear Cache
            </Button>
            {cacheMessage && <p className="mt-2 silo-text-main">{cacheMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
