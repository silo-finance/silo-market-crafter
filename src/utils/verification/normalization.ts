/**
 * Normalization Constants and Utilities
 *
 * Single place for all display ↔ on-chain (BigInt) conversion. The UI, wizard context,
 * deploy args, and verification must use only:
 * - displayNumberToBigint(percentage)  — value from form/display → BigInt
 * - bigintToDisplayNumber(bigintValue) — BigInt → value for display
 *
 * Do not use any other conversion for these numbers; implementation (e.g. ethers) is internal.
 */

import { ethers } from 'ethers'

/** On-chain scale: percentage * 10^16 */
const DISPLAY_DECIMALS = 16

/**
 * Normalization factor for converting percentage values to on-chain format.
 * 
 * On-chain values are stored as: percentage * 10^16 (see formatPercentage in fetchMarketConfig.ts).
 * To support 5 decimal places precision (0.001% increments), we use:
 * Formula: percentage * 100000 * 10^13 = percentage * 10^18 / 100 = percentage * 10^16
 * 
 * This allows 5 decimal places precision (0.001% increments).
 * 
 * Example:
 * - 4% (0.04 in wizard) → 0.04 * 100000 * 10^13 = 4000 * 10^13 = 40000000000000000
 * - 4.001% (0.04001 in wizard) → 0.04001 * 100000 * 10^13 = 4001 * 10^13 = 40010000000000000
 * - 5% (0.05 in wizard) → 0.05 * 100000 * 10^13 = 5000 * 10^13 = 50000000000000000
 */
export const BP2DP_NORMALIZATION = BigInt(10 ** (16 - 5 + 2)) // 10^13 (16 - 5 + 2 because we multiply by 100000)

/**
 * Convert wizard value (BigInt in on-chain format: percentage * 10^16) to on-chain format.
 * 
 * Wizard now stores values as BigInt in on-chain format (percentage * 10^16).
 * This function is now a pass-through but kept for consistency.
 * 
 * @param wizardValue - Value from wizard state (BigInt in on-chain format: percentage * 10^16)
 * @returns Value in on-chain format (bigint) - same as input
 * 
 * @example
 * ```typescript
 * convertWizardTo18Decimals(40000000000000000n) // Returns 40000000000000000n (4%)
 * convertWizardTo18Decimals(40010000000000000n) // Returns 40010000000000000n (4.001%)
 * convertWizardTo18Decimals(50000000000000000n) // Returns 50000000000000000n (5%)
 * ```
 */
export function convertWizardTo18Decimals(wizardValue: bigint): bigint {
  // Wizard now stores values directly as BigInt in on-chain format (percentage * 10^16)
  // No conversion needed - just return the value as-is
  return wizardValue
}

/**
 * Convert on-chain format value to wizard format (BigInt in on-chain format).
 * 
 * Wizard now stores values as BigInt in on-chain format (percentage * 10^16).
 * This function is now a pass-through but kept for consistency.
 * 
 * @param onChainValue - Value in on-chain format (bigint: percentage * 10^16)
 * @returns Value in wizard format (BigInt in on-chain format: percentage * 10^16) - same as input
 * 
 * @example
 * ```typescript
 * convert18DecimalsToWizard(40000000000000000n) // Returns 40000000000000000n (4%)
 * convert18DecimalsToWizard(40010000000000000n) // Returns 40010000000000000n (4.001%)
 * convert18DecimalsToWizard(50000000000000000n) // Returns 50000000000000000n (5%)
 * ```
 */
export function convert18DecimalsToWizard(onChainValue: bigint): bigint {
  // Wizard now stores values directly as BigInt in on-chain format (percentage * 10^16)
  // No conversion needed - just return the value as-is
  return onChainValue
}

/**
 * BigInt → display value. Use this everywhere (UI, summary, JSON) instead of ad-hoc conversion.
 *
 * @param bigintValue - Value in on-chain format (bigint: percentage * 10^16)
 * @returns Percentage as Number for display (e.g., 4.0 for 4%, 92.9876543219)
 */
export function bigintToDisplayNumber(bigintValue: bigint): number {
  const str = ethers.formatUnits(bigintValue, DISPLAY_DECIMALS)
  return Number(str)
}

/**
 * Display value → BigInt. Use this everywhere (form submit, JSON parse, wizard state) instead of ad-hoc conversion.
 *
 * @param percentage - Percentage as Number or string (e.g. 4.0, "4.001", "92.9876543219")
 * @returns Value in on-chain format (bigint: percentage * 10^16)
 */
export function displayNumberToBigint(percentage: number | string): bigint {
  const s = typeof percentage === 'string' ? percentage.trim() : Number(percentage).toFixed(10)
  if (s === '' || s === 'NaN' || s === 'Infinity' || s === '-Infinity') return BigInt(0)
  try {
    return ethers.parseUnits(s, DISPLAY_DECIMALS)
  } catch {
    return BigInt(0)
  }
}
