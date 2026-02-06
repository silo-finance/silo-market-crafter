/**
 * High Value Verification (5% threshold)
 * 
 * Checks if a value in 18 decimals format is unexpectedly high (> 5%).
 * This verification can be used for any percentage-based value (DAO Fee, Deployer Fee, Liquidation Fee, Flashloan Fee, etc.).
 * 
 * The threshold is hardcoded to 5% in this function. If a different threshold is needed,
 * create a new function with a different number in the name (e.g., `isValueHigh10` for 10%).
 * 
 * @param onChainValue - Value from on-chain contract (in 18 decimals format)
 * @returns true if value is greater than 5%, false otherwise
 */
export function isValueHigh5(
  onChainValue: bigint
): boolean {
  // Hardcoded threshold: 5%
  // 5% in 18 decimals format: 5 * 10^14
  const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14
  const threshold = BigInt(5) * BP2DP_NORMALIZATION
  
  return onChainValue > threshold
}
