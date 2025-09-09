'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'

interface TokenMetadata {
  symbol: string
  decimals: number
  name: string
}

// Debounce utility function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export default function Step1Assets() {
  const { wizardData, updateToken0, updateToken1, updateNetworkInfo, markStepCompleted, updateStep } = useWizard()
  
  // Cache keys for localStorage
  const CACHE_KEYS = {
    TOKEN0_ADDRESS: 'silo-wizard-token0-address',
    TOKEN1_ADDRESS: 'silo-wizard-token1-address',
    TOKEN0_METADATA: 'silo-wizard-token0-metadata',
    TOKEN1_METADATA: 'silo-wizard-token1-metadata'
  }

  // Initialize state with cached values
  const [token0Address, setToken0Address] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CACHE_KEYS.TOKEN0_ADDRESS) || ''
    }
    return ''
  })
  const [token1Address, setToken1Address] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CACHE_KEYS.TOKEN1_ADDRESS) || ''
    }
    return ''
  })
  const [token0Metadata, setToken0Metadata] = useState<TokenMetadata | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEYS.TOKEN0_METADATA)
      return cached ? JSON.parse(cached) : null
    }
    return null
  })
  const [token1Metadata, setToken1Metadata] = useState<TokenMetadata | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEYS.TOKEN1_METADATA)
      return cached ? JSON.parse(cached) : null
    }
    return null
  })
  const [token0Loading, setToken0Loading] = useState(false)
  const [token1Loading, setToken1Loading] = useState(false)
  const [token0Error, setToken0Error] = useState('')
  const [token1Error, setToken1Error] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Cache utility functions
  const saveToCache = (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
    }
  }

  const saveMetadataToCache = (key: string, metadata: TokenMetadata | null) => {
    if (typeof window !== 'undefined') {
      if (metadata) {
        localStorage.setItem(key, JSON.stringify(metadata))
      } else {
        localStorage.removeItem(key)
      }
    }
  }


  const switchAddresses = () => {
    // Swap addresses
    const tempAddress = token0Address
    setToken0Address(token1Address)
    setToken1Address(tempAddress)

    // Save swapped addresses to cache
    saveToCache(CACHE_KEYS.TOKEN0_ADDRESS, token1Address)
    saveToCache(CACHE_KEYS.TOKEN1_ADDRESS, tempAddress)

    // Swap metadata
    const tempMetadata = token0Metadata
    setToken0Metadata(token1Metadata)
    setToken1Metadata(tempMetadata)

    // Save swapped metadata to cache
    saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, token1Metadata)
    saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, tempMetadata)

    // Swap errors
    const tempError = token0Error
    setToken0Error(token1Error)
    setToken1Error(tempError)

    // Swap loading states
    const tempLoading = token0Loading
    setToken0Loading(token1Loading)
    setToken1Loading(tempLoading)
  }

  // Load existing data if available
  useEffect(() => {
    if (wizardData.token0) {
      setToken0Address(wizardData.token0.address)
      setToken0Metadata({
        symbol: wizardData.token0.symbol,
        decimals: wizardData.token0.decimals,
        name: wizardData.token0.name
      })
    }
    if (wizardData.token1) {
      setToken1Address(wizardData.token1.address)
      setToken1Metadata({
        symbol: wizardData.token1.symbol,
        decimals: wizardData.token1.decimals,
        name: wizardData.token1.name
      })
    }
  }, [wizardData.token0, wizardData.token1])

  // Get network info on component mount
  useEffect(() => {
    const getNetworkInfo = async () => {
      if (!window.ethereum) return

      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
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
          4202: 'Optimism Sepolia',
          8453: 'Base',
          84531: 'Base Goerli',
          84532: 'Base Sepolia',
          42161: 'Arbitrum One',
          421613: 'Arbitrum Goerli',
          421614: 'Arbitrum Sepolia',
          56: 'BNB Smart Chain',
          97: 'BNB Smart Chain Testnet',
          250: 'Fantom Opera',
          4002: 'Fantom Testnet',
          43114: 'Avalanche C-Chain',
          43113: 'Avalanche Fuji',
          25: 'Cronos',
          338: 'Cronos Testnet',
          100: 'Gnosis',
          10200: 'Gnosis Chiado',
          1284: 'Moonbeam',
          1287: 'Moonbase Alpha',
          1285: 'Moonriver',
          592: 'Astar',
          81: 'Astar Shibuya',
          336: 'Astar Shiden',
          1281: 'Moonbeam Moonbase',
          1288: 'Moonbeam Moonriver',
          146: 'Sonic',
          653: 'Sonic Testnet'
        }
        
        const networkName = networkMap[parseInt(networkId)] || `Network ${networkId}`
        
        updateNetworkInfo({
          chainId: networkId,
          networkName
        })
      } catch (err) {
        console.error('Failed to get network info:', err)
      }
    }

    getNetworkInfo()
  }, [updateNetworkInfo])


  const normalizeAddress = (address: string) => {
    try {
      // First try to get the address as-is
      return ethers.getAddress(address)
    } catch {
      try {
        // If that fails, try with lowercase (which should always work for valid hex)
        const lowerAddress = address.toLowerCase()
        if (/^0x[a-f0-9]{40}$/.test(lowerAddress)) {
          return ethers.getAddress(lowerAddress)
        }
        return null
      } catch {
        return null
      }
    }
  }

  const fetchTokenMetadata = async (address: string): Promise<TokenMetadata> => {
    if (!window.ethereum) {
      throw new Error('MetaMask not available')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    
    // Minimal ERC20 ABI for symbol, decimals, and name
    const erc20Abi = [
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function name() view returns (string)'
    ]
    
    const contract = new ethers.Contract(address, erc20Abi, provider)
    
    try {
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
    } catch (err) {
      throw new Error('Failed to fetch token metadata')
    }
  }

  const validateAndFetchToken = useCallback(async (address: string, tokenType: 'token0' | 'token1') => {
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
        // Save metadata to cache
        saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, metadata)
      } else {
        setToken1Metadata(metadata)
        setToken1Error('')
        // Save metadata to cache
        saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, metadata)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata'
      if (tokenType === 'token0') {
        setToken0Metadata(null)
        setToken0Error(errorMessage)
        // Clear metadata from cache on error
        saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, null)
      } else {
        setToken1Metadata(null)
        setToken1Error(errorMessage)
        // Clear metadata from cache on error
        saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, null)
      }
    } finally {
      if (tokenType === 'token0') {
        setToken0Loading(false)
      } else {
        setToken1Loading(false)
      }
    }
  }, [])

  // Debounced validation for token0
  const debouncedValidateToken0 = debounce((address: string) => {
    validateAndFetchToken(address, 'token0')
  }, 500)

  // Debounced validation for token1
  const debouncedValidateToken1 = debounce((address: string) => {
    validateAndFetchToken(address, 'token1')
  }, 500)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Normalize addresses first
      const normalizedToken0 = normalizeAddress(token0Address)
      const normalizedToken1 = normalizeAddress(token1Address)
      
      // Validate addresses
      if (!normalizedToken0) {
        throw new Error('Invalid Token 0 address')
      }
      if (!normalizedToken1) {
        throw new Error('Invalid Token 1 address')
      }
      if (normalizedToken0.toLowerCase() === normalizedToken1.toLowerCase()) {
        throw new Error('Token addresses must be different')
      }

      // Ensure we have metadata for both tokens
      if (!token0Metadata || !token1Metadata) {
        throw new Error('Please wait for token metadata to load')
      }

      // Get network info
      const chainId = await window.ethereum!.request({ method: 'eth_chainId' }) as string
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
        4202: 'Optimism Sepolia',
        8453: 'Base',
        84531: 'Base Goerli',
        84532: 'Base Sepolia',
        42161: 'Arbitrum One',
        421613: 'Arbitrum Goerli',
        421614: 'Arbitrum Sepolia',
        56: 'BNB Smart Chain',
        97: 'BNB Smart Chain Testnet',
        250: 'Fantom Opera',
        4002: 'Fantom Testnet',
        43114: 'Avalanche C-Chain',
        43113: 'Avalanche Fuji',
        25: 'Cronos',
        338: 'Cronos Testnet',
        100: 'Gnosis',
        10200: 'Gnosis Chiado',
        1284: 'Moonbeam',
        1287: 'Moonbase Alpha',
        1285: 'Moonriver',
        592: 'Astar',
        81: 'Astar Shibuya',
        336: 'Astar Shiden',
        1281: 'Moonbeam Moonbase',
        1288: 'Moonbeam Moonriver',
        146: 'Sonic',
        653: 'Sonic Testnet'
      }
      
      const networkName = networkMap[parseInt(networkId)] || `Network ${networkId}`
      
      // Update network info
      updateNetworkInfo({
        chainId: networkId,
        networkName
      })

      // Update wizard data with normalized addresses
      updateToken0({
        address: normalizedToken0,
        symbol: token0Metadata.symbol,
        decimals: token0Metadata.decimals,
        name: token0Metadata.name
      })

      updateToken1({
        address: normalizedToken1,
        symbol: token1Metadata.symbol,
        decimals: token1Metadata.decimals,
        name: token1Metadata.name
      })

      // Mark step as completed
      markStepCompleted(1)

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
                    
                    // Save to cache
                    saveToCache(CACHE_KEYS.TOKEN0_ADDRESS, value)
                    
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

            {/* Switch Button */}
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={switchAddresses}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white p-3 rounded-full transition-all duration-200 flex items-center justify-center group"
                title="Switch Token 0 and Token 1"
              >
                <svg className="w-6 h-6 transform group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
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
                    
                    // Save to cache
                    saveToCache(CACHE_KEYS.TOKEN1_ADDRESS, value)
                    
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
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <div className="text-red-400 text-sm">
              ✗ {error}
            </div>
          </div>
        )}

         <div className="flex justify-between">
           <button
             type="button"
             onClick={() => window.history.back()}
             className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
             </svg>
             <span>Back to Landing</span>
           </button>
          <button
            type="submit"
            disabled={loading || !token0Metadata || !token1Metadata || !!token0Error || !!token1Error}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Continue to Step 2</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
