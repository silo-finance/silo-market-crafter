'use client'

import React from 'react'
import { MarketConfig, formatPercentage, formatAddress } from '@/utils/fetchMarketConfig'
import CopyButton from '@/components/CopyButton'
import { ethers } from 'ethers'

interface MarketConfigTreeProps {
  config: MarketConfig
  explorerUrl: string
}

interface TokenMeta {
  symbol?: string
  decimals?: number
}

interface TreeNodeProps {
  label: string
  value?: string | bigint | boolean | null
  address?: string
  tokenMeta?: TokenMeta
  children?: React.ReactNode
  explorerUrl: string
  isPercentage?: boolean
}

function TreeNode({ label, value, address, tokenMeta, children, explorerUrl, isPercentage }: TreeNodeProps) {
  const hasAddress = address && address !== ethers.ZeroAddress
  const hasValue = value !== undefined && value !== null && !hasAddress
  const hasTokenMeta = tokenMeta && (tokenMeta.symbol != null || tokenMeta.decimals != null)

  return (
    <li className="tree-item">
      <span className="tree-item-content">
        <span className="text-gray-300 text-sm font-medium">{label}:</span>
        {' '}
        
        {hasAddress && (
          <>
            <a
              href={`${explorerUrl}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono text-sm"
            >
              {formatAddress(address)}
            </a>
            <CopyButton value={address} title="Copy address" iconClassName="w-3.5 h-3.5 inline align-middle" />
            {hasTokenMeta && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({[tokenMeta.symbol, tokenMeta.decimals != null ? `${tokenMeta.decimals} decimals` : ''].filter(Boolean).join(', ')})
              </span>
            )}
          </>
        )}
        {hasValue && (
          <span className="text-white text-sm font-mono">
            {typeof value === 'boolean'
              ? (value ? 'Yes' : 'No')
              : isPercentage && typeof value === 'bigint'
                ? formatPercentage(value)
                : typeof value === 'bigint'
                  ? value.toString()
                  : String(value)}
          </span>
        )}
        {address === ethers.ZeroAddress && (
          <span className="text-gray-500 text-sm italic">Zero Address</span>
        )}
      </span>
      {children && <ol className="tree">{children}</ol>}
    </li>
  )
}

export default function MarketConfigTree({ config, explorerUrl }: MarketConfigTreeProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 px-6 pt-6 pb-2">
      <h3 className="text-lg font-semibold text-white mb-4">Market Configuration Tree</h3>
      
      <ol className="tree">
        <TreeNode label="Silo Config" address={config.siloConfig} explorerUrl={explorerUrl}>
          <TreeNode label="Immutable variables" explorerUrl={explorerUrl}>
            {config.siloId !== null && (
              <TreeNode label="SILO_ID" value={config.siloId} explorerUrl={explorerUrl} />
            )}
            <TreeNode label="Silos" explorerUrl={explorerUrl}>
              <TreeNode label="silo0" address={config.silo0.silo} explorerUrl={explorerUrl} />
              <TreeNode label="silo1" address={config.silo1.silo} explorerUrl={explorerUrl} />
            </TreeNode>
          </TreeNode>
        </TreeNode>

        <TreeNode label="Silo 0" address={config.silo0.silo} explorerUrl={explorerUrl}>
          <TreeNode label="Token" address={config.silo0.token} tokenMeta={{ symbol: config.silo0.tokenSymbol, decimals: config.silo0.tokenDecimals }} explorerUrl={explorerUrl} />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo0.protectedShareToken} tokenMeta={{ symbol: config.silo0.protectedShareTokenSymbol, decimals: config.silo0.protectedShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Collateral Share Token" address={config.silo0.collateralShareToken} tokenMeta={{ symbol: config.silo0.collateralShareTokenSymbol, decimals: config.silo0.collateralShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Debt Share Token" address={config.silo0.debtShareToken} tokenMeta={{ symbol: config.silo0.debtShareTokenSymbol, decimals: config.silo0.debtShareTokenDecimals }} explorerUrl={explorerUrl} />
          </TreeNode>
          <TreeNode label="Solvency Oracle" address={config.silo0.solvencyOracle.address} explorerUrl={explorerUrl}>
            {config.silo0.solvencyOracle.type && (
              <TreeNode label="Type" value={config.silo0.solvencyOracle.type} explorerUrl={explorerUrl} />
            )}
            {config.silo0.solvencyOracle.config && Object.entries(config.silo0.solvencyOracle.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode label="Max LTV Oracle" address={config.silo0.maxLtvOracle.address} explorerUrl={explorerUrl}>
            {config.silo0.maxLtvOracle.type && (
              <TreeNode label="Type" value={config.silo0.maxLtvOracle.type} explorerUrl={explorerUrl} />
            )}
            {config.silo0.maxLtvOracle.config && Object.entries(config.silo0.maxLtvOracle.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode label="Interest Rate Model" address={config.silo0.interestRateModel.address} explorerUrl={explorerUrl}>
            {config.silo0.interestRateModel.type && (
              <TreeNode label="Type" value={config.silo0.interestRateModel.type} explorerUrl={explorerUrl} />
            )}
            {config.silo0.interestRateModel.config && Object.entries(config.silo0.interestRateModel.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode label="Max LTV" value={config.silo0.maxLtv} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Liquidation Threshold (LT)" value={config.silo0.lt} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Liquidation Target LTV" value={config.silo0.liquidationTargetLtv} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Liquidation Fee" value={config.silo0.liquidationFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Flashloan Fee" value={config.silo0.flashloanFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="DAO Fee" value={config.silo0.daoFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Deployer Fee" value={config.silo0.deployerFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Hook Receiver" address={config.silo0.hookReceiver} explorerUrl={explorerUrl} />
          <TreeNode label="Call Before Quote" value={config.silo0.callBeforeQuote} explorerUrl={explorerUrl} />
        </TreeNode>

        <TreeNode label="Silo 1" address={config.silo1.silo} explorerUrl={explorerUrl}>
          <TreeNode label="Token" address={config.silo1.token} tokenMeta={{ symbol: config.silo1.tokenSymbol, decimals: config.silo1.tokenDecimals }} explorerUrl={explorerUrl} />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo1.protectedShareToken} tokenMeta={{ symbol: config.silo1.protectedShareTokenSymbol, decimals: config.silo1.protectedShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Collateral Share Token" address={config.silo1.collateralShareToken} tokenMeta={{ symbol: config.silo1.collateralShareTokenSymbol, decimals: config.silo1.collateralShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Debt Share Token" address={config.silo1.debtShareToken} tokenMeta={{ symbol: config.silo1.debtShareTokenSymbol, decimals: config.silo1.debtShareTokenDecimals }} explorerUrl={explorerUrl} />
          </TreeNode>
          <TreeNode label="Solvency Oracle" address={config.silo1.solvencyOracle.address} explorerUrl={explorerUrl}>
            {config.silo1.solvencyOracle.type && (
              <TreeNode label="Type" value={config.silo1.solvencyOracle.type} explorerUrl={explorerUrl} />
            )}
            {config.silo1.solvencyOracle.config && Object.entries(config.silo1.solvencyOracle.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode label="Max LTV Oracle" address={config.silo1.maxLtvOracle.address} explorerUrl={explorerUrl}>
            {config.silo1.maxLtvOracle.type && (
              <TreeNode label="Type" value={config.silo1.maxLtvOracle.type} explorerUrl={explorerUrl} />
            )}
            {config.silo1.maxLtvOracle.config && Object.entries(config.silo1.maxLtvOracle.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode label="Interest Rate Model" address={config.silo1.interestRateModel.address} explorerUrl={explorerUrl}>
            {config.silo1.interestRateModel.type && (
              <TreeNode label="Type" value={config.silo1.interestRateModel.type} explorerUrl={explorerUrl} />
            )}
            {config.silo1.interestRateModel.config && Object.entries(config.silo1.interestRateModel.config).map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={typeof val === 'string' ? val : String(val)}
                explorerUrl={explorerUrl}
              />
            ))}
          </TreeNode>
          <TreeNode label="Max LTV" value={config.silo1.maxLtv} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Liquidation Threshold (LT)" value={config.silo1.lt} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Liquidation Target LTV" value={config.silo1.liquidationTargetLtv} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Liquidation Fee" value={config.silo1.liquidationFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Flashloan Fee" value={config.silo1.flashloanFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="DAO Fee" value={config.silo1.daoFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Deployer Fee" value={config.silo1.deployerFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode label="Hook Receiver" address={config.silo1.hookReceiver} explorerUrl={explorerUrl} />
          <TreeNode label="Call Before Quote" value={config.silo1.callBeforeQuote} explorerUrl={explorerUrl} />
        </TreeNode>
      </ol>
    </div>
  )
}
