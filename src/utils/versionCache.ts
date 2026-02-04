/**
 * In-memory cache for contract versions from Silo Lens getVersion(address).
 * Key: chainId + address (same contract on same chain = same version).
 * Avoids repeated RPC calls when switching tabs or remounting.
 */
const cache = new Map<string, string>()

function cacheKey(chainId: string, address: string): string {
  const addr = typeof address === 'string' ? address.toLowerCase().trim() : ''
  return `${chainId}:${addr}`
}

export function getCachedVersion(chainId: string, address: string): string | null {
  if (!chainId || !address) return null
  return cache.get(cacheKey(chainId, address)) ?? null
}

export function setCachedVersion(chainId: string, address: string, version: string): void {
  if (!chainId || !address) return
  cache.set(cacheKey(chainId, address), version)
}
