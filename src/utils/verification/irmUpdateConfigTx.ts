import { ethers } from 'ethers'
import dynamicKinkModelAbi from '@/abis/silo/DynamicKinkModel.json'
import { SafePendingTransaction } from '@/utils/verification/safeQueue'

export const UPDATE_CONFIG_SELECTOR = '0x4b3734cf'

export interface DecodedUpdateConfig {
  [key: string]: string
  ulow: string
  u1: string
  u2: string
  ucrit: string
  rmin: string
  kmin: string
  kmax: string
  alpha: string
  cminus: string
  cplus: string
  c1: string
  c2: string
  dmax: string
}

export interface IrmUpdateCandidate {
  tx: SafePendingTransaction
  decodedConfig: DecodedUpdateConfig
}

const abi = (dynamicKinkModelAbi as { abi?: ethers.InterfaceAbi }).abi ?? (dynamicKinkModelAbi as unknown as ethers.InterfaceAbi)
const dynamicKinkInterface = new ethers.Interface(abi)

function toStringValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return String(value)
}

export function isUpdateConfigCalldata(data: string | null | undefined): data is string {
  if (!data || !data.startsWith('0x')) return false
  return data.slice(0, 10).toLowerCase() === UPDATE_CONFIG_SELECTOR
}

export function decodeUpdateConfigCalldata(data: string): DecodedUpdateConfig {
  const decoded = dynamicKinkInterface.decodeFunctionData('updateConfig', data)
  const config = decoded[0] as Record<string, unknown>

  return {
    ulow: toStringValue(config.ulow),
    u1: toStringValue(config.u1),
    u2: toStringValue(config.u2),
    ucrit: toStringValue(config.ucrit),
    rmin: toStringValue(config.rmin),
    kmin: toStringValue(config.kmin),
    kmax: toStringValue(config.kmax),
    alpha: toStringValue(config.alpha),
    cminus: toStringValue(config.cminus),
    cplus: toStringValue(config.cplus),
    c1: toStringValue(config.c1),
    c2: toStringValue(config.c2),
    dmax: toStringValue(config.dmax)
  }
}

export function extractIrmUpdateCandidates(
  txs: SafePendingTransaction[]
): IrmUpdateCandidate[] {
  const candidates: IrmUpdateCandidate[] = []

  for (const tx of txs) {
    if (!isUpdateConfigCalldata(tx.data)) continue
    try {
      const decodedConfig = decodeUpdateConfigCalldata(tx.data)
      candidates.push({ tx, decodedConfig })
    } catch {
      // Ignore malformed calldata while keeping the flow resilient.
    }
  }

  return candidates
}

export function getMatchingIrmTargetLabel(
  txTarget: string,
  targets: { silo0: string; silo1: string }
): 'silo0' | 'silo1' | null {
  const normalizedTarget = txTarget.toLowerCase()
  if (targets.silo0.toLowerCase() === normalizedTarget) return 'silo0'
  if (targets.silo1.toLowerCase() === normalizedTarget) return 'silo1'
  return null
}
