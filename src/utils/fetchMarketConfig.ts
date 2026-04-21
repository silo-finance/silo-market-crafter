import { ethers } from 'ethers'
import siloConfigAbi from '@/abis/silo/ISiloConfig.json'
import dynamicKinkModelAbi from '@/abis/silo/DynamicKinkModel.json'
import oracleScalerAbi from '@/abis/oracle/OracleScaler.json'
import siloOracleAbi from '@/abis/oracle/ISiloOracle.json'
import erc20Abi from '@/abis/IERC20.json'
import iShareTokenAbi from '@/abis/silo/IShareToken.json'
import chainlinkV3OracleAbi from '@/abis/oracle/IChainlinkV3Oracle.json'
import chainlinkOracleConfigAbi from '@/abis/oracle/IChainlinkOracleConfig.json'
import supraSValueOracleAbi from '@/abis/oracle/ISupraSValueOracle.json'
import aggregatorV3Artifact from '@/abis/oracle/AggregatorV3Interface.json'
import oracleAggregatorAbi from '@/abis/oracle/Aggregator.json'
import erc4626OracleHardcodeQuoteArtifact from '@/abis/oracle/ERC4626OracleHardcodeQuote.json'
import ierc4626VaultArtifact from '@/abis/IERC4526.json'
import { ADDRESSES_JSON_BASE, getChainNameForAddresses } from '@/utils/symbolToAddress'
import { getChainName } from '@/utils/networks'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'

async function fetchSiloLensAddress(chainName: string): Promise<string | null> {
  const lensContractName = 'SiloLens.sol'
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${lensContractName}.json`
    )
    if (response.ok) {
      const data = await response.json()
      const address = data.address || ''
      if (address && ethers.isAddress(address)) return address
    }
  } catch {
    // ignore
  }
  return null
}

export interface MarketConfig {
  siloConfig: string
  siloId: bigint | null
  silo0: SiloConfig
  silo1: SiloConfig
}

export interface TokenMeta {
  symbol?: string
  decimals?: number
}

export interface SiloConfig {
  silo: string
  factory?: string
  token: string
  tokenSymbol?: string
  tokenDecimals?: number
  protectedShareToken: string
  protectedShareTokenSymbol?: string
  protectedShareTokenDecimals?: number
  protectedShareTokenOffset?: number
  collateralShareToken: string
  collateralShareTokenSymbol?: string
  collateralShareTokenDecimals?: number
  collateralShareTokenOffset?: number
  debtShareToken: string
  debtShareTokenSymbol?: string
  debtShareTokenDecimals?: number
  debtShareTokenOffset?: number
  solvencyOracle: OracleInfo
  maxLtvOracle: OracleInfo
  interestRateModel: IRMInfo
  maxLtv: bigint
  lt: bigint
  liquidationTargetLtv: bigint
  liquidationFee: bigint
  flashloanFee: bigint
  daoFee: bigint
  deployerFee: bigint
  hookReceiver: string
  hookReceiverVersion?: string
  hookReceiverOwner?: string
  hookReceiverOwnerIsContract?: boolean
  hookReceiverOwnerName?: string
  callBeforeQuote: boolean
}

export interface OracleInfo {
  address: string
  type?: string
  config?: Record<string, unknown>
  version?: string
  /** quote(1 base token, baseToken) result as raw string (display as 18 decimals) */
  quotePrice?: string
  /** Oracle base token address (when oracle exposes baseToken()). */
  baseTokenAddress?: string
  /** Symbol for base token address when available. */
  baseTokenSymbol?: string
  /** Oracle quote token address (when oracle exposes quoteToken()). */
  quoteTokenAddress?: string
  /** Symbol of the token in which quote price is denominated (when available, e.g. from QUOTE_TOKEN) */
  quoteTokenSymbol?: string
  /** Set only for ManageableOracle wrappers when contract has owner() */
  owner?: string
  ownerIsContract?: boolean
  ownerName?: string
  /** For ManageableOracle: underlying oracle address + version (from SiloLens) */
  underlying?: { address: string; version?: string }
  /** For ManageableOracle: timelock duration in seconds (from contract timelock()) */
  timelockSeconds?: number
  /** ERC4626OracleHardcodeQuote: vault underlying asset vs oracle quoteToken() */
  erc4626VaultQuoteCheck?: Erc4626VaultQuoteCheck
}

export interface Erc4626VaultQuoteCheck {
  /** null if RPC/compare could not complete */
  match: boolean | null
  vaultAssetAddress?: string
  quoteTokenAddress?: string
  vaultAssetSymbol?: string
  quoteTokenSymbol?: string
  error?: string
}

export interface IRMInfo {
  address: string
  type?: string
  config?: Record<string, unknown>
  version?: string
  /** Set only for DynamicKinkModel (kink) when contract has owner() */
  owner?: string
  ownerIsContract?: boolean
  ownerName?: string
  /** Current IRM config contract address (DynamicKinkModel.irmConfig()), used for configsHistory chain */
  irmConfigAddress?: string
}

// ---------------------------------------------------------------------------
// ABIs & helpers
// ---------------------------------------------------------------------------

const siloConfigInterfaceAbi = siloConfigAbi.abi as ethers.InterfaceAbi
const erc20InterfaceAbi = erc20Abi.abi as ethers.InterfaceAbi
const iShareTokenInterfaceAbi = iShareTokenAbi.abi as ethers.InterfaceAbi
const oracleScalerInterfaceAbi = oracleScalerAbi.abi as ethers.InterfaceAbi
const siloOracleInterfaceAbi = siloOracleAbi.abi as ethers.InterfaceAbi
const oracleAggregatorInterfaceAbi = oracleAggregatorAbi as ethers.InterfaceAbi
const chainlinkV3OracleInterfaceAbi = chainlinkV3OracleAbi as unknown as ethers.InterfaceAbi
const chainlinkOracleConfigInterfaceAbi = chainlinkOracleConfigAbi as unknown as ethers.InterfaceAbi
const supraSValueOracleInterfaceAbi = supraSValueOracleAbi as unknown as ethers.InterfaceAbi
const aggregatorV3Abi = (aggregatorV3Artifact as { abi: ethers.InterfaceAbi }).abi
const erc4626OracleHardcodeQuoteAbi = erc4626OracleHardcodeQuoteArtifact as ethers.InterfaceAbi
const ierc4626VaultAbi = ierc4626VaultArtifact as ethers.InterfaceAbi
const dynamicKinkModelInterfaceAbi = dynamicKinkModelAbi as unknown as ethers.InterfaceAbi

const siloFactoryReadAbi = [
  {
    type: 'function' as const,
    name: 'factory',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view' as const
  }
] as const

const ownerReadAbi = [
  {
    type: 'function' as const,
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view' as const
  }
] as const

const manageableOracleReadAbi = [
  {
    type: 'function' as const,
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view' as const
  },
  {
    type: 'function' as const,
    name: 'oracle',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view' as const
  },
  {
    type: 'function' as const,
    name: 'timelock',
    inputs: [],
    outputs: [{ name: '', type: 'uint32' }],
    stateMutability: 'view' as const
  }
] as const

const quoteAbi = [
  {
    type: 'function' as const,
    name: 'quote',
    inputs: [
      { name: '_baseAmount', type: 'uint256' },
      { name: '_baseToken', type: 'address' }
    ],
    outputs: [{ name: 'quoteAmount', type: 'uint256' }],
    stateMutability: 'view' as const
  }
] as const

const ptLinearReadAbi = [
  {
    type: 'function' as const,
    name: 'baseDiscountPerYear',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const
  }
] as const

const customMethodOracleReadAbi: ethers.InterfaceAbi = [
  {
    type: 'function',
    name: 'getConfig',
    inputs: [],
    outputs: [
      {
        components: [
          { name: 'baseToken', type: 'address', internalType: 'address' },
          { name: 'quoteToken', type: 'address', internalType: 'address' },
          { name: 'target', type: 'address', internalType: 'address' },
          { name: 'callSelector', type: 'bytes4', internalType: 'bytes4' },
          { name: 'normalizationDivider', type: 'uint256', internalType: 'uint256' },
          { name: 'normalizationMultiplier', type: 'uint256', internalType: 'uint256' }
        ],
        name: '',
        type: 'tuple',
        internalType: 'struct ICustomMethodOracle.OracleConfig'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'readPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'methodSignature',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view'
  }
]

const erc4626OracleQuoteAndVaultAbi = [
  {
    type: 'function' as const,
    name: 'quoteToken',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view' as const
  },
  {
    type: 'function' as const,
    name: 'VAULT',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view' as const
  }
] as const

function isNonZeroAddress(value: string | undefined | null): value is string {
  return !!value && ethers.isAddress(value) && value !== ethers.ZeroAddress
}

function toLower(value: string): string {
  return value.toLowerCase()
}

function normalizeAddressSafe(value: unknown): string | null {
  if (value == null) return null
  const str = typeof value === 'string' ? value : String(value)
  if (!ethers.isAddress(str)) return null
  return ethers.getAddress(str)
}

// ---------------------------------------------------------------------------
// fetchMarketConfig: multicall-driven pipeline
// ---------------------------------------------------------------------------

export async function fetchMarketConfig(
  provider: ethers.Provider,
  siloConfigAddress: string
): Promise<MarketConfig> {
  // Layer 0: SiloConfig top-level reads (SILO_ID + getSilos) via multicall.
  const [siloIdResult, silosResult] = await executeReadMulticall<unknown>(provider, [
    buildReadMulticallCall({
      target: siloConfigAddress,
      abi: siloConfigInterfaceAbi,
      functionName: 'SILO_ID',
      allowFailure: true
    }),
    buildReadMulticallCall({
      target: siloConfigAddress,
      abi: siloConfigInterfaceAbi,
      functionName: 'getSilos'
    })
  ])

  const siloId: bigint | null =
    siloIdResult == null ? null : typeof siloIdResult === 'bigint' ? siloIdResult : BigInt(String(siloIdResult))

  if (!Array.isArray(silosResult) || silosResult.length < 2) {
    throw new Error(
      'Could not load market configuration. If you entered a Silo Config address, Silo address, or transaction hash, ' +
        'please verify it exists on the current network and is properly initialized.'
    )
  }
  const silo0Address: string = String(silosResult[0])
  const silo1Address: string = String(silosResult[1])

  // Layer 1: getConfig(silo0) + getConfig(silo1) + factory() on each silo
  type SiloConfigTuple = {
    daoFee: bigint
    deployerFee: bigint
    silo: string
    token: string
    protectedShareToken: string
    collateralShareToken: string
    debtShareToken: string
    solvencyOracle: string
    maxLtvOracle: string
    interestRateModel: string
    maxLtv: bigint
    lt: bigint
    liquidationTargetLtv: bigint
    liquidationFee: bigint
    flashloanFee: bigint
    hookReceiver: string
    callBeforeQuote: boolean
  }

  const [rawCfg0, rawCfg1, factory0Raw, factory1Raw] = await executeReadMulticall<unknown>(provider, [
    buildReadMulticallCall({
      target: siloConfigAddress,
      abi: siloConfigInterfaceAbi,
      functionName: 'getConfig',
      args: [silo0Address]
    }),
    buildReadMulticallCall({
      target: siloConfigAddress,
      abi: siloConfigInterfaceAbi,
      functionName: 'getConfig',
      args: [silo1Address]
    }),
    buildReadMulticallCall({
      target: silo0Address,
      abi: siloFactoryReadAbi as unknown as ethers.InterfaceAbi,
      functionName: 'factory',
      allowFailure: true
    }),
    buildReadMulticallCall({
      target: silo1Address,
      abi: siloFactoryReadAbi as unknown as ethers.InterfaceAbi,
      functionName: 'factory',
      allowFailure: true
    })
  ])

  const rawConfig0 = rawCfg0 as SiloConfigTuple
  const rawConfig1 = rawCfg1 as SiloConfigTuple
  const factory0 = normalizeAddressSafe(factory0Raw) ?? undefined
  const factory1 = normalizeAddressSafe(factory1Raw) ?? undefined

  // Layer 2: token/share metadata + oracle baseToken/quoteToken + oracle type probes (OracleScaler/PTLinear)
  // for both silos – all independent, single multicall.

  interface TokenMetaBatch {
    tokenSymbol?: string
    tokenDecimals?: number
    protectedSymbol?: string
    protectedDecimals?: number
    protectedOffset?: number
    collateralSymbol?: string
    collateralDecimals?: number
    collateralOffset?: number
    debtSymbol?: string
    debtDecimals?: number
    debtOffset?: number
  }

  function pushErc20Meta(
    calls: ReturnType<typeof buildReadMulticallCall<unknown>>[],
    address: string
  ): { symbolIdx: number | null; decimalsIdx: number | null } {
    if (!isNonZeroAddress(address)) return { symbolIdx: null, decimalsIdx: null }
    const symbolIdx = calls.length
    calls.push(
      buildReadMulticallCall({
        target: address,
        abi: erc20InterfaceAbi,
        functionName: 'symbol',
        allowFailure: true
      })
    )
    const decimalsIdx = calls.length
    calls.push(
      buildReadMulticallCall({
        target: address,
        abi: erc20InterfaceAbi,
        functionName: 'decimals',
        allowFailure: true
      })
    )
    return { symbolIdx, decimalsIdx }
  }

  function pushShareOffset(
    calls: ReturnType<typeof buildReadMulticallCall<unknown>>[],
    address: string
  ): number | null {
    if (!isNonZeroAddress(address)) return null
    const idx = calls.length
    calls.push(
      buildReadMulticallCall({
        target: address,
        abi: iShareTokenInterfaceAbi,
        functionName: 'decimalsOffset',
        allowFailure: true
      })
    )
    return idx
  }

  const l2Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []

  const meta0Idx = {
    token: pushErc20Meta(l2Calls, rawConfig0.token),
    protected: pushErc20Meta(l2Calls, rawConfig0.protectedShareToken),
    collateral: pushErc20Meta(l2Calls, rawConfig0.collateralShareToken),
    debt: pushErc20Meta(l2Calls, rawConfig0.debtShareToken),
    protectedOffset: pushShareOffset(l2Calls, rawConfig0.protectedShareToken),
    collateralOffset: pushShareOffset(l2Calls, rawConfig0.collateralShareToken),
    debtOffset: pushShareOffset(l2Calls, rawConfig0.debtShareToken)
  }
  const meta1Idx = {
    token: pushErc20Meta(l2Calls, rawConfig1.token),
    protected: pushErc20Meta(l2Calls, rawConfig1.protectedShareToken),
    collateral: pushErc20Meta(l2Calls, rawConfig1.collateralShareToken),
    debt: pushErc20Meta(l2Calls, rawConfig1.debtShareToken),
    protectedOffset: pushShareOffset(l2Calls, rawConfig1.protectedShareToken),
    collateralOffset: pushShareOffset(l2Calls, rawConfig1.collateralShareToken),
    debtOffset: pushShareOffset(l2Calls, rawConfig1.debtShareToken)
  }

  // Oracle-level reads (for both solvency and maxLtv oracles, deduped)
  const oracleProbeAddresses = new Set<string>()
  for (const c of [rawConfig0, rawConfig1]) {
    if (isNonZeroAddress(c.solvencyOracle)) oracleProbeAddresses.add(ethers.getAddress(c.solvencyOracle))
    if (isNonZeroAddress(c.maxLtvOracle)) oracleProbeAddresses.add(ethers.getAddress(c.maxLtvOracle))
  }

  type OracleProbeIndices = {
    scalerFactor: number
    scalerQuoteToken: number
    ptLinearBaseDiscount: number
    baseToken: number
    quoteToken: number
  }
  const oracleProbeIdx = new Map<string, OracleProbeIndices>()
  for (const oracleAddr of oracleProbeAddresses) {
    const indices: OracleProbeIndices = {
      scalerFactor: l2Calls.length,
      scalerQuoteToken: -1,
      ptLinearBaseDiscount: -1,
      baseToken: -1,
      quoteToken: -1
    }
    l2Calls.push(
      buildReadMulticallCall({
        target: oracleAddr,
        abi: oracleScalerInterfaceAbi,
        functionName: 'SCALE_FACTOR',
        allowFailure: true
      })
    )
    indices.scalerQuoteToken = l2Calls.length
    l2Calls.push(
      buildReadMulticallCall({
        target: oracleAddr,
        abi: oracleScalerInterfaceAbi,
        functionName: 'QUOTE_TOKEN',
        allowFailure: true
      })
    )
    indices.ptLinearBaseDiscount = l2Calls.length
    l2Calls.push(
      buildReadMulticallCall({
        target: oracleAddr,
        abi: ptLinearReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'baseDiscountPerYear',
        allowFailure: true
      })
    )
    indices.baseToken = l2Calls.length
    l2Calls.push(
      buildReadMulticallCall({
        target: oracleAddr,
        abi: oracleAggregatorInterfaceAbi,
        functionName: 'baseToken',
        allowFailure: true
      })
    )
    indices.quoteToken = l2Calls.length
    l2Calls.push(
      buildReadMulticallCall({
        target: oracleAddr,
        abi: siloOracleInterfaceAbi,
        functionName: 'quoteToken',
        allowFailure: true
      })
    )
    oracleProbeIdx.set(toLower(oracleAddr), indices)
  }

  const l2Results = await executeReadMulticall<unknown>(provider, l2Calls)

  const readSymbol = (idx: number | null): string | undefined => {
    if (idx == null) return undefined
    const v = l2Results[idx]
    return v != null ? String(v) : undefined
  }
  const readDecimals = (idx: number | null): number | undefined => {
    if (idx == null) return undefined
    const v = l2Results[idx]
    if (v == null) return undefined
    const num = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(num) ? num : undefined
  }
  const readUint = (idx: number | null): bigint | null => {
    if (idx == null || idx < 0) return null
    const v = l2Results[idx]
    if (v == null) return null
    return typeof v === 'bigint' ? v : BigInt(String(v))
  }
  const readAddress = (idx: number | null): string | null => {
    if (idx == null || idx < 0) return null
    const v = l2Results[idx]
    return normalizeAddressSafe(v)
  }

  const meta0: TokenMetaBatch = {
    tokenSymbol: readSymbol(meta0Idx.token.symbolIdx),
    tokenDecimals: readDecimals(meta0Idx.token.decimalsIdx),
    protectedSymbol: readSymbol(meta0Idx.protected.symbolIdx),
    protectedDecimals: readDecimals(meta0Idx.protected.decimalsIdx),
    protectedOffset: readDecimals(meta0Idx.protectedOffset),
    collateralSymbol: readSymbol(meta0Idx.collateral.symbolIdx),
    collateralDecimals: readDecimals(meta0Idx.collateral.decimalsIdx),
    collateralOffset: readDecimals(meta0Idx.collateralOffset),
    debtSymbol: readSymbol(meta0Idx.debt.symbolIdx),
    debtDecimals: readDecimals(meta0Idx.debt.decimalsIdx),
    debtOffset: readDecimals(meta0Idx.debtOffset)
  }
  const meta1: TokenMetaBatch = {
    tokenSymbol: readSymbol(meta1Idx.token.symbolIdx),
    tokenDecimals: readDecimals(meta1Idx.token.decimalsIdx),
    protectedSymbol: readSymbol(meta1Idx.protected.symbolIdx),
    protectedDecimals: readDecimals(meta1Idx.protected.decimalsIdx),
    protectedOffset: readDecimals(meta1Idx.protectedOffset),
    collateralSymbol: readSymbol(meta1Idx.collateral.symbolIdx),
    collateralDecimals: readDecimals(meta1Idx.collateral.decimalsIdx),
    collateralOffset: readDecimals(meta1Idx.collateralOffset),
    debtSymbol: readSymbol(meta1Idx.debt.symbolIdx),
    debtDecimals: readDecimals(meta1Idx.debt.decimalsIdx),
    debtOffset: readDecimals(meta1Idx.debtOffset)
  }

  // Oracle info (type/config + baseToken/quoteToken)
  const oracleInfoByAddress = new Map<string, OracleInfo>()
  for (const oracleAddrLower of oracleProbeIdx.keys()) {
    const indices = oracleProbeIdx.get(oracleAddrLower)!
    const scaleFactor = readUint(indices.scalerFactor)
    const quoteTokenForScaler = readAddress(indices.scalerQuoteToken)
    const ptLinearDiscount = readUint(indices.ptLinearBaseDiscount)
    const info: OracleInfo = { address: ethers.getAddress(oracleAddrLower) }
    if (scaleFactor != null && quoteTokenForScaler != null) {
      info.type = 'OracleScaler'
      info.config = { scaleFactor: scaleFactor.toString(), quoteToken: quoteTokenForScaler }
    } else if (ptLinearDiscount != null) {
      info.type = 'PTLinear'
      info.config = { baseDiscountPerYear: ptLinearDiscount.toString() }
    }
    const bt = readAddress(indices.baseToken)
    const qt = readAddress(indices.quoteToken)
    if (bt) info.baseTokenAddress = toLower(bt)
    if (qt) info.quoteTokenAddress = toLower(qt)
    oracleInfoByAddress.set(oracleAddrLower, info)
  }

  const cloneOracleInfo = (address: string): OracleInfo => {
    if (!isNonZeroAddress(address)) return { address }
    const base = oracleInfoByAddress.get(toLower(address))
    return base ? { ...base, config: base.config ? { ...base.config } : undefined } : { address }
  }

  const config0: SiloConfig = {
    silo: silo0Address,
    factory: factory0,
    token: rawConfig0.token,
    tokenSymbol: meta0.tokenSymbol,
    tokenDecimals: meta0.tokenDecimals,
    protectedShareToken: rawConfig0.protectedShareToken,
    protectedShareTokenSymbol: meta0.protectedSymbol,
    protectedShareTokenDecimals: meta0.protectedDecimals,
    protectedShareTokenOffset: meta0.protectedOffset,
    collateralShareToken: rawConfig0.collateralShareToken,
    collateralShareTokenSymbol: meta0.collateralSymbol,
    collateralShareTokenDecimals: meta0.collateralDecimals,
    collateralShareTokenOffset: meta0.collateralOffset,
    debtShareToken: rawConfig0.debtShareToken,
    debtShareTokenSymbol: meta0.debtSymbol,
    debtShareTokenDecimals: meta0.debtDecimals,
    debtShareTokenOffset: meta0.debtOffset,
    solvencyOracle: cloneOracleInfo(rawConfig0.solvencyOracle),
    maxLtvOracle: cloneOracleInfo(rawConfig0.maxLtvOracle),
    interestRateModel: { address: rawConfig0.interestRateModel },
    maxLtv: rawConfig0.maxLtv,
    lt: rawConfig0.lt,
    liquidationTargetLtv: rawConfig0.liquidationTargetLtv,
    liquidationFee: rawConfig0.liquidationFee,
    flashloanFee: rawConfig0.flashloanFee,
    daoFee: rawConfig0.daoFee,
    deployerFee: rawConfig0.deployerFee,
    hookReceiver: rawConfig0.hookReceiver,
    callBeforeQuote: rawConfig0.callBeforeQuote
  }
  const config1: SiloConfig = {
    silo: silo1Address,
    factory: factory1,
    token: rawConfig1.token,
    tokenSymbol: meta1.tokenSymbol,
    tokenDecimals: meta1.tokenDecimals,
    protectedShareToken: rawConfig1.protectedShareToken,
    protectedShareTokenSymbol: meta1.protectedSymbol,
    protectedShareTokenDecimals: meta1.protectedDecimals,
    protectedShareTokenOffset: meta1.protectedOffset,
    collateralShareToken: rawConfig1.collateralShareToken,
    collateralShareTokenSymbol: meta1.collateralSymbol,
    collateralShareTokenDecimals: meta1.collateralDecimals,
    collateralShareTokenOffset: meta1.collateralOffset,
    debtShareToken: rawConfig1.debtShareToken,
    debtShareTokenSymbol: meta1.debtSymbol,
    debtShareTokenDecimals: meta1.debtDecimals,
    debtShareTokenOffset: meta1.debtOffset,
    solvencyOracle: cloneOracleInfo(rawConfig1.solvencyOracle),
    maxLtvOracle: cloneOracleInfo(rawConfig1.maxLtvOracle),
    interestRateModel: { address: rawConfig1.interestRateModel },
    maxLtv: rawConfig1.maxLtv,
    lt: rawConfig1.lt,
    liquidationTargetLtv: rawConfig1.liquidationTargetLtv,
    liquidationFee: rawConfig1.liquidationFee,
    flashloanFee: rawConfig1.flashloanFee,
    daoFee: rawConfig1.daoFee,
    deployerFee: rawConfig1.deployerFee,
    hookReceiver: rawConfig1.hookReceiver,
    callBeforeQuote: rawConfig1.callBeforeQuote
  }

  // Layer 3: quote calls (need token decimals from Layer 2) + symbol lookups for base/quote tokens.
  const quoteCalls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []

  const makeOneBaseAmount = (decimals: number | undefined): bigint => {
    const d = Math.max(0, Math.floor(decimals ?? 18))
    return BigInt(`1${'0'.repeat(d)}`)
  }

  interface QuoteIndices {
    solvencyIdx: number | null
    maxLtvIdx: number | null
  }

  const pushQuoteForSilo = (cfg: SiloConfig, rawCfg: SiloConfigTuple): QuoteIndices => {
    const oneBaseAmount = makeOneBaseAmount(cfg.tokenDecimals)
    let solvencyIdx: number | null = null
    let maxLtvIdx: number | null = null
    if (isNonZeroAddress(rawCfg.solvencyOracle)) {
      solvencyIdx = quoteCalls.length
      quoteCalls.push(
        buildReadMulticallCall({
          target: rawCfg.solvencyOracle,
          abi: quoteAbi as unknown as ethers.InterfaceAbi,
          functionName: 'quote',
          args: [oneBaseAmount, rawCfg.token],
          allowFailure: true
        })
      )
    }
    if (
      isNonZeroAddress(rawCfg.maxLtvOracle) &&
      toLower(rawCfg.maxLtvOracle) !== toLower(rawCfg.solvencyOracle ?? '')
    ) {
      maxLtvIdx = quoteCalls.length
      quoteCalls.push(
        buildReadMulticallCall({
          target: rawCfg.maxLtvOracle,
          abi: quoteAbi as unknown as ethers.InterfaceAbi,
          functionName: 'quote',
          args: [oneBaseAmount, rawCfg.token],
          allowFailure: true
        })
      )
    }
    return { solvencyIdx, maxLtvIdx }
  }

  const quoteIdx0 = pushQuoteForSilo(config0, rawConfig0)
  const quoteIdx1 = pushQuoteForSilo(config1, rawConfig1)

  // Also resolve symbol for base/quote token addresses (deduped)
  const tokenSymbolAddresses = new Set<string>()
  for (const oracleInfo of oracleInfoByAddress.values()) {
    if (oracleInfo.baseTokenAddress) tokenSymbolAddresses.add(oracleInfo.baseTokenAddress)
    if (oracleInfo.quoteTokenAddress) tokenSymbolAddresses.add(oracleInfo.quoteTokenAddress)
  }
  const symbolIdxByAddress = new Map<string, number>()
  for (const addr of tokenSymbolAddresses) {
    const idx = quoteCalls.length
    quoteCalls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addr),
        abi: erc20InterfaceAbi,
        functionName: 'symbol',
        allowFailure: true
      })
    )
    symbolIdxByAddress.set(addr, idx)
  }

  const quoteResults = quoteCalls.length > 0 ? await executeReadMulticall<unknown>(provider, quoteCalls) : []

  const readQuote = (idx: number | null): string | undefined => {
    if (idx == null) return undefined
    const v = quoteResults[idx]
    return v != null ? String(v) : undefined
  }
  if (quoteIdx0.solvencyIdx != null) {
    const q = readQuote(quoteIdx0.solvencyIdx)
    if (q != null) config0.solvencyOracle.quotePrice = q
  }
  if (quoteIdx0.maxLtvIdx != null) {
    const q = readQuote(quoteIdx0.maxLtvIdx)
    if (q != null) config0.maxLtvOracle.quotePrice = q
  }
  if (quoteIdx1.solvencyIdx != null) {
    const q = readQuote(quoteIdx1.solvencyIdx)
    if (q != null) config1.solvencyOracle.quotePrice = q
  }
  if (quoteIdx1.maxLtvIdx != null) {
    const q = readQuote(quoteIdx1.maxLtvIdx)
    if (q != null) config1.maxLtvOracle.quotePrice = q
  }

  const symbolByAddress = new Map<string, string>()
  for (const [addr, idx] of symbolIdxByAddress.entries()) {
    const v = quoteResults[idx]
    if (v != null) symbolByAddress.set(addr, String(v))
  }
  const attachOracleSymbols = (oracle: OracleInfo) => {
    if (oracle.baseTokenAddress) {
      const sym = symbolByAddress.get(oracle.baseTokenAddress)
      if (sym) oracle.baseTokenSymbol = sym
    }
    if (oracle.quoteTokenAddress) {
      const sym = symbolByAddress.get(oracle.quoteTokenAddress)
      if (sym) oracle.quoteTokenSymbol = sym
    }
  }
  attachOracleSymbols(config0.solvencyOracle)
  attachOracleSymbols(config0.maxLtvOracle)
  attachOracleSymbols(config1.solvencyOracle)
  attachOracleSymbols(config1.maxLtvOracle)

  // Layer 4: SiloLens bulk version lookup for oracles, IRMs and hooks. Uses existing cache.
  const chainId = (await provider.getNetwork()).chainId.toString()
  const chainName = getChainName(chainId)
  const siloLensAddress = await fetchSiloLensAddress(chainName)
  if (siloLensAddress) {
    const uniqueAddresses = new Set<string>()
    for (const c of [config0, config1]) {
      if (isNonZeroAddress(c.solvencyOracle.address)) uniqueAddresses.add(toLower(c.solvencyOracle.address))
      if (isNonZeroAddress(c.maxLtvOracle.address)) uniqueAddresses.add(toLower(c.maxLtvOracle.address))
      if (isNonZeroAddress(c.interestRateModel.address)) uniqueAddresses.add(toLower(c.interestRateModel.address))
      if (isNonZeroAddress(c.hookReceiver)) uniqueAddresses.add(toLower(c.hookReceiver))
    }
    const addresses = Array.from(uniqueAddresses)
    const versionByAddress = await fetchSiloLensVersionsWithCache({
      provider,
      lensAddress: siloLensAddress,
      chainId,
      addresses
    })
    const getVersion = (address: string) => versionByAddress.get(toLower(address)) ?? undefined
    config0.solvencyOracle.version = getVersion(config0.solvencyOracle.address)
    config0.maxLtvOracle.version = getVersion(config0.maxLtvOracle.address)
    config0.interestRateModel.version = getVersion(config0.interestRateModel.address)
    config0.hookReceiverVersion = getVersion(config0.hookReceiver)
    config1.solvencyOracle.version = getVersion(config1.solvencyOracle.address)
    config1.maxLtvOracle.version = getVersion(config1.maxLtvOracle.address)
    config1.interestRateModel.version = getVersion(config1.interestRateModel.address)
    config1.hookReceiverVersion = getVersion(config1.hookReceiver)
  }

  const getIrmTypeFromVersion = (version: string | undefined): string | undefined => {
    if (!version) return undefined
    const [contractName] = version.split(' ')
    if (contractName === 'DynamicKinkModel') return 'DynamicKinkModel'
    return undefined
  }
  config0.interestRateModel.type =
    config0.interestRateModel.type ?? getIrmTypeFromVersion(config0.interestRateModel.version)
  config1.interestRateModel.type =
    config1.interestRateModel.type ?? getIrmTypeFromVersion(config1.interestRateModel.version)

  // Layer 5: DynamicKink IRM config fetch (both silos' IRMs in one multicall when applicable).
  await Promise.all([
    fetchIRMInfoInto(provider, config0.interestRateModel),
    fetchIRMInfoInto(provider, config1.interestRateModel)
  ])

  // Layer 6: owners (hook + IRM(kink) + ManageableOracle triple) – one multicall for all of them.
  const uniqueHooks = new Set<string>()
  for (const c of [config0, config1]) {
    if (isNonZeroAddress(c.hookReceiver)) uniqueHooks.add(toLower(c.hookReceiver))
  }
  const uniqueKinkIrms = new Set<string>()
  const isKinkByVersion = (v: string | undefined) => v != null && v !== '' && v.toLowerCase().includes('kink')
  for (const c of [config0, config1]) {
    if (isNonZeroAddress(c.interestRateModel.address) && isKinkByVersion(c.interestRateModel.version)) {
      uniqueKinkIrms.add(toLower(c.interestRateModel.address))
    }
  }
  const uniqueManageable = new Set<string>()
  const isManageableOracleByVersion = (v: string | undefined) =>
    v != null && v !== '' && v.toLowerCase().includes('manageableoracle')
  for (const c of [config0, config1]) {
    if (isNonZeroAddress(c.solvencyOracle.address) && isManageableOracleByVersion(c.solvencyOracle.version)) {
      uniqueManageable.add(toLower(c.solvencyOracle.address))
    }
    if (isNonZeroAddress(c.maxLtvOracle.address) && isManageableOracleByVersion(c.maxLtvOracle.version)) {
      uniqueManageable.add(toLower(c.maxLtvOracle.address))
    }
  }

  const ownerCalls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  const hookOwnerIdx = new Map<string, number>()
  for (const hookLower of uniqueHooks) {
    hookOwnerIdx.set(hookLower, ownerCalls.length)
    ownerCalls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(hookLower),
        abi: ownerReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'owner',
        allowFailure: true
      })
    )
  }
  const irmOwnerIdx = new Map<string, number>()
  for (const irmLower of uniqueKinkIrms) {
    irmOwnerIdx.set(irmLower, ownerCalls.length)
    ownerCalls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(irmLower),
        abi: ownerReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'owner',
        allowFailure: true
      })
    )
  }
  const manageableIdx = new Map<string, { owner: number; oracle: number; timelock: number }>()
  for (const mLower of uniqueManageable) {
    const indices = {
      owner: ownerCalls.length,
      oracle: -1,
      timelock: -1
    }
    ownerCalls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(mLower),
        abi: manageableOracleReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'owner',
        allowFailure: true
      })
    )
    indices.oracle = ownerCalls.length
    ownerCalls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(mLower),
        abi: manageableOracleReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'oracle',
        allowFailure: true
      })
    )
    indices.timelock = ownerCalls.length
    ownerCalls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(mLower),
        abi: manageableOracleReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'timelock',
        allowFailure: true
      })
    )
    manageableIdx.set(mLower, indices)
  }

  const ownerResults = ownerCalls.length > 0 ? await executeReadMulticall<unknown>(provider, ownerCalls) : []
  const pickAddress = (idx: number): string | undefined => {
    const v = ownerResults[idx]
    const addr = normalizeAddressSafe(v)
    return addr && addr !== ethers.ZeroAddress ? addr : undefined
  }

  const hookOwnerByAddress = new Map<string, string>()
  for (const [hookLower, idx] of hookOwnerIdx) {
    const owner = pickAddress(idx)
    if (owner) hookOwnerByAddress.set(hookLower, owner)
  }
  const irmOwnerByAddress = new Map<string, string>()
  for (const [irmLower, idx] of irmOwnerIdx) {
    const owner = pickAddress(idx)
    if (owner) irmOwnerByAddress.set(irmLower, owner)
  }
  const oracleOwnerByAddress = new Map<string, string>()
  const underlyingByManageable = new Map<string, string>()
  const timelockByManageable = new Map<string, number>()
  for (const [mLower, indices] of manageableIdx) {
    const owner = pickAddress(indices.owner)
    if (owner) oracleOwnerByAddress.set(mLower, owner)
    const underlying = pickAddress(indices.oracle)
    if (underlying) underlyingByManageable.set(mLower, underlying)
    const timelockRaw = ownerResults[indices.timelock]
    if (timelockRaw != null) {
      const n = Number(timelockRaw)
      if (Number.isFinite(n)) timelockByManageable.set(mLower, n)
    }
  }

  const getHookOwner = (address: string) => (address ? hookOwnerByAddress.get(toLower(address)) : undefined)
  config0.hookReceiverOwner = getHookOwner(config0.hookReceiver)
  config1.hookReceiverOwner = getHookOwner(config1.hookReceiver)

  const getIrmOwner = (address: string, version: string | undefined) =>
    address && isKinkByVersion(version) ? irmOwnerByAddress.get(toLower(address)) : undefined
  config0.interestRateModel.owner = getIrmOwner(config0.interestRateModel.address, config0.interestRateModel.version)
  config1.interestRateModel.owner = getIrmOwner(config1.interestRateModel.address, config1.interestRateModel.version)

  const getOracleOwner = (address: string, version: string | undefined) =>
    address && isManageableOracleByVersion(version) ? oracleOwnerByAddress.get(toLower(address)) : undefined
  const getOracleTimelock = (address: string, version: string | undefined) =>
    address && isManageableOracleByVersion(version) ? timelockByManageable.get(toLower(address)) : undefined
  config0.solvencyOracle.owner = getOracleOwner(config0.solvencyOracle.address, config0.solvencyOracle.version)
  config0.solvencyOracle.timelockSeconds = getOracleTimelock(config0.solvencyOracle.address, config0.solvencyOracle.version)
  config1.solvencyOracle.owner = getOracleOwner(config1.solvencyOracle.address, config1.solvencyOracle.version)
  config1.solvencyOracle.timelockSeconds = getOracleTimelock(config1.solvencyOracle.address, config1.solvencyOracle.version)
  config0.maxLtvOracle.owner = getOracleOwner(config0.maxLtvOracle.address, config0.maxLtvOracle.version)
  config0.maxLtvOracle.timelockSeconds = getOracleTimelock(config0.maxLtvOracle.address, config0.maxLtvOracle.version)
  config1.maxLtvOracle.owner = getOracleOwner(config1.maxLtvOracle.address, config1.maxLtvOracle.version)
  config1.maxLtvOracle.timelockSeconds = getOracleTimelock(config1.maxLtvOracle.address, config1.maxLtvOracle.version)

  // Layer 7: underlying oracle versions via Silo Lens (ManageableOracle only).
  if (siloLensAddress && underlyingByManageable.size > 0) {
    const underlyingAddresses = Array.from(
      new Set(Array.from(underlyingByManageable.values()).map((a) => toLower(a)))
    )
    if (underlyingAddresses.length > 0) {
      const versionByUnderlying = await fetchSiloLensVersionsWithCache({
        provider,
        lensAddress: siloLensAddress,
        chainId,
        addresses: underlyingAddresses
      })
      const setUnderlying = (oracle: OracleInfo) => {
        const key = oracle.address?.toLowerCase?.() ?? ''
        const underlyingAddr = underlyingByManageable.get(key)
        if (underlyingAddr) {
          oracle.underlying = {
            address: underlyingAddr,
            version: versionByUnderlying.get(toLower(underlyingAddr)) ?? undefined
          }
        }
      }
      setUnderlying(config0.solvencyOracle)
      setUnderlying(config1.solvencyOracle)
      setUnderlying(config0.maxLtvOracle)
      setUnderlying(config1.maxLtvOracle)
    }
  }

  // Layer 8: Chainlink enrichment – 2 dependent multicalls.
  await enrichChainlinkOracles(provider, [
    config0.solvencyOracle,
    config1.solvencyOracle,
    config0.maxLtvOracle,
    config1.maxLtvOracle
  ])

  // Layer 9: PTLinear enrichment (batched)
  await enrichPTLinearOracles(provider, [
    config0.solvencyOracle,
    config1.solvencyOracle,
    config0.maxLtvOracle,
    config1.maxLtvOracle
  ])

  // Layer 10: CustomMethodOracle enrichment (batched).
  await enrichCustomMethodOracles(provider, [
    config0.solvencyOracle,
    config1.solvencyOracle,
    config0.maxLtvOracle,
    config1.maxLtvOracle
  ])

  // Layer 11: SupraSValueOracle enrichment (batched).
  await enrichSupraSValueOracles(provider, [
    config0.solvencyOracle,
    config1.solvencyOracle,
    config0.maxLtvOracle,
    config1.maxLtvOracle
  ])

  // Layer 12: ERC4626OracleHardcodeQuote check (batched).
  await enrichErc4626VaultChecks(provider, [
    config0.solvencyOracle,
    config1.solvencyOracle,
    config0.maxLtvOracle,
    config1.maxLtvOracle
  ])

  // Layer 13: Owner meta (isContract via getCode + JSON name).
  await resolveOwnerMeta(provider, chainId, config0, config1)

  return {
    siloConfig: siloConfigAddress,
    siloId,
    silo0: config0,
    silo1: config1
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchIRMInfoInto(provider: ethers.Provider, irm: IRMInfo): Promise<void> {
  if (!isNonZeroAddress(irm.address) || !irm.version) return
  const [contractName] = irm.version.split(' ')
  if (contractName !== 'DynamicKinkModel') return

  try {
    const [modelStateResult, irmConfigResult] = await executeReadMulticall<unknown>(provider, [
      buildReadMulticallCall({
        target: irm.address,
        abi: dynamicKinkModelInterfaceAbi,
        functionName: 'getModelStateAndConfig',
        args: [false],
        allowFailure: true
      }),
      buildReadMulticallCall({
        target: irm.address,
        abi: dynamicKinkModelInterfaceAbi,
        functionName: 'irmConfig',
        allowFailure: true
      })
    ])
    if (modelStateResult == null) return
    const tuple = modelStateResult as unknown[]
    const config = tuple[1] as Record<string, unknown>
    const immutableConfig = tuple[2] as Record<string, unknown>
    const cfg = {
      ulow: String((config as Record<string, { toString: () => string }>).ulow),
      u1: String((config as Record<string, { toString: () => string }>).u1),
      u2: String((config as Record<string, { toString: () => string }>).u2),
      ucrit: String((config as Record<string, { toString: () => string }>).ucrit),
      rmin: String((config as Record<string, { toString: () => string }>).rmin),
      kmin: String((config as Record<string, { toString: () => string }>).kmin),
      kmax: String((config as Record<string, { toString: () => string }>).kmax),
      alpha: String((config as Record<string, { toString: () => string }>).alpha),
      cminus: String((config as Record<string, { toString: () => string }>).cminus),
      cplus: String((config as Record<string, { toString: () => string }>).cplus),
      c1: String((config as Record<string, { toString: () => string }>).c1),
      c2: String((config as Record<string, { toString: () => string }>).c2),
      dmax: String((config as Record<string, { toString: () => string }>).dmax),
      timelock: String((immutableConfig as Record<string, { toString: () => string }>).timelock),
      rcompCapPerSecond: String((immutableConfig as Record<string, { toString: () => string }>).rcompCapPerSecond)
    }
    irm.type = 'DynamicKinkModel'
    irm.config = cfg
    let irmConfigAddr: string | null = null
    if (irmConfigResult != null) {
      if (typeof irmConfigResult === 'object' && irmConfigResult !== null && 'config' in irmConfigResult) {
        irmConfigAddr = normalizeAddressSafe((irmConfigResult as { config: unknown }).config)
      } else {
        irmConfigAddr = normalizeAddressSafe(irmConfigResult)
      }
    }
    if (irmConfigAddr && irmConfigAddr !== ethers.ZeroAddress) {
      irm.irmConfigAddress = irmConfigAddr
    }
  } catch {
    // best-effort
  }
}

async function enrichChainlinkOracles(provider: ethers.Provider, oracles: OracleInfo[]): Promise<void> {
  interface Target {
    oracle: OracleInfo
    chainlinkAddress: string
  }
  const targets: Target[] = []
  for (const oracle of oracles) {
    if (isChainlinkOracleByVersion(oracle.version)) {
      targets.push({ oracle, chainlinkAddress: oracle.address })
    } else if (oracle.underlying && isChainlinkOracleByVersion(oracle.underlying.version)) {
      targets.push({ oracle, chainlinkAddress: oracle.underlying.address })
    }
  }
  if (targets.length === 0) return

  const uniqueChainlink = new Map<string, number>()
  const l1Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const t of targets) {
    const lower = toLower(t.chainlinkAddress)
    if (uniqueChainlink.has(lower)) continue
    uniqueChainlink.set(lower, l1Calls.length)
    l1Calls.push(
      buildReadMulticallCall({
        target: t.chainlinkAddress,
        abi: chainlinkV3OracleInterfaceAbi,
        functionName: 'oracleConfig',
        allowFailure: true
      })
    )
  }
  const l1Results = await executeReadMulticall<unknown>(provider, l1Calls)

  const configAddressByChainlink = new Map<string, string>()
  for (const [lower, idx] of uniqueChainlink) {
    const addr = normalizeAddressSafe(l1Results[idx])
    if (addr && addr !== ethers.ZeroAddress) configAddressByChainlink.set(lower, addr)
  }

  const uniqueConfigAddrs = Array.from(new Set(configAddressByChainlink.values()))
  if (uniqueConfigAddrs.length === 0) return

  const configIdx = new Map<string, number>()
  const l2Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const cfgAddr of uniqueConfigAddrs) {
    configIdx.set(toLower(cfgAddr), l2Calls.length)
    l2Calls.push(
      buildReadMulticallCall({
        target: cfgAddr,
        abi: chainlinkOracleConfigInterfaceAbi,
        functionName: 'getConfig',
        allowFailure: true
      })
    )
  }
  const l2Results = await executeReadMulticall<unknown>(provider, l2Calls)

  type ChainlinkConfigDto = {
    primaryAggregator?: string
    secondaryAggregator?: string
    primaryHeartbeat?: unknown
    secondaryHeartbeat?: unknown
    normalizationDivider?: unknown
    normalizationMultiplier?: unknown
    baseToken?: unknown
    quoteToken?: unknown
    convertToQuote?: unknown
    invertSecondPrice?: unknown
  }

  const rawConfigByAddress = new Map<string, ChainlinkConfigDto>()
  for (const [lower, idx] of configIdx) {
    const v = l2Results[idx]
    if (v != null) rawConfigByAddress.set(lower, v as ChainlinkConfigDto)
  }

  // Layer 3: description() for all primary/secondary aggregators that are non-zero.
  const uniqueAggregators = new Set<string>()
  Array.from(rawConfigByAddress.values()).forEach((cfg) => {
    if (cfg.primaryAggregator && isNonZeroAddress(cfg.primaryAggregator)) {
      uniqueAggregators.add(toLower(cfg.primaryAggregator))
    }
    if (cfg.secondaryAggregator && isNonZeroAddress(cfg.secondaryAggregator)) {
      uniqueAggregators.add(toLower(cfg.secondaryAggregator))
    }
  })
  const aggregatorDescIdx = new Map<string, number>()
  const l3Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  Array.from(uniqueAggregators).forEach((aggLower) => {
    aggregatorDescIdx.set(aggLower, l3Calls.length)
    l3Calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(aggLower),
        abi: aggregatorV3Abi,
        functionName: 'description',
        allowFailure: true
      })
    )
  })
  const l3Results = l3Calls.length > 0 ? await executeReadMulticall<unknown>(provider, l3Calls) : []
  const descriptionByAggregator = new Map<string, string>()
  Array.from(aggregatorDescIdx.entries()).forEach(([aggLower, idx]) => {
    const v = l3Results[idx]
    if (v != null) descriptionByAggregator.set(aggLower, String(v))
  })

  for (const t of targets) {
    const cfgAddr = configAddressByChainlink.get(toLower(t.chainlinkAddress))
    if (!cfgAddr) continue
    const rawCfg = rawConfigByAddress.get(toLower(cfgAddr))
    if (!rawCfg) continue

    const primaryAggregator =
      typeof rawCfg.primaryAggregator === 'string' && isNonZeroAddress(rawCfg.primaryAggregator)
        ? rawCfg.primaryAggregator
        : undefined
    const secondaryAggregator =
      typeof rawCfg.secondaryAggregator === 'string' && isNonZeroAddress(rawCfg.secondaryAggregator)
        ? rawCfg.secondaryAggregator
        : undefined

    const baseConfig: Record<string, unknown> = {
      ...(t.oracle.config ?? {}),
      configAddress: cfgAddr,
      primaryHeartbeat: rawCfg.primaryHeartbeat != null ? String(rawCfg.primaryHeartbeat) : undefined,
      secondaryHeartbeat: rawCfg.secondaryHeartbeat != null ? String(rawCfg.secondaryHeartbeat) : undefined,
      normalizationDivider: rawCfg.normalizationDivider != null ? String(rawCfg.normalizationDivider) : undefined,
      normalizationMultiplier:
        rawCfg.normalizationMultiplier != null ? String(rawCfg.normalizationMultiplier) : undefined,
      baseToken: rawCfg.baseToken,
      quoteToken: rawCfg.quoteToken,
      convertToQuote: rawCfg.convertToQuote,
      invertSecondPrice: rawCfg.invertSecondPrice
    }
    const chainlinkExtras: Record<string, unknown> = {}
    if (primaryAggregator) {
      chainlinkExtras.primaryAggregator = primaryAggregator
      const desc = descriptionByAggregator.get(toLower(primaryAggregator))
      if (desc != null) chainlinkExtras.primaryAggregatorDescription = desc
    }
    if (secondaryAggregator) {
      chainlinkExtras.secondaryAggregator = secondaryAggregator
      const desc = descriptionByAggregator.get(toLower(secondaryAggregator))
      if (desc != null) chainlinkExtras.secondaryAggregatorDescription = desc
    } else {
      chainlinkExtras.secondaryAggregatorDescription = 'Secondary aggregator: empty'
    }
    t.oracle.config = { ...baseConfig, ...chainlinkExtras }
  }
}

async function enrichPTLinearOracles(provider: ethers.Provider, oracles: OracleInfo[]): Promise<void> {
  interface Target {
    oracle: OracleInfo
    address: string
  }
  const targets: Target[] = []
  for (const oracle of oracles) {
    if (isPTLinearOracleByVersion(oracle.version)) {
      targets.push({ oracle, address: oracle.address })
    } else if (oracle.underlying && isPTLinearOracleByVersion(oracle.underlying.version)) {
      targets.push({ oracle, address: oracle.underlying.address })
    }
  }
  if (targets.length === 0) return
  const uniqueAddr = new Map<string, number>()
  const calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const t of targets) {
    const lower = toLower(t.address)
    if (uniqueAddr.has(lower)) continue
    uniqueAddr.set(lower, calls.length)
    calls.push(
      buildReadMulticallCall({
        target: t.address,
        abi: ptLinearReadAbi as unknown as ethers.InterfaceAbi,
        functionName: 'baseDiscountPerYear',
        allowFailure: true
      })
    )
  }
  const results = await executeReadMulticall<unknown>(provider, calls)
  for (const t of targets) {
    const idx = uniqueAddr.get(toLower(t.address))
    if (idx == null) continue
    const raw = results[idx]
    if (raw == null) continue
    t.oracle.type = 'PTLinear'
    t.oracle.config = {
      ...(t.oracle.config ?? {}),
      baseDiscountPerYear: raw.toString()
    }
  }
}

async function enrichCustomMethodOracles(provider: ethers.Provider, oracles: OracleInfo[]): Promise<void> {
  interface Target {
    oracle: OracleInfo
    address: string
  }
  const targets: Target[] = []
  for (const oracle of oracles) {
    if (isCustomMethodOracleByVersion(oracle.version)) {
      targets.push({ oracle, address: oracle.address })
    } else if (oracle.underlying && isCustomMethodOracleByVersion(oracle.underlying.version)) {
      targets.push({ oracle, address: oracle.underlying.address })
    }
  }
  if (targets.length === 0) return

  const uniqueAddresses = Array.from(new Set(targets.map((t) => toLower(t.address))))
  const indices = new Map<string, { config: number; readPrice: number; method: number }>()
  const calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const addr of uniqueAddresses) {
    const ix = {
      config: calls.length,
      readPrice: -1,
      method: -1
    }
    calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addr),
        abi: customMethodOracleReadAbi,
        functionName: 'getConfig',
        allowFailure: true
      })
    )
    ix.readPrice = calls.length
    calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addr),
        abi: customMethodOracleReadAbi,
        functionName: 'readPrice',
        allowFailure: true
      })
    )
    ix.method = calls.length
    calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addr),
        abi: customMethodOracleReadAbi,
        functionName: 'methodSignature',
        allowFailure: true
      })
    )
    indices.set(addr, ix)
  }
  const results = await executeReadMulticall<unknown>(provider, calls)

  for (const t of targets) {
    const ix = indices.get(toLower(t.address))
    if (!ix) continue
    const cfg = results[ix.config] as Record<string, unknown> | null | undefined
    const targetAddress = typeof cfg?.target === 'string' ? cfg.target : undefined
    const readPriceRaw = results[ix.readPrice]
    const methodSignatureRaw = results[ix.method]
    t.oracle.type = 'CustomMethodOracle'
    t.oracle.config = {
      ...(t.oracle.config ?? {}),
      target:
        targetAddress && ethers.isAddress(targetAddress) && targetAddress !== ethers.ZeroAddress
          ? targetAddress
          : undefined,
      rawPrice: readPriceRaw != null ? readPriceRaw.toString() : undefined,
      methodSignature: methodSignatureRaw != null ? String(methodSignatureRaw) : undefined
    }
  }
}

async function enrichSupraSValueOracles(provider: ethers.Provider, oracles: OracleInfo[]): Promise<void> {
  interface Target {
    oracle: OracleInfo
    address: string
  }
  const targets: Target[] = []
  for (const oracle of oracles) {
    if (isSupraSValueOracleByVersion(oracle.version)) {
      targets.push({ oracle, address: oracle.address })
    } else if (oracle.underlying && isSupraSValueOracleByVersion(oracle.underlying.version)) {
      targets.push({ oracle, address: oracle.underlying.address })
    }
  }
  if (targets.length === 0) return

  const uniqueAddresses = Array.from(new Set(targets.map((t) => toLower(t.address))))
  const indices = new Map<string, number>()
  const calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const addr of uniqueAddresses) {
    indices.set(addr, calls.length)
    calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addr),
        abi: supraSValueOracleInterfaceAbi,
        functionName: 'getConfig',
        allowFailure: true
      })
    )
  }
  const results = await executeReadMulticall<unknown>(provider, calls)
  for (const t of targets) {
    const idx = indices.get(toLower(t.address))
    if (idx == null) continue
    const cfg = results[idx] as Record<string, unknown> | null | undefined
    const pairId = cfg?.pairId
    t.oracle.type = 'SupraSValueOracle'
    t.oracle.config = {
      ...(t.oracle.config ?? {}),
      pairId: pairId != null ? pairId.toString() : undefined
    }
  }
}

async function enrichErc4626VaultChecks(provider: ethers.Provider, oracles: OracleInfo[]): Promise<void> {
  const uniqueOracleAddresses = new Set<string>()
  const oracleByLower = new Map<string, OracleInfo[]>()
  for (const oracle of oracles) {
    const addr = getErc4626OracleHardcodeQuoteContractAddress(oracle)
    if (!addr) continue
    const lower = toLower(addr)
    uniqueOracleAddresses.add(lower)
    const list = oracleByLower.get(lower) ?? []
    list.push(oracle)
    oracleByLower.set(lower, list)
  }
  if (uniqueOracleAddresses.size === 0) return

  const oracleAddresses = Array.from(uniqueOracleAddresses)
  const oracleIdx = new Map<string, { quote: number; vault: number }>()
  const l1Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const addrLower of oracleAddresses) {
    const ix = { quote: l1Calls.length, vault: -1 }
    l1Calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addrLower),
        abi: erc4626OracleHardcodeQuoteAbi,
        functionName: 'quoteToken',
        allowFailure: true
      })
    )
    ix.vault = l1Calls.length
    l1Calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(addrLower),
        abi: erc4626OracleQuoteAndVaultAbi as unknown as ethers.InterfaceAbi,
        functionName: 'VAULT',
        allowFailure: true
      })
    )
    oracleIdx.set(addrLower, ix)
  }
  const l1Results = await executeReadMulticall<unknown>(provider, l1Calls)

  const quoteTokenByOracle = new Map<string, string>()
  const vaultByOracle = new Map<string, string>()
  for (const [addrLower, ix] of oracleIdx) {
    const qt = normalizeAddressSafe(l1Results[ix.quote])
    if (qt && qt !== ethers.ZeroAddress) quoteTokenByOracle.set(addrLower, qt)
    const vault = normalizeAddressSafe(l1Results[ix.vault])
    if (vault && vault !== ethers.ZeroAddress) vaultByOracle.set(addrLower, vault)
  }

  const uniqueVaults = Array.from(new Set(Array.from(vaultByOracle.values()).map((v) => toLower(v))))
  const vaultAssetIdx = new Map<string, number>()
  const l2Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const vaultLower of uniqueVaults) {
    vaultAssetIdx.set(vaultLower, l2Calls.length)
    l2Calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(vaultLower),
        abi: ierc4626VaultAbi,
        functionName: 'asset',
        allowFailure: true
      })
    )
  }
  const l2Results = l2Calls.length > 0 ? await executeReadMulticall<unknown>(provider, l2Calls) : []
  const assetByVault = new Map<string, string>()
  for (const [vaultLower, idx] of vaultAssetIdx) {
    const asset = normalizeAddressSafe(l2Results[idx])
    if (asset && asset !== ethers.ZeroAddress) assetByVault.set(vaultLower, asset)
  }

  // Symbols for quote + asset tokens.
  const tokenLowerSet = new Set<string>()
  for (const qt of quoteTokenByOracle.values()) tokenLowerSet.add(toLower(qt))
  for (const asset of assetByVault.values()) tokenLowerSet.add(toLower(asset))
  const symbolIdx = new Map<string, number>()
  const l3Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
  for (const tLower of tokenLowerSet) {
    symbolIdx.set(tLower, l3Calls.length)
    l3Calls.push(
      buildReadMulticallCall({
        target: ethers.getAddress(tLower),
        abi: erc20InterfaceAbi,
        functionName: 'symbol',
        allowFailure: true
      })
    )
  }
  const l3Results = l3Calls.length > 0 ? await executeReadMulticall<unknown>(provider, l3Calls) : []
  const symbolByToken = new Map<string, string>()
  for (const [tLower, idx] of symbolIdx) {
    const v = l3Results[idx]
    if (v != null) symbolByToken.set(tLower, String(v))
  }

  for (const [oracleLower, oracleList] of oracleByLower) {
    const quote = quoteTokenByOracle.get(oracleLower)
    if (!quote) {
      const check: Erc4626VaultQuoteCheck = { match: null, error: 'Could not read oracle quoteToken().' }
      for (const oracle of oracleList) oracle.erc4626VaultQuoteCheck = check
      continue
    }
    const vault = vaultByOracle.get(oracleLower)
    if (!vault) {
      const check: Erc4626VaultQuoteCheck = {
        match: null,
        quoteTokenAddress: ethers.getAddress(quote),
        error: 'Could not read oracle VAULT().'
      }
      for (const oracle of oracleList) oracle.erc4626VaultQuoteCheck = check
      continue
    }
    const asset = assetByVault.get(toLower(vault))
    if (!asset) {
      const check: Erc4626VaultQuoteCheck = {
        match: null,
        quoteTokenAddress: ethers.getAddress(quote),
        error: 'Could not read vault asset().'
      }
      for (const oracle of oracleList) oracle.erc4626VaultQuoteCheck = check
      continue
    }
    const quoteNorm = ethers.getAddress(quote)
    const assetNorm = ethers.getAddress(asset)
    const match = toLower(quoteNorm) === toLower(assetNorm)
    const check: Erc4626VaultQuoteCheck = {
      match,
      vaultAssetAddress: assetNorm,
      quoteTokenAddress: quoteNorm,
      vaultAssetSymbol: symbolByToken.get(toLower(assetNorm)),
      quoteTokenSymbol: symbolByToken.get(toLower(quoteNorm))
    }
    for (const oracle of oracleList) oracle.erc4626VaultQuoteCheck = check
  }
}

async function resolveOwnerMeta(
  provider: ethers.Provider,
  chainId: string,
  config0: SiloConfig,
  config1: SiloConfig
): Promise<void> {
  const allOwnerAddresses = new Set<string>()
  for (const owner of [
    config0.hookReceiverOwner,
    config1.hookReceiverOwner,
    config0.interestRateModel.owner,
    config1.interestRateModel.owner,
    config0.solvencyOracle.owner,
    config1.solvencyOracle.owner,
    config0.maxLtvOracle.owner,
    config1.maxLtvOracle.owner
  ]) {
    if (owner && owner !== ethers.ZeroAddress) allOwnerAddresses.add(toLower(owner))
  }
  const addressToName = new Map<string, string>()
  try {
    const chainNameForAddresses = getChainNameForAddresses(chainId)
    const res = await fetch(`${ADDRESSES_JSON_BASE}/${chainNameForAddresses}.json`)
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>
      for (const [name, addr] of Object.entries(data)) {
        if (typeof addr === 'string' && addr.startsWith('0x')) addressToName.set(addr.toLowerCase(), name)
      }
    }
  } catch {
    // ignore
  }

  // eth_getCode is not part of Multicall3 aggregate3; keep as parallel RPCs (deduplicated).
  const ownerMetaByAddress = new Map<string, { isContract: boolean; name?: string }>()
  await Promise.all(
    Array.from(allOwnerAddresses).map(async (addr) => {
      const code = await provider.getCode(addr)
      const isContract = code !== '0x' && code !== '0x0'
      const name = addressToName.get(addr)
      ownerMetaByAddress.set(addr, { isContract, name })
    })
  )
  const getOwnerMeta = (address: string) => (address ? ownerMetaByAddress.get(toLower(address)) : undefined)
  const applyMeta = (
    owner: string | undefined,
    setIsContract: (v: boolean) => void,
    setName: (v: string | undefined) => void
  ) => {
    const m = owner ? getOwnerMeta(owner) : undefined
    if (!m) return
    setIsContract(m.isContract)
    setName(m.name)
  }

  applyMeta(
    config0.hookReceiverOwner,
    (v) => (config0.hookReceiverOwnerIsContract = v),
    (v) => (config0.hookReceiverOwnerName = v)
  )
  applyMeta(
    config1.hookReceiverOwner,
    (v) => (config1.hookReceiverOwnerIsContract = v),
    (v) => (config1.hookReceiverOwnerName = v)
  )
  applyMeta(
    config0.interestRateModel.owner,
    (v) => (config0.interestRateModel.ownerIsContract = v),
    (v) => (config0.interestRateModel.ownerName = v)
  )
  applyMeta(
    config1.interestRateModel.owner,
    (v) => (config1.interestRateModel.ownerIsContract = v),
    (v) => (config1.interestRateModel.ownerName = v)
  )
  applyMeta(
    config0.solvencyOracle.owner,
    (v) => (config0.solvencyOracle.ownerIsContract = v),
    (v) => (config0.solvencyOracle.ownerName = v)
  )
  applyMeta(
    config1.solvencyOracle.owner,
    (v) => (config1.solvencyOracle.ownerIsContract = v),
    (v) => (config1.solvencyOracle.ownerName = v)
  )
  applyMeta(
    config0.maxLtvOracle.owner,
    (v) => (config0.maxLtvOracle.ownerIsContract = v),
    (v) => (config0.maxLtvOracle.ownerName = v)
  )
  applyMeta(
    config1.maxLtvOracle.owner,
    (v) => (config1.maxLtvOracle.ownerIsContract = v),
    (v) => (config1.maxLtvOracle.ownerName = v)
  )
}

function isChainlinkOracleByVersion(version: string | undefined): boolean {
  if (!version) return false
  const [name] = version.split(' ')
  return name === 'ChainlinkV3Oracle'
}

function isPTLinearOracleByVersion(version: string | undefined): boolean {
  if (!version) return false
  const v = version.toLowerCase()
  return v.includes('ptlinear') || v.includes('pt-linear')
}

function isCustomMethodOracleByVersion(version: string | undefined): boolean {
  if (!version) return false
  const v = version.toLowerCase()
  return v.includes('custommethodoracle') || v.includes('custom method oracle')
}

function isSupraSValueOracleByVersion(version: string | undefined): boolean {
  if (!version) return false
  const v = version.toLowerCase()
  return v.includes('suprasvalueoracle') || v.includes('supra s-value oracle')
}

export function isErc4626OracleHardcodeQuoteByVersion(version: string | undefined): boolean {
  if (!version) return false
  return version.toLowerCase().includes('erc4626oraclehardcodequote')
}

function getErc4626OracleHardcodeQuoteContractAddress(oracle: OracleInfo): string | null {
  if (isNonZeroAddress(oracle.address) && isErc4626OracleHardcodeQuoteByVersion(oracle.version)) {
    try {
      return ethers.getAddress(oracle.address)
    } catch {
      return null
    }
  }
  const u = oracle.underlying
  if (u?.address && isErc4626OracleHardcodeQuoteByVersion(u.version)) {
    try {
      return ethers.getAddress(u.address)
    } catch {
      return null
    }
  }
  return null
}

export function formatPercentage(value: bigint): string {
  const percentage = Number(value) / Number(BigInt(10 ** 16))
  return `${percentage.toFixed(2)}%`
}

export function formatAddress(address: string): string {
  if (!address || address === ethers.ZeroAddress) return 'Zero Address'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/** Format raw quote amount as string with 18 decimal places */
export function formatQuotePriceAs18Decimals(quotePriceRaw: string): string {
  const v = BigInt(quotePriceRaw)
  const div = BigInt(10 ** 18)
  const intPart = v / div
  const fracPart = (v % div).toString().padStart(18, '0').replace(/0+$/, '') || '0'
  return fracPart ? `${intPart}.${fracPart}` : String(intPart)
}

/** Format raw 18-decimal rate (1e18 = 100%) as percentage with exactly 18 decimal places */
export function formatRate18AsPercent(raw: string): string {
  const v = BigInt(raw)
  const e18 = BigInt(10 ** 18)
  const scaled = v * BigInt(100)
  const intPart = scaled / e18
  const fracPart = (scaled % e18).toString().padStart(18, '0')
  const decimalStr = `${intPart}.${fracPart}`
  return `${decimalStr} %`
}
