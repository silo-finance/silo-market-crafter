/**
 * Low Price Verification (0.01 threshold)
 *
 * Checks if a quote price in 18-decimal format is unexpectedly low (< 0.01).
 * Used to warn about possible decimals error (e.g. oracle returning wrong scale).
 *
 * Price is stored on-chain in 18 decimals: 1 = 1e18, 0.01 = 10^16.
 *
 * @param quotePriceRaw - Raw quote price from oracle (string, 18 decimals format)
 * @returns true if price is less than 0.01, false otherwise
 */
// 0.01 in 18 decimals = 10^16
const LOW_PRICE_THRESHOLD_E18 = BigInt(10 ** 17)

export function isPriceUnexpectedlyLow(quotePriceRaw: string | undefined): boolean {
  if (quotePriceRaw == null || quotePriceRaw === '') return false
  try {
    return BigInt(quotePriceRaw) < LOW_PRICE_THRESHOLD_E18
  } catch {
    return false
  }
}
