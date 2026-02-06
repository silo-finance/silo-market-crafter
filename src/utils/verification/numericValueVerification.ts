import { convertWizardTo18Decimals } from './normalization'

/**
 * Numeric Value Verification
 * 
 * Verifies that an on-chain numeric value (in 18 decimals format) matches the value set in the wizard.
 * This function can be used for any percentage-based value (Max LTV, Liquidation Threshold, etc.).
 * 
 * @param onChainValue - Value from on-chain contract (in 18 decimals format)
 *                       Source: config.silo0.maxLtv, config.silo0.lt, etc. (from fetchMarketConfig)
 * @param wizardValue - Value from wizard state (BigInt in on-chain format: percentage * 10^16)
 *                      Source: wizardData.borrowConfiguration.token0.maxLTV, etc.
 * @returns true if values match, false otherwise
 */
export function verifyNumericValue(
  onChainValue: bigint,
  wizardValue: bigint
): boolean {
  // Wizard stores values as BigInt in on-chain format; convertWizardTo18Decimals is pass-through
  const wizardValueIn18Decimals = convertWizardTo18Decimals(wizardValue)
  
  return onChainValue === wizardValueIn18Decimals
}
