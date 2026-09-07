import { ethers } from 'ethers'
import factoryArtifact from '@/abis/silo/ISiloFactory.json'
import { getAbi } from '@/utils/abiArtifact'
import { parseDeployTxReceipt } from '@/utils/parseDeployTxEvents'

const factoryInterface = new ethers.Interface(getAbi(factoryArtifact))
const newSiloEvent = factoryInterface.getEvent('NewSilo')
if (!newSiloEvent) {
  throw new Error('NewSilo event is missing from ISiloFactory ABI')
}
const NEW_SILO_TOPIC = newSiloEvent.topicHash

/** Wallet RPCs typically cap eth_getLogs range; shrink on failure. */
const LOG_CHUNK_SIZES = [50_000, 10_000, 2_000] as const
/** When factory deploy block is unknown, do not scan the entire chain. */
const MAX_LOOKBACK_BLOCKS = 6_000_000

export interface NewSiloImplementationMatch {
  implementation: string
  transactionHash: string | null
}

export interface MarketNewSiloFilter {
  siloConfig: string
  silo0?: string
  silo1?: string
}

type DecodableLog = Pick<ethers.Log, 'topics' | 'data'> & {
  transactionHash?: string | null
}

/**
 * Picks the NewSilo log for this market. Same token pair can appear more than once,
 * so siloConfig (then silo0/silo1) is the discriminator.
 */
export function matchNewSiloLogs(
  logs: DecodableLog[],
  filter: MarketNewSiloFilter
): NewSiloImplementationMatch | null {
  const siloConfig = filter.siloConfig.toLowerCase()
  const silo0 = filter.silo0?.toLowerCase()
  const silo1 = filter.silo1?.toLowerCase()

  for (const log of logs) {
    let parsed: ethers.LogDescription | null
    try {
      parsed = factoryInterface.parseLog({ topics: log.topics as string[], data: log.data })
    } catch {
      continue
    }
    if (!parsed || parsed.name !== 'NewSilo') continue

    const implementation = String(parsed.args[0])
    const eventSilo0 = String(parsed.args[3]).toLowerCase()
    const eventSilo1 = String(parsed.args[4]).toLowerCase()
    const eventSiloConfig = String(parsed.args[5]).toLowerCase()

    const configMatch = eventSiloConfig === siloConfig
    const siloMatch =
      (silo0 != null && eventSilo0 === silo0) ||
      (silo1 != null && eventSilo1 === silo1)

    if (!configMatch && !siloMatch) continue
    if (!ethers.isAddress(implementation)) continue

    return {
      implementation: ethers.getAddress(implementation),
      transactionHash: log.transactionHash ?? null
    }
  }

  return null
}

export function implementationFromDeployReceipt(
  receipt: ethers.TransactionReceipt
): NewSiloImplementationMatch | null {
  const parsed = parseDeployTxReceipt(receipt)
  if (!parsed.implementation || !ethers.isAddress(parsed.implementation)) {
    return null
  }
  return {
    implementation: ethers.getAddress(parsed.implementation),
    transactionHash: receipt.hash ?? null
  }
}

export function parseFactoryDeployBlock(deploymentJson: unknown): number | null {
  if (!deploymentJson || typeof deploymentJson !== 'object') return null
  const data = deploymentJson as Record<string, unknown>
  const receipt = data.receipt
  if (receipt && typeof receipt === 'object') {
    const fromReceipt = parseBlockNumber((receipt as Record<string, unknown>).blockNumber)
    if (fromReceipt != null) return fromReceipt
  }
  return parseBlockNumber(data.blockNumber)
}

function parseBlockNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = value.startsWith('0x') ? Number.parseInt(value, 16) : Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

/**
 * Official SiloFactory.sol.json deploy block, only when that file is for this factory.
 * Older markets may have been created by a different factory.
 */
export async function fetchFactoryDeployFromBlock(params: {
  chainName: string
  factoryAddress: string
}): Promise<number | null> {
  if (!ethers.isAddress(params.factoryAddress)) return null
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${params.chainName}/SiloFactory.sol.json`
    )
    if (!response.ok) return null
    const data = await response.json()
    const address = typeof data?.address === 'string' ? data.address : ''
    if (!address || !ethers.isAddress(address)) return null
    if (ethers.getAddress(address) !== ethers.getAddress(params.factoryAddress)) return null
    return parseFactoryDeployBlock(data)
  } catch {
    return null
  }
}

function newSiloTopics(token0: string, token1: string): (string | null)[] {
  return [
    NEW_SILO_TOPIC,
    null,
    ethers.zeroPadValue(ethers.getAddress(token0), 32),
    ethers.zeroPadValue(ethers.getAddress(token1), 32)
  ]
}

export async function fetchSiloImplementationFromNewSilo(params: {
  provider: ethers.Provider
  receipt?: ethers.TransactionReceipt | null
  factoryAddress: string
  token0: string
  token1: string
  siloConfig: string
  silo0?: string
  silo1?: string
  fromBlock?: number | null
}): Promise<NewSiloImplementationMatch | null> {
  if (params.receipt) {
    const fromReceipt = implementationFromDeployReceipt(params.receipt)
    if (fromReceipt) return fromReceipt
  }

  if (
    !ethers.isAddress(params.factoryAddress) ||
    !ethers.isAddress(params.token0) ||
    !ethers.isAddress(params.token1) ||
    !ethers.isAddress(params.siloConfig)
  ) {
    return null
  }

  const latest = await params.provider.getBlockNumber()
  const requestedFrom =
    params.fromBlock != null && params.fromBlock >= 0 ? Math.floor(params.fromBlock) : null
  const lowerBound = requestedFrom != null
    ? requestedFrom
    : Math.max(0, latest - MAX_LOOKBACK_BLOCKS)

  const topics = newSiloTopics(params.token0, params.token1)
  const filter: MarketNewSiloFilter = {
    siloConfig: params.siloConfig,
    silo0: params.silo0,
    silo1: params.silo1
  }
  const factoryAddress = ethers.getAddress(params.factoryAddress)

  try {
    const logs = await params.provider.getLogs({
      address: factoryAddress,
      fromBlock: lowerBound,
      toBlock: latest,
      topics
    })
    const match = matchNewSiloLogs(logs, filter)
    if (match) return match
    if (requestedFrom != null) return null
  } catch {
    // Range too wide for this RPC; scan backwards in shrinking chunks.
  }

  let chunkSize: number = LOG_CHUNK_SIZES[0]
  let toBlock = latest

  while (toBlock >= lowerBound) {
    const fromBlock = Math.max(lowerBound, toBlock - chunkSize + 1)
    try {
      const logs = await params.provider.getLogs({
        address: factoryAddress,
        fromBlock,
        toBlock,
        topics
      })
      const match = matchNewSiloLogs(logs, filter)
      if (match) return match
      if (fromBlock <= lowerBound) break
      toBlock = fromBlock - 1
    } catch (err) {
      const nextSize = LOG_CHUNK_SIZES.find((size) => size < chunkSize)
      if (nextSize == null) {
        console.warn('Failed to query NewSilo logs:', err)
        return null
      }
      chunkSize = nextSize
    }
  }

  return null
}
