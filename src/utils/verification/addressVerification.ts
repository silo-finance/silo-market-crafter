/**
 * Address Verification
 * 
 * Verifies that an on-chain address matches the value set in the wizard.
 * This function can be used for any address verification (Hook Owner, IRM Owner, etc.).
 * 
 * @param onChainAddress - Address from on-chain contract
 *                         Source: e.g., marketConfig.silo0.hookReceiverOwner, marketConfig.silo0.interestRateModel.owner
 * @param wizardAddress - Address from wizard state
 *                        Source: e.g., wizardData.hookOwnerAddress
 * @returns true if addresses match, false otherwise
 */
export function verifyAddress(
  onChainAddress: string,
  wizardAddress: string | null | undefined
): boolean {
  if (!wizardAddress) {
    return false
  }
  
  // Normalize addresses for comparison (lowercase)
  const normalizedOnChain = onChainAddress.toLowerCase()
  const normalizedWizard = wizardAddress.toLowerCase()
  
  return normalizedOnChain === normalizedWizard
}
