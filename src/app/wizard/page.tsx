'use client'

import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import Step1Assets from '@/components/Step1Assets'
import { useEffect } from 'react'

export default function WizardPage() {
  const { data, updateStep } = useWizard()

  // Automatically start at step 1 when wizard page loads
  useEffect(() => {
    if (data.currentStep === 0) {
      updateStep(1)
    }
  }, [data.currentStep, updateStep])

  const renderCurrentStep = () => {
    switch (data.currentStep) {
      case 1:
        return <Step1Assets />
      case 2:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Configure Market
            </h1>
            <p className="text-gray-300 text-lg">
              Step 2 - Coming Soon
            </p>
          </div>
        )
      case 3:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Deploy Contract
            </h1>
            <p className="text-gray-300 text-lg">
              Step 3 - Coming Soon
            </p>
          </div>
        )
      case 4:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Finalize
            </h1>
            <p className="text-gray-300 text-lg">
              Step 4 - Coming Soon
            </p>
          </div>
        )
      default:
        return (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to Market Creation
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              This wizard will guide you through creating a new market.
            </p>
            <button
              onClick={() => updateStep(1)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
            >
              Start Wizard
            </button>
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
