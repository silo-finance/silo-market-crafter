/**
 * Normalization Constants and Utilities
 * 
 * This file contains shared constants and functions for normalizing numeric values
 * between wizard format (0-1, e.g., 0.04 for 4%) and on-chain format (18 decimals).
 * 
 * All verification functions should use these constants to ensure consistency.
 */

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
 * Convert BigInt value (on-chain format: percentage * 10^16) to Number for display.
 * 
 * @param bigintValue - Value in on-chain format (bigint: percentage * 10^16)
 * @returns Percentage as Number (e.g., 4.0 for 4%, 4.001 for 4.001%)
 * 
 * @example
 * ```typescript
 * bigintToDisplayNumber(40000000000000000n) // Returns 4.0 (4%)
 * bigintToDisplayNumber(40010000000000000n) // Returns 4.001 (4.001%)
 * bigintToDisplayNumber(50000000000000000n) // Returns 5.0 (5%)
 * ```
 */
export function bigintToDisplayNumber(bigintValue: bigint): number {
  // Convert from on-chain format (percentage * 10^16) to percentage number
  // Divide by 10^16 to get percentage
  return Number(bigintValue) / Number(BigInt(10 ** 16))
}

/**
 * Convert Number percentage to BigInt (on-chain format: percentage * 10^16).
 * 
 * @param percentage - Percentage as Number (e.g., 4.0 for 4%, 4.001 for 4.001%)
 * @returns Value in on-chain format (bigint: percentage * 10^16)
 * 
 * @example
 * ```typescript
 * displayNumberToBigint(4.0) // Returns 40000000000000000n (4%)
 * displayNumberToBigint(4.001) // Returns 40010000000000000n (4.001%)
 * displayNumberToBigint(5.0) // Returns 50000000000000000n (5%)
 * ```
 */
export function displayNumberToBigint(percentage: number): bigint {
  // Convert from percentage number to on-chain format (percentage * 10^16)
  // Use Math.trunc to avoid rounding - blockchain requires exact precision
  return BigInt(Math.trunc(percentage * (10 ** 16)))
}
