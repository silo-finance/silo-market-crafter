/**
 * IRM Owner Verification
 * 
 * Verifies that the on-chain IRM owner address matches the value set in the wizard.
 * Note: IRM owner typically exists for Kink models.
 * 
 * @param onChainOwner - IRM owner address from on-chain contract
 *                       Source: marketConfig.silo0.interestRateModel.owner (from fetchMarketConfig)
 * @param wizardOwner - IRM owner address from wizard state
 *                      Source: wizardData.hookOwnerAddress (IRM owner is the same as hook owner)
 * @returns true if addresses match, false otherwise
 */
export function verifyIrmOwner(
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
