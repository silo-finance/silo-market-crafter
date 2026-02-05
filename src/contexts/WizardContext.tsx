'use client'

import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

/** Map chainId (decimal string) to display name; used when syncing from wallet (e.g. chainChanged). */
function getNetworkNameForChainId(chainIdDecimal: string): string {
  const id = parseInt(chainIdDecimal, 10)
  const map: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia',
    137: 'Polygon',
    42161: 'Arbitrum One',
    421614: 'Arbitrum Sepolia',
    43114: 'Avalanche C-Chain',
    8453: 'Base',
    146: 'Sonic',
    653: 'Sonic Testnet',
    10: 'Optimism',
    100: 'Gnosis',
    56: 'BNB Smart Chain',
    250: 'Fantom Opera',
    25: 'Cronos',
    1284: 'Moonbeam',
  }
  return map[id] ?? `Network ${chainIdDecimal}`
}

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
  type: 'none' | 'scaler' | 'chainlink'
  enabled: boolean
  reason?: string
}

/** Chainlink V3 oracle deployment config (one of normalizationDivider or normalizationMultiplier is non-zero). */
export interface ChainlinkOracleConfig {
  baseToken: 'token0' | 'token1'
  primaryAggregator: string
  secondaryAggregator: string
  normalizationDivider: string
  normalizationMultiplier: string
  invertSecondPrice: boolean
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
    type: 'none' | 'scaler' | 'chainlink'
    scalerOracle?: ScalerOracle
    chainlinkOracle?: ChainlinkOracleConfig
  }
  token1: {
    type: 'none' | 'scaler' | 'chainlink'
    scalerOracle?: ScalerOracle
    chainlinkOracle?: ChainlinkOracleConfig
  }
}

export type IRMModelType = 'kink' | 'irm'

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
  /** Which IRM model is active: Kink (default) or legacy IRM (InterestRateModelV2). */
  irmModelType: IRMModelType
  selectedIRM0: IRMConfig | null
  selectedIRM1: IRMConfig | null
  borrowConfiguration: BorrowConfiguration | null
  feesConfiguration: FeesConfiguration | null
  selectedHook: HookType | null
  hookOwnerAddress: string | null
  lastDeployTxHash: string | null
  /** Hash of deploy calldata for the last successful deploy; used to allow re-deploy when config changes. */
  lastDeployArgsHash: string | null
  /** On step 11: true when verifying the wizard deployment (show summary sidebar), false when standalone verification (hide sidebar). */
  verificationFromWizard: boolean
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
  clearNetworkInfo: () => void
  updateOracleType0: (oracleType: OracleType) => void
  updateOracleType1: (oracleType: OracleType) => void
  updateOracleConfiguration: (config: OracleConfiguration) => void
  updateIRMModelType: (type: IRMModelType) => void
  updateSelectedIRM0: (irm: IRMConfig) => void
  updateSelectedIRM1: (irm: IRMConfig) => void
  updateBorrowConfiguration: (config: BorrowConfiguration) => void
  updateFeesConfiguration: (config: FeesConfiguration) => void
  updateSelectedHook: (hook: HookType) => void
  updateHookOwnerAddress: (address: string | null) => void
  generateJSONConfig: () => string
  parseJSONConfig: (jsonString: string) => Promise<boolean>
  setLastDeployTxHash: (txHash: string | null, argsHash?: string | null) => void
  setVerificationFromWizard: (value: boolean) => void
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
  irmModelType: 'kink',
  selectedIRM0: null,
  selectedIRM1: null,
  borrowConfiguration: null,
  feesConfiguration: null,
  selectedHook: null,
  hookOwnerAddress: null,
  lastDeployTxHash: null,
  lastDeployArgsHash: null,
  verificationFromWizard: false
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [wizardData, setWizardData] = useState<WizardData>(initialWizardData)
  const [isClient, setIsClient] = useState(false)

  // Load saved data after component mounts (client-side only).
  // Never restore networkInfo from cache – it must always come from the connected wallet.
  useEffect(() => {
    setIsClient(true)
    const saved = localStorage.getItem('silo-wizard-data')
    if (saved) {
      try {
        const parsedData = JSON.parse(saved) as WizardData
        setWizardData({ ...parsedData, networkInfo: null, verificationFromWizard: false })
      } catch (err) {
        console.warn('Failed to parse saved wizard data:', err)
      }
    }
  }, [])

  // Save wizard data to localStorage whenever it changes (client-side only).
  // Do not persist networkInfo or verificationFromWizard (UI-only for step 11).
  useEffect(() => {
    if (isClient) {
      const { verificationFromWizard: _, ...rest } = wizardData
      const toSave = { ...rest, networkInfo: null }
      localStorage.setItem('silo-wizard-data', JSON.stringify(toSave))
    }
  }, [wizardData, isClient])

  // Sync network from MetaMask when user switches chain (e.g. Sonic → Arbitrum)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const applyNetwork = (chainIdHex: string) => {
      const networkId = parseInt(chainIdHex, 16).toString()
      const networkName = getNetworkNameForChainId(networkId)
      setWizardData(prev => ({ ...prev, networkInfo: { chainId: networkId, networkName } }))
    }

    const handleChainChanged = (...args: unknown[]) => {
      const chainId = args[0] as string
      applyNetwork(chainId)
    }

    window.ethereum.request({ method: 'eth_chainId' }).then((chainId: unknown) => {
      applyNetwork(chainId as string)
    }).catch(() => {})

    window.ethereum.on('chainChanged', handleChainChanged)
    return () => {
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [])

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

  const clearNetworkInfo = () => {
    setWizardData(prev => ({ ...prev, networkInfo: null }))
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

  const updateIRMModelType = (type: IRMModelType) => {
    setWizardData(prev => ({ ...prev, irmModelType: type }))
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
        const t = wizardData.oracleConfiguration?.token0?.type
        if (t === 'chainlink') return 'Chainlink'
        const n = wizardData.oracleConfiguration?.token0?.scalerOracle?.name || "NO_ORACLE"
        return n === "Custom Scaler" ? "PLACEHOLDER" : n
      })(),
      maxLtvOracle0: "NO_ORACLE",
      interestRateModel0: wizardData.irmModelType === 'kink' ? 'DynamicKinkModelFactory.sol' : 'InterestRateModelV2Factory.sol',
      interestRateModelConfig0: wizardData.selectedIRM0?.name || "",
      maxLtv0: wizardData.borrowConfiguration?.token0.maxLTV ? Math.round(wizardData.borrowConfiguration.token0.maxLTV * 100) : 0,
      lt0: wizardData.borrowConfiguration?.token0.liquidationThreshold ? Math.round(wizardData.borrowConfiguration.token0.liquidationThreshold * 100) : 0,
      liquidationTargetLtv0: wizardData.borrowConfiguration?.token0.liquidationTargetLTV ? Math.round(wizardData.borrowConfiguration.token0.liquidationTargetLTV * 100) : 0,
      liquidationFee0: wizardData.feesConfiguration?.token0.liquidationFee ? Math.round(wizardData.feesConfiguration.token0.liquidationFee * 100) : 0,
      flashloanFee0: wizardData.feesConfiguration?.token0.flashloanFee ? Math.round(wizardData.feesConfiguration.token0.flashloanFee * 100) : 0,
      callBeforeQuote0: false,
      ...(wizardData.oracleConfiguration?.token0?.type === 'chainlink' && wizardData.oracleConfiguration?.token0?.chainlinkOracle
        ? {
            chainlinkOracle0: {
              baseToken: wizardData.oracleConfiguration.token0.chainlinkOracle.baseToken,
              primaryAggregator: wizardData.oracleConfiguration.token0.chainlinkOracle.primaryAggregator,
              secondaryAggregator: wizardData.oracleConfiguration.token0.chainlinkOracle.secondaryAggregator || '',
              normalizationDivider: wizardData.oracleConfiguration.token0.chainlinkOracle.normalizationDivider,
              normalizationMultiplier: wizardData.oracleConfiguration.token0.chainlinkOracle.normalizationMultiplier,
              invertSecondPrice: wizardData.oracleConfiguration.token0.chainlinkOracle.invertSecondPrice
            }
          }
        : {}),
      token1: wizardData.token1?.symbol || "",
      solvencyOracle1: (() => {
        const t = wizardData.oracleConfiguration?.token1?.type
        if (t === 'chainlink') return 'Chainlink'
        const n = wizardData.oracleConfiguration?.token1?.scalerOracle?.name || "NO_ORACLE"
        return n === "Custom Scaler" ? "PLACEHOLDER" : n
      })(),
      maxLtvOracle1: "NO_ORACLE",
      interestRateModel1: wizardData.irmModelType === 'kink' ? 'DynamicKinkModelFactory.sol' : 'InterestRateModelV2Factory.sol',
      interestRateModelConfig1: wizardData.selectedIRM1?.name || "",
      maxLtv1: wizardData.borrowConfiguration?.token1.maxLTV ? Math.round(wizardData.borrowConfiguration.token1.maxLTV * 100) : 0,
      lt1: wizardData.borrowConfiguration?.token1.liquidationThreshold ? Math.round(wizardData.borrowConfiguration.token1.liquidationThreshold * 100) : 0,
      liquidationTargetLtv1: wizardData.borrowConfiguration?.token1.liquidationTargetLTV ? Math.round(wizardData.borrowConfiguration.token1.liquidationTargetLTV * 100) : 0,
      liquidationFee1: wizardData.feesConfiguration?.token1.liquidationFee ? Math.round(wizardData.feesConfiguration.token1.liquidationFee * 100) : 0,
      flashloanFee1: wizardData.feesConfiguration?.token1.flashloanFee ? Math.round(wizardData.feesConfiguration.token1.flashloanFee * 100) : 0,
      callBeforeQuote1: false,
      ...(wizardData.oracleConfiguration?.token1?.type === 'chainlink' && wizardData.oracleConfiguration?.token1?.chainlinkOracle
        ? {
            chainlinkOracle1: {
              baseToken: wizardData.oracleConfiguration.token1.chainlinkOracle.baseToken,
              primaryAggregator: wizardData.oracleConfiguration.token1.chainlinkOracle.primaryAggregator,
              secondaryAggregator: wizardData.oracleConfiguration.token1.chainlinkOracle.secondaryAggregator || '',
              normalizationDivider: wizardData.oracleConfiguration.token1.chainlinkOracle.normalizationDivider,
              normalizationMultiplier: wizardData.oracleConfiguration.token1.chainlinkOracle.normalizationMultiplier,
              invertSecondPrice: wizardData.oracleConfiguration.token1.chainlinkOracle.invertSecondPrice
            }
          }
        : {})
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
      const oracleType0 = config.solvencyOracle0 === 'NO_ORACLE' ? 'none' : config.solvencyOracle0 === 'Chainlink' ? 'chainlink' : 'scaler'
      const oracleType1 = config.solvencyOracle1 === 'NO_ORACLE' ? 'none' : config.solvencyOracle1 === 'Chainlink' ? 'chainlink' : 'scaler'
      const chainlink0 = config.chainlinkOracle0 && oracleType0 === 'chainlink'
        ? {
            baseToken: (config.chainlinkOracle0.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
            primaryAggregator: String(config.chainlinkOracle0.primaryAggregator ?? ''),
            secondaryAggregator: String(config.chainlinkOracle0.secondaryAggregator ?? ''),
            normalizationDivider: String(config.chainlinkOracle0.normalizationDivider ?? '0'),
            normalizationMultiplier: String(config.chainlinkOracle0.normalizationMultiplier ?? '0'),
            invertSecondPrice: Boolean(config.chainlinkOracle0.invertSecondPrice)
          }
        : undefined
      const chainlink1 = config.chainlinkOracle1 && oracleType1 === 'chainlink'
        ? {
            baseToken: (config.chainlinkOracle1.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
            primaryAggregator: String(config.chainlinkOracle1.primaryAggregator ?? ''),
            secondaryAggregator: String(config.chainlinkOracle1.secondaryAggregator ?? ''),
            normalizationDivider: String(config.chainlinkOracle1.normalizationDivider ?? '0'),
            normalizationMultiplier: String(config.chainlinkOracle1.normalizationMultiplier ?? '0'),
            invertSecondPrice: Boolean(config.chainlinkOracle1.invertSecondPrice)
          }
        : undefined
      const oracleConfig: OracleConfiguration = {
        token0: {
          type: oracleType0,
          scalerOracle: oracleType0 === 'scaler' ? {
            name: config.solvencyOracle0,
            address: '',
            valid: true,
            resultDecimals: 18,
            scaleFactor: '1'
          } : undefined,
          chainlinkOracle: oracleType0 === 'chainlink' ? chainlink0 : undefined
        },
        token1: {
          type: oracleType1,
          scalerOracle: oracleType1 === 'scaler' ? {
            name: config.solvencyOracle1,
            address: '',
            valid: true,
            resultDecimals: 18,
            scaleFactor: '1'
          } : undefined,
          chainlinkOracle: oracleType1 === 'chainlink' ? chainlink1 : undefined
        }
      }
      
      // Parse IRM model type from factory name in config
      const irmModelType: IRMModelType =
        config.interestRateModel0 === 'DynamicKinkModelFactory.sol' ? 'kink' : 'irm'

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
        irmModelType,
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

  const setLastDeployTxHash = (txHash: string | null, argsHash?: string | null) => {
    setWizardData(prev => ({
      ...prev,
      lastDeployTxHash: txHash,
      lastDeployArgsHash: txHash == null ? null : (argsHash ?? null)
    }))
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

  const setVerificationFromWizard = useCallback((value: boolean) => {
    setWizardData(prev => ({ ...prev, verificationFromWizard: value }))
  }, [])

  return (
    <WizardContext.Provider
      value={{
        wizardData,
        updateStep,
        markStepCompleted,
        updateToken0,
        updateToken1,
        updateNetworkInfo,
        clearNetworkInfo,
        updateOracleType0,
        updateOracleType1,
        updateOracleConfiguration,
        updateIRMModelType,
        updateSelectedIRM0,
        updateSelectedIRM1,
        updateBorrowConfiguration,
        updateFeesConfiguration,
        updateSelectedHook,
        updateHookOwnerAddress,
        generateJSONConfig,
        parseJSONConfig,
        setLastDeployTxHash,
        setVerificationFromWizard,
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
