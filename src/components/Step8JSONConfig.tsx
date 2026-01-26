'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'

export default function Step8JSONConfig() {
  const router = useRouter()
  const { wizardData, generateJSONConfig, markStepCompleted } = useWizard()
  const [jsonConfig, setJsonConfig] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    const config = generateJSONConfig()
    setJsonConfig(config)
  }, [generateJSONConfig])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonConfig)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const handleDownload = () => {
    const token0Symbol = wizardData.token0?.symbol || 'Token0'
    const token1Symbol = wizardData.token1?.symbol || 'Token1'
    const filename = `Silo_${token0Symbol}_${token1Symbol}.json`
    
    const blob = new Blob([jsonConfig], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=8')
  }

  const handleDeploy = () => {
    markStepCompleted(9)
    // Here you would typically trigger the actual deployment
    console.log('Deploying market with config:', jsonConfig)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 9: JSON Configuration
        </h1>
        <p className="text-gray-300 text-lg">
          Review and download your market configuration
        </p>
      </div>

      {/* JSON Configuration Display */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Market Configuration</h3>
          <div className="flex space-x-3">
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                copySuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copySuccess ? '✓ Copied!' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Download JSON
            </button>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
            {jsonConfig}
          </pre>
        </div>
      </div>

      {/* Information Note */}
      <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h4 className="text-blue-400 font-semibold mb-2">Deployment Options</h4>
            <p className="text-sm text-gray-300">
              This JSON configuration can be used to deploy a market using a PR request. If you want to deploy the market directly from the wizard, proceed to the final step - deployment.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={goToPreviousStep}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
            <span>Hook Owner</span>
        </button>
        
        <button
          onClick={handleDeploy}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>Deploy Market</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
