import type { 
  WizardData, 
  TokenData, 
  OracleConfiguration, 
  IRMConfig, 
  BorrowConfiguration, 
  FeesConfiguration, 
  HookType 
} from '@/contexts/WizardContext'

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
  lastDeployTxHash: null
}

/**
 * Parse JSON config string into WizardData
 * This is a pure function version of parseJSONConfig from WizardContext
 * that can be used in tests without React hooks
 */
export function parseJSONConfigToWizardData(jsonString: string): WizardData {
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
  
  // Parse oracle configuration (match WizardContext: none | scaler | chainlink)
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
  const irmModelType = config.interestRateModel0 === 'DynamicKinkModelFactory.sol' ? 'kink' : 'irm'

  // Parse IRM configuration; optional irmConfig0/irmConfig1 allow full config in JSON (e.g. for tests)
  const irm0: IRMConfig = {
    name: config.interestRateModelConfig0 || '',
    config: typeof config.irmConfig0 === 'object' && config.irmConfig0 !== null ? config.irmConfig0 as Record<string, string | number | boolean> : {}
  }

  const irm1: IRMConfig = {
    name: config.interestRateModelConfig1 || '',
    config: typeof config.irmConfig1 === 'object' && config.irmConfig1 !== null ? config.irmConfig1 as Record<string, string | number | boolean> : {}
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
  
  return {
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
}
