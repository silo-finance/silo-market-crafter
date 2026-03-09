'use client'

import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { normalizeAddress, isHexAddress } from '@/utils/addressValidation'
import { resolveSymbolToAddress, getAddressesJsonUrl, resolveAddressToName } from '@/utils/symbolToAddress'
import { getNativeTokenSymbol } from '@/utils/networks'
import { extractHexAddressLike } from '@/utils/addressFromInput'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import PredefinedOptionButton from '@/components/PredefinedOptionButton'

interface OwnerSelectionBlockProps {
  value: string | null
  onChange: (address: string | null) => void
  chainId?: string
  networkName?: string
  disabled?: boolean
}

function getInitialOwnerValue(value: string | null): string {
  if (value == null) return ''
  const s = String(value).trim()
  return s
}

export default function OwnerSelectionBlock({
  value,
  onChange,
  chainId,
  networkName,
  disabled = false
}: OwnerSelectionBlockProps) {
  const [manualAddress, setManualAddress] = useState<string>(() => getInitialOwnerValue(value))
  const [resolvedOwnerAddress, setResolvedOwnerAddress] = useState<string | null>(() => {
    const v = getInitialOwnerValue(value)
    if (!v) return null
    return isHexAddress(v) ? normalizeAddress(v) : null
  })
  const [ownerResolvedKey, setOwnerResolvedKey] = useState<string | null>(null)
  const [ownerNameFromJson, setOwnerNameFromJson] = useState<string | null>(null)
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean
    isContract: boolean | null
    error: string | null
  }>(() => {
    const v = getInitialOwnerValue(value)
    if (!v) return { isValid: false, isContract: null, error: null }
    const norm = isHexAddress(v) ? normalizeAddress(v) : null
    return norm ? { isValid: true, isContract: null, error: null } : { isValid: false, isContract: null, error: null }
  })
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [nativeBalance, setNativeBalance] = useState<string | null>(null)
  const [nativeBalanceSymbol, setNativeBalanceSymbol] = useState<string>('ETH')

  // Sync from parent when value changes (e.g. when returning to step 6 with saved owner)
  useEffect(() => {
    if (value && value.trim()) {
      setManualAddress(value.trim())
      const norm = isHexAddress(value.trim()) ? normalizeAddress(value.trim()) : null
      setResolvedOwnerAddress(norm)
      setOwnerResolvedKey(null)
      if (norm) setAddressValidation({ isValid: true, isContract: null, error: null })
    } else {
      setManualAddress('')
      setResolvedOwnerAddress(null)
      setOwnerResolvedKey(null)
      setAddressValidation({ isValid: false, isContract: null, error: null })
    }
  }, [value])

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
            setAddressValidation({ isValid: true, isContract: code !== '0x' && code !== '0x0', error: null })
          } catch {
            setAddressValidation({ isValid: true, isContract: null, error: null })
          }
        }
        setValidatingAddress(false)
        return
      }

      let resolvedChainId: string
      try {
        if (!window.ethereum) {
          setResolvedOwnerAddress(null)
          setOwnerResolvedKey(null)
          setAddressValidation({ isValid: false, isContract: null, error: 'Connect your wallet to look up by name.' })
          setValidatingAddress(false)
          return
        }
        const hex = (await window.ethereum.request({ method: 'eth_chainId' })) as string
        resolvedChainId = parseInt(hex, 16).toString()
      } catch {
        setResolvedOwnerAddress(null)
        setOwnerResolvedKey(null)
        setAddressValidation({ isValid: false, isContract: null, error: 'Could not read network.' })
        setValidatingAddress(false)
        return
      }

      const result = await resolveSymbolToAddress(resolvedChainId, trimmed)
      if (!result) {
        setResolvedOwnerAddress(null)
        setOwnerResolvedKey(null)
        setAddressValidation({ isValid: false, isContract: null, error: 'Name not found. Enter address manually or use a name from the supported list.' })
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
        setAddressValidation({ isValid: true, isContract: code !== '0x' && code !== '0x0', error: null })
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
      const id = chainId ?? (typeof window !== 'undefined' && window.ethereum
        ? parseInt((await window.ethereum.request({ method: 'eth_chainId' })) as string, 16).toString()
        : undefined)
      if (!id) {
        if (!cancelled) setOwnerNameFromJson(null)
        return
      }
      const name = await resolveAddressToName(id, resolvedOwnerAddress)
      if (!cancelled) setOwnerNameFromJson(name)
    }
    run()
    return () => { cancelled = true }
  }, [resolvedOwnerAddress, ownerResolvedKey, chainId])

  useEffect(() => {
    if (!resolvedOwnerAddress || !window.ethereum) {
      setNativeBalance(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const eth = window.ethereum
        if (!eth) {
          setNativeBalance(null)
          return
        }
        const provider = new ethers.BrowserProvider(eth)
        const balance = await provider.getBalance(resolvedOwnerAddress)
        if (cancelled) return
        setNativeBalance(ethers.formatEther(balance))
        const hex = (await eth.request({ method: 'eth_chainId' })) as string
        setNativeBalanceSymbol(getNativeTokenSymbol(parseInt(hex, 16).toString()))
      } catch {
        if (!cancelled) setNativeBalance(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [resolvedOwnerAddress])

  const effectiveChainId = chainId ? parseInt(chainId, 10) : undefined

  useEffect(() => {
    if (addressValidation.isValid && resolvedOwnerAddress) {
      onChange(resolvedOwnerAddress)
    } else {
      onChange(null)
    }
  }, [resolvedOwnerAddress, addressValidation.isValid, onChange])

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border border-gray-700 bg-gray-800 p-6 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <p className="text-gray-400 text-sm mb-2">
          Supported names (keys) can be viewed{' '}
          <a
            href={chainId ? getAddressesJsonUrl(chainId) : 'https://github.com/silo-finance/silo-contracts-v2/tree/master/common/addresses'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime-600 hover:text-lime-500 underline"
          >
            {chainId ? `in this JSON file (${networkName ?? chainId})` : 'in the repository'}
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          <PredefinedOptionButton disabled={disabled} onClick={() => setManualAddress('DAO_ORACLE')}>
            <span>DAO Oracle</span>
          </PredefinedOptionButton>
        </div>
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(extractHexAddressLike(e.target.value))}
          placeholder="0x... or name (e.g. WETH)"
          disabled={disabled}
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Resolving...</span>
              </div>
            ) : addressValidation.error ? (
              <div className="text-sm text-red-400">✗ {addressValidation.error}</div>
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
                  <AddressDisplayLong address={resolvedOwnerAddress} chainId={effectiveChainId} className="break-all" />
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
    </div>
  )
}
