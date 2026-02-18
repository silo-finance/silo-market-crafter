import { ethers } from 'ethers'
import { getCachedVersion, setCachedVersion } from '@/utils/versionCache'

/**
 * Fetch contract versions from Silo Lens using bulk getVersions(address[]),
 * with fallback to per-address getVersion only if bulk call fails.
 */
export async function fetchSiloLensVersionsWithCache({
  provider,
  lensAddress,
  chainId,
  addresses
}: {
  provider: ethers.Provider
  lensAddress: string
  chainId: string
  addresses: string[]
}): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const toFetch: string[] = []

  for (const rawAddress of addresses) {
    if (!rawAddress || !ethers.isAddress(rawAddress) || rawAddress === ethers.ZeroAddress) continue
    const normalized = ethers.getAddress(rawAddress).toLowerCase()
    if (result.has(normalized)) continue

    const cached = getCachedVersion(chainId, normalized)
    if (cached != null) {
      result.set(normalized, cached)
      continue
    }

    toFetch.push(ethers.getAddress(rawAddress))
  }

  if (toFetch.length === 0) return result

  const lensContract = new ethers.Contract(
    lensAddress,
    [
      {
        type: 'function',
        name: 'getVersion',
        stateMutability: 'view',
        inputs: [{ name: '_contract', type: 'address' }],
        outputs: [{ name: 'version', type: 'string' }]
      },
      {
        type: 'function',
        name: 'getVersions',
        stateMutability: 'view',
        inputs: [{ name: '_contract', type: 'address[]' }],
        outputs: [{ name: 'versions', type: 'string[]' }]
      }
    ] as const,
    provider
  )

  try {
    const versions = await lensContract.getVersions(toFetch)
    const emptyVersionAddresses: string[] = []

    for (let i = 0; i < toFetch.length; i++) {
      const address = toFetch[i].toLowerCase()
      const version = String(versions[i] ?? '')
      if (version === '') {
        emptyVersionAddresses.push(toFetch[i])
        continue
      }
      setCachedVersion(chainId, address, version)
      result.set(address, version)
    }

    if (emptyVersionAddresses.length > 0) {
      await Promise.all(
        emptyVersionAddresses.map(async (address) => {
          try {
            const version = String(await lensContract.getVersion(address))
            const normalized = address.toLowerCase()
            setCachedVersion(chainId, normalized, version)
            result.set(normalized, version)
          } catch {
            // Keep empty value only after explicit single-call attempt.
            const normalized = address.toLowerCase()
            setCachedVersion(chainId, normalized, '')
            result.set(normalized, '')
          }
        })
      )
    }

    return result
  } catch {
    // Some deployments may not support getVersions yet - fallback to per-address.
  }

  await Promise.all(
    toFetch.map(async (address) => {
      try {
        const version = String(await lensContract.getVersion(address))
        const normalized = address.toLowerCase()
        setCachedVersion(chainId, normalized, version)
        result.set(normalized, version)
      } catch {
        // Do not cache failures as empty string to avoid sticky "no version" state.
      }
    })
  )

  return result
}
