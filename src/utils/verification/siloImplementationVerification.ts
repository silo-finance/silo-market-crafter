/**
 * Silo Implementation Verification
 * 
 * Verifies that the implementation address used for deployment matches
 * the expected implementation address from the repository.
 * 
 * @param implementationFromEvent - Implementation address extracted from NewSilo event (on-chain)
 *                                   Source: parsed.implementation from parseDeployTxReceipt(receipt)
 * @param implementationFromRepo - Implementation address from repository JSON file
 *                                 Source: silo-core/deploy/silo/_siloImplementations.json[chainName]
 * @returns true if addresses match, false otherwise
 */
export function verifySiloImplementation(
  implementationFromEvent: string,
  implementationFromRepo: string | null
): boolean {
  if (!implementationFromRepo) {
    return false
  }
  
  // Normalize addresses for comparison (lowercase)
  const normalizedEvent = implementationFromEvent.toLowerCase()
  const normalizedRepo = implementationFromRepo.toLowerCase()
  
  return normalizedEvent === normalizedRepo
}
