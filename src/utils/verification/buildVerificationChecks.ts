/**
 * Builds a single list of all verification checks for the summary section.
 * Uses the same verification functions as the config tree (no duplicate logic).
 */

import type { MarketConfig } from '@/utils/fetchMarketConfig'
import { formatPercentage, formatQuotePriceAs18Decimals } from '@/utils/fetchMarketConfig'
import {
  isPriceUnexpectedlyLow,
  isPriceUnexpectedlyHigh,
  isPriceDecimalsInvalid,
  isBaseDiscountPercentOutOfRange,
  verifyNumericValue
} from '@/utils/verification'
import { verifyAddress } from '@/utils/verification/addressVerification'
import { ethers } from 'ethers'

export type VerificationStatus = 'pending' | 'passed' | 'failed'

export const VERIFICATION_STATUS = {
  PENDING: 'pending' as const,
  PASSED: 'passed' as const,
  FAILED: 'failed' as const
} as const

export type VerificationCheckType = 'wizard-vs-onchain' | 'independent'

export const VERIFICATION_CHECK_TYPE = {
  WIZARD_VS_ONCHAIN: 'wizard-vs-onchain' as const,
  INDEPENDENT: 'independent' as const
} as const

export interface VerificationCheckItem {
  label: string
  type: VerificationCheckType
  status: VerificationStatus
  /** Condition required for this verification (e.g., "requires wizard data") */
  condition?: string
  /** Error message if verification failed */
  error?: string
  // For wizard-vs-onchain type
  onChainDisplay?: string
  wizardDisplay?: string
  // For independent type
  message?: string
}

export interface BuildVerificationChecksOptions {
  wizardDaoFee: bigint | null
  wizardDeployerFee: bigint | null
  numericWizard: {
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
  ptOracleBaseDiscount: {
    silo0?: { onChain: bigint; wizard: bigint | null }
    silo1?: { onChain: bigint; wizard: bigint | null }
  }
  siloVerification?: {
    silo0: boolean | null
    silo1: boolean | null
  }
  implementationVerified?: boolean | null
  hookOwnerVerification?: {
    onChainOwner: string | null
    wizardOwner: string | null
    isInAddressesJson: boolean | null
  }
  irmOwnerVerification?: {
    onChainOwner: string | null
    wizardOwner: string | null
    isInAddressesJson: boolean | null
  }
  tokenVerification?: {
    token0: { onChainToken: string | null; wizardToken: string | null } | null
    token1: { onChainToken: string | null; wizardToken: string | null } | null
  }
  callBeforeQuoteVerification?: {
    silo0?: { wizard: boolean | null }
    silo1?: { wizard: boolean | null }
  }
}

function formatPrice(quotePriceRaw: string | undefined): string {
  if (quotePriceRaw == null || quotePriceRaw === '') return '—'
  return formatQuotePriceAs18Decimals(quotePriceRaw)
}

function formatAddress(address: string | null | undefined): string {
  if (!address) return '—'
  try {
    // Normalize address using ethers
    return ethers.getAddress(address)
  } catch {
    return address
  }
}

/**
 * Helper function to determine verification status based on verification result
 */
function getVerificationStatus(
  isVerified: boolean | null | undefined,
  defaultValue: VerificationStatus = VERIFICATION_STATUS.PENDING
): VerificationStatus {
  if (isVerified === null || isVerified === undefined) {
    return defaultValue
  }
  return isVerified ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
}

/**
 * Helper function to create status message for independent checks
 */
function createStatusMessage(
  status: VerificationStatus,
  messages: {
    passed: string
    failed: string
    pending: string
  }
): string {
  switch (status) {
    case VERIFICATION_STATUS.PASSED:
      return messages.passed
    case VERIFICATION_STATUS.FAILED:
      return messages.failed
    case VERIFICATION_STATUS.PENDING:
      return messages.pending
  }
}

/**
 * Helper function to create a wizard-vs-onchain verification check
 */
function createWizardVsOnChainCheck(
  label: string,
  onChainValue: string,
  wizardValue: string | null,
  status: VerificationStatus,
  condition?: string,
  error?: string
): VerificationCheckItem {
  return {
    label,
    type: VERIFICATION_CHECK_TYPE.WIZARD_VS_ONCHAIN,
    onChainDisplay: onChainValue,
    wizardDisplay: wizardValue ?? '—',
    status,
    condition,
    error
  }
}

/**
 * Helper function to create an independent verification check (not comparing wizard vs on-chain)
 */
function createIndependentCheck(
  label: string,
  message: string,
  status: VerificationStatus,
  error?: string
): VerificationCheckItem {
  return {
    label,
    type: VERIFICATION_CHECK_TYPE.INDEPENDENT,
    message,
    status,
    error
  }
}

export function buildVerificationChecks(
  config: MarketConfig,
  options: BuildVerificationChecksOptions
): VerificationCheckItem[] {
  const checks: VerificationCheckItem[] = []
  const { 
    wizardDaoFee, 
    wizardDeployerFee, 
    numericWizard, 
    ptOracleBaseDiscount,
    siloVerification,
    implementationVerified,
    hookOwnerVerification,
    irmOwnerVerification,
    tokenVerification,
    callBeforeQuoteVerification
  } = options

  // DAO Fee - always add, but with appropriate status
  const daoFeeStatus = getVerificationStatus(
    wizardDaoFee != null ? verifyNumericValue(config.silo0.daoFee, wizardDaoFee) : null
  )
  checks.push(createWizardVsOnChainCheck(
    'DAO Fee',
    formatPercentage(config.silo0.daoFee),
    wizardDaoFee != null ? formatPercentage(wizardDaoFee) : null,
    daoFeeStatus,
    wizardDaoFee == null ? 'requires wizard data' : undefined
  ))

  // Deployer Fee - always add, but with appropriate status
  const deployerFeeStatus = getVerificationStatus(
    wizardDeployerFee != null ? verifyNumericValue(config.silo0.deployerFee, wizardDeployerFee) : null
  )
  checks.push(createWizardVsOnChainCheck(
    'Deployer Fee',
    formatPercentage(config.silo0.deployerFee),
    wizardDeployerFee != null ? formatPercentage(wizardDeployerFee) : null,
    deployerFeeStatus,
    wizardDeployerFee == null ? 'requires wizard data' : undefined
  ))

  // Silo 0 – Solvency Oracle price - always checkable (independent check)
  const price0Sol = config.silo0.solvencyOracle.quotePrice
  const low0Sol = isPriceUnexpectedlyLow(price0Sol)
  const high0Sol = isPriceUnexpectedlyHigh(price0Sol)
  const decimals0Sol = isPriceDecimalsInvalid(price0Sol)
  const price0SolStatus: VerificationStatus = !low0Sol && !high0Sol && !decimals0Sol ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
  const price0SolError = price0SolStatus === VERIFICATION_STATUS.FAILED 
    ? (low0Sol ? 'price unexpectedly low' : high0Sol ? 'price unexpectedly high' : decimals0Sol ? 'invalid price decimals' : '')
    : undefined
  checks.push(createIndependentCheck(
    'Silo 0 Solvency Oracle – price',
    `Price: ${formatPrice(price0Sol)}`,
    price0SolStatus,
    price0SolError
  ))

  // Silo 0 – Max LTV Oracle price (only if different from Solvency) - always checkable (independent check)
  if (
    config.silo0.maxLtvOracle.address &&
    config.silo0.maxLtvOracle.address !== config.silo0.solvencyOracle.address
  ) {
    const price0Max = config.silo0.maxLtvOracle.quotePrice
    const low0Max = isPriceUnexpectedlyLow(price0Max)
    const high0Max = isPriceUnexpectedlyHigh(price0Max)
    const decimals0Max = isPriceDecimalsInvalid(price0Max)
    const price0MaxStatus: VerificationStatus = !low0Max && !high0Max && !decimals0Max ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
    const price0MaxError = price0MaxStatus === VERIFICATION_STATUS.FAILED
      ? (low0Max ? 'price unexpectedly low' : high0Max ? 'price unexpectedly high' : decimals0Max ? 'invalid price decimals' : '')
      : undefined
    checks.push(createIndependentCheck(
      'Silo 0 Max LTV Oracle – price',
      `Price: ${formatPrice(price0Max)}`,
      price0MaxStatus,
      price0MaxError
    ))
  }

  // Silo 0 – Base Discount Per Year (PT Oracle) - always add if PT Oracle exists
  const bd0 = ptOracleBaseDiscount.silo0
  if (bd0) {
    const wizardStr = bd0.wizard != null ? formatPercentage(bd0.wizard) : null
    const match = bd0.wizard != null && verifyNumericValue(bd0.onChain, bd0.wizard)
    const outOfRange = isBaseDiscountPercentOutOfRange(bd0.onChain)
    const bd0Status = getVerificationStatus(
      bd0.wizard != null ? (match && !outOfRange) : null,
      VERIFICATION_STATUS.PENDING
    )
    const bd0Error = bd0Status === VERIFICATION_STATUS.FAILED 
      ? (outOfRange ? 'base discount out of range' : !match ? 'wizard value does not match on-chain value' : '')
      : undefined
    checks.push(createWizardVsOnChainCheck(
      'Silo 0 Solvency Oracle – Base Discount Per Year',
      formatPercentage(bd0.onChain),
      wizardStr,
      bd0Status,
      bd0.wizard == null ? 'requires wizard data' : undefined,
      bd0Error
    ))
  }

  // Silo 0 – Max LTV, LT, Liquidation Target LTV, Liquidation Fee, Flashloan Fee - always add
  const n0 = numericWizard.silo0
  const addNumeric = (key: 'maxLtv' | 'lt' | 'liquidationTargetLtv' | 'liquidationFee' | 'flashloanFee', label: string) => {
    const wizardVal = n0?.[key] ?? null
    const onChain = config.silo0[key]
    const status = getVerificationStatus(
      wizardVal != null ? verifyNumericValue(onChain, wizardVal) : null,
      VERIFICATION_STATUS.PENDING
    )
    checks.push(createWizardVsOnChainCheck(
      `Silo 0 – ${label}`,
      formatPercentage(onChain),
      wizardVal != null ? formatPercentage(wizardVal) : null,
      status,
      wizardVal == null ? 'requires wizard data' : undefined,
      status === VERIFICATION_STATUS.FAILED ? 'wizard value does not match on-chain value' : undefined
    ))
  }
  addNumeric('maxLtv', 'Max LTV')
  addNumeric('lt', 'Liquidation Threshold (LT)')
  addNumeric('liquidationTargetLtv', 'Liquidation Target LTV')
  addNumeric('liquidationFee', 'Liquidation Fee')
  addNumeric('flashloanFee', 'Flashloan Fee')

  // Silo 1 – Solvency Oracle price - always checkable (independent check)
  const price1Sol = config.silo1.solvencyOracle.quotePrice
  const low1Sol = isPriceUnexpectedlyLow(price1Sol)
  const high1Sol = isPriceUnexpectedlyHigh(price1Sol)
  const decimals1Sol = isPriceDecimalsInvalid(price1Sol)
  const price1SolStatus: VerificationStatus = !low1Sol && !high1Sol && !decimals1Sol ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
  const price1SolError = price1SolStatus === VERIFICATION_STATUS.FAILED
    ? (low1Sol ? 'price unexpectedly low' : high1Sol ? 'price unexpectedly high' : decimals1Sol ? 'invalid price decimals' : '')
    : undefined
  checks.push(createIndependentCheck(
    'Silo 1 Solvency Oracle – price',
    `Price: ${formatPrice(price1Sol)}`,
    price1SolStatus,
    price1SolError
  ))

  if (
    config.silo1.maxLtvOracle.address &&
    config.silo1.maxLtvOracle.address !== config.silo1.solvencyOracle.address
  ) {
    const price1Max = config.silo1.maxLtvOracle.quotePrice
    const low1Max = isPriceUnexpectedlyLow(price1Max)
    const high1Max = isPriceUnexpectedlyHigh(price1Max)
    const decimals1Max = isPriceDecimalsInvalid(price1Max)
    const price1MaxStatus: VerificationStatus = !low1Max && !high1Max && !decimals1Max ? VERIFICATION_STATUS.PASSED : VERIFICATION_STATUS.FAILED
    const price1MaxError = price1MaxStatus === VERIFICATION_STATUS.FAILED
      ? (low1Max ? 'price unexpectedly low' : high1Max ? 'price unexpectedly high' : decimals1Max ? 'invalid price decimals' : '')
      : undefined
    checks.push(createIndependentCheck(
      'Silo 1 Max LTV Oracle – price',
      `Price: ${formatPrice(price1Max)}`,
      price1MaxStatus,
      price1MaxError
    ))
  }

  const bd1 = ptOracleBaseDiscount.silo1
  if (bd1) {
    const wizardStr = bd1.wizard != null ? formatPercentage(bd1.wizard) : null
    const match = bd1.wizard != null && verifyNumericValue(bd1.onChain, bd1.wizard)
    const outOfRange = isBaseDiscountPercentOutOfRange(bd1.onChain)
    const bd1Status = getVerificationStatus(
      bd1.wizard != null ? (match && !outOfRange) : null,
      VERIFICATION_STATUS.PENDING
    )
    const bd1Error = bd1Status === VERIFICATION_STATUS.FAILED
      ? (outOfRange ? 'base discount out of range' : !match ? 'wizard value does not match on-chain value' : '')
      : undefined
    checks.push(createWizardVsOnChainCheck(
      'Silo 1 Solvency Oracle – Base Discount Per Year',
      formatPercentage(bd1.onChain),
      wizardStr,
      bd1Status,
      bd1.wizard == null ? 'requires wizard data' : undefined,
      bd1Error
    ))
  }

  // Silo 1 – Max LTV, LT, Liquidation Target LTV, Liquidation Fee, Flashloan Fee - always add
  const n1 = numericWizard.silo1
  const addNumeric1 = (key: 'maxLtv' | 'lt' | 'liquidationTargetLtv' | 'liquidationFee' | 'flashloanFee', label: string) => {
    const wizardVal = n1?.[key] ?? null
    const onChain = config.silo1[key]
    const status = getVerificationStatus(
      wizardVal != null ? verifyNumericValue(onChain, wizardVal) : null,
      VERIFICATION_STATUS.PENDING
    )
    checks.push(createWizardVsOnChainCheck(
      `Silo 1 – ${label}`,
      formatPercentage(onChain),
      wizardVal != null ? formatPercentage(wizardVal) : null,
      status,
      wizardVal == null ? 'requires wizard data' : undefined,
      status === VERIFICATION_STATUS.FAILED ? 'wizard value does not match on-chain value' : undefined
    ))
  }
  addNumeric1('maxLtv', 'Max LTV')
  addNumeric1('lt', 'Liquidation Threshold (LT)')
  addNumeric1('liquidationTargetLtv', 'Liquidation Target LTV')
  addNumeric1('liquidationFee', 'Liquidation Fee')
  addNumeric1('flashloanFee', 'Flashloan Fee')

  // Silo verification (silo0, silo1) - always add (independent check, verifies against Silo Factory repository)
  const silo0Status = getVerificationStatus(siloVerification?.silo0)
  const silo0Address = formatAddress(config.silo0.silo)
  const silo0Message = createStatusMessage(silo0Status, {
    passed: `Address ${silo0Address} verified in Silo Factory`,
    failed: `Address ${silo0Address} not verified in Silo Factory`,
    pending: 'Verification pending'
  })
  checks.push(createIndependentCheck(
    'Silo 0 address',
    silo0Message,
    silo0Status,
    silo0Status === VERIFICATION_STATUS.FAILED ? 'silo address not verified in Silo Factory' : undefined
  ))

  const silo1Status = getVerificationStatus(siloVerification?.silo1)
  const silo1Address = formatAddress(config.silo1.silo)
  const silo1Message = createStatusMessage(silo1Status, {
    passed: `Address ${silo1Address} verified in Silo Factory`,
    failed: `Address ${silo1Address} not verified in Silo Factory`,
    pending: 'Verification pending'
  })
  checks.push(createIndependentCheck(
    'Silo 1 address',
    silo1Message,
    silo1Status,
    silo1Status === VERIFICATION_STATUS.FAILED ? 'silo address not verified in Silo Factory' : undefined
  ))

  // Implementation verification - always add (independent check, does not require wizard data)
  const implStatus = getVerificationStatus(implementationVerified)
  const implMessage = createStatusMessage(implStatus, {
    passed: 'Contract address matches repository',
    failed: 'Contract address does not match repository',
    pending: 'Verification pending'
  })
  checks.push(createIndependentCheck(
    'SILO implementation address',
    implMessage,
    implStatus,
    implStatus === VERIFICATION_STATUS.FAILED ? 'implementation address not found in repository' : undefined
  ))

  // Hook owner verification - always add
  const hookOwnerVerified = hookOwnerVerification?.onChainOwner && hookOwnerVerification?.wizardOwner
    ? verifyAddress(hookOwnerVerification.onChainOwner, hookOwnerVerification.wizardOwner)
    : null
  const hookOwnerStatus = getVerificationStatus(hookOwnerVerified, VERIFICATION_STATUS.PENDING)
  checks.push(createWizardVsOnChainCheck(
    'Hook owner',
    formatAddress(hookOwnerVerification?.onChainOwner),
    hookOwnerVerification?.wizardOwner ? formatAddress(hookOwnerVerification.wizardOwner) : null,
    hookOwnerStatus,
    !hookOwnerVerification?.onChainOwner || !hookOwnerVerification?.wizardOwner ? 'requires wizard data' : undefined,
    hookOwnerStatus === VERIFICATION_STATUS.FAILED ? 'on-chain owner does not match wizard owner' : undefined
  ))

  // IRM owner verification - always add
  const irmOwnerVerified = irmOwnerVerification?.onChainOwner && irmOwnerVerification?.wizardOwner
    ? verifyAddress(irmOwnerVerification.onChainOwner, irmOwnerVerification.wizardOwner)
    : null
  const irmOwnerStatus = getVerificationStatus(irmOwnerVerified, VERIFICATION_STATUS.PENDING)
  checks.push(createWizardVsOnChainCheck(
    'IRM owner',
    formatAddress(irmOwnerVerification?.onChainOwner),
    irmOwnerVerification?.wizardOwner ? formatAddress(irmOwnerVerification.wizardOwner) : null,
    irmOwnerStatus,
    !irmOwnerVerification?.onChainOwner || !irmOwnerVerification?.wizardOwner ? 'requires wizard data' : undefined,
    irmOwnerStatus === VERIFICATION_STATUS.FAILED ? 'on-chain owner does not match wizard owner' : undefined
  ))

  // Token verification (token0, token1) - always add
  const token0Verified = tokenVerification?.token0?.onChainToken && tokenVerification?.token0?.wizardToken
    ? verifyAddress(tokenVerification.token0.onChainToken, tokenVerification.token0.wizardToken)
    : null
  const token0Status = getVerificationStatus(token0Verified, VERIFICATION_STATUS.PENDING)
  checks.push(createWizardVsOnChainCheck(
    'Silo 0 Token',
    formatAddress(tokenVerification?.token0?.onChainToken),
    tokenVerification?.token0?.wizardToken ? formatAddress(tokenVerification.token0.wizardToken) : null,
    token0Status,
    !tokenVerification?.token0?.onChainToken || !tokenVerification?.token0?.wizardToken ? 'requires wizard data' : undefined,
    token0Status === VERIFICATION_STATUS.FAILED ? 'on-chain token does not match wizard token' : undefined
  ))

  const token1Verified = tokenVerification?.token1?.onChainToken && tokenVerification?.token1?.wizardToken
    ? verifyAddress(tokenVerification.token1.onChainToken, tokenVerification.token1.wizardToken)
    : null
  const token1Status = getVerificationStatus(token1Verified, VERIFICATION_STATUS.PENDING)
  checks.push(createWizardVsOnChainCheck(
    'Silo 1 Token',
    formatAddress(tokenVerification?.token1?.onChainToken),
    tokenVerification?.token1?.wizardToken ? formatAddress(tokenVerification.token1.wizardToken) : null,
    token1Status,
    !tokenVerification?.token1?.onChainToken || !tokenVerification?.token1?.wizardToken ? 'requires wizard data' : undefined,
    token1Status === VERIFICATION_STATUS.FAILED ? 'on-chain token does not match wizard token' : undefined
  ))

  // Call Before Quote verification - always add
  const cbq0Wizard = callBeforeQuoteVerification?.silo0?.wizard
  const cbq0Verified = cbq0Wizard != null ? (config.silo0.callBeforeQuote === cbq0Wizard) : null
  const cbq0Status = getVerificationStatus(cbq0Verified, VERIFICATION_STATUS.PENDING)
  checks.push(createWizardVsOnChainCheck(
    'Silo 0 Call Before Quote',
    config.silo0.callBeforeQuote ? 'true' : 'false',
    cbq0Wizard != null ? (cbq0Wizard ? 'true' : 'false') : null,
    cbq0Status,
    cbq0Wizard == null ? 'requires wizard data' : undefined,
    cbq0Status === VERIFICATION_STATUS.FAILED ? 'on-chain value does not match wizard value' : undefined
  ))

  const cbq1Wizard = callBeforeQuoteVerification?.silo1?.wizard
  const cbq1Verified = cbq1Wizard != null ? (config.silo1.callBeforeQuote === cbq1Wizard) : null
  const cbq1Status = getVerificationStatus(cbq1Verified, VERIFICATION_STATUS.PENDING)
  checks.push(createWizardVsOnChainCheck(
    'Silo 1 Call Before Quote',
    config.silo1.callBeforeQuote ? 'true' : 'false',
    cbq1Wizard != null ? (cbq1Wizard ? 'true' : 'false') : null,
    cbq1Status,
    cbq1Wizard == null ? 'requires wizard data' : undefined,
    cbq1Status === VERIFICATION_STATUS.FAILED ? 'on-chain value does not match wizard value' : undefined
  ))

  return checks
}
