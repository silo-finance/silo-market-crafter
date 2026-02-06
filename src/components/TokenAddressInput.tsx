'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ethers } from 'ethers'
import { normalizeAddress, isHexAddress } from '@/utils/addressValidation'
import { resolveSymbolToAddress } from '@/utils/symbolToAddress'
import CopyButton from '@/components/CopyButton'
import erc20Artifact from '@/abis/IERC20.json'

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

function getExplorerAddressUrl(chainId: string, address: string): string {
  const id = parseInt(chainId, 10)
  const explorerMap: { [key: number]: string } = {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    18: 'https://optimistic.etherscan.io',
    420: 'https://goerli-optimism.etherscan.io',
    4202: 'https://sepolia-optimism.etherscan.io',
    42161: 'https://arbiscan.io',
    421613: 'https://goerli.arbiscan.io',
    421614: 'https://sepolia.arbiscan.io',
    43114: 'https://snowtrace.io',
    43113: 'https://testnet.snowtrace.io',
    8453: 'https://basescan.org',
    84531: 'https://goerli.basescan.org',
    84532: 'https://sepolia.basescan.org',
    146: 'https://sonicscan.org',
    653: 'https://sonicscan.org'
  }
  const base = explorerMap[id] || 'https://etherscan.io'
  return `${base}/address/${address}`
}

export interface TokenAddressInputProps {
  /** Current input value */
  value: string
  /** Callback when input value changes */
  onChange: (value: string) => void
  /** Callback when token is resolved (address and metadata) */
  onResolve?: (address: string, metadata: TokenMetadata | null) => void
  /** Callback when error occurs */
  onError?: (error: string) => void
  /** Chain ID for symbol resolution */
  chainId?: string
  /** Label for the input field */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Whether the field is required */
  required?: boolean
  /** Custom className for the input */
  className?: string
  /** Debounce delay in milliseconds */
  debounceMs?: number
  /** Whether to show the matched address section */
  showMatchedAddress?: boolean
  /** Initial metadata to display (for when component loads with existing data) */
  initialMetadata?: TokenMetadata | null
  /** Initial resolved address (for when component loads with existing data) */
  initialResolvedAddress?: string | null
}

export default function TokenAddressInput({
  value,
  onChange,
  onResolve,
  onError,
  chainId,
  label,
  placeholder = '0x... or e.g. WETH, USDC',
  required = false,
  className = '',
  debounceMs = 500,
  showMatchedAddress = true,
  initialMetadata,
  initialResolvedAddress
}: TokenAddressInputProps) {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(initialResolvedAddress || null)
  const [metadata, setMetadata] = useState<TokenMetadata | null>(initialMetadata || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Initialize with existing metadata/resolved address if provided
  useEffect(() => {
    if (initialMetadata) {
      setMetadata(initialMetadata)
      // Mark this value as validated so we don't re-validate
      if (value) {
        lastValidatedValueRef.current = value
      }
    }
    if (initialResolvedAddress) {
      setResolvedAddress(initialResolvedAddress)
      // Mark this value as validated so we don't re-validate
      if (value) {
        lastValidatedValueRef.current = value
      }
    }
  }, [initialMetadata, initialResolvedAddress, value])

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
    options?: { skipUpdateInput?: boolean }
  ) => {
    if (!address.trim()) {
      setMetadata(null)
      setError('')
      setResolvedAddress(null)
      if (onResolve) {
        onResolve('', null)
      }
      if (onError) {
        onError('')
      }
      return
    }

    // Try to normalize the address (fix checksum)
    const normalizedAddress = normalizeAddress(address)
    if (!normalizedAddress) {
      const errorMsg = 'Invalid address format'
      setMetadata(null)
      setError(errorMsg)
      setLoading(false)
      setResolvedAddress(null)
      if (onResolve) {
        onResolve('', null)
      }
      if (onError) {
        onError(errorMsg)
      }
      return
    }

    setResolvedAddress(normalizedAddress)

    // Set loading state
    setLoading(true)
    setError('')

    try {
      const tokenMetadata = await fetchTokenMetadata(normalizedAddress)
      setMetadata(tokenMetadata)
      setError('')
      if (onResolve) {
        onResolve(normalizedAddress, tokenMetadata)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata'
      setMetadata(null)
      setError(errorMessage)
      setResolvedAddress(null)
      if (onResolve) {
        onResolve('', null)
      }
      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [onResolve])

  /**
   * Process input: if hex address -> normalize and fetch metadata.
   * If not hex -> treat as symbol, lookup in addresses JSON (case-insensitive); if found use that address and fetch metadata; if not show error.
   */
  const processTokenInput = useCallback(async (inputValue: string) => {
    if (!inputValue.trim()) {
      setMetadata(null)
      setError('')
      setResolvedAddress(null)
      if (onResolve) {
        onResolve('', null)
      }
      return
    }

    if (isHexAddress(inputValue)) {
      await validateAndFetchToken(inputValue)
      return
    }

    // Symbol path: need chainId
    let currentChainId: string
    try {
      if (!chainId) {
        if (!window.ethereum) {
          const errorMsg = 'Connect your wallet to look up token by symbol.'
          setError(errorMsg)
          setResolvedAddress(null)
          setMetadata(null)
          if (onResolve) {
            onResolve('', null)
          }
          if (onError) {
            onError(errorMsg)
          }
          return
        }
        const hex = await window.ethereum.request({ method: 'eth_chainId' }) as string
        currentChainId = parseInt(hex, 16).toString()
      } else {
        currentChainId = chainId
      }
    } catch {
      const errorMsg = 'Could not read network. Please enter the token address manually.'
      setError(errorMsg)
      setResolvedAddress(null)
      setMetadata(null)
      if (onResolve) {
        onResolve('', null)
      }
      if (onError) {
        onError(errorMsg)
      }
      return
    }

    setLoading(true)
    setError('')
    setResolvedAddress(null)
    setMetadata(null)

    const result = await resolveSymbolToAddress(currentChainId, inputValue)
    if (!result) {
      const errorMsg = 'Please enter the token address manually.'
      setLoading(false)
      setError(errorMsg)
      setResolvedAddress(null)
      if (onResolve) {
        onResolve('', null)
      }
      if (onError) {
        onError(errorMsg)
      }
      return
    }

    setResolvedAddress(result.address)
    await validateAndFetchToken(result.address, { skipUpdateInput: true })
    setLoading(false)
  }, [chainId, validateAndFetchToken, onResolve])

  // Debounced: resolve (symbol or hex) and fetch metadata
  const debouncedProcessInput = useMemo(
    () => debounce((inputValue: string) => processTokenInput(inputValue), debounceMs),
    [processTokenInput, debounceMs]
  )

  // Auto-validate when value changes from outside (e.g., from cache or wizardData)
  // Use a ref to track the last validated value to avoid re-validating
  const lastValidatedValueRef = useRef<string>('')
  const hasInitialDataRef = useRef<boolean>(false)
  
  // Track if we received initial data
  useEffect(() => {
    if (initialMetadata || initialResolvedAddress) {
      hasInitialDataRef.current = true
      // Mark current value as validated if we have initial data
      if (value) {
        lastValidatedValueRef.current = value
      }
    }
  }, [initialMetadata, initialResolvedAddress, value])
  
  // Auto-validate when value changes from outside
  useEffect(() => {
    // Skip if we already validated this exact value
    if (value === lastValidatedValueRef.current) {
      return
    }
    
    // If we have initial metadata for this value, mark as validated and don't re-validate
    if (hasInitialDataRef.current && initialMetadata && value) {
      lastValidatedValueRef.current = value
      return
    }
    
    // Only auto-validate if:
    // 1. Value exists
    // 2. We don't have metadata yet (or metadata was cleared)
    // 3. It's not currently loading
    // 4. We have chainId (for symbol lookup) or value is a hex address
    if (value.trim() && !metadata && !loading) {
      if (isHexAddress(value) || chainId) {
        lastValidatedValueRef.current = value
        // Small delay to avoid race conditions and ensure processTokenInput is ready
        const timer = setTimeout(() => {
          processTokenInput(value)
        }, 200)
        return () => clearTimeout(timer)
      }
    } else if (!value.trim()) {
      // Reset ref when value is cleared
      lastValidatedValueRef.current = ''
      hasInitialDataRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, chainId]) // Only depend on value and chainId to avoid loops

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Clear any existing errors when user starts typing
    if (error) {
      setError('')
    }
    
    debouncedProcessInput(newValue)
  }

  // Process on blur as well (for immediate feedback)
  const handleBlur = () => {
    if (value.trim()) {
      processTokenInput(value)
    }
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            error ? 'border-red-500' : metadata ? 'border-green-500' : 'border-gray-700'
          } ${className}`}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
      {showMatchedAddress && resolvedAddress && value.trim() !== resolvedAddress && (
        <div className="mt-2 text-sm text-gray-400 font-mono break-all flex flex-wrap items-center gap-2">
          <span>Matched address:</span>
          {chainId ? (
            <a
              href={getExplorerAddressUrl(chainId, resolvedAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              {normalizeAddress(resolvedAddress) ?? resolvedAddress}
            </a>
          ) : (
            <span>{normalizeAddress(resolvedAddress) ?? resolvedAddress}</span>
          )}
          <CopyButton value={normalizeAddress(resolvedAddress) ?? resolvedAddress} iconClassName="w-3.5 h-3.5" />
        </div>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-400">
          ✗ {error}
        </div>
      )}
      {metadata && (
        <div className="mt-2 text-sm text-green-400">
          ✓ {metadata.name} ({metadata.symbol}) - {metadata.decimals} decimals
        </div>
      )}
    </div>
  )
}
