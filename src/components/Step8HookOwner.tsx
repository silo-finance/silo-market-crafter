'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { ethers } from 'ethers'
import { normalizeAddress, isHexAddress } from '@/utils/addressValidation'
import { resolveSymbolToAddress, getAddressesJsonUrl, resolveAddressToName } from '@/utils/symbolToAddress'
import CopyButton from '@/components/CopyButton'
import AddressDisplayLong from '@/components/AddressDisplayLong'

type OwnerSource = 'wallet' | 'manual'

function getNativeTokenSymbol(chainId: string): string {
  const map: { [key: string]: string } = {
    '1': 'ETH',
    '137': 'MATIC',
    '10': 'ETH',
    '42161': 'ETH',
    '43114': 'AVAX',
    '8453': 'ETH',
    '146': 'S',
    '653': 'S'
  }
  return map[chainId] || 'ETH'
}

export default function Step8HookOwner() {
  const router = useRouter()
  const { wizardData, updateHookOwnerAddress, markStepCompleted } = useWizard()
  
  const [ownerSource, setOwnerSource] = useState<OwnerSource>('wallet')
  const [manualAddress, setManualAddress] = useState<string>('')
  /** When user enters a name (key), this is the resolved address we use and display. */
  const [resolvedOwnerAddress, setResolvedOwnerAddress] = useState<string | null>(null)
  /** When resolved from a name, the exact key from the JSON for display. */
  const [ownerResolvedKey, setOwnerResolvedKey] = useState<string | null>(null)
  /** When owner was entered as address, name from addresses JSON if found (reverse lookup). */
  const [ownerNameFromJson, setOwnerNameFromJson] = useState<string | null>(null)
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean
    isContract: boolean | null
    error: string | null
  }>({ isValid: false, isContract: null, error: null })
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nativeBalance, setNativeBalance] = useState<string | null>(null)
  const [nativeBalanceSymbol, setNativeBalanceSymbol] = useState<string>('ETH')

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
  useEffect(() => {
    if (wizardData.hookOwnerAddress) {
      if (connectedWalletAddress) {
        if (wizardData.hookOwnerAddress.toLowerCase() === connectedWalletAddress.toLowerCase()) {
          setOwnerSource('wallet')
          setManualAddress('')
          setResolvedOwnerAddress(null)
          setOwnerResolvedKey(null)
        } else {
          setOwnerSource('manual')
          setManualAddress(wizardData.hookOwnerAddress)
          const norm = normalizeAddress(wizardData.hookOwnerAddress)
          setResolvedOwnerAddress(norm)
          setOwnerResolvedKey(null)
        }
      } else {
        setOwnerSource('manual')
        setManualAddress(wizardData.hookOwnerAddress)
        const norm = normalizeAddress(wizardData.hookOwnerAddress)
        setResolvedOwnerAddress(norm)
        setOwnerResolvedKey(null)
      }
    } else {
      if (connectedWalletAddress) setOwnerSource('wallet')
      else setOwnerSource('wallet')
      setManualAddress('')
      setResolvedOwnerAddress(null)
      setOwnerResolvedKey(null)
      setAddressValidation({ isValid: false, isContract: null, error: null })
      setError('')
    }
  }, [wizardData.hookOwnerAddress, connectedWalletAddress])

  // Resolve manual input: hex address or name/key from addresses JSON
  useEffect(() => {
    if (ownerSource !== 'manual' || !manualAddress.trim()) {
      setResolvedOwnerAddress(null)
      setOwnerResolvedKey(null)
      setOwnerNameFromJson(null)
      setAddressValidation({ isValid: false, isContract: null, error: null })
      setValidatingAddress(false)
      return
    }

    const run = async () => {
      setValidatingAddress(true)
      const trimmed = manualAddress.trim()

      if (isHexAddress(trimmed)) {
        const normalizedAddress = normalizeAddress(trimmed)
        if (!normalizedAddress) {
        setResolvedOwnerAddress(null)
        setOwnerResolvedKey(null)
        setAddressValidation({ isValid: false, isContract: null, error: 'Invalid address format' })
          setValidatingAddress(false)
          return
        }
        setResolvedOwnerAddress(normalizedAddress)
        setOwnerResolvedKey(null)
        setAddressValidation({ isValid: true, isContract: null, error: null })

        if (window.ethereum) {
          try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const code = await provider.getCode(normalizedAddress)
            const isContract = code !== '0x' && code !== '0x0'
            setAddressValidation({ isValid: true, isContract, error: null })
          } catch (err) {
            console.error('Error checking contract:', err)
            setAddressValidation({ isValid: true, isContract: null, error: null })
          }
        }
        setValidatingAddress(false)
        return
      }

      // Symbol path: need chainId
      let chainId: string
      try {
        if (!window.ethereum) {
          setResolvedOwnerAddress(null)
          setOwnerResolvedKey(null)
          setAddressValidation({ isValid: false, isContract: null, error: 'Connect your wallet to look up by name.' })
          setValidatingAddress(false)
          return
        }
        const hex = (await window.ethereum.request({ method: 'eth_chainId' })) as string
        chainId = parseInt(hex, 16).toString()
      } catch {
        setResolvedOwnerAddress(null)
        setOwnerResolvedKey(null)
        setAddressValidation({ isValid: false, isContract: null, error: 'Could not read network. Enter address manually.' })
        setValidatingAddress(false)
        return
      }

      const result = await resolveSymbolToAddress(chainId, trimmed)
      if (!result) {
        setResolvedOwnerAddress(null)
        setOwnerResolvedKey(null)
        setAddressValidation({ isValid: false, isContract: null, error: 'Name not found. Enter address manually or use a name from the supported list below.' })
        setValidatingAddress(false)
        return
      }

      setResolvedOwnerAddress(result.address)
      setOwnerResolvedKey(result.exactSymbol)
      setOwnerNameFromJson(null)
      setManualAddress(result.exactSymbol)
      setAddressValidation({ isValid: true, isContract: null, error: null })

      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const code = await provider.getCode(result.address)
        const isContract = code !== '0x' && code !== '0x0'
        setAddressValidation({ isValid: true, isContract, error: null })
      } catch (err) {
        console.error('Error checking contract:', err)
        setAddressValidation({ isValid: true, isContract: null, error: null })
      }
      setValidatingAddress(false)
    }

    const timeoutId = setTimeout(run, 500)
    return () => clearTimeout(timeoutId)
  }, [manualAddress, ownerSource])

  // When owner was entered as address (hex), try to resolve address to name from addresses JSON
  useEffect(() => {
    if (!resolvedOwnerAddress || ownerResolvedKey != null) {
      setOwnerNameFromJson(null)
      return
    }
    let cancelled = false
    const run = async () => {
      let chainId = wizardData.networkInfo?.chainId
      if (!chainId && typeof window !== 'undefined' && window.ethereum) {
        try {
          const hex = (await window.ethereum.request({ method: 'eth_chainId' })) as string
          chainId = parseInt(hex, 16).toString()
        } catch {
          chainId = undefined
        }
      }
      if (!chainId) {
        if (!cancelled) setOwnerNameFromJson(null)
        return
      }
      const name = await resolveAddressToName(chainId, resolvedOwnerAddress)
      if (!cancelled) setOwnerNameFromJson(name)
    }
    run()
    return () => { cancelled = true }
  }, [resolvedOwnerAddress, ownerResolvedKey, wizardData.networkInfo?.chainId])

  // Fetch native balance when we have a resolved address
  useEffect(() => {
    const ethereum = window.ethereum
    if (!resolvedOwnerAddress || !ethereum) {
      setNativeBalance(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const provider = new ethers.BrowserProvider(ethereum)
        const balance = await provider.getBalance(resolvedOwnerAddress)
        if (cancelled) return
        setNativeBalance(ethers.formatEther(balance))
        const hex = (await ethereum.request({ method: 'eth_chainId' })) as string
        const chainId = parseInt(hex, 16).toString()
        setNativeBalanceSymbol(getNativeTokenSymbol(chainId))
      } catch {
        if (!cancelled) setNativeBalance(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [resolvedOwnerAddress])

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
          throw new Error('Please enter an owner address or a name from the supported list')
        }
        if (!addressValidation.isValid || !resolvedOwnerAddress) {
          throw new Error(addressValidation.error || 'Enter a valid address or a name from the supported list')
        }
        ownerAddress = resolvedOwnerAddress
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
                <div className="text-sm mt-1">
                  <AddressDisplayLong
                    address={connectedWalletAddress}
                    chainId={wizardData.networkInfo?.chainId}
                  />
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
                Enter address or name
              </div>
              <p className="text-gray-400 text-sm mb-2">
                Supported names (keys) can be viewed{' '}
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
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x... or name (e.g. WETH)"
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
              
              {ownerSource === 'manual' && manualAddress && (
                <div className="mt-2 space-y-1">
                  {validatingAddress ? (
                    <div className="text-sm text-gray-400 flex items-center space-x-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Resolving...</span>
                    </div>
                  ) : addressValidation.error ? (
                    <div className="text-sm text-red-400">
                      ✗ {addressValidation.error}
                    </div>
                  ) : addressValidation.isValid && resolvedOwnerAddress ? (
                    <div className="space-y-1">
                      {ownerResolvedKey && (
                        <div className="text-sm text-gray-400">
                          Matched name: <span className="font-mono text-gray-300">{ownerResolvedKey}</span>
                        </div>
                      )}
                      {!ownerResolvedKey && ownerNameFromJson && (
                        <div className="text-sm text-gray-400">
                          Name (from addresses): <span className="font-mono text-gray-300">{ownerNameFromJson}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="text-green-400">✓ Address</span>
                        <AddressDisplayLong
                          address={resolvedOwnerAddress}
                          chainId={wizardData.networkInfo?.chainId}
                          className="break-all"
                        />
                      </div>
                      <div className="text-sm text-gray-400">
                        {addressValidation.isContract === null
                          ? 'Type: Checking…'
                          : addressValidation.isContract
                            ? 'Type: Contract'
                            : 'Type: Wallet (EOA)'}
                      </div>
                      {nativeBalance !== null && (
                        <div className="text-sm text-gray-400">
                          Native balance: <span className="text-gray-300 font-mono">{nativeBalance} {nativeBalanceSymbol}</span>
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
              (ownerSource === 'manual' && (!addressValidation.isValid || !resolvedOwnerAddress || !manualAddress.trim()))
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
