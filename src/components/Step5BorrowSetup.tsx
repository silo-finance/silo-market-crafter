'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, BorrowConfiguration } from '@/contexts/WizardContext'

interface InputComponentProps {
  tokenIndex: 0 | 1
  field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV'
  label: string
  value: number
  max?: number
  disabled?: boolean
  error?: string
  onChange: (tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: string) => void
}

const InputComponent = React.memo(({ 
  tokenIndex, 
  field, 
  label, 
  value, 
  max = 100,
  disabled = false,
  error,
  onChange
}: InputComponentProps) => {
  return (
    <div className="space-y-2">
      <label className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-white'}`}>
        {label}
      </label>
      <div className="relative w-24">
        <input
          type="number"
          min="0"
          max={max}
          step="1"
          value={value === 0 ? '' : value}
          disabled={disabled}
          onChange={(e) => onChange(tokenIndex, field, e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-center ${
            disabled 
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' 
              : error
              ? 'bg-gray-700 border-red-500 text-white focus:ring-red-500'
              : 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
          }`}
          placeholder="0"
        />
        <div className={`absolute right-3 top-2 text-sm ${disabled ? 'text-gray-600' : 'text-gray-400'}`}>
          %
        </div>
      </div>
      {error && !disabled && (
        <div className="text-red-400 text-xs mt-1 max-w-48">
          {error}
        </div>
      )}
    </div>
  )
})

InputComponent.displayName = 'InputComponent'

interface ValidationErrors {
  token0: {
    liquidationThreshold?: string
    maxLTV?: string
    liquidationTargetLTV?: string
  }
  token1: {
    liquidationThreshold?: string
    maxLTV?: string
    liquidationTargetLTV?: string
  }
}

export default function Step5BorrowSetup() {
  const router = useRouter()
  const { wizardData, updateBorrowConfiguration, markStepCompleted } = useWizard()
  
  const [borrowConfig, setBorrowConfig] = useState<BorrowConfiguration>({
    token0: {
      nonBorrowable: false,
      liquidationThreshold: 0,
      maxLTV: 0,
      liquidationTargetLTV: 0
    },
    token1: {
      nonBorrowable: false,
      liquidationThreshold: 0,
      maxLTV: 0,
      liquidationTargetLTV: 0
    }
  })

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    token0: {},
    token1: {}
  })

  // Load existing configuration if available and run validation (e.g. LT > 0 when borrowable)
  useEffect(() => {
    if (wizardData.borrowConfiguration) {
      const config = wizardData.borrowConfiguration
      setBorrowConfig(config)
      setValidationErrors(prev => ({
        ...prev,
        token0: {
          liquidationThreshold: validateValue(0, 'liquidationThreshold', config.token0.liquidationThreshold, config),
          maxLTV: validateValue(0, 'maxLTV', config.token0.maxLTV, config),
          liquidationTargetLTV: validateValue(0, 'liquidationTargetLTV', config.token0.liquidationTargetLTV, config)
        },
        token1: {
          liquidationThreshold: validateValue(1, 'liquidationThreshold', config.token1.liquidationThreshold, config),
          maxLTV: validateValue(1, 'maxLTV', config.token1.maxLTV, config),
          liquidationTargetLTV: validateValue(1, 'liquidationTargetLTV', config.token1.liquidationTargetLTV, config)
        }
      }))
    }
  }, [wizardData.borrowConfiguration])


  const validateValue = (tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: number, config: BorrowConfiguration) => {
    const tokenConfig = config[`token${tokenIndex}`]
    const errors: string[] = []

    // Basic range validation
    if (value < 0 || value > 100) {
      errors.push('Value must be between 0 and 100')
    }

    // When token is borrowable, LT / Max LTV / Liquidation Target LTV must all be greater than 0
    if (!tokenConfig.nonBorrowable && value === 0) {
      errors.push('Must be greater than 0 when token is borrowable')
    }

    // Validation rules
    if (field === 'maxLTV' && value > tokenConfig.liquidationThreshold) {
      errors.push('Max LTV must be less than or equal to Liquidation Threshold')
    }

    if (field === 'liquidationTargetLTV' && value >= tokenConfig.liquidationThreshold) {
      errors.push('Liquidation Target LTV must be less than Liquidation Threshold')
    }

    if (field === 'liquidationThreshold') {
      if (tokenConfig.maxLTV > value) {
        errors.push('Liquidation Threshold must be greater than or equal to Max LTV')
      }
      if (tokenConfig.liquidationTargetLTV >= value) {
        errors.push('Liquidation Threshold must be greater than Liquidation Target LTV')
      }
    }

    return errors.length > 0 ? errors.join(', ') : undefined
  }

  const handleInputChange = useCallback((tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: string) => {
    const numValue = parseInt(value) || 0
    
    setBorrowConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      newConfig[`token${tokenIndex}`] = { ...newConfig[`token${tokenIndex}`], [field]: numValue }
      
      // Validate all fields for this token since they might be interdependent
      const tokenConfig = newConfig[`token${tokenIndex}`]
      const newErrors = {
        liquidationThreshold: validateValue(tokenIndex, 'liquidationThreshold', tokenConfig.liquidationThreshold, newConfig),
        maxLTV: validateValue(tokenIndex, 'maxLTV', tokenConfig.maxLTV, newConfig),
        liquidationTargetLTV: validateValue(tokenIndex, 'liquidationTargetLTV', tokenConfig.liquidationTargetLTV, newConfig)
      }
      
      // Update validation errors
      setValidationErrors(prevErrors => ({
        ...prevErrors,
        [`token${tokenIndex}`]: newErrors
      }))
      
      return newConfig
    })
  }, [])

  const handleNonBorrowableChange = useCallback((tokenIndex: 0 | 1, checked: boolean) => {
    setBorrowConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      
      if (checked) {
        // If this token is being marked as non-borrowable, unmark the other token
        const otherTokenIndex = tokenIndex === 0 ? 1 : 0
        newConfig[`token${otherTokenIndex}`] = {
          ...newConfig[`token${otherTokenIndex}`],
          nonBorrowable: false
        }
      }
      
      newConfig[`token${tokenIndex}`] = { 
        ...newConfig[`token${tokenIndex}`], 
        nonBorrowable: checked,
        // Set all values to 0 when non-borrowable is checked, leave empty when unchecked
        liquidationThreshold: checked ? 0 : 0,
        maxLTV: checked ? 0 : 0,
        liquidationTargetLTV: checked ? 0 : 0
      }
      return newConfig
    })

    // Clear validation errors when toggling non-borrowable
    setValidationErrors(prevErrors => ({
      ...prevErrors,
      [`token${tokenIndex}`]: {}
    }))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const msg = 'Must be greater than 0 when token is borrowable'
    const token0Borrowable = !borrowConfig.token0.nonBorrowable
    const token1Borrowable = !borrowConfig.token1.nonBorrowable

    const token0Errors = {
      liquidationThreshold: token0Borrowable && borrowConfig.token0.liquidationThreshold === 0 ? msg : undefined,
      maxLTV: token0Borrowable && borrowConfig.token0.maxLTV === 0 ? msg : undefined,
      liquidationTargetLTV: token0Borrowable && borrowConfig.token0.liquidationTargetLTV === 0 ? msg : undefined
    }
    const token1Errors = {
      liquidationThreshold: token1Borrowable && borrowConfig.token1.liquidationThreshold === 0 ? msg : undefined,
      maxLTV: token1Borrowable && borrowConfig.token1.maxLTV === 0 ? msg : undefined,
      liquidationTargetLTV: token1Borrowable && borrowConfig.token1.liquidationTargetLTV === 0 ? msg : undefined
    }

    const hasErrors = Object.values(token0Errors).some(Boolean) || Object.values(token1Errors).some(Boolean)
    if (hasErrors) {
      setValidationErrors(prev => ({
        ...prev,
        token0: { ...prev.token0, ...token0Errors },
        token1: { ...prev.token1, ...token1Errors }
      }))
      return
    }

    updateBorrowConfiguration(borrowConfig)
    markStepCompleted(5)
    router.push('/wizard?step=6')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=4')
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
            
            {/* Non-borrowable checkbox */}
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={borrowConfig.token0.nonBorrowable}
                  onChange={(e) => handleNonBorrowableChange(0, e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-white font-medium">Non-borrowable</span>
              </label>
            </div>
            
            <div className="space-y-6">
              <InputComponent
                tokenIndex={0}
                field="liquidationThreshold"
                label="Liquidation Threshold (LT)"
                value={borrowConfig.token0.liquidationThreshold}
                disabled={borrowConfig.token0.nonBorrowable}
                error={validationErrors.token0.liquidationThreshold}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={0}
                field="maxLTV"
                label="Max LTV"
                value={borrowConfig.token0.maxLTV}
                max={borrowConfig.token0.liquidationThreshold || 100}
                disabled={borrowConfig.token0.nonBorrowable}
                error={validationErrors.token0.maxLTV}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={0}
                field="liquidationTargetLTV"
                label="Liquidation Target LTV"
                value={borrowConfig.token0.liquidationTargetLTV}
                max={Math.max(0, (borrowConfig.token0.liquidationThreshold || 100) - 1)}
                disabled={borrowConfig.token0.nonBorrowable}
                error={validationErrors.token0.liquidationTargetLTV}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Token 1 Configuration */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Borrow Configuration for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
            </h3>
            
            {/* Non-borrowable checkbox */}
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={borrowConfig.token1.nonBorrowable}
                  onChange={(e) => handleNonBorrowableChange(1, e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-white font-medium">Non-borrowable</span>
              </label>
            </div>
            
            <div className="space-y-6">
              <InputComponent
                tokenIndex={1}
                field="liquidationThreshold"
                label="Liquidation Threshold (LT)"
                value={borrowConfig.token1.liquidationThreshold}
                disabled={borrowConfig.token1.nonBorrowable}
                error={validationErrors.token1.liquidationThreshold}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={1}
                field="maxLTV"
                label="Max LTV"
                value={borrowConfig.token1.maxLTV}
                max={borrowConfig.token1.liquidationThreshold || 100}
                disabled={borrowConfig.token1.nonBorrowable}
                error={validationErrors.token1.maxLTV}
                onChange={handleInputChange}
              />
              
              <InputComponent
                tokenIndex={1}
                field="liquidationTargetLTV"
                label="Liquidation Target LTV"
                value={borrowConfig.token1.liquidationTargetLTV}
                max={Math.max(0, (borrowConfig.token1.liquidationThreshold || 100) - 1)}
                disabled={borrowConfig.token1.nonBorrowable}
                error={validationErrors.token1.liquidationTargetLTV}
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
            <span>Fees</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>

    </div>
  )
}
