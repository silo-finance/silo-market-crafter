'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'

export default function LandingPage() {
  const router = useRouter()
  const { parseJSONConfig, resetWizardWithCache } = useWizard()
  const [jsonInput, setJsonInput] = useState('')
  const [isUploadMode, setIsUploadMode] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [cacheMessage, setCacheMessage] = useState('')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setJsonInput(content)
        setError('')
      }
      reader.readAsText(file)
    }
  }


  const handleStartWizard = () => {
    console.log('Starting wizard - navigating to step 1')
    router.push('/wizard?step=1')
  }

  const handleLoadConfig = async () => {
    if (!jsonInput.trim()) {
      setError('Please provide a JSON configuration')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('Loading JSON config...')
      const success = await parseJSONConfig(jsonInput)
      console.log('JSON parsing result:', success)
      if (success) {
        console.log('JSON loaded successfully - navigating to step 9')
        router.push('/wizard?step=9') // Go directly to Step 9 (JSON Config)
      } else {
        setError('Failed to parse JSON configuration. Please check the format and ensure all required fields are present.')
      }
    } catch (err) {
      console.error('JSON parsing error:', err)
      setError(`Invalid JSON format: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const clearInput = () => {
    setJsonInput('')
    setError('')
  }

  const handleClearCache = () => {
    resetWizardWithCache()
    setJsonInput('')
    setError('')
    setCacheMessage('Cache cleared. You can retry Verify Market now.')
  }

  return (
    <div className="light-market-theme min-h-screen flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-emerald-950 mb-4">
            Silo Market Crafter
          </h1>
          <p className="text-xl text-emerald-800">
            Create or load Silo market configurations
          </p>
        </div>

        {/* Main Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Start New Wizard */}
          <div className="bg-[#f6fbf2] rounded-lg border border-lime-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-lime-800/90 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-emerald-950 mb-4">
                Start New Market
              </h2>
              <p className="text-emerald-700 mb-6">
                Create a new Silo market in few easy steps.
              </p>
              <button
                onClick={handleStartWizard}
                className="w-full bg-lime-800/90 hover:bg-lime-700 text-white cta-strong-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Create New Market
              </button>
            </div>
          </div>

          {/* Load Existing Config */}
          <div className="bg-[#f6fbf2] rounded-lg border border-lime-200 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-lime-700/90 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-emerald-950 mb-4">
                Load Existing Config
              </h2>
              <p className="text-emerald-700 mb-6">
                Upload or paste an existing JSON configuration to edit and deploy.
              </p>
            </div>

            {/* Input Mode Toggle */}
            <div className="flex mb-4">
              <button
                onClick={() => setIsUploadMode(false)}
                className={`flex-1 py-2 px-4 rounded-l-lg font-medium transition-colors ${
                  !isUploadMode
                    ? 'bg-lime-800 text-lime-50'
                    : 'bg-lime-100 text-emerald-800 hover:bg-lime-200'
                }`}
              >
                Paste JSON
              </button>
              <button
                onClick={() => setIsUploadMode(true)}
                className={`flex-1 py-2 px-4 rounded-r-lg font-medium transition-colors ${
                  isUploadMode
                    ? 'bg-lime-800 text-lime-50'
                    : 'bg-lime-100 text-emerald-800 hover:bg-lime-200'
                }`}
              >
                Upload File
              </button>
            </div>

            {/* File Upload */}
            {isUploadMode && (
              <div className="mb-4">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full p-3 bg-white border border-lime-200 rounded-lg text-emerald-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-lime-800 file:text-lime-50 hover:file:bg-lime-700"
                />
              </div>
            )}

            {/* JSON Input */}
            <div className="mb-4">
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value)
                  if (error) setError('') // Clear error when user types
                }}
                placeholder="Paste your JSON configuration here..."
                className="w-full h-32 p-3 bg-white border border-lime-200 rounded-lg text-emerald-900 placeholder-emerald-400 resize-none focus:outline-none focus:ring-2 focus:ring-lime-700"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={clearInput}
                className="flex-1 bg-lime-200 hover:bg-lime-300 text-emerald-900 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleLoadConfig}
                disabled={isLoading || !jsonInput.trim()}
                className="flex-1 bg-lime-800 hover:bg-lime-700 disabled:bg-lime-200 disabled:cursor-not-allowed text-lime-50 disabled:text-emerald-700 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Loading...' : 'Load Config'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12 text-emerald-700 text-sm space-y-4">
          <p>
            Make sure your wallet is connected to determine the correct blockchain for token resolution.
          </p>
          <div className="max-w-2xl mx-auto bg-lime-100/60 border border-lime-200 rounded-lg p-4">
            <p className="text-emerald-900 mb-3">
              If you see UI/runtime errors while opening pages (for example Verify Market), clear local cache and retry.
            </p>
            <button
              onClick={handleClearCache}
              className="bg-orange-600 hover:bg-orange-500 text-white cta-strong-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Clear Cache
            </button>
            {cacheMessage && <p className="mt-2 text-emerald-800">{cacheMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
