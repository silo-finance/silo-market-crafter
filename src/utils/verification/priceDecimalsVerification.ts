/**
 * Price Decimals Verification (18 decimals expected)
 *
 * Checks if the raw quote price string length is within the expected range for 18-decimal values.
 * If length is too short or too long, the price may have wrong decimals and should be verified.
 *
 * Bounds are hardcoded: valid length is between MIN_LENGTH and MAX_LENGTH (inclusive).
 */

/** Minimum expected length for an 18-decimal price value as string */
export const MIN_PRICE_STRING_LENGTH = 16

/** Maximum expected length for an 18-decimal price value as string */
export const MAX_PRICE_STRING_LENGTH = 22

/**
 * @param quotePriceRaw - Raw quote price from oracle (string)
 * @returns true if length < MIN_PRICE_STRING_LENGTH or length > MAX_PRICE_STRING_LENGTH
 */
export function isPriceDecimalsInvalid(quotePriceRaw: string | undefined): boolean {
  if (quotePriceRaw == null || quotePriceRaw === '') return false
  const len = String(quotePriceRaw).length
  return len < MIN_PRICE_STRING_LENGTH || len > MAX_PRICE_STRING_LENGTH
}
