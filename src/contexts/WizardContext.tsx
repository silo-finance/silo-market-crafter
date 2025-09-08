'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface TokenData {
  address: string
  symbol: string
  decimals: number
  name: string
}

export interface NetworkInfo {
  chainId: string
  networkName: string
}

export interface WizardData {
  currentStep: number
  completedSteps: number[]
  token0: TokenData | null
  token1: TokenData | null
  networkInfo: NetworkInfo | null
}

export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

interface WizardContextType {
  wizardData: WizardData
  updateStep: (step: number) => void
  markStepCompleted: (step: number) => void
  updateToken0: (token: TokenData) => void
  updateToken1: (token: TokenData) => void
  updateNetworkInfo: (networkInfo: NetworkInfo) => void
  resetWizard: () => void
}

const WizardContext = createContext<WizardContextType | undefined>(undefined)

const initialWizardData: WizardData = {
  currentStep: 0,
  completedSteps: [],
  token0: null,
  token1: null,
  networkInfo: null
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [wizardData, setWizardData] = useState<WizardData>(initialWizardData)

  const updateStep = (step: number) => {
    setWizardData(prev => ({ ...prev, currentStep: step }))
  }

  const markStepCompleted = (step: number) => {
    setWizardData(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps.filter(s => s !== step), step]
    }))
  }

  const updateToken0 = (token: TokenData) => {
    setWizardData(prev => ({ ...prev, token0: token }))
  }

  const updateToken1 = (token: TokenData) => {
    setWizardData(prev => ({ ...prev, token1: token }))
  }

  const updateNetworkInfo = (networkInfo: NetworkInfo) => {
    setWizardData(prev => ({ ...prev, networkInfo }))
  }

  const resetWizard = () => {
    setWizardData(initialWizardData)
  }

  return (
    <WizardContext.Provider
      value={{
        wizardData,
        updateStep,
        markStepCompleted,
        updateToken0,
        updateToken1,
        updateNetworkInfo,
        resetWizard
      }}
    >
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const context = useContext(WizardContext)
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}
