/**
 * Hook Owner Verification
 * 
 * Verifies that the on-chain hook owner address matches the value set in the wizard.
 * 
 * @param onChainOwner - Hook owner address from on-chain contract
 *                       Source: marketConfig.silo0.hookReceiverOwner (from fetchMarketConfig)
 * @param wizardOwner - Hook owner address from wizard state
 *                      Source: wizardData.hookOwnerAddress
 * @returns true if addresses match, false otherwise
 */
export function verifyHookOwner(
  onChainOwner: string,
  wizardOwner: string | null | undefined
): boolean {
  if (!wizardOwner) {
    return false
  }
  
  // Normalize addresses for comparison (lowercase)
  const normalizedOnChain = onChainOwner.toLowerCase()
  const normalizedWizard = wizardOwner.toLowerCase()
  
  return normalizedOnChain === normalizedWizard
}
