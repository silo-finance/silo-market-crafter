import { ethers } from 'ethers'
import dynamicKinkModelAbi from '@/abis/silo/DynamicKinkModel.json'
import { SafePendingTransaction } from '@/utils/verification/safeQueue'

export const UPDATE_CONFIG_SELECTOR = '0x4b3734cf'
export const MULTISEND_SELECTOR = '0x8d80ff0a'

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

function decodeUpdateConfigFromDataDecoded(dataDecoded: unknown): DecodedUpdateConfig | null {
  if (!dataDecoded || typeof dataDecoded !== 'object') return null

  const asRecord = dataDecoded as Record<string, unknown>
  const method = asRecord.method
  if (typeof method !== 'string' || method.toLowerCase() !== 'updateconfig') return null

  const parameters = Array.isArray(asRecord.parameters) ? asRecord.parameters : []
  const configParam = parameters.find((param) => {
    if (!param || typeof param !== 'object') return false
    const p = param as Record<string, unknown>
    const name = typeof p.name === 'string' ? p.name.toLowerCase() : ''
    return name === 'config' || name === '_config'
  }) as Record<string, unknown> | undefined

  if (!configParam) return null
  const value = configParam.value
  if (!value || typeof value !== 'object') return null

  const config = value as Record<string, unknown>
  const requiredKeys = [
    'ulow',
    'u1',
    'u2',
    'ucrit',
    'rmin',
    'kmin',
    'kmax',
    'alpha',
    'cminus',
    'cplus',
    'c1',
    'c2',
    'dmax',
  ] as const

  const hasAllKeys = requiredKeys.every((key) => key in config)
  if (!hasAllKeys) return null

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

function isMultiSendDataDecoded(dataDecoded: unknown): boolean {
  if (!dataDecoded || typeof dataDecoded !== 'object') return false
  const method = (dataDecoded as Record<string, unknown>).method
  return typeof method === 'string' && method.toLowerCase() === 'multisend'
}

function isMultiSendCalldata(data: string | null | undefined): data is string {
  if (!data || !data.startsWith('0x')) return false
  return data.slice(0, 10).toLowerCase() === MULTISEND_SELECTOR
}

interface MultiSendInnerCall {
  to: string
  data: string | null
  dataDecoded: unknown
}

function parseInnerCallsFromDataDecoded(dataDecoded: unknown): MultiSendInnerCall[] {
  if (!isMultiSendDataDecoded(dataDecoded)) return []
  const parameters = (dataDecoded as { parameters?: unknown }).parameters
  if (!Array.isArray(parameters) || parameters.length === 0) return []

  for (const param of parameters) {
    if (!param || typeof param !== 'object') continue
    const valueDecoded = (param as Record<string, unknown>).valueDecoded
    if (!Array.isArray(valueDecoded)) continue

    const innerCalls: MultiSendInnerCall[] = []
    for (const inner of valueDecoded) {
      if (!inner || typeof inner !== 'object') continue
      const innerRecord = inner as Record<string, unknown>
      const innerTo = typeof innerRecord.to === 'string' ? innerRecord.to : null
      if (!innerTo) continue
      const innerData = typeof innerRecord.data === 'string' ? innerRecord.data : null
      innerCalls.push({
        to: innerTo,
        data: innerData,
        dataDecoded: innerRecord.dataDecoded ?? null,
      })
    }
    if (innerCalls.length > 0) return innerCalls
  }

  return []
}

// Fallback decoder for multiSend calldata when `dataDecoded.valueDecoded` is
// not provided by the Safe transaction service. Each inner call is packed as:
// operation (1 byte) | to (20 bytes) | value (32 bytes) | dataLen (32 bytes) | data (dataLen bytes)
function parseInnerCallsFromMultiSendCalldata(data: string): MultiSendInnerCall[] {
  if (!isMultiSendCalldata(data)) return []

  try {
    const [packed] = ethers.AbiCoder.defaultAbiCoder().decode(['bytes'], '0x' + data.slice(10))
    const hex = (packed as string).startsWith('0x') ? (packed as string).slice(2) : (packed as string)
    const bytes = ethers.getBytes('0x' + hex)

    const calls: MultiSendInnerCall[] = []
    let offset = 0
    while (offset < bytes.length) {
      if (offset + 1 + 20 + 32 + 32 > bytes.length) break
      offset += 1 // skip operation
      const toHex = ethers.hexlify(bytes.slice(offset, offset + 20))
      offset += 20
      offset += 32 // skip value
      const dataLenHex = ethers.hexlify(bytes.slice(offset, offset + 32))
      const dataLen = Number(BigInt(dataLenHex))
      offset += 32
      if (offset + dataLen > bytes.length) break
      const innerData = dataLen > 0 ? ethers.hexlify(bytes.slice(offset, offset + dataLen)) : '0x'
      offset += dataLen
      calls.push({
        to: ethers.getAddress(toHex),
        data: innerData,
        dataDecoded: null,
      })
    }
    return calls
  } catch {
    return []
  }
}

function expandBatchedTransaction(tx: SafePendingTransaction): SafePendingTransaction[] {
  let innerCalls = parseInnerCallsFromDataDecoded(tx.dataDecoded)
  if (innerCalls.length === 0 && tx.data) {
    innerCalls = parseInnerCallsFromMultiSendCalldata(tx.data)
  }
  if (innerCalls.length === 0) return [tx]

  return innerCalls.map((call, index) => ({
    safeTxHash: `${tx.safeTxHash}#${index}`,
    nonce: tx.nonce,
    to: ethers.getAddress(call.to),
    data: call.data,
    dataDecoded: call.dataDecoded,
    submissionDate: tx.submissionDate,
    isExecuted: tx.isExecuted,
  }))
}

export function extractIrmUpdateCandidates(
  txs: SafePendingTransaction[]
): IrmUpdateCandidate[] {
  const candidates: IrmUpdateCandidate[] = []

  const expandedTxs = txs.flatMap(expandBatchedTransaction)

  for (const tx of expandedTxs) {
    let decodedConfig: DecodedUpdateConfig | null = null

    if (isUpdateConfigCalldata(tx.data)) {
      try {
        decodedConfig = decodeUpdateConfigCalldata(tx.data)
      } catch {
        decodedConfig = null
      }
    }

    if (!decodedConfig) {
      decodedConfig = decodeUpdateConfigFromDataDecoded(tx.dataDecoded)
    }

    if (!decodedConfig) continue

    candidates.push({ tx, decodedConfig })
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
