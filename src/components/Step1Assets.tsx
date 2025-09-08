'use client'

import { useState, useCallback } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { ethers } from 'ethers'

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

interface TokenMetadata {
  symbol: string
  decimals: number
  name: string
}

export default function Step1Assets() {
  const { updateStep, updateToken0, updateToken1, markStepCompleted, updateNetworkInfo } = useWizard()
  const [token0Address, setToken0Address] = useState('')
  const [token1Address, setToken1Address] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [token0Metadata, setToken0Metadata] = useState<TokenMetadata | null>(null)
  const [token1Metadata, setToken1Metadata] = useState<TokenMetadata | null>(null)
  const [token0Loading, setToken0Loading] = useState(false)
  const [token1Loading, setToken1Loading] = useState(false)
  const [token0Error, setToken0Error] = useState('')
  const [token1Error, setToken1Error] = useState('')

  const isValidAddress = (address: string) => {
    // More lenient check - just check if it looks like an address
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const normalizeAddress = (address: string) => {
    try {
      return ethers.getAddress(address)
    } catch {
      return null
    }
  }

  const fetchTokenMetadata = async (address: string): Promise<TokenMetadata> => {
    if (!window.ethereum) {
      throw new Error('MetaMask not available')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    
    // ERC20 ABI for symbol, decimals, and name
    const erc20Abi = [
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function name() view returns (string)'
    ]

    const contract = new ethers.Contract(address, erc20Abi, provider)
    
    const [symbol, decimals, name] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.name()
    ])

    return { 
      symbol: symbol.toString(), 
      decimals: Number(decimals), 
      name: name.toString() 
    }
  }

  const validateAndFetchToken = async (address: string, tokenType: 'token0' | 'token1') => {
    if (!address.trim()) {
      if (tokenType === 'token0') {
        setToken0Metadata(null)
        setToken0Error('')
      } else {
        setToken1Metadata(null)
        setToken1Error('')
      }
      return
    }

    // Try to normalize the address (fix checksum)
    const normalizedAddress = normalizeAddress(address)
    if (!normalizedAddress) {
      if (tokenType === 'token0') {
        setToken0Metadata(null)
        setToken0Error('Invalid address format')
        setToken0Loading(false)
      } else {
        setToken1Metadata(null)
        setToken1Error('Invalid address format')
        setToken1Loading(false)
      }
      return
    }

    // Update the input field with the normalized address if it's different
    if (normalizedAddress !== address) {
      if (tokenType === 'token0') {
        setToken0Address(normalizedAddress)
      } else {
        setToken1Address(normalizedAddress)
      }
    }

    // Set loading state
    if (tokenType === 'token0') {
      setToken0Loading(true)
      setToken0Error('')
    } else {
      setToken1Loading(true)
      setToken1Error('')
    }

    try {
      const metadata = await fetchTokenMetadata(normalizedAddress)
      
      if (tokenType === 'token0') {
        setToken0Metadata(metadata)
        setToken0Error('')
      } else {
        setToken1Metadata(metadata)
        setToken1Error('')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata'
      if (tokenType === 'token0') {
        setToken0Metadata(null)
        setToken0Error(errorMessage)
      } else {
        setToken1Metadata(null)
        setToken1Error(errorMessage)
      }
    } finally {
      if (tokenType === 'token0') {
        setToken0Loading(false)
      } else {
        setToken1Loading(false)
      }
    }
  }

  // Debounced validation for token0
  const debouncedValidateToken0 = useCallback(
    debounce((address: string) => validateAndFetchToken(address, 'token0'), 500),
    []
  )

  // Debounced validation for token1
  const debouncedValidateToken1 = useCallback(
    debounce((address: string) => validateAndFetchToken(address, 'token1'), 500),
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate addresses
      if (!isValidAddress(token0Address)) {
        throw new Error('Invalid Token 0 address')
      }
      if (!isValidAddress(token1Address)) {
        throw new Error('Invalid Token 1 address')
      }
      if (token0Address.toLowerCase() === token1Address.toLowerCase()) {
        throw new Error('Token addresses must be different')
      }

      // Get network info
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      const networkId = parseInt(chainId, 16).toString()
      
      // Network name mapping (same as in Header component)
      const networkMap: { [key: number]: string } = {
        1: 'Ethereum Mainnet',
        3: 'Ropsten',
        4: 'Rinkeby',
        5: 'Goerli',
        42: 'Kovan',
        11155111: 'Sepolia',
        137: 'Polygon',
        80001: 'Polygon Mumbai',
        1101: 'Polygon zkEVM',
        1442: 'Polygon zkEVM Testnet',
        10: 'Optimism',
        420: 'Optimism Goerli',
        11155420: 'Optimism Sepolia',
        42161: 'Arbitrum One',
        421613: 'Arbitrum Goerli',
        421614: 'Arbitrum Sepolia',
        42170: 'Arbitrum Nova',
        56: 'BSC',
        97: 'BSC Testnet',
        43114: 'Avalanche C-Chain',
        43113: 'Avalanche Fuji',
        250: 'Fantom Opera',
        4002: 'Fantom Testnet',
        8453: 'Base',
        84532: 'Base Sepolia',
        84531: 'Base Goerli',
        59144: 'Linea',
        59140: 'Linea Goerli',
        59141: 'Linea Sepolia',
        534352: 'Scroll',
        534351: 'Scroll Sepolia',
        5000: 'Mantle',
        5001: 'Mantle Sepolia',
        42220: 'Celo',
        44787: 'Celo Alfajores',
        100: 'Gnosis',
        10200: 'Gnosis Chiado',
        1284: 'Moonbeam',
        1287: 'Moonbase Alpha',
        1666600000: 'Harmony One',
        1666700000: 'Harmony Testnet',
        25: 'Cronos',
        338: 'Cronos Testnet',
        8217: 'Klaytn',
        1001: 'Klaytn Baobab',
        1313161554: 'Aurora',
        1313161555: 'Aurora Testnet',
        1088: 'Metis Andromeda',
        599: 'Metis Goerli',
        288: 'Boba Network',
        28882: 'Boba Goerli',
        324: 'zkSync Era',
        300: 'zkSync Era Testnet',
        13371: 'Immutable X',
        146: 'Sonic',
        653: 'Sonic Testnet',
      }

      const networkName = networkMap[parseInt(networkId)] || `Unknown Network (${networkId})`
      updateNetworkInfo(networkName, networkId)

      // Fetch token metadata
      const [token0Meta, token1Meta] = await Promise.all([
        fetchTokenMetadata(token0Address),
        fetchTokenMetadata(token1Address)
      ])

      setToken0Metadata(token0Meta)
      setToken1Metadata(token1Meta)

      // Update wizard data
      updateToken0({
        address: token0Address,
        symbol: token0Meta.symbol,
        decimals: token0Meta.decimals,
        name: token0Meta.name
      })

      updateToken1({
        address: token1Address,
        symbol: token1Meta.symbol,
        decimals: token1Meta.decimals,
        name: token1Meta.name
      })

      // Mark step as completed
      markStepCompleted(1, `${token0Meta.symbol}/${token1Meta.symbol}`)

      // Move to next step
      updateStep(2)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Select Assets
        </h1>
        <p className="text-gray-300 text-lg">
          Choose the two tokens for your new market
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="token0" className="block text-sm font-medium text-gray-300 mb-2">
                Token 0 Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="token0"
                  value={token0Address}
                  onChange={(e) => {
                    const value = e.target.value
                    setToken0Address(value)
                    
                    // Clear any existing errors when user starts typing
                    if (token0Error) {
                      setToken0Error('')
                    }
                    
                    debouncedValidateToken0(value)
                  }}
                  placeholder="0x..."
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    token0Error ? 'border-red-500' : token0Metadata ? 'border-green-500' : 'border-gray-700'
                  }`}
                  required
                />
                {token0Loading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {token0Error && (
                <div className="mt-2 text-sm text-red-400">
                  ✗ {token0Error}
                </div>
              )}
              {token0Metadata && (
                <div className="mt-2 text-sm text-green-400">
                  ✓ {token0Metadata.name} ({token0Metadata.symbol}) - {token0Metadata.decimals} decimals
                </div>
              )}
            </div>

            <div>
              <label htmlFor="token1" className="block text-sm font-medium text-gray-300 mb-2">
                Token 1 Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="token1"
                  value={token1Address}
                  onChange={(e) => {
                    const value = e.target.value
                    setToken1Address(value)
                    
                    // Clear any existing errors when user starts typing
                    if (token1Error) {
                      setToken1Error('')
                    }
                    
                    debouncedValidateToken1(value)
                  }}
                  placeholder="0x..."
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    token1Error ? 'border-red-500' : token1Metadata ? 'border-green-500' : 'border-gray-700'
                  }`}
                  required
                />
                {token1Loading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {token1Error && (
                <div className="mt-2 text-sm text-red-400">
                  ✗ {token1Error}
                </div>
              )}
              {token1Metadata && (
                <div className="mt-2 text-sm text-green-400">
                  ✓ {token1Metadata.name} ({token1Metadata.symbol}) - {token1Metadata.decimals} decimals
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => updateStep(0)}
            className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 hover:text-white transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || !token0Metadata || !token1Metadata || token0Error || token1Error}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{loading ? 'Verifying...' : 'Continue'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
