'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { ethers } from 'ethers'
import { normalizeAddress } from '@/utils/addressValidation'

type OwnerSource = 'wallet' | 'manual'

export default function Step8HookOwner() {
  const router = useRouter()
  const { wizardData, updateHookOwnerAddress, markStepCompleted } = useWizard()
  
  const [ownerSource, setOwnerSource] = useState<OwnerSource>('wallet')
  const [manualAddress, setManualAddress] = useState<string>('')
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean
    isContract: boolean | null
    error: string | null
  }>({ isValid: false, isContract: null, error: null })
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const hasLoadedInitialData = useRef(false)

  // Get connected wallet address
  useEffect(() => {
    const getWalletAddress = async () => {
      if (!window.ethereum) return
      
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        setConnectedWalletAddress(address)
      } catch (err) {
        console.warn('Failed to get wallet address:', err)
        setConnectedWalletAddress('')
      }
    }
    
    getWalletAddress()
  }, [])

  // Load existing owner address when wizardData changes
  // This ensures that when user returns to this step, their selection is restored
  useEffect(() => {
    if (wizardData.hookOwnerAddress) {
      if (connectedWalletAddress) {
        // Compare addresses (case-insensitive)
        if (wizardData.hookOwnerAddress.toLowerCase() === connectedWalletAddress.toLowerCase()) {
          setOwnerSource('wallet')
          setManualAddress('')
        } else {
          // It's a manual address
          setOwnerSource('manual')
          setManualAddress(wizardData.hookOwnerAddress)
        }
      } else {
        // Wallet not connected yet, but we have a saved address - assume it's manual
        setOwnerSource('manual')
        setManualAddress(wizardData.hookOwnerAddress)
      }
    } else {
      // Reset to default when hookOwnerAddress is cleared (e.g., after form reset)
      if (connectedWalletAddress) {
        setOwnerSource('wallet')
      } else {
        setOwnerSource('wallet') // Default to wallet even if not connected yet
      }
      setManualAddress('')
      setAddressValidation({ isValid: false, isContract: null, error: null })
      setError('')
    }
  }, [wizardData.hookOwnerAddress, connectedWalletAddress])

  // Validate and check address when manual address changes
  useEffect(() => {
    if (ownerSource !== 'manual' || !manualAddress.trim()) {
      setAddressValidation({ isValid: false, isContract: null, error: null })
      setValidatingAddress(false)
      return
    }

    const validateAddress = async () => {
      setValidatingAddress(true)
      
      // Step 1: Validate address format FIRST (using shared utility)
      const normalizedAddress = normalizeAddress(manualAddress)
      
      if (!normalizedAddress) {
        // Invalid format - show error immediately, don't fetch additional data
        setAddressValidation({
          isValid: false,
          isContract: null,
          error: 'Invalid address format'
        })
        setValidatingAddress(false)
        return
      }

      // Address format is valid - show green checkmark
      // Now fetch additional data (contract check) only if format is valid
      setAddressValidation({
        isValid: true,
        isContract: null,
        error: null
      })

      // Step 2: Only if address is valid, check if it's a contract or wallet (EOA)
      // Use MetaMask provider if available, otherwise skip contract check
      if (!window.ethereum) {
        // Valid address but can't check contract info (no MetaMask)
        setAddressValidation({
          isValid: true,
          isContract: null,
          error: null
        })
        setValidatingAddress(false)
        return
      }

      try {
        // Use MetaMask provider to check if address is a contract
        const provider = new ethers.BrowserProvider(window.ethereum)
        const code = await provider.getCode(normalizedAddress)
        const isContract = code !== '0x' && code !== '0x0'

        // Show if it's a contract or wallet (EOA)
        setAddressValidation({
          isValid: true,
          isContract,
          error: null
        })
      } catch (err) {
        console.error('Error checking contract:', err)
        // Address is still valid, just couldn't check contract info
        setAddressValidation({
          isValid: true,
          isContract: null,
          error: null
        })
      } finally {
        setValidatingAddress(false)
      }
    }

    // Debounce validation
    const timeoutId = setTimeout(validateAddress, 500)
    return () => clearTimeout(timeoutId)
  }, [manualAddress, ownerSource])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate owner address
      let ownerAddress: string | null = null
      if (ownerSource === 'wallet') {
        if (!connectedWalletAddress) {
          throw new Error('Please connect your wallet to MetaMask')
        }
        ownerAddress = connectedWalletAddress
      } else {
        if (!manualAddress.trim()) {
          throw new Error('Please enter an owner address')
        }
        const normalized = normalizeAddress(manualAddress)
        if (!normalized) {
          throw new Error('Invalid address format')
        }
        if (!addressValidation.isValid) {
          throw new Error('Address validation failed')
        }
        ownerAddress = normalized
      }

      updateHookOwnerAddress(ownerAddress)

      // Mark step as completed
      markStepCompleted(8)

      // Move to next step
      router.push('/wizard?step=9')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=7')
  }

  // Get block explorer URL for address
  const getBlockExplorerUrl = (address: string) => {
    const chainId = wizardData.networkInfo?.chainId || '1'
    const networkMap: { [key: string]: string } = {
      '1': 'https://etherscan.io/address/',
      '137': 'https://polygonscan.com/address/',
      '10': 'https://optimistic.etherscan.io/address/',
      '42161': 'https://arbiscan.io/address/',
      '43114': 'https://snowtrace.io/address/',
      '146': 'https://sonicscan.org/address/'
    }
    const baseUrl = networkMap[chainId] || 'https://etherscan.io/address/'
    return `${baseUrl}${address}`
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 8: Hook Owner Selection
        </h1>
        <p className="text-gray-300 text-lg">
          Select who will be the owner of the hook. This applies to all hook types.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Wallet Option */}
          <label 
            className={`flex items-start space-x-3 p-6 rounded-lg border cursor-pointer transition-all ${
              ownerSource === 'wallet'
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
            }`}
          >
            <input
              type="radio"
              name="ownerSource"
              value="wallet"
              checked={ownerSource === 'wallet'}
              onChange={(e) => setOwnerSource(e.target.value as OwnerSource)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-semibold text-white text-lg mb-2">
                Use Connected Wallet
              </div>
              {connectedWalletAddress ? (
                <div className="text-sm text-gray-400 mt-1 font-mono">
                  {connectedWalletAddress}
                </div>
              ) : (
                <div className="text-sm text-yellow-400 mt-1">
                  Please connect your wallet to MetaMask
                </div>
              )}
            </div>
          </label>

          {/* Manual Address Option */}
          <label 
            className={`flex items-start space-x-3 p-6 rounded-lg border cursor-pointer transition-all ${
              ownerSource === 'manual'
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
            }`}
          >
            <input
              type="radio"
              name="ownerSource"
              value="manual"
              checked={ownerSource === 'manual'}
              onChange={(e) => setOwnerSource(e.target.value as OwnerSource)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-semibold text-white text-lg mb-2">
                Enter Address Manually
              </div>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x..."
                className={`w-full px-4 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none font-mono text-sm ${
                  ownerSource === 'manual' && manualAddress
                    ? validatingAddress
                      ? 'border-gray-600'
                      : addressValidation.error
                      ? 'border-red-500 focus:border-red-500'
                      : addressValidation.isValid
                      ? 'border-green-500 focus:border-green-500'
                      : 'border-gray-600'
                    : 'border-gray-600 focus:border-blue-500'
                }`}
                disabled={ownerSource !== 'manual'}
              />
              
              {/* Validation Status */}
              {ownerSource === 'manual' && manualAddress && (
                <div className="mt-2">
                  {validatingAddress ? (
                    <div className="text-sm text-gray-400 flex items-center space-x-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Validating address...</span>
                    </div>
                  ) : addressValidation.error ? (
                    <div className="text-sm text-red-400">
                      ✗ {addressValidation.error}
                    </div>
                  ) : addressValidation.isValid ? (
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-green-400">
                          ✓ Valid address
                        </span>
                        {normalizeAddress(manualAddress) && (
                          <a
                            href={getBlockExplorerUrl(normalizeAddress(manualAddress)!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 underline flex items-center space-x-1"
                          >
                            <span>View on Explorer</span>
                            <svg className="w-2.5 h-2.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      {addressValidation.isContract !== null ? (
                        <div className="text-sm text-gray-400">
                          {addressValidation.isContract ? (
                            'Type: Contract'
                          ) : (
                            'Type: Wallet (EOA)'
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Type: Checking...
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </label>
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
            onClick={goToPreviousStep}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Hook Selection</span>
          </button>
          <button
            type="submit"
            disabled={
              loading || 
              (ownerSource === 'wallet' && !connectedWalletAddress) || 
              (ownerSource === 'manual' && (!addressValidation.isValid || !manualAddress.trim()))
            }
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
                <span>JSON Config</span>
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
