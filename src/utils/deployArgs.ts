import { ethers } from 'ethers'
import type { WizardData, ScalerOracle, ChainlinkOracleConfig, PTLinearOracleConfig } from '@/contexts/WizardContext'
import deployerArtifact from '@/abis/silo/ISiloDeployer.json'
import oracleScalerFactoryAbi from '@/abis/oracle/OracleScalerFactory.json'
import chainlinkV3FactoryAbi from '@/abis/oracle/IChainlinkV3Factory.json'
import ptLinearOracleFactoryAbi from '@/abis/oracle/IPTLinearOracleFactory.json'
import manageableOracleFactoryAbi from '@/abis/oracle/IManageableOracleFactory.json'
import { convertWizardTo18Decimals } from '@/utils/verification/normalization'

/** Foundry artifact: ABI under "abi" key, never modify – use as-is for contract calls */
type FoundryArtifact = { abi: ethers.InterfaceAbi }

const deployerAbi = (deployerArtifact as FoundryArtifact).abi
const scalerFactoryAbi = (oracleScalerFactoryAbi as FoundryArtifact).abi
const scalerFactoryInterface = new ethers.Interface(scalerFactoryAbi)
const chainlinkV3FactoryAbiTyped = (chainlinkV3FactoryAbi as FoundryArtifact).abi
const chainlinkV3FactoryInterface = new ethers.Interface(chainlinkV3FactoryAbiTyped)
const ptLinearFactoryAbi = (ptLinearOracleFactoryAbi as FoundryArtifact).abi
const ptLinearFactoryInterface = new ethers.Interface(ptLinearFactoryAbi)
const manageableFactoryAbi = (manageableOracleFactoryAbi as FoundryArtifact).abi
const manageableFactoryInterface = new ethers.Interface(manageableFactoryAbi)

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
  manageableOracleFactory?: string
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

  // Dynamic Kink model only
  const irmFactoryName = 'DynamicKinkModelFactory.sol'
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
      const quoteToken = (chainlink.useOtherTokenAsQuote !== false)
        ? ethers.getAddress(chainlink.baseToken === 'token0' ? wizardData.token1!.address : wizardData.token0!.address)
        : ethers.getAddress(chainlink.customQuoteTokenAddress!.trim())
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

  /** Wrap oracle txData in ManageableOracle when manageableOracle is enabled. */
  const wrapInManageableIfEnabled = (
    txData: { deployed: string; factory: string; txInput: string }
  ): { deployed: string; factory: string; txInput: string } => {
    const manageable = wizardData.manageableOracle ?? true
    if (!manageable || !oracleDeployments?.manageableOracleFactory) return txData

    const owner =
      wizardData.manageableOracleOwnerAddress && ethers.isAddress(wizardData.manageableOracleOwnerAddress)
        ? ethers.getAddress(wizardData.manageableOracleOwnerAddress)
        : ethers.ZeroAddress
    const timelock = wizardData.manageableOracleTimelock ?? 86400 // fallback for old cached data
    const externalSalt = ethers.ZeroHash

    // Pre-deployed oracle: use create(address,address,uint32,bytes32)
    if (txData.deployed !== ethers.ZeroAddress) {
      const txInput = manageableFactoryInterface.encodeFunctionData(
        'create(address,address,uint32,bytes32)',
        [txData.deployed, owner, timelock, externalSalt]
      )
      return {
        deployed: ethers.ZeroAddress,
        factory: oracleDeployments.manageableOracleFactory,
        txInput
      }
    }

    // Factory + txInput: use create(address,bytes,address,uint32,bytes32)
    if (txData.factory !== ethers.ZeroAddress && txData.txInput !== '0x') {
      const txInput = manageableFactoryInterface.encodeFunctionData(
        'create(address,bytes,address,uint32,bytes32)',
        [txData.factory, txData.txInput, owner, timelock, externalSalt]
      )
      return {
        deployed: ethers.ZeroAddress,
        factory: oracleDeployments.manageableOracleFactory,
        txInput
      }
    }

    return txData
  }

  const solvency0Raw = getSolvencyOracleTxData(
    wizardData.oracleConfiguration?.token0?.scalerOracle,
    wizardData.oracleConfiguration?.token0?.chainlinkOracle,
    wizardData.oracleConfiguration?.token0?.ptLinearOracle
  )
  const solvency1Raw = getSolvencyOracleTxData(
    wizardData.oracleConfiguration?.token1?.scalerOracle,
    wizardData.oracleConfiguration?.token1?.chainlinkOracle,
    wizardData.oracleConfiguration?.token1?.ptLinearOracle
  )

  const _oracles = {
    solvencyOracle0: wrapInManageableIfEnabled(solvency0Raw),
    maxLtvOracle0: getOracleTxData(ethers.ZeroAddress),
    solvencyOracle1: wrapInManageableIfEnabled(solvency1Raw),
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
      toBigIntSafe(c.kmin), // int96
      toBigIntSafe(c.kmax), // int96
      toBigIntSafe(c.alpha),
      toBigIntSafe(c.cminus),
      toBigIntSafe(c.cplus),
      toBigIntSafe(c.c1),
      toBigIntSafe(c.c2),
      toBigIntSafe(c.dmax)
    ]
    const timelock = Number.isFinite(Number(c.timelock)) ? Number(c.timelock) : 0
    const rcompCap = toBigIntSafe(c.rcompCap) // int96
    const immutableArgsTuple = [timelock, rcompCap]
    // IRM owner = same as Oracle owner (manageableOracleOwnerAddress); hook owner is separate
    const initialOwner =
      wizardData.manageableOracleOwnerAddress && wizardData.manageableOracleOwnerAddress !== ethers.ZeroAddress && ethers.isAddress(wizardData.manageableOracleOwnerAddress)
        ? ethers.getAddress(wizardData.manageableOracleOwnerAddress)
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

  const irmConfigData0Encoded = encodeKinkConfig(wizardData.selectedIRM0)
  const irmConfigData1Encoded = encodeKinkConfig(wizardData.selectedIRM1)

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
  // Wizard stores values as BigInt in on-chain format; pass-through via centralized normalization
  const to18Decimals = (val: bigint): bigint => convertWizardTo18Decimals(val)

  const zeroBigInt = BigInt(0)
  // Order of fields must match ISiloConfig.InitData ABI: deployer, hookReceiver, deployerFee, daoFee, ...
  const _siloInitData = {
    deployer: ethers.ZeroAddress, // Can be set by user or left as zero
    hookReceiver: ethers.ZeroAddress, // CLONE_IMPLEMENTATION means zero, will use implementation
    deployerFee: to18Decimals(wizardData.feesConfiguration?.deployerFee ?? zeroBigInt),
    daoFee: to18Decimals(wizardData.feesConfiguration?.daoFee ?? zeroBigInt),
    token0: wizardData.token0.address,
    solvencyOracle0: _oracles.solvencyOracle0.deployed,
    maxLtvOracle0: ethers.ZeroAddress,
    interestRateModel0: irmFactoryAddress,
    maxLtv0: to18Decimals(wizardData.borrowConfiguration?.token0.maxLTV ?? zeroBigInt),
    lt0: to18Decimals(wizardData.borrowConfiguration?.token0.liquidationThreshold ?? zeroBigInt),
    liquidationTargetLtv0: to18Decimals(wizardData.borrowConfiguration?.token0.liquidationTargetLTV ?? zeroBigInt),
    liquidationFee0: to18Decimals(wizardData.feesConfiguration?.token0.liquidationFee ?? zeroBigInt),
    flashloanFee0: to18Decimals(wizardData.feesConfiguration?.token0.flashloanFee ?? zeroBigInt),
    callBeforeQuote0: false,
    token1: wizardData.token1.address,
    solvencyOracle1: _oracles.solvencyOracle1.deployed,
    maxLtvOracle1: ethers.ZeroAddress,
    interestRateModel1: irmFactoryAddress,
    maxLtv1: to18Decimals(wizardData.borrowConfiguration?.token1.maxLTV ?? zeroBigInt),
    lt1: to18Decimals(wizardData.borrowConfiguration?.token1.liquidationThreshold ?? zeroBigInt),
    liquidationTargetLtv1: to18Decimals(wizardData.borrowConfiguration?.token1.liquidationTargetLTV ?? zeroBigInt),
    liquidationFee1: to18Decimals(wizardData.feesConfiguration?.token1.liquidationFee ?? zeroBigInt),
    flashloanFee1: to18Decimals(wizardData.feesConfiguration?.token1.flashloanFee ?? zeroBigInt),
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
