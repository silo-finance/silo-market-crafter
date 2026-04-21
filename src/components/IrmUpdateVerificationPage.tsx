'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import Button from '@/components/Button'
import { fetchMarketConfig } from '@/utils/fetchMarketConfig'
import { resolveAddressesToSiloConfigs } from '@/utils/resolveAddressToSiloConfig'
import { KinkConfigItem, detectCustomStaticKinkConfig, findKinkConfigName } from '@/utils/kinkConfigName'
import { parseJsonPreservingBigInt } from '@/utils/parseJsonPreservingBigInt'
import {
  extractIrmUpdateCandidates,
  IrmUpdateCandidate,
} from '@/utils/verification/irmUpdateConfigTx'
import {
  fetchPendingSafeTransactions,
  getSafeChainIdHex,
  parseSafeQueueUrl,
  parseSiloConfigAddressesInput,
  ParsedSafeUrl,
} from '@/utils/verification/safeQueue'
import {
  classifyRowStatus,
  matchTxToSiloInPair,
  PairIrmTargets,
  RowStatus,
  SiloMatchKind,
  SiloSlot,
} from '@/utils/verification/irmRowClassification'
import type { MarketConfig } from '@/utils/fetchMarketConfig'

const KINK_CONFIGS_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'

type InputKind = 'silo' | 'siloConfig'

interface VerificationRow {
  candidate: IrmUpdateCandidate
  inputAddress: string
  inputKind: InputKind
  siloConfigAddress: string
  marketLabel: string
  matchKind: SiloMatchKind
  matchedSlot: SiloSlot | null
  matchedSiloAddress: string | null
  matchedSiloSymbol: string | null
  matchedIrmAddress: string | null
  matchedConfigName: string | null
  customStaticRate: string | null
  status: RowStatus
}

interface VerificationResult {
  parsedSafe: ParsedSafeUrl
  rows: VerificationRow[]
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === 'pass') {
    return (
      <div className="silo-callout-success flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--silo-accent)]">
          <svg className="h-6 w-6 text-[var(--silo-surface-strong)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="silo-text-main text-base font-bold tracking-wide">PASS</div>
      </div>
    )
  }

  if (status === 'warning') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-yellow-500/70 bg-yellow-900/30 px-4 py-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center">
          <svg
            className="h-14 w-14 text-yellow-400"
            fill="currentColor"
            stroke="currentColor"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              fill="currentColor"
              d="M12 3.2 1.5 21h21L12 3.2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              stroke="#1a1a1a"
              fill="none"
              d="M12 10v5"
            />
            <circle cx="12" cy="17.6" r="1.1" fill="#1a1a1a" stroke="none" />
          </svg>
        </div>
        <div className="text-yellow-300 text-base font-bold tracking-wide">WARNING</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-600/70 bg-red-900/30 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600">
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div className="text-red-300 text-base font-bold tracking-wide">FAIL</div>
    </div>
  )
}

export default function IrmUpdateVerificationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [safeUrlInput, setSafeUrlInput] = useState('')
  const [siloAddressInput, setSiloAddressInput] = useState('') // one address per line or comma-separated
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerificationResult | null>(null)

  const canSubmit = useMemo(
    () => safeUrlInput.trim() !== '' && siloAddressInput.trim() !== '',
    [safeUrlInput, siloAddressInput]
  )

  useEffect(() => {
    const safeUrl = searchParams.get('safeUrl')
    const siloAddresses = searchParams.get('siloAddresses')
    const legacySiloConfigs = searchParams.get('siloConfigs')
    if (safeUrl) setSafeUrlInput(safeUrl)
    if (siloAddresses) setSiloAddressInput(siloAddresses.split(',').join('\n'))
    else if (legacySiloConfigs) setSiloAddressInput(legacySiloConfigs.split(',').join('\n'))
  }, [searchParams])

  const ensureWalletOnSafeNetwork = useCallback(async (parsedSafe: ParsedSafeUrl) => {
    if (!window.ethereum) {
      throw new Error('Wallet not available. Please connect MetaMask.')
    }

    const chainIdHex = getSafeChainIdHex(parsedSafe.chainPrefix).toLowerCase()
    const currentChainHexRaw = await window.ethereum.request({ method: 'eth_chainId' }) as string
    const currentChainHex = String(currentChainHexRaw).toLowerCase()

    if (currentChainHex === chainIdHex) return

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      })
    } catch (switchError) {
      const error = switchError as { code?: number; message?: string }
      if (error.code === 4001) {
        throw new Error('Network switch rejected in wallet. Please accept network switch and try again.')
      }
      if (error.code === -32002) {
        throw new Error('Network switch request already pending in wallet. Please confirm it and retry.')
      }
      throw new Error(
        `Failed to switch wallet network to "${parsedSafe.chainPrefix}".${error.message ? ` ${error.message}` : ''}`
      )
    }
  }, [])

  const handleVerify = useCallback(async () => {
    setError(null)
    setResult(null)
    setLoading(true)

    try {
      const parsedSafe = parseSafeQueueUrl(safeUrlInput)
      if (!window.ethereum) {
        throw new Error('Wallet not available. Please connect MetaMask.')
      }
      await ensureWalletOnSafeNetwork(parsedSafe)

      const pendingTxs = await fetchPendingSafeTransactions(parsedSafe)
      const updateCandidates = extractIrmUpdateCandidates(pendingTxs)

      const inputAddressesRaw = parseSiloConfigAddressesInput(siloAddressInput)
      if (inputAddressesRaw.length === 0) {
        throw new Error('Provide at least one Silo or SiloConfig address')
      }
      if (inputAddressesRaw.some((address) => !ethers.isAddress(address))) {
        throw new Error('At least one address is invalid')
      }
      if (updateCandidates.length !== inputAddressesRaw.length) {
        throw new Error(
          `Number of input addresses (${inputAddressesRaw.length}) must equal number of pending updateConfig tx (${updateCandidates.length})`
        )
      }

      const normalizedInputAddresses = inputAddressesRaw.map((address) => ethers.getAddress(address))
      const provider = new ethers.BrowserProvider(window.ethereum)

      interface ResolvedInput {
        inputAddress: string
        inputKind: InputKind
        siloConfigAddress: string
        marketConfig: MarketConfig
        intendedSilo: SiloSlot | null
        marketLabel: string
      }

      // Resolve every input address to its SiloConfig in a single multicall batch.
      let resolvedSiloConfigAddresses: string[]
      try {
        resolvedSiloConfigAddresses = await resolveAddressesToSiloConfigs(
          provider,
          normalizedInputAddresses
        )
      } catch (resolveError) {
        const errorMessage =
          resolveError instanceof Error ? resolveError.message : 'Unknown error'
        throw new Error(`Failed to resolve input addresses to SiloConfig: ${errorMessage}`)
      }

      // Fetch MarketConfig for every unique SiloConfig in parallel (each call itself uses multicall).
      const uniqueSiloConfigs = Array.from(
        new Set(resolvedSiloConfigAddresses.map((a) => a.toLowerCase()))
      )
      const marketConfigEntries = await Promise.all(
        uniqueSiloConfigs.map(async (keyLower) => {
          const canonical = resolvedSiloConfigAddresses.find(
            (a) => a.toLowerCase() === keyLower
          ) ?? keyLower
          try {
            const cfg = await fetchMarketConfig(provider, canonical)
            return [keyLower, cfg] as const
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            throw new Error(`Failed to fetch market config for ${canonical}: ${msg}`)
          }
        })
      )
      const marketConfigCache = new Map<string, MarketConfig>(marketConfigEntries)

      const resolvedInputs: ResolvedInput[] = normalizedInputAddresses.map((inputAddress, i) => {
        const siloConfigAddress = resolvedSiloConfigAddresses[i]
        const siloConfigKey = siloConfigAddress.toLowerCase()
        const marketConfig = marketConfigCache.get(siloConfigKey)
        if (!marketConfig) {
          throw new Error(
            `Invalid input at position ${i + 1}: ${inputAddress}. Missing market config for ${siloConfigAddress}.`
          )
        }

        const inputLower = inputAddress.toLowerCase()
        const isInputSiloConfig = inputLower === siloConfigAddress.toLowerCase()
        const isSilo0 = marketConfig.silo0.silo.toLowerCase() === inputLower
        const isSilo1 = marketConfig.silo1.silo.toLowerCase() === inputLower

        let inputKind: InputKind
        let intendedSilo: SiloSlot | null
        if (isInputSiloConfig) {
          inputKind = 'siloConfig'
          intendedSilo = null
        } else if (isSilo0) {
          inputKind = 'silo'
          intendedSilo = 'silo0'
        } else if (isSilo1) {
          inputKind = 'silo'
          intendedSilo = 'silo1'
        } else {
          throw new Error(
            `Invalid input at position ${i + 1}: ${inputAddress}. This field accepts Silo or SiloConfig addresses (hex or explorer URL).\nAddress ${inputAddress} is neither the SiloConfig (${siloConfigAddress}) nor one of its silos (${marketConfig.silo0.silo}, ${marketConfig.silo1.silo}).`
          )
        }

        const marketLabel = `${marketConfig.silo0.tokenSymbol ?? 'TOKEN0'}\u00A0/\u00A0${marketConfig.silo1.tokenSymbol ?? 'TOKEN1'}`

        return {
          inputAddress,
          inputKind,
          siloConfigAddress,
          marketConfig,
          intendedSilo,
          marketLabel
        }
      })

      const kinkConfigsResponse = await fetch(KINK_CONFIGS_URL)
      if (!kinkConfigsResponse.ok) {
        throw new Error('Failed to fetch official IRM config list')
      }
      const kinkConfigJson = parseJsonPreservingBigInt<KinkConfigItem[]>(await kinkConfigsResponse.text())

      const rows: VerificationRow[] = updateCandidates.map((candidate, index) => {
        const resolved = resolvedInputs[index]
        const pair: PairIrmTargets = {
          silo0: {
            irm: resolved.marketConfig.silo0.interestRateModel.address,
            tokenSymbol: resolved.marketConfig.silo0.tokenSymbol
          },
          silo1: {
            irm: resolved.marketConfig.silo1.interestRateModel.address,
            tokenSymbol: resolved.marketConfig.silo1.tokenSymbol
          }
        }
        const match = matchTxToSiloInPair(candidate.tx.to, pair, resolved.intendedSilo)
        const matchedSlot = match.matchedSlot
        const matchedSilo = matchedSlot ? resolved.marketConfig[matchedSlot] : null
        const matchedSiloAddress = matchedSilo?.silo ?? null
        const matchedSiloSymbol = matchedSilo?.tokenSymbol ?? null
        const matchedIrmAddress = matchedSlot ? pair[matchedSlot].irm : null

        const matchedConfigName = findKinkConfigName(
          {
            type: 'DynamicKinkModel',
            config: candidate.decodedConfig
          },
          kinkConfigJson
        )
        const customStaticRate = matchedConfigName
          ? null
          : detectCustomStaticKinkConfig(candidate.decodedConfig)

        const status = classifyRowStatus(match.kind, matchedConfigName, customStaticRate)

        return {
          candidate,
          inputAddress: resolved.inputAddress,
          inputKind: resolved.inputKind,
          siloConfigAddress: resolved.siloConfigAddress,
          marketLabel: resolved.marketLabel,
          matchKind: match.kind,
          matchedSlot,
          matchedSiloAddress,
          matchedSiloSymbol,
          matchedIrmAddress,
          matchedConfigName,
          customStaticRate,
          status
        }
      })

      const query = new URLSearchParams()
      query.set('safeUrl', safeUrlInput.trim())
      query.set('siloAddresses', normalizedInputAddresses.join(','))
      router.replace(`/irm-verification?${query.toString()}`, { scroll: false })

      setResult({
        parsedSafe,
        rows
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }, [ensureWalletOnSafeNetwork, router, safeUrlInput, siloAddressInput])

  return (
    <div className="light-market-theme max-w-6xl mx-auto">
      <div className="text-center sm:text-left mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">IRM Update Verification</h1>
        <p className="text-gray-300 text-lg">
          Verify queued Safe `updateConfig` transactions against market IRM and official configs.
        </p>
      </div>

      <div className="silo-panel p-6 mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="safe-url" className="block text-sm font-medium silo-text-main mb-2">
              Safe Queue URL
            </label>
            <input
              id="safe-url"
              type="text"
              value={safeUrlInput}
              onChange={(event) => setSafeUrlInput(event.target.value)}
              placeholder="https://app.safe.global/transactions/queue?safe=eth:0x..."
              className="w-full rounded-lg px-4 py-2 silo-input focus:outline-none focus:ring-0"
            />
          </div>

          <div>
            <label htmlFor="silo-config" className="block text-sm font-medium silo-text-main mb-2">
              Silo or SiloConfig Addresses (ordered)
            </label>
            <textarea
              id="silo-config"
              value={siloAddressInput}
              onChange={(event) => setSiloAddressInput(event.target.value)}
              placeholder={'0x...\n0x...'}
              rows={3}
              className="w-full rounded-lg px-4 py-2 min-h-[5.5rem] resize-y silo-input focus:outline-none focus:ring-0"
            />
            <p className="mt-2 text-xs silo-text-soft">
              Provide Silo or SiloConfig addresses (one per line, or separated by commas/spaces).
              You can paste raw hex addresses or explorer URLs. Order must match transaction order.
              When a SiloConfig address is given, the intended silo in the pair is detected by
              matching the transaction IRM target (silo1 first, silo0 fallback).
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            disabled={!canSubmit || loading}
            onClick={handleVerify}
          >
            {loading ? 'Verifying...' : 'Verify queued transactions'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="silo-panel p-6">
            <h2 className="text-lg font-semibold silo-text-main mb-2">Summary</h2>
            <p className="silo-text-soft text-sm">Safe: <span className="font-mono silo-text-main">{result.parsedSafe.safeAddress}</span></p>
            <p className="silo-text-soft text-sm">Queued `updateConfig` tx count: <span className="font-semibold silo-text-main">{result.rows.length}</span></p>
            {(() => {
              const statuses = result.rows.map((row) => row.status)
              const successCount = statuses.filter((s) => s === 'pass').length
              const warningCount = statuses.filter((s) => s === 'warning').length
              const failCount = statuses.filter((s) => s === 'fail').length
              return (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {successCount > 0 ? (
                    <div className="silo-callout-success inline-flex items-center gap-2 py-1.5 px-3">
                      <svg className="h-5 w-5 text-[var(--silo-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-semibold silo-text-main">
                        success: {successCount}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-gray-300">
                      success: 0
                    </span>
                  )}

                  {warningCount > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-md border border-yellow-500/70 bg-yellow-900/30 px-3 py-1.5">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3.2 1.5 21h21L12 3.2z" />
                        <path d="M11 10h2v5h-2z" fill="#1a1a1a" />
                        <circle cx="12" cy="17.6" r="1.1" fill="#1a1a1a" />
                      </svg>
                      <span className="text-sm font-semibold text-yellow-300">
                        warning: {warningCount}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-gray-300">
                      warning: 0
                    </span>
                  )}

                  {failCount > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-md border border-red-600/70 bg-red-900/30 px-3 py-1.5">
                      <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm font-semibold text-red-300">
                        fail: {failCount}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-gray-300">
                      fail: 0
                    </span>
                  )}
                </div>
              )
            })()}
          </div>

          {result.rows.length === 0 && (
            <div className="silo-panel p-6">
              <p className="silo-text-soft">No pending `updateConfig` transactions found in this Safe queue.</p>
            </div>
          )}

          {result.rows.map((row, index) => {
            const {
              candidate,
              inputAddress,
              inputKind,
              siloConfigAddress,
              marketLabel,
              matchKind,
              matchedSlot,
              matchedSiloAddress,
              matchedSiloSymbol,
              matchedIrmAddress,
              matchedConfigName,
              customStaticRate,
              status
            } = row
            const matchedSiloDisplay = matchedSiloSymbol ?? matchedSiloAddress ?? 'unknown'
            return (
              <div key={candidate.tx.safeTxHash} className="silo-panel p-6">
                <div className="mb-4">
                  <StatusBadge status={status} />
                </div>
                <h3 className="silo-text-main font-semibold mb-3">Transaction #{index + 1} (nonce {candidate.tx.nonce})</h3>
                <div className="space-y-1 text-sm">
                  <p className="silo-text-soft">
                    market:{' '}
                    <span className="irm-config-name-chip" style={{ fontSize: '0.92rem' }}>
                      {marketLabel}
                    </span>
                  </p>
                  <p className="silo-text-soft">
                    input ({inputKind === 'siloConfig' ? 'SiloConfig' : 'Silo'}):{' '}
                    <span className="font-mono break-all silo-text-main">{inputAddress}</span>
                  </p>
                  <p className="silo-text-soft">resolved siloConfig: <span className="font-mono break-all silo-text-main">{siloConfigAddress}</span></p>
                  <p className="silo-text-soft">transaction target address: <span className="font-mono break-all silo-text-main">{candidate.tx.to}</span></p>
                  <p className="silo-text-soft">
                    matched silo in pair:{' '}
                    {matchKind === 'none' ? (
                      <span className="text-red-400 font-semibold">none</span>
                    ) : (
                      <span className={matchKind === 'direct' ? 'text-[var(--silo-success)] font-semibold' : 'text-yellow-400 font-semibold'}>
                        {matchedSlot}
                      </span>
                    )}
                    {matchKind === 'fallback' && (
                      <>
                        {' '}
                        <span className="text-yellow-400 font-semibold">
                          | rate changed for silo <strong>{matchedSiloDisplay}</strong>
                        </span>
                      </>
                    )}
                  </p>
                  <p className="silo-text-soft">
                    matched silo IRM:{' '}
                    <span className="font-mono break-all silo-text-main">{matchedIrmAddress ?? '-'}</span>
                  </p>
                  <p className="silo-text-soft">
                    matched official config:{' '}
                    <span className={matchedConfigName ? 'text-[var(--silo-success)] font-semibold' : 'text-yellow-400 font-semibold'}>
                      {matchedConfigName ?? 'not matched'}
                    </span>
                    {!matchedConfigName && customStaticRate && (
                      <>
                        {' '}
                        <span className="text-yellow-400 font-semibold">
                          | custom static flat rate {customStaticRate}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
