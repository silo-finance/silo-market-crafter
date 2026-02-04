import { ethers } from 'ethers'

/**
 * Normalizes and validates an Ethereum address
 * Returns the normalized address (checksummed) if valid, null otherwise
 * This matches the validation logic used in Step1Assets
 */
export function normalizeAddress(address: string): string | null {
  if (!address || !address.trim()) {
    return null
  }

  try {
    // First try to get the address as-is (this validates and normalizes)
    return ethers.getAddress(address.trim())
  } catch {
    try {
      // If that fails, try with lowercase (which should always work for valid hex)
      const lowerAddress = address.toLowerCase().trim()
      if (/^0x[a-f0-9]{40}$/.test(lowerAddress)) {
        return ethers.getAddress(lowerAddress)
      }
      return null
    } catch {
      return null
    }
  }
}

/**
 * Validates if an address string is a valid Ethereum address format
 * Returns true if valid, false otherwise
 */
export function isValidAddressFormat(address: string): boolean {
  return normalizeAddress(address) !== null
}

/**
 * Returns true if the string looks like a hex address (0x + 40 hex chars).
 * Used to decide whether to treat input as address or as token symbol.
 */
export function isHexAddress(str: string): boolean {
  const s = str.trim()
  return s.length === 42 && s.toLowerCase().startsWith('0x') && /^0x[0-9a-fA-F]{40}$/.test(s)
}
