/**
 * Numeric Value Verification
 * 
 * Verifies that an on-chain numeric value (in 18 decimals format) matches the value set in the wizard.
 * This function can be used for any percentage-based value (Max LTV, Liquidation Threshold, etc.).
 * 
 * @param onChainValue - Value from on-chain contract (in 18 decimals format)
 *                       Source: config.silo0.maxLtv, config.silo0.lt, etc. (from fetchMarketConfig)
 * @param wizardValue - Value from wizard state (0-1 format, e.g., 0.75 for 75%)
 *                      Source: wizardData.borrowConfiguration.token0.maxLTV, etc.
 * @returns true if values match, false otherwise
 */
export function verifyNumericValue(
  onChainValue: bigint,
  wizardValue: number
): boolean {
  // Convert wizard value (0-1, e.g., 0.75 for 75%) to 18 decimals format
  // Same conversion as in deployArgs.ts: to18Decimals(bp) = BigInt(Math.round(bp * 100)) * 10^14
  const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14
  const wizardValueIn18Decimals = BigInt(Math.round(wizardValue * 100)) * BP2DP_NORMALIZATION
  
  return onChainValue === wizardValueIn18Decimals
}
