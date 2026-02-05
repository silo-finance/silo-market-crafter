'use client'

import React from 'react'
import { MarketConfig, formatPercentage, formatAddress } from '@/utils/fetchMarketConfig'
import CopyButton from '@/components/CopyButton'
import { ethers } from 'ethers'

interface MarketConfigTreeProps {
  config: MarketConfig
  explorerUrl: string
}

interface TreeNodeProps {
  label: string
  value?: string | bigint | boolean | null
  address?: string
  children?: React.ReactNode
  explorerUrl: string
  isPercentage?: boolean
  indent?: number
}

function TreeNode({ label, value, address, children, explorerUrl, isPercentage, indent = 0 }: TreeNodeProps) {
  const paddingLeft = indent * 24
  const hasAddress = address && address !== ethers.ZeroAddress
  const hasValue = value !== undefined && value !== null && !hasAddress

  return (
    <div className="py-1" style={{ paddingLeft }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-400 text-sm">•</span>
        <span className="text-gray-300 text-sm font-medium">{label}:</span>
        
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
            <CopyButton value={address} title="Copy address" iconClassName="w-3.5 h-3.5" />
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
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

export default function MarketConfigTree({ config, explorerUrl }: MarketConfigTreeProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Market Configuration Tree</h3>
      
      <div className="space-y-2">
        {/* Silo Config */}
        <TreeNode label="Silo Config" address={config.siloConfig} explorerUrl={explorerUrl}>
          {config.siloId !== null && (
            <TreeNode label="Silo ID" value={config.siloId} explorerUrl={explorerUrl} indent={1} />
          )}
          
          {/* Silo 0 */}
          <div className="mt-2">
            <TreeNode label="Silo 0" address={config.silo0.silo} explorerUrl={explorerUrl} indent={1}>
              <TreeNode label="Token" address={config.silo0.token} explorerUrl={explorerUrl} indent={2} />
              
              <TreeNode label="Share Tokens" explorerUrl={explorerUrl} indent={2}>
                <TreeNode label="Protected Share Token" address={config.silo0.protectedShareToken} explorerUrl={explorerUrl} indent={3} />
                <TreeNode label="Collateral Share Token" address={config.silo0.collateralShareToken} explorerUrl={explorerUrl} indent={3} />
                <TreeNode label="Debt Share Token" address={config.silo0.debtShareToken} explorerUrl={explorerUrl} indent={3} />
              </TreeNode>
              
              <TreeNode label="Solvency Oracle" address={config.silo0.solvencyOracle.address} explorerUrl={explorerUrl} indent={2}>
                {config.silo0.solvencyOracle.type && (
                  <TreeNode label="Type" value={config.silo0.solvencyOracle.type} explorerUrl={explorerUrl} indent={3} />
                )}
                {config.silo0.solvencyOracle.config && Object.entries(config.silo0.solvencyOracle.config).map(([key, val]) => (
                  <TreeNode 
                    key={key} 
                    label={key} 
                    value={typeof val === 'string' ? val : String(val)} 
                    address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                    explorerUrl={explorerUrl} 
                    indent={3} 
                  />
                ))}
              </TreeNode>
              
              <TreeNode label="Max LTV Oracle" address={config.silo0.maxLtvOracle.address} explorerUrl={explorerUrl} indent={2}>
                {config.silo0.maxLtvOracle.type && (
                  <TreeNode label="Type" value={config.silo0.maxLtvOracle.type} explorerUrl={explorerUrl} indent={3} />
                )}
                {config.silo0.maxLtvOracle.config && Object.entries(config.silo0.maxLtvOracle.config).map(([key, val]) => (
                  <TreeNode 
                    key={key} 
                    label={key} 
                    value={typeof val === 'string' ? val : String(val)} 
                    address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                    explorerUrl={explorerUrl} 
                    indent={3} 
                  />
                ))}
              </TreeNode>
              
              <TreeNode label="Interest Rate Model" address={config.silo0.interestRateModel.address} explorerUrl={explorerUrl} indent={2}>
                {config.silo0.interestRateModel.type && (
                  <TreeNode label="Type" value={config.silo0.interestRateModel.type} explorerUrl={explorerUrl} indent={3} />
                )}
                {config.silo0.interestRateModel.config && Object.entries(config.silo0.interestRateModel.config).map(([key, val]) => (
                  <TreeNode 
                    key={key} 
                    label={key} 
                    value={typeof val === 'string' ? val : String(val)} 
                    explorerUrl={explorerUrl} 
                    indent={3} 
                  />
                ))}
              </TreeNode>
              
              <TreeNode label="Max LTV" value={config.silo0.maxLtv} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Liquidation Threshold (LT)" value={config.silo0.lt} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Liquidation Target LTV" value={config.silo0.liquidationTargetLtv} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Liquidation Fee" value={config.silo0.liquidationFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Flashloan Fee" value={config.silo0.flashloanFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="DAO Fee" value={config.silo0.daoFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Deployer Fee" value={config.silo0.deployerFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Hook Receiver" address={config.silo0.hookReceiver} explorerUrl={explorerUrl} indent={2} />
              <TreeNode label="Call Before Quote" value={config.silo0.callBeforeQuote} explorerUrl={explorerUrl} indent={2} />
            </TreeNode>
          </div>
          
          {/* Silo 1 */}
          <div className="mt-2">
            <TreeNode label="Silo 1" address={config.silo1.silo} explorerUrl={explorerUrl} indent={1}>
              <TreeNode label="Token" address={config.silo1.token} explorerUrl={explorerUrl} indent={2} />
              
              <TreeNode label="Share Tokens" explorerUrl={explorerUrl} indent={2}>
                <TreeNode label="Protected Share Token" address={config.silo1.protectedShareToken} explorerUrl={explorerUrl} indent={3} />
                <TreeNode label="Collateral Share Token" address={config.silo1.collateralShareToken} explorerUrl={explorerUrl} indent={3} />
                <TreeNode label="Debt Share Token" address={config.silo1.debtShareToken} explorerUrl={explorerUrl} indent={3} />
              </TreeNode>
              
              <TreeNode label="Solvency Oracle" address={config.silo1.solvencyOracle.address} explorerUrl={explorerUrl} indent={2}>
                {config.silo1.solvencyOracle.type && (
                  <TreeNode label="Type" value={config.silo1.solvencyOracle.type} explorerUrl={explorerUrl} indent={3} />
                )}
                {config.silo1.solvencyOracle.config && Object.entries(config.silo1.solvencyOracle.config).map(([key, val]) => (
                  <TreeNode 
                    key={key} 
                    label={key} 
                    value={typeof val === 'string' ? val : String(val)} 
                    address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                    explorerUrl={explorerUrl} 
                    indent={3} 
                  />
                ))}
              </TreeNode>
              
              <TreeNode label="Max LTV Oracle" address={config.silo1.maxLtvOracle.address} explorerUrl={explorerUrl} indent={2}>
                {config.silo1.maxLtvOracle.type && (
                  <TreeNode label="Type" value={config.silo1.maxLtvOracle.type} explorerUrl={explorerUrl} indent={3} />
                )}
                {config.silo1.maxLtvOracle.config && Object.entries(config.silo1.maxLtvOracle.config).map(([key, val]) => (
                  <TreeNode 
                    key={key} 
                    label={key} 
                    value={typeof val === 'string' ? val : String(val)} 
                    address={typeof val === 'string' && val.startsWith('0x') ? val : undefined}
                    explorerUrl={explorerUrl} 
                    indent={3} 
                  />
                ))}
              </TreeNode>
              
              <TreeNode label="Interest Rate Model" address={config.silo1.interestRateModel.address} explorerUrl={explorerUrl} indent={2}>
                {config.silo1.interestRateModel.type && (
                  <TreeNode label="Type" value={config.silo1.interestRateModel.type} explorerUrl={explorerUrl} indent={3} />
                )}
                {config.silo1.interestRateModel.config && Object.entries(config.silo1.interestRateModel.config).map(([key, val]) => (
                  <TreeNode 
                    key={key} 
                    label={key} 
                    value={typeof val === 'string' ? val : String(val)} 
                    explorerUrl={explorerUrl} 
                    indent={3} 
                  />
                ))}
              </TreeNode>
              
              <TreeNode label="Max LTV" value={config.silo1.maxLtv} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Liquidation Threshold (LT)" value={config.silo1.lt} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Liquidation Target LTV" value={config.silo1.liquidationTargetLtv} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Liquidation Fee" value={config.silo1.liquidationFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Flashloan Fee" value={config.silo1.flashloanFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="DAO Fee" value={config.silo1.daoFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Deployer Fee" value={config.silo1.deployerFee} explorerUrl={explorerUrl} isPercentage indent={2} />
              <TreeNode label="Hook Receiver" address={config.silo1.hookReceiver} explorerUrl={explorerUrl} indent={2} />
              <TreeNode label="Call Before Quote" value={config.silo1.callBeforeQuote} explorerUrl={explorerUrl} indent={2} />
            </TreeNode>
          </div>
        </TreeNode>
      </div>
    </div>
  )
}
