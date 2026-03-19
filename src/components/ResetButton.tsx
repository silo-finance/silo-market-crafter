'use client'

import React, { useState } from 'react'
import Button from '@/components/Button'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'

export default function ResetButton() {
  const router = useRouter()
  const { resetWizardWithCache } = useWizard()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleResetClick = () => {
    setShowConfirmDialog(true)
  }

  const handleConfirmReset = () => {
    resetWizardWithCache()
    setShowConfirmDialog(false)
    // Replace URL with only step=0 so tx= and address= are removed and nothing re-triggers verification
    router.replace('/wizard?step=0', { scroll: false })
  }

  const handleCancelReset = () => {
    setShowConfirmDialog(false)
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleResetClick}
        title="Reset form and clear all data"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reset Form
      </Button>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Reset Form</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-3">
                Are you sure you want to reset the form? This will:
              </p>
              <ul className="text-sm text-gray-400 space-y-1 ml-4">
                <li>• Clear all data from every step (tokens, network, oracles, IRM, borrow, fees, hook, JSON config, deploy tx)</li>
                <li>• Remove all cached data from this browser</li>
                <li>• Return to the start (Step 0)</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <Button fullWidth variant="secondary" size="sm" onClick={handleCancelReset}>
                Cancel
              </Button>
              <Button fullWidth variant="destructive" size="sm" onClick={handleConfirmReset}>
                Reset Form
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
