'use client'

import React from 'react'
import { normalizeAddress } from '@/utils/addressValidation'
import { getExplorerAddressUrl } from '@/utils/networks'
import CopyButton from '@/components/CopyButton'

function getExplorerUrl(chainId: string | number | undefined, address: string): string {
  return getExplorerAddressUrl(chainId || 1, address)
}

export interface AddressDisplayLongProps {
  /** Address to display */
  address: string
  /** Chain ID for explorer URL */
  chainId?: string | number
  /** Custom className for the container */
  className?: string
  /** Custom className for the address link */
  linkClassName?: string
  /** Whether to break the address on long lines */
  breakAll?: boolean
}

export default function AddressDisplayLong({
  address,
  chainId,
  className = '',
  linkClassName = '',
  breakAll = false
}: AddressDisplayLongProps) {
  const normalizedAddress = normalizeAddress(address) ?? address
  const explorerUrl = getExplorerUrl(chainId, normalizedAddress)

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-blue-400 hover:text-blue-300 font-mono ${breakAll ? 'break-all' : ''} ${linkClassName}`}
      >
        {normalizedAddress}
      </a>
      <CopyButton value={normalizedAddress} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
    </div>
  )
}
