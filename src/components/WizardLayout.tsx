'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import ResetButton from '@/components/ResetButton'
import AddressDisplayShort from '@/components/AddressDisplayShort'
import { bigintToDisplayNumber } from '@/utils/verification/normalization'

function OwnerAddressRow({ address, chainId }: { address: string; chainId: number }) {
  return (
    <div className="mt-1">
      <AddressDisplayShort
        address={address}
        chainId={chainId}
        className="text-xs"
      />
    </div>
  )
}

interface WizardLayoutProps {
  children: React.ReactNode
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const router = useRouter()
  const { wizardData, updateStep } = useWizard()
  const [isSummaryOpen, setIsSummaryOpen] = useState(true)

  const handleStepClick = (step: number) => {
    // Only allow navigation to completed steps (steps that are before current step)
    if (wizardData.currentStep > step) {
      router.push(`/wizard?step=${step}`)
    }
  }

  const isStep11Standalone = wizardData.currentStep === 11 && !wizardData.verificationFromWizard

  if (wizardData.currentStep === 0) {
    // Landing page - no sidebar
    return (
      <div className="light-market-theme min-h-screen text-emerald-950">
        {children}
      </div>
    )
  }

  const showSummarySidebar = !isStep11Standalone && isSummaryOpen

  return (
    <div className="light-market-theme min-h-screen text-emerald-950">
      <div className="flex">
        {/* Main Content */}
        <div className={`transition-all duration-300 ${showSummarySidebar ? 'w-2/3' : 'w-full'}`}>
          <div className="p-8">
            {/* Header with Navigation and Reset Button */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-emerald-950">Silo Market Creator</h1>
                <p className="text-emerald-700">Create a new Silo market step by step</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => updateStep(0)}
                  className="bg-lime-200 hover:bg-lime-300 border border-lime-300 text-emerald-900 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                  title="Back to Landing Page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Landing</span>
                </button>
                <ResetButton />
              </div>
            </div>
            {children}
          </div>
        </div>

        {/* Summary Sidebar - hidden on step 11 when verifying user-provided data (not from wizard) */}
        <div className={`${showSummarySidebar ? 'w-1/3' : 'w-0'} transition-all duration-300 overflow-hidden`}>
          <div className="bg-transparent border-l border-lime-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-emerald-950">Configuration Summary</h2>
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="text-emerald-700 hover:text-emerald-950 transition-colors"
                title="Hide Summary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-emerald-800 mb-3">Progress</h3>
              <div className="space-y-1.5">
                {[
                  { step: 1, title: 'Assets' },
                  { step: 2, title: 'Oracle Types' },
                  { step: 3, title: 'Oracle Config' },
                  { step: 4, title: 'IRM Selection' },
                  { step: 5, title: 'Borrow Setup' },
                  { step: 6, title: 'Fees' },
                  { step: 7, title: 'Hook' },
                  { step: 8, title: 'Hook Owner' },
                  { step: 9, title: 'JSON Config' },
                  { step: 10, title: 'Deployment' },
                  { step: 11, title: 'Verification' }
                ].map((item) => {
                  const isCompleted = wizardData.currentStep > item.step
                  const isCurrent = wizardData.currentStep === item.step
                  const isClickable = isCompleted
                  
                  return (
                    <div
                      key={item.step}
                      onClick={() => isClickable && handleStepClick(item.step)}
                      className={`flex items-center space-x-2 p-1.5 rounded-lg transition-colors ${
                        wizardData.currentStep >= item.step
                          ? 'bg-lime-900/20 border border-lime-700/50'
                          : 'bg-[#1a241a] border border-lime-900/40'
                      } ${
                        isClickable ? 'cursor-pointer hover:bg-lime-800/30' : 'cursor-default'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                          isCompleted
                            ? 'bg-lime-600 text-lime-950'
                            : isCurrent
                            ? 'bg-lime-700 text-lime-50'
                            : 'bg-lime-950/70 text-lime-300/50'
                        }`}
                      >
                        {isCompleted ? '✓' : item.step}
                      </div>
                      <div className={`text-xs font-medium ${
                        wizardData.currentStep >= item.step ? 'text-lime-50' : 'text-lime-200/60'
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
                  <h3 className="text-sm font-medium text-lime-200/80 mb-3">Selected Assets</h3>
                  <div className="space-y-2">
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">Token 0{wizardData.token0?.symbol ? <span className="text-lime-200/65"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <AddressDisplayShort
                          address={wizardData.token0.address}
                          chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1}
                          className="text-xs"
                        />
                        <span className="text-xs text-lime-200/65">{wizardData.token0.symbol}</span>
                      </div>
                    </div>
                    {wizardData.token1 && (
                      <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                        <div className="text-sm font-medium text-lime-50">Token 1{wizardData.token1?.symbol ? <span className="text-lime-200/65"> - {wizardData.token1.symbol}</span> : ''}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <AddressDisplayShort
                            address={wizardData.token1.address}
                            chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1}
                            className="text-xs"
                          />
                          <span className="text-xs text-lime-200/65">{wizardData.token1.symbol}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Oracle Configuration – not shown on step 11 (verification uses only on-chain data in the tree) */}
              {wizardData.currentStep !== 11 && (wizardData.oracleType0 || wizardData.oracleConfiguration) && (
                <div>
                  <h3 className="text-sm font-medium text-lime-200/80 mb-3">Oracle Configuration</h3>
                  <div className="space-y-2">
                    {wizardData.oracleType0 && (
                      <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                        <div className="text-sm font-medium text-lime-50">Token 0 Oracle{wizardData.token0?.symbol ? <span className="text-lime-200/65"> - {wizardData.token0.symbol}</span> : ''}</div>
                        <div className="text-xs text-lime-200/65 capitalize mb-2">
                          Type: {wizardData.oracleType0.type === 'none' ? 'No Oracle' : wizardData.oracleType0.type === 'scaler' ? 'Scaler Oracle' : wizardData.oracleType0.type === 'ptLinear' ? 'PT-Linear' : 'Chainlink'}
                        </div>
                        {wizardData.oracleConfiguration?.token0.scalerOracle && (() => {
                          const scaler = wizardData.oracleConfiguration.token0.scalerOracle
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <>
                              <div className="text-xs text-lime-200/65">{scaler.name}</div>
                              <div className="mt-1">
                                <AddressDisplayShort
                                  address={scaler.address}
                                  chainId={chainId}
                                  className="text-xs"
                                />
                              </div>
                              <div className={`text-xs mt-1 ${scaler.valid ? 'status-muted-success' : 'text-red-400'}`}>
                                {scaler.valid ? 'Valid' : 'Invalid'}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {wizardData.oracleType1 && (
                      <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                        <div className="text-sm font-medium text-lime-50">Token 1 Oracle{wizardData.token1?.symbol ? <span className="text-lime-200/65"> - {wizardData.token1.symbol}</span> : ''}</div>
                        <div className="text-xs text-lime-200/65 capitalize mb-2">
                          Type: {wizardData.oracleType1.type === 'none' ? 'No Oracle' : wizardData.oracleType1.type === 'scaler' ? 'Scaler Oracle' : wizardData.oracleType1.type === 'ptLinear' ? 'PT-Linear' : 'Chainlink'}
                        </div>
                        {wizardData.oracleConfiguration?.token1.scalerOracle && (() => {
                          const scaler = wizardData.oracleConfiguration.token1.scalerOracle
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          return (
                            <>
                              <div className="text-xs text-lime-200/65">{scaler.name}</div>
                              <div className="mt-1">
                                <AddressDisplayShort
                                  address={scaler.address}
                                  chainId={chainId}
                                  className="text-xs"
                                />
                              </div>
                              <div className={`text-xs mt-1 ${scaler.valid ? 'status-muted-success' : 'text-red-400'}`}>
                                {scaler.valid ? 'Valid' : 'Invalid'}
                              </div>
                            </>
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
                  <h3 className="text-sm font-medium text-lime-200/80 mb-3">Interest Rate Models</h3>
                  <div className="space-y-2">
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">Token 0 IRM{wizardData.token0?.symbol ? <span className="text-lime-200/65"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="text-xs text-lime-200/65">{wizardData.selectedIRM0.name}</div>
                    </div>
                    {wizardData.selectedIRM1 && (
                      <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                        <div className="text-sm font-medium text-lime-50">Token 1 IRM{wizardData.token1?.symbol ? <span className="text-lime-200/65"> - {wizardData.token1.symbol}</span> : ''}</div>
                        <div className="text-xs text-lime-200/65">{wizardData.selectedIRM1.name}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Borrow Configuration */}
              {wizardData.borrowConfiguration && (
                <div>
                  <h3 className="text-sm font-medium text-lime-200/80 mb-3">Borrow Configuration</h3>
                  <div className="space-y-2">
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">Token 0{wizardData.token0?.symbol ? <span className="text-lime-200/65"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="text-xs text-lime-200/65">
                        {wizardData.borrowConfiguration.token0.nonBorrowable && (
                          <span className="text-red-400">Non-borrowable</span>
                        )}
                        {wizardData.borrowConfiguration.token0.nonBorrowable && <br />}
                        LT: {bigintToDisplayNumber(wizardData.borrowConfiguration.token0.liquidationThreshold).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Max LTV: {bigintToDisplayNumber(wizardData.borrowConfiguration.token0.maxLTV).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Target LTV: {bigintToDisplayNumber(wizardData.borrowConfiguration.token0.liquidationTargetLTV).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">Token 1{wizardData.token1?.symbol ? <span className="text-lime-200/65"> - {wizardData.token1.symbol}</span> : ''}</div>
                      <div className="text-xs text-lime-200/65">
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
                  <h3 className="text-sm font-medium text-lime-200/80 mb-3">Fees Configuration</h3>
                  <div className="space-y-2">
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">General Fees</div>
                      <div className="text-xs text-lime-200/65">
                        DAO: {bigintToDisplayNumber(wizardData.feesConfiguration.daoFee).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Deployer: {bigintToDisplayNumber(wizardData.feesConfiguration.deployerFee).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">Token 0 Fees{wizardData.token0?.symbol ? <span className="text-lime-200/65"> - {wizardData.token0.symbol}</span> : ''}</div>
                      <div className="text-xs text-lime-200/65">
                        Liquidation: {bigintToDisplayNumber(wizardData.feesConfiguration.token0.liquidationFee).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Flashloan: {bigintToDisplayNumber(wizardData.feesConfiguration.token0.flashloanFee).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                    <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                      <div className="text-sm font-medium text-lime-50">Token 1 Fees{wizardData.token1?.symbol ? <span className="text-lime-200/65"> - {wizardData.token1.symbol}</span> : ''}</div>
                      <div className="text-xs text-lime-200/65">
                        Liquidation: {bigintToDisplayNumber(wizardData.feesConfiguration.token1.liquidationFee).toFixed(10).replace(/\.?0+$/, '')}% | 
                        Flashloan: {bigintToDisplayNumber(wizardData.feesConfiguration.token1.flashloanFee).toFixed(10).replace(/\.?0+$/, '')}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Owners: Hook Owner + IRM Owner (Kink only) */}
              <div>
                <h3 className="text-sm font-medium text-lime-200/80 mb-3">Owners</h3>
                <div className="space-y-2">
                  <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                    <div className="text-sm font-medium text-lime-50">Hook Owner</div>
                    {wizardData.hookOwnerAddress ? (
                      <OwnerAddressRow address={wizardData.hookOwnerAddress} chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1} />
                    ) : (
                      <div className="text-xs text-lime-300/45 mt-1">—</div>
                    )}
                  </div>
                  <div className="bg-[#1a241a] border border-lime-900/40 p-3 rounded-lg">
                    <div className="text-sm font-medium text-lime-50">IRM Owner</div>
                    {wizardData.irmModelType === 'kink' && wizardData.hookOwnerAddress ? (
                      <OwnerAddressRow address={wizardData.hookOwnerAddress} chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1} />
                    ) : (
                      <div className="text-xs text-lime-300/45 mt-1">not available</div>
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
            className="fixed top-1/2 right-4 transform -translate-y-1/2 bg-lime-800/80 hover:bg-lime-700 text-lime-50 p-3 rounded-full shadow-lg transition-all duration-200 z-50"
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