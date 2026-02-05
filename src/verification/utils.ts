import { ethers } from 'ethers'

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

export function getChainAlias(chainId: string): string {
  const map: Record<string, string> = {
    '1': 'mainnet',
    '5': 'goerli',
    '11155111': 'sepolia',
    '10': 'optimism',
    '420': 'optimism_goerli',
    '42161': 'arbitrum_one',
    '421613': 'arbitrum_one_goerli',
    '42170': 'arbitrum_nova',
    '137': 'polygon',
    '80001': 'polygon_mumbai',
    '43114': 'avalanche',
    '43113': 'avalanche_fuji',
    '56': 'bnb_smart_chain',
    '97': 'bnb_smart_chain_testnet',
    '100': 'gnosis_chain',
    '31337': 'anvil',
    '146': 'sonic',
    '57073': 'ink',
    '653': 'sonic_testnet'
  }
  return map[chainId] || `chain_${chainId}`
}

export function parseNumericInputToBigInt(input: string): bigint | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^([+]?\d*\.?\d+)(?:e([+-]?\d+))?$/i)
  if (!match) return null

  const mantissa = match[1]
  const exponent = match[2] ? parseInt(match[2], 10) : 0
  if (!Number.isFinite(exponent)) return null

  const [intPart, fracPart = ''] = mantissa.split('.')
  const digits = `${intPart}${fracPart}`.replace(/^0+/, '') || '0'
  const decimals = fracPart.length
  const shift = exponent - decimals

  if (shift < 0) return null

  const zeros = shift === 0 ? '' : '0'.repeat(shift)
  return BigInt(`${digits}${zeros}`)
}

function digitsSuffix(value: bigint): string {
  const length = value.toString().length
  if (length < 6) return ''
  return ` [${length} digits]`
}

export function formatNumberInE(value: bigint): string {
  if (value < 1000n) return value.toString()

  let out = value
  let e = 0n
  while (out !== 0n) {
    if (out % 10n !== 0n) break
    e += 1n
    out /= 10n
  }

  if (e < 3n || value < 1000000n) {
    return `${value.toString()}${digitsSuffix(value)}`
  }

  return `${out.toString()}e${e.toString()}${digitsSuffix(value)}`
}

export function formatPriceInE18(value: bigint): string {
  if (value < 10000n) return `${value.toString()}${digitsSuffix(value)}`
  if (value < 10000000n) return formatNumberInE(value)

  const base = 10n ** 18n
  const integerPart = value / base
  let fractionalPart = value % base

  let fractionalStr = fractionalPart.toString()
  const leadingZeros = 18 - fractionalStr.length

  while (fractionalPart !== 0n && fractionalPart % 10n === 0n) {
    fractionalPart /= 10n
  }

  fractionalStr = fractionalPart.toString()
  if (leadingZeros > 0) {
    fractionalStr = `${'0'.repeat(leadingZeros)}${fractionalStr}`
  }

  if (integerPart === 0n) return `0.${fractionalStr}e18`
  if (fractionalPart === 0n) return `${integerPart.toString()}e18`
  return `${integerPart.toString()}.${fractionalStr}e18`
}

export function toAddress(value: string): string {
  if (!value) return ethers.ZeroAddress
  try {
    return ethers.getAddress(value)
  } catch {
    return ethers.ZeroAddress
  }
}

export function isZeroAddress(value: string): boolean {
  return !value || value.toLowerCase() === ethers.ZeroAddress.toLowerCase()
}

export function secondsPerYear(): bigint {
  return BigInt(SECONDS_PER_YEAR)
}
