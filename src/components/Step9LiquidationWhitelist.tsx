'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import Button from '@/components/Button'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import { extractHexAddressLike } from '@/utils/addressFromInput'
import { getNativeTokenSymbol } from '@/utils/networks'
import {
  fetchLiveTrustedLiquidators,
  getStaticTrustedLiquidators,
  type TrustedLiquidator
} from '@/config/liquidationDefaults'

type AddressPreview = {
  address: string
  isContract: boolean | null
  nativeBalance: string | null
  nativeSymbol: string
}

function mergeTrustedAddresses(entries: TrustedLiquidator[]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const item of entries) {
    if (!ethers.isAddress(item.address)) continue
    const normalized = ethers.getAddress(item.address)
    if (normalized === ethers.ZeroAddress) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(normalized)
  }
  return merged
}

export default function Step9LiquidationWhitelist() {
  const router = useRouter()
  const {
    wizardData,
    markStepCompleted,
    updateLiquidationWhitelistEnabled,
    setPermissionedLiquidators,
    addPermissionedLiquidator,
    removePermissionedLiquidator
  } = useWizard()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [validatingInput, setValidatingInput] = useState(false)
  const [inputPreview, setInputPreview] = useState<AddressPreview | null>(null)
  const [liveDefaults, setLiveDefaults] = useState<TrustedLiquidator[]>([])
  const [liveDefaultsError, setLiveDefaultsError] = useState<string | null>(null)
  const [liveDefaultsResolved, setLiveDefaultsResolved] = useState(false)
  const [isAutofillingDefaults, setIsAutofillingDefaults] = useState(false)

  const chainId = wizardData.networkInfo?.chainId
  const staticDefaults = useMemo(() => getStaticTrustedLiquidators(), [])
  const trustedDefaults = useMemo(
    () => [...liveDefaults, ...staticDefaults],
    [liveDefaults, staticDefaults]
  )
  const trustedLabelByAddress = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of trustedDefaults) {
      const normalized = ethers.getAddress(item.address)
      if (!map.has(normalized.toLowerCase())) {
        map.set(normalized.toLowerCase(), item.label)
      }
    }
    return map
  }, [trustedDefaults])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!chainId) {
        setLiveDefaults([])
        setLiveDefaultsError('Connect wallet to load chain-specific trusted defaults.')
        setLiveDefaultsResolved(true)
        return
      }
      setLiveDefaultsResolved(false)
      setLiveDefaultsError(null)
      try {
        const fetched = await fetchLiveTrustedLiquidators(chainId)
        if (cancelled) return
        setLiveDefaults(fetched)
      } catch (err) {
        if (cancelled) return
        setLiveDefaults([])
        setLiveDefaultsError(err instanceof Error ? err.message : 'Failed to fetch trusted defaults.')
      } finally {
        if (!cancelled) setLiveDefaultsResolved(true)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [chainId])

  useEffect(() => {
    if (!wizardData.liquidationWhitelistEnabled || !liveDefaultsResolved) return
    if (wizardData.permissionedLiquidators.length > 0) return
    const defaults = mergeTrustedAddresses(trustedDefaults)
    if (defaults.length === 0) return
    setIsAutofillingDefaults(true)
    setPermissionedLiquidators(defaults)
    setIsAutofillingDefaults(false)
  }, [
    liveDefaultsResolved,
    setPermissionedLiquidators,
    trustedDefaults,
    wizardData.liquidationWhitelistEnabled,
    wizardData.permissionedLiquidators.length
  ])

  useEffect(() => {
    if (!inputValue.trim()) {
      setInputError(null)
      setInputPreview(null)
      setValidatingInput(false)
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      const candidate = extractHexAddressLike(inputValue).trim()
      if (!ethers.isAddress(candidate)) {
        if (!cancelled) {
          setInputError('Enter a valid address or explorer URL with an address.')
          setInputPreview(null)
          setValidatingInput(false)
        }
        return
      }
      const normalized = ethers.getAddress(candidate)
      if (normalized === ethers.ZeroAddress) {
        if (!cancelled) {
          setInputError('Zero address cannot be added to whitelist.')
          setInputPreview(null)
          setValidatingInput(false)
        }
        return
      }
      if (wizardData.permissionedLiquidators.some(item => item.toLowerCase() === normalized.toLowerCase())) {
        if (!cancelled) {
          setInputError('Address already exists in whitelist.')
          setInputPreview(null)
          setValidatingInput(false)
        }
        return
      }

      setValidatingInput(true)
      setInputError(null)
      let isContract: boolean | null = null
      let nativeBalance: string | null = null
      let nativeSymbol = chainId ? getNativeTokenSymbol(chainId) : 'ETH'

      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const [code, balance] = await Promise.all([
            provider.getCode(normalized),
            provider.getBalance(normalized)
          ])
          if (cancelled) return
          isContract = code !== '0x' && code !== '0x0'
          nativeBalance = ethers.formatEther(balance)
          const currentHexChainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
          nativeSymbol = getNativeTokenSymbol(parseInt(currentHexChainId, 16).toString())
        } catch {
          if (cancelled) return
        }
      }

      if (!cancelled) {
        setInputPreview({
          address: normalized,
          isContract,
          nativeBalance,
          nativeSymbol
        })
        setValidatingInput(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [chainId, inputValue, wizardData.permissionedLiquidators])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (wizardData.liquidationWhitelistEnabled && wizardData.permissionedLiquidators.length === 0) {
        setError('Whitelist is enabled. Add at least one address or switch to public liquidation.')
        setLoading(false)
        return
      }
      markStepCompleted(10)
      router.push('/wizard?step=11')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCurrentAddress = () => {
    if (!inputPreview?.address) return
    addPermissionedLiquidator(inputPreview.address)
    setInputValue('')
    setInputPreview(null)
    setInputError(null)
  }

  const handleToggleWhitelist = (enabled: boolean) => {
    updateLiquidationWhitelistEnabled(enabled)
    if (enabled && wizardData.permissionedLiquidators.length === 0) {
      const defaults = mergeTrustedAddresses(trustedDefaults)
      if (defaults.length > 0) setPermissionedLiquidators(defaults)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=9')
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Step 10: Liquidation Whitelist</h1>
        <p className="silo-text-soft text-lg">
          Configure permissioned liquidators or switch to public liquidation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="silo-panel p-6 space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--silo-accent)]"
              checked={wizardData.liquidationWhitelistEnabled}
              onChange={(e) => handleToggleWhitelist(e.target.checked)}
            />
            <span className="silo-text-main font-medium">
              Enable liquidation white list
            </span>
          </label>
          <p className="text-sm silo-text-soft">
            White list applies to both liquidation types: Dex liquidation and liquidation by defaulting.
          </p>
          {(liveDefaultsError || isAutofillingDefaults) && (
            <p className="text-xs silo-text-soft">
              {isAutofillingDefaults
                ? 'Applying trusted defaults...'
                : `Live defaults info: ${liveDefaultsError}`}
            </p>
          )}
        </div>

        {wizardData.liquidationWhitelistEnabled && (
          <>
            <div className="silo-panel p-6 space-y-4">
              <h2 className="text-lg font-semibold silo-text-main">Whitelist entries</h2>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Paste address or explorer URL"
                className="silo-input silo-input--lg font-mono w-full focus:outline-none focus:ring-0"
              />
              {validatingInput && (
                <p className="text-sm silo-text-soft">Validating address...</p>
              )}
              {inputError && (
                <p className="text-sm text-red-400">{inputError}</p>
              )}
              {inputPreview && (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="silo-text-soft">Address:</span>
                    <AddressDisplayLong
                      address={inputPreview.address}
                      chainId={chainId ? parseInt(chainId, 10) : undefined}
                    />
                  </div>
                  <div>
                    <span className="silo-text-soft">Type: </span>
                    <span className="silo-text-main">
                      {inputPreview.isContract == null
                        ? 'Checking...'
                        : inputPreview.isContract
                          ? 'Contract'
                          : 'Wallet (EOA)'}
                    </span>
                  </div>
                  {inputPreview.nativeBalance != null && (
                    <div>
                      <span className="silo-text-soft">Native balance: </span>
                      <span className="silo-text-main font-mono">
                        {inputPreview.nativeBalance} {inputPreview.nativeSymbol}
                      </span>
                    </div>
                  )}
                  <Button type="button" variant="primary" size="sm" onClick={handleAddCurrentAddress}>
                    Add address
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {wizardData.permissionedLiquidators.map((address) => {
                  const label = trustedLabelByAddress.get(address.toLowerCase())
                  return (
                    <div
                      key={address}
                      className="group flex items-center justify-between gap-4 border border-[var(--silo-border)] rounded-lg p-3 bg-[var(--silo-surface)] transition-colors hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))] hover:bg-[color-mix(in_srgb,var(--silo-accent-soft)_45%,var(--silo-surface))]"
                    >
                      <div className="min-w-0">
                        {label && (
                          <div className="text-xs mb-1 status-muted-success">
                            {label}
                          </div>
                        )}
                        <AddressDisplayLong
                          address={address}
                          chainId={chainId ? parseInt(chainId, 10) : undefined}
                          className="break-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePermissionedLiquidator(address)}
                        title="Remove address"
                        className="text-red-400 hover:text-red-300 leading-none transition-colors"
                        aria-label="Remove address"
                      >
                        <span className="text-[2.5rem]" aria-hidden>
                          ×
                        </span>
                      </button>
                    </div>
                  )
                })}
                {wizardData.permissionedLiquidators.length === 0 && (
                  <div className="text-sm silo-text-soft">
                    No addresses in whitelist.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

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
          <Button type="button" variant="secondary" size="lg" onClick={goToPreviousStep}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Hook</span>
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={loading}>
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
                <span>Hook Owner</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
