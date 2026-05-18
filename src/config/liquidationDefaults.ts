import { ethers } from 'ethers'
import { getChainName } from '@/utils/networks'

export interface TrustedLiquidator {
  label: string
  address: string
  source: 'live' | 'static'
}

/**
 * Centralized settings for default liquidation whitelist entries.
 * Keep labels/addresses here so future edits do not require UI logic changes.
 */
export const STATIC_TRUSTED_LIQUIDATORS: TrustedLiquidator[] = [
  {
    label: 'Trusted Liquidation Address 1',
    address: '0x1fF60e85852Ac73cd05B69A8B6641fc24A3FC011',
    source: 'static'
  },
  {
    label: 'Trusted Liquidation Address 2',
    address: '0xC04f84A02cC65f14f4e8C982a7a467EE88c5311e',
    source: 'static'
  },
  {
    label: 'Liquidation Bot Wallet',
    address: '0xd3EC1026c9F911e201De4d52A667dC10bc3754d7',
    source: 'static'
  }
]

const LIVE_DEPLOYMENTS_BASE_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v3/master/silo-core/deployments'

const MANUAL_LIQUIDATION_FILE = 'ManualLiquidationHelper.sol.json'
const LIQUIDATION_HELPER_CANDIDATE_FILES = [
  'LiquidationHelper.sol.json',
  'LiquidationHelper_ENSO.json',
  'LiquidationHelper_ODOS.json',
  'LiquidationHelper_1INCH.json',
  'LiquidationHelper_LI_FI.json'
]

async function fetchDeploymentAddress(url: string): Promise<string | null> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return null
  const data = await response.json()
  const address = typeof data?.address === 'string' ? data.address : ''
  if (!ethers.isAddress(address)) return null
  return ethers.getAddress(address)
}

/**
 * Always fetches live defaults from silo-contracts-v3 deployment files.
 * This intentionally does not cache results across calls.
 */
export async function fetchLiveTrustedLiquidators(chainId: string): Promise<TrustedLiquidator[]> {
  const chainName = getChainName(chainId)
  const baseUrl = `${LIVE_DEPLOYMENTS_BASE_URL}/${chainName}`

  const results: TrustedLiquidator[] = []

  const manualAddress = await fetchDeploymentAddress(`${baseUrl}/${MANUAL_LIQUIDATION_FILE}`)
  if (manualAddress) {
    results.push({
      label: 'Manual Liquidation',
      address: manualAddress,
      source: 'live'
    })
  }

  for (const filename of LIQUIDATION_HELPER_CANDIDATE_FILES) {
    const helperAddress = await fetchDeploymentAddress(`${baseUrl}/${filename}`)
    if (!helperAddress) continue
    results.push({
      label: 'Liquidation Helper',
      address: helperAddress,
      source: 'live'
    })
    break
  }

  return results
}

export function getStaticTrustedLiquidators(): TrustedLiquidator[] {
  return STATIC_TRUSTED_LIQUIDATORS.map(item => ({
    ...item,
    address: ethers.getAddress(item.address)
  }))
}
