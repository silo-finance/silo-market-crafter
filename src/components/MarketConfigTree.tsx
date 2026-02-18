'use client'

import React from 'react'
import { MarketConfig, formatPercentage, formatAddress, formatQuotePriceAs18Decimals, formatRate18AsPercent } from '@/utils/fetchMarketConfig'
import { formatWizardBigIntToE18 } from '@/utils/formatting'
import CopyButton from '@/components/CopyButton'
import AddressDisplayShort from '@/components/AddressDisplayShort'
import { ethers } from 'ethers'
import { isPriceUnexpectedlyLow, isPriceUnexpectedlyHigh, isPriceDecimalsInvalid, isBaseDiscountPercentOutOfRange, verifyAddress, verifyNumericValue } from '@/utils/verification'
import { VERIFICATION_STATUS } from '@/utils/verification/buildVerificationChecks'


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

function buildOracleBullets(
  quotePrice: string | undefined,
  quoteTokenSymbol: string | undefined,
  type: string | undefined,
  config: Record<string, unknown> | undefined
): OracleBulletItem[] {
  const bullets: OracleBulletItem[] = []
  if (quotePrice != null && quotePrice !== '') {
    const priceStr = formatQuotePriceAs18Decimals(quotePrice)
    const withSymbol = quoteTokenSymbol ? `${priceStr} ${quoteTokenSymbol}` : priceStr
    bullets.push({ key: ORACLE_BULLET_KEYS.PRICE, text: `Price (1 token): ${withSymbol}` })
  }
  if (type) {
    bullets.push({ key: ORACLE_BULLET_KEYS.TYPE, text: `Type: ${type}` })
  }
  if (config && typeof config === 'object') {
    for (const [configKey, val] of Object.entries(config)) {
      if (/quoteToken/i.test(configKey)) continue
      const raw = typeof val === 'string' ? val : String(val)
      const isFactor = /scaleFactor|factor/i.test(configKey)
      const isBaseDiscount = /baseDiscount/i.test(configKey)
      let display: string
      if (isBaseDiscount && /^\d+$/.test(raw)) {
        display = formatRate18AsPercent(raw)
      } else if (isFactor && /^\d+$/.test(raw)) {
        display = formatFactorToE(raw)
      } else {
        display = raw
      }
      const label = configKey.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
      const text = raw.startsWith('0x') && raw.length === 42
        ? `${label}: ${formatAddress(raw)}`
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
  tokenVerification?: TokenVerification
  numericValueVerification?: NumericValueVerification
  addressInJsonVerification?: Map<string, boolean>
  addressVersions?: Map<string, string>
  ptOracleBaseDiscountVerification?: PTOracleBaseDiscountVerification
  callBeforeQuoteVerification?: CallBeforeQuoteVerification
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

function OwnerBulletContent({ item, explorerUrl, hookOwnerVerification, irmOwnerVerification, addressInJsonVerification }: { item: OwnerBulletItem; explorerUrl: string; hookOwnerVerification?: HookOwnerVerification; irmOwnerVerification?: IRMOwnerVerification; addressInJsonVerification?: Map<string, boolean> }) {
  const { address, isContract, name } = item
  if (!address || address === ethers.ZeroAddress) return null
  
  // Normalize the address from item
  const normalizedItemAddress = ethers.getAddress(address).toLowerCase()
  
  // Debug logging
  console.log('OwnerBulletContent - hookOwnerVerification:', hookOwnerVerification)
  console.log('OwnerBulletContent - irmOwnerVerification:', irmOwnerVerification)
  console.log('OwnerBulletContent - item.address:', address)
  console.log('OwnerBulletContent - normalizedItemAddress:', normalizedItemAddress)
  
  // Use centralized verification functions from src/utils/verification/
  // Check 1: Verify that on-chain owner matches wizard owner (independent check)
  // This check compares: onChainOwner === wizardOwner
  let isVerified: boolean | null = null
  if (hookOwnerVerification && hookOwnerVerification.onChainOwner && hookOwnerVerification.wizardOwner) {
    // Normalize addresses for comparison
    const normalizedOnChain = ethers.getAddress(hookOwnerVerification.onChainOwner).toLowerCase()
    const normalizedItem = normalizedItemAddress
    
    console.log('OwnerBulletContent - hook verification check:')
    console.log('  normalizedOnChain:', normalizedOnChain)
    console.log('  normalizedItem:', normalizedItem)
    console.log('  addresses match:', normalizedOnChain === normalizedItem)
    
    // Only verify if the displayed address matches the on-chain owner address
    if (normalizedOnChain === normalizedItem) {
      // Verify that on-chain owner matches wizard owner using centralized function
      // This is the independent check: onChainOwner === wizardOwner
      isVerified = verifyAddress(hookOwnerVerification.onChainOwner, hookOwnerVerification.wizardOwner)
      console.log('OwnerBulletContent - verifyAddress (hook owner) result:', isVerified)
    }
  } else if (irmOwnerVerification && irmOwnerVerification.onChainOwner && irmOwnerVerification.wizardOwner) {
    // Normalize addresses for comparison
    const normalizedOnChain = ethers.getAddress(irmOwnerVerification.onChainOwner).toLowerCase()
    const normalizedItem = normalizedItemAddress
    
    console.log('OwnerBulletContent - IRM verification check:')
    console.log('  normalizedOnChain:', normalizedOnChain)
    console.log('  normalizedItem:', normalizedItem)
    console.log('  addresses match:', normalizedOnChain === normalizedItem)
    
    // Only verify if the displayed address matches the on-chain owner address
    if (normalizedOnChain === normalizedItem) {
      // Verify that on-chain owner matches wizard owner using centralized function
      // This is the independent check: onChainOwner === wizardOwner
      isVerified = verifyAddress(irmOwnerVerification.onChainOwner, irmOwnerVerification.wizardOwner)
      console.log('OwnerBulletContent - verifyAddress (IRM owner) result:', isVerified)
    }
  }
  
  // Get JSON verification result - always available regardless of wizard data
  const isInJson = addressInJsonVerification?.get(normalizedItemAddress) ?? null
  
  console.log('OwnerBulletContent - final values:')
  console.log('  isVerified:', isVerified)
  console.log('  isInJson:', isInJson)
  
  // Determine verification statuses
  const wizardVsOnChainStatus = isVerified === null && (!hookOwnerVerification?.onChainOwner || !hookOwnerVerification?.wizardOwner) && (!irmOwnerVerification?.onChainOwner || !irmOwnerVerification?.wizardOwner)
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
  
  const ownerLabel = irmOwnerVerification ? 'IRM owner' : 'Hook owner'
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
      <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm space-y-0.5">
        <li className="flex items-center">
          <span>{ownerLabel} verification:</span>
          <VerificationStatusIconSmall status={wizardVsOnChainStatus} />
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
        </li>
        <li className="flex items-center">
          <span>{ownerLabel} address:</span>
          <VerificationStatusIconSmall status={addressInJsonStatus} />
          {addressInJsonStatus === VERIFICATION_STATUS.PASSED && (
            <span className="text-gray-500 ml-1">exists in Silo Finance repository list</span>
          )}
          {addressInJsonStatus === VERIFICATION_STATUS.WARNING && (
            <span className="text-gray-500 ml-1">does not exist in Silo Finance repository list</span>
          )}
          {addressInJsonStatus === VERIFICATION_STATUS.PENDING && (
            <span className="text-gray-500 ml-1">verification pending</span>
          )}
        </li>
      </ul>
    </>
  )
}

function TreeNode({ label, value, address, tokenMeta, suffixText, bulletItems, ownerBullets, children, explorerUrl, isPercentage, valueMuted, hookOwnerVerification, irmOwnerVerification, tokenVerification, numericValueVerification, addressInJsonVerification, addressVersions, showAddressVersion = true, priceLowWarning, priceHighWarning, priceDecimalsWarning, baseDiscountVerification, callBeforeQuoteVerification, wizardDaoFee, wizardDeployerFee }: TreeNodeProps & { wizardDaoFee?: bigint | null; wizardDeployerFee?: bigint | null }) {
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

  return (
    <li className="tree-item">
      <span className="tree-item-content">
        <span className="text-gray-300 text-sm font-medium">{label}:</span>
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
            {hasSuffix && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({versionText})
              </span>
            )}
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
            <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm space-y-0.5">
              <li className="flex items-center">
                <span>Token verification:</span>
                <VerificationStatusIconSmall status={tokenWizardVsOnChainStatus} />
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
              </li>
              <li className="flex items-center">
                <span>Token address:</span>
                <VerificationStatusIconSmall status={tokenAddressInJsonStatus} />
                {tokenAddressInJsonStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">exists in Silo Finance repository list</span>
                )}
                {tokenAddressInJsonStatus === VERIFICATION_STATUS.WARNING && (
                  <span className="text-gray-500 ml-1">does not exist in Silo Finance repository list</span>
                )}
                {tokenAddressInJsonStatus === VERIFICATION_STATUS.PENDING && (
                  <span className="text-gray-500 ml-1">verification pending</span>
                )}
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
              <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm space-y-0.5">
                <li className="flex items-center">
                  <span>Verification:</span>
                  <VerificationStatusIconSmall status={verificationStatus} />
                  <span className="text-gray-500 ml-1">N/A</span>
                </li>
              </ul>
            )
          }
          
          // At this point verificationStatus can only be PASSED or FAILED
          return (
            <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm space-y-0.5">
              <li className="flex items-center">
                <span>Verification:</span>
                <VerificationStatusIconSmall status={verificationStatus} />
                {verificationStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">matches Wizard value</span>
                )}
                {verificationStatus === VERIFICATION_STATUS.FAILED && (
                  <span className="text-gray-500 ml-1">does not match Wizard value</span>
                )}
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
            <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm space-y-0.5">
              <li className="flex items-center">
                <span>Verification:</span>
                <VerificationStatusIconSmall status={verificationStatus} />
                {verificationStatus === VERIFICATION_STATUS.PASSED && (
                  <span className="text-gray-500 ml-1">matches Wizard value</span>
                )}
                {verificationStatus === VERIFICATION_STATUS.FAILED && (
                  <span className="text-gray-500 ml-1">does not match Wizard value</span>
                )}
              </li>
            </ul>
          )
        })()}
      </span>
      {bulletItems && bulletItems.length > 0 && (
        <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {bulletItems.map((item, i) => {
            const isPriceLine = item.key === ORACLE_BULLET_KEYS.PRICE
            const isBaseDiscountBullet = baseDiscountVerification && item.key === ORACLE_BULLET_KEYS.BASE_DISCOUNT_PER_YEAR
            const hasPriceVerified = isPriceLine && !priceLowWarning && !priceHighWarning && !priceDecimalsWarning
            return (
              <li key={i}>
                {item.text}
                {/* Price verification details as sub-items */}
                {isPriceLine && (priceLowWarning || priceHighWarning || priceDecimalsWarning || hasPriceVerified) && (
                  <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm space-y-0.5">
                    {priceLowWarning && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.WARNING} />
                        <span className="text-gray-500 ml-1">price unexpectedly low</span>
                      </li>
                    )}
                    {priceHighWarning && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.WARNING} />
                        <span className="text-gray-500 ml-1">price unexpectedly high</span>
                      </li>
                    )}
                    {priceDecimalsWarning && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.FAILED} />
                        <span className="text-gray-500 ml-1">invalid price decimals</span>
                      </li>
                    )}
                    {hasPriceVerified && (
                      <li className="flex items-center">
                        <span>Price verification:</span>
                        <VerificationStatusIconSmall status={VERIFICATION_STATUS.PASSED} />
                        <span className="text-gray-500 ml-1">price verified (range and decimals OK)</span>
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
                    <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm space-y-0.5">
                      <li className="flex items-center">
                        <span>Base Discount verification:</span>
                        <VerificationStatusIconSmall status={verificationStatus} />
                        {verificationStatus === VERIFICATION_STATUS.PASSED && (
                          <span className="text-gray-500 ml-1">matches Wizard value</span>
                        )}
                        {verificationStatus === VERIFICATION_STATUS.FAILED && (
                          <span className="text-gray-500 ml-1">{outOfRange ? 'out of range' : 'does not match Wizard value'}</span>
                        )}
                        {verificationStatus === VERIFICATION_STATUS.NOT_AVAILABLE && (
                          <span className="text-gray-500 ml-1">N/A</span>
                        )}
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
        <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {ownerBullets.map((item, i) => (
            <li key={i}>
              <OwnerBulletContent 
                item={item} 
                explorerUrl={explorerUrl} 
                hookOwnerVerification={hookOwnerVerification}
                irmOwnerVerification={irmOwnerVerification}
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

export default function MarketConfigTree({ config, explorerUrl, chainId, currentSiloFactoryAddress, wizardDaoFee, wizardDeployerFee, siloVerification, hookOwnerVerification, irmOwnerVerification, tokenVerification, numericValueVerification, addressInJsonVerification = new Map(), addressVersions = new Map(), ptOracleBaseDiscountVerification, callBeforeQuoteVerification }: MarketConfigTreeProps) {
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
            version={version}
          />
        </span>
        <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 text-sm space-y-0.5">
          <li className="flex items-center">
            <span>Silo factory verification:</span>
            <VerificationStatusIconSmall status={verificationStatus} />
            {verificationStatus === VERIFICATION_STATUS.PASSED && (
              <span className="text-gray-500 ml-1">matches current Silo Factory</span>
            )}
            {verificationStatus === VERIFICATION_STATUS.FAILED && (
              <span className="text-gray-500 ml-1">does not match current Silo Factory</span>
            )}
            {verificationStatus === VERIFICATION_STATUS.NOT_AVAILABLE && (
              <span className="text-gray-500 ml-1">N/A</span>
            )}
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
        <TreeNode label="Silo Config" address={config.siloConfig} explorerUrl={explorerUrl} addressVersions={addressVersions}>
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
          />
        </TreeNode>

        <TreeNode label="Silo 0" address={config.silo0.silo} explorerUrl={explorerUrl} addressVersions={addressVersions}>
          <TreeNode 
            label="Token" 
            address={config.silo0.token} 
            tokenMeta={{ symbol: config.silo0.tokenSymbol, decimals: config.silo0.tokenDecimals }} 
            explorerUrl={explorerUrl}
            tokenVerification={tokenVerification?.token0 || null}
            addressInJsonVerification={addressInJsonVerification}
            addressVersions={addressVersions}
            showAddressVersion={false}
          />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo0.protectedShareToken} tokenMeta={{ symbol: config.silo0.protectedShareTokenSymbol, decimals: config.silo0.protectedShareTokenDecimals }} explorerUrl={explorerUrl} addressVersions={addressVersions} />
            <TreeNode label="Collateral Share Token" address={config.silo0.collateralShareToken} tokenMeta={{ symbol: config.silo0.collateralShareTokenSymbol, decimals: config.silo0.collateralShareTokenDecimals }} explorerUrl={explorerUrl} addressVersions={addressVersions} />
            <TreeNode label="Debt Share Token" address={config.silo0.debtShareToken} tokenMeta={{ symbol: config.silo0.debtShareTokenSymbol, decimals: config.silo0.debtShareTokenDecimals }} explorerUrl={explorerUrl} addressVersions={addressVersions} />
          </TreeNode>
          <TreeNode
            label="Solvency Oracle"
            address={config.silo0.solvencyOracle.address}
            suffixText={config.silo0.solvencyOracle.version}
            bulletItems={buildOracleBullets(config.silo0.solvencyOracle.quotePrice, config.silo0.solvencyOracle.quoteTokenSymbol, config.silo0.solvencyOracle.type, config.silo0.solvencyOracle.config as Record<string, unknown> | undefined)}
            priceLowWarning={isPriceUnexpectedlyLow(config.silo0.solvencyOracle.quotePrice)}
            priceHighWarning={isPriceUnexpectedlyHigh(config.silo0.solvencyOracle.quotePrice)}
            priceDecimalsWarning={isPriceDecimalsInvalid(config.silo0.solvencyOracle.quotePrice)}
            baseDiscountVerification={ptOracleBaseDiscountVerification?.silo0 ?? null}
            explorerUrl={explorerUrl}
            addressVersions={addressVersions}
          />
          {!config.silo0.maxLtvOracle.address || config.silo0.maxLtvOracle.address === ethers.ZeroAddress ? (
            <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} addressVersions={addressVersions} />
          ) : config.silo0.maxLtvOracle.address.toLowerCase() === config.silo0.solvencyOracle.address.toLowerCase() ? (
            <TreeNode label="Max LTV Oracle" value="Same as Solvency Oracle" explorerUrl={explorerUrl} valueMuted />
          ) : (
            <TreeNode
              label="Max LTV Oracle"
              address={config.silo0.maxLtvOracle.address}
              suffixText={config.silo0.maxLtvOracle.version}
              bulletItems={buildOracleBullets(config.silo0.maxLtvOracle.quotePrice, config.silo0.maxLtvOracle.quoteTokenSymbol, config.silo0.maxLtvOracle.type, config.silo0.maxLtvOracle.config as Record<string, unknown> | undefined)}
              priceLowWarning={isPriceUnexpectedlyLow(config.silo0.maxLtvOracle.quotePrice)}
              priceHighWarning={isPriceUnexpectedlyHigh(config.silo0.maxLtvOracle.quotePrice)}
              priceDecimalsWarning={isPriceDecimalsInvalid(config.silo0.maxLtvOracle.quotePrice)}
              explorerUrl={explorerUrl}
              addressVersions={addressVersions}
            />
          )}
          <TreeNode
            label="Interest Rate Model"
            address={config.silo0.interestRateModel.address}
            suffixText={config.silo0.interestRateModel.version}
            ownerBullets={config.silo0.interestRateModel.owner ? [{ address: config.silo0.interestRateModel.owner, isContract: config.silo0.interestRateModel.ownerIsContract, name: config.silo0.interestRateModel.ownerName }] : undefined}
            explorerUrl={explorerUrl}
            hookOwnerVerification={irmOwnerVerification ? undefined : hookOwnerVerification}
            irmOwnerVerification={irmOwnerVerification}
            addressInJsonVerification={addressInJsonVerification}
            addressVersions={addressVersions}
          >
            {config.silo0.interestRateModel.type && (
              <TreeNode label="Type" value={config.silo0.interestRateModel.type} explorerUrl={explorerUrl} valueMuted />
            )}
            {config.silo0.interestRateModel.config && Object.entries(config.silo0.interestRateModel.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode 
            label="Max LTV" 
            value={config.silo0.maxLtv} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.maxLtv } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Liquidation Threshold (LT)" 
            value={config.silo0.lt} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.lt } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Liquidation Target LTV" 
            value={config.silo0.liquidationTargetLtv} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.liquidationTargetLtv } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Liquidation Fee" 
            value={config.silo0.liquidationFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.liquidationFee, checkHighValue: true } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Flashloan Fee" 
            value={config.silo0.flashloanFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.flashloanFee, checkHighValue: true } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode label="Call Before Quote" value={config.silo0.callBeforeQuote} explorerUrl={explorerUrl} callBeforeQuoteVerification={callBeforeQuoteVerification?.silo0 ?? null} />
        </TreeNode>

        <TreeNode label="Silo 1" address={config.silo1.silo} explorerUrl={explorerUrl} addressVersions={addressVersions}>
          <TreeNode 
            label="Token" 
            address={config.silo1.token} 
            tokenMeta={{ symbol: config.silo1.tokenSymbol, decimals: config.silo1.tokenDecimals }} 
            explorerUrl={explorerUrl}
            tokenVerification={tokenVerification?.token1 || null}
            addressInJsonVerification={addressInJsonVerification}
            addressVersions={addressVersions}
            showAddressVersion={false}
          />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo1.protectedShareToken} tokenMeta={{ symbol: config.silo1.protectedShareTokenSymbol, decimals: config.silo1.protectedShareTokenDecimals }} explorerUrl={explorerUrl} addressVersions={addressVersions} />
            <TreeNode label="Collateral Share Token" address={config.silo1.collateralShareToken} tokenMeta={{ symbol: config.silo1.collateralShareTokenSymbol, decimals: config.silo1.collateralShareTokenDecimals }} explorerUrl={explorerUrl} addressVersions={addressVersions} />
            <TreeNode label="Debt Share Token" address={config.silo1.debtShareToken} tokenMeta={{ symbol: config.silo1.debtShareTokenSymbol, decimals: config.silo1.debtShareTokenDecimals }} explorerUrl={explorerUrl} addressVersions={addressVersions} />
          </TreeNode>
          <TreeNode
            label="Solvency Oracle"
            address={config.silo1.solvencyOracle.address}
            suffixText={config.silo1.solvencyOracle.version}
            bulletItems={buildOracleBullets(config.silo1.solvencyOracle.quotePrice, config.silo1.solvencyOracle.quoteTokenSymbol, config.silo1.solvencyOracle.type, config.silo1.solvencyOracle.config as Record<string, unknown> | undefined)}
            priceLowWarning={isPriceUnexpectedlyLow(config.silo1.solvencyOracle.quotePrice)}
            priceHighWarning={isPriceUnexpectedlyHigh(config.silo1.solvencyOracle.quotePrice)}
            priceDecimalsWarning={isPriceDecimalsInvalid(config.silo1.solvencyOracle.quotePrice)}
            baseDiscountVerification={ptOracleBaseDiscountVerification?.silo1 ?? null}
            explorerUrl={explorerUrl}
            addressVersions={addressVersions}
          />
          {!config.silo1.maxLtvOracle.address || config.silo1.maxLtvOracle.address === ethers.ZeroAddress ? (
            <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} addressVersions={addressVersions} />
          ) : config.silo1.maxLtvOracle.address.toLowerCase() === config.silo1.solvencyOracle.address.toLowerCase() ? (
            <TreeNode label="Max LTV Oracle" value="Same as Solvency Oracle" explorerUrl={explorerUrl} valueMuted />
          ) : (
            <TreeNode
              label="Max LTV Oracle"
              address={config.silo1.maxLtvOracle.address}
              suffixText={config.silo1.maxLtvOracle.version}
              bulletItems={buildOracleBullets(config.silo1.maxLtvOracle.quotePrice, config.silo1.maxLtvOracle.quoteTokenSymbol, config.silo1.maxLtvOracle.type, config.silo1.maxLtvOracle.config as Record<string, unknown> | undefined)}
              priceLowWarning={isPriceUnexpectedlyLow(config.silo1.maxLtvOracle.quotePrice)}
              priceHighWarning={isPriceUnexpectedlyHigh(config.silo1.maxLtvOracle.quotePrice)}
              priceDecimalsWarning={isPriceDecimalsInvalid(config.silo1.maxLtvOracle.quotePrice)}
              explorerUrl={explorerUrl}
              addressVersions={addressVersions}
            />
          )}
          <TreeNode
            label="Interest Rate Model"
            address={config.silo1.interestRateModel.address}
            suffixText={config.silo1.interestRateModel.version}
            ownerBullets={config.silo1.interestRateModel.owner ? [{ address: config.silo1.interestRateModel.owner, isContract: config.silo1.interestRateModel.ownerIsContract, name: config.silo1.interestRateModel.ownerName }] : undefined}
            explorerUrl={explorerUrl}
            hookOwnerVerification={irmOwnerVerification ? undefined : hookOwnerVerification}
            irmOwnerVerification={irmOwnerVerification}
            addressInJsonVerification={addressInJsonVerification}
            addressVersions={addressVersions}
          >
            {config.silo1.interestRateModel.type && (
              <TreeNode label="Type" value={config.silo1.interestRateModel.type} explorerUrl={explorerUrl} valueMuted />
            )}
            {config.silo1.interestRateModel.config && Object.entries(config.silo1.interestRateModel.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode 
            label="Max LTV" 
            value={config.silo1.maxLtv} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.maxLtv } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Liquidation Threshold (LT)" 
            value={config.silo1.lt} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.lt } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Liquidation Target LTV" 
            value={config.silo1.liquidationTargetLtv} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.liquidationTargetLtv } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Liquidation Fee" 
            value={config.silo1.liquidationFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.liquidationFee, checkHighValue: true } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode 
            label="Flashloan Fee" 
            value={config.silo1.flashloanFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.flashloanFee, checkHighValue: true } : undefined}
            wizardDaoFee={wizardDaoFee ?? null}
            wizardDeployerFee={wizardDeployerFee ?? null}
          />
          <TreeNode label="Call Before Quote" value={config.silo1.callBeforeQuote} explorerUrl={explorerUrl} callBeforeQuoteVerification={callBeforeQuoteVerification?.silo1 ?? null} />
        </TreeNode>
      </ol>
    </div>
  )
}
