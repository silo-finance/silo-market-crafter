/**
 * Token Verification
 * 
 * Verifies that the on-chain token address matches the value set in the wizard.
 * 
 * @param onChainToken - Token address from on-chain contract
 *                       Source: config.silo0.token or config.silo1.token (from fetchMarketConfig)
 * @param wizardToken - Token address from wizard state
 *                      Source: wizardData.token0.address or wizardData.token1.address
 * @returns true if addresses match, false otherwise
 */
export function verifyToken(
  onChainToken: string,
  wizardToken: string | null | undefined
): boolean {
  if (!wizardToken) {
    return false
  }
  
  // Normalize addresses for comparison (lowercase)
  const normalizedOnChain = onChainToken.toLowerCase()
  const normalizedWizard = wizardToken.toLowerCase()
  
  return normalizedOnChain === normalizedWizard
}
