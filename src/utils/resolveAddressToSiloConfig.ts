import { ethers } from 'ethers'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'

const SILO_CONFIG_ABI = [
  {
    type: 'function',
    name: 'config',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract ISiloConfig' }],
    stateMutability: 'view'
  }
] as const

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
