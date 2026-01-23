'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, IRMConfig } from '@/contexts/WizardContext'

interface IRMConfigItem {
  name: string
  config: {
    [key: string]: string | number | boolean
  }
}

type IRMDeployments = IRMConfigItem[]

export default function Step4IRMSelection() {
  const router = useRouter()
  const { wizardData, updateSelectedIRM0, updateSelectedIRM1, markStepCompleted } = useWizard()
  
  const [, setIrmDeployments] = useState<IRMDeployments | null>(null)
  const [availableIRMs, setAvailableIRMs] = useState<IRMConfig[]>([])
  const [filteredIRMs, setFilteredIRMs] = useState<IRMConfig[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIRM0, setSelectedIRM0] = useState<IRMConfig | null>(wizardData.selectedIRM0)
  const [selectedIRM1, setSelectedIRM1] = useState<IRMConfig | null>(wizardData.selectedIRM1)


  // Fetch IRM configurations from GitHub
  useEffect(() => {
    const fetchIRMConfigs = async () => {
      try {
        setLoading(true)
        setError('')
        
        const response = await fetch(
          'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/InterestRateModelConfigs.json'
        )
        
        if (!response.ok) {
          throw new Error(`Failed to fetch IRM configs: ${response.statusText}`)
        }
        
        const data: IRMDeployments = await response.json()
        setIrmDeployments(data)
        
        // Convert array format to IRMConfig array
        const irmConfigs: IRMConfig[] = data.map(item => ({
          name: item.name,
          config: item.config
        }))
        
        setAvailableIRMs(irmConfigs)
        setFilteredIRMs(irmConfigs)
        
      } catch (err) {
        console.error('Error fetching IRM configs:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch IRM configurations')
      } finally {
        setLoading(false)
      }
    }

    fetchIRMConfigs()
  }, [])

  // Filter IRMs based on search term, but always include selected items
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredIRMs(availableIRMs)
    } else {
      const filtered = availableIRMs.filter(irm =>
        irm.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      // Always include selected items even if they don't match search
      const selectedItems = []
      if (selectedIRM0 && !filtered.find(irm => irm.name === selectedIRM0.name)) {
        selectedItems.push(selectedIRM0)
      }
      if (selectedIRM1 && !filtered.find(irm => irm.name === selectedIRM1.name)) {
        selectedItems.push(selectedIRM1)
      }
      
      setFilteredIRMs([...filtered, ...selectedItems])
    }
  }, [searchTerm, availableIRMs, selectedIRM0, selectedIRM1])

  const handleIRMSelection = (tokenIndex: 0 | 1, irm: IRMConfig) => {
    if (tokenIndex === 0) {
      setSelectedIRM0(irm)
      updateSelectedIRM0(irm)
    } else {
      setSelectedIRM1(irm)
      updateSelectedIRM1(irm)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedIRM0 || !selectedIRM1) {
      setError('Please select Interest Rate Models for both tokens')
      return
    }
    
    markStepCompleted(4)
    router.push('/wizard?step=5')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=3')
  }

  const formatParameterValue = (value: string | number | boolean): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Step 4: Interest Rate Model Selection
          </h1>
          <p className="text-gray-300 text-lg">
            Loading available Interest Rate Models...
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Fetching IRM configurations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 4: Interest Rate Model Selection
        </h1>
        <p className="text-gray-300 text-lg">
          Choose an Interest Rate Model for your market
        </p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <div className="text-red-400 text-sm">
            ✗ {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Search */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
            Search Interest Rate Models
          </label>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name (case insensitive)..."
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-2">
            Found {filteredIRMs.length} IRM{filteredIRMs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* IRM Selection - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* IRM Selection for Token 0 */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Interest Rate Model for <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
            </h3>
            
            {filteredIRMs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  {searchTerm ? 'No IRMs found matching your search.' : 'No IRMs available.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredIRMs.map((irm) => {
                  const isSelected = selectedIRM0?.name === irm.name
                  const isSearchMatch = !searchTerm.trim() || irm.name.toLowerCase().includes(searchTerm.toLowerCase())
                  
                  return (
                    <div
                      key={`token0-${irm.name}`}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-700 hover:border-gray-600'
                      } ${!isSearchMatch ? 'opacity-75' : ''}`}
                      onClick={() => handleIRMSelection(0, irm)}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="irm0"
                          value={irm.name}
                          checked={isSelected}
                          onChange={() => handleIRMSelection(0, irm)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white">
                              {irm.name}
                            </h4>
                            {isSelected && (
                              <span className="text-green-400 text-xs font-medium">
                                ✓ Selected
                              </span>
                            )}
                          </div>
                          
                          {/* Inline Parameters */}
                          {isSelected && (
                            <div className="mt-3">
                              <div className="bg-gray-800 rounded p-3 text-xs">
                                <div className="text-gray-300 space-y-1">
                                  {Object.entries(irm.config).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-blue-400">{key}:</span>
                                      <span className="text-gray-200">{formatParameterValue(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* IRM Selection for Token 1 */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Interest Rate Model for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
            </h3>
            
            {filteredIRMs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  {searchTerm ? 'No IRMs found matching your search.' : 'No IRMs available.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredIRMs.map((irm) => {
                  const isSelected = selectedIRM1?.name === irm.name
                  const isSearchMatch = !searchTerm.trim() || irm.name.toLowerCase().includes(searchTerm.toLowerCase())
                  
                  return (
                    <div
                      key={`token1-${irm.name}`}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-700 hover:border-gray-600'
                      } ${!isSearchMatch ? 'opacity-75' : ''}`}
                      onClick={() => handleIRMSelection(1, irm)}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="irm1"
                          value={irm.name}
                          checked={isSelected}
                          onChange={() => handleIRMSelection(1, irm)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white">
                              {irm.name}
                            </h4>
                            {isSelected && (
                              <span className="text-green-400 text-xs font-medium">
                                ✓ Selected
                              </span>
                            )}
                          </div>
                          
                          {/* Inline Parameters */}
                          {isSelected && (
                            <div className="mt-3">
                              <div className="bg-gray-800 rounded p-3 text-xs">
                                <div className="text-gray-300 space-y-1">
                                  {Object.entries(irm.config).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-blue-400">{key}:</span>
                                      <span className="text-gray-200">{formatParameterValue(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
            <span>Oracle Configuration</span>
          </button>
          
          <button
            type="submit"
            disabled={!selectedIRM0 || !selectedIRM1}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <span>Borrow Setup</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
