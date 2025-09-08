'use client'

import React, { useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import Step1Assets from '@/components/Step1Assets'

export default function WizardPage() {
  const { wizardData, updateStep } = useWizard()

  // Auto-start wizard if currentStep is 0
  useEffect(() => {
    if (wizardData.currentStep === 0) {
      updateStep(1)
    }
  }, [wizardData.currentStep, updateStep])

  const renderCurrentStep = () => {
    switch (wizardData.currentStep) {
      case 1:
        return <Step1Assets />
      case 2:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Step 2: Silo Configuration
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              Configure the first silo for your market
            </p>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
              <p className="text-gray-400">Step 2 implementation coming soon...</p>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Step 3: Second Silo
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              Configure the second silo for your market
            </p>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
              <p className="text-gray-400">Step 3 implementation coming soon...</p>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Step 4: Deploy Market
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              Deploy your complete market
            </p>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
              <p className="text-gray-400">Step 4 implementation coming soon...</p>
            </div>
          </div>
        )
      default:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Market Creation Wizard
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              Create a new Silo market step by step
            </p>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
              <p className="text-gray-400 mb-6">Ready to start the wizard?</p>
              <button
                onClick={() => updateStep(1)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Start Wizard
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <WizardLayout>
      {renderCurrentStep()}
    </WizardLayout>
  )
}
