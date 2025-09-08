'use client'

import React, { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

interface WizardLayoutProps {
  children: React.ReactNode
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const { wizardData } = useWizard()
  const [isSummaryOpen, setIsSummaryOpen] = useState(true)

  const getBlockExplorerUrl = (address: string, chainId: string) => {
    const networkMap: { [key: string]: string } = {
      '1': 'https://etherscan.io/address/',
      '3': 'https://ropsten.etherscan.io/address/',
      '4': 'https://rinkeby.etherscan.io/address/',
      '5': 'https://goerli.etherscan.io/address/',
      '42': 'https://kovan.etherscan.io/address/',
      '11155111': 'https://sepolia.etherscan.io/address/',
      '137': 'https://polygonscan.com/address/',
      '80001': 'https://mumbai.polygonscan.com/address/',
      '1101': 'https://zkevm.polygonscan.com/address/',
      '1442': 'https://testnet-zkevm.polygonscan.com/address/',
      '10': 'https://optimistic.etherscan.io/address/',
      '420': 'https://goerli-optimism.etherscan.io/address/',
      '8453': 'https://basescan.org/address/',
      '84531': 'https://goerli.basescan.org/address/',
      '42161': 'https://arbiscan.io/address/',
      '421613': 'https://goerli.arbiscan.io/address/',
      '56': 'https://bscscan.com/address/',
      '97': 'https://testnet.bscscan.com/address/',
      '250': 'https://ftmscan.com/address/',
      '4002': 'https://testnet.ftmscan.com/address/',
      '43114': 'https://snowtrace.io/address/',
      '43113': 'https://testnet.snowtrace.io/address/',
      '146': 'https://sonicscan.org/address/',
      '653': 'https://testnet.sonicscan.org/address/'
    }
    
    const baseUrl = networkMap[chainId] || 'https://etherscan.io/address/'
    return `${baseUrl}${address}`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Main Content */}
        <div className={`transition-all duration-300 ${isSummaryOpen ? 'w-2/3' : 'w-full'}`}>
          <div className="p-8">
            {children}
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className={`${isSummaryOpen ? 'w-1/3' : 'w-0'} transition-all duration-300 overflow-hidden`}>
          <div className="bg-gray-900 border-l border-gray-800 h-screen p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Market Setup Summary</h2>
              <button
                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isSummaryOpen ? "Hide Summary" : "Show Summary"}
              >
                {isSummaryOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                )}
              </button>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  wizardData.completedSteps.includes(1) 
                    ? 'bg-green-600 text-white' 
                    : wizardData.currentStep === 1 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {wizardData.completedSteps.includes(1) ? '✓' : '1'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Step 1: Asset Selection</div>
                  <div className="text-xs text-gray-400">Choose tokens for your market</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  wizardData.completedSteps.includes(2) 
                    ? 'bg-green-600 text-white' 
                    : wizardData.currentStep === 2 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {wizardData.completedSteps.includes(2) ? '✓' : '2'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Step 2: Silo Configuration</div>
                  <div className="text-xs text-gray-400">Configure first silo</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  wizardData.completedSteps.includes(3) 
                    ? 'bg-green-600 text-white' 
                    : wizardData.currentStep === 3 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {wizardData.completedSteps.includes(3) ? '✓' : '3'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Step 3: Second Silo</div>
                  <div className="text-xs text-gray-400">Configure second silo</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  wizardData.completedSteps.includes(4) 
                    ? 'bg-green-600 text-white' 
                    : wizardData.currentStep === 4 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {wizardData.completedSteps.includes(4) ? '✓' : '4'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Step 4: Deploy Market</div>
                  <div className="text-xs text-gray-400">Deploy the complete market</div>
                </div>
              </div>
            </div>

            {/* Step 1 Details */}
            {wizardData.networkInfo && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Network Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Network:</span>
                    <span className="text-white">{wizardData.networkInfo.networkName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Chain ID:</span>
                    <span className="text-white">{wizardData.networkInfo.chainId}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Token Details */}
            {wizardData.token0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Token 0</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Symbol:</span>
                    <span className="text-white">{wizardData.token0.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-white">{wizardData.token0.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Decimals:</span>
                    <span className="text-white">{wizardData.token0.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Address:</span>
                    <a 
                      href={getBlockExplorerUrl(wizardData.token0.address, wizardData.networkInfo?.chainId || '1')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 truncate max-w-32"
                    >
                      {wizardData.token0.address.slice(0, 6)}...{wizardData.token0.address.slice(-4)}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {wizardData.token1 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Token 1</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Symbol:</span>
                    <span className="text-white">{wizardData.token1.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-white">{wizardData.token1.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Decimals:</span>
                    <span className="text-white">{wizardData.token1.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Address:</span>
                    <a 
                      href={getBlockExplorerUrl(wizardData.token1.address, wizardData.networkInfo?.chainId || '1')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 truncate max-w-32"
                    >
                      {wizardData.token1.address.slice(0, 6)}...{wizardData.token1.address.slice(-4)}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Button for Mobile */}
            <div className="lg:hidden mt-6">
              <button
                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isSummaryOpen ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Hide Summary</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Show Summary</span>
                  </>
                )}
              </button>
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
  )
}
