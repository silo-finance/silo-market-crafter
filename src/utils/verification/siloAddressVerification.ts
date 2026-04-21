import { ethers } from 'ethers'
import siloFactoryArtifact from '@/abis/silo/ISiloFactory.json'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'

const siloFactoryAbi = (siloFactoryArtifact as { abi: ethers.InterfaceAbi }).abi

const isSiloAbi = [
  {
    type: 'function' as const,
    name: 'isSilo',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view' as const
  }
] as const

/**
 * Silo Address Verification
 *
 * Verifies that a silo address exists in the Silo Factory contract by calling
 * SiloFactory.isSilo(siloAddress) on-chain.
 *
 * @param siloAddress - Silo address to verify (from on-chain config: config.silo0.silo or config.silo1.silo)
 * @param siloFactoryAddress - Silo Factory contract address (from repository deployment JSON)
 * @param provider - Ethers.js provider for making on-chain contract calls
 * @returns Promise<boolean> - true if address is verified as a silo, false otherwise
 */
export async function verifySiloAddress(
  siloAddress: string,
  siloFactoryAddress: string,
  provider: ethers.Provider
): Promise<boolean> {
  try {
    const factoryContract = new ethers.Contract(siloFactoryAddress, siloFactoryAbi, provider)
    const isSiloResult = await factoryContract.isSilo(siloAddress)
    return Boolean(isSiloResult)
  } catch (error) {
    console.error('Failed to verify silo address:', error)
    return false
  }
}

/**
 * Batched variant: verifies multiple silo addresses against the same Silo Factory
 * in a single Multicall3 RPC round-trip. Preserves input order in the returned array.
 * Any per-call failure (revert / decode error) results in `false` for that entry.
 */
export async function verifySiloAddresses(
  siloAddresses: string[],
  siloFactoryAddress: string,
  provider: ethers.Provider
): Promise<boolean[]> {
  if (siloAddresses.length === 0) return []
  try {
    const calls = siloAddresses.map((addr) =>
      buildReadMulticallCall<boolean>({
        target: siloFactoryAddress as `0x${string}`,
        abi: isSiloAbi,
        functionName: 'isSilo',
        args: [addr],
        allowFailure: true,
        decodeResult: (v) => Boolean(v)
      })
    )
    const results = await executeReadMulticall<boolean>(provider, calls, {
      debugLabel: 'verifySiloAddresses'
    })
    return results.map((r) => r === true)
  } catch (error) {
    console.error('Failed to verify silo addresses (multicall):', error)
    return siloAddresses.map(() => false)
  }
}
