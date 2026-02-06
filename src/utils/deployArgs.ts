import { ethers } from 'ethers'
import type { WizardData, ScalerOracle, ChainlinkOracleConfig, PTLinearOracleConfig } from '@/contexts/WizardContext'
import deployerArtifact from '@/abis/silo/ISiloDeployer.json'
import irmV2Artifact from '@/abis/silo/IInterestRateModelV2.json'
import oracleScalerFactoryAbi from '@/abis/oracle/OracleScalerFactory.json'
import chainlinkV3FactoryAbi from '@/abis/oracle/IChainlinkV3Factory.json'
import ptLinearOracleFactoryAbi from '@/abis/oracle/IPTLinearOracleFactory.json'
import { convertWizardTo18Decimals, BP2DP_NORMALIZATION } from '@/utils/verification/normalization'

/** Foundry artifact: ABI under "abi" key, never modify – use as-is for contract calls */
type FoundryArtifact = { abi: ethers.InterfaceAbi }

const deployerAbi = (deployerArtifact as FoundryArtifact).abi
const irmV2Abi = (irmV2Artifact as FoundryArtifact).abi
const scalerFactoryAbi = (oracleScalerFactoryAbi as FoundryArtifact).abi
const scalerFactoryInterface = new ethers.Interface(scalerFactoryAbi)
const chainlinkV3FactoryAbiTyped = (chainlinkV3FactoryAbi as FoundryArtifact).abi
const chainlinkV3FactoryInterface = new ethers.Interface(chainlinkV3FactoryAbiTyped)
const ptLinearFactoryAbi = (ptLinearOracleFactoryAbi as FoundryArtifact).abi
const ptLinearFactoryInterface = new ethers.Interface(ptLinearFactoryAbi)

export interface SiloCoreDeployments {
  [contractName: string]: string
}

export interface DeployArgs {
  _oracles: {
    solvencyOracle0: {
      deployed: string
      factory: string
      txInput: string
    }
    maxLtvOracle0: {
      deployed: string
      factory: string
      txInput: string
    }
    solvencyOracle1: {
      deployed: string
      factory: string
      txInput: string
    }
    maxLtvOracle1: {
      deployed: string
      factory: string
      txInput: string
    }
  }
  _irmConfigData0: {
    config: { [key: string]: string | number | boolean }
    encoded: string
  }
  _irmConfigData1: {
    config: { [key: string]: string | number | boolean }
    encoded: string
  }
  _clonableHookReceiver: {
    implementation: string
    initializationData: string
  }
  _siloInitData: {
    deployer: string
    hookReceiver: string
    daoFee: bigint
    deployerFee: bigint
    token0: string
    solvencyOracle0: string
    maxLtvOracle0: string
    interestRateModel0: string
    maxLtv0: bigint
    lt0: bigint
    liquidationTargetLtv0: bigint
    liquidationFee0: bigint
    flashloanFee0: bigint
    callBeforeQuote0: boolean
    token1: string
    solvencyOracle1: string
    maxLtvOracle1: string
    interestRateModel1: string
    maxLtv1: bigint
    lt1: bigint
    liquidationTargetLtv1: bigint
    liquidationFee1: bigint
    flashloanFee1: bigint
    callBeforeQuote1: boolean
  }
}

export interface OracleDeployments {
  chainlinkV3OracleFactory?: string
  ptLinearOracleFactory?: string
}

/**
 * Prepare deploy arguments from wizard data (matching Solidity script logic)
 * oracleDeployments: optional ChainlinkV3OracleFactory address (from silo-oracles deployments)
 */
export function prepareDeployArgs(
  wizardData: WizardData,
  siloCoreDeployments: SiloCoreDeployments,
  oracleDeployments?: OracleDeployments
): DeployArgs {
  if (!wizardData.token0 || !wizardData.token1) {
    throw new Error('Both token0 and token1 must be set')
  }

  // Constants from Solidity - now imported from normalization utilities

  // Resolve hook implementation address
  // The hookReceiverImplementation from config is used directly to look up in deployments
  // Matching: _resolveHookReceiverImpl(config.hookReceiverImplementation)
  const hookImplementationName = wizardData.selectedHook 
    ? `${wizardData.selectedHook}.sol` 
    : 'SiloHookV1.sol'
  
  // Look up the contract address using the exact contract name (e.g., "SiloHookV1.sol")
  // This matches how SiloCoreDeployments.get() works in Solidity
  const hookReceiverImplementation = siloCoreDeployments[hookImplementationName] || ethers.ZeroAddress

  // Resolve IRM factory address by model type: Kink vs legacy IRM
  const irmFactoryName = wizardData.irmModelType === 'kink'
    ? 'DynamicKinkModelFactory.sol'
    : 'InterestRateModelV2Factory.sol'
  const irmFactoryAddress = siloCoreDeployments[irmFactoryName] || ethers.ZeroAddress

  // Prepare Oracles struct: either deployed address or factory + createOracleScaler calldata
  const getOracleTxData = (oracleAddress: string | undefined) => {
    if (!oracleAddress || oracleAddress === ethers.ZeroAddress) {
      return {
        deployed: ethers.ZeroAddress,
        factory: ethers.ZeroAddress,
        txInput: '0x'
      }
    }
    return {
      deployed: oracleAddress,
      factory: ethers.ZeroAddress,
      txInput: '0x'
    }
  }

  const getSolvencyOracleTxData = (
    scaler: ScalerOracle | null | undefined,
    chainlink: ChainlinkOracleConfig | null | undefined,
    ptLinear: PTLinearOracleConfig | null | undefined
  ) => {
    if (chainlink && oracleDeployments?.chainlinkV3OracleFactory) {
      const baseToken = ethers.getAddress(chainlink.baseToken === 'token0' ? wizardData.token0!.address : wizardData.token1!.address)
      const quoteToken = ethers.getAddress(chainlink.baseToken === 'token0' ? wizardData.token1!.address : wizardData.token0!.address)
      const secondaryAgg = chainlink.secondaryAggregator && chainlink.secondaryAggregator.trim() !== '' && chainlink.secondaryAggregator !== ethers.ZeroAddress ? ethers.getAddress(chainlink.secondaryAggregator) : ethers.ZeroAddress
      const primaryAggregator = ethers.getAddress(chainlink.primaryAggregator)
      // Encode config as single tuple (array form) so ethers does not expand it into multiple args; ABI order: baseToken, quoteToken, primaryAggregator, primaryHeartbeat, secondaryAggregator, secondaryHeartbeat, normalizationDivider, normalizationMultiplier, invertSecondPrice
      const configTuple = [
        baseToken,
        quoteToken,
        primaryAggregator,
        0, // primaryHeartbeat uint32
        secondaryAgg,
        0, // secondaryHeartbeat uint32
        BigInt(chainlink.normalizationDivider),
        BigInt(chainlink.normalizationMultiplier),
        chainlink.invertSecondPrice
      ]
      const txInput = chainlinkV3FactoryInterface.encodeFunctionData('create', [configTuple, ethers.ZeroHash])
      return {
        deployed: ethers.ZeroAddress,
        factory: oracleDeployments.chainlinkV3OracleFactory,
        txInput
      }
    }
    if (ptLinear && oracleDeployments?.ptLinearOracleFactory) {
      // PT-Linear: ptToken = base token (token0 or token1 for this oracle), hardcodedQuoteToken = quote address (other token or user-provided)
      const ptToken = ethers.getAddress(
        wizardData.oracleConfiguration?.token0?.ptLinearOracle === ptLinear
          ? wizardData.token0!.address
          : wizardData.token1!.address
      )
      const hardcodedQuoteToken = ethers.getAddress(ptLinear.hardcodedQuoteTokenAddress?.trim() || ethers.ZeroAddress)
      // maxYield: percent as 18-decimal (e.g. 5% = 5e16)
      // No rounding - blockchain requires exact precision
      const maxYield = BigInt(Math.trunc(Number(ptLinear.maxYieldPercent) || 0)) * BigInt(1e16)
      const configTuple = [ptToken, maxYield, hardcodedQuoteToken]
      const txInput = ptLinearFactoryInterface.encodeFunctionData('create', [configTuple, ethers.ZeroHash])
      return {
        deployed: ethers.ZeroAddress,
        factory: oracleDeployments.ptLinearOracleFactory,
        txInput
      }
    }
    if (!scaler) return getOracleTxData(undefined)
    if (scaler.customCreate) {
      const txInput = scalerFactoryInterface.encodeFunctionData('createOracleScaler', [
        scaler.customCreate.quoteToken,
        ethers.ZeroHash
      ])
      return {
        deployed: ethers.ZeroAddress,
        factory: scaler.customCreate.factoryAddress,
        txInput
      }
    }
    return getOracleTxData(scaler.address)
  }

  const _oracles = {
    solvencyOracle0: getSolvencyOracleTxData(
      wizardData.oracleConfiguration?.token0?.scalerOracle,
      wizardData.oracleConfiguration?.token0?.chainlinkOracle,
      wizardData.oracleConfiguration?.token0?.ptLinearOracle
    ),
    maxLtvOracle0: getOracleTxData(ethers.ZeroAddress),
    solvencyOracle1: getSolvencyOracleTxData(
      wizardData.oracleConfiguration?.token1?.scalerOracle,
      wizardData.oracleConfiguration?.token1?.chainlinkOracle,
      wizardData.oracleConfiguration?.token1?.ptLinearOracle
    ),
    maxLtvOracle1: getOracleTxData(ethers.ZeroAddress)
  }

  // Encode Kink IRM config as ISiloDeployer.DKinkIRMConfig: (Config, ImmutableArgs, initialOwner)
  // IDynamicKinkModel.Config: ulow,u1,u2,ucrit,rmin(int256), kmin,kmax(int96), alpha,cminus,cplus,c1,c2,dmax(int256)
  // IDynamicKinkModel.ImmutableArgs: timelock(uint32), rcompCap(int96)
  const toBigIntSafe = (value: string | number | boolean | null | undefined): bigint => {
    if (value === null || value === undefined) return BigInt(0)
    if (typeof value === 'string') {
      try {
        return BigInt(value)
      } catch {
        return BigInt(0)
      }
    }
    return BigInt(Math.floor(Number(value) || 0))
  }

  const encodeKinkConfig = (irmConfig: { config?: { [key: string]: string | number | boolean } } | null): string => {
    if (!irmConfig?.config) return '0x'
    const c = irmConfig.config
    const configTuple = [
      toBigIntSafe(c.ulow),
      toBigIntSafe(c.u1),
      toBigIntSafe(c.u2),
      toBigIntSafe(c.ucrit),
      toBigIntSafe(c.rmin),
      BigInt(Number(c.kmin) ?? 0), // int96
      BigInt(Number(c.kmax) ?? 0), // int96
      toBigIntSafe(c.alpha),
      toBigIntSafe(c.cminus),
      toBigIntSafe(c.cplus),
      toBigIntSafe(c.c1),
      toBigIntSafe(c.c2),
      toBigIntSafe(c.dmax)
    ]
    const timelock = Number(c.timelock) ?? 0
    const rcompCap = BigInt(Number(c.rcompCap) ?? 0) // int96
    const immutableArgsTuple = [timelock, rcompCap]
    const initialOwner =
      wizardData.hookOwnerAddress && wizardData.hookOwnerAddress !== ethers.ZeroAddress && ethers.isAddress(wizardData.hookOwnerAddress)
        ? ethers.getAddress(wizardData.hookOwnerAddress)
        : ethers.ZeroAddress
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    // Pass 3 separate types so AbiCoder expects 3 values (not 1 type string and 3 values)
    const types = [
      'tuple(int256,int256,int256,int256,int256,int96,int96,int256,int256,int256,int256,int256,int256)',
      'tuple(uint32,int96)',
      'address'
    ]
    return abiCoder.encode(types, [configTuple, immutableArgsTuple, initialOwner])
  }

  // Prepare IRM config data as bytes
  // IRM (legacy) config is ABI-encoded as IInterestRateModelV2.Config (tuple from Foundry artifact, never modified)
  // Validation mirrors InterestRateModelV2Factory.verifyConfig() so we fail early with a clear message
  const DP = BigInt(1e18)
  const encodeIRMConfig = (irmConfig: { config?: { [key: string]: string | number | boolean } } | null): string => {
    if (!irmConfig || !irmConfig.config) {
      return '0x'
    }

    const config = irmConfig.config

    const toBigInt = toBigIntSafe

    const uopt = toBigInt(config.uopt)
    const ucrit = toBigInt(config.ucrit)
    const ulow = toBigInt(config.ulow)
    const ki = toBigInt(config.ki)
    const kcrit = toBigInt(config.kcrit)
    const klow = toBigInt(config.klow)
    const klin = toBigInt(config.klin)
    const beta = toBigInt(config.beta)
    const ri = toBigInt(config.ri)
    const Tcrit = toBigInt(config.Tcrit)

    // Same checks as InterestRateModelV2Factory.verifyConfig()
    const zero = BigInt(0)
    if (uopt <= zero || uopt >= DP) {
      throw new Error(`IRM config invalid: uopt must be in (0, 1e18), got ${uopt}`)
    }
    if (ucrit <= uopt || ucrit >= DP) {
      throw new Error(`IRM config invalid: ucrit must be in (uopt, 1e18), got ucrit=${ucrit} uopt=${uopt}`)
    }
    if (ulow <= zero || ulow >= uopt) {
      throw new Error(`IRM config invalid: ulow must be in (0, uopt), got ulow=${ulow} uopt=${uopt}`)
    }
    if (ki < zero) throw new Error('IRM config invalid: ki must be >= 0')
    if (kcrit < zero) throw new Error('IRM config invalid: kcrit must be >= 0')
    if (klow < zero) throw new Error('IRM config invalid: klow must be >= 0')
    if (klin < zero) throw new Error('IRM config invalid: klin must be >= 0')
    if (beta < zero) throw new Error('IRM config invalid: beta must be >= 0')
    if (ri < zero) throw new Error('IRM config invalid: ri must be >= 0')
    if (Tcrit < zero) throw new Error('IRM config invalid: Tcrit must be >= 0')

    try {
      const getConfigFn = (irmV2Abi as ethers.Fragment[]).find(
        (x): x is ethers.FunctionFragment => x.type === 'function' && (x as ethers.FunctionFragment).name === 'getConfig'
      )
      const configParamType = getConfigFn?.outputs?.[0]
      if (!configParamType) {
        console.error('IInterestRateModelV2.Config type not found in ABI')
        return '0x'
      }

      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const encoded = abiCoder.encode([configParamType], [[
        uopt, ucrit, ulow, ki, kcrit, klow, klin, beta, ri, Tcrit
      ]])
      return encoded
    } catch (err) {
      console.error('Error encoding IRM config:', err)
      throw err
    }
  }

  const isKink = wizardData.irmModelType === 'kink'
  const irmConfigData0Encoded = isKink
    ? encodeKinkConfig(wizardData.selectedIRM0)
    : encodeIRMConfig(wizardData.selectedIRM0)
  const irmConfigData1Encoded = isKink
    ? encodeKinkConfig(wizardData.selectedIRM1)
    : encodeIRMConfig(wizardData.selectedIRM1)

  // Prepare ClonableHookReceiver
  // Matching: _getClonableHookReceiverConfig(hookReceiverImplementation)
  // Initialization data is abi.encode(owner) where owner is from Step 8 (hook owner selection)
  // This matches: abi.encode(_getClonableHookReceiverOwner())
  let initializationData = '0x'
  if (wizardData.hookOwnerAddress && wizardData.hookOwnerAddress !== ethers.ZeroAddress && ethers.isAddress(wizardData.hookOwnerAddress)) {
    try {
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      // Encode the owner address: abi.encode(address owner)
      const normalizedAddress = ethers.getAddress(wizardData.hookOwnerAddress)
      initializationData = abiCoder.encode(['address'], [normalizedAddress])
    } catch (err) {
      console.error('Error encoding initialization data:', err)
      initializationData = '0x'
    }
  }

  const _clonableHookReceiver = {
    implementation: hookReceiverImplementation,
    initializationData: initializationData
  }

  // Prepare ISiloConfig.InitData
  // Convert basis points to 18 decimals (multiply by 10^14)
  // Use centralized normalization function from verification utilities
  const to18Decimals = (bp: number): bigint => {
    return convertWizardTo18Decimals(bp)
  }

  // Order of fields must match ISiloConfig.InitData ABI: deployer, hookReceiver, deployerFee, daoFee, ...
  const _siloInitData = {
    deployer: ethers.ZeroAddress, // Can be set by user or left as zero
    hookReceiver: ethers.ZeroAddress, // CLONE_IMPLEMENTATION means zero, will use implementation
    deployerFee: to18Decimals(wizardData.feesConfiguration?.deployerFee || 0),
    daoFee: to18Decimals(wizardData.feesConfiguration?.daoFee || 0),
    token0: wizardData.token0.address,
    solvencyOracle0: _oracles.solvencyOracle0.deployed,
    maxLtvOracle0: ethers.ZeroAddress,
    interestRateModel0: irmFactoryAddress,
    maxLtv0: to18Decimals(wizardData.borrowConfiguration?.token0.maxLTV || 0),
    lt0: to18Decimals(wizardData.borrowConfiguration?.token0.liquidationThreshold || 0),
    liquidationTargetLtv0: to18Decimals(wizardData.borrowConfiguration?.token0.liquidationTargetLTV || 0),
    liquidationFee0: to18Decimals(wizardData.feesConfiguration?.token0.liquidationFee || 0),
    flashloanFee0: to18Decimals(wizardData.feesConfiguration?.token0.flashloanFee || 0),
    callBeforeQuote0: false,
    token1: wizardData.token1.address,
    solvencyOracle1: _oracles.solvencyOracle1.deployed,
    maxLtvOracle1: ethers.ZeroAddress,
    interestRateModel1: irmFactoryAddress,
    maxLtv1: to18Decimals(wizardData.borrowConfiguration?.token1.maxLTV || 0),
    lt1: to18Decimals(wizardData.borrowConfiguration?.token1.liquidationThreshold || 0),
    liquidationTargetLtv1: to18Decimals(wizardData.borrowConfiguration?.token1.liquidationTargetLTV || 0),
    liquidationFee1: to18Decimals(wizardData.feesConfiguration?.token1.liquidationFee || 0),
    flashloanFee1: to18Decimals(wizardData.feesConfiguration?.token1.flashloanFee || 0),
    callBeforeQuote1: false
  }

  return {
    _oracles,
    _irmConfigData0: {
      config: wizardData.selectedIRM0?.config || {},
      encoded: irmConfigData0Encoded
    },
    _irmConfigData1: {
      config: wizardData.selectedIRM1?.config || {},
      encoded: irmConfigData1Encoded
    },
    _clonableHookReceiver,
    _siloInitData
  }
}

/**
 * Generate calldata for deploy transaction
 * This encodes the deploy function call without actually sending it
 */
export function generateDeployCalldata(
  deployerAddress: string,
  deployArgs: DeployArgs
): string {
  const iface = new ethers.Interface(deployerAbi)

  return iface.encodeFunctionData('deploy', [
    deployArgs._oracles,
    deployArgs._irmConfigData0.encoded,
    deployArgs._irmConfigData1.encoded,
    deployArgs._clonableHookReceiver,
    deployArgs._siloInitData
  ])
}
