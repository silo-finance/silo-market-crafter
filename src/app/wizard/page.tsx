'use client'

import React, { useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import Step1Assets from '@/components/Step1Assets'
import Step4IRMSelection from '@/components/Step4IRMSelection'
import Step5BorrowSetup from '@/components/Step5BorrowSetup'
import Step2OracleTypes from '@/components/Step2OracleTypes'
import Step3OracleConfiguration from '@/components/Step3OracleConfiguration'

export default function WizardPage() {
  const { wizardData, updateStep } = useWizard()

  // Auto-start wizard if currentStep is 0
  useEffect(() => {
    if (wizardData.currentStep === 0) {
      updateStep(1)
    }
  }, [wizardData.currentStep, updateStep])

  const goToPreviousStep = () => {
    if (wizardData.currentStep > 1) {
      updateStep(wizardData.currentStep - 1)
    }
  }


  const renderCurrentStep = () => {
    switch (wizardData.currentStep) {
      case 1:
        return <Step1Assets />
      case 2:
        return <Step2OracleTypes />
      case 3:
        return <Step3OracleConfiguration />
      case 4:
        return <Step4IRMSelection />
      case 5:
        return <Step5BorrowSetup />
      case 6:
        return (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">
                Step 6: Deploy Market
              </h1>
              <p className="text-gray-300 text-lg">
                Deploy your complete market
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 mb-6">
              <p className="text-gray-400">Step 6 implementation coming soon...</p>
            </div>
            <div className="flex justify-between">
              <button
                onClick={goToPreviousStep}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Borrow Setup</span>
              </button>
              <button
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                disabled
              >
                <span>Deploy Market</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
          </div>
        )
      default:
        return <Step1Assets />
    }
  }

  return (
    <WizardLayout>
      {renderCurrentStep()}
    </WizardLayout>
  )
}
