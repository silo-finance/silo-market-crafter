'use client'

import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { normalizeAddress, isHexAddress } from '@/utils/addressValidation'
import { resolveSymbolToAddress, getAddressesJsonUrl, resolveAddressToName } from '@/utils/symbolToAddress'
import { getNativeTokenSymbol } from '@/utils/networks'
import AddressDisplayLong from '@/components/AddressDisplayLong'

type OwnerSource = 'wallet' | 'manual'

interface OwnerSelectionBlockProps {
  value: string | null
  onChange: (address: string | null) => void
  chainId?: string
  networkName?: string
  disabled?: boolean
}

export default function OwnerSelectionBlock({
  value,
  onChange,
  chainId,
  networkName,
  disabled = false
}: OwnerSelectionBlockProps) {
  const [ownerSource, setOwnerSource] = useState<OwnerSource>('wallet')
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
  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string>('')
  const [nativeBalance, setNativeBalance] = useState<string | null>(null)
  const [nativeBalanceSymbol, setNativeBalanceSymbol] = useState<string>('ETH')

  useEffect(() => {
    const getWalletAddress = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        setConnectedWalletAddress(address)
      } catch {
        setConnectedWalletAddress('')
      }
    }
    getWalletAddress()
  }, [])

  useEffect(() => {
    if (value) {
      if (connectedWalletAddress && value.toLowerCase() === connectedWalletAddress.toLowerCase()) {
        setOwnerSource('wallet')
        setManualAddress('')
        setResolvedOwnerAddress(null)
        setOwnerResolvedKey(null)
      } else {
        setOwnerSource('manual')
        setManualAddress(value)
        const norm = isHexAddress(value.trim()) ? normalizeAddress(value.trim()) : null
        setResolvedOwnerAddress(norm)
        setOwnerResolvedKey(null)
        if (norm) setAddressValidation({ isValid: true, isContract: null, error: null })
      }
    } else {
      setOwnerSource('wallet')
      setManualAddress('')
      setResolvedOwnerAddress(null)
      setOwnerResolvedKey(null)
      setAddressValidation({ isValid: false, isContract: null, error: null })
    }
  }, [value, connectedWalletAddress])

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
  }, [manualAddress, ownerSource])

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
        const provider = new ethers.BrowserProvider(window.ethereum)
        const balance = await provider.getBalance(resolvedOwnerAddress)
        if (cancelled) return
        setNativeBalance(ethers.formatEther(balance))
        const hex = (await window.ethereum.request({ method: 'eth_chainId' })) as string
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
    if (ownerSource === 'wallet') {
      onChange(connectedWalletAddress || null)
    } else if (ownerSource === 'manual' && addressValidation.isValid && resolvedOwnerAddress) {
      onChange(resolvedOwnerAddress)
    } else {
      onChange(null)
    }
  }, [ownerSource, connectedWalletAddress, resolvedOwnerAddress, addressValidation.isValid, onChange])

  return (
    <div className="space-y-4">
      <label
        className={`flex items-start space-x-3 p-6 rounded-lg border cursor-pointer transition-all ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        } ${ownerSource === 'wallet'
          ? 'border-lime-700 bg-lime-900/20'
          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
        }`}
      >
        <input
          type="radio"
          name="ownerSource"
          value="wallet"
          checked={ownerSource === 'wallet'}
          onChange={() => setOwnerSource('wallet')}
          className="mt-1"
          disabled={disabled}
        />
        <div className="flex-1">
          <div className="font-semibold text-white text-lg mb-2">Use Connected Wallet</div>
          {connectedWalletAddress ? (
            <div className="text-sm mt-1">
              <AddressDisplayLong
                address={connectedWalletAddress}
                chainId={effectiveChainId}
              />
            </div>
          ) : (
            <div className="text-sm text-yellow-400 mt-1">Please connect your wallet to MetaMask</div>
          )}
        </div>
      </label>

      <label
        className={`flex items-start space-x-3 p-6 rounded-lg border cursor-pointer transition-all ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        } ${ownerSource === 'manual'
          ? 'border-lime-700 bg-lime-900/20'
          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
        }`}
      >
        <input
          type="radio"
          name="ownerSource"
          value="manual"
          checked={ownerSource === 'manual'}
          onChange={() => setOwnerSource('manual')}
          className="mt-1"
          disabled={disabled}
        />
        <div className="flex-1">
          <div className="font-semibold text-white text-lg mb-2">Enter address or name</div>
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
                : 'border-gray-600 focus:border-lime-700'
            }`}
            disabled={ownerSource !== 'manual' || disabled}
          />
          {ownerSource === 'manual' && manualAddress && (
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
      </label>
    </div>
  )
}

