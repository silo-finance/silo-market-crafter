'use client'

import React from 'react'
import { normalizeAddress } from '@/utils/addressValidation'
import { getExplorerAddressUrl } from '@/utils/networks'
import CopyButton from '@/components/CopyButton'

function getExplorerUrl(chainId: string | number | undefined, address: string): string {
  return getExplorerAddressUrl(chainId || 1, address)
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
        className={`text-lime-600 hover:text-lime-500 font-mono ${linkClassName}`}
      >
        {shortAddress}
      </a>
      <CopyButton value={normalizedAddress} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
    </div>
  )
}
