'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useWizard, FeesConfiguration } from '@/contexts/WizardContext'

interface FeeInputProps {
  tokenIndex: 0 | 1
  field: 'daoFee' | 'deployerFee' | 'liquidationFee' | 'flashloanFee'
  label: string
  value: number
  onChange: (tokenIndex: 0 | 1, field: 'daoFee' | 'deployerFee' | 'liquidationFee' | 'flashloanFee', value: string) => void
}

const FeeInput = React.memo(({ 
  tokenIndex, 
  field, 
  label, 
  value, 
  onChange
}: FeeInputProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">
        {label}
      </label>
      <div className="relative w-20">
        <input
          type="number"
          min="0"
          max="20"
          step="0.01"
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(tokenIndex, field, e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
          placeholder="0"
        />
        <div className="absolute right-2 top-2 text-gray-400 text-sm">
          %
        </div>
      </div>
    </div>
  )
})

FeeInput.displayName = 'FeeInput'

export default function Step6Fees() {
  const { wizardData, updateFeesConfiguration, updateStep, markStepCompleted } = useWizard()
  
  const [feesConfig, setFeesConfig] = useState<FeesConfiguration>({
    token0: {
      daoFee: 0,
      deployerFee: 0,
      liquidationFee: 0,
      flashloanFee: 0
    },
    token1: {
      daoFee: 0,
      deployerFee: 0,
      liquidationFee: 0,
      flashloanFee: 0
    }
  })

  // Load existing configuration if available
  useEffect(() => {
    if (wizardData.feesConfiguration) {
      setFeesConfig(wizardData.feesConfiguration)
    }
  }, [wizardData.feesConfiguration])

  const handleFeeChange = useCallback((tokenIndex: 0 | 1, field: 'daoFee' | 'deployerFee' | 'liquidationFee' | 'flashloanFee', value: string) => {
    const numValue = parseFloat(value) || 0
    const clampedValue = Math.max(0, Math.min(20, numValue))
    
    setFeesConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      newConfig[`token${tokenIndex}`] = { 
        ...newConfig[`token${tokenIndex}`], 
        [field]: clampedValue
      }
      return newConfig
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFeesConfiguration(feesConfig)
    markStepCompleted(6)
    updateStep(7)
  }

  const goToPreviousStep = () => {
    updateStep(5)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 6: Fees
        </h1>
        <p className="text-gray-300 text-lg">
          Configure fees for each token (0-20%, step 0.01)
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Fees Configuration - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Token 0 Fees */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Fees for <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <FeeInput
                tokenIndex={0}
                field="daoFee"
                label="DAO Fee"
                value={feesConfig.token0.daoFee}
                onChange={handleFeeChange}
              />
              
              <FeeInput
                tokenIndex={0}
                field="deployerFee"
                label="Deployer Fee"
                value={feesConfig.token0.deployerFee}
                onChange={handleFeeChange}
              />
              
              <FeeInput
                tokenIndex={0}
                field="liquidationFee"
                label="Liquidation Fee"
                value={feesConfig.token0.liquidationFee}
                onChange={handleFeeChange}
              />
              
              <FeeInput
                tokenIndex={0}
                field="flashloanFee"
                label="Flashloan Fee"
                value={feesConfig.token0.flashloanFee}
                onChange={handleFeeChange}
              />
            </div>
          </div>

          {/* Token 1 Fees */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Fees for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <FeeInput
                tokenIndex={1}
                field="daoFee"
                label="DAO Fee"
                value={feesConfig.token1.daoFee}
                onChange={handleFeeChange}
              />
              
              <FeeInput
                tokenIndex={1}
                field="deployerFee"
                label="Deployer Fee"
                value={feesConfig.token1.deployerFee}
                onChange={handleFeeChange}
              />
              
              <FeeInput
                tokenIndex={1}
                field="liquidationFee"
                label="Liquidation Fee"
                value={feesConfig.token1.liquidationFee}
                onChange={handleFeeChange}
              />
              
              <FeeInput
                tokenIndex={1}
                field="flashloanFee"
                label="Flashloan Fee"
                value={feesConfig.token1.flashloanFee}
                onChange={handleFeeChange}
              />
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
            <span>Borrow Setup</span>
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
