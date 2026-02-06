'use client'

import React from 'react'
import { MarketConfig, formatPercentage, formatAddress, formatQuotePriceAs18Decimals, formatRate18AsPercent } from '@/utils/fetchMarketConfig'
import CopyButton from '@/components/CopyButton'
import { ethers } from 'ethers'

interface DAOFeeVerificationIconProps {
  onChainValue: bigint
  wizardValue: number
}

function DAOFeeVerificationIcon({ onChainValue, wizardValue }: DAOFeeVerificationIconProps) {
  // Convert wizard value (0-1, e.g., 0.05 for 5%) to 18 decimals format
  // Same conversion as in deployArgs.ts: to18Decimals(bp) = BigInt(Math.round(bp * 100)) * 10^14
  const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14
  const wizardValueIn18Decimals = BigInt(Math.round(wizardValue * 100)) * BP2DP_NORMALIZATION
  const isMatch = onChainValue === wizardValueIn18Decimals

  return (
    <div className="relative group inline-block">
      {isMatch ? (
        <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      {isMatch && (
        <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Value verified: on-chain value matches Wizard value
        </div>
      )}
      {!isMatch && (
        <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Check failed: expected on-chain value {onChainValue.toString()} vs Wizard value {wizardValueIn18Decimals.toString()}
        </div>
      )}
    </div>
  )
}

/** Format large numeric string as e-notation (e.g. scaleFactor 1000000000000000000 → 1e18). */
function formatFactorToE(value: string): string {
  const s = value.trim()
  if (!s || s === '0') return s
  try {
    const n = BigInt(s)
    if (n === BigInt(0)) return '0'
    const str = n.toString()
    if (str.length <= 4) return str
    const exp = str.length - 1
    if (str[0] === '1' && /^0*$/.test(str.slice(1))) return `1e${exp}`
    const frac = str.slice(1, 5).replace(/0+$/, '')
    const mantissa = frac ? `${str[0]}.${frac}` : str[0]
    return `${mantissa}e${exp}`
  } catch {
    return value
  }
}

function buildOracleBullets(
  quotePrice: string | undefined,
  quoteTokenSymbol: string | undefined,
  type: string | undefined,
  config: Record<string, unknown> | undefined
): string[] {
  const bullets: string[] = []
  if (quotePrice != null && quotePrice !== '') {
    const priceStr = formatQuotePriceAs18Decimals(quotePrice)
    const withSymbol = quoteTokenSymbol ? `${priceStr} ${quoteTokenSymbol}` : priceStr
    bullets.push(`Price (1 token): ${withSymbol}`)
  }
  if (type) {
    bullets.push(`Type: ${type}`)
  }
  if (config && typeof config === 'object') {
    for (const [key, val] of Object.entries(config)) {
      if (/quoteToken/i.test(key)) continue
      const raw = typeof val === 'string' ? val : String(val)
      const isFactor = /scaleFactor|factor/i.test(key)
      const isBaseDiscount = /baseDiscount/i.test(key)
      let display: string
      if (isBaseDiscount && /^\d+$/.test(raw)) {
        display = formatRate18AsPercent(raw)
      } else if (isFactor && /^\d+$/.test(raw)) {
        display = formatFactorToE(raw)
      } else {
        display = raw
      }
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
      if (raw.startsWith('0x') && raw.length === 42) {
        bullets.push(`${label}: ${formatAddress(raw)}`)
      } else {
        bullets.push(`${label}: ${display}`)
      }
    }
  }
  return bullets
}

interface SiloVerification {
  silo0: boolean | null
  silo1: boolean | null
  error: string | null
}

interface HookOwnerVerification {
  onChainOwner: string | null
  wizardOwner: string | null
  isInAddressesJson: boolean | null
}

interface MarketConfigTreeProps {
  config: MarketConfig
  explorerUrl: string
  wizardDaoFee?: number | null
  siloVerification?: SiloVerification
  hookOwnerVerification?: HookOwnerVerification
}

interface TokenMeta {
  symbol?: string
  decimals?: number
}

export interface OwnerBulletItem {
  address: string
  isContract?: boolean
  name?: string
}

interface TreeNodeProps {
  label: string
  value?: string | bigint | boolean | null
  address?: string
  tokenMeta?: TokenMeta
  suffixText?: string
  bulletItems?: string[]
  ownerBullets?: OwnerBulletItem[]
  children?: React.ReactNode
  explorerUrl: string
  isPercentage?: boolean
  valueMuted?: boolean
  verificationIcon?: React.ReactNode
  addressVerificationIcon?: React.ReactNode
  hookOwnerVerification?: HookOwnerVerification
}

function HookOwnerVerificationIcons({ verified, isInJson }: { verified: boolean | null; isInJson: boolean | null }) {
  return (
    <span className="inline-flex items-center gap-1">
      {verified === true && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Hook owner verified: matches Wizard value
          </div>
        </div>
      )}
      {isInJson === true && (
        <div className="relative group inline-block">
          <div className="w-4 h-4 bg-yellow-600 rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Address found in addresses JSON
          </div>
        </div>
      )}
    </span>
  )
}

function OwnerBulletContent({ item, explorerUrl, hookOwnerVerification }: { item: OwnerBulletItem; explorerUrl: string; hookOwnerVerification?: HookOwnerVerification }) {
  const { address, isContract, name } = item
  if (!address || address === ethers.ZeroAddress) return null
  
  const normalizedAddress = ethers.getAddress(address).toLowerCase()
  const isVerified = hookOwnerVerification && hookOwnerVerification.onChainOwner && hookOwnerVerification.wizardOwner
    ? ethers.getAddress(hookOwnerVerification.onChainOwner).toLowerCase() === normalizedAddress &&
      ethers.getAddress(hookOwnerVerification.wizardOwner).toLowerCase() === normalizedAddress
    : null
  
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="text-gray-400 text-sm">Owner:</span>
      <a
        href={`${explorerUrl}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 font-mono text-sm"
      >
        {formatAddress(address)}
      </a>
      <CopyButton value={address} title="Copy address" iconClassName="w-3.5 h-3.5 inline align-middle" />
      {isContract !== undefined && (
        <span className="text-gray-500 text-xs font-medium px-1.5 py-0.5 rounded bg-gray-800">
          {isContract ? 'Contract' : 'EOA'}
        </span>
      )}
      {name != null && name !== '' && (
        <span className="text-gray-400 text-sm">({name})</span>
      )}
      {hookOwnerVerification && (
        <HookOwnerVerificationIcons 
          verified={isVerified} 
          isInJson={hookOwnerVerification.isInAddressesJson}
        />
      )}
    </span>
  )
}

function TreeNode({ label, value, address, tokenMeta, suffixText, bulletItems, ownerBullets, children, explorerUrl, isPercentage, valueMuted, verificationIcon, addressVerificationIcon, hookOwnerVerification }: TreeNodeProps & { hookOwnerVerification?: HookOwnerVerification }) {
  const hasAddress = address && address !== ethers.ZeroAddress
  const hasValue = value !== undefined && value !== null && !hasAddress
  const hasTokenMeta = tokenMeta && (tokenMeta.symbol != null || tokenMeta.decimals != null)
  const hasSuffix = suffixText != null && suffixText !== ''

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
            {addressVerificationIcon && <span className="ml-1">{addressVerificationIcon}</span>}
            {hasTokenMeta && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({[tokenMeta.symbol, tokenMeta.decimals != null ? `${tokenMeta.decimals} decimals` : ''].filter(Boolean).join(', ')})
              </span>
            )}
            {hasSuffix && (
              <span className="text-gray-400 text-sm ml-1">
                {' '}
                ({suffixText})
              </span>
            )}
          </>
        )}
        {hasValue && (
          <span className={`${valueMuted ? 'text-gray-400 text-sm' : 'text-white text-sm font-mono'} inline-flex items-center gap-1.5`}>
            {typeof value === 'boolean'
              ? (value ? 'Yes' : 'No')
              : isPercentage && typeof value === 'bigint'
                ? formatPercentage(value)
                : typeof value === 'bigint'
                  ? value.toString()
                  : String(value)}
            {verificationIcon && verificationIcon}
          </span>
        )}
        {address === ethers.ZeroAddress && (
          <span className="text-gray-500 text-sm italic">Zero Address</span>
        )}
      </span>
      {bulletItems && bulletItems.length > 0 && (
        <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {bulletItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {ownerBullets && ownerBullets.length > 0 && (
        <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 text-sm">
          {ownerBullets.map((item, i) => (
            <li key={i}>
              <OwnerBulletContent item={item} explorerUrl={explorerUrl} hookOwnerVerification={hookOwnerVerification} />
            </li>
          ))}
        </ul>
      )}
      {children && <ol className="tree">{children}</ol>}
    </li>
  )
}

function SiloVerificationIcon({ verified }: { verified: boolean | null }) {
  if (verified === null) return null

  return (
    <div className="relative group inline-block">
      {verified ? (
        <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      {verified && (
        <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Silo address verified and exists in Silo Factory
        </div>
      )}
    </div>
  )
}

export default function MarketConfigTree({ config, explorerUrl, wizardDaoFee, siloVerification, hookOwnerVerification }: MarketConfigTreeProps) {
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
              <TreeNode 
                label="silo0" 
                address={config.silo0.silo} 
                explorerUrl={explorerUrl}
                addressVerificationIcon={siloVerification ? <SiloVerificationIcon verified={siloVerification.silo0} /> : undefined}
              />
              <TreeNode 
                label="silo1" 
                address={config.silo1.silo} 
                explorerUrl={explorerUrl}
                addressVerificationIcon={siloVerification ? <SiloVerificationIcon verified={siloVerification.silo1} /> : undefined}
              />
            </TreeNode>
          </TreeNode>
          <TreeNode 
            label="DAO Fee" 
            value={config.silo0.daoFee} 
            explorerUrl={explorerUrl} 
            isPercentage 
            verificationIcon={wizardDaoFee != null ? <DAOFeeVerificationIcon onChainValue={config.silo0.daoFee} wizardValue={wizardDaoFee} /> : undefined}
          />
          <TreeNode label="Deployer Fee" value={config.silo0.deployerFee} explorerUrl={explorerUrl} isPercentage />
          <TreeNode
            label="Hook Receiver"
            address={config.silo0.hookReceiver}
            suffixText={config.silo0.hookReceiverVersion}
            ownerBullets={config.silo0.hookReceiverOwner ? [{ address: config.silo0.hookReceiverOwner, isContract: config.silo0.hookReceiverOwnerIsContract, name: config.silo0.hookReceiverOwnerName }] : undefined}
            explorerUrl={explorerUrl}
            hookOwnerVerification={hookOwnerVerification}
          />
        </TreeNode>

        <TreeNode label="Silo 0" address={config.silo0.silo} explorerUrl={explorerUrl}>
          <TreeNode label="Token" address={config.silo0.token} tokenMeta={{ symbol: config.silo0.tokenSymbol, decimals: config.silo0.tokenDecimals }} explorerUrl={explorerUrl} />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo0.protectedShareToken} tokenMeta={{ symbol: config.silo0.protectedShareTokenSymbol, decimals: config.silo0.protectedShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Collateral Share Token" address={config.silo0.collateralShareToken} tokenMeta={{ symbol: config.silo0.collateralShareTokenSymbol, decimals: config.silo0.collateralShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Debt Share Token" address={config.silo0.debtShareToken} tokenMeta={{ symbol: config.silo0.debtShareTokenSymbol, decimals: config.silo0.debtShareTokenDecimals }} explorerUrl={explorerUrl} />
          </TreeNode>
          <TreeNode
            label="Solvency Oracle"
            address={config.silo0.solvencyOracle.address}
            suffixText={config.silo0.solvencyOracle.version}
            bulletItems={buildOracleBullets(config.silo0.solvencyOracle.quotePrice, config.silo0.solvencyOracle.quoteTokenSymbol, config.silo0.solvencyOracle.type, config.silo0.solvencyOracle.config as Record<string, unknown> | undefined)}
            explorerUrl={explorerUrl}
          />
          {!config.silo0.maxLtvOracle.address || config.silo0.maxLtvOracle.address === ethers.ZeroAddress ? (
            <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} />
          ) : config.silo0.maxLtvOracle.address.toLowerCase() === config.silo0.solvencyOracle.address.toLowerCase() ? (
            <TreeNode label="Max LTV Oracle" value="Same as Solvency Oracle" explorerUrl={explorerUrl} valueMuted />
          ) : (
            <TreeNode
              label="Max LTV Oracle"
              address={config.silo0.maxLtvOracle.address}
              suffixText={config.silo0.maxLtvOracle.version}
              bulletItems={buildOracleBullets(config.silo0.maxLtvOracle.quotePrice, config.silo0.maxLtvOracle.quoteTokenSymbol, config.silo0.maxLtvOracle.type, config.silo0.maxLtvOracle.config as Record<string, unknown> | undefined)}
              explorerUrl={explorerUrl}
            />
          )}
          <TreeNode
            label="Interest Rate Model"
            address={config.silo0.interestRateModel.address}
            suffixText={config.silo0.interestRateModel.version}
            ownerBullets={config.silo0.interestRateModel.owner ? [{ address: config.silo0.interestRateModel.owner, isContract: config.silo0.interestRateModel.ownerIsContract, name: config.silo0.interestRateModel.ownerName }] : undefined}
            explorerUrl={explorerUrl}
          >
            {config.silo0.interestRateModel.type && (
              <TreeNode label="Type" value={config.silo0.interestRateModel.type} explorerUrl={explorerUrl} valueMuted />
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
          <TreeNode label="Call Before Quote" value={config.silo0.callBeforeQuote} explorerUrl={explorerUrl} />
        </TreeNode>

        <TreeNode label="Silo 1" address={config.silo1.silo} explorerUrl={explorerUrl}>
          <TreeNode label="Token" address={config.silo1.token} tokenMeta={{ symbol: config.silo1.tokenSymbol, decimals: config.silo1.tokenDecimals }} explorerUrl={explorerUrl} />
          <TreeNode label="Share Tokens" explorerUrl={explorerUrl}>
            <TreeNode label="Protected Share Token" address={config.silo1.protectedShareToken} tokenMeta={{ symbol: config.silo1.protectedShareTokenSymbol, decimals: config.silo1.protectedShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Collateral Share Token" address={config.silo1.collateralShareToken} tokenMeta={{ symbol: config.silo1.collateralShareTokenSymbol, decimals: config.silo1.collateralShareTokenDecimals }} explorerUrl={explorerUrl} />
            <TreeNode label="Debt Share Token" address={config.silo1.debtShareToken} tokenMeta={{ symbol: config.silo1.debtShareTokenSymbol, decimals: config.silo1.debtShareTokenDecimals }} explorerUrl={explorerUrl} />
          </TreeNode>
          <TreeNode
            label="Solvency Oracle"
            address={config.silo1.solvencyOracle.address}
            suffixText={config.silo1.solvencyOracle.version}
            bulletItems={buildOracleBullets(config.silo1.solvencyOracle.quotePrice, config.silo1.solvencyOracle.quoteTokenSymbol, config.silo1.solvencyOracle.type, config.silo1.solvencyOracle.config as Record<string, unknown> | undefined)}
            explorerUrl={explorerUrl}
          />
          {!config.silo1.maxLtvOracle.address || config.silo1.maxLtvOracle.address === ethers.ZeroAddress ? (
            <TreeNode label="Max LTV Oracle" address={ethers.ZeroAddress} explorerUrl={explorerUrl} />
          ) : config.silo1.maxLtvOracle.address.toLowerCase() === config.silo1.solvencyOracle.address.toLowerCase() ? (
            <TreeNode label="Max LTV Oracle" value="Same as Solvency Oracle" explorerUrl={explorerUrl} valueMuted />
          ) : (
            <TreeNode
              label="Max LTV Oracle"
              address={config.silo1.maxLtvOracle.address}
              suffixText={config.silo1.maxLtvOracle.version}
              bulletItems={buildOracleBullets(config.silo1.maxLtvOracle.quotePrice, config.silo1.maxLtvOracle.quoteTokenSymbol, config.silo1.maxLtvOracle.type, config.silo1.maxLtvOracle.config as Record<string, unknown> | undefined)}
              explorerUrl={explorerUrl}
            />
          )}
          <TreeNode
            label="Interest Rate Model"
            address={config.silo1.interestRateModel.address}
            suffixText={config.silo1.interestRateModel.version}
            ownerBullets={config.silo1.interestRateModel.owner ? [{ address: config.silo1.interestRateModel.owner, isContract: config.silo1.interestRateModel.ownerIsContract, name: config.silo1.interestRateModel.ownerName }] : undefined}
            explorerUrl={explorerUrl}
          >
            {config.silo1.interestRateModel.type && (
              <TreeNode label="Type" value={config.silo1.interestRateModel.type} explorerUrl={explorerUrl} valueMuted />
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
          <TreeNode label="Call Before Quote" value={config.silo1.callBeforeQuote} explorerUrl={explorerUrl} />
        </TreeNode>
      </ol>
    </div>
  )
}
