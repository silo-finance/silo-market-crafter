/**
 * Deployer Fee Verification
 * 
 * Verifies that the on-chain Deployer fee value matches the value set in the wizard.
 * 
 * @param onChainValue - Deployer fee value from on-chain contract (in 18 decimals format)
 *                       Source: config.silo0.deployerFee (from fetchMarketConfig)
 * @param wizardValue - Deployer fee value from wizard state (0-1 format, e.g., 0.05 for 5%)
 *                      Source: wizardData.feesConfiguration.deployerFee
 * @returns true if values match, false otherwise
 */
export function verifyDeployerFee(
  onChainValue: bigint,
  wizardValue: number
): boolean {
  // Convert wizard value (0-1, e.g., 0.05 for 5%) to 18 decimals format
  // Same conversion as in deployArgs.ts: to18Decimals(bp) = BigInt(Math.round(bp * 100)) * 10^14
  const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14
  const wizardValueIn18Decimals = BigInt(Math.round(wizardValue * 100)) * BP2DP_NORMALIZATION
  
  return onChainValue === wizardValueIn18Decimals
}

/**
 * Check if Deployer Fee is unexpectedly high (> 5%)
 * 
 * @param onChainValue - Deployer fee value from on-chain contract (in 18 decimals format)
 * @returns true if fee is greater than 5%, false otherwise
 */
export function isDeployerFeeHigh(
  onChainValue: bigint
): boolean {
  // 5% in 18 decimals format: 0.05 * 100 * 10^14 = 5 * 10^14
  const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14
  const fivePercent = BigInt(5) * BP2DP_NORMALIZATION
  
  return onChainValue > fivePercent
}
