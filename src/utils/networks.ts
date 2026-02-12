/**
 * Centralized network configuration
 * All network-related data (IDs, names, explorer URLs, etc.) should be defined here
 * to avoid duplication across the codebase.
 */

export interface NetworkConfig {
  chainId: number
  displayName: string
  chainName: string // For GitHub repo paths (e.g., "mainnet", "arbitrum_one")
  explorerBaseUrl: string // Base URL for block explorer (without /address/ or /tx/)
  nativeTokenSymbol: string
}

/**
 * Central network configuration
 * Add new networks here - all other functions will automatically use this data
 */
export const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    chainId: 1,
    displayName: 'Ethereum Mainnet',
    chainName: 'mainnet',
    explorerBaseUrl: 'https://etherscan.io',
    nativeTokenSymbol: 'ETH',
  },
  {
    chainId: 10,
    displayName: 'Optimism',
    chainName: 'optimism',
    explorerBaseUrl: 'https://optimistic.etherscan.io',
    nativeTokenSymbol: 'ETH',
  },
  {
    chainId: 42161,
    displayName: 'Arbitrum One',
    chainName: 'arbitrum_one',
    explorerBaseUrl: 'https://arbiscan.io',
    nativeTokenSymbol: 'ETH',
  },
  {
    chainId: 43114,
    displayName: 'Avalanche C-Chain',
    chainName: 'avalanche',
    explorerBaseUrl: 'https://snowtrace.io',
    nativeTokenSymbol: 'AVAX',
  },
  {
    chainId: 146,
    displayName: 'Sonic',
    chainName: 'sonic',
    explorerBaseUrl: 'https://sonicscan.org',
    nativeTokenSymbol: 'S',
  },
  {
    chainId: 1776,
    displayName: 'Injective',
    chainName: 'injective',
    explorerBaseUrl: 'https://blockscout.injective.network',
    nativeTokenSymbol: 'INJ',
  },
]

/**
 * Map chain ID to network config for fast lookup
 */
const NETWORK_CONFIG_MAP: Map<number, NetworkConfig> = new Map(
  NETWORK_CONFIGS.map(config => [config.chainId, config])
)

/**
 * Get network config by chain ID
 */
export function getNetworkConfig(chainId: number | string): NetworkConfig | undefined {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return NETWORK_CONFIG_MAP.get(id)
}

/**
 * Get display name for a chain ID
 * Returns display name or fallback string if chain not found
 */
export function getNetworkDisplayName(chainId: number | string): string {
  const config = getNetworkConfig(chainId)
  if (config) return config.displayName
  
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return `Network ${id}`
}

/**
 * Get chain name for GitHub repo paths (e.g., "mainnet", "arbitrum_one")
 * Returns chain name or fallback string if chain not found
 */
export function getChainName(chainId: number | string): string {
  const config = getNetworkConfig(chainId)
  if (config) return config.chainName
  
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return `chain_${id}`
}

/**
 * Get block explorer base URL for a chain ID
 * Returns explorer URL or default (Ethereum) if chain not found
 */
export function getExplorerBaseUrl(chainId: number | string): string {
  const config = getNetworkConfig(chainId)
  if (config) return config.explorerBaseUrl
  return 'https://etherscan.io' // Default to Ethereum
}

/**
 * Get full explorer URL for an address
 */
export function getExplorerAddressUrl(chainId: number | string, address: string): string {
  const baseUrl = getExplorerBaseUrl(chainId)
  return `${baseUrl}/address/${address}`
}

/**
 * Get full explorer URL for a transaction
 */
export function getExplorerTxUrl(chainId: number | string, txHash: string): string {
  const baseUrl = getExplorerBaseUrl(chainId)
  return `${baseUrl}/tx/${txHash}`
}

/**
 * Get native token symbol for a chain ID
 * Returns token symbol or "ETH" as default
 */
export function getNativeTokenSymbol(chainId: number | string): string {
  const config = getNetworkConfig(chainId)
  if (config) return config.nativeTokenSymbol
  return 'ETH' // Default
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return NETWORK_CONFIGS.map(config => config.chainId)
}

/**
 * Check if a chain ID is supported
 */
export function isChainSupported(chainId: number | string): boolean {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return NETWORK_CONFIG_MAP.has(id)
}

/**
 * Get network config map for chain ID to display name (for backward compatibility)
 */
export function getNetworkDisplayNameMap(): Record<number, string> {
  const map: Record<number, string> = {}
  NETWORK_CONFIGS.forEach(config => {
    map[config.chainId] = config.displayName
  })
  return map
}

/**
 * Get network config map for chain ID to chain name (for backward compatibility)
 */
export function getChainNameMap(): Record<string, string> {
  const map: Record<string, string> = {}
  NETWORK_CONFIGS.forEach(config => {
    map[config.chainId.toString()] = config.chainName
  })
  return map
}

/**
 * Get explorer URL map (for backward compatibility)
 */
export function getExplorerUrlMap(): Record<number, string> {
  const map: Record<number, string> = {}
  NETWORK_CONFIGS.forEach(config => {
    map[config.chainId] = config.explorerBaseUrl
  })
  return map
}
