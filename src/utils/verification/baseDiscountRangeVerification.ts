/**
 * Base Discount Per Year range verification (PT Oracle only)
 *
 * Checks if a percentage value (on-chain format) is outside the expected range.
 * If value < 5% or > 40%, the percentage should be verified.
 *
 * On-chain format: percentage * 10^16 (same as other percentage fields).
 *
 * @param onChainValue - Value from on-chain (baseDiscountPerYear, percentage * 10^16)
 * @returns true if value is less than 5% or greater than 40%
 */
const MIN_PERCENT_E16 = BigInt(10) * BigInt(10 ** 16)   // 10%
const MAX_PERCENT_E16 = BigInt(40) * BigInt(10 ** 16)  // 40%

export function isBaseDiscountPercentOutOfRange(onChainValue: bigint): boolean {
  return onChainValue < MIN_PERCENT_E16 || onChainValue > MAX_PERCENT_E16
}
