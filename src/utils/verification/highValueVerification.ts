/**
 * High Value Verification (Global)
 * 
 * Checks if a value in 18 decimals format is unexpectedly high (> 5%).
 * This verification can be used for any percentage-based value (DAO Fee, Deployer Fee, etc.).
 * 
 * @param onChainValue - Value from on-chain contract (in 18 decimals format)
 * @param thresholdPercent - Threshold percentage (default: 5, meaning 5%)
 * @returns true if value is greater than threshold, false otherwise
 */
export function isValueHigh(
  onChainValue: bigint,
  thresholdPercent: number = 5
): boolean {
  // Convert threshold percentage to 18 decimals format
  // thresholdPercent% in 18 decimals format: thresholdPercent * 10^14
  const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14
  const threshold = BigInt(thresholdPercent) * BP2DP_NORMALIZATION
  
  return onChainValue > threshold
}
