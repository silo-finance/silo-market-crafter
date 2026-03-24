'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import Button from '@/components/Button'
import { fetchMarketConfig } from '@/utils/fetchMarketConfig'
import { resolveAddressToSiloConfig } from '@/utils/resolveAddressToSiloConfig'
import { KinkConfigItem, findKinkConfigName } from '@/utils/kinkConfigName'
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

const KINK_CONFIGS_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'

interface VerificationRow {
  candidate: IrmUpdateCandidate
  assignedSiloAddress: string
  resolvedSiloConfigAddress: string
  marketLabel: string
  expectedIrmTarget: string
  targetMatchesSilo: boolean
  matchedConfigName: string | null
}

interface VerificationResult {
  parsedSafe: ParsedSafeUrl
  rows: VerificationRow[]
}

function PassFailBadge({ pass }: { pass: boolean }) {
  if (pass) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-lime-700/70 bg-lime-900/20 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-600">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-lime-300 text-base font-bold tracking-wide">PASS</div>
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

      const siloAddressesRaw = parseSiloConfigAddressesInput(siloAddressInput)
      if (siloAddressesRaw.length === 0) {
        throw new Error('Provide at least one Silo address')
      }
      if (siloAddressesRaw.some((address) => !ethers.isAddress(address))) {
        throw new Error('At least one Silo address is invalid')
      }
      if (updateCandidates.length !== siloAddressesRaw.length) {
        throw new Error(
          `Number of Silo addresses (${siloAddressesRaw.length}) must equal number of pending updateConfig tx (${updateCandidates.length})`
        )
      }

      const normalizedSiloAddresses = siloAddressesRaw.map((address) => ethers.getAddress(address))
      const provider = new ethers.BrowserProvider(window.ethereum)
      const marketRows: Array<{
        siloAddress: string
        siloConfigAddress: string
        marketLabel: string
        expectedIrmTarget: string
      }> = []
      for (let i = 0; i < normalizedSiloAddresses.length; i++) {
        const siloAddress = normalizedSiloAddresses[i]
        try {
          const siloConfigAddress = await resolveAddressToSiloConfig(provider, siloAddress, {
            knownSilo: true
          })
          const marketConfig = await fetchMarketConfig(provider, siloConfigAddress)
          const normalizedSilo = siloAddress.toLowerCase()
          const isSilo0 = marketConfig.silo0.silo.toLowerCase() === normalizedSilo
          const isSilo1 = marketConfig.silo1.silo.toLowerCase() === normalizedSilo
          if (!isSilo0 && !isSilo1) {
            throw new Error(`Silo ${siloAddress} is not part of resolved SiloConfig ${siloConfigAddress}`)
          }
          const expectedIrmTarget = isSilo0
            ? marketConfig.silo0.interestRateModel.address
            : marketConfig.silo1.interestRateModel.address
          const marketLabel = `${marketConfig.silo0.tokenSymbol ?? 'TOKEN0'}\u00A0/\u00A0${marketConfig.silo1.tokenSymbol ?? 'TOKEN1'}`
          marketRows.push({
            siloAddress,
            siloConfigAddress,
            marketLabel,
            expectedIrmTarget
          })
        } catch (marketConfigError) {
          const errorMessage =
            marketConfigError instanceof Error ? marketConfigError.message : 'Unknown error'
          throw new Error(
            `Invalid Silo at position ${i + 1}: ${siloAddress}. This field accepts only Silo addresses (hex or explorer URL).\n${errorMessage}`
          )
        }
      }

      const kinkConfigsResponse = await fetch(KINK_CONFIGS_URL)
      if (!kinkConfigsResponse.ok) {
        throw new Error('Failed to fetch official IRM config list')
      }
      const kinkConfigJson = parseJsonPreservingBigInt<KinkConfigItem[]>(await kinkConfigsResponse.text())

      const rows: VerificationRow[] = updateCandidates.map((candidate, index) => {
        const marketRow = marketRows[index]
        const targetMatchesSilo =
          candidate.tx.to.toLowerCase() === marketRow.expectedIrmTarget.toLowerCase()
        const matchedConfigName = findKinkConfigName(
          {
            type: 'DynamicKinkModel',
            config: candidate.decodedConfig
          },
          kinkConfigJson
        )
        return {
          candidate,
          assignedSiloAddress: marketRow.siloAddress,
          resolvedSiloConfigAddress: marketRow.siloConfigAddress,
          marketLabel: marketRow.marketLabel,
          expectedIrmTarget: marketRow.expectedIrmTarget,
          targetMatchesSilo,
          matchedConfigName
        }
      })

      const query = new URLSearchParams()
      query.set('safeUrl', safeUrlInput.trim())
      query.set('siloAddresses', normalizedSiloAddresses.join(','))
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

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="safe-url" className="block text-sm font-medium text-white mb-2">
              Safe Queue URL
            </label>
            <input
              id="safe-url"
              type="text"
              value={safeUrlInput}
              onChange={(event) => setSafeUrlInput(event.target.value)}
              placeholder="https://app.safe.global/transactions/queue?safe=eth:0x..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-700"
            />
          </div>

          <div>
            <label htmlFor="silo-config" className="block text-sm font-medium text-white mb-2">
              Silo Addresses (ordered)
            </label>
            <textarea
              id="silo-config"
              value={siloAddressInput}
              onChange={(event) => setSiloAddressInput(event.target.value)}
              placeholder={'0x...\n0x...'}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-700"
            />
            <p className="mt-2 text-xs text-gray-400">
              Provide only Silo addresses (one per line, or separated by commas/spaces). You can
              paste raw hex address or explorer URL. Order must match transaction order.
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
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Summary</h2>
            <p className="text-gray-300 text-sm">Safe: <span className="font-mono">{result.parsedSafe.safeAddress}</span></p>
            <p className="text-gray-300 text-sm">Queued `updateConfig` tx count: <span className="font-semibold">{result.rows.length}</span></p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2 rounded-md border border-lime-700/70 bg-lime-900/20 px-3 py-1.5">
                <svg className="h-5 w-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-lime-300">
                  success: {result.rows.filter((row) => row.targetMatchesSilo && row.matchedConfigName != null).length}
                </span>
              </div>

              {result.rows.filter((row) => !(row.targetMatchesSilo && row.matchedConfigName != null)).length > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-red-600/70 bg-red-900/30 px-3 py-1.5">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-semibold text-red-300">
                    fail: {result.rows.filter((row) => !(row.targetMatchesSilo && row.matchedConfigName != null)).length}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-semibold text-gray-300">
                  fail: 0
                </span>
              )}
            </div>
          </div>

          {result.rows.length === 0 && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <p className="text-gray-300">No pending `updateConfig` transactions found in this Safe queue.</p>
            </div>
          )}

          {result.rows.map(({ candidate, assignedSiloAddress, resolvedSiloConfigAddress, marketLabel, expectedIrmTarget, targetMatchesSilo, matchedConfigName }, index) => (
            <div key={candidate.tx.safeTxHash} className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="mb-4">
                <PassFailBadge pass={targetMatchesSilo && matchedConfigName != null} />
              </div>
              <h3 className="text-white font-semibold mb-3">Transaction #{index + 1} (nonce {candidate.tx.nonce})</h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-300">
                  market:{' '}
                  <span className="irm-config-name-chip" style={{ fontSize: '0.92rem' }}>
                    {marketLabel}
                  </span>
                </p>
                <p className="text-gray-300">assigned silo: <span className="font-mono break-all">{assignedSiloAddress}</span></p>
                <p className="text-gray-300">resolved siloConfig: <span className="font-mono break-all">{resolvedSiloConfigAddress}</span></p>
                <p className="text-gray-300">transaction target address: <span className="font-mono break-all">{candidate.tx.to}</span></p>
                <p className="text-gray-300">IRM on chain (IRM config from silo config): <span className="font-mono break-all">{expectedIrmTarget}</span></p>
                <p className="text-gray-300">
                  target matches selected silo IRM:{' '}
                  <span className={targetMatchesSilo ? 'text-lime-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {targetMatchesSilo ? 'yes' : 'no'}
                  </span>
                </p>
                <p className="text-gray-300">
                  matched official config:{' '}
                  <span className={matchedConfigName ? 'text-lime-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                    {matchedConfigName ?? 'not matched'}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
