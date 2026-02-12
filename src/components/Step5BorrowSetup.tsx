'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, BorrowConfiguration } from '@/contexts/WizardContext'
import { bigintToDisplayNumber, displayNumberToBigint } from '@/utils/verification/normalization'
import { formatWizardBigIntToE18 } from '@/utils/formatting'

interface InputComponentProps {
  tokenIndex: 0 | 1
  field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV'
  label: string
  value: bigint
  displayValue: string
  max?: number
  disabled?: boolean
  error?: string
  onChange: (tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: string) => void
  onBlur: (tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV') => void
}

// Helper function to get E18 representation from display value
function getE18FromDisplayValue(displayValue: string): string {
  if (!displayValue || displayValue === '') return '0e18'
  const normalized = displayValue.replace(',', '.')
  const parsed = parseFloat(normalized)
  if (Number.isNaN(parsed) || parsed < 0) return '0e18'
  const clampedValue = Math.max(0, Math.min(100, parsed))
  const bigintValue = displayNumberToBigint(clampedValue)
  return formatWizardBigIntToE18(bigintValue, false)
}

const InputComponent = React.memo(({ 
  tokenIndex, 
  field, 
  label, 
  displayValue,
  disabled = false,
  error,
  onChange,
  onBlur
}: InputComponentProps) => {
  const e18Value = getE18FromDisplayValue(displayValue)
  
  return (
    <div className="space-y-2">
      <label className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-white'}`}>
        {label}
      </label>
      <div className="relative w-full">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          disabled={disabled}
          onChange={(e) => onChange(tokenIndex, field, e.target.value)}
          onBlur={() => onBlur(tokenIndex, field)}
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
      {displayValue && displayValue !== '' && !disabled && (
        <div className="text-gray-500 text-xs mt-1">
          {e18Value}
        </div>
      )}
      {error && !disabled && (
        <div className="text-red-400 text-xs mt-1 max-w-48">
          {error}
        </div>
      )}
    </div>
  )
})

InputComponent.displayName = 'InputComponent'

// Helper function to format number without scientific notation
function formatNumberForDisplay(value: number): string {
  if (value === 0) return ''
  // Use toFixed to avoid scientific notation, then remove trailing zeros
  return value.toFixed(10).replace(/\.?0+$/, '')
}

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
      liquidationThreshold: BigInt(0),
      maxLTV: BigInt(0),
      liquidationTargetLTV: BigInt(0)
    },
    token1: {
      nonBorrowable: false,
      liquidationThreshold: BigInt(0),
      maxLTV: BigInt(0),
      liquidationTargetLTV: BigInt(0)
    }
  })

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    token0: {},
    token1: {}
  })

  // Local state for display values (strings) during input
  const [displayValues, setDisplayValues] = useState<{
    token0: { liquidationThreshold: string; maxLTV: string; liquidationTargetLTV: string }
    token1: { liquidationThreshold: string; maxLTV: string; liquidationTargetLTV: string }
  }>({
    token0: { liquidationThreshold: '', maxLTV: '', liquidationTargetLTV: '' },
    token1: { liquidationThreshold: '', maxLTV: '', liquidationTargetLTV: '' }
  })

  // Load existing configuration if available; when one token is non-borrowable, the other's LTV must be 0
  useEffect(() => {
    if (wizardData.borrowConfiguration) {
      const config = { ...wizardData.borrowConfiguration }
      if (config.token0.nonBorrowable) {
        config.token1 = { ...config.token1, liquidationThreshold: BigInt(0), maxLTV: BigInt(0), liquidationTargetLTV: BigInt(0) }
      }
      if (config.token1.nonBorrowable) {
        config.token0 = { ...config.token0, liquidationThreshold: BigInt(0), maxLTV: BigInt(0), liquidationTargetLTV: BigInt(0) }
      }
      setBorrowConfig(config)
      
      // Initialize display values from BigInt values
      setDisplayValues({
        token0: {
          liquidationThreshold: formatNumberForDisplay(bigintToDisplayNumber(config.token0.liquidationThreshold)),
          maxLTV: formatNumberForDisplay(bigintToDisplayNumber(config.token0.maxLTV)),
          liquidationTargetLTV: formatNumberForDisplay(bigintToDisplayNumber(config.token0.liquidationTargetLTV))
        },
        token1: {
          liquidationThreshold: formatNumberForDisplay(bigintToDisplayNumber(config.token1.liquidationThreshold)),
          maxLTV: formatNumberForDisplay(bigintToDisplayNumber(config.token1.maxLTV)),
          liquidationTargetLTV: formatNumberForDisplay(bigintToDisplayNumber(config.token1.liquidationTargetLTV))
        }
      })
      
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


  const validateValue = (tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV', value: bigint, config: BorrowConfiguration) => {
    const tokenConfig = config[`token${tokenIndex}`]
    const errors: string[] = []
    const valueAsNumber = bigintToDisplayNumber(value)

    // Basic range validation
    if (valueAsNumber < 0 || valueAsNumber > 100) {
      errors.push('Value must be between 0 and 100')
    }

    // When token's LTV is editable (neither token is non-borrowable), require > 0 for borrowable token
    const otherTokenConfig = config[tokenIndex === 0 ? 'token1' : 'token0']
    const thisTokenLtvEditable = !tokenConfig.nonBorrowable && !otherTokenConfig.nonBorrowable
    if (thisTokenLtvEditable && value === BigInt(0)) {
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
    // Normalize comma to dot for decimal separator
    const normalized = value.replace(',', '.')
    
    // Allow empty string, numbers, and partial numbers (e.g., "95.", "95.9")
    // Only allow digits, one dot, and optionally a minus sign at the start
    const isValidInput = normalized === '' || /^-?\d*\.?\d*$/.test(normalized)
    
    if (!isValidInput) {
      return // Don't update if invalid input
    }
    
    // Update display value immediately (allows typing dots and partial numbers)
    setDisplayValues(prev => ({
      ...prev,
      [`token${tokenIndex}`]: {
        ...prev[`token${tokenIndex}`],
        [field]: normalized
      }
    }))
  }, [])

  const handleInputBlur = useCallback((tokenIndex: 0 | 1, field: 'liquidationThreshold' | 'maxLTV' | 'liquidationTargetLTV') => {
    const displayValue = displayValues[`token${tokenIndex}`][field]
    
    // Normalize comma to dot
    const normalized = displayValue.replace(',', '.')
    
    // Parse as number - allow up to 10 decimal places
    const parsed = parseFloat(normalized)
    
    // Convert to BigInt using displayNumberToBigint (no rounding - exact precision)
    const bigintValue = Number.isNaN(parsed) || parsed < 0 ? BigInt(0) : displayNumberToBigint(Math.max(0, Math.min(100, parsed)))
    
    // Update BigInt value
    setBorrowConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      newConfig[`token${tokenIndex}`] = { ...newConfig[`token${tokenIndex}`], [field]: bigintValue }
      
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

  const handleNonBorrowableChange = useCallback((tokenIndex: 0 | 1, checked: boolean) => {
    setBorrowConfig(prevConfig => {
      const newConfig = { ...prevConfig }
      const otherTokenIndex = tokenIndex === 0 ? 1 : 0

      if (checked) {
        // This token is non-borrowable → only the OTHER token's LTV is zeroed and form is disabled
        newConfig[`token${otherTokenIndex}`] = {
          ...newConfig[`token${otherTokenIndex}`],
          nonBorrowable: false,
          liquidationThreshold: BigInt(0),
          maxLTV: BigInt(0),
          liquidationTargetLTV: BigInt(0)
        }
        
        // Update display values for the other token
        setDisplayValues(prev => ({
          ...prev,
          [`token${otherTokenIndex}`]: {
            liquidationThreshold: '',
            maxLTV: '',
            liquidationTargetLTV: ''
          }
        }))
      }

      // Only toggle nonBorrowable on this token; zero LTV only for the other token (above), not for this one
      newConfig[`token${tokenIndex}`] = {
        ...newConfig[`token${tokenIndex}`],
        nonBorrowable: checked
      }
      return newConfig
    })

    setValidationErrors(prevErrors => ({
      ...prevErrors,
      token0: {},
      token1: {}
    }))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const msg = 'Must be greater than 0 when token is borrowable'
    // When one token is non-borrowable, the other's LTV are forced to 0 and disabled — no LTV validation for that other token
    const token0LtvEditable = !borrowConfig.token0.nonBorrowable && !borrowConfig.token1.nonBorrowable
    const token1LtvEditable = !borrowConfig.token1.nonBorrowable && !borrowConfig.token0.nonBorrowable

    const token0Errors = {
      liquidationThreshold: token0LtvEditable && borrowConfig.token0.liquidationThreshold === BigInt(0) ? msg : undefined,
      maxLTV: token0LtvEditable && borrowConfig.token0.maxLTV === BigInt(0) ? msg : undefined,
      liquidationTargetLTV: token0LtvEditable && borrowConfig.token0.liquidationTargetLTV === BigInt(0) ? msg : undefined
    }
    const token1Errors = {
      liquidationThreshold: token1LtvEditable && borrowConfig.token1.liquidationThreshold === BigInt(0) ? msg : undefined,
      maxLTV: token1LtvEditable && borrowConfig.token1.maxLTV === BigInt(0) ? msg : undefined,
      liquidationTargetLTV: token1LtvEditable && borrowConfig.token1.liquidationTargetLTV === BigInt(0) ? msg : undefined
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
              Collateral Configuration for <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
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
                displayValue={displayValues.token0.liquidationThreshold}
                disabled={borrowConfig.token1.nonBorrowable}
                error={validationErrors.token0.liquidationThreshold}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
              />
              
              <InputComponent
                tokenIndex={0}
                field="maxLTV"
                label="Max LTV"
                value={borrowConfig.token0.maxLTV}
                displayValue={displayValues.token0.maxLTV}
                max={borrowConfig.token0.liquidationThreshold === BigInt(0) ? 100 : bigintToDisplayNumber(borrowConfig.token0.liquidationThreshold)}
                disabled={borrowConfig.token1.nonBorrowable}
                error={validationErrors.token0.maxLTV}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
              />
              
              <InputComponent
                tokenIndex={0}
                field="liquidationTargetLTV"
                label="Liquidation Target LTV"
                value={borrowConfig.token0.liquidationTargetLTV}
                displayValue={displayValues.token0.liquidationTargetLTV}
                max={Math.max(0, bigintToDisplayNumber(borrowConfig.token0.liquidationThreshold === BigInt(0) ? BigInt('1000000000000000000') : borrowConfig.token0.liquidationThreshold) - 1)}
                disabled={borrowConfig.token1.nonBorrowable}
                error={validationErrors.token0.liquidationTargetLTV}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* Token 1 Configuration */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Collateral Configuration for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
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
                displayValue={displayValues.token1.liquidationThreshold}
                disabled={borrowConfig.token0.nonBorrowable}
                error={validationErrors.token1.liquidationThreshold}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
              />
              
              <InputComponent
                tokenIndex={1}
                field="maxLTV"
                label="Max LTV"
                value={borrowConfig.token1.maxLTV}
                displayValue={displayValues.token1.maxLTV}
                max={borrowConfig.token1.liquidationThreshold === BigInt(0) ? 100 : bigintToDisplayNumber(borrowConfig.token1.liquidationThreshold)}
                disabled={borrowConfig.token0.nonBorrowable}
                error={validationErrors.token1.maxLTV}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
              />
              
              <InputComponent
                tokenIndex={1}
                field="liquidationTargetLTV"
                label="Liquidation Target LTV"
                value={borrowConfig.token1.liquidationTargetLTV}
                displayValue={displayValues.token1.liquidationTargetLTV}
                max={Math.max(0, bigintToDisplayNumber(borrowConfig.token1.liquidationThreshold === BigInt(0) ? BigInt('1000000000000000000') : borrowConfig.token1.liquidationThreshold) - 1)}
                disabled={borrowConfig.token0.nonBorrowable}
                error={validationErrors.token1.liquidationTargetLTV}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
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
