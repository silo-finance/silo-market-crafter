'use client'

import { useWizard } from '@/contexts/WizardContext'
import { useState } from 'react'

interface WizardLayoutProps {
  children: React.ReactNode
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const { data, updateStep, resetWizard } = useWizard()
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false)

  const getBlockExplorerUrl = (address: string) => {
    const networkId = data.networkId
    const explorers: { [key: string]: string } = {
      '1': 'https://etherscan.io',
      '137': 'https://polygonscan.com',
      '10': 'https://optimistic.etherscan.io',
      '42161': 'https://arbiscan.io',
      '56': 'https://bscscan.com',
      '43114': 'https://snowtrace.io',
      '250': 'https://ftmscan.com',
      '8453': 'https://basescan.org',
      '59144': 'https://lineascan.build',
      '534352': 'https://scrollscan.com',
      '5000': 'https://mantlescan.xyz',
      '42220': 'https://celoscan.io',
      '100': 'https://gnosisscan.io',
      '1284': 'https://moonscan.io',
      '25': 'https://cronoscan.com',
      '8217': 'https://scope.klaytn.com',
      '1088': 'https://andromeda-explorer.metis.io',
      '288': 'https://bobascan.com',
      '324': 'https://explorer.zksync.io',
      '146': 'https://sonicscan.org',
    }
    
    const baseUrl = explorers[networkId || '1'] || 'https://etherscan.io'
    return `${baseUrl}/token/${address}`
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => updateStep(0)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                ← Back to Home
              </button>
              <div className="text-white font-semibold">
                Create New Market
              </div>
            </div>
            <button
              onClick={resetWizard}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Reset Wizard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {children}
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-lg border border-gray-800 sticky top-8">
              <div
                className="p-4 border-b border-gray-800 cursor-pointer"
                onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-semibold">Progress Summary</h3>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isSummaryCollapsed ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {!isSummaryCollapsed && (
                <div className="p-4 space-y-4">
                  {/* Network Info */}
                  {data.networkName && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-gray-400 mb-1">Network</div>
                      <div className="text-white font-medium">
                        {data.networkName} ({data.networkId})
                      </div>
                    </div>
                  )}

                  {/* Steps Progress */}
                  <div className="space-y-3">
                    {data.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`p-3 rounded-lg border ${
                          step.completed
                            ? 'bg-green-900/20 border-green-700'
                            : step.id === data.currentStep
                            ? 'bg-blue-900/20 border-blue-700'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              step.completed
                                ? 'bg-green-600 text-white'
                                : step.id === data.currentStep
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 text-gray-300'
                            }`}
                          >
                            {step.completed ? '✓' : step.id}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium text-sm">
                              {step.title}
                            </div>
                            {step.details && (
                              <div className="text-gray-400 text-xs mt-1">
                                {step.details}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Token Details */}
                  {data.token0 && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-gray-400 mb-2">Token 0</div>
                      <div className="text-white font-medium mb-1">
                        {data.token0.symbol}
                      </div>
                      <a
                        href={getBlockExplorerUrl(data.token0.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs break-all"
                      >
                        {data.token0.address}
                      </a>
                    </div>
                  )}

                  {data.token1 && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-gray-400 mb-2">Token 1</div>
                      <div className="text-white font-medium mb-1">
                        {data.token1.symbol}
                      </div>
                      <a
                        href={getBlockExplorerUrl(data.token1.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs break-all"
                      >
                        {data.token1.address}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
