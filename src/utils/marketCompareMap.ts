import { ethers } from 'ethers'
import {
  formatPercentage,
  formatQuotePriceAs18Decimals,
  type MarketConfig,
  type OracleInfo
} from '@/utils/fetchMarketConfig'
import { formatBigIntToE18 } from '@/utils/formatting'
import { type HookGaugeInfo } from '@/utils/fetchVerificationAux'

export type MarketCompareEntry = { match: boolean; otherDisplay: string }
export type MarketCompareMap = Map<string, MarketCompareEntry>

export type BuildMarketCompareMapParams = {
  currentConfig: MarketConfig
  otherConfig: MarketConfig
  addressVersions?: Map<string, string>
  manageableOracleTimelockSeconds?: number
  currentHookGaugeInfo?: HookGaugeInfo
  otherHookGaugeInfo?: HookGaugeInfo
  currentIrmConfigNames?: { silo0: string | null; silo1: string | null }
  otherIrmConfigNames?: { silo0: string | null; silo1: string | null }
  currentPendingIrmInfo?: {
    silo0: { name: string | null; activateAt: number | null } | null
    silo1: { name: string | null; activateAt: number | null } | null
  }
  otherPendingIrmInfo?: {
    silo0: { name: string | null; activateAt: number | null } | null
    silo1: { name: string | null; activateAt: number | null } | null
  }
  currentIrmConfigHistory?: { silo0: string[] | null; silo1: string[] | null }
  otherIrmConfigHistory?: { silo0: string[] | null; silo1: string[] | null }
}

const ORACLE_PRICE_KEY = 'oracle.price'
const ORACLE_BASE_DISCOUNT_KEY = 'baseDiscountPerYear'

function formatPercentMaybe(value: unknown): string {
  if (value == null) return 'N/A'
  return formatPercentage(BigInt(String(value)))
}

function formatShareTokenMetaCompare(value: unknown): string {
  const v = value as { decimals?: number | null; offset?: number | null } | null
  if (!v) return 'N/A'
  const decimals = v.decimals == null ? 'N/A' : String(v.decimals)
  const offset = v.offset == null ? 'N/A' : String(v.offset)
  return `decimals: ${decimals}, offset: ${offset}`
}

function getAddressVersion(
  addressVersions: Map<string, string> | undefined,
  address: string | null | undefined
): string | null {
  if (!address || !ethers.isAddress(address)) return null
  return addressVersions?.get(ethers.getAddress(address).toLowerCase()) ?? null
}

function normalizeForCompare(value: unknown): string {
  if (value == null) return '__null__'
  if (typeof value === 'bigint') return `bigint:${value.toString()}`
  if (typeof value === 'boolean') return `bool:${value ? '1' : '0'}`
  if (typeof value === 'number') return `num:${String(value)}`
  if (typeof value === 'string') return `str:${value.trim()}`
  if (Array.isArray(value)) return `arr:[${value.map((v) => normalizeForCompare(v)).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `obj:{${entries.map(([k, v]) => `${k}:${normalizeForCompare(v)}`).join(',')}}`
  }
  return `raw:${String(value)}`
}

function displayComparableValue(value: unknown): string {
  if (value == null) return 'N/A'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.length === 0 ? '(empty)' : value.map(displayComparableValue).join(', ')
  return String(value)
}

function addEntry(
  map: MarketCompareMap,
  key: string,
  current: unknown,
  other: unknown,
  formatter?: (value: unknown) => string
): void {
  map.set(key, {
    match: normalizeForCompare(current) === normalizeForCompare(other),
    otherDisplay: formatter ? formatter(other) : displayComparableValue(other)
  })
}

function getOracleComparableConfig(
  oracleType: string | undefined,
  config: Record<string, unknown> | undefined,
  options?: { excludeBaseDiscount?: boolean }
): Array<{ key: string; value: unknown }> {
  if (!config || typeof config !== 'object') return []
  const isFlatPriceOracle = (oracleType ?? '').toLowerCase().includes('flatpriceoracle')
  const out: Array<{ key: string; value: unknown }> = []
  for (const [configKey, val] of Object.entries(config)) {
    if (isFlatPriceOracle && configKey !== 'rawPrice') continue
    if (/quoteToken/i.test(configKey)) continue
    if (/address/i.test(configKey)) continue
    if (typeof val === 'string' && ethers.isAddress(val.trim())) continue
    if (isFlatPriceOracle && /normalizationDivider/i.test(configKey)) continue
    const isBaseDiscount = /baseDiscount/i.test(configKey)
    if (isBaseDiscount && options?.excludeBaseDiscount) continue
    out.push({ key: `oracle.config.${configKey}`, value: val })
  }
  return out
}

function getTimelockForOracle(oracle: OracleInfo, fallbackTimelockSeconds?: number): number | null {
  const timelockSeconds = oracle.timelockSeconds ?? fallbackTimelockSeconds
  const version = (oracle.version ?? '').toLowerCase()
  if (!version.includes('manageableoracle')) return null
  if (timelockSeconds == null || timelockSeconds <= 0) return null
  return timelockSeconds
}

function addOracleEntries(
  map: MarketCompareMap,
  prefix: string,
  currentOracle: OracleInfo,
  otherOracle: OracleInfo,
  tokenDecimals?: number,
  fallbackTimelockSeconds?: number
): void {
  addEntry(map, `${prefix}.version`, currentOracle.version ?? null, otherOracle.version ?? null)
  addEntry(map, `${prefix}.type`, currentOracle.type ?? null, otherOracle.type ?? null)

  const currentPriceRaw =
    currentOracle.address === ethers.ZeroAddress
      ? BigInt(`1${'0'.repeat(Math.max(0, Math.floor(typeof tokenDecimals === 'number' ? tokenDecimals : 18)))}`).toString()
      : currentOracle.quotePrice
  const otherPriceRaw =
    otherOracle.address === ethers.ZeroAddress
      ? BigInt(`1${'0'.repeat(Math.max(0, Math.floor(typeof tokenDecimals === 'number' ? tokenDecimals : 18)))}`).toString()
      : otherOracle.quotePrice
  if (currentPriceRaw != null || otherPriceRaw != null) {
    addEntry(map, `${prefix}.${ORACLE_PRICE_KEY}`, currentPriceRaw ?? null, otherPriceRaw ?? null, (value) => {
      if (typeof value !== 'string' || value === '') return 'N/A'
      try {
        return formatQuotePriceAs18Decimals(value)
      } catch {
        return value
      }
    })
  }

  const currentHasPtUnderlying = Boolean(currentOracle.underlying && currentOracle.config && typeof currentOracle.config.baseDiscountPerYear !== 'undefined')
  const otherHasPtUnderlying = Boolean(otherOracle.underlying && otherOracle.config && typeof otherOracle.config.baseDiscountPerYear !== 'undefined')
  const currentCfgRows = getOracleComparableConfig(currentOracle.type, currentOracle.config as Record<string, unknown> | undefined, {
    excludeBaseDiscount: currentHasPtUnderlying
  })
  const otherCfgRows = getOracleComparableConfig(otherOracle.type, otherOracle.config as Record<string, unknown> | undefined, {
    excludeBaseDiscount: otherHasPtUnderlying
  })
  const allConfigKeys = Array.from(new Set([...currentCfgRows.map((r) => r.key), ...otherCfgRows.map((r) => r.key)]))
  for (const configKey of allConfigKeys) {
    addEntry(
      map,
      `${prefix}.${configKey}`,
      currentCfgRows.find((r) => r.key === configKey)?.value ?? null,
      otherCfgRows.find((r) => r.key === configKey)?.value ?? null
    )
  }

  addEntry(
    map,
    `${prefix}.${ORACLE_BASE_DISCOUNT_KEY}`,
    (currentOracle.config as Record<string, unknown> | undefined)?.baseDiscountPerYear ?? null,
    (otherOracle.config as Record<string, unknown> | undefined)?.baseDiscountPerYear ?? null,
    formatPercentMaybe
  )

  addEntry(
    map,
    `${prefix}.oracle.customMethod.details`,
    {
      rawPrice: (currentOracle.config as Record<string, unknown> | undefined)?.rawPrice ?? null,
      methodSignature: (currentOracle.config as Record<string, unknown> | undefined)?.methodSignature ?? null
    },
    {
      rawPrice: (otherOracle.config as Record<string, unknown> | undefined)?.rawPrice ?? null,
      methodSignature: (otherOracle.config as Record<string, unknown> | undefined)?.methodSignature ?? null
    }
  )

  addEntry(
    map,
    `${prefix}.oracle.supra.details`,
    (currentOracle.config as Record<string, unknown> | undefined)?.pairId ?? null,
    (otherOracle.config as Record<string, unknown> | undefined)?.pairId ?? null
  )

  addEntry(
    map,
    `${prefix}.oracle.chainlink.aggregators`,
    {
      primaryAggregatorDescription: (currentOracle.config as Record<string, unknown> | undefined)?.primaryAggregatorDescription ?? null,
      secondaryAggregatorDescription: (currentOracle.config as Record<string, unknown> | undefined)?.secondaryAggregatorDescription ?? null
    },
    {
      primaryAggregatorDescription: (otherOracle.config as Record<string, unknown> | undefined)?.primaryAggregatorDescription ?? null,
      secondaryAggregatorDescription: (otherOracle.config as Record<string, unknown> | undefined)?.secondaryAggregatorDescription ?? null
    }
  )

  addEntry(
    map,
    `${prefix}.oracle.quoteToken`,
    currentOracle.quoteTokenSymbol ?? null,
    otherOracle.quoteTokenSymbol ?? null,
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )

  addEntry(
    map,
    `${prefix}.oracle.manageable.underlying`,
    currentOracle.underlying?.version ?? null,
    otherOracle.underlying?.version ?? null,
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )

  addEntry(
    map,
    `${prefix}.oracle.manageable.timelock`,
    getTimelockForOracle(currentOracle, fallbackTimelockSeconds),
    getTimelockForOracle(otherOracle, fallbackTimelockSeconds),
    (value) => {
      if (value == null) return 'N/A'
      const seconds = Number(value)
      const days = Math.round(seconds / 86400)
      return `${days} ${days === 1 ? 'day' : 'days'} (${seconds.toLocaleString()} seconds)`
    }
  )
}

function makeIrmConfigSummary(
  name: string | null | undefined,
  _pending: { name: string | null; activateAt: number | null } | null | undefined,
  _history: string[] | null | undefined
): string {
  void _pending
  void _history
  return name ?? 'not able to match'
}

function addHookEntries(map: MarketCompareMap, currentHookGaugeInfo: HookGaugeInfo, otherHookGaugeInfo: HookGaugeInfo): void {
  const current = currentHookGaugeInfo ?? null
  const other = otherHookGaugeInfo ?? null
  addEntry(map, 'config.hook.defaulting.state', current?.hasDefaultingHook ?? false, other?.hasDefaultingHook ?? false, (value) =>
    value ? 'on' : 'off'
  )
  addEntry(
    map,
    'config.hook.defaulting.borrowable.assets',
    { onlyOneBorrowable: current?.onlyOneBorrowable ?? null, symbol: current?.borrowableTokenSymbol ?? null },
    { onlyOneBorrowable: other?.onlyOneBorrowable ?? null, symbol: other?.borrowableTokenSymbol ?? null },
    (value) => {
      const v = value as { onlyOneBorrowable: boolean | null; symbol: string | null } | null
      if (!v) return 'N/A'
      if (v.onlyOneBorrowable === false) return 'both assets'
      if (v.onlyOneBorrowable === true && v.symbol) return `only ${v.symbol}`
      return 'N/A'
    }
  )
  addEntry(
    map,
    'config.hook.defaulting.ltMargin',
    current?.ltMarginForDefaultingRaw ?? null,
    other?.ltMarginForDefaultingRaw ?? null,
    (value) => {
      if (value == null) return 'N/A'
      const v = BigInt(String(value))
      return `${formatPercentage(v)} (${formatBigIntToE18(v, true)})`
    }
  )
}

function addSiloSectionEntries(
  map: MarketCompareMap,
  side: 0 | 1,
  currentConfig: MarketConfig,
  otherConfig: MarketConfig,
  addressVersions: Map<string, string> | undefined,
  manageableOracleTimelockSeconds: number | undefined,
  currentIrmConfigName: string | null | undefined,
  otherIrmConfigName: string | null | undefined,
  currentPendingIrmInfo: { name: string | null; activateAt: number | null } | null | undefined,
  otherPendingIrmInfo: { name: string | null; activateAt: number | null } | null | undefined,
  currentIrmHistory: string[] | null | undefined,
  otherIrmHistory: string[] | null | undefined
): void {
  const key = side === 0 ? 'silo0' : 'silo1'
  const current = side === 0 ? currentConfig.silo0 : currentConfig.silo1
  const other = side === 0 ? otherConfig.silo0 : otherConfig.silo1
  addEntry(
    map,
    `${key}.version`,
    getAddressVersion(addressVersions, current.silo),
    getAddressVersion(addressVersions, other.silo),
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )
  addEntry(
    map,
    `${key}.share.protected.version`,
    getAddressVersion(addressVersions, current.protectedShareToken),
    getAddressVersion(addressVersions, other.protectedShareToken),
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )
  addEntry(
    map,
    `${key}.share.collateral.version`,
    getAddressVersion(addressVersions, current.collateralShareToken),
    getAddressVersion(addressVersions, other.collateralShareToken),
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )
  addEntry(
    map,
    `${key}.share.debt.version`,
    getAddressVersion(addressVersions, current.debtShareToken),
    getAddressVersion(addressVersions, other.debtShareToken),
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )

  addEntry(
    map,
    `${key}.share.protected.share-token-meta`,
    {
      decimals: current.protectedShareTokenDecimals ?? null,
      offset: current.protectedShareTokenOffset ?? null
    },
    {
      decimals: other.protectedShareTokenDecimals ?? null,
      offset: other.protectedShareTokenOffset ?? null
    },
    formatShareTokenMetaCompare
  )
  addEntry(
    map,
    `${key}.share.collateral.share-token-meta`,
    {
      decimals: current.collateralShareTokenDecimals ?? null,
      offset: current.collateralShareTokenOffset ?? null
    },
    {
      decimals: other.collateralShareTokenDecimals ?? null,
      offset: other.collateralShareTokenOffset ?? null
    },
    formatShareTokenMetaCompare
  )
  addEntry(
    map,
    `${key}.share.debt.share-token-meta`,
    {
      decimals: current.debtShareTokenDecimals ?? null,
      offset: current.debtShareTokenOffset ?? null
    },
    {
      decimals: other.debtShareTokenDecimals ?? null,
      offset: other.debtShareTokenOffset ?? null
    },
    formatShareTokenMetaCompare
  )

  addOracleEntries(
    map,
    `${key}.solvencyOracle`,
    current.solvencyOracle,
    other.solvencyOracle,
    current.tokenDecimals,
    manageableOracleTimelockSeconds
  )
  addOracleEntries(
    map,
    `${key}.maxLtvOracle`,
    current.maxLtvOracle,
    other.maxLtvOracle,
    current.tokenDecimals,
    manageableOracleTimelockSeconds
  )

  addEntry(map, `${key}.irm.version`, current.interestRateModel.version ?? null, other.interestRateModel.version ?? null)
  addEntry(
    map,
    `${key}.irm.timelock`,
    (current.interestRateModel.config as Record<string, unknown> | undefined)?.timelock ?? null,
    (other.interestRateModel.config as Record<string, unknown> | undefined)?.timelock ?? null
  )
  addEntry(
    map,
    `${key}.irm.cap`,
    (current.interestRateModel.config as Record<string, unknown> | undefined)?.rcompCapPerSecond ??
      (current.interestRateModel.config as Record<string, unknown> | undefined)?.rcompCap ??
      null,
    (other.interestRateModel.config as Record<string, unknown> | undefined)?.rcompCapPerSecond ??
      (other.interestRateModel.config as Record<string, unknown> | undefined)?.rcompCap ??
      null
  )
  addEntry(
    map,
    `${key}.irm.configName`,
    makeIrmConfigSummary(currentIrmConfigName, currentPendingIrmInfo, currentIrmHistory),
    makeIrmConfigSummary(otherIrmConfigName, otherPendingIrmInfo, otherIrmHistory)
  )

  addEntry(map, `${key}.maxLtv`, current.maxLtv, other.maxLtv, formatPercentMaybe)
  addEntry(map, `${key}.lt`, current.lt, other.lt, formatPercentMaybe)
  addEntry(
    map,
    `${key}.liquidationTargetLtv`,
    current.liquidationTargetLtv,
    other.liquidationTargetLtv,
    formatPercentMaybe
  )
  addEntry(map, `${key}.liquidationFee`, current.liquidationFee, other.liquidationFee, formatPercentMaybe)
  addEntry(map, `${key}.flashloanFee`, current.flashloanFee, other.flashloanFee, formatPercentMaybe)
  addEntry(map, `${key}.callBeforeQuote`, current.callBeforeQuote, other.callBeforeQuote)
}

export function buildMarketCompareMap({
  currentConfig,
  otherConfig,
  addressVersions,
  manageableOracleTimelockSeconds,
  currentHookGaugeInfo = null,
  otherHookGaugeInfo = null,
  currentIrmConfigNames = { silo0: null, silo1: null },
  otherIrmConfigNames = { silo0: null, silo1: null },
  currentPendingIrmInfo = { silo0: null, silo1: null },
  otherPendingIrmInfo = { silo0: null, silo1: null },
  currentIrmConfigHistory = { silo0: null, silo1: null },
  otherIrmConfigHistory = { silo0: null, silo1: null }
}: BuildMarketCompareMapParams): MarketCompareMap {
  const map: MarketCompareMap = new Map()

  addEntry(map, 'config.siloId', currentConfig.siloId, otherConfig.siloId)
  addEntry(
    map,
    'config.silos.silo0.version',
    getAddressVersion(addressVersions, currentConfig.silo0.silo),
    getAddressVersion(addressVersions, otherConfig.silo0.silo),
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )
  addEntry(
    map,
    'config.silos.silo1.version',
    getAddressVersion(addressVersions, currentConfig.silo1.silo),
    getAddressVersion(addressVersions, otherConfig.silo1.silo),
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : 'N/A')
  )
  addEntry(map, 'config.daoFee', currentConfig.silo0.daoFee, otherConfig.silo0.daoFee, formatPercentMaybe)
  addEntry(
    map,
    'config.hookReceiver.version',
    currentConfig.silo0.hookReceiverVersion ?? null,
    otherConfig.silo0.hookReceiverVersion ?? null
  )
  addEntry(
    map,
    'config.deployerFee',
    currentConfig.silo0.deployerFee,
    otherConfig.silo0.deployerFee,
    formatPercentMaybe
  )
  addHookEntries(map, currentHookGaugeInfo, otherHookGaugeInfo)

  addSiloSectionEntries(
    map,
    0,
    currentConfig,
    otherConfig,
    addressVersions,
    manageableOracleTimelockSeconds,
    currentIrmConfigNames.silo0,
    otherIrmConfigNames.silo0,
    currentPendingIrmInfo.silo0,
    otherPendingIrmInfo.silo0,
    currentIrmConfigHistory.silo0,
    otherIrmConfigHistory.silo0
  )
  addSiloSectionEntries(
    map,
    1,
    currentConfig,
    otherConfig,
    addressVersions,
    manageableOracleTimelockSeconds,
    currentIrmConfigNames.silo1,
    otherIrmConfigNames.silo1,
    currentPendingIrmInfo.silo1,
    otherPendingIrmInfo.silo1,
    currentIrmConfigHistory.silo1,
    otherIrmConfigHistory.silo1
  )

  return map
}
