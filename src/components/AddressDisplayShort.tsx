'use client'

import React from 'react'
import { normalizeAddress } from '@/utils/addressValidation'
import CopyButton from '@/components/CopyButton'

const EXPLORER_MAP: { [key: number]: string } = {
  1: 'https://etherscan.io',
  137: 'https://polygonscan.com',
  10: 'https://optimistic.etherscan.io',
  18: 'https://optimistic.etherscan.io',
  420: 'https://goerli-optimism.etherscan.io',
  4202: 'https://sepolia-optimism.etherscan.io',
  42161: 'https://arbiscan.io',
  421613: 'https://goerli.arbiscan.io',
  421614: 'https://sepolia.arbiscan.io',
  43114: 'https://snowtrace.io',
  43113: 'https://testnet.snowtrace.io',
  8453: 'https://basescan.org',
  84531: 'https://goerli.basescan.org',
  84532: 'https://sepolia.basescan.org',
  146: 'https://sonicscan.org',
  653: 'https://sonicscan.org'
}

function getExplorerUrl(chainId: string | number | undefined, address: string): string {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : (chainId || 1)
  const base = EXPLORER_MAP[id] || 'https://etherscan.io'
  return `${base}/address/${address}`
}

export interface AddressDisplayShortProps {
  /** Address to display */
  address: string
  /** Chain ID for explorer URL */
  chainId?: string | number
  /** Custom className for the container */
  className?: string
  /** Custom className for the address link */
  linkClassName?: string
  /** Number of characters to show at the start (default: 6) */
  startChars?: number
  /** Number of characters to show at the end (default: 4) */
  endChars?: number
}

export default function AddressDisplayShort({
  address,
  chainId,
  className = '',
  linkClassName = '',
  startChars = 6,
  endChars = 4
}: AddressDisplayShortProps) {
  const normalizedAddress = normalizeAddress(address) ?? address
  const shortAddress = `${normalizedAddress.slice(0, startChars)}...${normalizedAddress.slice(-endChars)}`
  const explorerUrl = getExplorerUrl(chainId, normalizedAddress)

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-blue-400 hover:text-blue-300 font-mono ${linkClassName}`}
      >
        {shortAddress}
      </a>
      <CopyButton value={normalizedAddress} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
    </div>
  )
}
