import { ethers } from 'ethers'
import { getCachedVersion, setCachedVersion } from '@/utils/versionCache'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'

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
      const fallbackVersions = await fetchVersionsIndividually({
        provider,
        lensAddress,
        addresses: emptyVersionAddresses
      })
      emptyVersionAddresses.forEach((address, idx) => {
        const normalized = address.toLowerCase()
        const version = fallbackVersions[idx] ?? ''
        setCachedVersion(chainId, normalized, version)
        result.set(normalized, version)
      })
    }

    return result
  } catch {
    // Some deployments may not support getVersions yet - fallback to per-address.
  }

  const individualVersions = await fetchVersionsIndividually({
    provider,
    lensAddress,
    addresses: toFetch
  })
  toFetch.forEach((address, idx) => {
    const version = individualVersions[idx]
    if (version == null) return
    const normalized = address.toLowerCase()
    setCachedVersion(chainId, normalized, version)
    result.set(normalized, version)
  })

  return result
}

const getVersionAbi = [
  {
    type: 'function' as const,
    name: 'getVersion',
    stateMutability: 'view' as const,
    inputs: [{ name: '_contract', type: 'address' as const }],
    outputs: [{ name: 'version', type: 'string' as const }]
  }
] as const

async function fetchVersionsIndividually({
  provider,
  lensAddress,
  addresses
}: {
  provider: ethers.Provider
  lensAddress: string
  addresses: string[]
}): Promise<(string | null)[]> {
  if (addresses.length === 0) return []
  const calls = addresses.map((addr) =>
    buildReadMulticallCall<string>({
      target: lensAddress as `0x${string}`,
      abi: getVersionAbi,
      functionName: 'getVersion',
      args: [addr],
      allowFailure: true,
      decodeResult: (v) => String(v)
    })
  )
  try {
    const results = await executeReadMulticall<string>(provider, calls, {
      debugLabel: 'siloLensGetVersion'
    })
    return results
  } catch {
    return addresses.map(() => null)
  }
}
