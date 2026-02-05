/**
 * Resolve symbol/name to address from Silo repo addresses JSON.
 * Same source as Step 1 (assets) and Step 8 (hook owner).
 */

/** Base URL for per-chain addresses (key -> address). Branch: master. */
export const ADDRESSES_JSON_BASE =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/common/addresses'

export function getChainNameForAddresses(chainId: string): string {
  const map: { [key: string]: string } = {
    '1': 'mainnet',
    '137': 'polygon',
    '42161': 'arbitrum_one',
    '43114': 'avalanche',
    '8453': 'base',
    '11155111': 'sepolia',
    '10': 'optimism',
    '31337': 'anvil',
    '146': 'sonic',
    '653': 'sonic_testnet'
  }
  return map[chainId] || `chain_${chainId}`
}

/**
 * Resolve symbol/name to address from Silo repo addresses JSON (case-insensitive full match).
 * Returns address and exact key from JSON for display.
 */
export async function resolveSymbolToAddress(
  chainId: string,
  symbol: string
): Promise<{ address: string; exactSymbol: string } | null> {
  const chainName = getChainNameForAddresses(chainId)
  const url = `${ADDRESSES_JSON_BASE}/${chainName}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, string>
    const key = symbol.trim()
    const found = Object.keys(data).find((k) => k.toLowerCase() === key.toLowerCase())
    if (!found) return null
    const addr = data[found]
    if (typeof addr !== 'string' || !addr.startsWith('0x')) return null
    return { address: addr, exactSymbol: found }
  } catch {
    return null
  }
}

/** URL to the addresses JSON for a given chain (for "supported symbols" link). */
export function getAddressesJsonUrl(chainId: string): string {
  const chainName = getChainNameForAddresses(chainId)
  return `${ADDRESSES_JSON_BASE}/${chainName}.json`
}

/**
 * Resolve address to name/key from Silo repo addresses JSON (reverse lookup).
 * Returns the exact key from JSON if this address is present, otherwise null.
 */
export async function resolveAddressToName(
  chainId: string,
  address: string
): Promise<string | null> {
  const normalized = address?.trim()
  if (!normalized || !normalized.startsWith('0x')) return null
  const chainName = getChainNameForAddresses(chainId)
  const url = `${ADDRESSES_JSON_BASE}/${chainName}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, string>
    const addrLower = normalized.toLowerCase()
    const found = Object.entries(data).find(
      ([, addr]) => typeof addr === 'string' && addr.toLowerCase() === addrLower
    )
    return found ? found[0] : null
  } catch {
    return null
  }
}
