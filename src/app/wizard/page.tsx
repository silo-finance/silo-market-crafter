'use client'

import React, { useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import Step1Assets from '@/components/Step1Assets'
import Step4IRMSelection from '@/components/Step4IRMSelection'
import Step5BorrowSetup from '@/components/Step5BorrowSetup'
import Step6Fees from '@/components/Step6Fees'
import Step7JSONConfig from '@/components/Step7JSONConfig'
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
        return <Step6Fees />
      case 7:
        return <Step7JSONConfig />
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
