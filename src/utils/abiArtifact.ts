import { ethers } from 'ethers'

/**
 * Normalizes ABI artifact JSON imports across two shapes used in this repo:
 *   1) Foundry-style: `{ abi: [...] }` (with extra metadata fields)
 *   2) Plain array: `[...]`
 *
 * Returns a value usable as `ethers.InterfaceAbi` regardless of the source.
 *
 * Always prefer JSON ABI files over inline TS definitions (per repo policy).
 */
export function getAbi(artifact: unknown): ethers.InterfaceAbi {
  if (Array.isArray(artifact)) {
    return artifact as unknown as ethers.InterfaceAbi
  }
  if (artifact && typeof artifact === 'object' && 'abi' in artifact) {
    const abi = (artifact as { abi: unknown }).abi
    if (Array.isArray(abi)) {
      return abi as unknown as ethers.InterfaceAbi
    }
  }
  throw new Error('Unsupported ABI artifact shape: expected array or { abi: [...] }')
}
