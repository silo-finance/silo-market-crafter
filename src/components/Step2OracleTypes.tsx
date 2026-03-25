'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, OracleType } from '@/contexts/WizardContext'

export default function Step2OracleTypes() {
  const router = useRouter()
  const { wizardData, updateOracleType0, updateOracleType1, markStepCompleted } = useWizard()
  
  const [selectedOracle0, setSelectedOracle0] = useState<'none' | 'scaler' | 'chainlink' | 'ptLinear' | 'vault' | 'customMethod' | null>(null)
  const [selectedOracle1, setSelectedOracle1] = useState<'none' | 'scaler' | 'chainlink' | 'ptLinear' | 'vault' | 'customMethod' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Check if both tokens have the same decimals
  const tokensHaveSameDecimals = wizardData.token0 && wizardData.token1 
    ? wizardData.token0.decimals === wizardData.token1.decimals 
    : false

  // PT-Linear is only available when token symbol starts with two uppercase letters "PT"
  const isPTToken = (symbol: string) =>
    symbol.length >= 2 && symbol[0] === 'P' && symbol[1] === 'T'

  // Calculate oracle type availability based on token decimals and symbol
  const getOracleTypes = (
    tokenDecimals: number,
    tokenSymbol: string
  ): {
    type: 'none' | 'scaler' | 'chainlink' | 'ptLinear' | 'vault' | 'customMethod'
    enabled: boolean
    reason: string
  }[] => {
    const noneEnabled = tokenDecimals === 18 || tokensHaveSameDecimals
    let noneReason = ''
    if (tokenDecimals === 18 && tokensHaveSameDecimals) {
      noneReason = 'Available for 18-decimal tokens and when both tokens have the same decimals'
    } else if (tokenDecimals === 18) {
      noneReason = 'Available for 18-decimal tokens'
    } else if (tokensHaveSameDecimals) {
      noneReason = 'Available when both tokens have the same decimals'
    } else {
      noneReason = 'Only available for 18-decimal tokens or when both tokens have the same decimals'
    }

    const ptLinearEnabled = isPTToken(tokenSymbol)

    return [
      {
        type: 'none',
        enabled: noneEnabled,
        reason: noneReason
      },
      {
        type: 'scaler',
        enabled: tokenDecimals !== 18,
        reason: tokenDecimals !== 18 
          ? 'Required for non-18-decimal tokens' 
          : 'Not needed for 18-decimal tokens'
      },
      {
        type: 'chainlink',
        enabled: true,
        reason: ''
      },
      {
        type: 'ptLinear',
        enabled: ptLinearEnabled,
        reason: ptLinearEnabled
          ? 'Available for PT tokens (symbol must start with PT)'
          : 'Only available when token symbol starts with two uppercase letters PT'
      },
      {
        type: 'vault',
        enabled: true,
        reason: 'Use ERC4626 vault-based oracle (Vault Oracle)'
      },
      {
        type: 'customMethod',
        enabled: true,
        reason: 'Call a specific no-arg method on a target contract and treat the result as price'
      }
    ]
  }

  const oracleTypes0 = wizardData.token0 ? getOracleTypes(wizardData.token0.decimals, wizardData.token0.symbol) : []
  const oracleTypes1 = wizardData.token1 ? getOracleTypes(wizardData.token1.decimals, wizardData.token1.symbol) : []

  // Track token addresses to detect changes and reset selections
  const token0AddressRef = React.useRef<string | undefined>()
  const token1AddressRef = React.useRef<string | undefined>()
  const hasLoadedFromCache = React.useRef(false)

  // Reset selections when tokens change
  useEffect(() => {
    const currentToken0Address = wizardData.token0?.address
    const currentToken1Address = wizardData.token1?.address
    
    // Check if tokens have changed
    const tokensChanged = 
      token0AddressRef.current !== currentToken0Address || 
      token1AddressRef.current !== currentToken1Address
    
    if (tokensChanged) {
      // Tokens changed - reset selections
      setSelectedOracle0(null)
      setSelectedOracle1(null)
      setError('') // Clear any errors
      token0AddressRef.current = currentToken0Address
      token1AddressRef.current = currentToken1Address
      hasLoadedFromCache.current = false
    }
  }, [wizardData.token0?.address, wizardData.token1?.address])

  // Load cached selections only once when tokens are stable
  useEffect(() => {
    if (!hasLoadedFromCache.current && wizardData.token0 && wizardData.token1) {
      if (wizardData.oracleType0) {
        setSelectedOracle0(wizardData.oracleType0.type)
      }
      if (wizardData.oracleType1) {
        setSelectedOracle1(wizardData.oracleType1.type)
      }
      hasLoadedFromCache.current = true
    }
  }, [wizardData.token0, wizardData.token1, wizardData.oracleType0, wizardData.oracleType1])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const errors: string[] = []
    if (!selectedOracle0) errors.push('Please select an oracle type for Token 0')
    if (!selectedOracle1) errors.push('Please select an oracle type for Token 1')
    if (
      selectedOracle0 &&
      selectedOracle0 !== 'none' &&
      selectedOracle0 !== 'scaler' &&
      selectedOracle0 !== 'chainlink' &&
      selectedOracle0 !== 'ptLinear' &&
      selectedOracle0 !== 'vault' &&
      selectedOracle0 !== 'customMethod'
    ) {
      errors.push('Invalid oracle type selected for Token 0')
    }
    if (
      selectedOracle1 &&
      selectedOracle1 !== 'none' &&
      selectedOracle1 !== 'scaler' &&
      selectedOracle1 !== 'chainlink' &&
      selectedOracle1 !== 'ptLinear' &&
      selectedOracle1 !== 'vault' &&
      selectedOracle1 !== 'customMethod'
    ) {
      errors.push('Invalid oracle type selected for Token 1')
    }
    const token0IsNon18 = wizardData.token0 && wizardData.token0.decimals !== 18
    const token1IsNon18 = wizardData.token1 && wizardData.token1.decimals !== 18
    const bothAreNon18 = token0IsNon18 && token1IsNon18
    if (bothAreNon18 && ((selectedOracle0 === 'none' && selectedOracle1 !== 'none') || (selectedOracle1 === 'none' && selectedOracle0 !== 'none'))) {
      errors.push('For non-18 decimal tokens, if you select "No Oracle" for one token, you must also select "No Oracle" for the other')
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }

    setError('')
    setLoading(true)

    try {

      // Update oracle types in context (we know they're set – validation passed)
      const oracleType0: OracleType = {
        type: selectedOracle0!,
        enabled: true,
        reason: oracleTypes0.find(ot => ot.type === selectedOracle0)?.reason
      }

      const oracleType1: OracleType = {
        type: selectedOracle1!,
        enabled: true,
        reason: oracleTypes1.find(ot => ot.type === selectedOracle1)?.reason
      }

      updateOracleType0(oracleType0)
      updateOracleType1(oracleType1)

      // Mark step as completed
      markStepCompleted(2)

      // Move to next step
      router.push('/wizard?step=3')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=1')
  }

  if (!wizardData.token0 || !wizardData.token1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Step 2: Choose Oracle Types
          </h1>
          <p className="text-gray-300 text-lg">
            Please complete Step 1 first to select your tokens
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 mb-6">
          <p className="text-gray-400 text-center">No tokens selected. Please go back to Step 1.</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={goToPreviousStep}
            className="bg-[var(--silo-surface-2)] hover:bg-[#e6ebf5] text-[var(--silo-text)] border border-[var(--silo-border)] font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Assets</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 2: Choose Oracle Types
        </h1>
        <p className="text-gray-300 text-lg">
          Select oracle types for each token based on their decimal places
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token 0 Oracle Selection */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {wizardData.token0.symbol} ({wizardData.token0.name})
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Decimals: {wizardData.token0.decimals}
          </p>
          
          <div className="space-y-3">
            {oracleTypes0.map((oracleType) => (
              <label
                key={oracleType.type}
                className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  oracleType.enabled
                    ? selectedOracle0 === oracleType.type
                      ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_52%,var(--silo-surface))]'
                      : 'border-[var(--silo-border)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))] bg-[var(--silo-surface)]'
                    : 'border-[var(--silo-border)] bg-[color-mix(in_srgb,var(--silo-surface)_70%,var(--silo-bg))] cursor-not-allowed opacity-50'
                }`}
              >
                <input
                  type="radio"
                  name="oracle0"
                  value={oracleType.type}
                  checked={selectedOracle0 === oracleType.type}
                  onChange={(e) =>
                    setSelectedOracle0(
                      e.target.value as
                        | 'none'
                        | 'scaler'
                        | 'chainlink'
                        | 'ptLinear'
                        | 'vault'
                        | 'customMethod'
                    )
                  }
                  disabled={!oracleType.enabled}
                  className="mt-1 accent-[var(--silo-accent)]"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-white capitalize">
                      {oracleType.type === 'none'
                        ? 'No Oracle'
                        : oracleType.type === 'scaler'
                        ? 'Scaler Oracle'
                        : oracleType.type === 'chainlink'
                        ? 'Chainlink'
                        : oracleType.type === 'ptLinear'
                        ? 'PT-Linear'
                        : oracleType.type === 'customMethod'
                        ? 'Custom Method Oracle'
                        : 'Vault Oracle (Custom Quote)'}
                    </span>
                    {oracleType.enabled ? (
                      <span className="status-muted-success text-sm">✓ Available</span>
                    ) : (
                      <span className="text-red-400 text-sm">✗ Not Available</span>
                    )}
                  </div>
                  {oracleType.type !== 'chainlink' && oracleType.type !== 'vault' && oracleType.type !== 'customMethod' && (
                    <p className="text-sm text-gray-400 mt-1">
                      {oracleType.reason}
                    </p>
                  )}
                  {oracleType.type === 'chainlink' && (
                    <p className="text-sm text-gray-400 mt-1">
                      Newest DIA and RedStone oracles share the same interface as Chainlink. Pick this option for them. Older versions that are not compatible are not supported.
                    </p>
                  )}
                  {oracleType.type === 'vault' && (
                    <p className="text-sm text-gray-400 mt-1">
                      ERC4626 Vault Oracle: oracle that derives price directly from the vault. This oracle allows configuring any quote token.
                    </p>
                  )}
                  {oracleType.type === 'customMethod' && (
                    <p className="text-sm text-gray-400 mt-1">
                      Use this when you want to call one specific no-argument method on a target contract to fetch price.
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Token 1 Oracle Selection */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {wizardData.token1.symbol} ({wizardData.token1.name})
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Decimals: {wizardData.token1.decimals}
          </p>
          
          <div className="space-y-3">
            {oracleTypes1.map((oracleType) => (
              <label
                key={oracleType.type}
                className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  oracleType.enabled
                    ? selectedOracle1 === oracleType.type
                      ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_52%,var(--silo-surface))]'
                      : 'border-[var(--silo-border)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))] bg-[var(--silo-surface)]'
                    : 'border-[var(--silo-border)] bg-[color-mix(in_srgb,var(--silo-surface)_70%,var(--silo-bg))] cursor-not-allowed opacity-50'
                }`}
              >
                <input
                  type="radio"
                  name="oracle1"
                  value={oracleType.type}
                  checked={selectedOracle1 === oracleType.type}
                  onChange={(e) =>
                    setSelectedOracle1(
                      e.target.value as
                        | 'none'
                        | 'scaler'
                        | 'chainlink'
                        | 'ptLinear'
                        | 'vault'
                        | 'customMethod'
                    )
                  }
                  disabled={!oracleType.enabled}
                  className="mt-1 accent-[var(--silo-accent)]"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-white capitalize">
                      {oracleType.type === 'none'
                        ? 'No Oracle'
                        : oracleType.type === 'scaler'
                        ? 'Scaler Oracle'
                        : oracleType.type === 'chainlink'
                        ? 'Chainlink'
                        : oracleType.type === 'ptLinear'
                        ? 'PT-Linear'
                        : oracleType.type === 'customMethod'
                        ? 'Custom Method Oracle'
                        : 'Vault Oracle (Custom Quote)'}
                    </span>
                    {oracleType.enabled ? (
                      <span className="status-muted-success text-sm">✓ Available</span>
                    ) : (
                      <span className="text-red-400 text-sm">✗ Not Available</span>
                    )}
                  </div>
                  {oracleType.type !== 'chainlink' && oracleType.type !== 'vault' && oracleType.type !== 'customMethod' && (
                    <p className="text-sm text-gray-400 mt-1">
                      {oracleType.reason}
                    </p>
                  )}
                  {oracleType.type === 'chainlink' && (
                    <p className="text-sm text-gray-400 mt-1">
                      Newest DIA and RedStone oracles share the same interface as Chainlink. Pick this option for them. Older versions that are not compatible are not supported.
                      </p>
                  )}
                  {oracleType.type === 'vault' && (
                    <p className="text-sm text-gray-400 mt-1">
                      ERC4626 Vault Oracle: oracle that derives price directly from the vault. This oracle allows configuring any quote token.
                    </p>
                  )}
                  {oracleType.type === 'customMethod' && (
                    <p className="text-sm text-gray-400 mt-1">
                      Use this when you want to call one specific no-argument method on a target contract to fetch price.
                      </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <p className="text-red-400 font-medium mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-red-400 text-sm space-y-1">
              {error.split('\n').map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={goToPreviousStep}
            className="bg-[var(--silo-surface-2)] hover:bg-[#e6ebf5] text-[var(--silo-text)] border border-[var(--silo-border)] font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Assets</span>
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--silo-accent)] hover:bg-[#7688ff] disabled:bg-[var(--silo-border)] disabled:text-[var(--silo-text-faint)] disabled:opacity-60 disabled:cursor-not-allowed text-[#1f2654] font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Oracle Configuration</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
