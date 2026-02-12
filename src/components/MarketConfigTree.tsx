'use client'

import React from 'react'
import { MarketConfig, formatPercentage, formatAddress, formatQuotePriceAs18Decimals, formatRate18AsPercent } from '@/utils/fetchMarketConfig'
import { formatBigIntToE18, formatWizardBigIntToE18 } from '@/utils/formatting'
import CopyButton from '@/components/CopyButton'
import { ethers } from 'ethers'
import { isValueHigh5, isPriceUnexpectedlyLow, isPriceUnexpectedlyHigh, isPriceDecimalsInvalid, isBaseDiscountPercentOutOfRange, verifyAddress, verifyNumericValue, convertWizardTo18Decimals } from '@/utils/verification'

interface DAOFeeVerificationIconProps {
  onChainValue: bigint
  wizardValue: bigint | null
}

function DAOFeeVerificationIcon({ onChainValue, wizardValue }: DAOFeeVerificationIconProps) {
  // Use centralized verification function from src/utils/verification/numericValueVerification.ts
  // onChainValue: DAO fee from on-chain contract (in 18 decimals format)
  // wizardValue: DAO fee from wizard state (0-1 format, e.g., 0.05 for 5%) or null if pending
  const isPending = wizardValue == null
  const isMatch = !isPending && verifyNumericValue(onChainValue, wizardValue)
  const isHigh = isValueHigh5(onChainValue) // Use high value verification (5% threshold)
  
  // Wizard stores BigInt in on-chain format; pass-through for error message display
  const wizardValueIn18Decimals = wizardValue != null ? convertWizardTo18Decimals(wizardValue) : null

  return (
    <span className="inline-flex items-center gap-1">
      {/* Verification icon - gray (pending), green checkmark (passed), or red cross (failed) */}
      <div className="relative group inline-block">
        {isPending ? (
          <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isMatch ? (
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        {isMatch && (
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Value verified: on-chain value matches Wizard value
          </div>
        )}
        {!isMatch && !isPending && wizardValueIn18Decimals != null && (
          <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Check failed: expected on-chain value {onChainValue.toString()} vs Wizard value {wizardValueIn18Decimals.toString()}
          </div>
        )}
      </div>
      
      {/* Warning icon if value is unexpectedly high (> 5%) */}
      {isHigh && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-yellow-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 22h20L12 2zm0 3.99L19.53 20H4.47L12 5.99zM11 16v-4h2v4h-2zm0 2v2h2v-2h-2z"/>
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            This is an unexpectedly high value (greater than 5%)
          </div>
        </div>
      )}
    </span>
  )
}

interface DeployerFeeVerificationIconProps {
  onChainValue: bigint
  wizardValue: bigint | null
}

function DeployerFeeVerificationIcon({ onChainValue, wizardValue }: DeployerFeeVerificationIconProps) {
  // Use centralized verification function from src/utils/verification/numericValueVerification.ts
  // onChainValue: Deployer fee from on-chain contract (in 18 decimals format)
  // wizardValue: Deployer fee from wizard state (0-1 format, e.g., 0.05 for 5%) or null if pending
  const isPending = wizardValue == null
  const isMatch = !isPending && verifyNumericValue(onChainValue, wizardValue)
  // Use global high value verification function (threshold: 5%)
  const isHigh = isValueHigh5(onChainValue)
  
  // Calculate wizard value in 18 decimals for error message display
  // Use centralized normalization function to ensure consistency
  const wizardValueIn18Decimals = wizardValue != null ? convertWizardTo18Decimals(wizardValue) : null

  return (
    <span className="inline-flex items-center gap-1">
      {/* Verification icon - gray (pending), green checkmark (passed), or red cross (failed) */}
      <div className="relative group inline-block">
        {isPending ? (
          <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isMatch ? (
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        {isMatch && (
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Value verified: on-chain value matches Wizard value
          </div>
        )}
        {!isMatch && !isPending && wizardValueIn18Decimals != null && (
          <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Check failed: expected on-chain value {onChainValue.toString()} vs Wizard value {wizardValueIn18Decimals.toString()}
          </div>
        )}
      </div>
      
      {/* Warning icon if fee is unexpectedly high (> 15%) */}
      {isHigh && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-yellow-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 22h20L12 2zm0 3.99L19.53 20H4.47L12 5.99zM11 16v-4h2v4h-2zm0 2v2h2v-2h-2z"/>
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            This is an unexpectedly high value (greater than 5%)
          </div>
        </div>
      )}
    </span>
  )
}

interface NumericValueVerificationIconProps {
  onChainValue: bigint
  wizardValue: bigint | null
  label: string
  checkHighValue?: boolean // Whether to check if value is unexpectedly high (> 5%)
}

function NumericValueVerificationIcon({ onChainValue, wizardValue, label, checkHighValue = false }: NumericValueVerificationIconProps) {
  // Use centralized verification function from src/utils/verification/numericValueVerification.ts
  // onChainValue: Value from on-chain contract (in 18 decimals format)
  // wizardValue: Value from wizard state (0-1 format, e.g., 0.75 for 75%) or null if pending
  const isPending = wizardValue == null
  const isMatch = !isPending && verifyNumericValue(onChainValue, wizardValue)
  
  // Check if value is unexpectedly high (if checkHighValue is enabled)
  const isHigh = checkHighValue ? isValueHigh5(onChainValue) : false
  
  // Wizard stores BigInt in on-chain format; pass-through for error message display
  const wizardValueIn18Decimals = wizardValue != null ? convertWizardTo18Decimals(wizardValue) : null

  return (
    <span className="inline-flex items-center gap-1">
      {/* Verification icon - gray (pending), green checkmark (passed), or red cross (failed) */}
      <div className="relative group inline-block">
        {isPending ? (
          <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isMatch ? (
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        {isMatch && (
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {label} verified: on-chain value matches Wizard value
          </div>
        )}
        {!isMatch && !isPending && wizardValueIn18Decimals != null && (
          <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Check failed: expected on-chain value {onChainValue.toString()} vs Wizard value {wizardValueIn18Decimals.toString()}
          </div>
        )}
      </div>
      
      {/* Warning icon if value is unexpectedly high (> 5%) */}
      {isHigh && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-yellow-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 22h20L12 2zm0 3.99L19.53 20H4.47L12 5.99zM11 16v-4h2v4h-2zm0 2v2h2v-2h-2z"/>
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            This is an unexpectedly high value (greater than 5%)
          </div>
        </div>
      )}
    </span>
  )
}

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
  text: string
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
  wizardDaoFee?: bigint | null
  wizardDeployerFee?: bigint | null
  siloVerification?: SiloVerification
  hookOwnerVerification?: HookOwnerVerification
  irmOwnerVerification?: IRMOwnerVerification
  tokenVerification?: TokenVerification
  numericValueVerification?: NumericValueVerification
  addressInJsonVerification?: Map<string, boolean>
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
  verificationIcon?: React.ReactNode
  addressVerificationIcon?: React.ReactNode
  hookOwnerVerification?: HookOwnerVerification
  irmOwnerVerification?: IRMOwnerVerification
  tokenVerification?: { onChainToken: string | null; wizardToken: string | null } | null
  numericValueVerification?: { wizardValue: bigint | null; checkHighValue?: boolean }
  addressInJsonVerification?: Map<string, boolean>
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

function PriceLowWarningIcon() {
  return (
    <span className="ml-1 inline-flex align-middle">
      <div className="relative group inline-block">
        <div className="w-4 h-4 bg-amber-500 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="absolute left-0 top-full mt-2 w-72 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Price is unexpectedly low — it should be verified.
        </div>
      </div>
    </span>
  )
}

function PriceHighWarningIcon() {
  return (
    <span className="ml-1 inline-flex align-middle">
      <div className="relative group inline-block">
        <div className="w-4 h-4 bg-amber-500 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
        <div className="absolute left-0 top-full mt-2 w-72 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Price is unexpectedly high — it should be verified.
        </div>
      </div>
    </span>
  )
}

function PriceDecimalsWarningIcon() {
  return (
    <span className="ml-1 inline-flex align-middle">
      <div className="relative group inline-block">
        <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center text-white text-[10px] font-bold leading-none">
          18
        </div>
        <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Check the price for 18 decimals.
        </div>
      </div>
    </span>
  )
}

function PriceVerifiedIcon() {
  return (
    <span className="ml-1 inline-flex align-middle">
      <div className="relative group inline-block">
        <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="absolute left-0 top-full mt-2 w-56 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Price verified (range and decimals OK).
        </div>
      </div>
    </span>
  )
}

function CallBeforeQuoteVerificationIcon({ onChain, wizard }: { onChain: boolean; wizard: boolean | null }) {
  const isPending = wizard === null
  const isMatch = !isPending && onChain === wizard
  return (
    <span className="ml-1 inline-flex align-middle">
      <div className="relative group inline-block">
        {isPending ? (
          <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isMatch ? (
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        {isMatch && (
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            On-chain value compared with wizard value.
          </div>
        )}
        {!isMatch && !isPending && (
          <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Check failed: on-chain value ({onChain ? 'true' : 'false'}) does not match wizard value ({wizard ? 'true' : 'false'})
          </div>
        )}
      </div>
    </span>
  )
}

function BaseDiscountVerificationIcons({ onChain, wizard }: { onChain: bigint; wizard: bigint | null }) {
  const isMatch = wizard !== null && verifyNumericValue(onChain, wizard)
  const outOfRange = isBaseDiscountPercentOutOfRange(onChain)
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
      {wizard !== null && (
        <div className="relative group inline-block">
          {isMatch ? (
            <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          <div className="absolute left-0 top-full mt-2 w-56 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {isMatch ? 'Base discount per year matches wizard value' : 'Base discount per year does not match wizard value'}
          </div>
        </div>
      )}
      {outOfRange && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-amber-500 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-56 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Verify this percentage value.
          </div>
        </div>
      )}
    </span>
  )
}

function HookOwnerVerificationIcons({ verified, isInJson, isIRM = false }: { verified: boolean | null; isInJson: boolean | null; isIRM?: boolean }) {
  const label = isIRM ? 'IRM owner' : 'Hook owner'
  return (
    <span className="inline-flex items-center gap-1">
      {/* Verification icon - gray (pending), green checkmark (passed), or red cross (failed) */}
      {/* This is independent check: on-chain owner === wizard owner */}
      <div className="relative group inline-block">
        {verified === null ? (
          <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : verified === true ? (
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        {verified === true && (
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {label} verified: matches Wizard value
          </div>
        )}
        {verified === false && (
          <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {label} verification failed: on-chain owner does not match wizard owner
          </div>
        )}
      </div>
      
      {/* Address in JSON verification - Solid Star in standard green */}
      {/* This is independent check: address exists in addresses JSON file */}
      {isInJson === true && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Address found in silo-finance repository list
          </div>
        </div>
      )}
    </span>
  )
}

function TokenVerificationIcons({ address, tokenVerification, addressInJsonVerification }: { address: string; tokenVerification: { onChainToken: string | null; wizardToken: string | null } | null; addressInJsonVerification?: Map<string, boolean> }) {
  // Always show icon, but with different status based on verification state
  const normalizedAddress = ethers.getAddress(address).toLowerCase()
  const normalizedOnChain = tokenVerification?.onChainToken ? ethers.getAddress(tokenVerification.onChainToken).toLowerCase() : null
  
  // Check if the displayed address matches the on-chain token address
  const addressMatches = normalizedOnChain === normalizedAddress
  
  // Verify that on-chain token matches wizard token using centralized function
  const isVerified = tokenVerification?.onChainToken && tokenVerification?.wizardToken
    ? verifyAddress(tokenVerification.onChainToken, tokenVerification.wizardToken)
    : null
  
  // Get JSON verification result - always available regardless of wizard data
  const isInJson = addressInJsonVerification?.get(normalizedAddress) ?? null
  
  // Only show verification icon if address matches
  if (!addressMatches) {
    return null
  }
  
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {/* Verification icon - gray (pending), green checkmark (passed), or red cross (failed) */}
      {/* This is independent check: on-chain token === wizard token */}
      <div className="relative group inline-block">
        {isVerified === null ? (
          <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isVerified === true ? (
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        {isVerified === true && (
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Token verified: matches Wizard value
          </div>
        )}
        {isVerified === false && (
          <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Token verification failed: on-chain token does not match wizard token
          </div>
        )}
      </div>
      
      {/* Address in JSON verification - Solid Star in standard green */}
      {/* This is independent check: address exists in addresses JSON file */}
      {isInJson === true && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Address found in silo-finance repository list
          </div>
        </div>
      )}
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
  
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="text-gray-400 text-sm">Owner:</span>
      <a
        href={`${explorerUrl}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 font-mono text-sm"
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
      {/* Show verification icons independently:
          - Green checkmark: if we have wizard data AND on-chain owner matches wizard owner
          - Green star: if address exists in JSON (always checked, regardless of wizard data) */}
      <HookOwnerVerificationIcons 
        verified={isVerified} 
        isInJson={isInJson}
        isIRM={!!irmOwnerVerification}
      />
    </span>
  )
}

function TreeNode({ label, value, address, tokenMeta, suffixText, bulletItems, ownerBullets, children, explorerUrl, isPercentage, valueMuted, verificationIcon, addressVerificationIcon, hookOwnerVerification, irmOwnerVerification, tokenVerification, numericValueVerification, addressInJsonVerification, priceLowWarning, priceHighWarning, priceDecimalsWarning, baseDiscountVerification, callBeforeQuoteVerification }: TreeNodeProps) {
  const hasAddress = address && address !== ethers.ZeroAddress
  const hasValue = value !== undefined && value !== null && !hasAddress
  const hasTokenMeta = tokenMeta && (tokenMeta.symbol != null || tokenMeta.decimals != null)
  const hasSuffix = suffixText != null && suffixText !== ''

  // Generate numeric value verification icon if applicable - always show if isPercentage
  let numericVerificationIcon: React.ReactNode = null
  if (numericValueVerification && isPercentage && typeof value === 'bigint') {
    numericVerificationIcon = (
      <NumericValueVerificationIcon
        onChainValue={value}
        wizardValue={numericValueVerification.wizardValue ?? null}
        label={label}
        checkHighValue={numericValueVerification.checkHighValue ?? false}
      />
    )
  }

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
              className="text-blue-400 hover:text-blue-300 font-mono text-sm"
            >
              {formatAddress(address)}
            </a>
            <CopyButton value={address} title="Copy address" iconClassName="w-3.5 h-3.5 inline align-middle" />
            {addressVerificationIcon && <span className="ml-1">{addressVerificationIcon}</span>}
            {hasTokenMeta && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({[tokenMeta.symbol, tokenMeta.decimals != null ? `${tokenMeta.decimals} decimals` : ''].filter(Boolean).join(', ')})
              </span>
            )}
            {hasSuffix && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({suffixText})
              </span>
            )}
            {/* Token verification icons - show at the end of the line */}
            {tokenVerification && address && (
              <TokenVerificationIcons 
                address={address}
                tokenVerification={tokenVerification}
                addressInJsonVerification={addressInJsonVerification}
              />
            )}
          </>
        )}
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
            {verificationIcon && verificationIcon}
            {numericVerificationIcon && <span className="ml-1">{numericVerificationIcon}</span>}
            {callBeforeQuoteVerification != null && callBeforeQuoteVerification.wizard !== null && typeof value === 'boolean' && (
              <CallBeforeQuoteVerificationIcon onChain={value} wizard={callBeforeQuoteVerification?.wizard ?? null} />
            )}
          </span>
        )}
        {address === ethers.ZeroAddress && (
          <span className="text-gray-500 text-sm italic">Zero Address</span>
        )}
      </span>
      {bulletItems && bulletItems.length > 0 && (
        <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {bulletItems.map((item, i) => {
            const isPriceLine = item.key === ORACLE_BULLET_KEYS.PRICE
            const isBaseDiscountBullet = baseDiscountVerification && item.key === ORACLE_BULLET_KEYS.BASE_DISCOUNT_PER_YEAR
            const hasPriceWarning = isPriceLine && (priceLowWarning || priceHighWarning || priceDecimalsWarning)
            const hasPriceVerified = isPriceLine && !priceLowWarning && !priceHighWarning && !priceDecimalsWarning
            const showPriceIcons = hasPriceWarning || hasPriceVerified
            const withIcons = showPriceIcons || isBaseDiscountBullet
            return (
              <li key={i}>
                {withIcons ? (
                  <span className="inline-flex items-center flex-wrap gap-0">
                    {item.text}
                    {isPriceLine && priceLowWarning && <PriceLowWarningIcon />}
                    {isPriceLine && priceHighWarning && <PriceHighWarningIcon />}
                    {isPriceLine && priceDecimalsWarning && <PriceDecimalsWarningIcon />}
                    {hasPriceVerified && <PriceVerifiedIcon />}
                    {isBaseDiscountBullet && baseDiscountVerification && <BaseDiscountVerificationIcons onChain={baseDiscountVerification.onChain} wizard={baseDiscountVerification.wizard} />}
                  </span>
                ) : (
                  item.text
                )}
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

function SiloVerificationIcon({ verified }: { verified: boolean | null }) {
  // Always show icon, but with different status: pending (gray), passed (green), or failed (red)
  return (
    <div className="relative group inline-block">
      {verified === null ? (
        <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : verified ? (
        <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      {verified === true && (
        <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Silo address verified and exists in Silo Factory
        </div>
      )}
      {verified === false && (
        <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Silo address not verified in Silo Factory
        </div>
      )}
    </div>
  )
}

export default function MarketConfigTree({ config, explorerUrl, wizardDaoFee, wizardDeployerFee, siloVerification, hookOwnerVerification, irmOwnerVerification, tokenVerification, numericValueVerification, addressInJsonVerification = new Map(), ptOracleBaseDiscountVerification, callBeforeQuoteVerification }: MarketConfigTreeProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 px-6 pt-6 pb-2">
      <h3 className="text-lg font-semibold text-white mb-4">Market Configuration Tree</h3>
      
      <ol className="tree">
        <TreeNode label="Silo Config" address={config.siloConfig} explorerUrl={explorerUrl}>
          <TreeNode label="Immutable variables" explorerUrl={explorerUrl}>
            {config.siloId !== null && (
              <TreeNode label="SILO_ID" value={config.siloId} explorerUrl={explorerUrl} />
            )}
            <TreeNode label="Silos" explorerUrl={explorerUrl}>
              <TreeNode 
                label="silo0" 
                address={config.silo0.silo} 
                explorerUrl={explorerUrl}
                addressVerificationIcon={<SiloVerificationIcon verified={siloVerification?.silo0 ?? null} />}
              />
              <TreeNode 
                label="silo1" 
                address={config.silo1.silo} 
                explorerUrl={explorerUrl}
                addressVerificationIcon={<SiloVerificationIcon verified={siloVerification?.silo1 ?? null} />}
              />
            </TreeNode>
          </TreeNode>
          <TreeNode 
            label="DAO Fee" 
            value={config.silo0.daoFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            verificationIcon={<DAOFeeVerificationIcon onChainValue={config.silo0.daoFee} wizardValue={wizardDaoFee ?? null} />}
          />
          <TreeNode 
            label="Deployer Fee" 
            value={config.silo0.deployerFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            verificationIcon={<DeployerFeeVerificationIcon onChainValue={config.silo0.deployerFee} wizardValue={wizardDeployerFee ?? null} />}
          />
          <TreeNode
            label="Hook Receiver"
            address={config.silo0.hookReceiver}
            suffixText={config.silo0.hookReceiverVersion}
            ownerBullets={config.silo0.hookReceiverOwner ? [{ address: config.silo0.hookReceiverOwner, isContract: config.silo0.hookReceiverOwnerIsContract, name: config.silo0.hookReceiverOwnerName }] : undefined}
            explorerUrl={explorerUrl}
            hookOwnerVerification={hookOwnerVerification}
            addressInJsonVerification={addressInJsonVerification}
          />
        </TreeNode>

        <TreeNode label="Silo 0" address={config.silo0.silo} explorerUrl={explorerUrl}>
          <TreeNode 
            label="Token" 
            address={config.silo0.token} 
            tokenMeta={{ symbol: config.silo0.tokenSymbol, decimals: config.silo0.tokenDecimals }} 
            explorerUrl={explorerUrl}
            tokenVerification={tokenVerification?.token0 || null}
            addressInJsonVerification={addressInJsonVerification}
          />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo0.protectedShareToken} tokenMeta={{ symbol: config.silo0.protectedShareTokenSymbol, decimals: config.silo0.protectedShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Collateral Share Token" address={config.silo0.collateralShareToken} tokenMeta={{ symbol: config.silo0.collateralShareTokenSymbol, decimals: config.silo0.collateralShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Debt Share Token" address={config.silo0.debtShareToken} tokenMeta={{ symbol: config.silo0.debtShareTokenSymbol, decimals: config.silo0.debtShareTokenDecimals }} explorerUrl={explorerUrl} />
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
          />
          {!config.silo0.maxLtvOracle.address || config.silo0.maxLtvOracle.address === ethers.ZeroAddress ? (
            <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} />
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
          />
          <TreeNode 
            label="Liquidation Threshold (LT)" 
            value={config.silo0.lt} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.lt } : undefined}
          />
          <TreeNode 
            label="Liquidation Target LTV" 
            value={config.silo0.liquidationTargetLtv} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.liquidationTargetLtv } : undefined}
          />
          <TreeNode 
            label="Liquidation Fee" 
            value={config.silo0.liquidationFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.liquidationFee, checkHighValue: true } : undefined}
          />
          <TreeNode 
            label="Flashloan Fee" 
            value={config.silo0.flashloanFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo0 ? { wizardValue: numericValueVerification.silo0.flashloanFee, checkHighValue: true } : undefined}
          />
          <TreeNode label="Call Before Quote" value={config.silo0.callBeforeQuote} explorerUrl={explorerUrl} callBeforeQuoteVerification={callBeforeQuoteVerification?.silo0 ?? null} />
        </TreeNode>

        <TreeNode label="Silo 1" address={config.silo1.silo} explorerUrl={explorerUrl}>
          <TreeNode 
            label="Token" 
            address={config.silo1.token} 
            tokenMeta={{ symbol: config.silo1.tokenSymbol, decimals: config.silo1.tokenDecimals }} 
            explorerUrl={explorerUrl}
            tokenVerification={tokenVerification?.token1 || null}
            addressInJsonVerification={addressInJsonVerification}
          />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo1.protectedShareToken} tokenMeta={{ symbol: config.silo1.protectedShareTokenSymbol, decimals: config.silo1.protectedShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Collateral Share Token" address={config.silo1.collateralShareToken} tokenMeta={{ symbol: config.silo1.collateralShareTokenSymbol, decimals: config.silo1.collateralShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Debt Share Token" address={config.silo1.debtShareToken} tokenMeta={{ symbol: config.silo1.debtShareTokenSymbol, decimals: config.silo1.debtShareTokenDecimals }} explorerUrl={explorerUrl} />
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
          />
          {!config.silo1.maxLtvOracle.address || config.silo1.maxLtvOracle.address === ethers.ZeroAddress ? (
            <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} />
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
          />
          <TreeNode 
            label="Liquidation Threshold (LT)" 
            value={config.silo1.lt} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.lt } : undefined}
          />
          <TreeNode 
            label="Liquidation Target LTV" 
            value={config.silo1.liquidationTargetLtv} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.liquidationTargetLtv } : undefined}
          />
          <TreeNode 
            label="Liquidation Fee" 
            value={config.silo1.liquidationFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.liquidationFee, checkHighValue: true } : undefined}
          />
          <TreeNode 
            label="Flashloan Fee" 
            value={config.silo1.flashloanFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            numericValueVerification={numericValueVerification?.silo1 ? { wizardValue: numericValueVerification.silo1.flashloanFee, checkHighValue: true } : undefined}
          />
          <TreeNode label="Call Before Quote" value={config.silo1.callBeforeQuote} explorerUrl={explorerUrl} callBeforeQuoteVerification={callBeforeQuoteVerification?.silo1 ?? null} />
        </TreeNode>
      </ol>
    </div>
  )
}
