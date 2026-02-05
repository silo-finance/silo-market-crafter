'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import { parseDeployTxReceipt } from '@/utils/parseDeployTxEvents'
import { fetchMarketConfig, MarketConfig } from '@/utils/fetchMarketConfig'
import MarketConfigTree from '@/components/MarketConfigTree'
import CopyButton from '@/components/CopyButton'

export default function Step11Verification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { wizardData } = useWizard()
  const [input, setInput] = useState<string>('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [config, setConfig] = useState<MarketConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const chainId = wizardData.networkInfo?.chainId
  const explorerMap: { [key: number]: string } = {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    42161: 'https://arbiscan.io',
    43114: 'https://snowtrace.io',
    146: 'https://sonicscan.org'
  }
  const explorerUrl = chainId ? (explorerMap[parseInt(chainId, 10)] || 'https://etherscan.io') : 'https://etherscan.io'

  const handleVerify = useCallback(async (value: string, isTxHash: boolean) => {
    if (!value.trim()) {
      setError('Please enter a Silo Config address or transaction hash')
      return
    }

    if (!window.ethereum) {
      setError('Wallet not available. Please connect MetaMask.')
      return
    }

    setLoading(true)
    setError(null)
    setConfig(null)
    setShowForm(false)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      let siloConfigAddress: string

      if (isTxHash) {
        // Extract silo config from transaction
        const receipt = await provider.getTransactionReceipt(value.trim())
        if (!receipt || receipt.status !== 1) {
          throw new Error(receipt ? 'Transaction failed or not yet confirmed.' : 'Transaction not found.')
        }
        const parsed = parseDeployTxReceipt(receipt)
        if (!parsed.siloConfig) {
          throw new Error('Silo Config address not found in transaction events.')
        }
        siloConfigAddress = parsed.siloConfig
        setTxHash(value.trim())
      } else {
        // Validate address
        if (!ethers.isAddress(value.trim())) {
          throw new Error('Invalid address format')
        }
        siloConfigAddress = ethers.getAddress(value.trim())
        setTxHash(null)
      }

      // Fetch market configuration
      const marketConfig = await fetchMarketConfig(provider, siloConfigAddress)
      setConfig(marketConfig)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch market configuration')
      setShowForm(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Extract hash from URL if present
  useEffect(() => {
    const urlHash = searchParams.get('tx')
    if (urlHash) {
      setInput(urlHash)
      handleVerify(urlHash, true)
    } else {
      // Check if we have saved transaction hash
      const savedHash = wizardData.lastDeployTxHash
      if (savedHash) {
        setTxHash(savedHash)
        handleVerify(savedHash, true)
      } else {
        setShowForm(true)
      }
    }
  }, [searchParams, wizardData.lastDeployTxHash, handleVerify])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    
    // Check if input looks like a transaction hash (66 chars starting with 0x)
    // or if it's a valid address (42 chars starting with 0x)
    const isTxHash = trimmed.length === 66 && trimmed.startsWith('0x') && /^0x[a-fA-F0-9]{64}$/.test(trimmed)
    const isAddress = ethers.isAddress(trimmed)
    
    if (!isTxHash && !isAddress) {
      setError('Invalid input. Please provide a valid Silo Config address or transaction hash.')
      return
    }
    
    handleVerify(trimmed, isTxHash)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setError(null)
    
    // Auto-detect if it's a URL with hash or address
    if (value.includes('tx/') || value.includes('transaction/')) {
      const hashMatch = value.match(/0x[a-fA-F0-9]{64}/)
      if (hashMatch) {
        setInput(hashMatch[0])
      }
    } else if (value.includes('address/')) {
      const addressMatch = value.match(/0x[a-fA-F0-9]{40}/)
      if (addressMatch) {
        setInput(addressMatch[0])
      }
    }
  }

  const goToDeployment = () => router.push('/wizard?step=10')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 11: Verification
        </h1>
        <p className="text-gray-300 text-lg">
          View complete market configuration tree
        </p>
      </div>

      {showForm && !loading && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <label htmlFor="input" className="block text-sm font-medium text-white mb-2">
              Silo Config Address or Transaction Hash
            </label>
            <div className="flex gap-2">
              <input
                id="input"
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="0x... or transaction hash or explorer URL"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
              >
                {loading ? 'Loading...' : 'Verify'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Paste a Silo Config address, transaction hash, or explorer URL with transaction hash
            </p>
          </div>
        </form>
      )}

      {txHash && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Transaction</h3>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`${explorerUrl}/tx/${txHash}`}
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
          <span>Loading market configuration...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
            >
              Try again with different input
            </button>
          )}
        </div>
      )}

      {config && !loading && (
        <MarketConfigTree config={config} explorerUrl={explorerUrl} />
      )}

      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={goToDeployment}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>Back to Deployment</span>
        </button>
      </div>
    </div>
  )
}
