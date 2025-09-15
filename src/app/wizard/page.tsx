'use client'

import React, { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import LandingPage from '@/components/LandingPage'
import Step1Assets from '@/components/Step1Assets'
import Step4IRMSelection from '@/components/Step4IRMSelection'
import Step5BorrowSetup from '@/components/Step5BorrowSetup'
import Step6Fees from '@/components/Step6Fees'
import Step7JSONConfig from '@/components/Step7JSONConfig'
import Step2OracleTypes from '@/components/Step2OracleTypes'
import Step3OracleConfiguration from '@/components/Step3OracleConfiguration'

function WizardPageContent() {
  const searchParams = useSearchParams()
  const { wizardData, updateStep } = useWizard()

  // Get current step from URL or default to 0
  const urlStep = searchParams.get('step')
  const currentStep = urlStep ? parseInt(urlStep, 10) : 0
  
  // Update wizard state when URL changes
  useEffect(() => {
    if (currentStep >= 0 && currentStep <= 7 && currentStep !== wizardData.currentStep) {
      console.log('URL changed - updating step from', wizardData.currentStep, 'to', currentStep)
      updateStep(currentStep)
    }
  }, [currentStep, wizardData.currentStep, updateStep])




  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <LandingPage />
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
        return <Step6Fees />
      case 7:
        return <Step7JSONConfig />
      default:
        return <LandingPage />
    }
  }

  return (
    <WizardLayout>
      {renderCurrentStep()}
    </WizardLayout>
  )
}

export default function WizardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>}>
      <WizardPageContent />
    </Suspense>
  )
}
