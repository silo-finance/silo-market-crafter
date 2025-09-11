'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useWizard, BorrowConfiguration } from '@/contexts/WizardContext'

interface InputComponentProps {
  tokenIndex: 0 | 1
  field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV'
  label: string
  value: number
  max?: number
  onChange: (tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: string) => void
}

const InputComponent = React.memo(({ 
  tokenIndex, 
  field, 
  label, 
  value, 
  max = 100,
  onChange
}: InputComponentProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">
        {label}
      </label>
      <div className="relative w-24">
        <input
          type="number"
          min="0"
          max={max}
          step="1"
          value={value}
          onChange={(e) => onChange(tokenIndex, field, e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
          placeholder="0"
        />
        <div className="absolute right-3 top-2 text-gray-400 text-sm">
          %
        </div>
      </div>
    </div>
  )
})

InputComponent.displayName = 'InputComponent'

export default function Step5BorrowSetup() {
  const { wizardData, updateBorrowConfiguration, updateStep, markStepCompleted } = useWizard()
  
  const [borrowConfig, setBorrowConfig] = useState<BorrowConfiguration>({
    token0: {
      liquidationThreshold: 80,
      maxLTV: 75,
      liquidationTargetLTV: 70
    },
    token1: {
      liquidationThreshold: 80,
      maxLTV: 75,
      liquidationTargetLTV: 70
    }
  })

  // Load existing configuration if available
  useEffect(() => {
    if (wizardData.borrowConfiguration) {
      setBorrowConfig(wizardData.borrowConfiguration)
    }
  }, [wizardData.borrowConfiguration])

  const handleInputChange = useCallback((tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: string) => {
    const numValue = parseInt(value) || 0
    const clampedValue = Math.max(0, Math.min(100, numValue))
    
    setBorrowConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      newConfig[`token${tokenIndex}`] = { ...newConfig[`token${tokenIndex}`], [field]: clampedValue }
      
      // Apply validation rules
      const tokenConfig = newConfig[`token${tokenIndex}`]
      
      // maxLTV must be <= liquidationThreshold
      if (field === 'liquidationThreshold' && tokenConfig.maxLTV > clampedValue) {
        tokenConfig.maxLTV = clampedValue
      }
      if (field === 'maxLTV' && clampedValue > tokenConfig.liquidationThreshold) {
        tokenConfig.maxLTV = tokenConfig.liquidationThreshold
      }
      
      // liquidationTargetLTV must be < liquidationThreshold
      if (field === 'liquidationThreshold' && tokenConfig.liquidationTargetLTV >= clampedValue) {
        tokenConfig.liquidationTargetLTV = Math.max(0, clampedValue - 1)
      }
      if (field === 'liquidationTargetLTV' && clampedValue >= tokenConfig.liquidationThreshold) {
        tokenConfig.liquidationTargetLTV = Math.max(0, tokenConfig.liquidationThreshold - 1)
      }
      
      return newConfig
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateBorrowConfiguration(borrowConfig)
    markStepCompleted(5)
    updateStep(6)
  }

  const goToPreviousStep = () => {
    updateStep(4)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 5: Borrow Setup
        </h1>
        <p className="text-gray-300 text-lg">
          Configure borrowing parameters for each token
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Borrow Configuration - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Token 0 Configuration */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Borrow Configuration for <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
            </h3>
            
            <div className="space-y-6">
              <InputComponent
                tokenIndex={0}
                field="liquidationThreshold"
                label="Liquidation Threshold (LT)"
                value={borrowConfig.token0.liquidationThreshold}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={0}
                field="maxLTV"
                label="Max LTV"
                value={borrowConfig.token0.maxLTV}
                max={borrowConfig.token0.liquidationThreshold}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={0}
                field="liquidationTargetLTV"
                label="Liquidation Target LTV"
                value={borrowConfig.token0.liquidationTargetLTV}
                max={borrowConfig.token0.liquidationThreshold - 1}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Token 1 Configuration */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Borrow Configuration for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
            </h3>
            
            <div className="space-y-6">
              <InputComponent
                tokenIndex={1}
                field="liquidationThreshold"
                label="Liquidation Threshold (LT)"
                value={borrowConfig.token1.liquidationThreshold}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={1}
                field="maxLTV"
                label="Max LTV"
                value={borrowConfig.token1.maxLTV}
                max={borrowConfig.token1.liquidationThreshold}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={1}
                field="liquidationTargetLTV"
                label="Liquidation Target LTV"
                value={borrowConfig.token1.liquidationTargetLTV}
                max={borrowConfig.token1.liquidationThreshold - 1}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Validation Rules Info */}
        <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-6">
          <h4 className="text-blue-400 font-semibold mb-2">Validation Rules:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Max LTV must be less than or equal to Liquidation Threshold</li>
            <li>• Liquidation Target LTV must be less than Liquidation Threshold</li>
            <li>• All values are automatically adjusted to maintain these rules</li>
          </ul>
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
            <span>IRM Selection</span>
          </button>
          
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <span>Deploy Market</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>

    </div>
  )
}
