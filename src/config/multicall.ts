import { NETWORK_CONFIGS } from '@/utils/networks'

export type Multicall3Config = {
  address: `0x${string}`
  blockCreated?: number
}

/**
 * Multicall3 deployments per supported chain. Mirrors the list in `src/utils/networks.ts`
 * so any RPC-heavy flow can batch reads through a single `aggregate3` call.
 *
 * Addresses come from https://www.multicall3.com/deployments (canonical `0xca11…`),
 * except for non-standard deployments (e.g. XDC = `50`) where the project must ship
 * an explicit alternative address.
 */
export const MULTICALL3_BY_CHAIN_ID: Record<number, Multicall3Config> = {
  1: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    blockCreated: 14353601,
  },
  10: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    blockCreated: 4286263,
  },
  50: {
    address: '0x0B1795ccA8E4eC4df02346a082df54D437F8D9aF',
    blockCreated: 75884020,
  },
  56: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    blockCreated: 15921452,
  },
  146: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    blockCreated: 60,
  },
  196: {
    address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    blockCreated: 47416,
  },
  1776: {
    address: '0xcA11bde05977b3631167028862bE2a173976CA11',
  },
  4326: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
  },
  5000: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
  },
  42161: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    blockCreated: 7654707,
  },
  43114: {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    blockCreated: 11907934,
  },
}

export function getMulticall3Config(chainId: number): Multicall3Config | null {
  return MULTICALL3_BY_CHAIN_ID[chainId] ?? null
}

/**
 * Returns chain ids that are registered in NETWORK_CONFIGS but missing a Multicall3 entry.
 * Used by tests to prevent silent degradation (strict-mode requires every supported chain
 * to have a Multicall3 address configured).
 */
export function findChainsMissingMulticall3(): number[] {
  const missing: number[] = []
  for (const network of NETWORK_CONFIGS) {
    if (!MULTICALL3_BY_CHAIN_ID[network.chainId]) missing.push(network.chainId)
  }
  return missing
}
