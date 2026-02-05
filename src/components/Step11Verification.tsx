'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import { parseDeployTxReceipt, type DeployTxParsed } from '@/utils/parseDeployTxEvents'
import CopyButton from '@/components/CopyButton'
import { buildVerificationContext } from '@/verification/context'
import { buildVerificationChecks } from '@/verification/registry'
import { parseNumericInputToBigInt } from '@/verification/utils'
import type { VerificationCheck, VerificationStatus } from '@/verification/types'

function AddressLine({ label, address, explorerUrl }: { label: string; address: string; explorerUrl: string }) {
  if (!address) return null
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="text-gray-400 text-sm shrink-0">{label}</span>
      <a
        href={`${explorerUrl}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
      >
        {address}
      </a>
      <CopyButton value={address} title="Copy address" />
    </div>
  )
}

export default function Step11Verification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { wizardData } = useWizard()
  const [txHash, setTxHash] = useState<string | null>(null)
  const [parsed, setParsed] = useState<DeployTxParsed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [externalPrice0, setExternalPrice0] = useState('')
  const [externalPrice1, setExternalPrice1] = useState('')
  const [verificationItems, setVerificationItems] = useState<
    {
      id: string
      sourceFile: string
      checkName: string
      order: number
      status: VerificationStatus
      message?: string
    }[]
  >([])
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const chainId = wizardData.networkInfo?.chainId
  const explorerMap: { [key: number]: string } = {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    42161: 'https://arbiscan.io',
    43114: 'https://snowtrace.io',
    146: 'https://sonicscan.org'
  }
  const explorerUrl = chainId ? (explorerMap[parseInt(chainId, 10)] || 'https://etherscan.io') : ''

  const buildChecksForContext = async (): Promise<VerificationCheck[]> => {
    if (!parsed?.siloConfig || !chainId) {
      throw new Error('Missing deployment data for verification')
    }
    if (!window.ethereum) {
      throw new Error('Wallet not available')
    }
    const price0 = parseNumericInputToBigInt(externalPrice0) ?? 0n
    const price1 = parseNumericInputToBigInt(externalPrice1) ?? 0n
    const provider = new ethers.BrowserProvider(window.ethereum)
    const context = await buildVerificationContext({
      provider,
      chainId,
      siloConfigAddress: parsed.siloConfig,
      externalPrice0: price0,
      externalPrice1: price1,
      wizardData
    })
    return buildVerificationChecks(context)
  }

  const updateVerificationItem = (id: string, updates: Partial<(typeof verificationItems)[number]>) => {
    setVerificationItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  const runAllChecks = async () => {
    setVerifying(true)
    try {
      const checks = await buildChecksForContext()
      setVerificationItems(
        checks.map((check) => ({
          id: check.id,
          sourceFile: check.sourceFile,
          checkName: check.checkName,
          order: check.order,
          status: 'pending'
        }))
      )
      setVerificationError(null)

      for (const check of checks) {
        updateVerificationItem(check.id, { status: 'running', message: 'Running...' })

        if (check.requiresFork || check.requiresTransaction) {
          const reason = check.requiresFork
            ? 'This check requires a forked chain and cannot be executed in the UI yet.'
            : 'This check requires sending a transaction and cannot be executed in the UI yet.'
          updateVerificationItem(check.id, { status: 'warning', message: reason })
          continue
        }

        let result
        try {
          result = await check.run()
        } catch (err) {
          result = {
            status: 'failed' as const,
            message: err instanceof Error ? err.message : 'Check failed unexpectedly'
          }
        }
        updateVerificationItem(check.id, {
          status: result.status,
          message: result.message,
          checkName: result.checkName ?? check.checkName
        })
      }
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const runSingleCheck = async (checkId: string) => {
    try {
      const checks = await buildChecksForContext()
      const check = checks.find((entry) => entry.id === checkId)
      if (!check) return

      updateVerificationItem(checkId, { status: 'running', message: 'Running...' })

      if (check.requiresFork || check.requiresTransaction) {
        const reason = check.requiresFork
          ? 'This check requires a forked chain and cannot be executed in the UI yet.'
          : 'This check requires sending a transaction and cannot be executed in the UI yet.'
        updateVerificationItem(checkId, { status: 'warning', message: reason })
        return
      }

      let result
      try {
        result = await check.run()
      } catch (err) {
        result = {
          status: 'failed' as const,
          message: err instanceof Error ? err.message : 'Check failed unexpectedly'
        }
      }
      updateVerificationItem(checkId, {
        status: result.status,
        message: result.message,
        checkName: result.checkName ?? check.checkName
      })
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Verification failed')
    }
  }

  useEffect(() => {
    const hash = searchParams.get('tx') || wizardData.lastDeployTxHash || null
    setTxHash(hash)
    if (!hash || !chainId) {
      setLoading(false)
      if (!hash) setError('No transaction hash. Deploy a market first (Step 10).')
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        if (!window.ethereum) {
          setError('Wallet not available')
          setLoading(false)
          return
        }
        const provider = new ethers.BrowserProvider(window.ethereum)
        const receipt = await provider.getTransactionReceipt(hash)
        if (cancelled) return
        if (!receipt || receipt.status !== 1) {
          setError(receipt ? 'Transaction failed or not yet confirmed.' : 'Transaction not found.')
          setLoading(false)
          return
        }
        const data = parseDeployTxReceipt(receipt)
        setParsed(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load transaction')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [searchParams, wizardData.lastDeployTxHash, chainId])

  useEffect(() => {
    if (!parsed?.siloConfig || !chainId) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await runAllChecks()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [parsed?.siloConfig, chainId])

  const goToDeployment = () => router.push('/wizard?step=10')

  const completedCount = verificationItems.filter((item) =>
    ['success', 'failed', 'warning'].includes(item.status)
  ).length

  const totalCount = verificationItems.length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 11: Verification
        </h1>
        <p className="text-gray-300 text-lg">
          Deployment result and contract addresses from transaction events
        </p>
      </div>

      {txHash && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Transaction</h3>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={explorerUrl ? `${explorerUrl}/tx/${txHash}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
            >
              {txHash}
            </a>
            <CopyButton value={txHash} title="Copy transaction hash" />
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <svg className="animate-spin h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading transaction...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            type="button"
            onClick={goToDeployment}
            className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
          >
            Go to Step 10: Deployment
          </button>
        </div>
      )}

      {parsed && !loading && (
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Silo Config &amp; Silos</h3>
            <div className="space-y-1">
              <AddressLine label="SiloConfig" address={parsed.siloConfig || ''} explorerUrl={explorerUrl} />
              <AddressLine label="Silo (token0 asset)" address={parsed.silo0 || ''} explorerUrl={explorerUrl} />
              <AddressLine label="Silo (token1 asset)" address={parsed.silo1 || ''} explorerUrl={explorerUrl} />
              <AddressLine label="Token0 (asset)" address={parsed.token0 || ''} explorerUrl={explorerUrl} />
              <AddressLine label="Token1 (asset)" address={parsed.token1 || ''} explorerUrl={explorerUrl} />
              <AddressLine label="Silo implementation" address={parsed.implementation || ''} explorerUrl={explorerUrl} />
            </div>
          </div>

          {parsed.shareTokens0 && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Share tokens (Silo 0 / token0)</h3>
              <div className="space-y-1">
                <AddressLine label="Protected share token" address={parsed.shareTokens0.protectedShareToken} explorerUrl={explorerUrl} />
                <AddressLine label="Collateral share token" address={parsed.shareTokens0.collateralShareToken} explorerUrl={explorerUrl} />
                <AddressLine label="Debt share token" address={parsed.shareTokens0.debtShareToken} explorerUrl={explorerUrl} />
              </div>
            </div>
          )}

          {parsed.shareTokens1 && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Share tokens (Silo 1 / token1)</h3>
              <div className="space-y-1">
                <AddressLine label="Protected share token" address={parsed.shareTokens1.protectedShareToken} explorerUrl={explorerUrl} />
                <AddressLine label="Collateral share token" address={parsed.shareTokens1.collateralShareToken} explorerUrl={explorerUrl} />
                <AddressLine label="Debt share token" address={parsed.shareTokens1.debtShareToken} explorerUrl={explorerUrl} />
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Hook receivers</h3>
            <div className="space-y-1">
              <AddressLine label="Hook (Silo 0)" address={parsed.hook0 || ''} explorerUrl={explorerUrl} />
              <AddressLine label="Hook (Silo 1)" address={parsed.hook1 || ''} explorerUrl={explorerUrl} />
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Market verification</h3>
                <p className="text-sm text-gray-400">
                  Live checks (no caching). Progress: {completedCount}/{totalCount || 0}
                </p>
              </div>
              <button
                type="button"
                onClick={runAllChecks}
                disabled={verifying || totalCount === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {verifying ? 'Verifying...' : 'Run All Checks'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                External price 0 (raw integer, e.g. 0.07561e6)
                <input
                  type="text"
                  value={externalPrice0}
                  onChange={(e) => setExternalPrice0(e.target.value)}
                  placeholder="0.07561e6"
                  className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                External price 1 (raw integer, e.g. 1e6)
                <input
                  type="text"
                  value={externalPrice1}
                  onChange={(e) => setExternalPrice1(e.target.value)}
                  placeholder="1e6"
                  className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            {verificationError && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm">{verificationError}</p>
              </div>
            )}

            <div className="space-y-3">
              {verificationItems.map((item) => {
                const statusClass =
                  item.status === 'success'
                    ? 'border-green-600/60 bg-green-900/10'
                    : item.status === 'failed'
                      ? 'border-red-600/60 bg-red-900/10'
                      : item.status === 'warning'
                        ? 'border-yellow-600/60 bg-yellow-900/10'
                        : item.status === 'running'
                          ? 'border-blue-600/60 bg-blue-900/10'
                          : 'border-gray-800 bg-gray-950/40'

                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-start justify-between gap-3 border rounded-lg p-4 ${statusClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon status={item.status} />
                      <div>
                        <div className="text-xs text-gray-400">{item.sourceFile}</div>
                        <div className="text-sm font-semibold text-white">{item.checkName}</div>
                        <div className="text-sm text-gray-300">
                          {item.message || (item.status === 'pending' ? 'Pending' : 'Running...')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => runSingleCheck(item.id)}
                      disabled={verifying}
                      className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500"
                    >
                      Run again
                    </button>
                  </div>
                )
              })}
              {verificationItems.length === 0 && (
                <div className="text-sm text-gray-400">No verification checks found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={() => router.push('/wizard?step=10')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>Back to Deployment</span>
        </button>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: VerificationStatus }) {
  if (status === 'success') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600/20 text-green-400">
        ✓
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600/20 text-red-400">
        ✕
      </span>
    )
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-600/20 text-yellow-300">
        !
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-blue-300">
        …
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-700/30 text-gray-400">
      ○
    </span>
  )
}
