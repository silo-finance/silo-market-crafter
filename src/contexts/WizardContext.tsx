'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  name?: string
}

export interface WizardStep {
  id: number
  title: string
  completed: boolean
  details?: string
}

export interface WizardData {
  currentStep: number
  steps: WizardStep[]
  token0?: TokenInfo
  token1?: TokenInfo
  networkName?: string
  networkId?: string
}

interface WizardContextType {
  data: WizardData
  updateStep: (step: number) => void
  updateToken0: (token: TokenInfo) => void
  updateToken1: (token: TokenInfo) => void
  updateNetworkInfo: (name: string, id: string) => void
  markStepCompleted: (stepId: number, details?: string) => void
  resetWizard: () => void
}

const WizardContext = createContext<WizardContextType | undefined>(undefined)

const initialData: WizardData = {
  currentStep: 0,
  steps: [
    { id: 1, title: 'Select Assets', completed: false },
    { id: 2, title: 'Configure Market', completed: false },
    { id: 3, title: 'Deploy Contract', completed: false },
    { id: 4, title: 'Finalize', completed: false },
  ],
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WizardData>(initialData)

  const updateStep = (step: number) => {
    setData(prev => ({ ...prev, currentStep: step }))
  }

  const updateToken0 = (token: TokenInfo) => {
    setData(prev => ({ ...prev, token0: token }))
  }

  const updateToken1 = (token: TokenInfo) => {
    setData(prev => ({ ...prev, token1: token }))
  }

  const updateNetworkInfo = (name: string, id: string) => {
    setData(prev => ({ ...prev, networkName: name, networkId: id }))
  }

  const markStepCompleted = (stepId: number, details?: string) => {
    setData(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, completed: true, details } : step
      )
    }))
  }

  const resetWizard = () => {
    setData(initialData)
  }

  return (
    <WizardContext.Provider
      value={{
        data,
        updateStep,
        updateToken0,
        updateToken1,
        updateNetworkInfo,
        markStepCompleted,
        resetWizard,
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
