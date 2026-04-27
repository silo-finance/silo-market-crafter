'use client'

import React, { useState, useEffect } from 'react'
import Button from '@/components/Button'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import ResetButton from '@/components/ResetButton'
import AddressDisplayShort from '@/components/AddressDisplayShort'
import { bigintToDisplayNumber } from '@/utils/verification/normalization'
import { resolveAddressToName } from '@/utils/symbolToAddress'

function OwnerAddressRow({ address, chainId }: { address: string; chainId: number }) {
  const [nameFromJson, setNameFromJson] = useState<string | null>(null)

  useEffect(() => {
    if (!address || !chainId) {
      setNameFromJson(null)
      return
    }
    let cancelled = false
    resolveAddressToName(String(chainId), address).then((name) => {
      if (!cancelled) setNameFromJson(name)
    })
    return () => { cancelled = true }
  }, [address, chainId])

  return (
    <div className="mt-1 flex items-center gap-2 flex-wrap">
      <AddressDisplayShort
        address={address}
        chainId={chainId}
        className="text-xs"
        showVersion={false}
      />
      {nameFromJson != null && (
        <>
          <span className="text-xs silo-text-faint">—</span>
          <span className="text-xs silo-text-soft">{nameFromJson}</span>
        </>
      )}
    </div>
  )
}

interface WizardLayoutProps {
  children: React.ReactNode
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { wizardData } = useWizard()
  const [isSummaryOpen, setIsSummaryOpen] = useState(true)

  const handleStepClick = (step: number, stepId?: string) => {
    // Only allow navigation to completed steps (steps that are before current step)
    if (wizardData.currentStep > step) {
      if (stepId === 'verification') {
        const params = new URLSearchParams()
        params.set('step', 'verification')
        const chainFromUrl = searchParams.get('chain')
        if (chainFromUrl) {
          params.set('chain', chainFromUrl)
        }
        router.push(`/wizard?${params.toString()}`)
        return
      }
      router.push(`/wizard?step=${step}`)
    }
  }

  const isStep13Standalone = wizardData.currentStep === 13 && !wizardData.verificationFromWizard
  const isVerificationStep = wizardData.currentStep === 13

  if (wizardData.currentStep === 0) {
    // Landing page - no sidebar
    return (
      <div className="silo-page light-market-theme">
        {children}
      </div>
    )
  }

  const showSummarySidebar = !isStep13Standalone && isSummaryOpen

  return (
    <div className="silo-page light-market-theme">
      <div className="flex">
        {/* Main Content */}
        <div className={`transition-all duration-300 ${showSummarySidebar ? 'w-2/3' : 'w-full'}`}>
          <div className={`px-8 pb-8 ${isVerificationStep ? 'pt-8' : 'pt-12'}`}>
            {!isVerificationStep && (
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold silo-text-main">Silo Market Creator</h1>
                  <p className="silo-text-soft">Create a new Silo market step by step</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/')}
                    title="Back to Landing Page"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Landing
                  </Button>
                  <ResetButton />
                </div>
              </div>
            )}
            {children}
          </div>
        </div>

        {/* Summary Sidebar - hidden on verification step when verifying user-provided data (not from wizard) */}
        <div className={`${showSummarySidebar ? 'w-1/3' : 'w-0'} transition-all duration-300 overflow-hidden`}>
          <div className="summary-panel border-l border-[var(--silo-border)] p-6 backdrop-blur-[1px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold silo-text-main">Configuration Summary</h2>
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="silo-text-soft hover:text-[var(--silo-text)] transition-colors"
                title="Hide Summary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="mb-6">
              <h3 className="text-sm font-medium silo-text-soft mb-3">Progress</h3>
              <div className="space-y-1.5">
                {[
                  { step: 1, title: 'Assets' },
                  { step: 2, title: 'Oracle Types' },
                  { step: 3, title: 'Oracle Config' },
                  { step: 4, title: 'Manageable Oracle' },
                  { step: 5, title: 'IRM Selection' },
                  { step: 6, title: 'Oracle/IRM Owner' },
                  { step: 7, title: 'Borrow Setup' },
                  { step: 8, title: 'Fees' },
                  { step: 9, title: 'Hook' },
                  { step: 10, title: 'Hook Owner' },
                  { step: 11, title: 'JSON Config' },
                  { step: 12, title: 'Deployment' },
                  { step: 13, id: 'verification', title: 'Verification' }
                ].map((item) => {
                  const itemId = 'id' in item ? item.id : String(item.step)
                  const isCompleted = wizardData.currentStep > item.step
                  const isCurrent = wizardData.currentStep === item.step
                  const isClickable = isCompleted
                  
                  return (
                    <div
                      key={itemId}
                      onClick={() => isClickable && handleStepClick(item.step, 'id' in item ? item.id : undefined)}
                      className={`flex items-center space-x-2 p-1.5 rounded-lg transition-colors ${
                        wizardData.currentStep >= item.step
                          ? 'bg-[var(--silo-accent-soft)] border border-[#b9c2f0]'
                          : 'bg-[var(--silo-surface)] border border-[var(--silo-border)]'
                      } ${
                        isClickable ? 'cursor-pointer hover:bg-[#d6ddff]' : 'cursor-default'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                          isCompleted
                            ? 'bg-[var(--silo-accent)] text-[#172045]'
                            : isCurrent
                            ? 'bg-[#8f9dff] text-[#182149]'
                            : 'bg-[var(--silo-surface-2)] text-[var(--silo-text-faint)]'
                        }`}
                      >
                        {isCompleted ? '✓' : (itemId === 'verification' ? 'V' : item.step)}
                      </div>
                      <div className={`text-xs font-medium ${
                        wizardData.currentStep >= item.step ? 'text-[var(--silo-text)]' : 'text-[var(--silo-text-faint)]'
                      }`}>
                        {item.title}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Configuration Details */}
            <div className="space-y-6">
              {/* Step 1: Assets */}
              {wizardData.token0 && (
                <div>
                  <h3 className="text-sm font-medium silo-text-soft mb-3">Selected Assets</h3>
                  <div className="space-y-2">
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">Token 0{wizardData.token0?.symbol ? <span className="silo-text-soft"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <AddressDisplayShort
                          address={wizardData.token0.address}
                          chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1}
                          className="text-xs"
                          showVersion={false}
                        />
                        <span className="text-xs silo-text-soft">{wizardData.token0.symbol}</span>
                      </div>
                    </div>
                    {wizardData.token1 && (
                      <div className="silo-panel p-3">
                        <div className="text-sm font-medium silo-text-main">Token 1{wizardData.token1?.symbol ? <span className="silo-text-soft"> - {wizardData.token1.symbol}</span> : ''}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <AddressDisplayShort
                            address={wizardData.token1.address}
                            chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1}
                            className="text-xs"
                            showVersion={false}
                          />
                          <span className="text-xs silo-text-soft">{wizardData.token1.symbol}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Oracle Configuration – not shown on verification (verification uses only on-chain data in the tree) */}
              {wizardData.currentStep !== 13 && (wizardData.oracleType0 || wizardData.oracleConfiguration) && (
                <div>
                  <h3 className="text-sm font-medium silo-text-soft mb-3">Oracle Configuration</h3>
                  {wizardData.manageableOracle && wizardData.manageableOracleTimelock != null && wizardData.manageableOracleTimelock > 0 && (
                    <p className="text-xs silo-text-soft mb-2">
                      Timelock: {Math.round(wizardData.manageableOracleTimelock / 86400)} {Math.round(wizardData.manageableOracleTimelock / 86400) === 1 ? 'day' : 'days'} ({wizardData.manageableOracleTimelock.toLocaleString()} seconds)
                    </p>
                  )}
                  <div className="space-y-2">
                    {wizardData.oracleType0 && (
                      <div className="silo-panel p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium silo-text-main">Token 0 Oracle{wizardData.token0?.symbol ? <span className="silo-text-soft"> - {wizardData.token0.symbol}</span> : ''}</span>
                          {wizardData.manageableOracle && wizardData.oracleType0.type !== 'none' && (
                            <span className="manageable-badge text-[10px] px-1.5 py-0.5 rounded bg-[var(--silo-accent)] text-white font-medium">manageable</span>
                          )}
                        </div>
                        <div className="text-xs silo-text-soft capitalize mb-2">
                          Type:{' '}
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
                            : wizardData.oracleType0.type === 'supraSValue'
                            ? 'Supra s-value Oracle'
                            : 'Chainlink'}
                        </div>
                        {wizardData.oracleConfiguration?.token0.scalerOracle && (() => {
                          const scaler = wizardData.oracleConfiguration.token0.scalerOracle
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <>
                              <div className="text-xs silo-text-soft">{scaler.name}</div>
                              <div className="mt-1">
                                <AddressDisplayShort
                                  address={scaler.address}
                                  chainId={chainId}
                                  className="text-xs"
                                  version={scaler.version ?? '—'}
                                />
                              </div>
                              <div className={`text-xs mt-1 ${scaler.valid ? 'status-muted-success' : 'text-red-400'}`}>
                                {scaler.valid ? 'Valid' : 'Invalid'}
                              </div>
                            </>
                          )
                        })()}
                        {wizardData.oracleType0?.type === 'chainlink' && (() => {
                          const chainlink = wizardData.oracleConfiguration?.token0?.chainlinkOracle
                          const useOther = chainlink?.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token1?.address : chainlink?.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token1?.symbol : chainlink?.customQuoteTokenMetadata?.symbol
                          if (!quoteAddress) return null
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2">
                              <div className="text-xs silo-text-soft mb-1">Quote token</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <AddressDisplayShort
                                  address={quoteAddress}
                                  chainId={chainId}
                                  className="text-xs"
                                  showVersion={false}
                                />
                                {quoteSymbol && (
                                  <>
                                    <span className="text-xs silo-text-faint">—</span>
                                    <span className="text-xs silo-text-soft">{quoteSymbol}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                        {wizardData.oracleType0?.type === 'vault' && (() => {
                          const vault = wizardData.oracleConfiguration?.token0?.vaultOracle
                          if (!vault) return null
                          const useOther = vault.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token1?.address : vault.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token1?.symbol : vault.customQuoteTokenMetadata?.symbol
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2 space-y-2">
                              <div>
                                <div className="text-xs silo-text-soft mb-1">Vault</div>
                                <AddressDisplayShort
                                  address={vault.vaultAddress}
                                  chainId={chainId}
                                  className="text-xs"
                                  showVersion={false}
                                />
                              </div>
                              {quoteAddress && (
                                <div>
                                  <div className="text-xs silo-text-soft mb-1">Quote token</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <AddressDisplayShort
                                      address={quoteAddress}
                                      chainId={chainId}
                                      className="text-xs"
                                      showVersion={false}
                                    />
                                    {quoteSymbol && (
                                      <>
                                        <span className="text-xs silo-text-faint">—</span>
                                        <span className="text-xs silo-text-soft">{quoteSymbol}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        {wizardData.oracleType0?.type === 'customMethod' && (() => {
                          const customMethod = wizardData.oracleConfiguration?.token0?.customMethodOracle
                          if (!customMethod) return null
                          const useOther = customMethod.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token1?.address : customMethod.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token1?.symbol : customMethod.customQuoteTokenMetadata?.symbol
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2 space-y-2">
                              {quoteAddress && (
                                <div>
                                  <div className="text-xs silo-text-soft mb-1">Quote token</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <AddressDisplayShort
                                      address={quoteAddress}
                                      chainId={chainId}
                                      className="text-xs"
                                      showVersion={false}
                                    />
                                    {quoteSymbol && (
                                      <>
                                        <span className="text-xs silo-text-faint">—</span>
                                        <span className="text-xs silo-text-soft">{quoteSymbol}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="text-xs silo-text-soft mb-1">Target contract</div>
                                <AddressDisplayShort
                                  address={customMethod.target}
                                  chainId={chainId}
                                  className="text-xs"
                                  showVersion={false}
                                />
                              </div>
                              <div className="text-xs silo-text-soft">
                                Method: <span className="font-mono">{customMethod.methodSignature || '—'}</span>
                              </div>
                              <div className="text-xs silo-text-soft">
                                Price decimals: {customMethod.priceDecimals}
                              </div>
                            </div>
                          )
                        })()}
                        {wizardData.oracleType0?.type === 'supraSValue' && (() => {
                          const supra = wizardData.oracleConfiguration?.token0?.supraSValueOracle
                          if (!supra) return null
                          const useOther = supra.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token1?.address : supra.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token1?.symbol : supra.customQuoteTokenMetadata?.symbol
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2 space-y-2">
                              {quoteAddress && (
                                <div>
                                  <div className="text-xs silo-text-soft mb-1">Quote token</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <AddressDisplayShort address={quoteAddress} chainId={chainId} className="text-xs" showVersion={false} />
                                    {quoteSymbol && <><span className="text-xs silo-text-faint">—</span><span className="text-xs silo-text-soft">{quoteSymbol}</span></>}
                                  </div>
                                </div>
                              )}
                              <div className="text-xs silo-text-soft">
                                Pair ID: <span className="font-mono">{supra.pairId || '—'}</span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                    {wizardData.oracleType1 && (
                      <div className="silo-panel p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium silo-text-main">Token 1 Oracle{wizardData.token1?.symbol ? <span className="silo-text-soft"> - {wizardData.token1.symbol}</span> : ''}</span>
                          {wizardData.manageableOracle && wizardData.oracleType1.type !== 'none' && (
                            <span className="manageable-badge text-[10px] px-1.5 py-0.5 rounded bg-[var(--silo-accent)] text-white font-medium">manageable</span>
                          )}
                        </div>
                        <div className="text-xs silo-text-soft capitalize mb-2">
                          Type:{' '}
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
                            : wizardData.oracleType1.type === 'supraSValue'
                            ? 'Supra s-value Oracle'
                            : 'Chainlink'}
                        </div>
                        {wizardData.oracleConfiguration?.token1.scalerOracle && (() => {
                          const scaler = wizardData.oracleConfiguration.token1.scalerOracle
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <>
                              <div className="text-xs silo-text-soft">{scaler.name}</div>
                              <div className="mt-1">
                                <AddressDisplayShort
                                  address={scaler.address}
                                  chainId={chainId}
                                  className="text-xs"
                                  version={scaler.version ?? '—'}
                                />
                              </div>
                              <div className={`text-xs mt-1 ${scaler.valid ? 'status-muted-success' : 'text-red-400'}`}>
                                {scaler.valid ? 'Valid' : 'Invalid'}
                              </div>
                            </>
                          )
                        })()}
                        {wizardData.oracleType1?.type === 'chainlink' && (() => {
                          const chainlink = wizardData.oracleConfiguration?.token1?.chainlinkOracle
                          const useOther = chainlink?.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token0?.address : chainlink?.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token0?.symbol : chainlink?.customQuoteTokenMetadata?.symbol
                          if (!quoteAddress) return null
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2">
                              <div className="text-xs silo-text-soft mb-1">Quote token</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <AddressDisplayShort
                                  address={quoteAddress}
                                  chainId={chainId}
                                  className="text-xs"
                                  showVersion={false}
                                />
                                {quoteSymbol && (
                                  <>
                                    <span className="text-xs silo-text-faint">—</span>
                                    <span className="text-xs silo-text-soft">{quoteSymbol}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                        {wizardData.oracleType1?.type === 'vault' && (() => {
                          const vault = wizardData.oracleConfiguration?.token1?.vaultOracle
                          if (!vault) return null
                          const useOther = vault.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token0?.address : vault.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token0?.symbol : vault.customQuoteTokenMetadata?.symbol
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2 space-y-2">
                              <div>
                                <div className="text-xs silo-text-soft mb-1">Vault</div>
                                <AddressDisplayShort
                                  address={vault.vaultAddress}
                                  chainId={chainId}
                                  className="text-xs"
                                  showVersion={false}
                                />
                              </div>
                              {quoteAddress && (
                                <div>
                                  <div className="text-xs silo-text-soft mb-1">Quote token</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <AddressDisplayShort
                                      address={quoteAddress}
                                      chainId={chainId}
                                      className="text-xs"
                                      showVersion={false}
                                    />
                                    {quoteSymbol && (
                                      <>
                                        <span className="text-xs silo-text-faint">—</span>
                                        <span className="text-xs silo-text-soft">{quoteSymbol}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        {wizardData.oracleType1?.type === 'customMethod' && (() => {
                          const customMethod = wizardData.oracleConfiguration?.token1?.customMethodOracle
                          if (!customMethod) return null
                          const useOther = customMethod.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token0?.address : customMethod.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token0?.symbol : customMethod.customQuoteTokenMetadata?.symbol
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2 space-y-2">
                              {quoteAddress && (
                                <div>
                                  <div className="text-xs silo-text-soft mb-1">Quote token</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <AddressDisplayShort
                                      address={quoteAddress}
                                      chainId={chainId}
                                      className="text-xs"
                                      showVersion={false}
                                    />
                                    {quoteSymbol && (
                                      <>
                                        <span className="text-xs silo-text-faint">—</span>
                                        <span className="text-xs silo-text-soft">{quoteSymbol}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="text-xs silo-text-soft mb-1">Target contract</div>
                                <AddressDisplayShort
                                  address={customMethod.target}
                                  chainId={chainId}
                                  className="text-xs"
                                  showVersion={false}
                                />
                              </div>
                              <div className="text-xs silo-text-soft">
                                Method: <span className="font-mono">{customMethod.methodSignature || '—'}</span>
                              </div>
                              <div className="text-xs silo-text-soft">
                                Price decimals: {customMethod.priceDecimals}
                              </div>
                            </div>
                          )
                        })()}
                        {wizardData.oracleType1?.type === 'supraSValue' && (() => {
                          const supra = wizardData.oracleConfiguration?.token1?.supraSValueOracle
                          if (!supra) return null
                          const useOther = supra.useOtherTokenAsQuote !== false
                          const quoteAddress = useOther ? wizardData.token0?.address : supra.customQuoteTokenAddress
                          const quoteSymbol = useOther ? wizardData.token0?.symbol : supra.customQuoteTokenMetadata?.symbol
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <div className="mt-2 space-y-2">
                              {quoteAddress && (
                                <div>
                                  <div className="text-xs silo-text-soft mb-1">Quote token</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <AddressDisplayShort address={quoteAddress} chainId={chainId} className="text-xs" showVersion={false} />
                                    {quoteSymbol && <><span className="text-xs silo-text-faint">—</span><span className="text-xs silo-text-soft">{quoteSymbol}</span></>}
                                  </div>
                                </div>
                              )}
                              <div className="text-xs silo-text-soft">
                                Pair ID: <span className="font-mono">{supra.pairId || '—'}</span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: IRM Selection */}
              {wizardData.selectedIRM0 && (
                <div>
                  <h3 className="text-sm font-medium silo-text-soft mb-3">Interest Rate Models</h3>
                  <div className="space-y-2">
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">Token 0 IRM{wizardData.token0?.symbol ? <span className="silo-text-soft"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="text-xs silo-text-soft">{wizardData.selectedIRM0.name}</div>
                    </div>
                    {wizardData.selectedIRM1 && (
                      <div className="silo-panel p-3">
                        <div className="text-sm font-medium silo-text-main">Token 1 IRM{wizardData.token1?.symbol ? <span className="silo-text-soft"> - {wizardData.token1.symbol}</span> : ''}</div>
                        <div className="text-xs silo-text-soft">{wizardData.selectedIRM1.name}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Borrow Configuration */}
              {wizardData.borrowConfiguration && (
                <div>
                  <h3 className="text-sm font-medium silo-text-soft mb-3">Borrow Configuration</h3>
                  <div className="space-y-2">
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">Token 0{wizardData.token0?.symbol ? <span className="silo-text-soft"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="text-xs silo-text-soft">
                        {wizardData.borrowConfiguration.token0.nonBorrowable && (
                          <span className="text-red-400">Non-borrowable</span>
                        )}
                        {wizardData.borrowConfiguration.token0.nonBorrowable && <br />}
                        LT: {bigintToDisplayNumber(wizardData.borrowConfiguration.token0.liquidationThreshold).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Max LTV: {bigintToDisplayNumber(wizardData.borrowConfiguration.token0.maxLTV).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Target LTV: {bigintToDisplayNumber(wizardData.borrowConfiguration.token0.liquidationTargetLTV).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">Token 1{wizardData.token1?.symbol ? <span className="silo-text-soft"> - {wizardData.token1.symbol}</span> : ''}</div>
                      <div className="text-xs silo-text-soft">
                        {wizardData.borrowConfiguration.token1.nonBorrowable && (
                          <span className="text-red-400">Non-borrowable</span>
                        )}
                        {wizardData.borrowConfiguration.token1.nonBorrowable && <br />}
                        LT: {bigintToDisplayNumber(wizardData.borrowConfiguration.token1.liquidationThreshold).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Max LTV: {bigintToDisplayNumber(wizardData.borrowConfiguration.token1.maxLTV).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Target LTV: {bigintToDisplayNumber(wizardData.borrowConfiguration.token1.liquidationTargetLTV).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Fees Configuration */}
              {wizardData.feesConfiguration && (
                <div>
                  <h3 className="text-sm font-medium silo-text-soft mb-3">Fees Configuration</h3>
                  <div className="space-y-2">
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">General Fees</div>
                      <div className="text-xs silo-text-soft">
                        DAO: {bigintToDisplayNumber(wizardData.feesConfiguration.daoFee).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Deployer: {bigintToDisplayNumber(wizardData.feesConfiguration.deployerFee).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">Token 0 Fees{wizardData.token0?.symbol ? <span className="silo-text-soft"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="text-xs silo-text-soft">
                        Liquidation: {bigintToDisplayNumber(wizardData.feesConfiguration.token0.liquidationFee).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Flashloan: {bigintToDisplayNumber(wizardData.feesConfiguration.token0.flashloanFee).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                    <div className="silo-panel p-3">
                      <div className="text-sm font-medium silo-text-main">Token 1 Fees{wizardData.token1?.symbol ? <span className="silo-text-soft"> - {wizardData.token1.symbol}</span> : ''}</div>
                      <div className="text-xs silo-text-soft">
                        Liquidation: {bigintToDisplayNumber(wizardData.feesConfiguration.token1.liquidationFee).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Flashloan: {bigintToDisplayNumber(wizardData.feesConfiguration.token1.flashloanFee).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Owners: Hook Owner + IRM Owner (Kink only) */}
              <div>
                <h3 className="text-sm font-medium silo-text-soft mb-3">Owners</h3>
                <div className="space-y-2">
                  <div className="silo-panel p-3">
                    <div className="text-sm font-medium silo-text-main">Hook Owner</div>
                    {wizardData.hookOwnerAddress ? (
                      <OwnerAddressRow address={wizardData.hookOwnerAddress} chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1} />
                    ) : (
                      <div className="text-xs silo-text-faint mt-1">—</div>
                    )}
                  </div>
                  <div className="silo-panel p-3">
                    <div className="text-sm font-medium silo-text-main">Oracle/IRM Owner</div>
                    {wizardData.manageableOracleOwnerAddress ? (
                      <OwnerAddressRow address={wizardData.manageableOracleOwnerAddress} chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1} />
                    ) : (
                      <div className="text-xs silo-text-faint mt-1">—</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Toggle Button - Only visible when summary is hidden */}
        {!isSummaryOpen && (
          <button
            onClick={() => setIsSummaryOpen(true)}
            className="fixed top-1/2 right-4 transform -translate-y-1/2 bg-[var(--silo-accent)] hover:bg-[#7384ff] text-[#141a3c] p-3 rounded-full shadow-lg transition-all duration-200 z-50"
            title="Show Summary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}