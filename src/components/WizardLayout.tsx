'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import ResetButton from '@/components/ResetButton'

interface WizardLayoutProps {
  children: React.ReactNode
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const { wizardData, updateStep } = useWizard()
  const [isSummaryOpen, setIsSummaryOpen] = useState(true)
  const summaryRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when wizard data changes
  useEffect(() => {
    if (summaryRef.current && isSummaryOpen) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        summaryRef.current?.scrollTo({
          top: summaryRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }, [wizardData, isSummaryOpen])


  if (wizardData.currentStep === 0) {
    // Landing page - no sidebar
    return (
      <div className="min-h-screen bg-black text-white">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Main Content */}
        <div className={`transition-all duration-300 ${isSummaryOpen ? 'w-2/3' : 'w-full'}`}>
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

        {/* Summary Sidebar */}
        <div className={`${isSummaryOpen ? 'w-1/3' : 'w-0'} transition-all duration-300 overflow-hidden`}>
          <div ref={summaryRef} className="bg-gray-900 border-l border-gray-800 h-screen p-6 overflow-y-auto">
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
                ].map((item) => (
                  <div
                    key={item.step}
                    className={`flex items-center space-x-3 p-2 rounded-lg ${
                      wizardData.currentStep >= item.step
                        ? 'bg-blue-900/30 border border-blue-700'
                        : 'bg-gray-800 border border-gray-700'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        wizardData.currentStep > item.step
                          ? 'bg-green-600 text-white'
                          : wizardData.currentStep === item.step
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-600 text-gray-400'
                      }`}
                    >
                      {wizardData.currentStep > item.step ? '✓' : item.step}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${
                        wizardData.currentStep >= item.step ? 'text-white' : 'text-gray-400'
                      }`}>
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                  </div>
                ))}
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
                      <div className="text-xs text-gray-400">{wizardData.token0.symbol}</div>
                      <div className="text-xs text-gray-500">{wizardData.token0.address}</div>
                    </div>
                    {wizardData.token1 && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 1</div>
                        <div className="text-xs text-gray-400">{wizardData.token1.symbol}</div>
                        <div className="text-xs text-gray-500">{wizardData.token1.address}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Oracle Types */}
              {wizardData.oracleType0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Oracle Types</h3>
                  <div className="space-y-2">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 0 Oracle</div>
                      <div className="text-xs text-gray-400 capitalize">{wizardData.oracleType0.type}</div>
                    </div>
                    {wizardData.oracleType1 && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 1 Oracle</div>
                        <div className="text-xs text-gray-400 capitalize">{wizardData.oracleType1.type}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Oracle Configuration */}
              {wizardData.oracleConfiguration && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Oracle Configuration</h3>
                  <div className="space-y-2">
                    {wizardData.oracleConfiguration.token0.scalerOracle && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 0 Scaler</div>
                        <div className="text-xs text-gray-400">{wizardData.oracleConfiguration.token0.scalerOracle.name}</div>
                        <div className="text-xs text-gray-500">{wizardData.oracleConfiguration.token0.scalerOracle.address}</div>
                        <div className={`text-xs ${wizardData.oracleConfiguration.token0.scalerOracle.valid ? 'text-green-400' : 'text-red-400'}`}>
                          {wizardData.oracleConfiguration.token0.scalerOracle.valid ? 'Valid' : 'Invalid'}
                        </div>
                      </div>
                    )}
                    {wizardData.oracleConfiguration.token1.scalerOracle && (
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="text-sm font-medium text-white">Token 1 Scaler</div>
                        <div className="text-xs text-gray-400">{wizardData.oracleConfiguration.token1.scalerOracle.name}</div>
                        <div className="text-xs text-gray-500">{wizardData.oracleConfiguration.token1.scalerOracle.address}</div>
                        <div className={`text-xs ${wizardData.oracleConfiguration.token1.scalerOracle.valid ? 'text-green-400' : 'text-red-400'}`}>
                          {wizardData.oracleConfiguration.token1.scalerOracle.valid ? 'Valid' : 'Invalid'}
                        </div>
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
                        {wizardData.borrowConfiguration.token0.nonBorrowable ? (
                          <span className="text-red-400">Non-borrowable</span>
                        ) : (
                          <>
                            LT: {wizardData.borrowConfiguration.token0.liquidationThreshold}% | 
                            Max LTV: {wizardData.borrowConfiguration.token0.maxLTV}% | 
                            Target LTV: {wizardData.borrowConfiguration.token0.liquidationTargetLTV}%
                          </>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-white">Token 1</div>
                      <div className="text-xs text-gray-400">
                        {wizardData.borrowConfiguration.token1.nonBorrowable ? (
                          <span className="text-red-400">Non-borrowable</span>
                        ) : (
                          <>
                            LT: {wizardData.borrowConfiguration.token1.liquidationThreshold}% | 
                            Max LTV: {wizardData.borrowConfiguration.token1.maxLTV}% | 
                            Target LTV: {wizardData.borrowConfiguration.token1.liquidationTargetLTV}%
                          </>
                        )}
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