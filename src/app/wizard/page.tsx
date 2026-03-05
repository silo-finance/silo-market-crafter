'use client'

import React, { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import WizardLayout from '@/components/WizardLayout'
import LandingPage from '@/components/LandingPage'
import Step1Assets from '@/components/Step1Assets'
import Step4ManageableOracle from '@/components/Step4ManageableOracle'
import Step5IRMSelection from '@/components/Step4IRMSelection'
import Step6OracleIrmOwner from '@/components/Step6OracleIrmOwner'
import Step7BorrowSetup from '@/components/Step5BorrowSetup'
import Step8Fees from '@/components/Step6Fees'
import Step9Hook from '@/components/Step7Hook'
import Step10HookOwner from '@/components/Step8HookOwner'
import Step11JSONConfig from '@/components/Step8JSONConfig'
import Step12Deployment from '@/components/Step10Deployment'
import Step13Verification from '@/components/Step11Verification'
import Step2OracleTypes from '@/components/Step2OracleTypes'
import Step3OracleConfiguration from '@/components/Step3OracleConfiguration'

function WizardPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { wizardData, updateStep } = useWizard()

  // Get current step from URL (step=verification is the verification step; we never use step=13 in URL).
  const urlStep = searchParams.get('step')
  const currentStep = urlStep === 'verification' ? 13 : (urlStep ? parseInt(urlStep, 10) : 0)

  // Redirect step=13 to step=verification so URL never shows step 13
  useEffect(() => {
    if (urlStep === '13') {
      const params = new URLSearchParams(searchParams.toString())
      params.set('step', 'verification')
      router.replace(`/wizard?${params.toString()}`, { scroll: false })
    }
  }, [urlStep, searchParams, router])

  // On step 0 (landing), strip tx= and address= so nothing re-triggers verification after Reset
  useEffect(() => {
    if (currentStep === 0 && (searchParams.get('tx') || searchParams.get('address') || searchParams.get('contract'))) {
      router.replace('/wizard?step=0', { scroll: false })
    }
  }, [currentStep, searchParams, router])

  // Update wizard state when URL changes
  useEffect(() => {
    if (currentStep >= 0 && currentStep <= 13 && !Number.isNaN(currentStep) && currentStep !== wizardData.currentStep) {
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
        return <Step6OracleIrmOwner />
      case 7:
        return <Step7BorrowSetup />
      case 8:
        return <Step8Fees />
      case 9:
        return <Step9Hook />
      case 10:
        return <Step10HookOwner />
      case 11:
        return <Step11JSONConfig />
      case 12:
        return <Step12Deployment />
      case 13:
        return <Step13Verification />
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
