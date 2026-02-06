import { resolveAddressToName } from '@/utils/symbolToAddress'

/**
 * Address in JSON Verification
 * 
 * Verifies whether an address exists in the addresses JSON file for the given chain.
 * This verification is independent of wizard data and can be performed for any address.
 * 
 * @param address - Address to check (from on-chain config or any source)
 * @param chainId - Chain ID as string (e.g., "1" for mainnet, "137" for polygon)
 * @returns Promise<boolean> - true if address is found in addresses JSON, false otherwise
 */
export async function verifyAddressInJson(
  address: string,
  chainId: string
): Promise<boolean> {
  try {
    const name = await resolveAddressToName(chainId, address)
    return name !== null
  } catch (err) {
    console.warn('Failed to check address in JSON:', err)
    return false
  }
}
