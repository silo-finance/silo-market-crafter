'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import { parseDeployTxReceipt, type DeployTxParsed } from '@/utils/parseDeployTxEvents'

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

  const goToDeployment = () => router.push('/wizard?step=10')

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
          <a
            href={explorerUrl ? `${explorerUrl}/tx/${txHash}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
          >
            {txHash}
          </a>
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
