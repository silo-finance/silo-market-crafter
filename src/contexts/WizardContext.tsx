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

/** When set, oracle will be created at deploy time via factory (OracleScalerFactory.createOracleScaler). */
export interface CustomScalerCreate {
  factoryAddress: string
  quoteToken: string
}

export interface ScalerOracle {
  name: string
  address: string
  scaleFactor: string
  valid: boolean
  resultDecimals?: number
  /** If set, this scaler is not deployed yet; deploy will use factory + encoded createOracleScaler(quoteToken, bytes32(0)). */
  customCreate?: CustomScalerCreate
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
  daoFee: number // 0-20%, step 0.01 - general setting
  deployerFee: number // 0-20%, step 0.01 - general setting
  token0: {
    liquidationFee: number // 0-20%, step 0.01
    flashloanFee: number // 0-20%, step 0.01
  }
  token1: {
    liquidationFee: number // 0-20%, step 0.01
    flashloanFee: number // 0-20%, step 0.01
  }
}

export type HookType = 'SiloHookV1' | 'SiloHookV2' | 'SiloHookV3'

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
  selectedHook: HookType | null
  hookOwnerAddress: string | null
  lastDeployTxHash: string | null
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
  updateSelectedHook: (hook: HookType) => void
  updateHookOwnerAddress: (address: string | null) => void
  generateJSONConfig: () => string
  parseJSONConfig: (jsonString: string) => Promise<boolean>
  setLastDeployTxHash: (txHash: string | null) => void
  resetWizard: () => void
  resetWizardWithCache: () => void
}

const WizardContext = createContext<WizardContextType | undefined>(undefined)

/** All localStorage keys used by the wizard. Reset form must clear these. */
export const WIZARD_CACHE_KEYS = [
  'silo-wizard-token0-address',
  'silo-wizard-token1-address',
  'silo-wizard-token0-metadata',
  'silo-wizard-token1-metadata',
  'silo-wizard-data'
] as const

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
  feesConfiguration: null,
  selectedHook: null,
  hookOwnerAddress: null,
  lastDeployTxHash: null
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

  const updateSelectedHook = (hook: HookType) => {
    setWizardData(prev => ({ ...prev, selectedHook: hook }))
  }

  const updateHookOwnerAddress = (address: string | null) => {
    setWizardData(prev => ({ ...prev, hookOwnerAddress: address }))
  }

  const generateJSONConfig = () => {
    const hookImplementation = wizardData.selectedHook 
      ? `${wizardData.selectedHook}.sol` 
      : 'SiloHookV1.sol'
    
    const config = {
      deployer: "",
      hookReceiver: "CLONE_IMPLEMENTATION",
      hookReceiverImplementation: hookImplementation,
      daoFee: wizardData.feesConfiguration?.daoFee ? Math.round(wizardData.feesConfiguration.daoFee * 100) : 0,
      deployerFee: wizardData.feesConfiguration?.deployerFee ? Math.round(wizardData.feesConfiguration.deployerFee * 100) : 0,
      token0: wizardData.token0?.symbol || "",
      solvencyOracle0: (() => {
        const n = wizardData.oracleConfiguration?.token0?.scalerOracle?.name || "NO_ORACLE"
        return n === "Custom Scaler" ? "PLACEHOLDER" : n
      })(),
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
      solvencyOracle1: (() => {
        const n = wizardData.oracleConfiguration?.token1?.scalerOracle?.name || "NO_ORACLE"
        return n === "Custom Scaler" ? "PLACEHOLDER" : n
      })(),
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

  const parseJSONConfig = async (jsonString: string): Promise<boolean> => {
    try {
      const config = JSON.parse(jsonString)
      
      // Parse and prepare all data first
      const token0Data: TokenData = {
        address: '', // Will be resolved from symbol
        symbol: config.token0 || '',
        decimals: 18, // Default, should be resolved from token data
        name: config.token0 || ''
      }
      
      const token1Data: TokenData = {
        address: '', // Will be resolved from symbol
        symbol: config.token1 || '',
        decimals: 18, // Default, should be resolved from token data
        name: config.token1 || ''
      }
      
      // Parse oracle configuration
      const oracleConfig: OracleConfiguration = {
        token0: {
          type: config.solvencyOracle0 === 'NO_ORACLE' ? 'none' : 'scaler',
          scalerOracle: config.solvencyOracle0 !== 'NO_ORACLE' ? {
            name: config.solvencyOracle0,
            address: '', // Will be resolved
            valid: true,
            resultDecimals: 18,
            scaleFactor: '1' // Default scale factor
          } : undefined
        },
        token1: {
          type: config.solvencyOracle1 === 'NO_ORACLE' ? 'none' : 'scaler',
          scalerOracle: config.solvencyOracle1 !== 'NO_ORACLE' ? {
            name: config.solvencyOracle1,
            address: '', // Will be resolved
            valid: true,
            resultDecimals: 18,
            scaleFactor: '1' // Default scale factor
          } : undefined
        }
      }
      
      // Parse IRM configuration
      const irm0: IRMConfig = {
        name: config.interestRateModelConfig0 || '',
        config: {} // Will be fetched from the IRM configs
      }
      
      const irm1: IRMConfig = {
        name: config.interestRateModelConfig1 || '',
        config: {} // Will be fetched from the IRM configs
      }
      
      // Parse borrow configuration
      const borrowConfig: BorrowConfiguration = {
        token0: {
          nonBorrowable: config.maxLtv0 === 0 && config.lt0 === 0,
          liquidationThreshold: config.lt0 ? config.lt0 / 100 : 0,
          maxLTV: config.maxLtv0 ? config.maxLtv0 / 100 : 0,
          liquidationTargetLTV: config.liquidationTargetLtv0 ? config.liquidationTargetLtv0 / 100 : 0
        },
        token1: {
          nonBorrowable: config.maxLtv1 === 0 && config.lt1 === 0,
          liquidationThreshold: config.lt1 ? config.lt1 / 100 : 0,
          maxLTV: config.maxLtv1 ? config.maxLtv1 / 100 : 0,
          liquidationTargetLTV: config.liquidationTargetLtv1 ? config.liquidationTargetLtv1 / 100 : 0
        }
      }
      
      // Parse fees configuration
      const feesConfig: FeesConfiguration = {
        daoFee: config.daoFee ? config.daoFee / 100 : 0,
        deployerFee: config.deployerFee ? config.deployerFee / 100 : 0,
        token0: {
          liquidationFee: config.liquidationFee0 ? config.liquidationFee0 / 100 : 0,
          flashloanFee: config.flashloanFee0 ? config.flashloanFee0 / 100 : 0
        },
        token1: {
          liquidationFee: config.liquidationFee1 ? config.liquidationFee1 / 100 : 0,
          flashloanFee: config.flashloanFee1 ? config.flashloanFee1 / 100 : 0
        }
      }
      
      // Parse hook configuration
      const hookImplementation = config.hookReceiverImplementation || 'SiloHookV1.sol'
      // Extract hook type from "SiloHookV1.sol" format
      const hookMatch = hookImplementation.match(/^(SiloHookV[123])\.sol$/)
      const selectedHook: HookType = hookMatch ? (hookMatch[1] as HookType) : 'SiloHookV1'
      
      // Set all data in a single update to avoid race conditions
      const newWizardData = {
        ...initialWizardData,
        token0: token0Data,
        token1: token1Data,
        oracleConfiguration: oracleConfig,
        selectedIRM0: irm0,
        selectedIRM1: irm1,
        borrowConfiguration: borrowConfig,
        feesConfiguration: feesConfig,
        selectedHook: selectedHook
      }
      
      setWizardData(newWizardData)
      
      return true
    } catch (error) {
      console.error('Error parsing JSON config:', error)
      return false
    }
  }

  const setLastDeployTxHash = (txHash: string | null) => {
    setWizardData(prev => ({ ...prev, lastDeployTxHash: txHash }))
  }

  const resetWizard = () => {
    setWizardData(initialWizardData)
  }

  const resetWizardWithCache = () => {
    if (typeof window !== 'undefined') {
      WIZARD_CACHE_KEYS.forEach(key => localStorage.removeItem(key))
    }
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
        updateSelectedHook,
        updateHookOwnerAddress,
        generateJSONConfig,
        parseJSONConfig,
        setLastDeployTxHash,
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
