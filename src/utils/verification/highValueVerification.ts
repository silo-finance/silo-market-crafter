/**
 * High Value Verification (5% threshold)
 *
 * Checks if a value in on-chain format is unexpectedly high (> 5%).
 * On-chain values are stored as: percentage * 10^16 (so 4.01% = 40100000000000000).
 * See formatPercentage in fetchMarketConfig.ts: divide by 10^16 to get percentage.
 *
 * Note: The on-chain format uses percentage * 10^16, which matches our new normalization
 * where we use percentage * 100000 * 10^13 = percentage * 10^18 / 100 = percentage * 10^16.
 *
 * @param onChainValue - Value from on-chain contract (percentage * 10^16 format)
 * @returns true if value is greater than 5%, false otherwise
 */
// 5% in on-chain format (percentage * 10^16) = 50000000000000000
const FIVE_PERCENT_E16 = BigInt(5) * BigInt(10 ** 16)

export function isValueHigh5(
  onChainValue: bigint
): boolean {
  return onChainValue > FIVE_PERCENT_E16
}
