import { ethers } from 'ethers'

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
