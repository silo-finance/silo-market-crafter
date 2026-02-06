'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, FeesConfiguration } from '@/contexts/WizardContext'

interface GeneralFeeInputProps {
  field: 'daoFee' | 'deployerFee'
  label: string
  value: number
  onChange: (field: 'daoFee' | 'deployerFee', value: string) => void
}

interface TokenFeeInputProps {
  tokenIndex: 0 | 1
  field: 'liquidationFee' | 'flashloanFee'
  label: string
  value: number
  disabled?: boolean
  onChange: (tokenIndex: 0 | 1, field: 'liquidationFee' | 'flashloanFee', value: string) => void
}

const GeneralFeeInput = React.memo(({ 
  field, 
  label, 
  value, 
  onChange
}: GeneralFeeInputProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">
        {label}
      </label>
      <div className="relative w-32">
        <input
          type="number"
          min="0"
          max="20"
          step="0.01"
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(field, e.target.value)}
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

GeneralFeeInput.displayName = 'GeneralFeeInput'

const TokenFeeInput = React.memo(({ 
  tokenIndex, 
  field, 
  label, 
  value, 
  disabled = false,
  onChange
}: TokenFeeInputProps) => {
  return (
    <div className="space-y-2">
      <label className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-white'}`}>
        {label}
      </label>
      <div className="relative w-32">
        <input
          type="number"
          min="0"
          max="20"
          step="0.01"
          value={value === 0 ? '' : value}
          disabled={disabled}
          onChange={(e) => onChange(tokenIndex, field, e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 border border-gray-600 text-white'
          }`}
          placeholder="0"
        />
        <div className="absolute right-2 top-2 text-gray-400 text-sm">
          %
        </div>
      </div>
    </div>
  )
})

TokenFeeInput.displayName = 'TokenFeeInput'

export default function Step6Fees() {
  const router = useRouter()
  const { wizardData, updateFeesConfiguration, markStepCompleted } = useWizard()
  
  const [feesConfig, setFeesConfig] = useState<FeesConfiguration>({
    daoFee: 0,
    deployerFee: 0,
    token0: {
      liquidationFee: 0,
      flashloanFee: 0
    },
    token1: {
      liquidationFee: 0,
      flashloanFee: 0
    }
  })

  // Load existing configuration; when one token is non-borrowable, the other token's fees must be 0
  useEffect(() => {
    const borrow = wizardData.borrowConfiguration
    const fees = wizardData.feesConfiguration
    if (!fees) return
    let next = { ...fees }
    if (borrow?.token0.nonBorrowable) {
      next = { ...next, token1: { liquidationFee: 0, flashloanFee: 0 } }
    }
    if (borrow?.token1.nonBorrowable) {
      next = { ...next, token0: { liquidationFee: 0, flashloanFee: 0 } }
    }
    setFeesConfig(next)
  }, [wizardData.borrowConfiguration, wizardData.feesConfiguration])

  const handleGeneralFeeChange = useCallback((field: 'daoFee' | 'deployerFee', value: string) => {
    const numValue = parseFloat(value) || 0
    const clampedValue = Math.max(0, Math.min(20, numValue))
    
    setFeesConfig(prevConfig => ({
      ...prevConfig,
      [field]: clampedValue
    }))
  }, [])

  const handleTokenFeeChange = useCallback((tokenIndex: 0 | 1, field: 'liquidationFee' | 'flashloanFee', value: string) => {
    const borrow = wizardData.borrowConfiguration
    const otherNonBorrowable = tokenIndex === 0 ? borrow?.token1.nonBorrowable : borrow?.token0.nonBorrowable
    if (otherNonBorrowable) return
    const numValue = parseFloat(value) || 0
    const clampedValue = Math.max(0, Math.min(20, numValue))
    setFeesConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      newConfig[`token${tokenIndex}`] = { ...newConfig[`token${tokenIndex}`], [field]: clampedValue }
      return newConfig
    })
  }, [wizardData.borrowConfiguration])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFeesConfiguration(feesConfig)
    markStepCompleted(6)
    router.push('/wizard?step=7')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=5')
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 6: Fees
        </h1>
        <p className="text-gray-300 text-lg">
          Configure general fees and per-token fees (0-20%, step 0.01)
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* General Fees Configuration */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-6">
            General Fees
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            These fees apply to the entire market
          </p>
          
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <GeneralFeeInput
              field="daoFee"
              label="DAO Fee"
              value={feesConfig.daoFee}
              onChange={handleGeneralFeeChange}
            />
            
            <GeneralFeeInput
              field="deployerFee"
              label="Deployer Fee"
              value={feesConfig.deployerFee}
              onChange={handleGeneralFeeChange}
            />
          </div>
        </div>

        {/* Per-Token Fees Configuration - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Token 0 Fees */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Fees for <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <TokenFeeInput
                tokenIndex={0}
                field="liquidationFee"
                label="Liquidation Fee"
                value={feesConfig.token0.liquidationFee}
                disabled={wizardData.borrowConfiguration?.token1.nonBorrowable}
                onChange={handleTokenFeeChange}
              />
              
              <TokenFeeInput
                tokenIndex={0}
                field="flashloanFee"
                label="Flashloan Fee"
                value={feesConfig.token0.flashloanFee}
                disabled={wizardData.borrowConfiguration?.token1.nonBorrowable}
                onChange={handleTokenFeeChange}
              />
            </div>
          </div>

          {/* Token 1 Fees */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Fees for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <TokenFeeInput
                tokenIndex={1}
                field="liquidationFee"
                label="Liquidation Fee"
                value={feesConfig.token1.liquidationFee}
                disabled={wizardData.borrowConfiguration?.token0.nonBorrowable}
                onChange={handleTokenFeeChange}
              />
              
              <TokenFeeInput
                tokenIndex={1}
                field="flashloanFee"
                label="Flashloan Fee"
                value={feesConfig.token1.flashloanFee}
                disabled={wizardData.borrowConfiguration?.token0.nonBorrowable}
                onChange={handleTokenFeeChange}
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
            <span>JSON Config</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
