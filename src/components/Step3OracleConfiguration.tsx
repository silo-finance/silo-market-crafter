'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard, OracleConfiguration, ScalerOracle } from '@/contexts/WizardContext'
import oracleScalerArtifact from '@/abis/oracle/OracleScaler.json'

/** Foundry artifact: ABI under "abi" key – use as-is, never modify */
const oracleScalerAbi = (oracleScalerArtifact as { abi: ethers.InterfaceAbi }).abi


interface OracleDeployments {
  [chainName: string]: {
    [oracleName: string]: string
  }
}

// Helper function to format scale factor in scientific notation
const formatScaleFactor = (scaleFactor: bigint): string => {
  const factor = Number(scaleFactor)
  if (factor === 0) return '0'
  if (factor === 1) return '1'
  
  // Convert to scientific notation
  const scientific = factor.toExponential()
  
  // Remove unnecessary decimal places and trailing zeros
  const [mantissa, exponent] = scientific.split('e')
  const cleanMantissa = parseFloat(mantissa).toString()
  
  return `${cleanMantissa}e${exponent}`
}

// Helper function to validate if scaler can be used with token decimals
const validateScalerForToken = (scaleFactor: bigint, tokenDecimals: number): { valid: boolean; resultDecimals: number } => {
  // Calculate: 10^token_decimals * Factor
  const tokenMultiplier = Math.pow(10, tokenDecimals)
  const factor = Number(scaleFactor)
  const result = tokenMultiplier * factor
  
  // Check if result equals 1e18 (10^18)
  const targetValue = Math.pow(10, 18)
  const tolerance = 1e-10 // Small tolerance for floating point comparison
  
  const valid = Math.abs(result - targetValue) < tolerance
  
  // Calculate what decimals the result would have
  const resultDecimals = Math.log10(result)
  
  
  return { valid, resultDecimals }
}

export default function Step3OracleConfiguration() {
  const router = useRouter()
  const { wizardData, updateOracleConfiguration, markStepCompleted } = useWizard()
  
  const [oracleDeployments, setOracleDeployments] = useState<OracleDeployments | null>(null)
  const [availableScalers, setAvailableScalers] = useState<{
    token0: ScalerOracle[]
    token1: ScalerOracle[]
  }>({ token0: [], token1: [] })
  const [selectedScalers, setSelectedScalers] = useState<{
    token0: ScalerOracle | null
    token1: ScalerOracle | null
  }>({ token0: null, token1: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingOracles, setLoadingOracles] = useState(true)

  // Chain ID to chain name mapping
  const getChainName = (chainId: string): string => {
    const chainMap: { [key: string]: string } = {
      '1': 'mainnet',
      '137': 'polygon',
      '10': 'optimism',
      '42161': 'arbitrum_one',
      '43114': 'avalanche',
      '146': 'sonic'
    }
    return chainMap[chainId] || 'mainnet'
  }

  // Fetch oracle deployments from GitHub
  useEffect(() => {
    const fetchOracleDeployments = async () => {
      try {
        const response = await fetch('https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/develop/silo-oracles/deploy/_oraclesDeployments.json')
        if (!response.ok) {
          throw new Error('Failed to fetch oracle deployments')
        }
        const data = await response.json()
        setOracleDeployments(data)
      } catch (err) {
        console.error('Error fetching oracle deployments:', err)
        setError('Failed to load oracle deployments')
      } finally {
        setLoadingOracles(false)
      }
    }

    fetchOracleDeployments()
  }, [])

  // Find and validate scaler oracles for each token
  useEffect(() => {
    const findScalerOracles = async () => {
      if (!oracleDeployments || !wizardData.networkInfo || !wizardData.token0 || !wizardData.token1) {
        return
      }

      const chainName = getChainName(wizardData.networkInfo.chainId)
      const chainOracles = oracleDeployments[chainName]
      
      if (!chainOracles) {
        console.warn(`No oracles found for chain: ${chainName}`)
        return
      }

      // Find SCALER oracles
      const scalerOracles = Object.entries(chainOracles)
        .filter(([name]) => name.includes('SCALER'))
        .map(([name, address]) => ({ name, address }))

      if (scalerOracles.length === 0) {
        console.warn(`No SCALER oracles found for chain: ${chainName}`)
        return
      }

      // Validate oracles for each token
      const validateOraclesForToken = async (tokenAddress: string, tokenDecimals: number) => {
        const validOracles: ScalerOracle[] = []

        for (const oracle of scalerOracles) {
          try {
            if (!window.ethereum) continue

            const provider = new ethers.BrowserProvider(window.ethereum)
            
            const contract = new ethers.Contract(oracle.address, oracleScalerAbi, provider)
            
            // Check if QUOTE_TOKEN matches our token (case insensitive)
            const quoteToken = await contract.QUOTE_TOKEN()
            if (quoteToken.toLowerCase() === tokenAddress.toLowerCase()) {
              // Get scale factor
              const scaleFactor = await contract.SCALE_FACTOR()
              const scaleFactorFormatted = formatScaleFactor(scaleFactor)
              
              // Validate if this scaler can be used with the token
              const validation = validateScalerForToken(scaleFactor, tokenDecimals)
              
              validOracles.push({
                name: oracle.name,
                address: oracle.address,
                scaleFactor: scaleFactorFormatted,
                valid: validation.valid,
                resultDecimals: validation.resultDecimals
              })
            }
          } catch (err) {
            console.warn(`Failed to validate oracle ${oracle.name}:`, err)
          }
        }

        return validOracles
      }

      // Validate for both tokens
      const [token0Oracles, token1Oracles] = await Promise.all([
        validateOraclesForToken(wizardData.token0.address, wizardData.token0.decimals),
        validateOraclesForToken(wizardData.token1.address, wizardData.token1.decimals)
      ])

      setAvailableScalers({
        token0: token0Oracles,
        token1: token1Oracles
      })

      // Update selected scalers with new validation results
      setSelectedScalers(prev => {
        const updated = { ...prev }
        
        // Update token0 if it's selected and we have a matching oracle with new validation
        if (prev.token0) {
          const updatedOracle = token0Oracles.find(o => o.address === prev.token0?.address)
          if (updatedOracle) {
            updated.token0 = updatedOracle
          }
        }
        
        // Update token1 if it's selected and we have a matching oracle with new validation
        if (prev.token1) {
          const updatedOracle = token1Oracles.find(o => o.address === prev.token1?.address)
          if (updatedOracle) {
            updated.token1 = updatedOracle
          }
        }
        
        return updated
      })
    }

    findScalerOracles()
  }, [oracleDeployments, wizardData.networkInfo, wizardData.token0, wizardData.token1])

  // Load existing selections if available
  useEffect(() => {
    if (wizardData.oracleConfiguration) {
      setSelectedScalers({
        token0: wizardData.oracleConfiguration.token0.scalerOracle || null,
        token1: wizardData.oracleConfiguration.token1.scalerOracle || null
      })
    }
  }, [wizardData.oracleConfiguration])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!wizardData.oracleType0 || !wizardData.oracleType1) {
        throw new Error('Oracle types not selected. Please go back to Step 2.')
      }

      // Validate selections
      if (wizardData.oracleType0.type === 'scaler' && !selectedScalers.token0) {
        throw new Error('Please select a scaler oracle for Token 0')
      }
      if (wizardData.oracleType0.type === 'scaler' && selectedScalers.token0 && !selectedScalers.token0.valid) {
        throw new Error('Selected scaler oracle for Token 0 is not valid for this token')
      }
      if (wizardData.oracleType1.type === 'scaler' && !selectedScalers.token1) {
        throw new Error('Please select a scaler oracle for Token 1')
      }
      if (wizardData.oracleType1.type === 'scaler' && selectedScalers.token1 && !selectedScalers.token1.valid) {
        throw new Error('Selected scaler oracle for Token 1 is not valid for this token')
      }

      // Create oracle configuration
      const config: OracleConfiguration = {
        token0: {
          type: wizardData.oracleType0.type,
          scalerOracle: wizardData.oracleType0.type === 'scaler' ? selectedScalers.token0! : undefined
        },
        token1: {
          type: wizardData.oracleType1.type,
          scalerOracle: wizardData.oracleType1.type === 'scaler' ? selectedScalers.token1! : undefined
        }
      }

      updateOracleConfiguration(config)

      // Mark step as completed
      markStepCompleted(3)

      // Move to next step
      router.push('/wizard?step=4')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=2')
  }

  const getBlockExplorerUrl = (address: string) => {
    const chainId = wizardData.networkInfo?.chainId || '1'
    const networkMap: { [key: string]: string } = {
      '1': 'https://etherscan.io/address/',
      '137': 'https://polygonscan.com/address/',
      '10': 'https://optimistic.etherscan.io/address/',
      '42161': 'https://arbiscan.io/address/',
      '43114': 'https://snowtrace.io/address/',
      '146': 'https://sonicscan.org/address/'
    }
    const baseUrl = networkMap[chainId] || 'https://etherscan.io/address/'
    return `${baseUrl}${address}`
  }

  if (!wizardData.token0 || !wizardData.token1 || !wizardData.oracleType0 || !wizardData.oracleType1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Step 3: Oracle Configuration
          </h1>
          <p className="text-gray-300 text-lg">
            Please complete previous steps first
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 mb-6">
          <p className="text-gray-400 text-center">Missing required data. Please go back to previous steps.</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={goToPreviousStep}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Step 2</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 3: Oracle Configuration
        </h1>
        <p className="text-gray-300 text-lg">
          Configure oracle settings for each token
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token 0 Configuration */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {wizardData.token0.symbol} ({wizardData.token0.name})
          </h3>
          <p className="text-sm text-gray-400 mb-2">
            Oracle Type: {wizardData.oracleType0.type === 'none' ? 'No Oracle' : 'Scaler Oracle'}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            Token Decimals: {wizardData.token0.decimals}
          </p>
          
          {wizardData.oracleType0.type === 'none' ? (
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-400 font-medium">No Oracle Configuration Needed</span>
              </div>
              <p className="text-sm text-gray-300">
                Token value will be equal to the amount since no oracle is being used.
              </p>
            </div>
          ) : (
            <div>
              {loadingOracles ? (
                <div className="flex items-center space-x-2 text-gray-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading available scaler oracles...</span>
                </div>
              ) : availableScalers.token0.length === 0 ? (
                <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-yellow-400 font-medium">No Compatible Scaler Oracles Found</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    No scaler oracles found that match this token&apos;s address.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    Select Scaler Oracle:
                  </label>
                  {availableScalers.token0.map((oracle) => (
                    <label
                      key={oracle.address}
                      className={`flex items-start space-x-3 p-4 rounded-lg border transition-all ${
                        !oracle.valid
                          ? 'border-red-500 bg-red-900/20 cursor-not-allowed opacity-60'
                          : selectedScalers.token0?.address === oracle.address
                          ? 'border-blue-500 bg-blue-900/20 cursor-pointer'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scaler0"
                        value={oracle.address}
                        checked={selectedScalers.token0?.address === oracle.address}
                        onChange={() => setSelectedScalers(prev => ({ ...prev, token0: oracle }))}
                        disabled={!oracle.valid}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white">{oracle.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-400">Factor: {oracle.scaleFactor}</span>
                            {oracle.valid ? (
                              <span className="text-green-400 text-xs">✓ Valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ Invalid</span>
                            )}
                          </div>
                        </div>
                        <a 
                          href={getBlockExplorerUrl(oracle.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          {oracle.address.slice(0, 6)}...{oracle.address.slice(-4)}
                        </a>
                        {!oracle.valid && oracle.resultDecimals && (
                          <div className="mt-2 text-xs text-red-400">
                            This scaler will provide price in {Math.round(oracle.resultDecimals)} decimals, but price must be in 18 decimals.
                          </div>
                        )}
                        {oracle.valid && (
                          <div className="mt-2 text-xs text-green-400">
                            This scaler correctly scales the token price to 18 decimals for proper market calculations.
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Token 1 Configuration */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {wizardData.token1.symbol} ({wizardData.token1.name})
          </h3>
          <p className="text-sm text-gray-400 mb-2">
            Oracle Type: {wizardData.oracleType1.type === 'none' ? 'No Oracle' : 'Scaler Oracle'}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            Token Decimals: {wizardData.token1.decimals}
          </p>
          
          {wizardData.oracleType1.type === 'none' ? (
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-400 font-medium">No Oracle Configuration Needed</span>
              </div>
              <p className="text-sm text-gray-300">
                Token value will be equal to the amount since no oracle is being used.
              </p>
            </div>
          ) : (
            <div>
              {loadingOracles ? (
                <div className="flex items-center space-x-2 text-gray-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading available scaler oracles...</span>
                </div>
              ) : availableScalers.token1.length === 0 ? (
                <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-yellow-400 font-medium">No Compatible Scaler Oracles Found</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    No scaler oracles found that match this token&apos;s address.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    Select Scaler Oracle:
                  </label>
                  {availableScalers.token1.map((oracle) => (
                    <label
                      key={oracle.address}
                      className={`flex items-start space-x-3 p-4 rounded-lg border transition-all ${
                        !oracle.valid
                          ? 'border-red-500 bg-red-900/20 cursor-not-allowed opacity-60'
                          : selectedScalers.token1?.address === oracle.address
                          ? 'border-blue-500 bg-blue-900/20 cursor-pointer'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scaler1"
                        value={oracle.address}
                        checked={selectedScalers.token1?.address === oracle.address}
                        onChange={() => setSelectedScalers(prev => ({ ...prev, token1: oracle }))}
                        disabled={!oracle.valid}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white">{oracle.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-400">Factor: {oracle.scaleFactor}</span>
                            {oracle.valid ? (
                              <span className="text-green-400 text-xs">✓ Valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ Invalid</span>
                            )}
                          </div>
                        </div>
                        <a 
                          href={getBlockExplorerUrl(oracle.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          {oracle.address.slice(0, 6)}...{oracle.address.slice(-4)}
                        </a>
                        {!oracle.valid && oracle.resultDecimals && (
                          <div className="mt-2 text-xs text-red-400">
                            This scaler will provide price in {Math.round(oracle.resultDecimals)} decimals, but price must be in 18 decimals.
                          </div>
                        )}
                        {oracle.valid && (
                          <div className="mt-2 text-xs text-green-400">
                            This scaler correctly scales the token price to 18 decimals for proper market calculations.
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <div className="text-red-400 text-sm">
              ✗ {error}
            </div>
          </div>
        )}


        <div className="flex justify-between">
          <button
            type="button"
            onClick={goToPreviousStep}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Oracle Types</span>
          </button>
          <button
            type="submit"
            disabled={loading || 
              (wizardData.oracleType0.type === 'scaler' && (!selectedScalers.token0 || !selectedScalers.token0.valid)) || 
              (wizardData.oracleType1.type === 'scaler' && (!selectedScalers.token1 || !selectedScalers.token1.valid))}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
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
                <span>IRM Selection</span>
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
