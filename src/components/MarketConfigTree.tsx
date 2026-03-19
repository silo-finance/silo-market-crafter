'use client'

import React from 'react'
import { MarketConfig, formatPercentage, formatAddress, formatQuotePriceAs18Decimals } from '@/utils/fetchMarketConfig'
import { formatWizardBigIntToE18, formatBigIntToE18 } from '@/utils/formatting'
import CopyButton from '@/components/CopyButton'
import AddressDisplayShort from '@/components/AddressDisplayShort'
import { ethers } from 'ethers'
import { isPriceUnexpectedlyLow, isPriceUnexpectedlyHigh, isPriceDecimalsInvalid, isBaseDiscountPercentOutOfRange, verifyAddress, verifyNumericValue } from '@/utils/verification'
import { VERIFICATION_STATUS } from '@/utils/verification/buildVerificationChecks'
import { VersionStatus } from '@/components/VersionStatus'
import IrmConfigNameWithLink from '@/components/IrmConfigNameWithLink'


/** Format large numeric string as e-notation (e.g. scaleFactor 1000000000000000000 → 1e18). */
function formatFactorToE(value: string): string {
  const s = value.trim()
  if (!s || s === '0') return s
  try {
    const n = BigInt(s)
    if (n === BigInt(0)) return '0'
    const str = n.toString()
    if (str.length <= 4) return str
    const exp = str.length - 1
    if (str[0] === '1' && /^0*$/.test(str.slice(1))) return `1e${exp}`
    const frac = str.slice(1, 5).replace(/0+$/, '')
    const mantissa = frac ? `${str[0]}.${frac}` : str[0]
    return `${mantissa}e${exp}`
  } catch {
    return value
  }
}

/** Stable keys for oracle bullet items — use these for verification wiring, not display text */
export const ORACLE_BULLET_KEYS = {
  PRICE: 'oracle.price',
  TYPE: 'oracle.type',
  /** PT-Linear: baseDiscountPerYear from config */
  BASE_DISCOUNT_PER_YEAR: 'baseDiscountPerYear',
  /** Prefix for other config entries: key = config key as-is (e.g. scaleFactor, ulow, ucrit) */
  CONFIG: (configKey: string) => `oracle.config.${configKey}`
} as const

export interface OracleBulletItem {
  key: string
  text: string | React.ReactNode
}

function buildShareTokenMetaBullet(symbol?: string, decimals?: number, offset?: number): OracleBulletItem[] {
  if (symbol == null && decimals == null && offset == null) return []
  const symbolText = symbol != null && symbol !== '' ? symbol : 'N/A'
  const decimalsText = decimals != null ? String(decimals) : 'N/A'
  const offsetText = offset != null ? String(offset) : 'N/A'
  return [{ key: 'share-token-meta', text: `symbol: ${symbolText}, decimals: ${decimalsText}, decimals offset: ${offsetText}` }]
}

function buildOracleBullets(
  quotePrice: string | undefined,
  quoteTokenSymbol: string | undefined,
  type: string | undefined,
  config: Record<string, unknown> | undefined,
  options?: { excludeBaseDiscount?: boolean }
): OracleBulletItem[] {
  const bullets: OracleBulletItem[] = []
  if (quotePrice != null && quotePrice !== '') {
    const priceStr = formatQuotePriceAs18Decimals(quotePrice)
    bullets.push({
      key: ORACLE_BULLET_KEYS.PRICE,
      text: (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>Price (1 token):</span>
          <span className="irm-config-name-chip">{priceStr}</span>
          {quoteTokenSymbol && (
            <span className="text-gray-300 text-sm">{quoteTokenSymbol}</span>
          )}
        </span>
      )
    })
  }
  // Skip Type for PT-Linear – base discount per year is sufficient
  if (type && !/ptlinear|pt-linear/i.test(type)) {
    bullets.push({ key: ORACLE_BULLET_KEYS.TYPE, text: `Type: ${type}` })
  }

  if (config && typeof config === 'object') {
    for (const [configKey, val] of Object.entries(config)) {
      if (/quoteToken/i.test(configKey)) continue
      const isBaseDiscount = /baseDiscount/i.test(configKey)
      if (isBaseDiscount && options?.excludeBaseDiscount) continue
      const raw = typeof val === 'string' ? val : String(val)
      const isFactor = /scaleFactor|factor/i.test(configKey)
      let display: string | React.ReactNode
      if (isBaseDiscount && /^\d+$/.test(raw)) {
        const valBigInt = BigInt(raw)
        display = (
          <>
            <span className="irm-config-name-chip">{formatPercentage(valBigInt)}</span>
            <span className="text-gray-500 text-xs font-normal">({formatWizardBigIntToE18(valBigInt, true)})</span>
          </>
        )
      } else if (isFactor && /^\d+$/.test(raw)) {
        display = formatFactorToE(raw)
      } else {
        display = raw
      }
      const label = configKey.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
      const text = raw.startsWith('0x') && raw.length === 42
        ? `${label}: ${formatAddress(raw)}`
        : isBaseDiscount && typeof display !== 'string'
          ? (
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span>{label}:</span>
                {display}
              </span>
            )
          : `${label}: ${display}`
      const bulletKey = isBaseDiscount ? ORACLE_BULLET_KEYS.BASE_DISCOUNT_PER_YEAR : ORACLE_BULLET_KEYS.CONFIG(configKey)
      bullets.push({ key: bulletKey, text })
    }
  }

  return bullets
}

interface SiloVerification {
  silo0: boolean | null
  silo1: boolean | null
  error: string | null
}

interface HookOwnerVerification {
  onChainOwner: string | null
  wizardOwner: string | null
  isInAddressesJson: boolean | null
}

interface IRMOwnerVerification {
  onChainOwner: string | null
  wizardOwner: string | null
  isInAddressesJson: boolean | null
}

interface OracleOwnerVerification {
  onChainOwner: string | null
  wizardOwner: string | null
  isInAddressesJson: boolean | null
}

interface TokenVerification {
  token0: { onChainToken: string | null; wizardToken: string | null } | null
  token1: { onChainToken: string | null; wizardToken: string | null } | null
}

interface NumericValueVerification {
  silo0: {
    maxLtv: bigint | null
    lt: bigint | null
    liquidationTargetLtv: bigint | null
    liquidationFee: bigint | null
    flashloanFee: bigint | null
  } | null
  silo1: {
    maxLtv: bigint | null
    lt: bigint | null
    liquidationTargetLtv: bigint | null
    liquidationFee: bigint | null
    flashloanFee: bigint | null
  } | null
}

/** PT Oracle only: base discount per year on-chain vs wizard, for Solvency Oracle when type is PT-Linear */
interface PTOracleBaseDiscountVerification {
  silo0?: { onChain: bigint; wizard: bigint | null }
  silo1?: { onChain: bigint; wizard: bigint | null }
}

interface CallBeforeQuoteVerification {
  silo0?: { wizard: boolean | null }
  silo1?: { wizard: boolean | null }
}

/** Per-silo oracle owner verification (ManageableOracle): silo0 and silo1 Solvency Oracle owner checks */
interface OracleOwnerVerificationPerSilo {
  silo0?: OracleOwnerVerification | null
  silo1?: OracleOwnerVerification | null
}

interface MarketConfigTreeProps {
  config: MarketConfig
  explorerUrl: string
  chainId?: string
  currentSiloFactoryAddress?: string
  wizardDaoFee?: bigint | null
  wizardDeployerFee?: bigint | null
  siloVerification?: SiloVerification
  hookOwnerVerification?: HookOwnerVerification
  irmOwnerVerification?: IRMOwnerVerification
  oracleOwnerVerification?: OracleOwnerVerificationPerSilo
  tokenVerification?: TokenVerification
  numericValueVerification?: NumericValueVerification
  addressInJsonVerification?: Map<string, boolean>
  addressVersions?: Map<string, string>
  ptOracleBaseDiscountVerification?: PTOracleBaseDiscountVerification
  callBeforeQuoteVerification?: CallBeforeQuoteVerification
  /** Timelock in seconds for ManageableOracle (wizard value); shown in tree when oracle has underlying */
  manageableOracleTimelockSeconds?: number
   /** Dynamic Kink IRM configuration names resolved from JSON (silo0/silo1) */
  irmConfigNames?: { silo0: string | null; silo1: string | null }
  /** Pending IRM config (when address !== 0): name + activateAt timestamp */
  pendingIrmInfo?: {
    silo0: { name: string | null; activateAt: number | null } | null
    silo1: { name: string | null; activateAt: number | null } | null
  }
  /** IRM config history: list of config names (previous configs in chain) */
  irmConfigHistory?: { silo0: string[] | null; silo1: string[] | null }
  hookGaugeInfo?: {
    hasDefaultingHook: boolean
    onlyOneBorrowable: boolean | null
    borrowableSilo: 0 | 1 | null
    borrowableTokenSymbol: string | null
    gaugeAddress: string | null
    gaugeVersion: string | null
    ltMarginForDefaultingRaw?: string | null
    gaugeVerification?: {
      owner: string | null
      ownerName: string | null
      ownerInJson: boolean | null
      ownerMatchesHookOwner: boolean | null
      ownerMatchesWizard: boolean | null
      notifierEqualsHook: boolean | null
    } | null
  } | null
}

interface TokenMeta {
  symbol?: string
  decimals?: number
}

export interface OwnerBulletItem {
  address: string
  isContract?: boolean
  name?: string
}

interface TreeNodeProps {
  label: string
  value?: string | bigint | boolean | null
  address?: string
  tokenMeta?: TokenMeta
  suffixText?: string
  bulletItems?: OracleBulletItem[]
  ownerBullets?: OwnerBulletItem[]
  children?: React.ReactNode
  explorerUrl: string
  isPercentage?: boolean
  valueMuted?: boolean
  hookOwnerVerification?: HookOwnerVerification
  irmOwnerVerification?: IRMOwnerVerification
  tokenVerification?: { onChainToken: string | null; wizardToken: string | null } | null
  numericValueVerification?: { wizardValue: bigint | null; checkHighValue?: boolean }
  addressInJsonVerification?: Map<string, boolean>
  addressVersions?: Map<string, string>
  showAddressVersion?: boolean
  /** When true, show yellow warning icon at end of price line (possible decimals error) */
  priceLowWarning?: boolean
  /** When true, show yellow warning icon (arrow up) at end of price line — price unexpectedly high */
  priceHighWarning?: boolean
  /** When true, show red 18-decimals warning icon at end of price line */
  priceDecimalsWarning?: boolean
  /** PT Oracle only: base discount per year verification (match + range warning) */
  baseDiscountVerification?: { onChain: bigint; wizard: bigint | null } | null
  /** Call Before Quote: compare on-chain value with wizard; show green/red icon */
  callBeforeQuoteVerification?: { wizard: boolean | null } | null
  /** Top-level node (silo config / silo 0 / silo 1) – extra spacing + stronger label emphasis */
  isRoot?: boolean
  oracleOwnerVerification?: OracleOwnerVerification
  /** Optional section token label shown in large background marker for root SILO nodes */
  sectionTokenLabel?: string
}

function VerificationStatusIconSmall({ status }: { status: typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS] }) {
  if (status === VERIFICATION_STATUS.PENDING) {
    return (
      <span className="inline-flex shrink-0 text-gray-500 ml-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === VERIFICATION_STATUS.NOT_AVAILABLE) {
    return (
      <span className="inline-flex shrink-0 text-gray-500 ml-1">
        <span className="text-xs font-medium">N/A</span>
      </span>
    )
  }
  if (status === VERIFICATION_STATUS.PASSED) {
    return (
      <span className="inline-flex shrink-0 text-green-500 ml-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === VERIFICATION_STATUS.WARNING) {
    return (
      <span className="inline-flex shrink-0 text-yellow-500 ml-1">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 20h20L12 2zm0 3.99L19.53 18H4.47L12 5.99zM11 15v-2h2v2h-2zm0-4V8h2v3h-2z"/>
        </svg>
      </span>
    )
  }
  // failed
  return (
    <span className="inline-flex shrink-0 text-red-500 ml-1">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  )
}

function OwnerBulletContent({ item, explorerUrl, hookOwnerVerification, irmOwnerVerification, oracleOwnerVerification, addressInJsonVerification }: { item: OwnerBulletItem; explorerUrl: string; hookOwnerVerification?: HookOwnerVerification; irmOwnerVerification?: IRMOwnerVerification; oracleOwnerVerification?: OracleOwnerVerification; addressInJsonVerification?: Map<string, boolean> }) {
  const { address, isContract, name } = item
  if (!address || address === ethers.ZeroAddress) return null
  
  // Normalize the address from item
  const normalizedItemAddress = ethers.getAddress(address).toLowerCase()
  
  // Use centralized verification functions from src/utils/verification/
  // Check 1: Verify that on-chain owner matches wizard owner (independent check)
  // This check compares: onChainOwner === wizardOwner
  let isVerified: boolean | null = null
  if (hookOwnerVerification && hookOwnerVerification.onChainOwner && hookOwnerVerification.wizardOwner) {
    const normalizedOnChain = ethers.getAddress(hookOwnerVerification.onChainOwner).toLowerCase()
    const normalizedItem = normalizedItemAddress
    if (normalizedOnChain === normalizedItem) {
      isVerified = verifyAddress(hookOwnerVerification.onChainOwner, hookOwnerVerification.wizardOwner)
    }
  } else if (irmOwnerVerification && irmOwnerVerification.onChainOwner && irmOwnerVerification.wizardOwner) {
    const normalizedOnChain = ethers.getAddress(irmOwnerVerification.onChainOwner).toLowerCase()
    const normalizedItem = normalizedItemAddress
    if (normalizedOnChain === normalizedItem) {
      isVerified = verifyAddress(irmOwnerVerification.onChainOwner, irmOwnerVerification.wizardOwner)
    }
  }
  if (!isVerified && oracleOwnerVerification && oracleOwnerVerification.onChainOwner && oracleOwnerVerification.wizardOwner) {
    const normalizedOnChain = ethers.getAddress(oracleOwnerVerification.onChainOwner).toLowerCase()
    const normalizedItem = normalizedItemAddress
    if (normalizedOnChain === normalizedItem) {
      isVerified = verifyAddress(oracleOwnerVerification.onChainOwner, oracleOwnerVerification.wizardOwner)
    }
  }

  // Oracle owner: when wizard did not provide owner, treat as N/A (not PENDING)
  const isOracleOwnerBullet = Boolean(
    oracleOwnerVerification?.onChainOwner &&
    normalizedItemAddress === ethers.getAddress(oracleOwnerVerification.onChainOwner).toLowerCase()
  )
  const oracleWizardOwnerMissing = isOracleOwnerBullet && (oracleOwnerVerification?.wizardOwner == null || oracleOwnerVerification?.wizardOwner === '')

  // Get JSON verification result - use oracleOwnerVerification.isInAddressesJson when this is the Oracle owner so status is never stuck on PENDING
  const isInJsonFromOracle = isOracleOwnerBullet && oracleOwnerVerification?.isInAddressesJson != null
    ? oracleOwnerVerification.isInAddressesJson
    : null
  const isInJson = isInJsonFromOracle !== null ? isInJsonFromOracle : (addressInJsonVerification?.get(normalizedItemAddress) ?? null)
  
  // Determine verification statuses
  const wizardVsOnChainStatus = oracleWizardOwnerMissing
    ? VERIFICATION_STATUS.NOT_AVAILABLE
    : isVerified === null && (!hookOwnerVerification?.onChainOwner || !hookOwnerVerification?.wizardOwner) && (!irmOwnerVerification?.onChainOwner || !irmOwnerVerification?.wizardOwner) && !isOracleOwnerBullet
      ? VERIFICATION_STATUS.NOT_AVAILABLE
      : isVerified === null 
        ? VERIFICATION_STATUS.PENDING 
        : isVerified === true 
          ? VERIFICATION_STATUS.PASSED 
          : VERIFICATION_STATUS.FAILED
  
  const addressInJsonStatus = isInJson === null 
    ? VERIFICATION_STATUS.PENDING 
    : isInJson === true 
      ? VERIFICATION_STATUS.PASSED 
      : VERIFICATION_STATUS.WARNING
  
  const ownerLabel = oracleOwnerVerification ? 'Oracle owner' : irmOwnerVerification ? 'IRM owner' : 'Hook owner'
  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="text-gray-400 text-sm">Owner:</span>
        <a
          href={`${explorerUrl}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lime-600 hover:text-lime-500 font-mono text-sm"
        >
          {formatAddress(address)}
        </a>
        <CopyButton value={address} title="Copy address" iconClassName="w-3.5 h-3.5 inline align-middle" />
        {isContract !== undefined && (
          <span className="text-gray-500 text-xs font-medium px-1.5 py-0.5 rounded bg-gray-800">
            {isContract ? 'Contract' : 'EOA'}
          </span>
        )}
        {name != null && name !== '' && (
          <span className="text-gray-400 text-sm">({name})</span>
        )}
      </span>
      {/* Verification details as sub-items */}
      <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
        <li className="flex items-center">
          <span>{ownerLabel} verification:</span>
          {wizardVsOnChainStatus === VERIFICATION_STATUS.PASSED && (
            <span className="text-gray-500 ml-1">matches Wizard value</span>
          )}
          {wizardVsOnChainStatus === VERIFICATION_STATUS.FAILED && (
            <span className="text-gray-500 ml-1">does not match Wizard value</span>
          )}
          {wizardVsOnChainStatus === VERIFICATION_STATUS.PENDING && (
            <span className="text-gray-500 ml-1">verification pending</span>
          )}
          {wizardVsOnChainStatus === VERIFICATION_STATUS.NOT_AVAILABLE && (
            <span className="text-gray-500 ml-1">N/A</span>
          )}
          <VerificationStatusIconSmall status={wizardVsOnChainStatus} />
        </li>
        <li className="flex items-center">
          <span>{ownerLabel} address:</span>
          {addressInJsonStatus === VERIFICATION_STATUS.PASSED && (
            <span className="text-gray-500 ml-1">exists in Silo Finance repository list</span>
          )}
          {addressInJsonStatus === VERIFICATION_STATUS.WARNING && (
            <span className="text-gray-500 ml-1">does not exist in Silo Finance repository list</span>
          )}
          {addressInJsonStatus === VERIFICATION_STATUS.PENDING && (
            <span className="text-gray-500 ml-1">verification pending</span>
          )}
          <VerificationStatusIconSmall status={addressInJsonStatus} />
        </li>
      </ul>
    </>
  )
}

function TreeNode({ label, value, address, tokenMeta, suffixText, bulletItems, ownerBullets, children, explorerUrl, isPercentage, valueMuted, hookOwnerVerification, irmOwnerVerification, tokenVerification, numericValueVerification, addressInJsonVerification, addressVersions, showAddressVersion = true, priceLowWarning, priceHighWarning, priceDecimalsWarning, baseDiscountVerification, callBeforeQuoteVerification, wizardDaoFee, wizardDeployerFee, isRoot, oracleOwnerVerification, sectionTokenLabel }: TreeNodeProps & { wizardDaoFee?: bigint | null; wizardDeployerFee?: bigint | null }) {
  const hasAddress = address && address !== ethers.ZeroAddress
  const hasValue = value !== undefined && value !== null && !hasAddress
  const hasTokenMeta = tokenMeta && (tokenMeta.symbol != null || tokenMeta.decimals != null)
  const normalizedAddress = hasAddress ? ethers.getAddress(address).toLowerCase() : null
  const versionText = !showAddressVersion
    ? undefined
    : (suffixText != null && suffixText !== '')
      ? suffixText
      : (normalizedAddress ? addressVersions?.get(normalizedAddress) : undefined)
  const hasSuffix = versionText != null && versionText !== ''

  const isSiloRoot = isRoot && (label === 'SILO 0' || label === 'SILO 1')
  const isSiloConfigRoot = isRoot && label === 'SILO CONFIG'
  const sectionMain = isSiloConfigRoot
    ? 'config'
    : isSiloRoot
      ? (label === 'SILO 0' ? '0' : '1')
      : null

  return (
    <li className={`tree-item relative${isRoot ? ' mt-4 mb-6 pt-4 pb-4' : ''}`}>
      {sectionMain && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end text-gray-500 opacity-5 select-none">
          <span className={`leading-none font-extrabold ${isSiloConfigRoot ? 'text-[135px]' : 'text-[300px]'}`}>
            {sectionMain}
          </span>
          {sectionTokenLabel && !isSiloConfigRoot && (
            <span className={`leading-none font-extrabold mr-2 ${isSiloRoot ? 'text-[152px] mt-1' : 'text-[300px] mt-4'}`}>
              {sectionTokenLabel}
            </span>
          )}
        </span>
      )}
      <span className="tree-item-content relative z-10">
        <span className={`text-gray-300 text-sm ${isRoot ? 'font-semibold' : 'font-medium'}`}>{label}:</span>
        {' '}
        
        {hasAddress && (
          <>
            <a
              href={`${explorerUrl}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-600 hover:text-lime-500 font-mono text-sm"
            >
              {formatAddress(address)}
            </a>
            <CopyButton value={address} title="Copy address" iconClassName="w-3.5 h-3.5 inline align-middle" />
            {hasTokenMeta && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({[tokenMeta.symbol, tokenMeta.decimals != null ? `${tokenMeta.decimals} decimals` : ''].filter(Boolean).join(', ')})
              </span>
            )}
            {hasSuffix && !isSiloConfigRoot && <VersionStatus version={versionText} />}
          </>
        )}
        {/* Token verification details as sub-items */}
        {tokenVerification && address && (() => {
          const normalizedAddress = ethers.getAddress(address).toLowerCase()
          const normalizedOnChain = tokenVerification.onChainToken ? ethers.getAddress(tokenVerification.onChainToken).toLowerCase() : null
          const addressMatches = normalizedOnChain === normalizedAddress
          
          if (!addressMatches) return null
          
          const isVerified = tokenVerification.onChainToken && tokenVerification.wizardToken
            ? verifyAddress(tokenVerification.onChainToken, tokenVerification.wizardToken)
            : null
          const isInJson = addressInJsonVerification?.get(normalizedAddress) ?? null
          
          const tokenWizardVsOnChainStatus = isVerified === null && (!tokenVerification.onChainToken || !tokenVerification.wizardToken)
            ? VERIFICATION_STATUS.NOT_AVAILABLE
            : isVerified === null 
              ? VERIFICATION_STATUS.PENDING 
              : isVerified === true 
                ? VERIFICATION_STATUS.PASSED 
                : VERIFICATION_STATUS.FAILED
          
          const tokenAddressInJsonStatus = isInJson === null 
            ? VERIFICATION_STATUS.PENDING 
            : isInJson === true 
              ? VERIFICATION_STATUS.PASSED 
              : VERIFICATION_STATUS.WARNING
          
          return (
            <ul className="tree-bullet-list list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
              <li className="flex items-center">
                <span>Token verification:</span>
                {tokenWizardVsOnChainStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">matches Wizard value</span>
                )}
                {tokenWizardVsOnChainStatus === VERIFICATION_STATUS.FAILED && (
                  <span className="text-gray-500 ml-1">does not match Wizard value</span>
                )}
                {tokenWizardVsOnChainStatus === VERIFICATION_STATUS.PENDING && (
                  <span className="text-gray-500 ml-1">verification pending</span>
                )}
                {tokenWizardVsOnChainStatus === VERIFICATION_STATUS.NOT_AVAILABLE && (
                  <span className="text-gray-500 ml-1">N/A</span>
                )}
                <VerificationStatusIconSmall status={tokenWizardVsOnChainStatus} />
              </li>
              <li className="flex items-center">
                <span>Token address:</span>
                {tokenAddressInJsonStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">exists in Silo Finance repository list</span>
                )}
                {tokenAddressInJsonStatus === VERIFICATION_STATUS.WARNING && (
                  <span className="text-gray-500 ml-1">does not exist in Silo Finance repository list</span>
                )}
                {tokenAddressInJsonStatus === VERIFICATION_STATUS.PENDING && (
                  <span className="text-gray-500 ml-1">verification pending</span>
                )}
                <VerificationStatusIconSmall status={tokenAddressInJsonStatus} />
              </li>
            </ul>
          )
        })()}
        {hasValue && (
          <span className={`${valueMuted ? 'text-gray-400 text-sm' : 'text-white text-sm font-mono'} inline-flex items-center gap-1.5`}>
            {typeof value === 'boolean'
              ? (value ? 'Yes' : 'No')
              : isPercentage && typeof value === 'bigint'
                ? (
                    <>
                      {formatPercentage(value)}
                      <span className="text-gray-500 text-xs font-normal">({formatWizardBigIntToE18(value, true)})</span>
                    </>
                  )
                : typeof value === 'bigint'
                  ? value.toString()
                  : String(value)}
          </span>
        )}
        {address === ethers.ZeroAddress && (
          <span className="text-gray-500 text-sm italic">Zero Address</span>
        )}
        {/* Numeric value verification details as sub-items */}
        {hasValue && isPercentage && typeof value === 'bigint' && (() => {
          // Check if we have verification data for this value
          let wizardValue: bigint | null = null
          let verificationStatus: typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS] = VERIFICATION_STATUS.PENDING
          
          // DAO Fee and Deployer Fee use wizardDaoFee/wizardDeployerFee props
          if (label === 'DAO Fee' && wizardDaoFee != null) {
            wizardValue = wizardDaoFee
            verificationStatus = verifyNumericValue(value, wizardValue) ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
          } else if (label === 'DAO Fee' && wizardDaoFee == null) {
            verificationStatus = VERIFICATION_STATUS.NOT_AVAILABLE
          } else if (label === 'Deployer Fee' && wizardDeployerFee != null) {
            wizardValue = wizardDeployerFee
            verificationStatus = verifyNumericValue(value, wizardValue) ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
          } else if (label === 'Deployer Fee' && wizardDeployerFee == null) {
            verificationStatus = VERIFICATION_STATUS.NOT_AVAILABLE
          } else if (numericValueVerification && numericValueVerification.wizardValue != null) {
            // Other numeric values use numericValueVerification
            wizardValue = numericValueVerification.wizardValue
            verificationStatus = verifyNumericValue(value, wizardValue) ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
          } else if (numericValueVerification && numericValueVerification.wizardValue == null) {
            verificationStatus = VERIFICATION_STATUS.NOT_AVAILABLE
          } else {
            verificationStatus = VERIFICATION_STATUS.NOT_AVAILABLE
          }
          
          if (verificationStatus === VERIFICATION_STATUS.NOT_AVAILABLE) {
            return (
              <ul className="tree-bullet-list list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
                <li className="flex items-center">
                  <span>Verification:</span>
                  <span className="text-gray-500 ml-1">N/A</span>
                  <VerificationStatusIconSmall status={verificationStatus} />
                </li>
              </ul>
            )
          }
          
          // At this point verificationStatus can only be PASSED or FAILED
          return (
            <ul className="tree-bullet-list list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
              <li className="flex items-center">
                <span>Verification:</span>
                {verificationStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">matches Wizard value</span>
                )}
                {verificationStatus === VERIFICATION_STATUS.FAILED && (
                  <span className="text-gray-500 ml-1">does not match Wizard value</span>
                )}
                <VerificationStatusIconSmall status={verificationStatus} />
              </li>
            </ul>
          )
        })()}
        {/* Call Before Quote verification details as sub-items */}
        {hasValue && typeof value === 'boolean' && callBeforeQuoteVerification != null && callBeforeQuoteVerification.wizard !== null && (() => {
          const onChainValue = value
          const wizardValue = callBeforeQuoteVerification.wizard
          const verificationStatus = onChainValue === wizardValue ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
          
          return (
            <ul className="tree-bullet-list list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
              <li className="flex items-center">
                <span>Verification:</span>
                {verificationStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">matches Wizard value</span>
                )}
                {verificationStatus === VERIFICATION_STATUS.FAILED && (
                  <span className="text-gray-500 ml-1">does not match Wizard value</span>
                )}
                <VerificationStatusIconSmall status={verificationStatus} />
              </li>
            </ul>
          )
        })()}
      </span>
      {bulletItems && bulletItems.length > 0 && (
        <ul className="tree-bullet-list list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {bulletItems.map((item, i) => {
            const isPriceLine = item.key === ORACLE_BULLET_KEYS.PRICE
            const isBaseDiscountBullet = baseDiscountVerification && item.key === ORACLE_BULLET_KEYS.BASE_DISCOUNT_PER_YEAR
            const hasPriceVerified = isPriceLine && !priceLowWarning && !priceHighWarning && !priceDecimalsWarning
            return (
              <li key={i}>
                {item.text}
                {/* Price verification details as sub-items */}
                {isPriceLine && (priceLowWarning || priceHighWarning || priceDecimalsWarning || hasPriceVerified) && (
                  <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
                    {priceLowWarning && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <span className="text-gray-500 ml-1">price unexpectedly low</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.WARNING} />
                      </li>
                    )}
                    {priceHighWarning && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <span className="text-gray-500 ml-1">price unexpectedly high</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.WARNING} />
                      </li>
                    )}
                    {priceDecimalsWarning && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <span className="text-gray-500 ml-1">invalid price decimals</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.FAILED} />
                      </li>
                    )}
                    {hasPriceVerified && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <span className="text-gray-500 ml-1">price verified (range and decimals OK)</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.PASSED} />
                      </li>
                    )}
                  </ul>
                )}
                {/* Base Discount verification details as sub-items */}
                {isBaseDiscountBullet && baseDiscountVerification && (() => {
                  const isMatch = baseDiscountVerification.wizard !== null && verifyNumericValue(baseDiscountVerification.onChain, baseDiscountVerification.wizard)
                  const outOfRange = isBaseDiscountPercentOutOfRange(baseDiscountVerification.onChain)
                  const verificationStatus = baseDiscountVerification.wizard === null 
                    ? VERIFICATION_STATUS.NOT_AVAILABLE 
                    : isMatch && !outOfRange
                      ? VERIFICATION_STATUS.PASSED 
                      : VERIFICATION_STATUS.FAILED
                  
                  return (
                    <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
                      <li className="flex items-center">
                        <span>Base Discount verification:</span>
                        {verificationStatus === VERIFICATION_STATUS.PASSED && (
                          <span className="text-gray-500 ml-1">matches Wizard value</span>
                        )}
                        {verificationStatus === VERIFICATION_STATUS.FAILED && (
                          <span className="text-gray-500 ml-1">{outOfRange ? 'out of range' : 'does not match Wizard value'}</span>
                        )}
                        {verificationStatus === VERIFICATION_STATUS.NOT_AVAILABLE && (
                          <span className="text-gray-500 ml-1">N/A</span>
                        )}
                        <VerificationStatusIconSmall status={verificationStatus} />
                      </li>
                    </ul>
                  )
                })()}
              </li>
            )
          })}
        </ul>
      )}
      {ownerBullets && ownerBullets.length > 0 && (
        <ul className="tree-bullet-list list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {ownerBullets.map((item, i) => (
            <li key={i}>
              <OwnerBulletContent 
                item={item} 
                explorerUrl={explorerUrl} 
                hookOwnerVerification={hookOwnerVerification}
                irmOwnerVerification={irmOwnerVerification}
                oracleOwnerVerification={oracleOwnerVerification}
                addressInJsonVerification={addressInJsonVerification}
              />
            </li>
          ))}
        </ul>
      )}
      {children && <ol className="tree">{children}</ol>}
    </li>
  )
}

interface SiloSectionProps {
  side: 0 | 1
  label: string
  assetSymbol: string
  siloConfig: MarketConfig['silo0']
  explorerUrl: string
  addressVersions: Map<string, string>
  addressInJsonVerification: Map<string, boolean>
  tokenVerification?: { onChainToken: string | null; wizardToken: string | null } | null
  numericVerification?: NumericValueVerification['silo0']
  ptOracleBaseDiscount?: { onChain: bigint; wizard: bigint | null }
  callBeforeQuoteVerification?: { wizard: boolean | null } | null
  oracleOwnerVerification?: OracleOwnerVerification | null
  irmConfigName?: string | null
  pendingIrmInfo?: { name: string | null; activateAt: number | null } | null
  irmConfigHistory?: string[] | null
  hookOwnerVerification?: HookOwnerVerification
  irmOwnerVerification?: IRMOwnerVerification
  wizardDaoFee?: bigint | null
  wizardDeployerFee?: bigint | null
  manageableOracleTimelockSeconds?: number
}

function SiloSection({
  side,
  label,
  assetSymbol,
  siloConfig,
  explorerUrl,
  addressVersions,
  addressInJsonVerification,
  tokenVerification,
  numericVerification,
  ptOracleBaseDiscount,
  callBeforeQuoteVerification,
  oracleOwnerVerification,
  irmConfigName,
  pendingIrmInfo,
  irmConfigHistory,
  hookOwnerVerification,
  irmOwnerVerification,
  wizardDaoFee,
  wizardDeployerFee,
  manageableOracleTimelockSeconds
}: SiloSectionProps) {
  const numeric = numericVerification ?? null
  const siloKey = side === 0 ? 'silo0' : 'silo1'

  const tokenDecimalsSafe = typeof siloConfig.tokenDecimals === 'number' ? siloConfig.tokenDecimals : 18
  const isSolvencyOracleZero = siloConfig.solvencyOracle.address?.toLowerCase() === ethers.ZeroAddress.toLowerCase()
  // When Solvency Oracle address is zero, we can't read quotePrice on-chain.
  // We assume 1 token == 1 quote token in raw units => priceRaw = 10^tokenDecimals.
  const solvencyOraclePriceRawForVerification = isSolvencyOracleZero
    ? BigInt(`1${'0'.repeat(Math.max(0, Math.floor(tokenDecimalsSafe)))}`).toString()
    : siloConfig.solvencyOracle.quotePrice

  return (
    <TreeNode label={label} isRoot address={siloConfig.silo} explorerUrl={explorerUrl} addressVersions={addressVersions} sectionTokenLabel={assetSymbol}>
      <TreeNode
        label="Token"
        address={siloConfig.token}
        tokenMeta={{ symbol: siloConfig.tokenSymbol, decimals: siloConfig.tokenDecimals }}
        explorerUrl={explorerUrl}
        tokenVerification={tokenVerification || null}
        addressInJsonVerification={addressInJsonVerification}
        addressVersions={addressVersions}
        showAddressVersion={false}
      />
      <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
        <TreeNode
          label="Protected Share Token"
          address={siloConfig.protectedShareToken}
          bulletItems={buildShareTokenMetaBullet(
            siloConfig.protectedShareTokenSymbol,
            siloConfig.protectedShareTokenDecimals,
            siloConfig.protectedShareTokenOffset
          )}
          explorerUrl={explorerUrl}
          addressVersions={addressVersions}
        />
        <TreeNode
          label="Collateral Share Token"
          address={siloConfig.collateralShareToken}
          bulletItems={buildShareTokenMetaBullet(
            siloConfig.collateralShareTokenSymbol,
            siloConfig.collateralShareTokenDecimals,
            siloConfig.collateralShareTokenOffset
          )}
          explorerUrl={explorerUrl}
          addressVersions={addressVersions}
        />
        <TreeNode
          label="Debt Share Token"
          address={siloConfig.debtShareToken}
          bulletItems={buildShareTokenMetaBullet(
            siloConfig.debtShareTokenSymbol,
            siloConfig.debtShareTokenDecimals,
            siloConfig.debtShareTokenOffset
          )}
          explorerUrl={explorerUrl}
          addressVersions={addressVersions}
        />
      </TreeNode>
      <TreeNode
        label="Solvency Oracle"
        address={siloConfig.solvencyOracle.address}
        suffixText={siloConfig.solvencyOracle.version}
        bulletItems={(() => {
          const underlying = siloConfig.solvencyOracle.underlying
          const hasPTLinearUnderlying = Boolean(underlying && ptOracleBaseDiscount)
          // When underlying is PT-Linear: exclude base discount from top-level, show it nested under underlying
          const solvencyConfigForBullets = !underlying || hasPTLinearUnderlying
            ? (siloConfig.solvencyOracle.config as Record<string, unknown> | undefined)
            : undefined
          const base = buildOracleBullets(
            isSolvencyOracleZero ? undefined : siloConfig.solvencyOracle.quotePrice,
            siloConfig.solvencyOracle.quoteTokenSymbol,
            siloConfig.solvencyOracle.type,
            solvencyConfigForBullets,
            { excludeBaseDiscount: hasPTLinearUnderlying }
          )
          if (isSolvencyOracleZero && solvencyOraclePriceRawForVerification != null) {
            const effectiveQuoteTokenSymbol =
              siloConfig.solvencyOracle.quoteTokenSymbol || siloConfig.tokenSymbol
            base.unshift({
              key: ORACLE_BULLET_KEYS.PRICE,
              text: (
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="font-medium">Price is:</span>
                  <span className="irm-config-name-chip">
                    {formatQuotePriceAs18Decimals(solvencyOraclePriceRawForVerification)}
                  </span>
                  {effectiveQuoteTokenSymbol && (
                    <span className="text-gray-300 text-sm">{effectiveQuoteTokenSymbol}</span>
                  )}
                </span>
              )
            })
          }
          if (underlying) {
            base.push({
              key: `oracle.manageable.underlying.${siloKey}.solvency`,
              text: (
                <>
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span>Underlying oracle:</span>
                    <a
                      href={`${explorerUrl}/address/${underlying.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lime-600 hover:text-lime-500 font-mono text-sm"
                    >
                      {formatAddress(underlying.address)}
                    </a>
                    <CopyButton
                      value={underlying.address}
                      title="Copy address"
                      iconClassName="w-3.5 h-3.5 inline align-middle"
                    />
                    <VersionStatus version={underlying.version} />
                  </span>
                    {hasPTLinearUnderlying && ptOracleBaseDiscount && (
                    <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
                      <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span>Base discount per year:</span>
                        <span className="irm-config-name-chip">
                          {formatPercentage(ptOracleBaseDiscount.onChain)}
                        </span>
                        <span className="text-gray-500 text-xs font-normal">({formatWizardBigIntToE18(ptOracleBaseDiscount.onChain, true)})</span>
                        {(() => {
                          const isMatch = ptOracleBaseDiscount.wizard !== null && verifyNumericValue(ptOracleBaseDiscount.onChain, ptOracleBaseDiscount.wizard)
                          const outOfRange = isBaseDiscountPercentOutOfRange(ptOracleBaseDiscount.onChain)
                          const status = ptOracleBaseDiscount.wizard === null
                            ? VERIFICATION_STATUS.NOT_AVAILABLE
                            : isMatch && !outOfRange
                              ? VERIFICATION_STATUS.PASSED
                              : VERIFICATION_STATUS.FAILED
                          return (
                            <>
                              <span className="text-gray-500 text-xs">
                                {status === VERIFICATION_STATUS.PASSED && 'matches Wizard'}
                                {status === VERIFICATION_STATUS.FAILED && (outOfRange ? 'out of range' : 'does not match Wizard')}
                                {status === VERIFICATION_STATUS.NOT_AVAILABLE && 'N/A'}
                              </span>
                              <VerificationStatusIconSmall status={status} />
                            </>
                          )
                        })()}
                      </li>
                    </ul>
                  )}
                  {renderChainlinkAggregatorsForConfig(
                    siloConfig.solvencyOracle.config as Record<string, unknown> | undefined,
                    explorerUrl
                  )}
                </>
              )
            })
          }
          const solvencyVersion = siloConfig.solvencyOracle.version
          const timelockSecondsSolvency =
            siloConfig.solvencyOracle.timelockSeconds ?? manageableOracleTimelockSeconds
          if (isManageableOracleByVersion(solvencyVersion) && timelockSecondsSolvency != null && timelockSecondsSolvency > 0) {
            base.push({
              key: `oracle.manageable.timelock.${siloKey}.solvency`,
              text: formatTimelockBulletText(timelockSecondsSolvency)
            })
          }
          return base
        })()}
        priceLowWarning={isPriceUnexpectedlyLow(solvencyOraclePriceRawForVerification)}
        priceHighWarning={isPriceUnexpectedlyHigh(solvencyOraclePriceRawForVerification)}
        priceDecimalsWarning={isPriceDecimalsInvalid(solvencyOraclePriceRawForVerification)}
        baseDiscountVerification={ptOracleBaseDiscount ?? null}
        explorerUrl={explorerUrl}
        addressVersions={addressVersions}
        ownerBullets={
          siloConfig.solvencyOracle.owner
            ? [
                {
                  address: siloConfig.solvencyOracle.owner,
                  isContract: siloConfig.solvencyOracle.ownerIsContract,
                  name: siloConfig.solvencyOracle.ownerName
                }
              ]
            : undefined
        }
        oracleOwnerVerification={oracleOwnerVerification ?? undefined}
      />
      {!siloConfig.maxLtvOracle.address || siloConfig.maxLtvOracle.address === ethers.ZeroAddress ? (
        <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} addressVersions={addressVersions} />
      ) : siloConfig.maxLtvOracle.address.toLowerCase() === siloConfig.solvencyOracle.address.toLowerCase() ? (
        <TreeNode label="Max LTV Oracle" value="Same as Solvency Oracle" explorerUrl={explorerUrl} valueMuted />
      ) : (
        <TreeNode
          label="Max LTV Oracle"
          address={siloConfig.maxLtvOracle.address}
          suffixText={siloConfig.maxLtvOracle.version}
          bulletItems={(() => {
            const underlying = siloConfig.maxLtvOracle.underlying
            const maxLtvConfig = siloConfig.maxLtvOracle.config as Record<string, unknown> | undefined
            const hasPTLinearUnderlying = Boolean(underlying && maxLtvConfig && typeof maxLtvConfig.baseDiscountPerYear !== 'undefined')
            const maxLtvConfigForBullets = !underlying || hasPTLinearUnderlying
              ? maxLtvConfig
              : undefined
            const base = buildOracleBullets(
              siloConfig.maxLtvOracle.quotePrice,
              siloConfig.maxLtvOracle.quoteTokenSymbol,
              siloConfig.maxLtvOracle.type,
              maxLtvConfigForBullets,
              { excludeBaseDiscount: hasPTLinearUnderlying }
            )
            if (underlying) {
              base.push({
                key: `oracle.manageable.underlying.${siloKey}.maxLtv`,
                text: (
                  <>
                    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>Underlying oracle:</span>
                      <a
                        href={`${explorerUrl}/address/${underlying.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lime-600 hover:text-lime-500 font-mono text-sm"
                      >
                        {formatAddress(underlying.address)}
                      </a>
                      <CopyButton
                        value={underlying.address}
                        title="Copy address"
                        iconClassName="w-3.5 h-3.5 inline align-middle"
                      />
                      <VersionStatus version={underlying.version} />
                    </span>
                    {hasPTLinearUnderlying && maxLtvConfig?.baseDiscountPerYear != null && (
                      <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
                        <li>
                          <span>Base discount per year:</span>{' '}
                          <span className="irm-config-name-chip">
                            {formatPercentage(BigInt(String(maxLtvConfig.baseDiscountPerYear)))}
                          </span>
                          <span className="text-gray-500 text-xs font-normal">({formatWizardBigIntToE18(BigInt(String(maxLtvConfig.baseDiscountPerYear)), true)})</span>
                        </li>
                      </ul>
                    )}
                    {renderChainlinkAggregatorsForConfig(maxLtvConfig, explorerUrl)}
                  </>
                )
              })
            }
            const maxLtvVersion = siloConfig.maxLtvOracle.version
            const timelockSecondsMaxLtv =
              siloConfig.maxLtvOracle.timelockSeconds ?? manageableOracleTimelockSeconds
            if (isManageableOracleByVersion(maxLtvVersion) && timelockSecondsMaxLtv != null && timelockSecondsMaxLtv > 0) {
              base.push({
                key: `oracle.manageable.timelock.${siloKey}.maxLtv`,
                text: formatTimelockBulletText(timelockSecondsMaxLtv)
              })
            }
            return base
          })()}
          priceLowWarning={isPriceUnexpectedlyLow(siloConfig.maxLtvOracle.quotePrice)}
          priceHighWarning={isPriceUnexpectedlyHigh(siloConfig.maxLtvOracle.quotePrice)}
          priceDecimalsWarning={isPriceDecimalsInvalid(siloConfig.maxLtvOracle.quotePrice)}
          explorerUrl={explorerUrl}
          addressVersions={addressVersions}
        />
      )}
      <TreeNode
        label="Interest Rate Model"
        address={siloConfig.interestRateModel.address}
        suffixText={siloConfig.interestRateModel.version}
        bulletItems={(() => {
          const bullets: OracleBulletItem[] = []
          const irm = siloConfig.interestRateModel
          const irmCfg = irm.config as Record<string, unknown> | undefined

          // 1. Timelock, CAP, Owner first (per user request)
          const timelockRaw = irmCfg?.timelock
          if (timelockRaw != null) {
            const seconds = Number(timelockRaw)
            if (!Number.isNaN(seconds) && seconds > 0) {
              bullets.push({ key: `irm.timelock.${siloKey}`, text: formatTimelockBulletText(seconds) })
            }
          }

          const capRaw = (irmCfg?.rcompCapPerSecond ?? irmCfg?.rcompCap) as unknown
          if (capRaw != null) {
            const capStr = String(capRaw)
            if (/^\d+$/.test(capStr)) {
              const secondsPerYear = BigInt(365 * 86400)
              const yearlyCapRaw = (BigInt(capStr) * secondsPerYear).toString()
              bullets.push({
                key: `irm.cap.${siloKey}`,
                text: (() => {
                  const valueBigInt = BigInt(yearlyCapRaw)
                  const scale = BigInt(10 ** 16) // 1e16 as in formatPercentage
                  const percent = Number(valueBigInt / scale)
                  const rounded = Math.round(percent)
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      <span>CAP yearly:</span>
                      <span className="text-gray-400 text-sm font-mono">{rounded}%</span>
                    </span>
                  )
                })()
              })
            }
          }

          if (irm.owner) {
            bullets.push({
              key: `irm.owner.${siloKey}`,
              text: (
                <OwnerBulletContent
                  item={{
                    address: irm.owner,
                    isContract: irm.ownerIsContract,
                    name: irm.ownerName
                  }}
                  explorerUrl={explorerUrl}
                  irmOwnerVerification={irmOwnerVerification}
                  addressInJsonVerification={addressInJsonVerification}
                />
              )
            })
          }

          // 2. IRM config with nested Pending and History (same indent level)
          const name = irmConfigName ?? null
          const hasPendingOrHistory = pendingIrmInfo != null || irmConfigHistory != null
          bullets.push({
            key: `irm.configName.${siloKey}`,
            text: (
              <>
                {name ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>IRM config:</span>
                    <IrmConfigNameWithLink configName={name} variant="emphasized" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span>IRM config: not able to match</span>
                    <VerificationStatusIconSmall status={VERIFICATION_STATUS.FAILED} />
                  </span>
                )}
                {hasPendingOrHistory && (
                  <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
                    {pendingIrmInfo != null && (
                      <li>
                        {pendingIrmInfo.activateAt == null ? (
                          <span>Pending IRM config: no pending config</span>
                        ) : (
                          (() => {
                            const activateAt = pendingIrmInfo.activateAt
                            const utcDate = new Date(activateAt * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
                            const nowSec = Math.floor(Date.now() / 1000)
                            const diffSec = activateAt - nowSec
                            const hours = Math.floor(diffSec / 3600)
                            const minutes = Math.floor((diffSec % 3600) / 60)
                            const countdown =
                              diffSec <= 0 ? 'already active' : `in ${hours} hours and ${minutes} minutes`
                            const pendingName = pendingIrmInfo.name ?? 'not able to match'
                            return (
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <span>Pending IRM config:</span>
                                <IrmConfigNameWithLink configName={pendingName} variant="normal" />
                                <span>– active at {utcDate} ({countdown})</span>
                              </span>
                            )
                          })()
                        )}
                      </li>
                    )}
                    {irmConfigHistory != null && (
                      <li>
                        <span>history:</span>
                        {irmConfigHistory.length === 0 ? (
                          <span className="text-gray-500 text-sm ml-1">(empty)</span>
                        ) : (
                          <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
                            {irmConfigHistory.map((histName, i) => (
                              <li key={i}>
                                <span className="inline-flex items-center gap-1.5">
                                  <IrmConfigNameWithLink configName={histName} variant="normal" />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )}
                  </ul>
                )}
              </>
            )
          })

          return bullets.length > 0 ? bullets : undefined
        })()}
        ownerBullets={[]}
        explorerUrl={explorerUrl}
        hookOwnerVerification={irmOwnerVerification ? undefined : hookOwnerVerification}
        irmOwnerVerification={irmOwnerVerification}
        addressInJsonVerification={addressInJsonVerification}
        addressVersions={addressVersions}
      />
      <TreeNode
        label="Max LTV"
        value={siloConfig.maxLtv}
        explorerUrl={explorerUrl}
        isPercentage
        numericValueVerification={numeric ? { wizardValue: numeric.maxLtv } : undefined}
        wizardDaoFee={wizardDaoFee ?? null}
        wizardDeployerFee={wizardDeployerFee ?? null}
      />
      <TreeNode
        label="Liquidation Threshold (LT)"
        value={siloConfig.lt}
        explorerUrl={explorerUrl}
        isPercentage
        numericValueVerification={numeric ? { wizardValue: numeric.lt } : undefined}
        wizardDaoFee={wizardDaoFee ?? null}
        wizardDeployerFee={wizardDeployerFee ?? null}
      />
      <TreeNode
        label="Liquidation Target LTV"
        value={siloConfig.liquidationTargetLtv}
        explorerUrl={explorerUrl}
        isPercentage
        numericValueVerification={numeric ? { wizardValue: numeric.liquidationTargetLtv } : undefined}
        wizardDaoFee={wizardDaoFee ?? null}
        wizardDeployerFee={wizardDeployerFee ?? null}
      />
      <TreeNode
        label="Liquidation Fee"
        value={siloConfig.liquidationFee}
        explorerUrl={explorerUrl}
        isPercentage
        numericValueVerification={numeric ? { wizardValue: numeric.liquidationFee, checkHighValue: true } : undefined}
        wizardDaoFee={wizardDaoFee ?? null}
        wizardDeployerFee={wizardDeployerFee ?? null}
      />
      <TreeNode
        label="Flashloan Fee"
        value={siloConfig.flashloanFee}
        explorerUrl={explorerUrl}
        isPercentage
        numericValueVerification={numeric ? { wizardValue: numeric.flashloanFee, checkHighValue: true } : undefined}
        wizardDaoFee={wizardDaoFee ?? null}
        wizardDeployerFee={wizardDeployerFee ?? null}
      />
      <TreeNode
        label="Call Before Quote"
        value={siloConfig.callBeforeQuote}
        explorerUrl={explorerUrl}
        callBeforeQuoteVerification={callBeforeQuoteVerification ?? null}
      />
    </TreeNode>
  )
}

/** Version string contains "ManageableOracle" (e.g. "ManageableOracle 1.2.3") */
function isManageableOracleByVersion(version: string | undefined): boolean {
  return version != null && version !== '' && version.toLowerCase().includes('manageableoracle')
}

function renderChainlinkAggregatorsForConfig(
  config: Record<string, unknown> | undefined,
  explorerUrl: string
): React.ReactNode | null {
  if (!config || typeof config !== 'object') return null
  if (!Object.prototype.hasOwnProperty.call(config, 'primaryAggregator')) return null

  const cfg = config as Record<string, unknown>
  const primaryAggregator = cfg.primaryAggregator as string | undefined
  const primaryDesc = cfg.primaryAggregatorDescription as string | undefined
  const secondaryAggregator = cfg.secondaryAggregator as string | undefined
  const secondaryDesc = cfg.secondaryAggregatorDescription as string | undefined

  if (!primaryAggregator && !secondaryAggregator) return null

  return (
    <ul className="tree-bullet-list list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
      {primaryAggregator && ethers.isAddress(primaryAggregator) && (
        <li>
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>Primary Aggregator:</span>
            <a
              href={`${explorerUrl}/address/${primaryAggregator}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-600 hover:text-lime-500 font-mono text-sm"
            >
              {formatAddress(primaryAggregator)}
            </a>
            <CopyButton
              value={primaryAggregator}
              title="Copy primary aggregator address"
              iconClassName="w-3.5 h-3.5 inline align-middle"
            />
            {primaryDesc && primaryDesc !== '' && (
              <span className="text-gray-400 text-sm">({primaryDesc})</span>
            )}
          </span>
        </li>
      )}
      <li>
        {secondaryAggregator && ethers.isAddress(secondaryAggregator) && secondaryAggregator !== ethers.ZeroAddress ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>Secondary Aggregator:</span>
            <a
              href={`${explorerUrl}/address/${secondaryAggregator}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-600 hover:text-lime-500 font-mono text-sm"
            >
              {formatAddress(secondaryAggregator)}
            </a>
            <CopyButton
              value={secondaryAggregator}
              title="Copy secondary aggregator address"
              iconClassName="w-3.5 h-3.5 inline align-middle"
            />
            {secondaryDesc && secondaryDesc !== '' && (
              <span className="text-gray-400 text-sm">({secondaryDesc})</span>
            )}
          </span>
        ) : (
          <span>Secondary aggregator: empty</span>
        )}
      </li>
    </ul>
  )
}

function formatTimelockBulletText(seconds: number): React.ReactNode {
  const days = Math.round(seconds / 86400)
  const daysLabel = `${days} ${days === 1 ? 'day' : 'days'}`
  const secondsLabel = `${seconds.toLocaleString()} seconds`
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>Timelock:</span>
      <span className="text-white text-sm font-mono">{daysLabel}</span>
      <span className="text-gray-500 text-xs font-normal">({secondsLabel})</span>
    </span>
  )
}

export default function MarketConfigTree({ config, explorerUrl, chainId, currentSiloFactoryAddress, wizardDaoFee, wizardDeployerFee, siloVerification, hookOwnerVerification, irmOwnerVerification, oracleOwnerVerification, tokenVerification, numericValueVerification, addressInJsonVerification = new Map(), addressVersions = new Map(), ptOracleBaseDiscountVerification, callBeforeQuoteVerification, manageableOracleTimelockSeconds, irmConfigNames, pendingIrmInfo, irmConfigHistory, hookGaugeInfo }: MarketConfigTreeProps) {
  const asset0Symbol = config.silo0.tokenSymbol || 'ASSET0'
  const asset1Symbol = config.silo1.tokenSymbol || 'ASSET1'
  const marketId = config.siloId != null ? config.siloId.toString() : 'N/A'
  const marketName = `${asset0Symbol} / ${asset1Symbol} #${marketId}`

  const renderSiloFactoryBullet = (siloFactoryAddress?: string) => {
    if (!siloFactoryAddress || siloFactoryAddress === ethers.ZeroAddress) {
      return (
        <span className="inline-flex items-center gap-1">
          Factory: <span className="text-gray-500">N/A</span>
        </span>
      )
    }

    const verificationStatus = !currentSiloFactoryAddress
      ? VERIFICATION_STATUS.NOT_AVAILABLE
      : verifyAddress(siloFactoryAddress, currentSiloFactoryAddress)
        ? VERIFICATION_STATUS.PASSED
        : VERIFICATION_STATUS.FAILED
    const version = addressVersions.get(siloFactoryAddress.toLowerCase()) ?? '—'

    return (
      <>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>Factory:</span>
          <AddressDisplayShort
            address={siloFactoryAddress}
            chainId={chainId}
            className="text-sm"
            showVersion={false}
          />
          <span className="text-version-muted text-sm ml-1">
            ({version})
          </span>
        </span>
        <ul className="tree-bullet-list list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
          <li className="flex items-center">
            <span>Silo factory verification:</span>
            {verificationStatus === VERIFICATION_STATUS.PASSED && (
              <span className="text-gray-500 ml-1">matches current Silo Factory</span>
            )}
            {verificationStatus === VERIFICATION_STATUS.FAILED && (
              <span className="text-gray-500 ml-1">does not match current Silo Factory</span>
            )}
            {verificationStatus === VERIFICATION_STATUS.NOT_AVAILABLE && (
              <span className="text-gray-500 ml-1">N/A</span>
            )}
            <VerificationStatusIconSmall status={verificationStatus} />
          </li>
        </ul>
      </>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 px-6 pt-6 pb-2">
      <h3 className="text-lg font-semibold text-white mb-4">
        Market Configuration Tree:{' '}
        <span className="text-lime-300">{marketName}</span>
      </h3>
      
      <ol className="tree">
        <TreeNode label="SILO CONFIG" isRoot address={config.siloConfig} explorerUrl={explorerUrl} addressVersions={addressVersions} sectionTokenLabel="config">
          <TreeNode label="Immutable variables" explorerUrl={explorerUrl}>
            {config.siloId !== null && (
              <TreeNode label="SILO_ID" value={config.siloId} explorerUrl={explorerUrl} />
            )}
            <TreeNode label="Silos" explorerUrl={explorerUrl}>
              <TreeNode 
                label="silo0" 
                address={config.silo0.silo} 
                explorerUrl={explorerUrl}
                addressVersions={addressVersions}
                bulletItems={[
                  {
                    key: 'factory',
                    text: renderSiloFactoryBullet(config.silo0.factory)
                  },
                  { 
                    key: 'verification', 
                    text: (
                      <span className="inline-flex items-center gap-1">
                        Address verified in current Silo Factory:
                        <VerificationStatusIconSmall status={
                          siloVerification?.silo0 === true
                            ? VERIFICATION_STATUS.PASSED
                            : siloVerification?.silo0 === false
                              ? VERIFICATION_STATUS.FAILED
                              : VERIFICATION_STATUS.PENDING
                        } />
                      </span>
                    )
                  }
                ]}
              />
              <TreeNode 
                label="silo1" 
                address={config.silo1.silo} 
                explorerUrl={explorerUrl}
                addressVersions={addressVersions}
                bulletItems={[
                  {
                    key: 'factory',
                    text: renderSiloFactoryBullet(config.silo1.factory)
                  },
                  { 
                    key: 'verification', 
                    text: (
                      <span className="inline-flex items-center gap-1">
                        Address verified in current Silo Factory:
                        <VerificationStatusIconSmall status={
                          siloVerification?.silo1 === true 
                            ? VERIFICATION_STATUS.PASSED 
                            : siloVerification?.silo1 === false 
                              ? VERIFICATION_STATUS.FAILED 
                              : VERIFICATION_STATUS.PENDING
                        } />
                      </span>
                    )
                  }
                ]}
              />
            </TreeNode>
          </TreeNode>
          <TreeNode 
            label="DAO Fee" 
            value={config.silo0.daoFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            wizardDaoFee={wizardDaoFee ?? null}
          />
          <TreeNode 
            label="Deployer Fee" 
            value={config.silo0.deployerFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode
            label="Hook Receiver"
            address={config.silo0.hookReceiver}
            suffixText={config.silo0.hookReceiverVersion}
            ownerBullets={config.silo0.hookReceiverOwner ? [{ address: config.silo0.hookReceiverOwner, isContract: config.silo0.hookReceiverOwnerIsContract, name: config.silo0.hookReceiverOwnerName }] : undefined}
            explorerUrl={explorerUrl}
            hookOwnerVerification={hookOwnerVerification}
            addressInJsonVerification={addressInJsonVerification}
            addressVersions={addressVersions}
            bulletItems={
              hookGaugeInfo && hookGaugeInfo.hasDefaultingHook
                ? (() => {
                    const bullets: OracleBulletItem[] = []

                    // 1) Defaulting hook state (ON) – value highlighted as chip
                    bullets.push({
                      key: 'hook.defaulting.state',
                      text: (
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span>Liquidation by defaulting:</span>
                          <span className="irm-config-name-chip">on</span>
                        </span>
                      )
                    })

                    const gaugeRequired = hookGaugeInfo.onlyOneBorrowable === true
                    const gaugeConfigured =
                      gaugeRequired &&
                      hookGaugeInfo.gaugeAddress &&
                      hookGaugeInfo.gaugeAddress !== ethers.ZeroAddress

                    if (gaugeRequired) {
                      bullets.push({
                        key: 'hook.defaulting.gauge.required',
                        text: (
                          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>
                              Silo Incentive Controller:{' '}
                              {gaugeConfigured
                                ? 'required and configured correctly'
                                : 'required and missing'}
                            </span>
                            <VerificationStatusIconSmall
                              status={
                                gaugeConfigured
                                  ? VERIFICATION_STATUS.PASSED
                                  : VERIFICATION_STATUS.FAILED
                              }
                            />
                          </span>
                        )
                      })
                    }

                    // 2) Borrowable assets summary – value highlighted as chip
                    if (hookGaugeInfo.onlyOneBorrowable === false) {
                      const borrowableLabel = `both ${asset0Symbol}, ${asset1Symbol}`
                      bullets.push({
                        key: 'hook.defaulting.borrowable.assets',
                        text: (
                          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>Borrowable assets:</span>
                            <span className="irm-config-name-chip">{borrowableLabel}</span>
                            <VerificationStatusIconSmall status={VERIFICATION_STATUS.FAILED} />
                          </span>
                        )
                      })
                    } else if (hookGaugeInfo.onlyOneBorrowable && hookGaugeInfo.borrowableTokenSymbol) {
                      const borrowableLabel = `only ${hookGaugeInfo.borrowableTokenSymbol}`
                      bullets.push({
                        key: 'hook.defaulting.borrowable.assets',
                        text: (
                          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>Borrowable assets:</span>
                            <span className="irm-config-name-chip">{borrowableLabel}</span>
                          </span>
                        )
                      })
                    }
                    if (hookGaugeInfo.borrowableSilo !== null) {
                      if (!hookGaugeInfo.gaugeAddress || hookGaugeInfo.gaugeAddress === ethers.ZeroAddress) {
                        bullets.push({
                          key: 'hook.defaulting.gauge.missing',
                          text: (
                            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span>Missing Silo Incentives Controller (gauge not configured for borrowable silo).</span>
                              <VerificationStatusIconSmall status={VERIFICATION_STATUS.FAILED} />
                            </span>
                          )
                        })
                      } else {
                        const gv = hookGaugeInfo.gaugeVerification
                        bullets.push({
                          key: 'hook.defaulting.gauge.ok',
                          text: (
                            <>
                              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span>Silo Incentive Controller:</span>
                                <a
                                  href={`${explorerUrl}/address/${hookGaugeInfo.gaugeAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-lime-600 hover:text-lime-500 font-mono text-sm"
                                >
                                  {formatAddress(hookGaugeInfo.gaugeAddress)}
                                </a>
                                <CopyButton
                                  value={hookGaugeInfo.gaugeAddress}
                                  title="Copy address"
                                  iconClassName="w-3.5 h-3.5 inline align-middle"
                                />
                                <VersionStatus version={hookGaugeInfo.gaugeVersion || '—'} />
                              </span>
                              {gv && (
                                <ul className="tree-bullet-list gauge-verification-list list-disc list-inside ml-6 mt-1 text-gray-400 text-sm">
                                  <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-1">
                                    <span>Gauge owner in repository list:</span>
                                    {gv.ownerInJson === true && (
                                      <span className="text-gray-500 ml-1">{gv.ownerName ? `yes (${gv.ownerName})` : 'yes'}</span>
                                    )}
                                    {gv.ownerInJson === false && (
                                      <span className="text-gray-500 ml-1">not in Silo Finance repository list</span>
                                    )}
                                    {gv.ownerInJson === null && (
                                      <span className="text-gray-500 ml-1">verification pending</span>
                                    )}
                                    <VerificationStatusIconSmall status={
                                      gv.ownerInJson === null ? VERIFICATION_STATUS.PENDING
                                        : gv.ownerInJson ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.WARNING
                                    } />
                                  </li>
                                  <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-1">
                                    <span>Gauge owner equals hook owner:</span>
                                    {gv.ownerMatchesHookOwner === true && <span className="text-gray-500 ml-1">yes</span>}
                                    {gv.ownerMatchesHookOwner === false && <span className="text-gray-500 ml-1">no</span>}
                                    {gv.ownerMatchesHookOwner === null && <span className="text-gray-500 ml-1">N/A</span>}
                                    <VerificationStatusIconSmall status={
                                      gv.ownerMatchesHookOwner === null ? VERIFICATION_STATUS.NOT_AVAILABLE
                                        : gv.ownerMatchesHookOwner ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
                                    } />
                                  </li>
                                  <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-1">
                                    <span>Gauge owner matches Wizard:</span>
                                    {gv.ownerMatchesWizard === true && <span className="text-gray-500 ml-1">yes</span>}
                                    {gv.ownerMatchesWizard === false && <span className="text-gray-500 ml-1">no</span>}
                                    {gv.ownerMatchesWizard === null && <span className="text-gray-500 ml-1">N/A</span>}
                                    <VerificationStatusIconSmall status={
                                      gv.ownerMatchesWizard === null ? VERIFICATION_STATUS.NOT_AVAILABLE
                                        : gv.ownerMatchesWizard ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
                                    } />
                                  </li>
                                  <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-1">
                                    <span>Notifier equals hook address:</span>
                                    {gv.notifierEqualsHook === true && <span className="text-gray-500 ml-1">yes</span>}
                                    {gv.notifierEqualsHook === false && <span className="text-gray-500 ml-1">no</span>}
                                    {gv.notifierEqualsHook === null && <span className="text-gray-500 ml-1">verification pending</span>}
                                    <VerificationStatusIconSmall status={
                                      gv.notifierEqualsHook === null ? VERIFICATION_STATUS.PENDING
                                        : gv.notifierEqualsHook ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
                                    } />
                                  </li>
                                </ul>
                              )}
                            </>
                          )
                        })
                      }
                    }
                    if (hookGaugeInfo.ltMarginForDefaultingRaw) {
                      const ltMarginBigInt = BigInt(hookGaugeInfo.ltMarginForDefaultingRaw)
                      bullets.push({
                        key: 'hook.defaulting.ltMargin',
                        text: (
                          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>LT margin for defaulting:</span>
                            <span className="irm-config-name-chip">{formatPercentage(ltMarginBigInt)}</span>
                            <span className="text-gray-500 text-xs font-normal">({formatBigIntToE18(ltMarginBigInt, true)})</span>
                          </span>
                        )
                      })
                    }
                    return bullets
                  })()
                : undefined
            }
          />
        </TreeNode>
        <li className="tree-separator" aria-hidden="true" />

        <SiloSection
          side={0}
          label="SILO 0"
          assetSymbol={asset0Symbol}
          siloConfig={config.silo0}
          explorerUrl={explorerUrl}
          addressVersions={addressVersions}
          addressInJsonVerification={addressInJsonVerification}
          tokenVerification={tokenVerification?.token0 || null}
          numericVerification={numericValueVerification?.silo0 ?? undefined}
          ptOracleBaseDiscount={ptOracleBaseDiscountVerification?.silo0}
          callBeforeQuoteVerification={callBeforeQuoteVerification?.silo0}
          oracleOwnerVerification={oracleOwnerVerification?.silo0 ?? null}
          irmConfigName={irmConfigNames?.silo0 ?? null}
          pendingIrmInfo={pendingIrmInfo?.silo0 ?? null}
          irmConfigHistory={irmConfigHistory?.silo0 ?? null}
          hookOwnerVerification={hookOwnerVerification}
          irmOwnerVerification={irmOwnerVerification}
          wizardDaoFee={wizardDaoFee ?? null}
          wizardDeployerFee={wizardDeployerFee ?? null}
          manageableOracleTimelockSeconds={manageableOracleTimelockSeconds}
        />
        <li className="tree-separator" aria-hidden="true" />

        <SiloSection
          side={1}
          label="SILO 1"
          assetSymbol={asset1Symbol}
          siloConfig={config.silo1}
          explorerUrl={explorerUrl}
          addressVersions={addressVersions}
          addressInJsonVerification={addressInJsonVerification}
          tokenVerification={tokenVerification?.token1 || null}
          numericVerification={numericValueVerification?.silo1 ?? undefined}
          ptOracleBaseDiscount={ptOracleBaseDiscountVerification?.silo1}
          callBeforeQuoteVerification={callBeforeQuoteVerification?.silo1}
          oracleOwnerVerification={oracleOwnerVerification?.silo1 ?? null}
          irmConfigName={irmConfigNames?.silo1 ?? null}
          pendingIrmInfo={pendingIrmInfo?.silo1 ?? null}
          irmConfigHistory={irmConfigHistory?.silo1 ?? null}
          hookOwnerVerification={hookOwnerVerification}
          irmOwnerVerification={irmOwnerVerification}
          wizardDaoFee={wizardDaoFee ?? null}
          wizardDeployerFee={wizardDeployerFee ?? null}
          manageableOracleTimelockSeconds={manageableOracleTimelockSeconds}
        />
      </ol>
    </div>
  )
}
