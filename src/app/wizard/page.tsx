'use client'

import React, { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import LandingPage from '@/components/LandingPage'
import Step1Assets from '@/components/Step1Assets'
import Step4ManageableOracle from '@/components/Step4ManageableOracle'
import Step5IRMSelection from '@/components/Step4IRMSelection'
import Step6BorrowSetup from '@/components/Step5BorrowSetup'
import Step7Fees from '@/components/Step6Fees'
import Step8Hook from '@/components/Step7Hook'
import Step9HookOwner from '@/components/Step8HookOwner'
import Step10JSONConfig from '@/components/Step8JSONConfig'
import Step11Deployment from '@/components/Step10Deployment'
import Step12Verification from '@/components/Step11Verification'
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
    if (currentStep >= 0 && currentStep <= 12 && currentStep !== wizardData.currentStep) {
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
        return <Step4ManageableOracle />
      case 5:
        return <Step5IRMSelection />
      case 6:
        return <Step6BorrowSetup />
      case 7:
        return <Step7Fees />
      case 8:
        return <Step8Hook />
      case 9:
        return <Step9HookOwner />
      case 10:
        return <Step10JSONConfig />
      case 11:
        return <Step11Deployment />
      case 12:
        return <Step12Verification />
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
    <Suspense fallback={<div className="min-h-screen text-emerald-900 flex items-center justify-center">
      <div className="text-emerald-900">Loading...</div>
    </div>}>
      <WizardPageContent />
    </Suspense>
  )
}
