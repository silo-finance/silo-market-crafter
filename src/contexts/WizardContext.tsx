'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

export interface OracleType {
  type: 'none' | 'scaler'
  enabled: boolean
  reason?: string
}

export interface ScalerOracle {
  name: string
  address: string
  scaleFactor: string
  valid: boolean
  resultDecimals?: number
}

export interface OracleConfiguration {
  token0: {
    type: 'none' | 'scaler'
    scalerOracle?: ScalerOracle
  }
  token1: {
    type: 'none' | 'scaler'
    scalerOracle?: ScalerOracle
  }
}

export interface IRMConfig {
  name: string
  config: {
    [key: string]: string | number | boolean
  }
}

export interface BorrowConfiguration {
  token0: {
    nonBorrowable: boolean
    liquidationThreshold: number // 0-100%
    maxLTV: number // 0-100%, must be <= liquidationThreshold
    liquidationTargetLTV: number // 0-100%, must be < liquidationThreshold
  }
  token1: {
    nonBorrowable: boolean
    liquidationThreshold: number // 0-100%
    maxLTV: number // 0-100%, must be <= liquidationThreshold
    liquidationTargetLTV: number // 0-100%, must be < liquidationThreshold
  }
}

export interface FeesConfiguration {
  token0: {
    daoFee: number // 0-20%, step 0.01
    deployerFee: number // 0-20%, step 0.01
    liquidationFee: number // 0-20%, step 0.01
    flashloanFee: number // 0-20%, step 0.01
  }
  token1: {
    daoFee: number // 0-20%, step 0.01
    deployerFee: number // 0-20%, step 0.01
    liquidationFee: number // 0-20%, step 0.01
    flashloanFee: number // 0-20%, step 0.01
  }
}

export interface WizardData {
  currentStep: number
  completedSteps: number[]
  token0: TokenData | null
  token1: TokenData | null
  networkInfo: NetworkInfo | null
  oracleType0: OracleType | null
  oracleType1: OracleType | null
  oracleConfiguration: OracleConfiguration | null
  selectedIRM0: IRMConfig | null
  selectedIRM1: IRMConfig | null
  borrowConfiguration: BorrowConfiguration | null
  feesConfiguration: FeesConfiguration | null
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
  updateOracleType0: (oracleType: OracleType) => void
  updateOracleType1: (oracleType: OracleType) => void
  updateOracleConfiguration: (config: OracleConfiguration) => void
  updateSelectedIRM0: (irm: IRMConfig) => void
  updateSelectedIRM1: (irm: IRMConfig) => void
  updateBorrowConfiguration: (config: BorrowConfiguration) => void
  updateFeesConfiguration: (config: FeesConfiguration) => void
  generateJSONConfig: () => string
  resetWizard: () => void
  resetWizardWithCache: () => void
}

const WizardContext = createContext<WizardContextType | undefined>(undefined)

const initialWizardData: WizardData = {
  currentStep: 0,
  completedSteps: [],
  token0: null,
  token1: null,
  networkInfo: null,
  oracleType0: null,
  oracleType1: null,
  oracleConfiguration: null,
  selectedIRM0: null,
  selectedIRM1: null,
  borrowConfiguration: null,
  feesConfiguration: null
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [wizardData, setWizardData] = useState<WizardData>(initialWizardData)
  const [isClient, setIsClient] = useState(false)

  // Load saved data after component mounts (client-side only)
  useEffect(() => {
    setIsClient(true)
    
    // Load from localStorage if available
    const saved = localStorage.getItem('silo-wizard-data')
    if (saved) {
      try {
        const parsedData = JSON.parse(saved)
        setWizardData(parsedData)
      } catch (err) {
        console.warn('Failed to parse saved wizard data:', err)
      }
    }
  }, [])

  // Save wizard data to localStorage whenever it changes (client-side only)
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('silo-wizard-data', JSON.stringify(wizardData))
    }
  }, [wizardData, isClient])

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

  const updateOracleType0 = (oracleType: OracleType) => {
    setWizardData(prev => ({ ...prev, oracleType0: oracleType }))
  }

  const updateOracleType1 = (oracleType: OracleType) => {
    setWizardData(prev => ({ ...prev, oracleType1: oracleType }))
  }

  const updateOracleConfiguration = (config: OracleConfiguration) => {
    setWizardData(prev => ({ ...prev, oracleConfiguration: config }))
  }

  const updateSelectedIRM0 = (irm: IRMConfig) => {
    setWizardData(prev => ({ ...prev, selectedIRM0: irm }))
  }

  const updateSelectedIRM1 = (irm: IRMConfig) => {
    setWizardData(prev => ({ ...prev, selectedIRM1: irm }))
  }

  const updateBorrowConfiguration = (config: BorrowConfiguration) => {
    setWizardData(prev => ({ ...prev, borrowConfiguration: config }))
  }

  const updateFeesConfiguration = (config: FeesConfiguration) => {
    setWizardData(prev => ({ ...prev, feesConfiguration: config }))
  }

  const generateJSONConfig = () => {
    const config = {
      deployer: "",
      hookReceiver: "CLONE_IMPLEMENTATION",
      hookReceiverImplementation: "SiloHookV1.sol",
      daoFee: wizardData.feesConfiguration?.token0.daoFee ? Math.round(wizardData.feesConfiguration.token0.daoFee * 100) : 0,
      deployerFee: wizardData.feesConfiguration?.token0.deployerFee ? Math.round(wizardData.feesConfiguration.token0.deployerFee * 100) : 0,
      token0: wizardData.token0?.symbol || "",
      solvencyOracle0: wizardData.oracleConfiguration?.token0?.scalerOracle?.name || "NO_ORACLE",
      maxLtvOracle0: "NO_ORACLE",
      interestRateModel0: "InterestRateModelV2Factory.sol",
      interestRateModelConfig0: wizardData.selectedIRM0?.name || "",
      maxLtv0: wizardData.borrowConfiguration?.token0.maxLTV ? Math.round(wizardData.borrowConfiguration.token0.maxLTV * 100) : 0,
      lt0: wizardData.borrowConfiguration?.token0.liquidationThreshold ? Math.round(wizardData.borrowConfiguration.token0.liquidationThreshold * 100) : 0,
      liquidationTargetLtv0: wizardData.borrowConfiguration?.token0.liquidationTargetLTV ? Math.round(wizardData.borrowConfiguration.token0.liquidationTargetLTV * 100) : 0,
      liquidationFee0: wizardData.feesConfiguration?.token0.liquidationFee ? Math.round(wizardData.feesConfiguration.token0.liquidationFee * 100) : 0,
      flashloanFee0: wizardData.feesConfiguration?.token0.flashloanFee ? Math.round(wizardData.feesConfiguration.token0.flashloanFee * 100) : 0,
      callBeforeQuote0: false,
      token1: wizardData.token1?.symbol || "",
      solvencyOracle1: wizardData.oracleConfiguration?.token1?.scalerOracle?.name || "NO_ORACLE",
      maxLtvOracle1: "NO_ORACLE",
      interestRateModel1: "InterestRateModelV2Factory.sol",
      interestRateModelConfig1: wizardData.selectedIRM1?.name || "",
      maxLtv1: wizardData.borrowConfiguration?.token1.maxLTV ? Math.round(wizardData.borrowConfiguration.token1.maxLTV * 100) : 0,
      lt1: wizardData.borrowConfiguration?.token1.liquidationThreshold ? Math.round(wizardData.borrowConfiguration.token1.liquidationThreshold * 100) : 0,
      liquidationTargetLtv1: wizardData.borrowConfiguration?.token1.liquidationTargetLTV ? Math.round(wizardData.borrowConfiguration.token1.liquidationTargetLTV * 100) : 0,
      liquidationFee1: wizardData.feesConfiguration?.token1.liquidationFee ? Math.round(wizardData.feesConfiguration.token1.liquidationFee * 100) : 0,
      flashloanFee1: wizardData.feesConfiguration?.token1.flashloanFee ? Math.round(wizardData.feesConfiguration.token1.flashloanFee * 100) : 0,
      callBeforeQuote1: false
    }
    return JSON.stringify(config, null, 4)
  }

  const resetWizard = () => {
    setWizardData(initialWizardData)
  }

  const resetWizardWithCache = () => {
    // Clear all localStorage cache
    if (typeof window !== 'undefined') {
      const cacheKeys = [
        'silo-wizard-token0-address',
        'silo-wizard-token1-address', 
        'silo-wizard-token0-metadata',
        'silo-wizard-token1-metadata',
        'silo-wizard-data'
      ]
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key)
      })
    }
    
    // Reset wizard data
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
        updateOracleType0,
        updateOracleType1,
        updateOracleConfiguration,
        updateSelectedIRM0,
        updateSelectedIRM1,
        updateBorrowConfiguration,
        updateFeesConfiguration,
        generateJSONConfig,
        resetWizard,
        resetWizardWithCache
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
