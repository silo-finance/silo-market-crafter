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
  nativeTokenName?: string // For wallet_addEthereumChain metadata
  rpcUrls?: string[] // Optional RPCs used for wallet_addEthereumChain
  iconPath: string
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
    iconPath: '/network-icons/ethereum.svg',
  },
  {
    chainId: 10,
    displayName: 'Optimism',
    chainName: 'optimism',
    explorerBaseUrl: 'https://optimistic.etherscan.io',
    nativeTokenSymbol: 'ETH',
    iconPath: '/network-icons/optimism.svg',
  },
  {
    chainId: 50,
    displayName: 'XDC Network',
    chainName: 'xdc',
    explorerBaseUrl: 'https://xdcscan.com',
    nativeTokenSymbol: 'XDC',
    iconPath: '/network-icons/xdc.svg',
  },
  {
    chainId: 56,
    displayName: 'BNB Chain',
    chainName: 'bnb',
    explorerBaseUrl: 'https://bscscan.com',
    nativeTokenSymbol: 'BNB',
    iconPath: '/network-icons/bnb.svg',
  },
  {
    chainId: 42161,
    displayName: 'Arbitrum One',
    chainName: 'arbitrum_one',
    explorerBaseUrl: 'https://arbiscan.io',
    nativeTokenSymbol: 'ETH',
    iconPath: '/network-icons/arbitrum.svg',
  },
  {
    chainId: 43114,
    displayName: 'Avalanche C-Chain',
    chainName: 'avalanche',
    explorerBaseUrl: 'https://snowtrace.io',
    nativeTokenSymbol: 'AVAX',
    iconPath: '/network-icons/avalanche.svg',
  },
  {
    chainId: 146,
    displayName: 'Sonic',
    chainName: 'sonic',
    explorerBaseUrl: 'https://sonicscan.org',
    nativeTokenSymbol: 'S',
    iconPath: '/network-icons/sonic.webp',
  },
  {
    chainId: 196,
    displayName: 'OKX',
    chainName: 'okx',
    explorerBaseUrl: 'https://www.okx.com/web3/explorer/xlayer',
    nativeTokenSymbol: 'OKB',
    iconPath: '/network-icons/okx.png',
  },
  {
    chainId: 1776,
    displayName: 'Injective',
    chainName: 'injective',
    explorerBaseUrl: 'https://blockscout.injective.network',
    nativeTokenSymbol: 'INJ',
    iconPath: '/network-icons/injective.svg',
  },
  {
    chainId: 4326,
    displayName: 'MegaETH',
    chainName: 'megaeth',
    explorerBaseUrl: 'https://mega.etherscan.io',
    nativeTokenSymbol: 'ETH',
    nativeTokenName: 'Ether',
    rpcUrls: ['https://mainnet.megaeth.com/rpc'],
    iconPath: '/network-icons/megaeth.ico',
  },
  {
    chainId: 5000,
    displayName: 'Mantle',
    chainName: 'mantle',
    explorerBaseUrl: 'https://mantlescan.xyz',
    nativeTokenSymbol: 'MNT',
    nativeTokenName: 'Mantle',
    rpcUrls: ['https://rpc.mantle.xyz'],
    iconPath: '/network-icons/mantle.ico',
  },
]

/**
 * Map chain ID to network config for fast lookup
 */
const NETWORK_CONFIG_MAP: Map<number, NetworkConfig> = new Map(
  NETWORK_CONFIGS.map(config => [config.chainId, config])
)
const NETWORK_CONFIG_BY_CHAIN_NAME: Map<string, NetworkConfig> = new Map(
  NETWORK_CONFIGS.map(config => [config.chainName.toLowerCase(), config])
)

/**
 * Get network config by chain ID
 */
export function getNetworkConfig(chainId: number | string): NetworkConfig | undefined {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return NETWORK_CONFIG_MAP.get(id)
}

/**
 * Get network config by chain name used in repository paths (e.g. "mainnet", "arbitrum_one").
 */
export function getNetworkConfigByChainName(chainName: string): NetworkConfig | undefined {
  const normalized = chainName?.trim().toLowerCase()
  if (!normalized) return undefined
  return NETWORK_CONFIG_BY_CHAIN_NAME.get(normalized)
}

/**
 * Get chain ID by chain name used in repository paths (e.g. "mainnet", "arbitrum_one").
 */
export function getChainIdByChainName(chainName: string): number | null {
  return getNetworkConfigByChainName(chainName)?.chainId ?? null
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

export function getNetworkIconPath(chainId: number | string): string | null {
  const config = getNetworkConfig(chainId)
  return config?.iconPath ?? null
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

export interface WalletAddEthereumChainParams {
  chainId: `0x${string}`
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

/**
 * Build EIP-3085 params for wallet_addEthereumChain.
 * Returns null when required metadata (RPC URL) is unavailable.
 */
export function getWalletAddEthereumChainParams(
  chainId: number | string
): WalletAddEthereumChainParams | null {
  const config = getNetworkConfig(chainId)
  if (!config?.rpcUrls?.length) return null

  return {
    chainId: `0x${config.chainId.toString(16)}`,
    chainName: config.displayName,
    nativeCurrency: {
      name: config.nativeTokenName ?? config.nativeTokenSymbol,
      symbol: config.nativeTokenSymbol,
      decimals: 18,
    },
    rpcUrls: config.rpcUrls,
    blockExplorerUrls: [config.explorerBaseUrl],
  }
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
