'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import {
  useWizard,
  OracleConfiguration,
  ScalerOracle,
  ChainlinkOracleConfig,
  PTLinearOracleConfig,
  VaultOracleConfig,
  CustomMethodOracleConfig
} from '@/contexts/WizardContext'
import { getChainName, getExplorerAddressUrl } from '@/utils/networks'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { resolveSymbolToAddress } from '@/utils/symbolToAddress'
import oracleScalerArtifact from '@/abis/oracle/OracleScaler.json'
import aggregatorV3Artifact from '@/abis/oracle/AggregatorV3Interface.json'
import iERC4526Artifact from '@/abis/IERC4526.json'
import iERC20Artifact from '@/abis/IERC20.json'
import TokenAddressInput from '@/components/TokenAddressInput'
import ContractInfo from '@/components/ContractInfo'
import AddressDisplayShort from '@/components/AddressDisplayShort'
import PredefinedOptionButton from '@/components/PredefinedOptionButton'
import { extractHexAddressLike } from '@/utils/addressFromInput'

/** Foundry artifact: ABI under "abi" key – use as-is, never modify */
const oracleScalerAbi = (oracleScalerArtifact as { abi: ethers.InterfaceAbi }).abi
const aggregatorV3Abi = (aggregatorV3Artifact as { abi: ethers.InterfaceAbi }).abi
const ierc4526Abi = iERC4526Artifact as ethers.InterfaceAbi
const ierc20Abi = (iERC20Artifact as { abi: ethers.InterfaceAbi }).abi


interface OracleDeployments {
  [chainName: string]: {
    [oracleName: string]: string
  }
}

// Helper function to format scale factor in scientific notation
const formatScaleFactor = (scaleFactor: bigint): string => {
  const factor = Number(scaleFactor)
  if (factor === 0) return '0'
  if (factor === 1) return '1'
  
  // Convert to scientific notation
  const scientific = factor.toExponential()
  
  // Remove unnecessary decimal places and trailing zeros
  const [mantissa, exponent] = scientific.split('e')
  const cleanMantissa = parseFloat(mantissa).toString()
  
  return `${cleanMantissa}e${exponent}`
}

/** Format 10^n as 1e{n} for display; raw number for small n. */
function formatPowerOfTen(value: string): string {
  if (value === '0') return '0'
  const n = BigInt(value)
  const zero = BigInt(0)
  const one = BigInt(1)
  const ten = BigInt(10)
  if (n <= zero) return value
  let exponent = 0
  let x = n
  while (x % ten === zero && x > zero) {
    exponent++
    x /= ten
  }
  if (x === one) return exponent <= 3 ? value : `1e${exponent}`
  return value
}

interface ChainlinkOracleSectionProps {
  baseTokenSymbol: string
  baseTokenName: string
  otherTokenAddress?: string
  chainlink: Partial<ChainlinkOracleConfig> & {
    primaryAggregatorDecimals?: number
    mathLineMultiplier?: string
    mathLineDivider?: string
    aggregatorDescription?: string
    aggregatorLatestAnswer?: string
  }
  setChainlink: React.Dispatch<React.SetStateAction<Partial<ChainlinkOracleConfig> & {
    primaryAggregatorDecimals?: number
    mathLineMultiplier?: string
    mathLineDivider?: string
    aggregatorDescription?: string
    aggregatorLatestAnswer?: string
  }>>
  quoteInput: string
  setQuoteInput: (value: string) => void
  useSecondaryAggregator: boolean
  setUseSecondaryAggregator: (value: boolean) => void
  virtualTokenOptions: VirtualTokenOption[]
  usdcAddress: string | null
  chainlinkV3OracleFactory: { address: string; version: string } | null
  networkChainId?: string
  idSuffix: string
}

const CHAINLINK_AGGREGATOR_KEY_DEFAULT = 'CHAINLINK_USDC_USD_aggregator'
const CHAINLINK_AGGREGATOR_KEY_SONIC = 'CHAINLINK_USDC.e_USD_aggregator'
const VIRTUAL_TOKEN_KEYS = ['SILO_VIRTUAL_BTC', 'SILO_VIRTUAL_EUR', 'SILO_VIRTUAL_USD'] as const

type VirtualTokenKey = (typeof VIRTUAL_TOKEN_KEYS)[number]
type VirtualTokenOption = {
  key: VirtualTokenKey
  label: string
  address: string
}

const VIRTUAL_TOKEN_LABELS: Record<VirtualTokenKey, string> = {
  SILO_VIRTUAL_BTC: 'virtual BTC',
  SILO_VIRTUAL_USD: 'virtual USD',
  SILO_VIRTUAL_EUR: 'virtual EUR'
}

interface VaultOracleSectionProps {
  /** Token this oracle is for (for display). */
  baseTokenSymbol: string
  baseTokenName: string
  /** The other market token's address – vault asset must match this. */
  otherTokenAddress?: string
  otherTokenSymbol?: string
  vault: Partial<VaultOracleConfig> & {
    vaultSymbol?: string
    vaultAssetAddress?: string
    vaultAssetSymbol?: string
    assetMatchesBase?: boolean
  }
  setVault: React.Dispatch<
    React.SetStateAction<
      Partial<VaultOracleConfig> & {
        vaultSymbol?: string
        vaultAssetAddress?: string
        vaultAssetSymbol?: string
        assetMatchesBase?: boolean
      }
    >
  >
  quoteInput: string
  setQuoteInput: (value: string) => void
  virtualTokenOptions: VirtualTokenOption[]
  usdcAddress: string | null
  networkChainId?: string
  vaultFactory: { address: string; version: string } | null
  onValidationChange: (valid: boolean) => void
}

function ChainlinkOracleSection({
  baseTokenSymbol,
  baseTokenName,
  baseTokenDecimals,
  otherTokenAddress,
  chainlink,
  setChainlink,
  quoteInput,
  setQuoteInput,
  useSecondaryAggregator,
  setUseSecondaryAggregator,
  virtualTokenOptions,
  usdcAddress,
  networkChainId,
  idSuffix
}: ChainlinkOracleSectionProps & { baseTokenDecimals?: number }) {
  const [aggregatorPresetLoading, setAggregatorPresetLoading] = useState(false)

  const handleUsdcUsdAggregator = async () => {
    if (!networkChainId) return
    setAggregatorPresetLoading(true)
    try {
      const key = getChainName(networkChainId) === 'sonic' ? CHAINLINK_AGGREGATOR_KEY_SONIC : CHAINLINK_AGGREGATOR_KEY_DEFAULT
      const res = await resolveSymbolToAddress(networkChainId, key)
      if (res?.address) {
        setChainlink(prev => ({ ...prev, primaryAggregator: res.address }))
      }
    } finally {
      setAggregatorPresetLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Base token: <span className="text-white font-medium">{baseTokenSymbol}</span> <span className="text-gray-500">({baseTokenName})</span>
      </p>
      {typeof baseTokenDecimals === 'number' && (
        <p className="text-sm text-gray-400 mb-2">
          Token decimals: {baseTokenDecimals}
        </p>
      )}
      {/* Primary aggregator */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">Primary aggregator</h4>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Primary aggregator address *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            <PredefinedOptionButton
              disabled={!networkChainId || aggregatorPresetLoading}
              loading={aggregatorPresetLoading}
              onClick={handleUsdcUsdAggregator}
            >
              <span>USDC/USD</span>
            </PredefinedOptionButton>
          </div>
          <input
            type="text"
            value={chainlink.primaryAggregator}
            onChange={(e) => setChainlink(prev => ({ ...prev, primaryAggregator: extractHexAddressLike(e.target.value) }))}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
          />
          {(chainlink.aggregatorDescription != null || chainlink.aggregatorLatestAnswer != null || chainlink.primaryAggregatorDecimals != null) && (
            <div className="mt-2 p-3 bg-gray-800/80 border border-gray-700 rounded-lg text-sm space-y-1">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Aggregator verification</p>
              {chainlink.primaryAggregator?.trim() && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500">Address:</span>
                  <AddressDisplayShort
                    address={chainlink.primaryAggregator}
                    chainId={networkChainId ? parseInt(networkChainId, 10) : undefined}
                    className="text-sm"
                    showVersion={false}
                  />
                </div>
              )}
              {chainlink.aggregatorDescription != null && (
                <p><span className="text-gray-500">Description:</span> <span className="text-gray-300">{chainlink.aggregatorDescription || '—'}</span></p>
              )}
              {chainlink.primaryAggregatorDecimals != null && (
                <p><span className="text-gray-500">Decimals:</span> <span className="text-gray-300">{chainlink.primaryAggregatorDecimals}</span></p>
              )}
              {chainlink.aggregatorLatestAnswer != null && (
                <p><span className="text-gray-500">Latest price (with decimals):</span> <span className="text-gray-300 font-mono">{chainlink.aggregatorLatestAnswer}</span></p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quote token */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">
          Quote token
        </h4>
        <div className="flex flex-wrap gap-2">
          <PredefinedOptionButton
            onClick={() => {
              const addr = otherTokenAddress || ''
              setQuoteInput(addr)
              setChainlink(prev => ({ ...prev, useOtherTokenAsQuote: true, customQuoteTokenAddress: addr }))
            }}
          >
            <span>Other token</span>
          </PredefinedOptionButton>
          {usdcAddress && (
            <PredefinedOptionButton
              onClick={() => {
                setQuoteInput('USDC')
                setChainlink(prev => ({ ...prev, useOtherTokenAsQuote: false }))
              }}
            >
              <span>USDC</span>
            </PredefinedOptionButton>
          )}
          {virtualTokenOptions.map((virtualToken) => (
            <PredefinedOptionButton
              key={virtualToken.key}
              onClick={() => {
                setQuoteInput(virtualToken.key)
                setChainlink(prev => ({ ...prev, useOtherTokenAsQuote: false }))
              }}
            >
              <span>{virtualToken.label}</span>
            </PredefinedOptionButton>
          ))}
        </div>
        <TokenAddressInput
          value={quoteInput}
          onChange={(value) => {
            setQuoteInput(value)
            setChainlink(prev => ({ ...prev, useOtherTokenAsQuote: false }))
          }}
          onResolve={(address, metadata) => {
            if (metadata && address) {
              setChainlink(prev => ({
                ...prev,
                useOtherTokenAsQuote: false,
                customQuoteTokenAddress: address,
                customQuoteTokenMetadata: { symbol: metadata.symbol, decimals: metadata.decimals }
              }))
            } else {
              setChainlink(prev => ({ ...prev, customQuoteTokenAddress: '', customQuoteTokenMetadata: undefined }))
            }
          }}
          chainId={networkChainId}
          label="Quote token address or symbol"
          placeholder="0x… or symbol from addresses JSON"
        />
      </div>

      {/* Secondary aggregator */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <input
            type="checkbox"
            id={`useSecondary-${idSuffix}`}
            checked={useSecondaryAggregator}
            onChange={(e) => {
              const checked = e.target.checked
              setUseSecondaryAggregator(checked)
              if (!checked) setChainlink(prev => ({ ...prev, secondaryAggregator: '', invertSecondPrice: false }))
            }}
            className="rounded"
          />
          <label htmlFor={`useSecondary-${idSuffix}`} className="text-sm font-medium text-gray-300">Secondary aggregator (optional)</label>
        </div>
        {useSecondaryAggregator && (
          <input
            type="text"
            value={chainlink.secondaryAggregator}
            onChange={(e) => setChainlink(prev => ({ ...prev, secondaryAggregator: extractHexAddressLike(e.target.value) }))}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
          />
        )}
      </div>
      {useSecondaryAggregator && chainlink.secondaryAggregator?.trim() && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`invert-${idSuffix}`}
            checked={chainlink.invertSecondPrice}
            onChange={(e) => setChainlink(prev => ({ ...prev, invertSecondPrice: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor={`invert-${idSuffix}`} className="text-sm text-gray-300">Invert second price</label>
        </div>
      )}
      {(chainlink.normalizationDivider !== '0' || chainlink.normalizationMultiplier !== '0') && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
          <div className={chainlink.normalizationMultiplier === '0' ? 'opacity-60' : ''}>
            <p className={`text-sm font-medium text-gray-300 mb-0.5 ${chainlink.normalizationMultiplier === '0' ? 'line-through' : ''}`}>normalizationMultiplier</p>
            <p className="text-sm text-white font-mono">{formatPowerOfTen(chainlink.normalizationMultiplier ?? '0')}</p>
            {chainlink.normalizationMultiplier !== '0' && chainlink.mathLineMultiplier && (
              <p className="text-xs text-gray-400 mt-1 font-mono">{chainlink.mathLineMultiplier}</p>
            )}
          </div>
          <div className={chainlink.normalizationDivider === '0' ? 'opacity-60' : ''}>
            <p className={`text-sm font-medium text-gray-300 mb-0.5 ${chainlink.normalizationDivider === '0' ? 'line-through' : ''}`}>normalizationDivider</p>
            <p className="text-sm text-white font-mono">{formatPowerOfTen(chainlink.normalizationDivider ?? '0')}</p>
            {chainlink.normalizationDivider !== '0' && chainlink.mathLineDivider && (
              <p className="text-xs text-gray-400 mt-1 font-mono">{chainlink.mathLineDivider}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function VaultOracleSection({
  baseTokenSymbol,
  baseTokenName,
  otherTokenAddress,
  otherTokenSymbol,
  vault,
  setVault,
  quoteInput,
  setQuoteInput,
  virtualTokenOptions,
  usdcAddress,
  networkChainId,
  vaultFactory,
  onValidationChange
}: VaultOracleSectionProps) {
  const [vaultInput, setVaultInput] = useState(vault.vaultAddress ?? '')
  const [loadingVault, setLoadingVault] = useState(false)
  const [loadingAsset, setLoadingAsset] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    onValidationChange(
      !!vault.vaultAddress && ethers.isAddress(vault.vaultAddress)
    )
  }, [vault.vaultAddress, onValidationChange])

  const resolveVault = async (address: string) => {
    if (!address || !ethers.isAddress(address) || !window.ethereum) {
      setVault(prev => ({
        ...prev,
        vaultAddress: '',
        vaultSymbol: undefined,
        vaultAssetAddress: undefined,
        vaultAssetSymbol: undefined,
        assetMatchesBase: undefined
      }))
      setLocalError(null)
      return
    }
    setLoadingVault(true)
    setLoadingAsset(true)
    setLocalError(null)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const vaultContract = new ethers.Contract(address, ierc4526Abi, provider)
      const [symbol, assetAddress] = await Promise.all([
        vaultContract.symbol(),
        vaultContract.asset()
      ])
      const assetAddr = ethers.getAddress(assetAddress)
      setVault(prev => ({
        ...prev,
        vaultAddress: ethers.getAddress(address),
        vaultSymbol: String(symbol ?? ''),
        vaultAssetAddress: assetAddr
      }))
      const erc20 = new ethers.Contract(assetAddr, ierc20Abi, provider)
      const [assetSymbol] = await Promise.all([erc20.symbol()])
      const assetNorm = assetAddr.toLowerCase()
      let otherNorm = ''
      if (otherTokenAddress != null && otherTokenAddress.trim() !== '') {
        try {
          otherNorm = ethers.getAddress(otherTokenAddress.trim()).toLowerCase()
        } catch {
          otherNorm = otherTokenAddress.trim().toLowerCase()
        }
      }
      const matchesOtherToken = otherNorm !== '' && assetNorm === otherNorm
      setVault(prev => ({
        ...prev,
        vaultAssetSymbol: String(assetSymbol ?? ''),
        assetMatchesBase: matchesOtherToken
      }))
      if (otherNorm === '') {
        setLocalError('Other token address is missing. Vault asset must match the other market token.')
      } else {
        setLocalError(null)
      }
    } catch (err) {
      console.warn('Failed to resolve ERC4626 vault metadata:', err)
      setVault(prev => ({
        ...prev,
        vaultSymbol: undefined,
        vaultAssetAddress: undefined,
        vaultAssetSymbol: undefined,
        assetMatchesBase: undefined
      }))
      setLocalError('Failed to load vault metadata. Check address and network.')
    } finally {
      setLoadingVault(false)
      setLoadingAsset(false)
    }
  }

  const vaultAssetSymLabel = vault.vaultAssetSymbol ?? '?'
  const otherMarketSymLabel = otherTokenSymbol ?? '?'

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400 mb-2">
        Base token:{' '}
        <span className="text-white font-medium">{baseTokenSymbol}</span>{' '}
        <span className="text-gray-500">({baseTokenName})</span>
      </p>

      {/* Factory info */}
      {vaultFactory ? (
        <ContractInfo
          contractName="ERC4626OracleHardcodeQuoteFactory"
          address={vaultFactory.address}
          version={vaultFactory.version || '…'}
          chainId={networkChainId}
          isOracle={true}
        />
      ) : (
        <p className="text-sm text-yellow-400">Loading ERC4626OracleHardcodeQuoteFactory for this chain…</p>
      )}

      {/* Vault address */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Vault address (ERC4626) *
        </label>
        <input
          type="text"
          value={vaultInput}
          onChange={e => {
            const v = e.target.value.trim()
            setVaultInput(v)
          }}
          onBlur={() => resolveVault(vaultInput)}
          placeholder="0x…"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
        />
      </div>

      {/* Vault metadata */}
      {(vault.vaultSymbol || vault.vaultAssetAddress) && (
        <div className="mt-2 p-3 bg-gray-800/80 border border-gray-700 rounded-lg text-sm space-y-1">
          <p className="text-gray-500 text-xs uppercase tracking-wide">
            Vault metadata
          </p>
          {vault.vaultSymbol && (
            <p>
              <span className="text-gray-500">Vault symbol:</span>{' '}
              <span className="text-gray-300">{vault.vaultSymbol}</span>
            </p>
          )}
          {vault.vaultAssetAddress && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500">Asset address:</span>
              <AddressDisplayShort
                address={vault.vaultAssetAddress}
                chainId={networkChainId ? parseInt(networkChainId, 10) : undefined}
                className="text-sm"
                showVersion={false}
              />
            </div>
          )}
          {vault.vaultAssetSymbol && (
            <p>
              <span className="text-gray-500">Asset symbol:</span>{' '}
              <span className="text-gray-300">{vault.vaultAssetSymbol}</span>
            </p>
          )}
          {vault.assetMatchesBase === true && (
            <p className="text-xs status-muted-success flex items-center gap-1">
              <span>✓</span>
              <span>
                Vault asset matches the other token{otherTokenSymbol ? ` (${otherTokenSymbol})` : ''}
              </span>
            </p>
          )}
          {vault.assetMatchesBase === false && (
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <span>⚠</span>
              <span>
                Vault asset does not match the other token. Symbol differs: vault asset is &quot;{vaultAssetSymLabel}&quot;, other token is &quot;{otherMarketSymLabel}&quot;. The vault&apos;s underlying asset should normally be the other market token. If you deliberately peg &quot;{vaultAssetSymLabel}&quot; to &quot;{otherMarketSymLabel}&quot; 1:1 (same economic exposure), that is fine.
              </span>
            </p>
          )}
        </div>
      )}

      {/* Quote token – copy Chainlink pattern */}
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">
          Quote token
        </h4>
        <div className="flex flex-wrap gap-2">
          <PredefinedOptionButton
            onClick={() => {
              const addr = otherTokenAddress || ''
              setQuoteInput(addr)
              setVault(prev => ({
                ...prev,
                useOtherTokenAsQuote: true,
                customQuoteTokenAddress: addr
              }))
            }}
          >
            <span>Other token</span>
          </PredefinedOptionButton>
          {usdcAddress && (
            <PredefinedOptionButton
              onClick={() => {
                setQuoteInput('USDC')
                setVault(prev => ({ ...prev, useOtherTokenAsQuote: false }))
              }}
            >
              <span>USDC</span>
            </PredefinedOptionButton>
          )}
          {virtualTokenOptions.map((virtualToken) => (
            <PredefinedOptionButton
              key={virtualToken.key}
              onClick={() => {
                setQuoteInput(virtualToken.key)
                setVault(prev => ({ ...prev, useOtherTokenAsQuote: false }))
              }}
            >
              <span>{virtualToken.label}</span>
            </PredefinedOptionButton>
          ))}
        </div>
        <TokenAddressInput
          value={quoteInput}
          onChange={value => {
            setQuoteInput(value)
            setVault(prev => ({ ...prev, useOtherTokenAsQuote: false }))
          }}
          onResolve={(address, metadata) => {
            if (metadata && address) {
              setVault(prev => ({
                ...prev,
                useOtherTokenAsQuote: false,
                customQuoteTokenAddress: address,
                customQuoteTokenMetadata: {
                  symbol: metadata.symbol,
                  decimals: metadata.decimals
                }
              }))
            } else {
              setVault(prev => ({
                ...prev,
                customQuoteTokenAddress: '',
                customQuoteTokenMetadata: undefined
              }))
            }
          }}
          chainId={networkChainId}
          label="Quote token address or symbol"
          placeholder="0x… or symbol from addresses JSON"
        />
      </div>

      {(loadingVault || loadingAsset) && (
        <p className="text-xs text-gray-400">Loading vault metadata…</p>
      )}
      {localError && (
        <p className="text-xs text-red-400">
          {localError}
        </p>
      )}
    </div>
  )
}

function ensureNoArgsMethodSignature(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.includes('(')) {
    const openIdx = trimmed.indexOf('(')
    const closeIdx = trimmed.lastIndexOf(')')
    const methodName = openIdx > 0 ? trimmed.slice(0, openIdx).trim() : ''
    if (methodName === '') return trimmed
    if (closeIdx > openIdx) {
      const args = trimmed.slice(openIdx + 1, closeIdx).trim()
      return `${methodName}(${args})`
    }
    return `${methodName}(`
  }
  return `${trimmed}()`
}

function parseNoArgSignature(methodInput: string): { signature: string; error?: string } {
  const signature = ensureNoArgsMethodSignature(methodInput)
  if (!signature) return { signature: '', error: 'Method name is required.' }
  const openIdx = signature.indexOf('(')
  const closeIdx = signature.indexOf(')')
  if (openIdx < 1 || closeIdx < openIdx || closeIdx !== signature.length - 1) {
    return { signature, error: 'Method signature must be in format methodName() with no parameters.' }
  }
  const argsPart = signature.slice(openIdx + 1, closeIdx).trim()
  if (argsPart.length > 0) {
    return { signature, error: 'Only no-argument methods are supported (use methodName()).' }
  }
  return { signature }
}

function signatureToSelector(signature: string): string {
  return ethers.id(signature).slice(0, 10)
}

interface CustomMethodOracleSectionProps {
  baseTokenSymbol: string
  baseTokenName: string
  otherTokenAddress?: string
  otherTokenSymbol?: string
  otherTokenName?: string
  otherTokenDecimals?: number
  config: Partial<CustomMethodOracleConfig> & {
    methodInput?: string
    fetchedRawPrice?: string
    formattedPrice?: string
    fetchError?: string
  }
  setConfig: React.Dispatch<
    React.SetStateAction<
      Partial<CustomMethodOracleConfig> & {
        methodInput?: string
        fetchedRawPrice?: string
        formattedPrice?: string
        fetchError?: string
      }
    >
  >
  quoteInput: string
  setQuoteInput: (value: string) => void
  virtualTokenOptions: VirtualTokenOption[]
  usdcAddress: string | null
  networkChainId?: string
  customMethodFactory: { address: string; version: string } | null
  customMethodFactoryMissing: string | null
  customMethodImplementationAddress: string | null
  customMethodImplementationVersion: string | null
  customMethodImplementationError: string | null
}

function CustomMethodOracleSection({
  baseTokenSymbol,
  baseTokenName,
  otherTokenAddress,
  otherTokenSymbol,
  otherTokenName,
  otherTokenDecimals,
  config,
  setConfig,
  quoteInput,
  setQuoteInput,
  virtualTokenOptions,
  usdcAddress,
  networkChainId,
  customMethodFactory,
  customMethodFactoryMissing,
  customMethodImplementationAddress,
  customMethodImplementationVersion,
  customMethodImplementationError
}: CustomMethodOracleSectionProps) {
  const [testingPrice, setTestingPrice] = useState(false)
  const autoFetchKeyRef = useRef<string>('')

  const refreshFormattedPrice = (rawPrice?: string, decimals?: number) => {
    if (!rawPrice || decimals == null) return ''
    try {
      return ethers.formatUnits(BigInt(rawPrice), decimals)
    } catch {
      return ''
    }
  }

  const quoteInitialMetadata =
    config.useOtherTokenAsQuote !== false && otherTokenSymbol && typeof otherTokenDecimals === 'number'
      ? {
          symbol: otherTokenSymbol,
          decimals: otherTokenDecimals,
          name: otherTokenName || otherTokenSymbol
        }
      : (config.customQuoteTokenMetadata
          ? {
              symbol: config.customQuoteTokenMetadata.symbol,
              decimals: config.customQuoteTokenMetadata.decimals,
              name: config.customQuoteTokenMetadata.symbol
            }
          : null)

  const testMethodCall = async () => {
    const target = config.target?.trim() ?? ''
    const methodInput = config.methodInput ?? ''
    if (!target || !ethers.isAddress(target)) {
      setConfig(prev => ({ ...prev, fetchedRawPrice: undefined, formattedPrice: undefined, fetchError: undefined }))
      return
    }
    const parsed = parseNoArgSignature(methodInput)
    if (parsed.error) {
      setConfig(prev => ({ ...prev, fetchedRawPrice: undefined, formattedPrice: undefined, fetchError: parsed.error }))
      return
    }
    if (!window.ethereum) {
      setConfig(prev => ({ ...prev, fetchedRawPrice: undefined, formattedPrice: undefined, fetchError: 'Wallet provider is not available.' }))
      return
    }

    setTestingPrice(true)
    try {
      const selector = signatureToSelector(parsed.signature)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const returnData = await provider.call({
        to: ethers.getAddress(target),
        data: selector
      })
      if (!returnData || returnData === '0x' || returnData.length < 66) {
        throw new Error('Method returned empty data.')
      }
      const [decoded] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], returnData)
      const rawPrice = decoded.toString()
      const selectedDecimals = config.priceDecimals == null ? null : Number(config.priceDecimals)
      const formattedPrice = selectedDecimals == null ? '' : refreshFormattedPrice(rawPrice, selectedDecimals)
      setConfig(prev => ({
        ...prev,
        methodSignature: parsed.signature,
        callSelector: selector,
        fetchedRawPrice: rawPrice,
        formattedPrice,
        fetchError: undefined
      }))
    } catch (err) {
      setConfig(prev => ({
        ...prev,
        fetchedRawPrice: undefined,
        formattedPrice: undefined,
        fetchError: err instanceof Error ? err.message : 'Failed to call target method.'
      }))
    } finally {
      setTestingPrice(false)
    }
  }

  // Auto-fetch method test result when returning to this step with pre-filled config.
  // This avoids requiring a blur action when target + method are already restored from cache/context.
  useEffect(() => {
    const target = config.target?.trim() ?? ''
    const methodInput = config.methodInput ?? config.methodSignature ?? ''
    if (!target || !ethers.isAddress(target) || !methodInput) return

    const parsed = parseNoArgSignature(methodInput)
    if (parsed.error || !parsed.signature) return

    const selector = signatureToSelector(parsed.signature)
    const normalizedTarget = ethers.getAddress(target).toLowerCase()
    const key = `${normalizedTarget}|${selector}`
    const alreadyHasResult =
      !!config.fetchedRawPrice && (config.callSelector ?? '').toLowerCase() === selector.toLowerCase()

    if (alreadyHasResult || testingPrice || autoFetchKeyRef.current === key) return
    autoFetchKeyRef.current = key
    void testMethodCall()
    // Intentionally react only to restored/changed inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.target, config.methodInput, config.methodSignature, config.fetchedRawPrice, config.callSelector, testingPrice])

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400 mb-2">
        Base token:{' '}
        <span className="text-white font-medium">{baseTokenSymbol}</span>{' '}
        <span className="text-gray-500">({baseTokenName})</span>
      </p>

      {/* Oracle implementation (version sourced from factory) */}
      {customMethodFactoryMissing ? (
        <div className="silo-alert silo-alert-error">
          <p className="text-sm font-medium">Custom Method Oracle unavailable</p>
          <p className="text-sm mt-1">{customMethodFactoryMissing}</p>
        </div>
      ) : !customMethodFactory ? (
        <p className="text-sm text-yellow-400">Loading CustomMethodOracle for this chain…</p>
      ) : customMethodImplementationError ? (
        <div className="silo-alert silo-alert-error">
          <p className="text-sm font-medium">Failed to resolve oracle implementation</p>
          <p className="text-sm mt-1">{customMethodImplementationError}</p>
        </div>
      ) : customMethodImplementationAddress ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">CustomMethodOracle (implementation)</p>
            {customMethodFactory && (
              <span className="text-xs text-gray-400">
                Source:{' '}
                <a
                  href={getExplorerAddressUrl(networkChainId ?? '1', customMethodFactory.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-300 underline"
                >
                  explorer
                </a>
              </span>
            )}
          </div>
          <div className="space-y-2">
            <AddressDisplayShort
              address={customMethodImplementationAddress}
              chainId={networkChainId ? parseInt(String(networkChainId), 10) : undefined}
              className="text-sm"
              showVersion={false}
            />
            <div className="text-sm text-gray-300 whitespace-nowrap">
              version:{' '}
              <span className="text-version-muted">
                {customMethodImplementationVersion ?? '…'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-yellow-400">Resolving oracle implementation…</p>
      )}

      {/* Section 2: Target Contract Method + Price Decimals */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">Target contract method</h4>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Target contract *
          </label>
          <input
            type="text"
            value={config.target ?? ''}
            onChange={(e) => setConfig(prev => ({ ...prev, target: extractHexAddressLike(e.target.value) }))}
            placeholder="0x… or explorer URL"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Method name *
          </label>
          <input
            type="text"
            value={config.methodInput ?? ''}
            onChange={(e) =>
              setConfig(prev => ({
                ...prev,
                methodInput: e.target.value,
                methodSignature: ensureNoArgsMethodSignature(e.target.value),
                fetchedRawPrice: undefined,
                formattedPrice: undefined,
                fetchError: undefined
              }))
            }
            onBlur={testMethodCall}
            placeholder="e.g. price or latestAnswer()"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
          <p className="text-xs text-gray-400">
            Only methods without arguments are supported. If you type just the name, the app uses <span className="font-mono">()</span> internally.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">Price decimals</h4>
          <p className="text-xs text-gray-400">Select decimals for the raw returned value to format the price.</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 13 }).map((_, i) => {
              const d = i + 6
              const selected = config.priceDecimals != null && Number(config.priceDecimals) === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setConfig(prev => ({
                      ...prev,
                      priceDecimals: d,
                      formattedPrice: prev.fetchedRawPrice ? refreshFormattedPrice(prev.fetchedRawPrice, d) : ''
                    }))
                  }}
                  className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                    selected
                      ? 'border-lime-700 bg-lime-900/20 text-lime-300'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
          {config.priceDecimals == null && (
            <p className="text-xs text-yellow-300/90">
              Decimals not selected yet.
            </p>
          )}
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-1">
        <p className="text-gray-500 text-xs uppercase tracking-wide">Method test</p>
        {testingPrice ? (
          <p className="text-sm text-gray-300">Calling method…</p>
        ) : config.fetchError ? (
          <p className="text-sm text-red-400">{config.fetchError}</p>
        ) : config.fetchedRawPrice ? (
          <>
            <p className="text-sm text-gray-300">
              Raw price: <span className="font-mono">{config.fetchedRawPrice}</span>
            </p>
            <p className="text-sm text-gray-300">
              Price ({config.priceDecimals == null ? '—' : config.priceDecimals} decimals): <span className="font-mono">{config.formattedPrice ?? ''}</span>
            </p>
            {config.callSelector && (
              <p className="text-xs text-gray-500">
                callSelector: <span className="font-mono">{config.callSelector}</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">
            {(() => {
              const target = config.target?.trim() ?? ''
              const methodInput = config.methodInput ?? config.methodSignature ?? ''
              const parsed = parseNoArgSignature(methodInput)
              if (target && ethers.isAddress(target) && methodInput && !parsed.error) {
                return 'Method result is fetched automatically when the configuration is complete.'
              }
              return 'Method result will appear after leaving the method field.'
            })()}
          </p>
        )}
      </div>

      {/* Section 3: Quote Token */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">Quote token</h4>
        <div className="flex flex-wrap gap-2">
          <PredefinedOptionButton
            onClick={() => {
              const addr = otherTokenAddress || ''
              setQuoteInput(addr)
              setConfig(prev => ({
                ...prev,
                useOtherTokenAsQuote: true,
                customQuoteTokenAddress: addr,
                customQuoteTokenMetadata:
                  otherTokenSymbol && typeof otherTokenDecimals === 'number'
                    ? { symbol: otherTokenSymbol, decimals: otherTokenDecimals }
                    : prev.customQuoteTokenMetadata
              }))
            }}
          >
            <span>Other token</span>
          </PredefinedOptionButton>
          {usdcAddress && (
            <PredefinedOptionButton
              onClick={() => {
                setQuoteInput('USDC')
                setConfig(prev => ({ ...prev, useOtherTokenAsQuote: false }))
              }}
            >
              <span>USDC</span>
            </PredefinedOptionButton>
          )}
          {virtualTokenOptions.map((virtualToken) => (
            <PredefinedOptionButton
              key={virtualToken.key}
              onClick={() => {
                setQuoteInput(virtualToken.key)
                setConfig(prev => ({ ...prev, useOtherTokenAsQuote: false }))
              }}
            >
              <span>{virtualToken.label}</span>
            </PredefinedOptionButton>
          ))}
        </div>
        <TokenAddressInput
          value={quoteInput}
          onChange={(value) => {
            setQuoteInput(value)
            setConfig(prev => ({ ...prev, useOtherTokenAsQuote: false }))
          }}
          onResolve={(address, metadata) => {
            if (metadata && address) {
              setConfig(prev => ({
                ...prev,
                useOtherTokenAsQuote: false,
                customQuoteTokenAddress: address,
                customQuoteTokenMetadata: {
                  symbol: metadata.symbol,
                  decimals: metadata.decimals
                }
              }))
            } else {
              setConfig(prev => ({
                ...prev,
                customQuoteTokenAddress: '',
                customQuoteTokenMetadata: undefined
              }))
            }
          }}
          chainId={networkChainId}
          label="Quote token address or symbol"
          placeholder="0x… or symbol from addresses JSON"
          initialResolvedAddress={config.customQuoteTokenAddress || null}
          initialMetadata={quoteInitialMetadata}
        />
      </div>
    </div>
  )
}

/**
 * Normalization so oracle output is 18 decimals.
 * Equation: base decimals + aggregator decimals ± normalization = 18.
 * Only base and aggregator decimals are used (quote/target is always 18).
 * exponent = 18 - baseDecimals - aggregatorDecimals:
 * - exponent ≥ 0 → normalizationMultiplier = 10^exponent, normalizationDivider = 0
 * - exponent < 0 → normalizationDivider = 10^(-exponent), normalizationMultiplier = 0
 */
function computeChainlinkNormalization(
  baseDecimals: number,
  _quoteDecimals: number,
  aggregatorDecimals: number
): { divider: string; multiplier: string; mathLineMultiplier: string; mathLineDivider: string } {
  const targetDecimals = 18
  const exponent = targetDecimals - baseDecimals - aggregatorDecimals
  let divider = '0'
  let multiplier = '0'
  let mathLineMultiplier = ''
  let mathLineDivider = ''
  if (exponent >= 0) {
    multiplier = String(10 ** exponent)
    mathLineMultiplier = `base ${baseDecimals} + aggregator ${aggregatorDecimals} + normalization ${exponent} = ${targetDecimals} (QUOTE)`
  } else {
    const divExp = -exponent
    divider = String(10 ** divExp)
    mathLineDivider = `base ${baseDecimals} + aggregator ${aggregatorDecimals} − normalization ${divExp} = ${targetDecimals} (QUOTE)`
  }
  return { divider, multiplier, mathLineMultiplier, mathLineDivider }
}

// Helper function to validate if scaler can be used with token decimals
const validateScalerForToken = (scaleFactor: bigint, tokenDecimals: number): { valid: boolean; resultDecimals: number } => {
  // Calculate: 10^token_decimals * Factor
  const tokenMultiplier = Math.pow(10, tokenDecimals)
  const factor = Number(scaleFactor)
  const result = tokenMultiplier * factor
  
  // Check if result equals 1e18 (10^18)
  const targetValue = Math.pow(10, 18)
  const tolerance = 1e-10 // Small tolerance for floating point comparison
  
  const valid = Math.abs(result - targetValue) < tolerance
  
  // Calculate what decimals the result would have
  const resultDecimals = Math.log10(result)
  
  
  return { valid, resultDecimals }
}

export default function Step3OracleConfiguration() {
  const router = useRouter()
  const { wizardData, updateOracleConfiguration, markStepCompleted } = useWizard()
  
  const [oracleDeployments, setOracleDeployments] = useState<OracleDeployments | null>(null)
  const [availableScalers, setAvailableScalers] = useState<{
    token0: ScalerOracle[]
    token1: ScalerOracle[]
  }>({ token0: [], token1: [] })
  const [selectedScalers, setSelectedScalers] = useState<{
    token0: ScalerOracle | null
    token1: ScalerOracle | null
  }>({ token0: null, token1: null })
  const [chainlink0, setChainlink0] = useState<Partial<ChainlinkOracleConfig> & {
    primaryAggregatorDecimals?: number
    mathLineMultiplier?: string
    mathLineDivider?: string
    aggregatorDescription?: string
    aggregatorLatestAnswer?: string
  }>({
    baseToken: 'token0',
    useOtherTokenAsQuote: true,
    primaryAggregator: '',
    secondaryAggregator: '',
    normalizationDivider: '0',
    normalizationMultiplier: '0',
    invertSecondPrice: false
  })
  const [chainlink1, setChainlink1] = useState<Partial<ChainlinkOracleConfig> & {
    primaryAggregatorDecimals?: number
    mathLineMultiplier?: string
    mathLineDivider?: string
    aggregatorDescription?: string
    aggregatorLatestAnswer?: string
  }>({
    baseToken: 'token0',
    useOtherTokenAsQuote: true,
    primaryAggregator: '',
    secondaryAggregator: '',
    normalizationDivider: '0',
    normalizationMultiplier: '0',
    invertSecondPrice: false
  })
  const [chainlink0QuoteInput, setChainlink0QuoteInput] = useState('')
  const [chainlink1QuoteInput, setChainlink1QuoteInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingOracles, setLoadingOracles] = useState(true)
  const [oracleScalerFactory, setOracleScalerFactory] = useState<{ address: string; version: string } | null>(null)
  const [chainlinkV3OracleFactory, setChainlinkV3OracleFactory] = useState<{ address: string; version: string } | null>(null)
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [useSecondaryAggregator0, setUseSecondaryAggregator0] = useState(false)
  const [useSecondaryAggregator1, setUseSecondaryAggregator1] = useState(false)
  const [erc4626OracleFactory, setErc4626OracleFactory] = useState<{ address: string; version: string } | null>(null)

  const [vault0, setVault0] = useState<
    Partial<VaultOracleConfig> & {
      vaultSymbol?: string
      vaultAssetAddress?: string
      vaultAssetSymbol?: string
      assetMatchesBase?: boolean
    }
  >({
    baseToken: 'token0',
    useOtherTokenAsQuote: true,
    vaultAddress: ''
  })
  const [vault1, setVault1] = useState<
    Partial<VaultOracleConfig> & {
      vaultSymbol?: string
      vaultAssetAddress?: string
      vaultAssetSymbol?: string
      assetMatchesBase?: boolean
    }
  >({
    baseToken: 'token1',
    useOtherTokenAsQuote: true,
    vaultAddress: ''
  })
  const [vault0QuoteInput, setVault0QuoteInput] = useState('')
  const [vault1QuoteInput, setVault1QuoteInput] = useState('')
  const [vault0Valid, setVault0Valid] = useState(false)
  const [vault1Valid, setVault1Valid] = useState(false)

  const [ptLinear0, setPTLinear0] = useState<Partial<PTLinearOracleConfig>>({
    maxYieldPercent: 0,
    useSecondTokenAsQuote: true,
    hardcodedQuoteTokenAddress: ''
  })
  const [ptLinear1, setPTLinear1] = useState<Partial<PTLinearOracleConfig>>({
    maxYieldPercent: 0,
    useSecondTokenAsQuote: true,
    hardcodedQuoteTokenAddress: ''
  })
  const [ptLinearFactory, setPTLinearFactory] = useState<{ address: string; version: string } | null>(null)
  const [pt0QuoteInput, setPT0QuoteInput] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pt0QuoteMetadata, setPT0QuoteMetadata] = useState<{ symbol: string; decimals: number; name: string } | null>(null)
  const [pt1QuoteInput, setPT1QuoteInput] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pt1QuoteMetadata, setPT1QuoteMetadata] = useState<{ symbol: string; decimals: number; name: string } | null>(null)
  const [customMethodFactory, setCustomMethodFactory] = useState<{ address: string; version: string } | null>(null)
  const [customMethodFactoryMissing, setCustomMethodFactoryMissing] = useState<string | null>(null)
  const [customMethodImplementationAddress, setCustomMethodImplementationAddress] = useState<string | null>(null)
  const [customMethodImplementationVersion, setCustomMethodImplementationVersion] = useState<string | null>(null)
  const [customMethodImplementationError, setCustomMethodImplementationError] = useState<string | null>(null)
  const [customMethod0, setCustomMethod0] = useState<
    Partial<CustomMethodOracleConfig> & {
      methodInput?: string
      fetchedRawPrice?: string
      formattedPrice?: string
      fetchError?: string
    }
  >({
    baseToken: 'token0',
    useOtherTokenAsQuote: true,
    customQuoteTokenAddress: '',
    target: '',
    methodSignature: '',
    methodInput: '',
    callSelector: '',
    priceDecimals: undefined
  })
  const [customMethod1, setCustomMethod1] = useState<
    Partial<CustomMethodOracleConfig> & {
      methodInput?: string
      fetchedRawPrice?: string
      formattedPrice?: string
      fetchError?: string
    }
  >({
    baseToken: 'token1',
    useOtherTokenAsQuote: true,
    customQuoteTokenAddress: '',
    target: '',
    methodSignature: '',
    methodInput: '',
    callSelector: '',
    priceDecimals: undefined
  })
  const [customMethod0QuoteInput, setCustomMethod0QuoteInput] = useState('')
  const [customMethod1QuoteInput, setCustomMethod1QuoteInput] = useState('')

  // Optional virtual quote tokens – loaded from addresses JSON per chain.
  const [virtualTokenOptions, setVirtualTokenOptions] = useState<VirtualTokenOption[]>([])
  const [virtualTokensLoadedChain, setVirtualTokensLoadedChain] = useState<string | null>(null)
  // Optional USDC quote token – loaded from addresses JSON per chain (key: USDC).
  const [usdcAddress, setUsdcAddress] = useState<string | null>(null)
  const [usdcLoadedChain, setUsdcLoadedChain] = useState<string | null>(null)

  // Chain ID to chain name mapping - using centralized network config
  // getChainName is imported from @/utils/networks

  // Load virtual quote tokens if available in addresses JSON.
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!chainId) {
      setVirtualTokenOptions([])
      setVirtualTokensLoadedChain(null)
      return
    }
    if (virtualTokensLoadedChain === chainId) {
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const resolvedVirtualTokens = await Promise.all(
          VIRTUAL_TOKEN_KEYS.map(async (key) => {
            const res = await resolveSymbolToAddress(chainId, key)
            if (!res?.address) return null
            return {
              key,
              label: VIRTUAL_TOKEN_LABELS[key],
              address: res.address
            } satisfies VirtualTokenOption
          })
        )
        if (cancelled) return
        setVirtualTokenOptions(resolvedVirtualTokens.filter((token): token is VirtualTokenOption => token !== null))
        setVirtualTokensLoadedChain(chainId)
      } catch {
        if (!cancelled) {
          setVirtualTokenOptions([])
          setVirtualTokensLoadedChain(chainId)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [wizardData.networkInfo?.chainId, virtualTokensLoadedChain])

  // Load USDC address if available in addresses JSON (key: USDC)
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!chainId) {
      setUsdcAddress(null)
      setUsdcLoadedChain(null)
      return
    }
    if (usdcLoadedChain === chainId) {
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await resolveSymbolToAddress(chainId, 'USDC')
        if (cancelled) return
        setUsdcAddress(res?.address ?? null)
        setUsdcLoadedChain(chainId)
      } catch {
        if (!cancelled) {
          setUsdcAddress(null)
          setUsdcLoadedChain(chainId)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [wizardData.networkInfo?.chainId, usdcLoadedChain, usdcAddress])


  // Fetch oracle deployments from GitHub
  useEffect(() => {
    const fetchOracleDeployments = async () => {
      try {
        const response = await fetch('https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deploy/_oraclesDeployments.json')
        if (!response.ok) {
          throw new Error('Failed to fetch oracle deployments')
        }
        const data = await response.json()
        setOracleDeployments(data)
      } catch (err) {
        console.error('Error fetching oracle deployments:', err)
        setError('Failed to load oracle deployments')
      } finally {
        setLoadingOracles(false)
      }
    }

    fetchOracleDeployments()
  }, [])

  // Fetch OracleScalerFactory address for current chain
  useEffect(() => {
    const fetchScalerFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/OracleScalerFactory.sol.json`
        )
        if (!response.ok) {
          setOracleScalerFactory(null)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setOracleScalerFactory(address ? { address, version: '' } : null)
      } catch {
        setOracleScalerFactory(null)
      }
    }
    fetchScalerFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch ChainlinkV3OracleFactory address for current chain (master only)
  useEffect(() => {
    const fetchChainlinkFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/ChainlinkV3OracleFactory.sol.json`
        )
        if (!response.ok) {
          setChainlinkV3OracleFactory(null)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setChainlinkV3OracleFactory(address ? { address, version: '' } : null)
      } catch {
        setChainlinkV3OracleFactory(null)
      }
    }
    fetchChainlinkFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch PTLinearOracleFactory address for current chain
  useEffect(() => {
    const fetchPTLinearFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/PTLinearOracleFactory.sol.json`
        )
        if (!response.ok) {
          setPTLinearFactory(null)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setPTLinearFactory(address ? { address, version: '' } : null)
      } catch {
        setPTLinearFactory(null)
      }
    }
    fetchPTLinearFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch ERC4626OracleHardcodeQuoteFactory address for current chain
  useEffect(() => {
    const fetchVaultFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/ERC4626OracleHardcodeQuoteFactory.sol.json`
        )
        if (!response.ok) {
          setErc4626OracleFactory(null)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setErc4626OracleFactory(address ? { address, version: '' } : null)
      } catch {
        setErc4626OracleFactory(null)
      }
    }
    fetchVaultFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch CustomMethodOracleFactory address for current chain
  useEffect(() => {
    const fetchCustomMethodFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/CustomMethodOracleFactory.sol.json`
        )
        if (!response.ok) {
          setCustomMethodFactory(null)
          setCustomMethodFactoryMissing(`Custom Method Oracle is not available on ${chainName} (missing CustomMethodOracleFactory deployment file).`)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setCustomMethodFactory(address ? { address, version: '' } : null)
        setCustomMethodFactoryMissing(null)
      } catch {
        setCustomMethodFactory(null)
        setCustomMethodFactoryMissing('Failed to load CustomMethodOracleFactory for this chain.')
      }
    }
    fetchCustomMethodFactory()
  }, [wizardData.networkInfo?.chainId])

  // Resolve CustomMethodOracle implementation from factory (ORACLE_IMPLEMENTATION)
  useEffect(() => {
    const factoryAddr = customMethodFactory?.address
    if (!factoryAddr || !ethers.isAddress(factoryAddr)) {
      setCustomMethodImplementationAddress(null)
      setCustomMethodImplementationVersion(null)
      setCustomMethodImplementationError(null)
      return
    }
    if (typeof window === 'undefined' || !window.ethereum) {
      setCustomMethodImplementationAddress(null)
      setCustomMethodImplementationError('Wallet provider is not available to resolve oracle implementation.')
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        setCustomMethodImplementationError(null)
        const eth = window.ethereum
        if (!eth) {
          setCustomMethodImplementationAddress(null)
          setCustomMethodImplementationVersion(null)
          setCustomMethodImplementationError('Wallet provider is not available to resolve oracle implementation.')
          return
        }
        const provider = new ethers.BrowserProvider(eth)
        const abi = ['function ORACLE_IMPLEMENTATION() view returns (address)'] as const
        const factory = new ethers.Contract(factoryAddr, abi, provider)
        const impl = await factory.ORACLE_IMPLEMENTATION()
        if (cancelled) return
        if (impl && ethers.isAddress(String(impl))) {
          setCustomMethodImplementationAddress(ethers.getAddress(String(impl)))
        } else {
          setCustomMethodImplementationAddress(null)
          setCustomMethodImplementationVersion(null)
          setCustomMethodImplementationError('Factory returned an invalid ORACLE_IMPLEMENTATION address.')
        }
      } catch (err) {
        if (cancelled) return
        setCustomMethodImplementationAddress(null)
        setCustomMethodImplementationVersion(null)
        setCustomMethodImplementationError(err instanceof Error ? err.message : 'Failed to resolve ORACLE_IMPLEMENTATION from factory.')
      }
    }
    run()
    return () => { cancelled = true }
  }, [customMethodFactory?.address])

  // Fetch SiloLens address for current chain (same pattern as Step10)
  useEffect(() => {
    const fetchLens = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloLens.sol.json`
        )
        if (response.ok) {
          const data = await response.json()
          const address = data.address && ethers.isAddress(data.address) ? data.address : ''
          setSiloLensAddress(address)
        } else {
          setSiloLensAddress('')
        }
      } catch {
        setSiloLensAddress('')
      }
    }
    fetchLens()
  }, [wizardData.networkInfo?.chainId])

  // Fetch oracle factory versions via Silo Lens in one bulk getVersions call.
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!siloLensAddress || !chainId) return
    const addresses = [
      oracleScalerFactory?.address,
      chainlinkV3OracleFactory?.address,
      ptLinearFactory?.address,
      erc4626OracleFactory?.address,
      customMethodFactory?.address,
      customMethodImplementationAddress
    ].filter((value): value is string => !!value)
    if (addresses.length === 0) return

    const fetchFactoryVersions = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses
        })

        const getVersion = (address?: string) =>
          address ? versionsByAddress.get(address.toLowerCase()) ?? '' : ''

        setOracleScalerFactory(prev =>
          prev ? { ...prev, version: getVersion(prev.address) || '—' } : null
        )
        setChainlinkV3OracleFactory(prev =>
          prev ? { ...prev, version: getVersion(prev.address) || '—' } : null
        )
        setPTLinearFactory(prev =>
          prev ? { ...prev, version: getVersion(prev.address) || '—' } : null
        )
        setErc4626OracleFactory(prev =>
          prev ? { ...prev, version: getVersion(prev.address) || '—' } : null
        )
        setCustomMethodFactory(prev =>
          prev ? { ...prev, version: getVersion(prev.address) || '—' } : null
        )
        setCustomMethodImplementationVersion(
          customMethodImplementationAddress
            ? getVersion(customMethodImplementationAddress) || '—'
            : null
        )
      } catch (err) {
        console.warn('Failed to fetch oracle factory versions from Silo Lens:', err)
        setOracleScalerFactory(prev => (prev ? { ...prev, version: '—' } : null))
        setChainlinkV3OracleFactory(prev => (prev ? { ...prev, version: '—' } : null))
        setPTLinearFactory(prev => (prev ? { ...prev, version: '—' } : null))
        setErc4626OracleFactory(prev => (prev ? { ...prev, version: '—' } : null))
        setCustomMethodFactory(prev => (prev ? { ...prev, version: '—' } : null))
        setCustomMethodImplementationVersion(
          customMethodImplementationAddress ? '—' : null
        )
      }
    }
    fetchFactoryVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    oracleScalerFactory?.address,
    chainlinkV3OracleFactory?.address,
    ptLinearFactory?.address,
    erc4626OracleFactory?.address,
    customMethodFactory?.address,
    customMethodImplementationAddress,
    siloLensAddress,
    wizardData.networkInfo?.chainId
  ])

  // Sync PT-Linear state from wizard when returning to step
  useEffect(() => {
    const p0 = wizardData.oracleConfiguration?.token0?.ptLinearOracle
    if (p0) {
      setPTLinear0({
        maxYieldPercent: p0.maxYieldPercent,
        useSecondTokenAsQuote: p0.useSecondTokenAsQuote,
        hardcodedQuoteTokenAddress: p0.hardcodedQuoteTokenAddress
      })
      if (p0.hardcodedQuoteTokenAddress) {
        setPT0QuoteInput(p0.hardcodedQuoteTokenAddress)
      }
    }
    const p1 = wizardData.oracleConfiguration?.token1?.ptLinearOracle
    if (p1) {
      setPTLinear1({
        maxYieldPercent: p1.maxYieldPercent,
        useSecondTokenAsQuote: p1.useSecondTokenAsQuote,
        hardcodedQuoteTokenAddress: p1.hardcodedQuoteTokenAddress
      })
      if (p1.hardcodedQuoteTokenAddress) {
        setPT1QuoteInput(p1.hardcodedQuoteTokenAddress)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleConfiguration?.token0?.ptLinearOracle, wizardData.oracleConfiguration?.token1?.ptLinearOracle])

  // Sync Vault oracle state from wizard when returning to step
  useEffect(() => {
    const v0 = wizardData.oracleConfiguration?.token0?.vaultOracle
    if (v0) {
      setVault0(prev => ({
        ...prev,
        baseToken: v0.baseToken,
        useOtherTokenAsQuote: v0.useOtherTokenAsQuote ?? true,
        vaultAddress: v0.vaultAddress,
        customQuoteTokenAddress: v0.customQuoteTokenAddress,
        customQuoteTokenMetadata: v0.customQuoteTokenMetadata
      }))
      setVault0QuoteInput(v0.customQuoteTokenAddress ?? '')
    }
    const v1 = wizardData.oracleConfiguration?.token1?.vaultOracle
    if (v1) {
      setVault1(prev => ({
        ...prev,
        baseToken: v1.baseToken,
        useOtherTokenAsQuote: v1.useOtherTokenAsQuote ?? true,
        vaultAddress: v1.vaultAddress,
        customQuoteTokenAddress: v1.customQuoteTokenAddress,
        customQuoteTokenMetadata: v1.customQuoteTokenMetadata
      }))
      setVault1QuoteInput(v1.customQuoteTokenAddress ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wizardData.oracleConfiguration?.token0?.vaultOracle,
    wizardData.oracleConfiguration?.token1?.vaultOracle
  ])

  // Sync Custom Method oracle state from wizard when returning to step
  useEffect(() => {
    const cm0 = wizardData.oracleConfiguration?.token0?.customMethodOracle
    if (cm0) {
      setCustomMethod0(prev => ({
        ...prev,
        baseToken: cm0.baseToken,
        useOtherTokenAsQuote: cm0.useOtherTokenAsQuote ?? true,
        customQuoteTokenAddress: cm0.customQuoteTokenAddress,
        customQuoteTokenMetadata: cm0.customQuoteTokenMetadata,
        target: cm0.target,
        methodSignature: cm0.methodSignature,
        methodInput: cm0.methodSignature,
        callSelector: cm0.callSelector,
        priceDecimals: cm0.priceDecimals
      }))
      setCustomMethod0QuoteInput(cm0.customQuoteTokenAddress ?? '')
    }
    const cm1 = wizardData.oracleConfiguration?.token1?.customMethodOracle
    if (cm1) {
      setCustomMethod1(prev => ({
        ...prev,
        baseToken: cm1.baseToken,
        useOtherTokenAsQuote: cm1.useOtherTokenAsQuote ?? true,
        customQuoteTokenAddress: cm1.customQuoteTokenAddress,
        customQuoteTokenMetadata: cm1.customQuoteTokenMetadata,
        target: cm1.target,
        methodSignature: cm1.methodSignature,
        methodInput: cm1.methodSignature,
        callSelector: cm1.callSelector,
        priceDecimals: cm1.priceDecimals
      }))
      setCustomMethod1QuoteInput(cm1.customQuoteTokenAddress ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wizardData.oracleConfiguration?.token0?.customMethodOracle,
    wizardData.oracleConfiguration?.token1?.customMethodOracle
  ])


  // When no pre-deployed scalers for token0 but we have factory, set custom scaler (quote = token0)
  useEffect(() => {
    if (
      wizardData.oracleType0?.type === 'scaler' &&
      availableScalers.token0.length === 0 &&
      oracleScalerFactory &&
      wizardData.token0
    ) {
      const quoteToken = wizardData.token0.address
      setSelectedScalers(prev => {
        // Don't override if we already have a scaler from context (even if it's customCreate)
        if (prev.token0?.customCreate && prev.token0.customCreate.factoryAddress === oracleScalerFactory.address && prev.token0.customCreate.quoteToken === quoteToken) return prev
        // Don't override if we have a saved scaler from context that doesn't match available scalers
        const savedScaler0 = wizardData.oracleConfiguration?.token0.scalerOracle
        if (savedScaler0 && savedScaler0.customCreate) return prev
        return {
          ...prev,
          token0: {
            name: 'PLACEHOLDER',
            address: '',
            scaleFactor: '1',
            valid: true,
            customCreate: { factoryAddress: oracleScalerFactory.address, quoteToken }
          }
        }
      })
    }
    // Intentionally narrow: only react to type, list length, factory and token0 address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType0?.type, availableScalers.token0.length, oracleScalerFactory, wizardData.token0?.address])

  // When no pre-deployed scalers for token1 but we have factory, set custom scaler (quote = token1)
  useEffect(() => {
    if (
      wizardData.oracleType1?.type === 'scaler' &&
      availableScalers.token1.length === 0 &&
      oracleScalerFactory &&
      wizardData.token1
    ) {
      const quoteToken = wizardData.token1.address
      setSelectedScalers(prev => {
        // Don't override if we already have a scaler from context (even if it's customCreate)
        if (prev.token1?.customCreate && prev.token1.customCreate.factoryAddress === oracleScalerFactory.address && prev.token1.customCreate.quoteToken === quoteToken) return prev
        // Don't override if we have a saved scaler from context that doesn't match available scalers
        const savedScaler1 = wizardData.oracleConfiguration?.token1.scalerOracle
        if (savedScaler1 && savedScaler1.customCreate) return prev
        return {
          ...prev,
          token1: {
            name: 'PLACEHOLDER',
            address: '',
            scaleFactor: '1',
            valid: true,
            customCreate: { factoryAddress: oracleScalerFactory.address, quoteToken }
          }
        }
      })
    }
    // Intentionally narrow: only react to type, list length, factory and token1 address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType1?.type, availableScalers.token1.length, oracleScalerFactory, wizardData.token1?.address])

  // Fetch Chainlink primary aggregator: description, latestRoundData (answer), decimals; compute normalization (token0)
  useEffect(() => {
    if (wizardData.oracleType0?.type !== 'chainlink' || !wizardData.token0 || !wizardData.token1) return
    const token0 = wizardData.token0
    const token1 = wizardData.token1
    const useOther = chainlink0.useOtherTokenAsQuote !== false
    const quoteDecimals = useOther ? token1.decimals : (chainlink0.customQuoteTokenMetadata?.decimals ?? 18)
    const addr = chainlink0.primaryAggregator?.trim()
    if (!addr || !ethers.isAddress(addr)) {
      setChainlink0(prev => ({
        ...prev,
        primaryAggregatorDecimals: undefined,
        mathLineMultiplier: undefined,
        mathLineDivider: undefined,
        normalizationDivider: '0',
        normalizationMultiplier: '0',
        aggregatorDescription: undefined,
        aggregatorLatestAnswer: undefined
      }))
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        if (!window.ethereum) return
        const provider = new ethers.BrowserProvider(window.ethereum)
        const agg = new ethers.Contract(addr, aggregatorV3Abi, provider)
        const [description, roundData, dec] = await Promise.all([
          agg.description(),
          agg.latestRoundData(),
          agg.decimals()
        ])
        const aggregatorDecimals = Number(dec)
        if (cancelled) return
        const answerFormatted = ethers.formatUnits(roundData.answer, aggregatorDecimals)
        const base = token0.decimals
        const quote = quoteDecimals
        const { divider, multiplier, mathLineMultiplier, mathLineDivider } = computeChainlinkNormalization(base, quote, aggregatorDecimals)
        if (cancelled) return
        setChainlink0(prev => ({
          ...prev,
          primaryAggregatorDecimals: aggregatorDecimals,
          mathLineMultiplier,
          mathLineDivider,
          normalizationDivider: divider,
          normalizationMultiplier: multiplier,
          aggregatorDescription: String(description ?? ''),
          aggregatorLatestAnswer: answerFormatted
        }))
      } catch {
        if (!cancelled) setChainlink0(prev => ({
          ...prev,
          primaryAggregatorDecimals: undefined,
          mathLineMultiplier: undefined,
          mathLineDivider: undefined,
          normalizationDivider: '0',
          normalizationMultiplier: '0',
          aggregatorDescription: undefined,
          aggregatorLatestAnswer: undefined
        }))
      }
    }
    run()
    return () => { cancelled = true }
    // Intentionally narrow: avoid re-running on every wizardData reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType0?.type, wizardData.token0?.decimals, wizardData.token1?.decimals, chainlink0.primaryAggregator, chainlink0.useOtherTokenAsQuote, chainlink0.customQuoteTokenMetadata?.decimals])

  // Fetch Chainlink primary aggregator: description, latestRoundData (answer), decimals; compute normalization (token1)
  useEffect(() => {
    if (wizardData.oracleType1?.type !== 'chainlink' || !wizardData.token0 || !wizardData.token1) return
    const token0 = wizardData.token0
    const token1 = wizardData.token1
    const useOther = chainlink1.useOtherTokenAsQuote !== false
    const quoteDecimals = useOther ? token0.decimals : (chainlink1.customQuoteTokenMetadata?.decimals ?? 18)
    const addr = chainlink1.primaryAggregator?.trim()
    if (!addr || !ethers.isAddress(addr)) {
      setChainlink1(prev => ({
        ...prev,
        primaryAggregatorDecimals: undefined,
        mathLineMultiplier: undefined,
        mathLineDivider: undefined,
        normalizationDivider: '0',
        normalizationMultiplier: '0',
        aggregatorDescription: undefined,
        aggregatorLatestAnswer: undefined
      }))
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        if (!window.ethereum) return
        const provider = new ethers.BrowserProvider(window.ethereum)
        const agg = new ethers.Contract(addr, aggregatorV3Abi, provider)
        const [description, roundData, dec] = await Promise.all([
          agg.description(),
          agg.latestRoundData(),
          agg.decimals()
        ])
        const aggregatorDecimals = Number(dec)
        if (cancelled) return
        const answerFormatted = ethers.formatUnits(roundData.answer, aggregatorDecimals)
        const base = token1.decimals
        const quote = quoteDecimals
        const { divider, multiplier, mathLineMultiplier, mathLineDivider } = computeChainlinkNormalization(base, quote, aggregatorDecimals)
        if (cancelled) return
        setChainlink1(prev => ({
          ...prev,
          primaryAggregatorDecimals: aggregatorDecimals,
          mathLineMultiplier,
          mathLineDivider,
          normalizationDivider: divider,
          normalizationMultiplier: multiplier,
          aggregatorDescription: String(description ?? ''),
          aggregatorLatestAnswer: answerFormatted
        }))
      } catch {
        if (!cancelled) setChainlink1(prev => ({
          ...prev,
          primaryAggregatorDecimals: undefined,
          mathLineMultiplier: undefined,
          mathLineDivider: undefined,
          normalizationDivider: '0',
          normalizationMultiplier: '0',
          aggregatorDescription: undefined,
          aggregatorLatestAnswer: undefined
        }))
      }
    }
    run()
    return () => { cancelled = true }
    // Intentionally narrow: avoid re-running on every wizardData reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType1?.type, wizardData.token0?.decimals, wizardData.token1?.decimals, chainlink1.primaryAggregator, chainlink1.useOtherTokenAsQuote, chainlink1.customQuoteTokenMetadata?.decimals])

  // Sync chainlink state from wizard when returning to step
  useEffect(() => {
    const c0 = wizardData.oracleConfiguration?.token0?.chainlinkOracle
    if (c0) {
      setChainlink0(prev => ({
        ...prev,
        baseToken: c0.baseToken,
        useOtherTokenAsQuote: c0.useOtherTokenAsQuote ?? true,
        customQuoteTokenAddress: c0.customQuoteTokenAddress,
        customQuoteTokenMetadata: c0.customQuoteTokenMetadata,
        primaryAggregator: c0.primaryAggregator,
        secondaryAggregator: c0.secondaryAggregator || '',
        normalizationDivider: c0.normalizationDivider,
        normalizationMultiplier: c0.normalizationMultiplier,
        invertSecondPrice: c0.invertSecondPrice
      }))
      setChainlink0QuoteInput(c0.customQuoteTokenAddress ?? '')
      const hasSecondary = !!(c0.secondaryAggregator && c0.secondaryAggregator !== ethers.ZeroAddress && c0.secondaryAggregator.trim() !== '')
      setUseSecondaryAggregator0(hasSecondary)
    }
    const c1 = wizardData.oracleConfiguration?.token1?.chainlinkOracle
    if (c1) {
      setChainlink1(prev => ({
        ...prev,
        baseToken: c1.baseToken,
        useOtherTokenAsQuote: c1.useOtherTokenAsQuote ?? true,
        customQuoteTokenAddress: c1.customQuoteTokenAddress,
        customQuoteTokenMetadata: c1.customQuoteTokenMetadata,
        primaryAggregator: c1.primaryAggregator,
        secondaryAggregator: c1.secondaryAggregator || '',
        normalizationDivider: c1.normalizationDivider,
        normalizationMultiplier: c1.normalizationMultiplier,
        invertSecondPrice: c1.invertSecondPrice
      }))
      setChainlink1QuoteInput(c1.customQuoteTokenAddress ?? '')
      const hasSecondary = !!(c1.secondaryAggregator && c1.secondaryAggregator !== ethers.ZeroAddress && c1.secondaryAggregator.trim() !== '')
      setUseSecondaryAggregator1(hasSecondary)
    }
    // Intentionally narrow: sync only when saved chainlink config refs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleConfiguration?.token0?.chainlinkOracle, wizardData.oracleConfiguration?.token1?.chainlinkOracle])

  // Find and validate scaler oracles for each token
  useEffect(() => {
    const findScalerOracles = async () => {
      if (!oracleDeployments || !wizardData.networkInfo || !wizardData.token0 || !wizardData.token1) {
        return
      }

      const chainName = getChainName(wizardData.networkInfo.chainId)
      const chainOracles = oracleDeployments[chainName]
      
      if (!chainOracles) {
        console.warn(`No oracles found for chain: ${chainName}`)
        return
      }

      // Find SCALER oracles
      const scalerOracles = Object.entries(chainOracles)
        .filter(([name]) => name.includes('SCALER'))
        .map(([name, address]) => ({ name, address }))

      if (scalerOracles.length === 0) {
        console.warn(`No SCALER oracles found for chain: ${chainName}`)
        return
      }

      // Validate oracles for each token
      const validateOraclesForToken = async (tokenAddress: string, tokenDecimals: number) => {
        const validOracles: ScalerOracle[] = []

        for (const oracle of scalerOracles) {
          try {
            if (!window.ethereum) continue

            const provider = new ethers.BrowserProvider(window.ethereum)
            
            const contract = new ethers.Contract(oracle.address, oracleScalerAbi, provider)
            
            // Check if QUOTE_TOKEN matches our token (case insensitive)
            const quoteToken = await contract.QUOTE_TOKEN()
            if (quoteToken.toLowerCase() === tokenAddress.toLowerCase()) {
              // Get scale factor
              const scaleFactor = await contract.SCALE_FACTOR()
              const scaleFactorFormatted = formatScaleFactor(scaleFactor)
              
              // Validate if this scaler can be used with the token
              const validation = validateScalerForToken(scaleFactor, tokenDecimals)
              
              validOracles.push({
                name: oracle.name,
                address: oracle.address,
                scaleFactor: scaleFactorFormatted,
                valid: validation.valid,
                resultDecimals: validation.resultDecimals
              })
            }
          } catch (err) {
            console.warn(`Failed to validate oracle ${oracle.name}:`, err)
          }
        }

        return validOracles
      }

      // Validate for both tokens
      const [token0OraclesRaw, token1OraclesRaw] = await Promise.all([
        validateOraclesForToken(wizardData.token0.address, wizardData.token0.decimals),
        validateOraclesForToken(wizardData.token1.address, wizardData.token1.decimals)
      ])

      let token0Oracles = token0OraclesRaw
      let token1Oracles = token1OraclesRaw

      // Enrich contract addresses with versions from Silo Lens when available.
      if (siloLensAddress && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const chainId = wizardData.networkInfo.chainId
          const allScalerAddresses = Array.from(
            new Set([...token0OraclesRaw, ...token1OraclesRaw].map(oracle => oracle.address))
          )
          const versionsByAddress = await fetchSiloLensVersionsWithCache({
            provider,
            lensAddress: siloLensAddress,
            chainId,
            addresses: allScalerAddresses
          })
          const withVersion = (oracle: ScalerOracle): ScalerOracle => ({
            ...oracle,
            version: versionsByAddress.get(oracle.address.toLowerCase()) ?? '—'
          })
          token0Oracles = token0OraclesRaw.map(withVersion)
          token1Oracles = token1OraclesRaw.map(withVersion)
        } catch {
          token0Oracles = token0OraclesRaw.map(oracle => ({ ...oracle, version: '—' }))
          token1Oracles = token1OraclesRaw.map(oracle => ({ ...oracle, version: '—' }))
        }
      } else {
        token0Oracles = token0OraclesRaw.map(oracle => ({ ...oracle, version: '—' }))
        token1Oracles = token1OraclesRaw.map(oracle => ({ ...oracle, version: '—' }))
      }

      setAvailableScalers({
        token0: token0Oracles,
        token1: token1Oracles
      })

      // Update selected scalers with new validation results and load from context
      setSelectedScalers(prev => {
        const updated = { ...prev }
        
        const savedScaler0 = wizardData.oracleConfiguration?.token0.scalerOracle
        const savedScaler1 = wizardData.oracleConfiguration?.token1.scalerOracle
        
        // Token0: when we have pre-deployed scalers, customCreate from "0 available" state is invalid – clear it
        if (token0Oracles.length > 0) {
          if (prev.token0?.customCreate) {
            updated.token0 = null
          }
          // Restore from context when saved config matches an available scaler (e.g. user returned to step)
          if (savedScaler0 && !savedScaler0.customCreate) {
            const matchedScaler0 = token0Oracles.find(o => o.address.toLowerCase() === savedScaler0.address.toLowerCase())
            if (matchedScaler0) updated.token0 = matchedScaler0
          } else if (savedScaler0?.customCreate) {
            // customCreate only valid when no pre-deployed scalers
          } else if (prev.token0 && !prev.token0.customCreate) {
            const updatedOracle = token0Oracles.find(o => o.address.toLowerCase() === prev.token0?.address.toLowerCase())
            if (updatedOracle) updated.token0 = updatedOracle
          }
        }
        
        // Token1: when we have pre-deployed scalers, customCreate from "0 available" state is invalid – clear it
        if (token1Oracles.length > 0) {
          if (prev.token1?.customCreate) {
            updated.token1 = null
          }
          // Restore from context when saved config matches an available scaler (e.g. user returned to step)
          if (savedScaler1 && !savedScaler1.customCreate) {
            const matchedScaler1 = token1Oracles.find(o => o.address.toLowerCase() === savedScaler1.address.toLowerCase())
            if (matchedScaler1) updated.token1 = matchedScaler1
          } else if (savedScaler1?.customCreate) {
            // customCreate only valid when no pre-deployed scalers
          } else if (prev.token1 && !prev.token1.customCreate) {
            const updatedOracle = token1Oracles.find(o => o.address.toLowerCase() === prev.token1?.address.toLowerCase())
            if (updatedOracle) updated.token1 = updatedOracle
          }
        }
        
        return updated
      })
    }

    findScalerOracles()
  }, [oracleDeployments, wizardData.networkInfo, wizardData.token0, wizardData.token1, wizardData.oracleConfiguration, siloLensAddress])

  // Load existing selections from context when availableScalers are loaded
  // This ensures that when we return to this step, the saved scaler is automatically selected
  // This is the PRIMARY mechanism for loading saved scalers from context
  useEffect(() => {
    if (!wizardData.oracleConfiguration) return
    
    const savedScaler0 = wizardData.oracleConfiguration.token0.scalerOracle
    const savedScaler1 = wizardData.oracleConfiguration.token1.scalerOracle
    
    // Only set if we have available scalers loaded
    if (availableScalers.token0.length > 0 || availableScalers.token1.length > 0) {
      setSelectedScalers(prev => {
        const updated = { ...prev }
        let changed = false
        
        // Token0: restore from context when saved scaler matches available (user returned to step); customCreate only when no pre-deployed scalers
        if (savedScaler0 && !savedScaler0.customCreate && availableScalers.token0.length > 0) {
          const matchedScaler0 = availableScalers.token0.find(s => s.address.toLowerCase() === savedScaler0.address.toLowerCase())
          if (matchedScaler0) {
            updated.token0 = matchedScaler0
            changed = true
          }
        } else if (savedScaler0?.customCreate && availableScalers.token0.length === 0) {
          updated.token0 = savedScaler0
          changed = true
        }
        
        // Token1: restore from context when saved scaler matches available (user returned to step); customCreate only when no pre-deployed scalers
        if (savedScaler1 && !savedScaler1.customCreate && availableScalers.token1.length > 0) {
          const matchedScaler1 = availableScalers.token1.find(s => s.address.toLowerCase() === savedScaler1.address.toLowerCase())
          if (matchedScaler1) {
            updated.token1 = matchedScaler1
            changed = true
          }
        } else if (savedScaler1?.customCreate && availableScalers.token1.length === 0) {
          updated.token1 = savedScaler1
          changed = true
        }
        
        return changed ? updated : prev
      })
    }
  }, [wizardData.oracleConfiguration, availableScalers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: string[] = []
    if (!wizardData.oracleType0 || !wizardData.oracleType1) {
      errors.push('Oracle types not selected. Please go back to Step 2.')
    }
    if (wizardData.oracleType0?.type === 'scaler' && (!selectedScalers.token0 || (!selectedScalers.token0.customCreate && !selectedScalers.token0.valid))) {
      errors.push('Please select or configure a scaler oracle for Token 0')
    }
    if (wizardData.oracleType1?.type === 'scaler' && (!selectedScalers.token1 || (!selectedScalers.token1.customCreate && !selectedScalers.token1.valid))) {
      errors.push('Please select or configure a scaler oracle for Token 1')
    }
    if (wizardData.oracleType0?.type === 'chainlink') {
      const quoteAddr0 = chainlink0.customQuoteTokenAddress?.trim() ?? ''
      const quoteEmpty0 = !quoteAddr0 || !ethers.isAddress(quoteAddr0)
      if (quoteEmpty0) {
        errors.push('Chainlink (Token 0): quote token is required. Use a predefined option or enter and resolve a custom quote address.')
      }
      const effectiveQuoteAddr0 = chainlink0.useOtherTokenAsQuote ? (wizardData.token1?.address?.trim() ?? '') : quoteAddr0
      const baseAddr0 = wizardData.token0?.address?.trim() ?? ''
      if (baseAddr0 && effectiveQuoteAddr0 && ethers.isAddress(baseAddr0) && ethers.isAddress(effectiveQuoteAddr0) &&
          baseAddr0.toLowerCase() === effectiveQuoteAddr0.toLowerCase()) {
        errors.push('Chainlink (Token 0): base token cannot be the same as quote token. Consider using virtual Quote Token if the oracle is required.')
      }
      if (!chainlink0.primaryAggregator?.trim() || !ethers.isAddress(chainlink0.primaryAggregator)) {
        errors.push('Please enter a valid primary aggregator address for Token 0 Chainlink oracle')
      } else if ((!chainlink0.normalizationDivider && !chainlink0.normalizationMultiplier) || (chainlink0.normalizationDivider === '0' && chainlink0.normalizationMultiplier === '0')) {
        errors.push('Chainlink normalization not computed for Token 0. Enter a valid primary aggregator.')
      }
    }
    if (wizardData.oracleType1?.type === 'chainlink') {
      const quoteAddr1 = chainlink1.customQuoteTokenAddress?.trim() ?? ''
      const quoteEmpty1 = !quoteAddr1 || !ethers.isAddress(quoteAddr1)
      if (quoteEmpty1) {
        errors.push('Chainlink (Token 1): quote token is required. Use a predefined option or enter and resolve a custom quote address.')
      }
      const effectiveQuoteAddr1 = chainlink1.useOtherTokenAsQuote ? (wizardData.token0?.address?.trim() ?? '') : quoteAddr1
      const baseAddr1 = wizardData.token1?.address?.trim() ?? ''
      if (baseAddr1 && effectiveQuoteAddr1 && ethers.isAddress(baseAddr1) && ethers.isAddress(effectiveQuoteAddr1) &&
          baseAddr1.toLowerCase() === effectiveQuoteAddr1.toLowerCase()) {
        errors.push('Chainlink (Token 1): base token cannot be the same as quote token. Consider using virtual Quote Token if the oracle is required.')
      }
      if (!chainlink1.primaryAggregator?.trim() || !ethers.isAddress(chainlink1.primaryAggregator)) {
        errors.push('Please enter a valid primary aggregator address for Token 1 Chainlink oracle')
      } else if ((!chainlink1.normalizationDivider && !chainlink1.normalizationMultiplier) || (chainlink1.normalizationDivider === '0' && chainlink1.normalizationMultiplier === '0')) {
        errors.push('Chainlink normalization not computed for Token 1. Enter a valid primary aggregator.')
      }
    }
    // Both sides use Chainlink: primary aggregators must be different.
    if (wizardData.oracleType0?.type === 'chainlink' && wizardData.oracleType1?.type === 'chainlink') {
      const primary0 = chainlink0.primaryAggregator?.trim() ?? ''
      const primary1 = chainlink1.primaryAggregator?.trim() ?? ''
      if (
        ethers.isAddress(primary0) &&
        ethers.isAddress(primary1) &&
        primary0.toLowerCase() === primary1.toLowerCase()
      ) {
        errors.push('Chainlink: primary aggregator for Token 0 must be different than primary aggregator for Token 1.')
      }
    }
    if (wizardData.oracleType0?.type === 'ptLinear') {
      const max0 = Number(ptLinear0.maxYieldPercent)
      if (Number.isNaN(max0) || max0 <= 0) {
        errors.push('Please enter a valid max yield (%) for Token 0 PT-Linear oracle')
      }
      if (!ptLinear0.useSecondTokenAsQuote) {
        const addr0 = ptLinear0.hardcodedQuoteTokenAddress?.trim()
        if (!addr0 || !ethers.isAddress(addr0)) {
          errors.push('Please enter or resolve a valid quote token address for Token 0 PT-Linear oracle')
        }
      }
    }
    if (wizardData.oracleType1?.type === 'ptLinear') {
      const max1 = Number(ptLinear1.maxYieldPercent)
      if (Number.isNaN(max1) || max1 <= 0) {
        errors.push('Please enter a valid max yield (%) for Token 1 PT-Linear oracle')
      }
      if (!ptLinear1.useSecondTokenAsQuote) {
        const addr1 = ptLinear1.hardcodedQuoteTokenAddress?.trim()
        if (!addr1 || !ethers.isAddress(addr1)) {
          errors.push('Please enter or resolve a valid quote token address for Token 1 PT-Linear oracle')
        }
      }
    }
    if (wizardData.oracleType0?.type === 'vault') {
      const addr = vault0.vaultAddress?.trim() ?? ''
      if (!addr || !ethers.isAddress(addr)) {
        errors.push('Vault Oracle (Token 0): vault address is required and must be a valid address')
      }
      if (!vault0Valid) {
        errors.push('Vault Oracle (Token 0): vault asset must match token asset to continue')
      }
      const quoteAddr0 = vault0.customQuoteTokenAddress?.trim() ?? ''
      const quoteEmpty0 = !quoteAddr0 || !ethers.isAddress(quoteAddr0)
      if (quoteEmpty0 && vault0.useOtherTokenAsQuote === false) {
        errors.push(
          'Vault Oracle (Token 0): quote token is required when not using the other token as quote'
        )
      }
    }
    if (wizardData.oracleType1?.type === 'vault') {
      const addr = vault1.vaultAddress?.trim() ?? ''
      if (!addr || !ethers.isAddress(addr)) {
        errors.push('Vault Oracle (Token 1): vault address is required and must be a valid address')
      }
      if (!vault1Valid) {
        errors.push('Vault Oracle (Token 1): vault asset must match token asset to continue')
      }
      const quoteAddr1 = vault1.customQuoteTokenAddress?.trim() ?? ''
      const quoteEmpty1 = !quoteAddr1 || !ethers.isAddress(quoteAddr1)
      if (quoteEmpty1 && vault1.useOtherTokenAsQuote === false) {
        errors.push(
          'Vault Oracle (Token 1): quote token is required when not using the other token as quote'
        )
      }
    }
    if (wizardData.oracleType0?.type === 'customMethod') {
      if (customMethodFactoryMissing || !customMethodFactory) {
        errors.push('Custom Method Oracle (Token 0): this oracle is not available on the selected chain (factory missing).')
      }
      const quoteAddr0 = customMethod0.customQuoteTokenAddress?.trim() ?? ''
      const quoteEmpty0 = !quoteAddr0 || !ethers.isAddress(quoteAddr0)
      if (quoteEmpty0) {
        errors.push('Custom Method Oracle (Token 0): quote token is required. Use a predefined option or enter and resolve a custom quote address.')
      }
      const target0 = customMethod0.target?.trim() ?? ''
      if (!target0 || !ethers.isAddress(target0)) {
        errors.push('Custom Method Oracle (Token 0): target contract must be a valid address.')
      }
      const parsed = parseNoArgSignature(customMethod0.methodInput ?? customMethod0.methodSignature ?? '')
      if (parsed.error) {
        errors.push(`Custom Method Oracle (Token 0): ${parsed.error}`)
      }
      const decimals = Number(customMethod0.priceDecimals)
      if (customMethod0.priceDecimals == null) {
        errors.push('Custom Method Oracle (Token 0): select price decimals.')
      } else if (!Number.isInteger(decimals) || decimals < 6 || decimals > 18) {
        errors.push('Custom Method Oracle (Token 0): price decimals must be an integer between 6 and 18.')
      }
    }
    if (wizardData.oracleType1?.type === 'customMethod') {
      if (customMethodFactoryMissing || !customMethodFactory) {
        errors.push('Custom Method Oracle (Token 1): this oracle is not available on the selected chain (factory missing).')
      }
      const quoteAddr1 = customMethod1.customQuoteTokenAddress?.trim() ?? ''
      const quoteEmpty1 = !quoteAddr1 || !ethers.isAddress(quoteAddr1)
      if (quoteEmpty1) {
        errors.push('Custom Method Oracle (Token 1): quote token is required. Use a predefined option or enter and resolve a custom quote address.')
      }
      const target1 = customMethod1.target?.trim() ?? ''
      if (!target1 || !ethers.isAddress(target1)) {
        errors.push('Custom Method Oracle (Token 1): target contract must be a valid address.')
      }
      const parsed = parseNoArgSignature(customMethod1.methodInput ?? customMethod1.methodSignature ?? '')
      if (parsed.error) {
        errors.push(`Custom Method Oracle (Token 1): ${parsed.error}`)
      }
      const decimals = Number(customMethod1.priceDecimals)
      if (customMethod1.priceDecimals == null) {
        errors.push('Custom Method Oracle (Token 1): select price decimals.')
      } else if (!Number.isInteger(decimals) || decimals < 6 || decimals > 18) {
        errors.push('Custom Method Oracle (Token 1): price decimals must be an integer between 6 and 18.')
      }
    }

    // Effective quote token address: none/scaler = token itself; chainlink/vault/ptLinear = stored quote address only.
    // "Other token" is just a predefined option that fills the address field – we only read that field.
    const getEffectiveQuoteAddress = (side: '0' | '1'): string => {
      const type = side === '0' ? wizardData.oracleType0?.type : wizardData.oracleType1?.type
      const token0Addr = wizardData.token0?.address?.trim() ?? ''
      const token1Addr = wizardData.token1?.address?.trim() ?? ''
      if (type === 'none' || type === 'scaler') {
        return side === '0' ? token0Addr : token1Addr
      }
      if (type === 'chainlink') {
        const c = side === '0' ? chainlink0 : chainlink1
        return (c.customQuoteTokenAddress?.trim() ?? '')
      }
      if (type === 'ptLinear') {
        const pt = side === '0' ? ptLinear0 : ptLinear1
        return (pt.hardcodedQuoteTokenAddress?.trim() ?? '')
      }
      if (type === 'vault') {
        const v = side === '0' ? vault0 : vault1
        return (v.customQuoteTokenAddress?.trim() ?? '')
      }
      if (type === 'customMethod') {
        const cm = side === '0' ? customMethod0 : customMethod1
        return (cm.customQuoteTokenAddress?.trim() ?? '')
      }
      return ''
    }
    const quote0 = getEffectiveQuoteAddress('0').toLowerCase()
    const quote1 = getEffectiveQuoteAddress('1').toLowerCase()
    if (quote0 && quote1 && quote0 !== quote1) {
      errors.push('Quote tokens for both oracles must be the same. Token 0 and Token 1 oracle quote tokens have different addresses.')
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }

    setError('')
    setLoading(true)

    try {
      // Resolve quote address for PT-Linear when using second token
      const pt0QuoteAddress =
        wizardData.oracleType0!.type === 'ptLinear'
          ? (ptLinear0.useSecondTokenAsQuote ? wizardData.token1!.address : ptLinear0.hardcodedQuoteTokenAddress!)
          : ''
      const pt1QuoteAddress =
        wizardData.oracleType1!.type === 'ptLinear'
          ? (ptLinear1.useSecondTokenAsQuote ? wizardData.token0!.address : ptLinear1.hardcodedQuoteTokenAddress!)
          : ''
      const customMethod0Parsed = parseNoArgSignature(customMethod0.methodInput ?? customMethod0.methodSignature ?? '')
      const customMethod1Parsed = parseNoArgSignature(customMethod1.methodInput ?? customMethod1.methodSignature ?? '')
      const cm0Signature = customMethod0Parsed.signature
      const cm1Signature = customMethod1Parsed.signature
      const cm0Selector = cm0Signature ? signatureToSelector(cm0Signature) : ''
      const cm1Selector = cm1Signature ? signatureToSelector(cm1Signature) : ''

      // Create oracle configuration
      const config: OracleConfiguration = {
        token0: {
          type: wizardData.oracleType0!.type,
          scalerOracle: wizardData.oracleType0!.type === 'scaler' ? selectedScalers.token0! : undefined,
          chainlinkOracle: wizardData.oracleType0!.type === 'chainlink' ? {
            baseToken: 'token0',
            useOtherTokenAsQuote: chainlink0.useOtherTokenAsQuote ?? true,
            customQuoteTokenAddress: (chainlink0.useOtherTokenAsQuote !== false && wizardData.token1?.address
              ? wizardData.token1.address
              : chainlink0.customQuoteTokenAddress?.trim()) || undefined,
            customQuoteTokenMetadata: chainlink0.customQuoteTokenMetadata,
            primaryAggregator: chainlink0.primaryAggregator!.trim(),
            secondaryAggregator: chainlink0.secondaryAggregator?.trim() || ethers.ZeroAddress,
            normalizationDivider: chainlink0.normalizationDivider ?? '0',
            normalizationMultiplier: chainlink0.normalizationMultiplier ?? '0',
            invertSecondPrice: chainlink0.invertSecondPrice ?? false
          } : undefined,
          ptLinearOracle: wizardData.oracleType0!.type === 'ptLinear' ? {
            maxYieldPercent: Number(ptLinear0.maxYieldPercent) || 0,
            useSecondTokenAsQuote: ptLinear0.useSecondTokenAsQuote ?? true,
            hardcodedQuoteTokenAddress: pt0QuoteAddress
          } : undefined,
          vaultOracle: wizardData.oracleType0!.type === 'vault'
            ? {
                baseToken: 'token0',
                useOtherTokenAsQuote: vault0.useOtherTokenAsQuote ?? true,
                vaultAddress: vault0.vaultAddress!.trim(),
                customQuoteTokenAddress:
                  vault0.useOtherTokenAsQuote !== false && wizardData.token1?.address
                    ? wizardData.token1.address
                    : vault0.customQuoteTokenAddress?.trim(),
                customQuoteTokenMetadata: vault0.customQuoteTokenMetadata
              }
            : undefined,
          customMethodOracle: wizardData.oracleType0!.type === 'customMethod'
            ? {
                baseToken: 'token0',
                useOtherTokenAsQuote: customMethod0.useOtherTokenAsQuote ?? true,
                customQuoteTokenAddress:
                  customMethod0.useOtherTokenAsQuote !== false && wizardData.token1?.address
                    ? wizardData.token1.address
                    : customMethod0.customQuoteTokenAddress?.trim(),
                customQuoteTokenMetadata:
                  customMethod0.useOtherTokenAsQuote !== false && wizardData.token1
                    ? {
                        symbol: wizardData.token1.symbol,
                        decimals: wizardData.token1.decimals
                      }
                    : customMethod0.customQuoteTokenMetadata,
                target: customMethod0.target!.trim(),
                methodSignature: cm0Signature,
                callSelector: cm0Selector,
                priceDecimals: Number(customMethod0.priceDecimals ?? 18)
              }
            : undefined
        },
        token1: {
          type: wizardData.oracleType1!.type,
          scalerOracle: wizardData.oracleType1!.type === 'scaler' ? selectedScalers.token1! : undefined,
          chainlinkOracle: wizardData.oracleType1!.type === 'chainlink' ? {
            baseToken: 'token1',
            useOtherTokenAsQuote: chainlink1.useOtherTokenAsQuote ?? true,
            customQuoteTokenAddress: (chainlink1.useOtherTokenAsQuote !== false && wizardData.token0?.address
              ? wizardData.token0.address
              : chainlink1.customQuoteTokenAddress?.trim()) || undefined,
            customQuoteTokenMetadata: chainlink1.customQuoteTokenMetadata,
            primaryAggregator: chainlink1.primaryAggregator!.trim(),
            secondaryAggregator: chainlink1.secondaryAggregator?.trim() || ethers.ZeroAddress,
            normalizationDivider: chainlink1.normalizationDivider ?? '0',
            normalizationMultiplier: chainlink1.normalizationMultiplier ?? '0',
            invertSecondPrice: chainlink1.invertSecondPrice ?? false
          } : undefined,
          ptLinearOracle: wizardData.oracleType1!.type === 'ptLinear' ? {
            maxYieldPercent: Number(ptLinear1.maxYieldPercent) || 0,
            useSecondTokenAsQuote: ptLinear1.useSecondTokenAsQuote ?? true,
            hardcodedQuoteTokenAddress: pt1QuoteAddress
          } : undefined,
          vaultOracle: wizardData.oracleType1!.type === 'vault'
            ? {
                baseToken: 'token1',
                useOtherTokenAsQuote: vault1.useOtherTokenAsQuote ?? true,
                vaultAddress: vault1.vaultAddress!.trim(),
                customQuoteTokenAddress:
                  vault1.useOtherTokenAsQuote !== false && wizardData.token0?.address
                    ? wizardData.token0.address
                    : vault1.customQuoteTokenAddress?.trim(),
                customQuoteTokenMetadata: vault1.customQuoteTokenMetadata
              }
            : undefined,
          customMethodOracle: wizardData.oracleType1!.type === 'customMethod'
            ? {
                baseToken: 'token1',
                useOtherTokenAsQuote: customMethod1.useOtherTokenAsQuote ?? true,
                customQuoteTokenAddress:
                  customMethod1.useOtherTokenAsQuote !== false && wizardData.token0?.address
                    ? wizardData.token0.address
                    : customMethod1.customQuoteTokenAddress?.trim(),
                customQuoteTokenMetadata:
                  customMethod1.useOtherTokenAsQuote !== false && wizardData.token0
                    ? {
                        symbol: wizardData.token0.symbol,
                        decimals: wizardData.token0.decimals
                      }
                    : customMethod1.customQuoteTokenMetadata,
                target: customMethod1.target!.trim(),
                methodSignature: cm1Signature,
                callSelector: cm1Selector,
                priceDecimals: Number(customMethod1.priceDecimals ?? 18)
              }
            : undefined
        }
      }

      updateOracleConfiguration(config)

      // Mark step as completed
      markStepCompleted(3)

      // Move to next step
      router.push('/wizard?step=4')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=2')
  }

  const getBlockExplorerUrl = (address: string) => {
    const chainId = wizardData.networkInfo?.chainId || '1'
    return getExplorerAddressUrl(chainId, address)
  }

  if (!wizardData.token0 || !wizardData.token1 || !wizardData.oracleType0 || !wizardData.oracleType1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Step 3: Oracle Configuration
          </h1>
          <p className="text-gray-300 text-lg">
            Please complete previous steps first
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 mb-6">
          <p className="text-gray-400 text-center">Missing required data. Please go back to previous steps.</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={goToPreviousStep}
            className="bg-[var(--silo-surface-2)] hover:bg-[#e6ebf5] text-[var(--silo-text)] border border-[var(--silo-border)] font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Oracle Types</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 3: Oracle Configuration
        </h1>
        <p className="text-gray-300 text-lg">
          Configure oracle settings for each token
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token 0 Configuration */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {(wizardData.oracleType0.type === 'none'
              ? 'No Oracle'
              : wizardData.oracleType0.type === 'scaler'
              ? 'Scaler Oracle'
              : wizardData.oracleType0.type === 'ptLinear'
              ? 'PT-Linear'
              : wizardData.oracleType0.type === 'vault'
              ? 'Vault Oracle'
              : wizardData.oracleType0.type === 'customMethod'
              ? 'Custom Method Oracle'
              : 'Chainlink')}{' '}
            for {wizardData.token0.symbol} ({wizardData.token0.name})
          </h3>
          <p className="text-sm text-gray-400 mb-2">
            Oracle Type:{' '}
            {wizardData.oracleType0.type === 'none'
              ? 'No Oracle'
              : wizardData.oracleType0.type === 'scaler'
              ? 'Scaler Oracle'
              : wizardData.oracleType0.type === 'ptLinear'
              ? 'PT-Linear'
              : wizardData.oracleType0.type === 'vault'
              ? 'Vault Oracle'
              : wizardData.oracleType0.type === 'customMethod'
              ? 'Custom Method Oracle'
              : 'Chainlink'}
          </p>
          {wizardData.oracleType0.type === 'none' ? (
            <div className="bg-lime-900/20 border border-lime-700 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lime-500 font-medium">No Oracle Configuration Needed</span>
              </div>
              <p className="text-sm text-gray-300">
                Token value will be equal to the amount since no oracle is being used.
              </p>
            </div>
          ) : wizardData.oracleType0.type === 'ptLinear' ? (
            <div className="space-y-4">
              {ptLinearFactory ? (
                <ContractInfo
                  contractName="PTLinearOracleFactory"
                  address={ptLinearFactory.address}
                  version={ptLinearFactory.version || '…'}
                  chainId={wizardData.networkInfo?.chainId}
                  isOracle={true}
                />
              ) : (
                <p className="text-sm text-yellow-400">Loading PTLinearOracleFactory for this chain…</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max yield (%)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[var(--silo-accent)]"
                  value={ptLinear0.maxYieldPercent === 0 ? '' : ptLinear0.maxYieldPercent}
                  onChange={(e) => setPTLinear0(prev => ({ ...prev, maxYieldPercent: e.target.value ? Number(e.target.value) : 0 }))}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pt0-use-second"
                  checked={ptLinear0.useSecondTokenAsQuote}
                  onChange={(e) => {
                    const checked = e.target.checked
                    const otherAddr = wizardData.token1?.address ?? ''
                    setPTLinear0(prev => ({
                      ...prev,
                      useSecondTokenAsQuote: checked,
                      hardcodedQuoteTokenAddress: checked ? otherAddr : prev.hardcodedQuoteTokenAddress
                    }))
                    if (checked) {
                      setPT0QuoteInput(otherAddr)
                      setPT0QuoteMetadata(null)
                    }
                  }}
                  className="rounded border-gray-600"
                />
                <label htmlFor="pt0-use-second" className="text-sm text-gray-300">
                  Use second token ({wizardData.token1?.symbol}) as quote
                </label>
              </div>
              {!ptLinear0.useSecondTokenAsQuote && (
                <>
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">Quote token</h4>
                    <div className="flex flex-wrap gap-2">
                      <PredefinedOptionButton
                        onClick={() => {
                          const otherAddr = wizardData.token1?.address ?? ''
                          setPT0QuoteInput(otherAddr)
                          setPT0QuoteMetadata(null)
                          setPTLinear0(prev => ({ ...prev, useSecondTokenAsQuote: true, hardcodedQuoteTokenAddress: otherAddr }))
                        }}
                      >
                        <span>Other token</span>
                      </PredefinedOptionButton>
                      {usdcAddress && (
                        <PredefinedOptionButton
                          onClick={() => {
                            setPT0QuoteInput('USDC')
                            setPTLinear0(prev => ({ ...prev, useSecondTokenAsQuote: false, hardcodedQuoteTokenAddress: usdcAddress }))
                          }}
                        >
                          <span>USDC</span>
                        </PredefinedOptionButton>
                      )}
                      {virtualTokenOptions.map((virtualToken) => (
                        <PredefinedOptionButton
                          key={virtualToken.key}
                          onClick={() => {
                            setPT0QuoteInput(virtualToken.key)
                            setPTLinear0(prev => ({ ...prev, useSecondTokenAsQuote: false, hardcodedQuoteTokenAddress: virtualToken.address }))
                          }}
                        >
                          <span>{virtualToken.label}</span>
                        </PredefinedOptionButton>
                      ))}
                    </div>
                  </div>
                  <TokenAddressInput
                    value={pt0QuoteInput}
                    onChange={(value) => {
                      setPT0QuoteInput(value)
                      setPTLinear0(prev => ({ ...prev, useSecondTokenAsQuote: false }))
                    }}
                    onResolve={(address, metadata) => {
                      setPT0QuoteMetadata(metadata)
                      if (metadata && address) {
                        setPTLinear0(prev => ({ ...prev, hardcodedQuoteTokenAddress: address }))
                      } else {
                        setPTLinear0(prev => ({ ...prev, hardcodedQuoteTokenAddress: '' }))
                      }
                    }}
                    chainId={wizardData.networkInfo?.chainId}
                    label="Quote token (address or symbol)"
                    placeholder="0x… or symbol from addresses JSON"
                  />
                </>
              )}
            </div>
          ) : wizardData.oracleType0.type === 'chainlink' ? (
            <ChainlinkOracleSection
              baseTokenSymbol={wizardData.token0.symbol}
              baseTokenName={wizardData.token0.name}
              baseTokenDecimals={wizardData.token0.decimals}
              otherTokenAddress={wizardData.token1?.address}
              chainlink={chainlink0}
              setChainlink={setChainlink0}
              quoteInput={chainlink0QuoteInput}
              setQuoteInput={setChainlink0QuoteInput}
              useSecondaryAggregator={useSecondaryAggregator0}
              setUseSecondaryAggregator={setUseSecondaryAggregator0}
              virtualTokenOptions={virtualTokenOptions}
              usdcAddress={usdcAddress}
              chainlinkV3OracleFactory={chainlinkV3OracleFactory}
              networkChainId={wizardData.networkInfo?.chainId}
              idSuffix="0"
            />
          ) : wizardData.oracleType0.type === 'vault' ? (
            <VaultOracleSection
              baseTokenSymbol={wizardData.token0.symbol}
              baseTokenName={wizardData.token0.name}
              otherTokenAddress={wizardData.token1?.address}
              otherTokenSymbol={wizardData.token1?.symbol}
              vault={vault0}
              setVault={setVault0}
              quoteInput={vault0QuoteInput}
              setQuoteInput={setVault0QuoteInput}
              virtualTokenOptions={virtualTokenOptions}
              usdcAddress={usdcAddress}
              networkChainId={wizardData.networkInfo?.chainId}
              vaultFactory={erc4626OracleFactory}
              onValidationChange={setVault0Valid}
            />
          ) : wizardData.oracleType0.type === 'customMethod' ? (
            <CustomMethodOracleSection
              baseTokenSymbol={wizardData.token0.symbol}
              baseTokenName={wizardData.token0.name}
              otherTokenAddress={wizardData.token1?.address}
              otherTokenSymbol={wizardData.token1?.symbol}
              otherTokenName={wizardData.token1?.name}
              otherTokenDecimals={wizardData.token1?.decimals}
              config={customMethod0}
              setConfig={setCustomMethod0}
              quoteInput={customMethod0QuoteInput}
              setQuoteInput={setCustomMethod0QuoteInput}
              virtualTokenOptions={virtualTokenOptions}
              usdcAddress={usdcAddress}
              networkChainId={wizardData.networkInfo?.chainId}
              customMethodFactory={customMethodFactory}
              customMethodFactoryMissing={customMethodFactoryMissing}
              customMethodImplementationAddress={customMethodImplementationAddress}
              customMethodImplementationVersion={customMethodImplementationVersion}
              customMethodImplementationError={customMethodImplementationError}
            />
          ) : (
            <div>
              {loadingOracles ? (
                <div className="flex items-center space-x-2 text-gray-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading available scaler oracles...</span>
                </div>
              ) : availableScalers.token0.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-gray-300">
                    No pre-defined scaler found for this token. The scaler will be deployed together with the market.
                  </p>
                  {oracleScalerFactory ? (
                    <>
                      <ContractInfo
                        contractName="OracleScalerFactory"
                        address={oracleScalerFactory.address}
                        version={oracleScalerFactory.version || '…'}
                        chainId={wizardData.networkInfo?.chainId}
                        isOracle={true}
                      />
                      <p className="text-xs text-gray-500">Quote token: Token 0 ({wizardData.token0.symbol})</p>
                    </>
                  ) : (
                    <p className="text-sm text-yellow-400">Loading OracleScalerFactory for this chain…</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    Select Scaler Oracle:
                  </label>
                  {availableScalers.token0.map((oracle) => {
                    const isSelected = selectedScalers.token0?.address?.toLowerCase() === oracle.address.toLowerCase()
                    return (
                      <label
                        key={`${oracle.address}-${isSelected}`}
                        className={`flex items-start space-x-3 p-4 rounded-lg border transition-all ${
                          !oracle.valid
                            ? 'border-red-500 bg-red-900/20 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'border-lime-700 bg-lime-900/20 cursor-pointer'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800 cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="scaler0"
                          value={oracle.address}
                          checked={isSelected}
                          onChange={() => setSelectedScalers(prev => ({ ...prev, token0: oracle }))}
                          disabled={!oracle.valid}
                          className="mt-1"
                        />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white">{oracle.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-400">
                              Factor:{' '}
                              <a
                                href={getBlockExplorerUrl(oracle.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lime-600 hover:text-lime-500"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {oracle.scaleFactor}
                              </a>
                            </span>
                            {oracle.valid ? (
                              <span className="status-muted-success text-xs">✓ Valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ Invalid</span>
                            )}
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <AddressDisplayShort
                            address={oracle.address}
                            chainId={wizardData.networkInfo?.chainId}
                            className="text-sm"
                            version={oracle.version ?? '—'}
                          />
                        </div>
                        {!oracle.valid && oracle.resultDecimals && (
                          <div className="mt-2 text-xs text-red-400">
                            This scaler will provide price in {Math.round(oracle.resultDecimals)} decimals, but price must be in 18 decimals.
                          </div>
                        )}
                        {oracle.valid && (
                          <div className="mt-2 text-xs status-muted-success">
                            This scaler correctly scales the token price to 18 decimals for proper market calculations.
                          </div>
                        )}
                      </div>
                    </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Token 1 Configuration */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {(wizardData.oracleType1.type === 'none'
              ? 'No Oracle'
              : wizardData.oracleType1.type === 'scaler'
              ? 'Scaler Oracle'
              : wizardData.oracleType1.type === 'ptLinear'
              ? 'PT-Linear'
              : wizardData.oracleType1.type === 'vault'
              ? 'Vault Oracle'
              : wizardData.oracleType1.type === 'customMethod'
              ? 'Custom Method Oracle'
              : 'Chainlink')}{' '}
            for {wizardData.token1.symbol} ({wizardData.token1.name})
          </h3>
          <p className="text-sm text-gray-400 mb-2">
            Oracle Type:{' '}
            {wizardData.oracleType1.type === 'none'
              ? 'No Oracle'
              : wizardData.oracleType1.type === 'scaler'
              ? 'Scaler Oracle'
              : wizardData.oracleType1.type === 'ptLinear'
              ? 'PT-Linear'
              : wizardData.oracleType1.type === 'vault'
              ? 'Vault Oracle'
              : wizardData.oracleType1.type === 'customMethod'
              ? 'Custom Method Oracle'
              : 'Chainlink'}
          </p>
          {wizardData.oracleType1.type === 'none' ? (
            <div className="bg-lime-900/20 border border-lime-700 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lime-500 font-medium">No Oracle Configuration Needed</span>
              </div>
              <p className="text-sm text-gray-300">
                Token value will be equal to the amount since no oracle is being used.
              </p>
            </div>
          ) : wizardData.oracleType1.type === 'ptLinear' ? (
            <div className="space-y-4">
              {ptLinearFactory ? (
                <ContractInfo
                  contractName="PTLinearOracleFactory"
                  address={ptLinearFactory.address}
                  version={ptLinearFactory.version || '…'}
                  chainId={wizardData.networkInfo?.chainId}
                  isOracle={true}
                />
              ) : (
                <p className="text-sm text-yellow-400">Loading PTLinearOracleFactory for this chain…</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max yield (%)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[var(--silo-accent)]"
                  value={ptLinear1.maxYieldPercent === 0 ? '' : ptLinear1.maxYieldPercent}
                  onChange={(e) => setPTLinear1(prev => ({ ...prev, maxYieldPercent: e.target.value ? Number(e.target.value) : 0 }))}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pt1-use-second"
                  checked={ptLinear1.useSecondTokenAsQuote}
                  onChange={(e) => {
                    const checked = e.target.checked
                    const otherAddr = wizardData.token0?.address ?? ''
                    setPTLinear1(prev => ({
                      ...prev,
                      useSecondTokenAsQuote: checked,
                      hardcodedQuoteTokenAddress: checked ? otherAddr : prev.hardcodedQuoteTokenAddress
                    }))
                    if (checked) {
                      setPT1QuoteInput(otherAddr)
                      setPT1QuoteMetadata(null)
                    }
                  }}
                  className="rounded border-gray-600"
                />
                <label htmlFor="pt1-use-second" className="text-sm text-gray-300">
                  Use second token ({wizardData.token0?.symbol}) as quote
                </label>
              </div>
              {!ptLinear1.useSecondTokenAsQuote && (
                <>
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-semibold text-emerald-900 tracking-wide">Quote token</h4>
                    <div className="flex flex-wrap gap-2">
                      <PredefinedOptionButton
                        onClick={() => {
                          const otherAddr = wizardData.token0?.address ?? ''
                          setPT1QuoteInput(otherAddr)
                          setPT1QuoteMetadata(null)
                          setPTLinear1(prev => ({ ...prev, useSecondTokenAsQuote: true, hardcodedQuoteTokenAddress: otherAddr }))
                        }}
                      >
                        <span>Other token</span>
                      </PredefinedOptionButton>
                      {usdcAddress && (
                        <PredefinedOptionButton
                          onClick={() => {
                            setPT1QuoteInput('USDC')
                            setPTLinear1(prev => ({ ...prev, useSecondTokenAsQuote: false, hardcodedQuoteTokenAddress: usdcAddress }))
                          }}
                        >
                          <span>USDC</span>
                        </PredefinedOptionButton>
                      )}
                      {virtualTokenOptions.map((virtualToken) => (
                        <PredefinedOptionButton
                          key={virtualToken.key}
                          onClick={() => {
                            setPT1QuoteInput(virtualToken.key)
                            setPTLinear1(prev => ({ ...prev, useSecondTokenAsQuote: false, hardcodedQuoteTokenAddress: virtualToken.address }))
                          }}
                        >
                          <span>{virtualToken.label}</span>
                        </PredefinedOptionButton>
                      ))}
                    </div>
                  </div>
                  <TokenAddressInput
                    value={pt1QuoteInput}
                    onChange={(value) => {
                      setPT1QuoteInput(value)
                      setPTLinear1(prev => ({ ...prev, useSecondTokenAsQuote: false }))
                    }}
                    onResolve={(address, metadata) => {
                      setPT1QuoteMetadata(metadata)
                      if (metadata && address) {
                        setPTLinear1(prev => ({ ...prev, hardcodedQuoteTokenAddress: address }))
                      } else {
                        setPTLinear1(prev => ({ ...prev, hardcodedQuoteTokenAddress: '' }))
                      }
                    }}
                    chainId={wizardData.networkInfo?.chainId}
                    label="Quote token (address or symbol)"
                    placeholder="0x… or symbol from addresses JSON"
                  />
                </>
              )}
            </div>
          ) : wizardData.oracleType1.type === 'chainlink' ? (
            <ChainlinkOracleSection
              baseTokenSymbol={wizardData.token1.symbol}
              baseTokenName={wizardData.token1.name}
              baseTokenDecimals={wizardData.token1.decimals}
              otherTokenAddress={wizardData.token0?.address}
              chainlink={chainlink1}
              setChainlink={setChainlink1}
              quoteInput={chainlink1QuoteInput}
              setQuoteInput={setChainlink1QuoteInput}
              useSecondaryAggregator={useSecondaryAggregator1}
              setUseSecondaryAggregator={setUseSecondaryAggregator1}
              virtualTokenOptions={virtualTokenOptions}
              usdcAddress={usdcAddress}
              chainlinkV3OracleFactory={chainlinkV3OracleFactory}
              networkChainId={wizardData.networkInfo?.chainId}
              idSuffix="1"
            />
          ) : wizardData.oracleType1.type === 'vault' ? (
            <VaultOracleSection
              baseTokenSymbol={wizardData.token1.symbol}
              baseTokenName={wizardData.token1.name}
              otherTokenAddress={wizardData.token0?.address}
              otherTokenSymbol={wizardData.token0?.symbol}
              vault={vault1}
              setVault={setVault1}
              quoteInput={vault1QuoteInput}
              setQuoteInput={setVault1QuoteInput}
              virtualTokenOptions={virtualTokenOptions}
              usdcAddress={usdcAddress}
              networkChainId={wizardData.networkInfo?.chainId}
              vaultFactory={erc4626OracleFactory}
              onValidationChange={setVault1Valid}
            />
          ) : wizardData.oracleType1.type === 'customMethod' ? (
            <CustomMethodOracleSection
              baseTokenSymbol={wizardData.token1.symbol}
              baseTokenName={wizardData.token1.name}
              otherTokenAddress={wizardData.token0?.address}
              otherTokenSymbol={wizardData.token0?.symbol}
              otherTokenName={wizardData.token0?.name}
              otherTokenDecimals={wizardData.token0?.decimals}
              config={customMethod1}
              setConfig={setCustomMethod1}
              quoteInput={customMethod1QuoteInput}
              setQuoteInput={setCustomMethod1QuoteInput}
              virtualTokenOptions={virtualTokenOptions}
              usdcAddress={usdcAddress}
              networkChainId={wizardData.networkInfo?.chainId}
              customMethodFactory={customMethodFactory}
              customMethodFactoryMissing={customMethodFactoryMissing}
              customMethodImplementationAddress={customMethodImplementationAddress}
              customMethodImplementationVersion={customMethodImplementationVersion}
              customMethodImplementationError={customMethodImplementationError}
            />
          ) : (
            <div>
              {loadingOracles ? (
                <div className="flex items-center space-x-2 text-gray-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading available scaler oracles...</span>
                </div>
              ) : availableScalers.token1.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-gray-300">
                    No pre-defined scaler found for this token. The scaler will be deployed together with the market.
                  </p>
                  {oracleScalerFactory ? (
                    <>
                      <ContractInfo
                        contractName="OracleScalerFactory"
                        address={oracleScalerFactory.address}
                        version={oracleScalerFactory.version || '…'}
                        chainId={wizardData.networkInfo?.chainId}
                        isOracle={true}
                      />
                      <p className="text-xs text-gray-500">Quote token: Token 1 ({wizardData.token1.symbol})</p>
                    </>
                  ) : (
                    <p className="text-sm text-yellow-400">Loading OracleScalerFactory for this chain…</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    Select Scaler Oracle:
                  </label>
                  {availableScalers.token1.map((oracle) => {
                    const isSelected = selectedScalers.token1?.address?.toLowerCase() === oracle.address.toLowerCase()
                    return (
                      <label
                        key={`${oracle.address}-${isSelected}`}
                        className={`flex items-start space-x-3 p-4 rounded-lg border transition-all ${
                          !oracle.valid
                            ? 'border-red-500 bg-red-900/20 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'border-lime-700 bg-lime-900/20 cursor-pointer'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800 cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="scaler1"
                          value={oracle.address}
                          checked={isSelected}
                          onChange={() => setSelectedScalers(prev => ({ ...prev, token1: oracle }))}
                          disabled={!oracle.valid}
                          className="mt-1"
                        />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white">{oracle.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-400">
                              Factor:{' '}
                              <a
                                href={getBlockExplorerUrl(oracle.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lime-600 hover:text-lime-500"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {oracle.scaleFactor}
                              </a>
                            </span>
                            {oracle.valid ? (
                              <span className="status-muted-success text-xs">✓ Valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ Invalid</span>
                            )}
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <AddressDisplayShort
                            address={oracle.address}
                            chainId={wizardData.networkInfo?.chainId}
                            className="text-sm"
                            version={oracle.version ?? '—'}
                          />
                        </div>
                        {!oracle.valid && oracle.resultDecimals && (
                          <div className="mt-2 text-xs text-red-400">
                            This scaler will provide price in {Math.round(oracle.resultDecimals)} decimals, but price must be in 18 decimals.
                          </div>
                        )}
                        {oracle.valid && (
                          <div className="mt-2 text-xs status-muted-success">
                            This scaler correctly scales the token price to 18 decimals for proper market calculations.
                          </div>
                        )}
                      </div>
                    </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <p className="text-red-400 font-medium mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-red-400 text-sm space-y-1">
              {error.split('\n').map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}


        <div className="flex justify-between">
          <button
            type="button"
            onClick={goToPreviousStep}
            className="bg-[var(--silo-surface-2)] hover:bg-[#e6ebf5] text-[var(--silo-text)] border border-[var(--silo-border)] font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Oracle Types</span>
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--silo-accent)] hover:bg-[#7688ff] disabled:bg-[var(--silo-border)] disabled:text-[var(--silo-text-faint)] disabled:opacity-60 disabled:cursor-not-allowed text-[#1f2654] font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Manageable Oracle</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
