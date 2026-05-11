import { ethers } from 'ethers'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'
import { getChainName } from '@/utils/networks'
import siloFactoryAbiArtifact from '@/abis/silo/ISiloFactory.json'

const SILO_CONFIG_ABI = [
  {
    type: 'function',
    name: 'config',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract ISiloConfig' }],
    stateMutability: 'view'
  }
] as const

const siloFactoryAbi = (
  Array.isArray(siloFactoryAbiArtifact)
    ? siloFactoryAbiArtifact
    : (siloFactoryAbiArtifact as unknown as { abi: ethers.InterfaceAbi }).abi
) as ethers.InterfaceAbi

const siloFactoryAddressCache = new Map<string, string | null>()

async function fetchSiloFactoryAddress(chainId: string | number): Promise<string | null> {
  const normalizedChainId = String(chainId)
  if (siloFactoryAddressCache.has(normalizedChainId)) {
    return siloFactoryAddressCache.get(normalizedChainId) ?? null
  }

  const chainName = getChainName(normalizedChainId)
  const response = await fetch(
    `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloFactory.sol.json`
  )
  if (!response.ok) {
    siloFactoryAddressCache.set(normalizedChainId, null)
    return null
  }

  const data = await response.json()
  const address = data.address || ''
  if (!address || !ethers.isAddress(address)) {
    siloFactoryAddressCache.set(normalizedChainId, null)
    return null
  }

  const normalized = ethers.getAddress(address)
  siloFactoryAddressCache.set(normalizedChainId, normalized)
  return normalized
}

/**
 * Resolves an address to SiloConfig address.
 * - If known to be Silo (e.g. from URL param): calls config() on Silo contract.
 * - If unknown: tries config() first – Silo has it, SiloConfig does not. On success → Silo; on revert → SiloConfig.
 */
export async function resolveAddressToSiloConfig(
  provider: ethers.Provider,
  address: string,
  options?: { knownSilo?: boolean }
): Promise<string> {
  const normalized = ethers.getAddress(address)

  if (options?.knownSilo) {
    const siloContract = new ethers.Contract(normalized, SILO_CONFIG_ABI, provider)
    const siloConfigAddress = await siloContract.config()
    return ethers.getAddress(siloConfigAddress)
  }

  // Try config() first – Silo has it, SiloConfig does not. If it succeeds, we have a Silo.
  // SiloLens version can be "legacy", empty, or inconsistent format, so we don't rely on it.
  try {
    const siloContract = new ethers.Contract(normalized, SILO_CONFIG_ABI, provider)
    const siloConfigAddress = await siloContract.config()
    const resolved = ethers.getAddress(siloConfigAddress)
    if (resolved && resolved !== ethers.ZeroAddress) {
      return resolved
    }
  } catch {
    // config() reverted – address is SiloConfig, use as-is
  }

  return normalized
}

export async function resolveSiloIdToSiloConfig(
  provider: ethers.Provider,
  chainId: string | number,
  siloId: string | number | bigint
): Promise<string> {
  const idValue = typeof siloId === 'bigint' ? siloId : BigInt(String(siloId).trim())
  if (idValue <= BigInt(0)) {
    throw new Error('SILO_ID must be greater than 0.')
  }

  const factoryAddress = await fetchSiloFactoryAddress(chainId)
  if (!factoryAddress) {
    throw new Error('Silo Factory deployment not found on current chain.')
  }

  const factoryContract = new ethers.Contract(factoryAddress, siloFactoryAbi, provider)
  const siloConfigAddress = await factoryContract.idToSiloConfig(idValue)
  const normalizedSiloConfig = ethers.getAddress(String(siloConfigAddress))
  if (!normalizedSiloConfig || normalizedSiloConfig === ethers.ZeroAddress) {
    throw new Error(`Silo ID ${idValue.toString()} not found on current chain.`)
  }

  const code = await provider.getCode(normalizedSiloConfig)
  if (!code || code === '0x' || code === '0x0') {
    throw new Error(`Silo ID ${idValue.toString()} resolved to non-contract address on current chain.`)
  }

  return normalizedSiloConfig
}

/**
 * Batched resolver: for each address, returns the corresponding SiloConfig address.
 * - When an address is a Silo, `config()` returns the SiloConfig.
 * - When an address is already a SiloConfig, `config()` reverts and we keep the input as-is.
 * Uses a single Multicall3 round-trip with `allowFailure: true` to probe all addresses at once.
 */
export async function resolveAddressesToSiloConfigs(
  provider: ethers.Provider,
  addresses: string[]
): Promise<string[]> {
  if (addresses.length === 0) return []

  const normalized = addresses.map((addr) => ethers.getAddress(addr))

  const calls = normalized.map((addr) =>
    buildReadMulticallCall<string>({
      target: addr as `0x${string}`,
      abi: SILO_CONFIG_ABI,
      functionName: 'config',
      allowFailure: true,
      decodeResult: (v) => ethers.getAddress(String(v))
    })
  )

  const results = await executeReadMulticall<string>(provider, calls, {
    debugLabel: 'resolveAddressesToSiloConfigs'
  })

  return normalized.map((addr, i) => {
    const resolved = results[i]
    if (resolved && resolved !== ethers.ZeroAddress) return resolved
    return addr
  })
}
