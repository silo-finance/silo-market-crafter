'use client'

import React from 'react'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import { getChainName } from '@/utils/networks'

function getSourceUrl(chainId: string | number | undefined, contractName: string, isOracle: boolean = false, isImplementation: boolean = false): string {
  if (!chainId) return ''
  const chainName = getChainName(chainId)
  if (isImplementation) {
    return `https://github.com/silo-finance/silo-contracts-v2/blob/master/silo-core/deploy/silo/_siloImplementations.json`
  }
  const path = isOracle 
    ? `silo-oracles/deployments/${chainName}/${contractName}.sol.json`
    : `silo-core/deployments/${chainName}/${contractName}.sol.json`
  return `https://github.com/silo-finance/silo-contracts-v2/blob/master/${path}`
}

export interface ContractInfoProps {
  /** Contract name (e.g., "PTLinearOracleFactory") */
  contractName: string
  /** Contract address */
  address: string
  /** Contract version */
  version: string
  /** Chain ID for source URL */
  chainId?: string | number
  /** Whether this is an oracle contract (affects source URL path) */
  isOracle?: boolean
  /** Whether this is an implementation contract (affects source URL) */
  isImplementation?: boolean
  /** Custom className for the container */
  className?: string
  /** Verification icon to display next to address */
  verificationIcon?: React.ReactNode
}

export default function ContractInfo({
  contractName,
  address,
  version,
  chainId,
  isOracle = false,
  isImplementation = false,
  className = '',
  verificationIcon
}: ContractInfoProps) {
  const sourceUrl = getSourceUrl(chainId, contractName, isOracle, isImplementation)

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-white">{contractName}</p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-300 underline"
          >
            source
          </a>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <AddressDisplayLong
            address={address}
            chainId={chainId}
            linkClassName="text-blue-400 hover:text-blue-300"
          />
          {verificationIcon && verificationIcon}
        </div>
        <div className="text-sm text-gray-300 whitespace-nowrap">
          version: <span className="text-gray-400">{version || '…'}</span>
        </div>
      </div>
    </div>
  )
}
