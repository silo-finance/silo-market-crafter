/**
 * High Price Verification (1000 threshold)
 *
 * Checks if a quote price in 18-decimal format is unexpectedly high (> 1000).
 * Used to warn about possible decimals error (e.g. oracle returning wrong scale).
 *
 * Price is stored on-chain in 18 decimals: 1 = 1e18, 1000 = 1000e18.
 *
 * @param quotePriceRaw - Raw quote price from oracle (string, 18 decimals format)
 * @returns true if price is greater than 1000, false otherwise
 */
// 1000 in 18 decimals = 1000 * 10^18
const HIGH_PRICE_THRESHOLD_E18 = BigInt(1000) * BigInt(10 ** 18)

export function isPriceUnexpectedlyHigh(quotePriceRaw: string | undefined): boolean {
  if (quotePriceRaw == null || quotePriceRaw === '') return false
  try {
    return BigInt(quotePriceRaw) > HIGH_PRICE_THRESHOLD_E18
  } catch {
    return false
  }
}
