import { ethers } from 'ethers'
import { getChainIdByChainName } from '@/utils/networks'

const SILO_DEPLOYMENTS_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/silo/_siloDeployments.json'

type SiloDeployments = Record<string, Record<string, string>>

let addressToChainNamePromise: Promise<Map<string, string>> | null = null

async function fetchAddressToChainNameMap(): Promise<Map<string, string>> {
  if (addressToChainNamePromise) return addressToChainNamePromise

  addressToChainNamePromise = (async () => {
    const response = await fetch(SILO_DEPLOYMENTS_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch Silo deployments JSON (${response.status})`)
    }

    const data = (await response.json()) as SiloDeployments
    const map = new Map<string, string>()

    for (const [chainName, deployments] of Object.entries(data)) {
      for (const address of Object.values(deployments)) {
        if (!address || !ethers.isAddress(address)) continue
        map.set(address.toLowerCase(), chainName)
      }
    }

    return map
  })().catch((error) => {
    // Reset cache on failure to allow retry on subsequent attempts.
    addressToChainNamePromise = null
    throw error
  })

  return addressToChainNamePromise
}

export interface DetectedSiloConfigNetwork {
  chainName: string
  chainId: number
}

/**
 * Detect chain for a SiloConfig address by scanning _siloDeployments.json entries.
 * Returns null when address is unknown or chain is unsupported in this app.
 */
export async function detectSiloConfigNetwork(
  siloConfigAddress: string
): Promise<DetectedSiloConfigNetwork | null> {
  if (!siloConfigAddress || !ethers.isAddress(siloConfigAddress)) return null

  const map = await fetchAddressToChainNameMap()
  const chainName = map.get(siloConfigAddress.toLowerCase())
  if (!chainName) return null

  const chainId = getChainIdByChainName(chainName)
  if (chainId == null) return null

  return { chainName, chainId }
}
