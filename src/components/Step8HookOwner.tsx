'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { ethers } from 'ethers'
import { normalizeAddress, isHexAddress } from '@/utils/addressValidation'
import { resolveSymbolToAddress, getAddressesJsonUrl, resolveAddressToName } from '@/utils/symbolToAddress'
import { getNativeTokenSymbol } from '@/utils/networks'
import AddressDisplayLong from '@/components/AddressDisplayLong'

export default function Step8HookOwner() {
  const router = useRouter()
  const { wizardData, updateHookOwnerAddress, markStepCompleted } = useWizard()
  
  const [manualAddress, setManualAddress] = useState<string>('')
  const [resolvedOwnerAddress, setResolvedOwnerAddress] = useState<string | null>(null)
  const [ownerResolvedKey, setOwnerResolvedKey] = useState<string | null>(null)
  const [ownerNameFromJson, setOwnerNameFromJson] = useState<string | null>(null)
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean
    isContract: boolean | null
    error: string | null
  }>({ isValid: false, isContract: null, error: null })
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nativeBalance, setNativeBalance] = useState<string | null>(null)
  const [nativeBalanceSymbol, setNativeBalanceSymbol] = useState<string>('ETH')

  useEffect(() => {
    if (wizardData.hookOwnerAddress && wizardData.hookOwnerAddress.trim()) {
      setManualAddress(wizardData.hookOwnerAddress)
      const norm = normalizeAddress(wizardData.hookOwnerAddress)
      setResolvedOwnerAddress(norm)
      setOwnerResolvedKey(null)
      if (norm) setAddressValidation({ isValid: true, isContract: null, error: null })
    } else {
      setManualAddress('')
      setResolvedOwnerAddress(null)
      setOwnerResolvedKey(null)
      setAddressValidation({ isValid: false, isContract: null, error: null })
      setError('')
    }
  }, [wizardData.hookOwnerAddress])

  useEffect(() => {
    if (!manualAddress.trim()) {
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
          } catch {
            setAddressValidation({ isValid: true, isContract: null, error: null })
          }
        }
        setValidatingAddress(false)
        return
      }

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
      } catch {
        setAddressValidation({ isValid: true, isContract: null, error: null })
      }
      setValidatingAddress(false)
    }

    const timeoutId = setTimeout(run, 500)
    return () => clearTimeout(timeoutId)
  }, [manualAddress])

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
    const errors: string[] = []
    if (!manualAddress.trim()) {
      errors.push('Please enter an owner address or a name from the supported list')
    } else if (!addressValidation.isValid || !resolvedOwnerAddress) {
      errors.push(addressValidation.error || 'Enter a valid address or a name from the supported list')
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }

    setError('')
    setLoading(true)

    try {
      updateHookOwnerAddress(resolvedOwnerAddress!)
      markStepCompleted(10)
      router.push('/wizard?step=11')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=9')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 10: Hook Owner Selection
        </h1>
        <p className="text-gray-300 text-lg">
          Enter the address of the hook owner. This applies to all hook types.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`rounded-lg border border-gray-700 bg-gray-800 p-6`}>
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
              className="text-lime-600 hover:text-lime-500 underline"
            >
              {wizardData.networkInfo?.chainId
                ? `in this JSON file (${wizardData.networkInfo?.networkName ?? wizardData.networkInfo?.chainId})`
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
              manualAddress
                ? validatingAddress
                  ? 'border-gray-600'
                  : addressValidation.error
                    ? 'border-red-500 focus:border-red-500'
                    : addressValidation.isValid
                      ? 'border-green-500 focus:border-green-500'
                      : 'border-gray-600'
                : 'border-gray-600 focus:border-lime-700'
            }`}
          />
          
          {manualAddress && (
            <div className="mt-2 space-y-1">
              {validatingAddress ? (
                <div className="text-sm status-muted-success flex items-center space-x-2">
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
                    <div className="text-sm status-muted-success">
                      Matched name: <span className="font-mono text-emerald-800/85">{ownerResolvedKey}</span>
                    </div>
                  )}
                  {!ownerResolvedKey && ownerNameFromJson && (
                    <div className="text-sm status-muted-success">
                      Name (from addresses): <span className="font-mono text-emerald-800/85">{ownerNameFromJson}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="status-muted-success">✓ Address</span>
                    <AddressDisplayLong
                      address={resolvedOwnerAddress}
                      chainId={wizardData.networkInfo?.chainId}
                      className="break-all"
                    />
                  </div>
                  <div className="text-sm status-muted-success">
                    {addressValidation.isContract === null
                      ? 'Type: Checking…'
                      : addressValidation.isContract
                        ? 'Type: Contract'
                        : 'Type: Wallet (EOA)'}
                  </div>
                  {nativeBalance !== null && (
                    <div className="text-sm status-muted-success">
                      Native balance: <span className="text-emerald-800/85 font-mono">{nativeBalance} {nativeBalanceSymbol}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <p className="text-red-400 font-medium mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-red-400 text-sm space-y-1">
              {error.split('\n').map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
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
            disabled={loading}
            className="bg-lime-800 hover:bg-lime-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
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
