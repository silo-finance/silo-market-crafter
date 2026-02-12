'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, WIZARD_CACHE_KEYS } from '@/contexts/WizardContext'
import { normalizeAddress } from '@/utils/addressValidation'
import { getAddressesJsonUrl } from '@/utils/symbolToAddress'
import { getNetworkDisplayName } from '@/utils/networks'
import TokenAddressInput from '@/components/TokenAddressInput'

interface TokenMetadata {
  symbol: string
  decimals: number
  name: string
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
        
        const networkName = getNetworkDisplayName(networkId)
        
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



  // Note: TokenAddressInput handles validation internally

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
      
      const networkName = getNetworkDisplayName(networkId)
      
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
            <TokenAddressInput
              value={token0Address}
              onChange={(value) => {
                setToken0Address(value)
                saveToCache(CACHE_KEYS.TOKEN0_ADDRESS, value)
              }}
              onResolve={(address, metadata) => {
                setToken0ResolvedAddress(address || null)
                setToken0Metadata(metadata)
                if (metadata) {
                  setToken0Error('')
                  saveMetadataToCache(CACHE_KEYS.TOKEN0_METADATA, metadata)
                }
              }}
              onError={(error) => {
                setToken0Error(error)
              }}
              chainId={wizardData.networkInfo?.chainId}
              label="Token 0 – address or symbol"
              placeholder="0x... or e.g. WETH, USDC"
              required
              initialMetadata={token0Metadata}
              initialResolvedAddress={token0ResolvedAddress}
            />

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

            <TokenAddressInput
              value={token1Address}
              onChange={(value) => {
                setToken1Address(value)
                saveToCache(CACHE_KEYS.TOKEN1_ADDRESS, value)
              }}
              onResolve={(address, metadata) => {
                setToken1ResolvedAddress(address || null)
                setToken1Metadata(metadata)
                if (metadata) {
                  setToken1Error('')
                  saveMetadataToCache(CACHE_KEYS.TOKEN1_METADATA, metadata)
                }
              }}
              onError={(error) => {
                setToken1Error(error)
              }}
              chainId={wizardData.networkInfo?.chainId}
              label="Token 1 – address or symbol"
              placeholder="0x... or e.g. WETH, USDC"
              required
              initialMetadata={token1Metadata}
              initialResolvedAddress={token1ResolvedAddress}
            />
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
