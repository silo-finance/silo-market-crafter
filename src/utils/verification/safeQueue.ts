import { ethers } from 'ethers'
import { extractHexAddressLike } from '@/utils/addressFromInput'

export interface ParsedSafeUrl {
  chainPrefix: string
  safeAddress: string
}

export interface SafePendingTransaction {
  safeTxHash: string
  nonce: number
  to: string
  data: string | null
  dataDecoded?: unknown
  submissionDate: string
  isExecuted: boolean
}

interface SafePendingResponse {
  results?: Array<{
    safeTxHash?: string
    nonce?: number
    to?: string
    data?: string | null
    dataDecoded?: unknown
    submissionDate?: string
    isExecuted?: boolean
  }>
}

interface SafeNetworkConfig {
  txServiceBaseUrl: string
  chainId: number
}

const SAFE_NETWORK_CONFIG_BY_PREFIX: Record<string, SafeNetworkConfig> = {
  eth: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/eth',
    chainId: 1
  },
  oeth: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/oeth',
    chainId: 10
  },
  bnb: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/bnb',
    chainId: 56
  },
  arb1: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/arb1',
    chainId: 42161
  },
  avax: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/avax',
    chainId: 43114
  },
  sonic: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/sonic',
    chainId: 146
  },
  xlayer: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/okb',
    chainId: 196
  },
  injective: {
    txServiceBaseUrl: 'https://prod.injective.keypersafe.xyz',
    chainId: 1776
  },
  inj: {
    txServiceBaseUrl: 'https://prod.injective.keypersafe.xyz',
    chainId: 1776
  },
  optimism: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/oeth',
    chainId: 10
  },
  arbitrum: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/arb1',
    chainId: 42161
  },
  avalanche: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/avax',
    chainId: 43114
  },
  okx: {
    txServiceBaseUrl: 'https://api.safe.global/tx-service/okb',
    chainId: 196
  }
}

export function parseSafeQueueUrl(rawUrl: string): ParsedSafeUrl {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error('Invalid Safe URL')
  }

  const safeParam = url.searchParams.get('safe')
  if (!safeParam) {
    throw new Error('Safe URL does not contain "safe=" parameter')
  }

  const [chainPrefixRaw, safeAddressRaw] = safeParam.split(':')
  if (!chainPrefixRaw || !safeAddressRaw) {
    throw new Error('Safe URL has invalid "safe=" value')
  }
  if (!ethers.isAddress(safeAddressRaw)) {
    throw new Error('Safe URL contains invalid Safe address')
  }

  return {
    chainPrefix: chainPrefixRaw.toLowerCase(),
    safeAddress: ethers.getAddress(safeAddressRaw)
  }
}

export function getSafeTxServiceBaseUrl(chainPrefix: string): string {
  const config = SAFE_NETWORK_CONFIG_BY_PREFIX[chainPrefix.toLowerCase()]
  if (!config) {
    throw new Error(`Unsupported Safe chain prefix: ${chainPrefix}`)
  }
  return config.txServiceBaseUrl
}

export function getSafeChainId(chainPrefix: string): number {
  const config = SAFE_NETWORK_CONFIG_BY_PREFIX[chainPrefix.toLowerCase()]
  if (!config) {
    throw new Error(`Unsupported Safe chain prefix: ${chainPrefix}`)
  }
  return config.chainId
}

export function getSafeChainIdHex(chainPrefix: string): string {
  const chainId = getSafeChainId(chainPrefix)
  return `0x${chainId.toString(16)}`
}

export function parseSiloConfigAddressesInput(rawInput: string): string[] {
  const rawTokens = rawInput
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => value !== '')

  return rawTokens.map((token) => extractHexAddressLike(token))
}

export async function fetchPendingSafeTransactions(
  parsedSafe: ParsedSafeUrl
): Promise<SafePendingTransaction[]> {
  const serviceBase = getSafeTxServiceBaseUrl(parsedSafe.chainPrefix)
  const endpoint = `${serviceBase}/api/v1/safes/${parsedSafe.safeAddress}/multisig-transactions/?executed=false`

  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error(`Safe API request failed (${response.status})`)
  }

  const json = (await response.json()) as SafePendingResponse
  const results = json.results ?? []

  return results
    .filter((tx) => tx.safeTxHash && tx.to)
    .map((tx) => ({
      safeTxHash: String(tx.safeTxHash),
      nonce: Number(tx.nonce ?? 0),
      to: ethers.getAddress(String(tx.to)),
      data: tx.data ?? null,
      dataDecoded: tx.dataDecoded,
      submissionDate: String(tx.submissionDate ?? ''),
      isExecuted: Boolean(tx.isExecuted)
    }))
}
