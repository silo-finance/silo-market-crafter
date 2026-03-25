'use client'

import { useState, useEffect } from 'react'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

import { getSupportedChainIds, getNetworkDisplayNameMap } from '@/utils/networks'

const SUPPORTED_CHAIN_IDS = getSupportedChainIds()
const SUPPORTED_NETWORKS = getNetworkDisplayNameMap()

export default function NetworkWarning() {
  const [isUnsupportedNetwork, setIsUnsupportedNetwork] = useState(false)
  const [currentChainId, setCurrentChainId] = useState<number | null>(null)

  const checkNetwork = async () => {
    if (!window.ethereum) {
      setIsUnsupportedNetwork(false)
      return
    }

    try {
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string
      const chainId = parseInt(chainIdHex, 16)
      setCurrentChainId(chainId)
      setIsUnsupportedNetwork(!SUPPORTED_CHAIN_IDS.includes(chainId))
    } catch (error) {
      console.error('Error checking network:', error)
      setIsUnsupportedNetwork(false)
    }
  }

  useEffect(() => {
    if (!window.ethereum) {
      return
    }

    // Check on mount
    checkNetwork()

    // Listen for network changes
    const handleChainChanged = () => {
      checkNetwork()
    }

    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  if (!isUnsupportedNetwork) {
    return null
  }

  const currentNetworkName = currentChainId && SUPPORTED_NETWORKS[currentChainId]
    ? SUPPORTED_NETWORKS[currentChainId]
    : `Network ${currentChainId}`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-md">
      <div className="silo-panel p-8 max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[color-mix(in_srgb,var(--silo-warning)_20%,var(--silo-surface))]">
            <svg
              className="w-8 h-8"
              style={{ color: 'var(--silo-warning)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold silo-text-main text-center mb-4">
          Unsupported Network
        </h2>
        
        <p className="silo-text-soft text-center mb-6">
          You are currently connected to <span className="font-semibold silo-text-main">{currentNetworkName}</span>, which is not supported by this application.
        </p>
        
        <div className="silo-panel-soft p-4 mb-6">
          <p className="text-sm silo-text-faint mb-2">Supported networks:</p>
          <ul className="space-y-1 text-sm silo-text-main">
            {Object.entries(SUPPORTED_NETWORKS).map(([chainId, name]) => (
              <li key={chainId} className="flex items-center">
                <span className="w-2 h-2 rounded-full mr-2 bg-[var(--silo-accent)]"></span>
                {name}
              </li>
            ))}
          </ul>
        </div>
        
        <p className="silo-text-faint text-sm text-center">
          Please switch your wallet to one of the supported networks above to continue.
        </p>
      </div>
    </div>
  )
}
