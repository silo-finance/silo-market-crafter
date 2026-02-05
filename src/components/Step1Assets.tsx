'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard, WIZARD_CACHE_KEYS } from '@/contexts/WizardContext'
import { normalizeAddress, isHexAddress } from '@/utils/addressValidation'
import { resolveSymbolToAddress, getAddressesJsonUrl } from '@/utils/symbolToAddress'
import CopyButton from '@/components/CopyButton'
import erc20Artifact from '@/abis/IERC20.json'

function getExplorerAddressUrl(chainId: string, address: string): string {
  const id = parseInt(chainId, 10)
  const explorerMap: { [key: number]: string } = {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    42161: 'https://arbiscan.io',
    43114: 'https://snowtrace.io',
    8453: 'https://basescan.org',
    146: 'https://sonicscan.org',
    653: 'https://sonicscan.org'
  }
  const base = explorerMap[id] || 'https://etherscan.io'
  return `${base}/address/${address}`
}

/** Foundry artifact: ABI under "abi" key – use as-is, never modify */
const erc20Abi = (erc20Artifact as { abi: ethers.InterfaceAbi }).abi

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
  const router = useRouter()
  const { wizardData, updateToken0, updateToken1, updateNetworkInfo, markStepCompleted } = useWizard()
  
  const CACHE_KEYS = {
    TOKEN0_ADDRESS: WIZARD_CACHE_KEYS[0],
    TOKEN1_ADDRESS: WIZARD_CACHE_KEYS[1],
    TOKEN0_METADATA: WIZARD_CACHE_KEYS[2],
    TOKEN1_METADATA: WIZARD_CACHE_KEYS[3]
  }

  // Initialize state with empty values to avoid hydration mismatch
  const [token0Address, setToken0Address] = useState('')
  const [token1Address, setToken1Address] = useState('')
  /** Resolved address used for fetch/submit: from normalized hex input or from symbol lookup. */
  const [token0ResolvedAddress, setToken0ResolvedAddress] = useState<string | null>(null)
  const [token1ResolvedAddress, setToken1ResolvedAddress] = useState<string | null>(null)
  const [token0Metadata, setToken0Metadata] = useState<TokenMetadata | null>(null)
  const [token1Metadata, setToken1Metadata] = useState<TokenMetadata | null>(null)
  const [token0Loading, setToken0Loading] = useState(false)
  const [token1Loading, setToken1Loading] = useState(false)
  const [token0Error, setToken0Error] = useState('')
  const [token1Error, setToken1Error] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isClient, setIsClient] = useState(false)

  // Load cached values after component mounts (client-side only)
  useEffect(() => {
    setIsClient(true)
    
    // Load cached values from localStorage
    const cachedToken0Address = localStorage.getItem(CACHE_KEYS.TOKEN0_ADDRESS) || ''
    const cachedToken1Address = localStorage.getItem(CACHE_KEYS.TOKEN1_ADDRESS) || ''
    const cachedToken0Metadata = localStorage.getItem(CACHE_KEYS.TOKEN0_METADATA)
    const cachedToken1Metadata = localStorage.getItem(CACHE_KEYS.TOKEN1_METADATA)
    
    if (cachedToken0Address) {
      setToken0Address(cachedToken0Address)
      setToken0ResolvedAddress(null)
    }
    if (cachedToken1Address) {
      setToken1Address(cachedToken1Address)
      setToken1ResolvedAddress(null)
    }
    if (cachedToken0Metadata) {
      try {
        setToken0Metadata(JSON.parse(cachedToken0Metadata))
      } catch (err) {
        console.warn('Failed to parse cached token0 metadata:', err)
      }
    }
    if (cachedToken1Metadata) {
      try {
        setToken1Metadata(JSON.parse(cachedToken1Metadata))
      } catch (err) {
        console.warn('Failed to parse cached token1 metadata:', err)
      }
    }
  }, [CACHE_KEYS.TOKEN0_ADDRESS, CACHE_KEYS.TOKEN0_METADATA, CACHE_KEYS.TOKEN1_ADDRESS, CACHE_KEYS.TOKEN1_METADATA])

  // Cache utility functions (stable for hook deps)
  const saveToCache = useCallback((key: string, value: string) => {
    if (isClient) {
      localStorage.setItem(key, value)
    }
  }, [isClient])

  const saveMetadataToCache = useCallback((key: string, metadata: TokenMetadata | null) => {
    if (isClient) {
      if (metadata) {
        localStorage.setItem(key, JSON.stringify(metadata))
      } else {
        localStorage.removeItem(key)
      }
    }
  }, [isClient])


  const switchAddresses = () => {
    const tempAddress = token0Address
    setToken0Address(token1Address)
    setToken1Address(tempAddress)

    const tempResolved = token0ResolvedAddress
    setToken0ResolvedAddress(token1ResolvedAddress)
    setToken1ResolvedAddress(tempResolved)

    saveToCache(CACHE_KEYS.TOKEN0_ADDRESS, token1Address)
    saveToCache(CACHE_KEYS.TOKEN1_ADDRESS, tempAddress)

    const tempMetadata = token0Metadata
    setToken0Metadata(token1Metadata)
    setToken1Metadata(tempMetadata)

    saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, token1Metadata)
    saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, tempMetadata)

    const tempError = token0Error
    setToken0Error(token1Error)
    setToken1Error(tempError)

    const tempLoading = token0Loading
    setToken0Loading(token1Loading)
    setToken1Loading(tempLoading)
  }

  // Load existing data if available (from wizard context or cache)
  // When JSON was loaded with symbols (address empty), show symbol in input and resolve to address below
  useEffect(() => {
    if (wizardData.token0) {
      const hasAddress = Boolean(wizardData.token0.address?.trim())
      if (hasAddress) {
        setToken0Address(wizardData.token0.address)
        setToken0ResolvedAddress(wizardData.token0.address)
      } else {
        setToken0Address(wizardData.token0.symbol || '')
        setToken0ResolvedAddress(null)
      }
      setToken0Metadata({
        symbol: wizardData.token0.symbol,
        decimals: wizardData.token0.decimals,
        name: wizardData.token0.name
      })
    } else if (isClient) {
      // If no wizard data but we're on client, try to load from cache (or clear after reset)
      const cachedAddress = localStorage.getItem(CACHE_KEYS.TOKEN0_ADDRESS)
      const cachedMetadata = localStorage.getItem(CACHE_KEYS.TOKEN0_METADATA)
      if (cachedAddress) {
        setToken0Address(cachedAddress)
      } else {
        setToken0Address('')
        setToken0ResolvedAddress(null)
      }
      if (cachedMetadata) {
        try {
          setToken0Metadata(JSON.parse(cachedMetadata))
        } catch (err) {
          console.warn('Failed to parse cached token0 metadata:', err)
        }
      } else {
        setToken0Metadata(null)
      }
      setToken0Error('')
    } else {
      setToken0Address('')
      setToken0Metadata(null)
      setToken0ResolvedAddress(null)
      setToken0Error('')
    }
    
    if (wizardData.token1) {
      const hasAddress = Boolean(wizardData.token1.address?.trim())
      if (hasAddress) {
        setToken1Address(wizardData.token1.address)
        setToken1ResolvedAddress(wizardData.token1.address)
      } else {
        setToken1Address(wizardData.token1.symbol || '')
        setToken1ResolvedAddress(null)
      }
      setToken1Metadata({
        symbol: wizardData.token1.symbol,
        decimals: wizardData.token1.decimals,
        name: wizardData.token1.name
      })
    } else if (isClient) {
      // If no wizard data but we're on client, try to load from cache (or clear after reset)
      const cachedAddress = localStorage.getItem(CACHE_KEYS.TOKEN1_ADDRESS)
      const cachedMetadata = localStorage.getItem(CACHE_KEYS.TOKEN1_METADATA)
      if (cachedAddress) {
        setToken1Address(cachedAddress)
      } else {
        setToken1Address('')
        setToken1ResolvedAddress(null)
      }
      if (cachedMetadata) {
        try {
          setToken1Metadata(JSON.parse(cachedMetadata))
        } catch (err) {
          console.warn('Failed to parse cached token1 metadata:', err)
        }
      } else {
        setToken1Metadata(null)
      }
      setToken1Error('')
    } else {
      setToken1Address('')
      setToken1Metadata(null)
      setToken1ResolvedAddress(null)
      setToken1Error('')
    }
  }, [wizardData.token0, wizardData.token1, isClient, CACHE_KEYS.TOKEN0_ADDRESS, CACHE_KEYS.TOKEN0_METADATA, CACHE_KEYS.TOKEN1_ADDRESS, CACHE_KEYS.TOKEN1_METADATA])

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



  const fetchTokenMetadata = async (address: string): Promise<TokenMetadata> => {
    if (!window.ethereum) {
      throw new Error('MetaMask not available')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
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

  const validateAndFetchToken = useCallback(async (
    address: string,
    tokenType: 'token0' | 'token1',
    options?: { skipUpdateInput?: boolean }
  ) => {
    if (!address.trim()) {
      if (tokenType === 'token0') {
        setToken0Metadata(null)
        setToken0Error('')
        setToken0ResolvedAddress(null)
      } else {
        setToken1Metadata(null)
        setToken1Error('')
        setToken1ResolvedAddress(null)
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
        setToken0ResolvedAddress(null)
      } else {
        setToken1Metadata(null)
        setToken1Error('Invalid address format')
        setToken1Loading(false)
        setToken1ResolvedAddress(null)
      }
      return
    }

    // Update the input field with the normalized address only when user entered hex (not when resolved from symbol)
    if (!options?.skipUpdateInput && normalizedAddress !== address) {
      if (tokenType === 'token0') {
        setToken0Address(normalizedAddress)
      } else {
        setToken1Address(normalizedAddress)
      }
    }

    if (tokenType === 'token0') {
      setToken0ResolvedAddress(normalizedAddress)
    } else {
      setToken1ResolvedAddress(normalizedAddress)
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
        saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, metadata)
      } else {
        setToken1Metadata(metadata)
        setToken1Error('')
        saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, metadata)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata'
      if (tokenType === 'token0') {
        setToken0Metadata(null)
        setToken0Error(errorMessage)
        setToken0ResolvedAddress(null)
        saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, null)
      } else {
        setToken1Metadata(null)
        setToken1Error(errorMessage)
        setToken1ResolvedAddress(null)
        saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, null)
      }
    } finally {
      if (tokenType === 'token0') {
        setToken0Loading(false)
      } else {
        setToken1Loading(false)
      }
    }
  }, [CACHE_KEYS.TOKEN0_METADATA, CACHE_KEYS.TOKEN1_METADATA, saveMetadataToCache])

  /**
   * Process input: if hex address -> normalize and fetch metadata.
   * If not hex -> treat as symbol, lookup in addresses JSON (case-insensitive); if found use that address and fetch metadata; if not show "Please enter the token address manually."
   */
  const processTokenInput = useCallback(async (value: string, tokenType: 'token0' | 'token1') => {
    const setLoading = tokenType === 'token0' ? setToken0Loading : setToken1Loading
    const setError = tokenType === 'token0' ? setToken0Error : setToken1Error
    const setMetadata = tokenType === 'token0' ? setToken0Metadata : setToken1Metadata
    const setResolved = tokenType === 'token0' ? setToken0ResolvedAddress : setToken1ResolvedAddress
    const saveMetaKey = tokenType === 'token0' ? CACHE_KEYS.TOKEN0_METADATA : CACHE_KEYS.TOKEN1_METADATA

    if (!value.trim()) {
      setMetadata(null)
      setError('')
      setResolved(null)
      return
    }

    if (isHexAddress(value)) {
      await validateAndFetchToken(value, tokenType)
      return
    }

    // Symbol path: need chainId
    let chainId: string
    try {
      if (!window.ethereum) {
        setError('Connect your wallet to look up token by symbol.')
        setResolved(null)
        setMetadata(null)
        saveMetadataToCache(saveMetaKey, null)
        return
      }
      const hex = await window.ethereum.request({ method: 'eth_chainId' }) as string
      chainId = parseInt(hex, 16).toString()
    } catch {
      setError('Could not read network. Please enter the token address manually.')
      setResolved(null)
      setMetadata(null)
      saveMetadataToCache(saveMetaKey, null)
      return
    }

    setLoading(true)
    setError('')
    setResolved(null)
    setMetadata(null)

    const result = await resolveSymbolToAddress(chainId, value)
    if (!result) {
      setLoading(false)
      setError('Please enter the token address manually.')
      setResolved(null)
      saveMetadataToCache(saveMetaKey, null)
      return
    }

    const setAddress = tokenType === 'token0' ? setToken0Address : setToken1Address
    const cacheAddressKey = tokenType === 'token0' ? CACHE_KEYS.TOKEN0_ADDRESS : CACHE_KEYS.TOKEN1_ADDRESS
    setAddress(result.exactSymbol)
    saveToCache(cacheAddressKey, result.exactSymbol)

    setResolved(result.address)
    await validateAndFetchToken(result.address, tokenType, { skipUpdateInput: true })
    setLoading(false)
  }, [validateAndFetchToken, resolveSymbolToAddress, saveMetadataToCache, saveToCache, CACHE_KEYS.TOKEN0_METADATA, CACHE_KEYS.TOKEN1_METADATA, CACHE_KEYS.TOKEN0_ADDRESS, CACHE_KEYS.TOKEN1_ADDRESS])

  // Debounced: resolve (symbol or hex) and fetch metadata (stable refs so effect deps are valid)
  const debouncedValidateToken0 = useMemo(
    () => debounce((value: string) => processTokenInput(value, 'token0'), 500),
    [processTokenInput]
  )
  const debouncedValidateToken1 = useMemo(
    () => debounce((value: string) => processTokenInput(value, 'token1'), 500),
    [processTokenInput]
  )

  // When token input or network is set (e.g. from cache), run validation so symbol lookup runs
  useEffect(() => {
    if (isClient && token0Address) debouncedValidateToken0(token0Address)
  }, [isClient, token0Address, wizardData.networkInfo?.chainId, debouncedValidateToken0])

  useEffect(() => {
    if (isClient && token1Address) debouncedValidateToken1(token1Address)
  }, [isClient, token1Address, wizardData.networkInfo?.chainId, debouncedValidateToken1])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Use resolved address (from hex input or symbol lookup); fallback to normalizing raw input
      const normalizedToken0 = token0ResolvedAddress ?? normalizeAddress(token0Address)
      const normalizedToken1 = token1ResolvedAddress ?? normalizeAddress(token1Address)

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
      router.push('/wizard?step=2')

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
        <p className="text-gray-400 text-sm mt-2">
          All supported symbols can be viewed{' '}
          <a
            href={
              wizardData.networkInfo?.chainId
                ? getAddressesJsonUrl(wizardData.networkInfo.chainId)
                : 'https://github.com/silo-finance/silo-contracts-v2/tree/master/common/addresses'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {wizardData.networkInfo?.chainId
              ? `in this JSON file (${wizardData.networkInfo.networkName})`
              : 'in the repository (connect wallet for network-specific list)'}
          </a>
          .
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="token0" className="block text-sm font-medium text-gray-300 mb-2">
                Token 0 – address or symbol
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
                  placeholder="0x... or e.g. WETH, USDC"
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
              {token0ResolvedAddress && token0Address.trim() !== token0ResolvedAddress && (
                <div className="mt-2 text-sm text-gray-400 font-mono break-all flex flex-wrap items-center gap-2">
                  <span>Matched address:</span>
                  {wizardData.networkInfo?.chainId ? (
                    <a
                      href={getExplorerAddressUrl(wizardData.networkInfo.chainId, token0ResolvedAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {normalizeAddress(token0ResolvedAddress) ?? token0ResolvedAddress}
                    </a>
                  ) : (
                    <span>{normalizeAddress(token0ResolvedAddress) ?? token0ResolvedAddress}</span>
                  )}
                  <CopyButton value={normalizeAddress(token0ResolvedAddress) ?? token0ResolvedAddress} iconClassName="w-3.5 h-3.5" />
                </div>
              )}
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
                Token 1 – address or symbol
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
                  placeholder="0x... or e.g. WETH, USDC"
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
              {token1ResolvedAddress && token1Address.trim() !== token1ResolvedAddress && (
                <div className="mt-2 text-sm text-gray-400 font-mono break-all flex flex-wrap items-center gap-2">
                  <span>Matched address:</span>
                  {wizardData.networkInfo?.chainId ? (
                    <a
                      href={getExplorerAddressUrl(wizardData.networkInfo.chainId, token1ResolvedAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {normalizeAddress(token1ResolvedAddress) ?? token1ResolvedAddress}
                    </a>
                  ) : (
                    <span>{normalizeAddress(token1ResolvedAddress) ?? token1ResolvedAddress}</span>
                  )}
                  <CopyButton value={normalizeAddress(token1ResolvedAddress) ?? token1ResolvedAddress} iconClassName="w-3.5 h-3.5" />
                </div>
              )}
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
             onClick={() => router.push('/wizard')}
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
                <span>Oracle Types</span>
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
