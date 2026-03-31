import type { 
  WizardData, 
  TokenData, 
  OracleConfiguration, 
  IRMConfig, 
  BorrowConfiguration, 
  FeesConfiguration, 
  HookType 
} from '@/contexts/WizardContext'
import { displayNumberToBigint } from '@/utils/verification/normalization'

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
  manageableOracle: true,
  manageableOracleTimelock: undefined,
  manageableOracleOwnerAddress: null,
  lastDeployTxHash: null,
  lastDeployArgsHash: null,
  verificationFromWizard: false
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
  
  // Parse oracle configuration (match WizardContext: none | scaler | chainlink | ptLinear | vault | customMethod | supraSValue)
  const oracleType0 =
    config.solvencyOracle0 === 'NO_ORACLE'
      ? 'none'
      : config.solvencyOracle0 === 'Chainlink'
      ? 'chainlink'
      : config.solvencyOracle0 === 'PT-Linear'
      ? 'ptLinear'
      : config.solvencyOracle0 === 'VaultOracle'
      ? 'vault'
      : config.solvencyOracle0 === 'CustomMethodOracle'
      ? 'customMethod'
      : config.solvencyOracle0 === 'SupraSValueOracle'
      ? 'supraSValue'
      : 'scaler'
  const oracleType1 =
    config.solvencyOracle1 === 'NO_ORACLE'
      ? 'none'
      : config.solvencyOracle1 === 'Chainlink'
      ? 'chainlink'
      : config.solvencyOracle1 === 'PT-Linear'
      ? 'ptLinear'
      : config.solvencyOracle1 === 'VaultOracle'
      ? 'vault'
      : config.solvencyOracle1 === 'CustomMethodOracle'
      ? 'customMethod'
      : config.solvencyOracle1 === 'SupraSValueOracle'
      ? 'supraSValue'
      : 'scaler'
  const chainlink0 = config.chainlinkOracle0 && oracleType0 === 'chainlink'
    ? {
        baseToken: (config.chainlinkOracle0.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
        useOtherTokenAsQuote: config.chainlinkOracle0.useOtherTokenAsQuote !== false,
        customQuoteTokenAddress: String(config.chainlinkOracle0.customQuoteTokenAddress ?? ''),
        customQuoteTokenMetadata: config.chainlinkOracle0.customQuoteTokenMetadata ? { symbol: String(config.chainlinkOracle0.customQuoteTokenMetadata.symbol ?? ''), decimals: Number(config.chainlinkOracle0.customQuoteTokenMetadata.decimals ?? 18) } : undefined,
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
        useOtherTokenAsQuote: config.chainlinkOracle1.useOtherTokenAsQuote !== false,
        customQuoteTokenAddress: String(config.chainlinkOracle1.customQuoteTokenAddress ?? ''),
        customQuoteTokenMetadata: config.chainlinkOracle1.customQuoteTokenMetadata ? { symbol: String(config.chainlinkOracle1.customQuoteTokenMetadata.symbol ?? ''), decimals: Number(config.chainlinkOracle1.customQuoteTokenMetadata.decimals ?? 18) } : undefined,
        primaryAggregator: String(config.chainlinkOracle1.primaryAggregator ?? ''),
        secondaryAggregator: String(config.chainlinkOracle1.secondaryAggregator ?? ''),
        normalizationDivider: String(config.chainlinkOracle1.normalizationDivider ?? '0'),
        normalizationMultiplier: String(config.chainlinkOracle1.normalizationMultiplier ?? '0'),
        invertSecondPrice: Boolean(config.chainlinkOracle1.invertSecondPrice)
      }
    : undefined
  const customMethod0 = config.customMethodOracle0 && oracleType0 === 'customMethod'
    ? {
        baseToken: (config.customMethodOracle0.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
        useOtherTokenAsQuote: config.customMethodOracle0.useOtherTokenAsQuote !== false,
        customQuoteTokenAddress: String(config.customMethodOracle0.customQuoteTokenAddress ?? ''),
        customQuoteTokenMetadata: config.customMethodOracle0.customQuoteTokenMetadata
          ? {
              symbol: String(config.customMethodOracle0.customQuoteTokenMetadata.symbol ?? ''),
              decimals: Number(config.customMethodOracle0.customQuoteTokenMetadata.decimals ?? 18)
            }
          : undefined,
        target: String(config.customMethodOracle0.target ?? ''),
        methodSignature: String(config.customMethodOracle0.methodSignature ?? ''),
        callSelector: String(config.customMethodOracle0.callSelector ?? ''),
        priceDecimals: Number(config.customMethodOracle0.priceDecimals ?? 18)
      }
    : undefined
  const customMethod1 = config.customMethodOracle1 && oracleType1 === 'customMethod'
    ? {
        baseToken: (config.customMethodOracle1.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
        useOtherTokenAsQuote: config.customMethodOracle1.useOtherTokenAsQuote !== false,
        customQuoteTokenAddress: String(config.customMethodOracle1.customQuoteTokenAddress ?? ''),
        customQuoteTokenMetadata: config.customMethodOracle1.customQuoteTokenMetadata
          ? {
              symbol: String(config.customMethodOracle1.customQuoteTokenMetadata.symbol ?? ''),
              decimals: Number(config.customMethodOracle1.customQuoteTokenMetadata.decimals ?? 18)
            }
          : undefined,
        target: String(config.customMethodOracle1.target ?? ''),
        methodSignature: String(config.customMethodOracle1.methodSignature ?? ''),
        callSelector: String(config.customMethodOracle1.callSelector ?? ''),
        priceDecimals: Number(config.customMethodOracle1.priceDecimals ?? 18)
      }
    : undefined
  const supra0 = config.supraSValueOracle0 && oracleType0 === 'supraSValue'
    ? {
        baseToken: (config.supraSValueOracle0.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
        useOtherTokenAsQuote: config.supraSValueOracle0.useOtherTokenAsQuote !== false,
        customQuoteTokenAddress: String(config.supraSValueOracle0.customQuoteTokenAddress ?? ''),
        customQuoteTokenMetadata: config.supraSValueOracle0.customQuoteTokenMetadata
          ? {
              symbol: String(config.supraSValueOracle0.customQuoteTokenMetadata.symbol ?? ''),
              decimals: Number(config.supraSValueOracle0.customQuoteTokenMetadata.decimals ?? 18)
            }
          : undefined,
        pairId: String(config.supraSValueOracle0.pairId ?? '')
      }
    : undefined
  const supra1 = config.supraSValueOracle1 && oracleType1 === 'supraSValue'
    ? {
        baseToken: (config.supraSValueOracle1.baseToken === 'token1' ? 'token1' : 'token0') as 'token0' | 'token1',
        useOtherTokenAsQuote: config.supraSValueOracle1.useOtherTokenAsQuote !== false,
        customQuoteTokenAddress: String(config.supraSValueOracle1.customQuoteTokenAddress ?? ''),
        customQuoteTokenMetadata: config.supraSValueOracle1.customQuoteTokenMetadata
          ? {
              symbol: String(config.supraSValueOracle1.customQuoteTokenMetadata.symbol ?? ''),
              decimals: Number(config.supraSValueOracle1.customQuoteTokenMetadata.decimals ?? 18)
            }
          : undefined,
        pairId: String(config.supraSValueOracle1.pairId ?? '')
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
      chainlinkOracle: oracleType0 === 'chainlink' ? chainlink0 : undefined,
      customMethodOracle: oracleType0 === 'customMethod' ? customMethod0 : undefined,
      supraSValueOracle: oracleType0 === 'supraSValue' ? supra0 : undefined
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
      chainlinkOracle: oracleType1 === 'chainlink' ? chainlink1 : undefined,
      customMethodOracle: oracleType1 === 'customMethod' ? customMethod1 : undefined,
      supraSValueOracle: oracleType1 === 'supraSValue' ? supra1 : undefined
    }
  }

  // Only Dynamic Kink is supported
  const irmModelType = 'kink' as const

  // Parse IRM configuration; optional irmConfig0/irmConfig1 allow full config in JSON (e.g. for tests)
  const irm0: IRMConfig = {
    name: config.interestRateModelConfig0 || '',
    config: typeof config.irmConfig0 === 'object' && config.irmConfig0 !== null ? config.irmConfig0 as Record<string, string | number | boolean> : {}
  }

  const irm1: IRMConfig = {
    name: config.interestRateModelConfig1 || '',
    config: typeof config.irmConfig1 === 'object' && config.irmConfig1 !== null ? config.irmConfig1 as Record<string, string | number | boolean> : {}
  }
  
  // Step 9 JSON stores values as percentage * 100 (e.g. 9500 = 95%). Convert to percentage then to BigInt.
  const toPercentage = (v: number) => v / 100
  const borrowConfig: BorrowConfiguration = {
    token0: {
      nonBorrowable: config.maxLtv0 === 0 && config.lt0 === 0,
      liquidationThreshold: config.lt0 != null ? displayNumberToBigint(toPercentage(config.lt0)) : BigInt(0),
      maxLTV: config.maxLtv0 != null ? displayNumberToBigint(toPercentage(config.maxLtv0)) : BigInt(0),
      liquidationTargetLTV: config.liquidationTargetLtv0 != null ? displayNumberToBigint(toPercentage(config.liquidationTargetLtv0)) : BigInt(0)
    },
    token1: {
      nonBorrowable: config.maxLtv1 === 0 && config.lt1 === 0,
      liquidationThreshold: config.lt1 != null ? displayNumberToBigint(toPercentage(config.lt1)) : BigInt(0),
      maxLTV: config.maxLtv1 != null ? displayNumberToBigint(toPercentage(config.maxLtv1)) : BigInt(0),
      liquidationTargetLTV: config.liquidationTargetLtv1 != null ? displayNumberToBigint(toPercentage(config.liquidationTargetLtv1)) : BigInt(0)
    }
  }

  const feesConfig: FeesConfiguration = {
    daoFee: config.daoFee != null ? displayNumberToBigint(toPercentage(config.daoFee)) : BigInt(0),
    deployerFee: config.deployerFee != null ? displayNumberToBigint(toPercentage(config.deployerFee)) : BigInt(0),
    token0: {
      liquidationFee: config.liquidationFee0 != null ? displayNumberToBigint(toPercentage(config.liquidationFee0)) : BigInt(0),
      flashloanFee: config.flashloanFee0 != null ? displayNumberToBigint(toPercentage(config.flashloanFee0)) : BigInt(0)
    },
    token1: {
      liquidationFee: config.liquidationFee1 != null ? displayNumberToBigint(toPercentage(config.liquidationFee1)) : BigInt(0),
      flashloanFee: config.flashloanFee1 != null ? displayNumberToBigint(toPercentage(config.flashloanFee1)) : BigInt(0)
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
