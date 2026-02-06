'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import ResetButton from '@/components/ResetButton'
import CopyButton from '@/components/CopyButton'
import { normalizeAddress } from '@/utils/addressValidation'

const EXPLORER_MAP: { [key: number]: string } = {
  1: 'https://etherscan.io', 137: 'https://polygonscan.com', 10: 'https://optimistic.etherscan.io',
  42161: 'https://arbiscan.io', 43114: 'https://snowtrace.io', 146: 'https://sonicscan.org'
}

function OwnerAddressRow({ address, chainId }: { address: string; chainId: number }) {
  const addr = normalizeAddress(address) ?? address
  const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const base = EXPLORER_MAP[chainId] || 'https://etherscan.io'
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-xs text-gray-400 font-mono">{short}</span>
      <a href={`${base}/address/${addr}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white p-0.5 rounded" title="Check on Explorer" aria-label="Check on Explorer">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
      </a>
      <CopyButton value={addr} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
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
      <div className="min-h-screen bg-black text-white">
        {children}
      </div>
    )
  }

  const showSummarySidebar = !isStep11Standalone && isSummaryOpen

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Main Content */}
        <div className={`transition-all duration-300 ${showSummarySidebar ? 'w-2/3' : 'w-full'}`}>
          <div className="p-8">
            {/* Header with Navigation and Reset Button */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Silo Market Creator</h1>
                <p className="text-gray-400">Create a new Silo market step by step</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => updateStep(0)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
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
          <div className="bg-gray-900 border-l border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Configuration Summary</h2>
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Hide Summary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Progress</h3>
              <div className="space-y-2">
                {[
                  { step: 1, title: 'Assets', description: 'Select tokens' },
                  { step: 2, title: 'Oracle Types', description: 'Choose oracle types' },
                  { step: 3, title: 'Oracle Config', description: 'Configure oracles' },
                  { step: 4, title: 'IRM Selection', description: 'Select interest rate models' },
                  { step: 5, title: 'Borrow Setup', description: 'Configure borrowing parameters' },
                  { step: 6, title: 'Fees', description: 'Set fee parameters' },
                  { step: 7, title: 'JSON Config', description: 'Generate and download configuration' }
                ].map((item) => {
                  const isCompleted = wizardData.currentStep > item.step
                  const isCurrent = wizardData.currentStep === item.step
                  const isClickable = isCompleted
                  
                  return (
                    <div
                      key={item.step}
                      onClick={() => isClickable && handleStepClick(item.step)}
                      className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                        wizardData.currentStep >= item.step
                          ? 'bg-blue-900/30 border border-blue-700'
                          : 'bg-gray-800 border border-gray-700'
                      } ${
                        isClickable ? 'cursor-pointer hover:bg-blue-800/40' : 'cursor-default'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                          isCompleted
                            ? 'bg-green-600 text-white'
                            : isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-600 text-gray-400'
                        }`}
                      >
                        {isCompleted ? '✓' : item.step}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          wizardData.currentStep >= item.step ? 'text-white' : 'text-gray-400'
                        }`}>
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500">{item.description}</div>
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
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Selected Assets</h3>
                  <div className="space-y-2">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 0</div>
                      {(() => {
                        const addr = normalizeAddress(wizardData.token0.address) ?? wizardData.token0.address
                        const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`
                        const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                        const explorerUrl = EXPLORER_MAP[chainId] || 'https://etherscan.io'
                        return (
                          <div className="flex items-center gap-1.5 mt-1">
                            <a
                              href={`${explorerUrl}/address/${addr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                            >
                              {short}
                            </a>
                            <CopyButton value={addr} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
                            <span className="text-xs text-gray-400">{wizardData.token0.symbol}</span>
                          </div>
                        )
                      })()}
                    </div>
                    {wizardData.token1 && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 1</div>
                        {(() => {
                          const addr = normalizeAddress(wizardData.token1.address) ?? wizardData.token1.address
                          const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          const explorerUrl = EXPLORER_MAP[chainId] || 'https://etherscan.io'
                          return (
                            <div className="flex items-center gap-1.5 mt-1">
                              <a
                                href={`${explorerUrl}/address/${addr}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                              >
                                {short}
                              </a>
                              <CopyButton value={addr} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
                              <span className="text-xs text-gray-400">{wizardData.token1.symbol}</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Oracle Configuration – not shown on step 11 (verification uses only on-chain data in the tree) */}
              {wizardData.currentStep !== 11 && (wizardData.oracleType0 || wizardData.oracleConfiguration) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Oracle Configuration</h3>
                  <div className="space-y-2">
                    {wizardData.oracleType0 && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 0 Oracle</div>
                        <div className="text-xs text-gray-400 capitalize mb-2">
                          Type: {wizardData.oracleType0.type === 'none' ? 'No Oracle' : wizardData.oracleType0.type === 'scaler' ? 'Scaler Oracle' : wizardData.oracleType0.type === 'ptLinear' ? 'PT-Linear' : 'Chainlink'}
                        </div>
                        {wizardData.oracleConfiguration?.token0.scalerOracle && (() => {
                          const scaler = wizardData.oracleConfiguration.token0.scalerOracle
                          const addr = normalizeAddress(scaler.address) ?? scaler.address
                          const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          const explorerUrl = EXPLORER_MAP[chainId] || 'https://etherscan.io'
                          return (
                            <>
                              <div className="text-xs text-gray-400">{scaler.name}</div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <a
                                  href={`${explorerUrl}/address/${addr}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                                >
                                  {short}
                                </a>
                                <CopyButton value={addr} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
                              </div>
                              <div className={`text-xs mt-1 ${scaler.valid ? 'text-green-400' : 'text-red-400'}`}>
                                {scaler.valid ? 'Valid' : 'Invalid'}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {wizardData.oracleType1 && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 1 Oracle</div>
                        <div className="text-xs text-gray-400 capitalize mb-2">
                          Type: {wizardData.oracleType1.type === 'none' ? 'No Oracle' : wizardData.oracleType1.type === 'scaler' ? 'Scaler Oracle' : wizardData.oracleType1.type === 'ptLinear' ? 'PT-Linear' : 'Chainlink'}
                        </div>
                        {wizardData.oracleConfiguration?.token1.scalerOracle && (() => {
                          const scaler = wizardData.oracleConfiguration.token1.scalerOracle
                          const addr = normalizeAddress(scaler.address) ?? scaler.address
                          const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`
                          const chainId = wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1
                          const explorerUrl = EXPLORER_MAP[chainId] || 'https://etherscan.io'
                          return (
                            <>
                              <div className="text-xs text-gray-400">{scaler.name}</div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <a
                                  href={`${explorerUrl}/address/${addr}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                                >
                                  {short}
                                </a>
                                <CopyButton value={addr} title="Copy address" iconClassName="w-3.5 h-3.5" className="p-0.5" />
                              </div>
                              <div className={`text-xs mt-1 ${scaler.valid ? 'text-green-400' : 'text-red-400'}`}>
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
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Interest Rate Models</h3>
                  <div className="space-y-2">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 0 IRM</div>
                      <div className="text-xs text-gray-400">{wizardData.selectedIRM0.name}</div>
                    </div>
                    {wizardData.selectedIRM1 && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 1 IRM</div>
                        <div className="text-xs text-gray-400">{wizardData.selectedIRM1.name}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Borrow Configuration */}
              {wizardData.borrowConfiguration && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Borrow Configuration</h3>
                  <div className="space-y-2">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 0</div>
                      <div className="text-xs text-gray-400">
                        {wizardData.borrowConfiguration.token0.nonBorrowable && (
                          <span className="text-red-400">Non-borrowable</span>
                        )}
                        {wizardData.borrowConfiguration.token0.nonBorrowable && <br />}
                        LT: {wizardData.borrowConfiguration.token0.liquidationThreshold}% | 
                        Max LTV: {wizardData.borrowConfiguration.token0.maxLTV}% | 
                        Target LTV: {wizardData.borrowConfiguration.token0.liquidationTargetLTV}%
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 1</div>
                      <div className="text-xs text-gray-400">
                        {wizardData.borrowConfiguration.token1.nonBorrowable && (
                          <span className="text-red-400">Non-borrowable</span>
                        )}
                        {wizardData.borrowConfiguration.token1.nonBorrowable && <br />}
                        LT: {wizardData.borrowConfiguration.token1.liquidationThreshold}% | 
                        Max LTV: {wizardData.borrowConfiguration.token1.maxLTV}% | 
                        Target LTV: {wizardData.borrowConfiguration.token1.liquidationTargetLTV}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Fees Configuration */}
              {wizardData.feesConfiguration && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Fees Configuration</h3>
                  <div className="space-y-2">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">General Fees</div>
                      <div className="text-xs text-gray-400">
                        DAO: {wizardData.feesConfiguration.daoFee}% | 
                        Deployer: {wizardData.feesConfiguration.deployerFee}%
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 0 Fees</div>
                      <div className="text-xs text-gray-400">
                        Liquidation: {wizardData.feesConfiguration.token0.liquidationFee}% | 
                        Flashloan: {wizardData.feesConfiguration.token0.flashloanFee}%
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 1 Fees</div>
                      <div className="text-xs text-gray-400">
                        Liquidation: {wizardData.feesConfiguration.token1.liquidationFee}% | 
                        Flashloan: {wizardData.feesConfiguration.token1.flashloanFee}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Owners: Hook Owner + IRM Owner (Kink only) */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Owners</h3>
                <div className="space-y-2">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm font-medium text-white">Hook Owner</div>
                    {wizardData.hookOwnerAddress ? (
                      <OwnerAddressRow address={wizardData.hookOwnerAddress} chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1} />
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">—</div>
                    )}
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm font-medium text-white">IRM Owner</div>
                    {wizardData.irmModelType === 'kink' && wizardData.hookOwnerAddress ? (
                      <OwnerAddressRow address={wizardData.hookOwnerAddress} chainId={wizardData.networkInfo?.chainId ? parseInt(wizardData.networkInfo.chainId, 10) : 1} />
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">not available</div>
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
            className="fixed top-1/2 right-4 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 z-50"
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