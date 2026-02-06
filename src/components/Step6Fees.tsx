'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, FeesConfiguration } from '@/contexts/WizardContext'
import { bigintToDisplayNumber, displayNumberToBigint } from '@/utils/verification/normalization'

interface GeneralFeeInputProps {
  field: 'daoFee' | 'deployerFee'
  label: string
  value: bigint
  displayValue: string
  onChange: (field: 'daoFee' | 'deployerFee', value: string) => void
  onBlur: (field: 'daoFee' | 'deployerFee') => void
}

interface TokenFeeInputProps {
  tokenIndex: 0 | 1
  field: 'liquidationFee' | 'flashloanFee'
  label: string
  value: bigint
  displayValue: string
  disabled?: boolean
  onChange: (tokenIndex: 0 | 1, field: 'liquidationFee' | 'flashloanFee', value: string) => void
  onBlur: (tokenIndex: 0 | 1, field: 'liquidationFee' | 'flashloanFee') => void
}

const GeneralFeeInput = React.memo(({ 
  field, 
  label, 
  displayValue,
  onChange,
  onBlur
}: GeneralFeeInputProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">
        {label}
      </label>
      <div className="relative w-32">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => onChange(field, e.target.value)}
          onBlur={() => onBlur(field)}
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
  displayValue,
  disabled = false,
  onChange,
  onBlur
}: TokenFeeInputProps) => {
  return (
    <div className="space-y-2">
      <label className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-white'}`}>
        {label}
      </label>
      <div className="relative w-32">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          disabled={disabled}
          onChange={(e) => onChange(tokenIndex, field, e.target.value)}
          onBlur={() => onBlur(tokenIndex, field)}
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

// Helper function to format number without scientific notation
function formatNumberForDisplay(value: number): string {
  if (value === 0) return ''
  // Use toFixed to avoid scientific notation, then remove trailing zeros
  return value.toFixed(10).replace(/\.?0+$/, '')
}

export default function Step6Fees() {
  const router = useRouter()
  const { wizardData, updateFeesConfiguration, markStepCompleted } = useWizard()
  
  const [feesConfig, setFeesConfig] = useState<FeesConfiguration>({
    daoFee: BigInt(0),
    deployerFee: BigInt(0),
    token0: {
      liquidationFee: BigInt(0),
      flashloanFee: BigInt(0)
    },
    token1: {
      liquidationFee: BigInt(0),
      flashloanFee: BigInt(0)
    }
  })

  // Local state for display values (strings) during input
  const [displayValues, setDisplayValues] = useState<{
    daoFee: string
    deployerFee: string
    token0: { liquidationFee: string; flashloanFee: string }
    token1: { liquidationFee: string; flashloanFee: string }
  }>({
    daoFee: '',
    deployerFee: '',
    token0: { liquidationFee: '', flashloanFee: '' },
    token1: { liquidationFee: '', flashloanFee: '' }
  })

  // Load existing configuration; when one token is non-borrowable, the other token's fees must be 0
  useEffect(() => {
    const borrow = wizardData.borrowConfiguration
    const fees = wizardData.feesConfiguration
    if (!fees) return
    let next = { ...fees }
    if (borrow?.token0.nonBorrowable) {
      next = { ...next, token1: { liquidationFee: BigInt(0), flashloanFee: BigInt(0) } }
    }
    if (borrow?.token1.nonBorrowable) {
      next = { ...next, token0: { liquidationFee: BigInt(0), flashloanFee: BigInt(0) } }
    }
    setFeesConfig(next)
    
    // Initialize display values from BigInt values
    setDisplayValues({
      daoFee: formatNumberForDisplay(bigintToDisplayNumber(next.daoFee)),
      deployerFee: formatNumberForDisplay(bigintToDisplayNumber(next.deployerFee)),
      token0: {
        liquidationFee: formatNumberForDisplay(bigintToDisplayNumber(next.token0.liquidationFee)),
        flashloanFee: formatNumberForDisplay(bigintToDisplayNumber(next.token0.flashloanFee))
      },
      token1: {
        liquidationFee: formatNumberForDisplay(bigintToDisplayNumber(next.token1.liquidationFee)),
        flashloanFee: formatNumberForDisplay(bigintToDisplayNumber(next.token1.flashloanFee))
      }
    })
  }, [wizardData.borrowConfiguration, wizardData.feesConfiguration])

  const handleGeneralFeeChange = useCallback((field: 'daoFee' | 'deployerFee', value: string) => {
    // Normalize comma to dot for decimal separator
    const normalized = value.replace(',', '.')
    
    // Allow empty string, numbers, and partial numbers (e.g., "4.", "4.0")
    // Only allow digits, one dot, and optionally a minus sign at the start
    const isValidInput = normalized === '' || /^-?\d*\.?\d*$/.test(normalized)
    
    if (!isValidInput) {
      return // Don't update if invalid input
    }
    
    // Update display value immediately (allows typing dots and partial numbers)
    setDisplayValues(prev => ({
      ...prev,
      [field]: normalized
    }))
  }, [])

  const handleGeneralFeeBlur = useCallback((field: 'daoFee' | 'deployerFee') => {
    const displayValue = displayValues[field]
    
    // Normalize comma to dot
    const normalized = displayValue.replace(',', '.')
    
    // Parse as number
    const parsed = parseFloat(normalized)
    
    // Convert to BigInt using displayNumberToBigint (no rounding - exact precision)
    const bigintValue = Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
    
    // Update BigInt value
    setFeesConfig(prevConfig => ({
      ...prevConfig,
      [field]: bigintValue
    }))
    
    // Update display value to formatted version (without scientific notation)
    const formattedValue = formatNumberForDisplay(bigintToDisplayNumber(bigintValue))
    setDisplayValues(prev => ({
      ...prev,
      [field]: formattedValue
    }))
  }, [displayValues])

  const handleTokenFeeChange = useCallback((tokenIndex: 0 | 1, field: 'liquidationFee' | 'flashloanFee', value: string) => {
    const borrow = wizardData.borrowConfiguration
    const otherNonBorrowable = tokenIndex === 0 ? borrow?.token1.nonBorrowable : borrow?.token0.nonBorrowable
    if (otherNonBorrowable) return
    
    // Normalize comma to dot for decimal separator
    const normalized = value.replace(',', '.')
    
    // Allow empty string, numbers, and partial numbers
    const isValidInput = normalized === '' || /^-?\d*\.?\d*$/.test(normalized)
    
    if (!isValidInput) {
      return // Don't update if invalid input
    }
    
    // Update display value immediately
    setDisplayValues(prev => ({
      ...prev,
      [`token${tokenIndex}`]: {
        ...prev[`token${tokenIndex}`],
        [field]: normalized
      }
    }))
  }, [wizardData.borrowConfiguration])

  const handleTokenFeeBlur = useCallback((tokenIndex: 0 | 1, field: 'liquidationFee' | 'flashloanFee') => {
    const displayValue = displayValues[`token${tokenIndex}`][field]
    
    // Normalize comma to dot
    const normalized = displayValue.replace(',', '.')
    
    // Parse as number
    const parsed = parseFloat(normalized)
    
    // Convert to BigInt using displayNumberToBigint (no rounding - exact precision)
    const bigintValue = Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
    
    // Update BigInt value
    setFeesConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      newConfig[`token${tokenIndex}`] = { ...newConfig[`token${tokenIndex}`], [field]: bigintValue }
      return newConfig
    })
    
    // Update display value to formatted version (without scientific notation)
    const formattedValue = formatNumberForDisplay(bigintToDisplayNumber(bigintValue))
    setDisplayValues(prev => ({
      ...prev,
      [`token${tokenIndex}`]: {
        ...prev[`token${tokenIndex}`],
        [field]: formattedValue
      }
    }))
  }, [displayValues])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Convert all display values to BigInt before saving (in case user didn't blur)
    const finalConfig: FeesConfiguration = {
      daoFee: (() => {
        const normalized = displayValues.daoFee.replace(',', '.')
        const parsed = parseFloat(normalized)
        return Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
      })(),
      deployerFee: (() => {
        const normalized = displayValues.deployerFee.replace(',', '.')
        const parsed = parseFloat(normalized)
        return Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
      })(),
      token0: {
        liquidationFee: (() => {
          const normalized = displayValues.token0.liquidationFee.replace(',', '.')
          const parsed = parseFloat(normalized)
          return Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
        })(),
        flashloanFee: (() => {
          const normalized = displayValues.token0.flashloanFee.replace(',', '.')
          const parsed = parseFloat(normalized)
          return Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
        })()
      },
      token1: {
        liquidationFee: (() => {
          const normalized = displayValues.token1.liquidationFee.replace(',', '.')
          const parsed = parseFloat(normalized)
          return Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
        })(),
        flashloanFee: (() => {
          const normalized = displayValues.token1.flashloanFee.replace(',', '.')
          const parsed = parseFloat(normalized)
          return Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(20, parsed)))
        })()
      }
    }
    
    updateFeesConfiguration(finalConfig)
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
              displayValue={displayValues.daoFee}
              onChange={handleGeneralFeeChange}
              onBlur={handleGeneralFeeBlur}
            />
            
            <GeneralFeeInput
              field="deployerFee"
              label="Deployer Fee"
              value={feesConfig.deployerFee}
              displayValue={displayValues.deployerFee}
              onChange={handleGeneralFeeChange}
              onBlur={handleGeneralFeeBlur}
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
                displayValue={displayValues.token0.liquidationFee}
                disabled={wizardData.borrowConfiguration?.token1.nonBorrowable}
                onChange={handleTokenFeeChange}
                onBlur={handleTokenFeeBlur}
              />
              
              <TokenFeeInput
                tokenIndex={0}
                field="flashloanFee"
                label="Flashloan Fee"
                value={feesConfig.token0.flashloanFee}
                displayValue={displayValues.token0.flashloanFee}
                disabled={wizardData.borrowConfiguration?.token1.nonBorrowable}
                onChange={handleTokenFeeChange}
                onBlur={handleTokenFeeBlur}
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
                displayValue={displayValues.token1.liquidationFee}
                disabled={wizardData.borrowConfiguration?.token0.nonBorrowable}
                onChange={handleTokenFeeChange}
                onBlur={handleTokenFeeBlur}
              />
              
              <TokenFeeInput
                tokenIndex={1}
                field="flashloanFee"
                label="Flashloan Fee"
                value={feesConfig.token1.flashloanFee}
                displayValue={displayValues.token1.flashloanFee}
                disabled={wizardData.borrowConfiguration?.token0.nonBorrowable}
                onChange={handleTokenFeeChange}
                onBlur={handleTokenFeeBlur}
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
