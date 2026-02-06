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

export interface VerificationCheckItem {
  label: string
  onChainDisplay: string
  wizardDisplay: string
  passed: boolean
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
}

function formatPrice(quotePriceRaw: string | undefined): string {
  if (quotePriceRaw == null || quotePriceRaw === '') return '—'
  return formatQuotePriceAs18Decimals(quotePriceRaw)
}

export function buildVerificationChecks(
  config: MarketConfig,
  options: BuildVerificationChecksOptions
): VerificationCheckItem[] {
  const checks: VerificationCheckItem[] = []
  const { wizardDaoFee, wizardDeployerFee, numericWizard, ptOracleBaseDiscount } = options

  // DAO Fee
  if (wizardDaoFee != null) {
    const onChain = config.silo0.daoFee
    const passed = verifyNumericValue(onChain, wizardDaoFee)
    checks.push({
      label: 'DAO Fee',
      onChainDisplay: formatPercentage(onChain),
      wizardDisplay: formatPercentage(wizardDaoFee),
      passed
    })
  }

  // Deployer Fee
  if (wizardDeployerFee != null) {
    const onChain = config.silo0.deployerFee
    const passed = verifyNumericValue(onChain, wizardDeployerFee)
    checks.push({
      label: 'Deployer Fee',
      onChainDisplay: formatPercentage(onChain),
      wizardDisplay: formatPercentage(wizardDeployerFee),
      passed
    })
  }

  // Silo 0 – Solvency Oracle price
  const price0Sol = config.silo0.solvencyOracle.quotePrice
  const low0Sol = isPriceUnexpectedlyLow(price0Sol)
  const high0Sol = isPriceUnexpectedlyHigh(price0Sol)
  const decimals0Sol = isPriceDecimalsInvalid(price0Sol)
  checks.push({
    label: 'Silo 0 Solvency Oracle – price',
    onChainDisplay: formatPrice(price0Sol),
    wizardDisplay: '—',
    passed: !low0Sol && !high0Sol && !decimals0Sol
  })

  // Silo 0 – Max LTV Oracle price (only if different from Solvency)
  if (
    config.silo0.maxLtvOracle.address &&
    config.silo0.maxLtvOracle.address !== config.silo0.solvencyOracle.address
  ) {
    const price0Max = config.silo0.maxLtvOracle.quotePrice
    const low0Max = isPriceUnexpectedlyLow(price0Max)
    const high0Max = isPriceUnexpectedlyHigh(price0Max)
    const decimals0Max = isPriceDecimalsInvalid(price0Max)
    checks.push({
      label: 'Silo 0 Max LTV Oracle – price',
      onChainDisplay: formatPrice(price0Max),
      wizardDisplay: '—',
      passed: !low0Max && !high0Max && !decimals0Max
    })
  }

  // Silo 0 – Base Discount Per Year (PT Oracle)
  const bd0 = ptOracleBaseDiscount.silo0
  if (bd0) {
    const wizardStr = bd0.wizard != null ? formatPercentage(bd0.wizard) : '—'
    const match = bd0.wizard != null && verifyNumericValue(bd0.onChain, bd0.wizard)
    const outOfRange = isBaseDiscountPercentOutOfRange(bd0.onChain)
    checks.push({
      label: 'Silo 0 Solvency Oracle – Base Discount Per Year',
      onChainDisplay: formatPercentage(bd0.onChain),
      wizardDisplay: wizardStr,
      passed: match && !outOfRange
    })
  }

  // Silo 0 – Max LTV, LT, Liquidation Target LTV, Liquidation Fee, Flashloan Fee
  const n0 = numericWizard.silo0
  if (n0) {
    const addNumeric = (key: keyof typeof n0, label: string) => {
      const wizardVal = n0[key]
      if (wizardVal == null) return
      const onChain = config.silo0[key]
      const passed = verifyNumericValue(onChain, wizardVal)
      checks.push({
        label: `Silo 0 – ${label}`,
        onChainDisplay: formatPercentage(onChain),
        wizardDisplay: formatPercentage(wizardVal),
        passed
      })
    }
    addNumeric('maxLtv', 'Max LTV')
    addNumeric('lt', 'Liquidation Threshold (LT)')
    addNumeric('liquidationTargetLtv', 'Liquidation Target LTV')
    addNumeric('liquidationFee', 'Liquidation Fee')
    addNumeric('flashloanFee', 'Flashloan Fee')
  }

  // Silo 1 – Solvency Oracle price
  const price1Sol = config.silo1.solvencyOracle.quotePrice
  const low1Sol = isPriceUnexpectedlyLow(price1Sol)
  const high1Sol = isPriceUnexpectedlyHigh(price1Sol)
  const decimals1Sol = isPriceDecimalsInvalid(price1Sol)
  checks.push({
    label: 'Silo 1 Solvency Oracle – price',
    onChainDisplay: formatPrice(price1Sol),
    wizardDisplay: '—',
    passed: !low1Sol && !high1Sol && !decimals1Sol
  })

  if (
    config.silo1.maxLtvOracle.address &&
    config.silo1.maxLtvOracle.address !== config.silo1.solvencyOracle.address
  ) {
    const price1Max = config.silo1.maxLtvOracle.quotePrice
    const low1Max = isPriceUnexpectedlyLow(price1Max)
    const high1Max = isPriceUnexpectedlyHigh(price1Max)
    const decimals1Max = isPriceDecimalsInvalid(price1Max)
    checks.push({
      label: 'Silo 1 Max LTV Oracle – price',
      onChainDisplay: formatPrice(price1Max),
      wizardDisplay: '—',
      passed: !low1Max && !high1Max && !decimals1Max
    })
  }

  const bd1 = ptOracleBaseDiscount.silo1
  if (bd1) {
    const wizardStr = bd1.wizard != null ? formatPercentage(bd1.wizard) : '—'
    const match = bd1.wizard != null && verifyNumericValue(bd1.onChain, bd1.wizard)
    const outOfRange = isBaseDiscountPercentOutOfRange(bd1.onChain)
    checks.push({
      label: 'Silo 1 Solvency Oracle – Base Discount Per Year',
      onChainDisplay: formatPercentage(bd1.onChain),
      wizardDisplay: wizardStr,
      passed: match && !outOfRange
    })
  }

  const n1 = numericWizard.silo1
  if (n1) {
    const addNumeric = (key: keyof typeof n1, label: string) => {
      const wizardVal = n1[key]
      if (wizardVal == null) return
      const onChain = config.silo1[key]
      const passed = verifyNumericValue(onChain, wizardVal)
      checks.push({
        label: `Silo 1 – ${label}`,
        onChainDisplay: formatPercentage(onChain),
        wizardDisplay: formatPercentage(wizardVal),
        passed
      })
    }
    addNumeric('maxLtv', 'Max LTV')
    addNumeric('lt', 'Liquidation Threshold (LT)')
    addNumeric('liquidationTargetLtv', 'Liquidation Target LTV')
    addNumeric('liquidationFee', 'Liquidation Fee')
    addNumeric('flashloanFee', 'Flashloan Fee')
  }

  return checks
}
