'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard, OracleConfiguration, ScalerOracle, ChainlinkOracleConfig } from '@/contexts/WizardContext'
import { getCachedVersion, setCachedVersion } from '@/utils/versionCache'
import oracleScalerArtifact from '@/abis/oracle/OracleScaler.json'
import siloLensArtifact from '@/abis/silo/ISiloLens.json'
import aggregatorV3Artifact from '@/abis/oracle/AggregatorV3Interface.json'
import CopyButton from '@/components/CopyButton'

/** Foundry artifact: ABI under "abi" key – use as-is, never modify */
const oracleScalerAbi = (oracleScalerArtifact as { abi: ethers.InterfaceAbi }).abi
const siloLensAbi = (siloLensArtifact as { abi: ethers.InterfaceAbi }).abi
const aggregatorV3Abi = (aggregatorV3Artifact as { abi: ethers.InterfaceAbi }).abi


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

/** Format 10^n as 1e{n} for display; raw number for small n. */
function formatPowerOfTen(value: string): string {
  if (value === '0') return '0'
  const n = BigInt(value)
  const zero = BigInt(0)
  const one = BigInt(1)
  const ten = BigInt(10)
  if (n <= zero) return value
  let exponent = 0
  let x = n
  while (x % ten === zero && x > zero) {
    exponent++
    x /= ten
  }
  if (x === one) return exponent <= 3 ? value : `1e${exponent}`
  return value
}

/**
 * Normalization so oracle output is 18 decimals.
 * Equation: base decimals + aggregator decimals ± normalization = 18.
 * Only base and aggregator decimals are used (quote/target is always 18).
 * exponent = 18 - baseDecimals - aggregatorDecimals:
 * - exponent ≥ 0 → normalizationMultiplier = 10^exponent, normalizationDivider = 0
 * - exponent < 0 → normalizationDivider = 10^(-exponent), normalizationMultiplier = 0
 */
function computeChainlinkNormalization(
  baseDecimals: number,
  _quoteDecimals: number,
  aggregatorDecimals: number
): { divider: string; multiplier: string; mathLineMultiplier: string; mathLineDivider: string } {
  const targetDecimals = 18
  const exponent = targetDecimals - baseDecimals - aggregatorDecimals
  let divider = '0'
  let multiplier = '0'
  let mathLineMultiplier = ''
  let mathLineDivider = ''
  if (exponent >= 0) {
    multiplier = String(10 ** exponent)
    mathLineMultiplier = `base ${baseDecimals} + aggregator ${aggregatorDecimals} + normalization ${exponent} = ${targetDecimals} (QUOTE)`
  } else {
    const divExp = -exponent
    divider = String(10 ** divExp)
    mathLineDivider = `base ${baseDecimals} + aggregator ${aggregatorDecimals} − normalization ${divExp} = ${targetDecimals} (QUOTE)`
  }
  return { divider, multiplier, mathLineMultiplier, mathLineDivider }
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
  const [chainlink0, setChainlink0] = useState<Partial<ChainlinkOracleConfig> & {
    primaryAggregatorDecimals?: number
    mathLineMultiplier?: string
    mathLineDivider?: string
    aggregatorDescription?: string
    aggregatorLatestAnswer?: string
  }>({
    baseToken: 'token0',
    primaryAggregator: '',
    secondaryAggregator: '',
    normalizationDivider: '0',
    normalizationMultiplier: '0',
    invertSecondPrice: false
  })
  const [chainlink1, setChainlink1] = useState<Partial<ChainlinkOracleConfig> & {
    primaryAggregatorDecimals?: number
    mathLineMultiplier?: string
    mathLineDivider?: string
    aggregatorDescription?: string
    aggregatorLatestAnswer?: string
  }>({
    baseToken: 'token0',
    primaryAggregator: '',
    secondaryAggregator: '',
    normalizationDivider: '0',
    normalizationMultiplier: '0',
    invertSecondPrice: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingOracles, setLoadingOracles] = useState(true)
  const [oracleScalerFactory, setOracleScalerFactory] = useState<{ address: string; version: string } | null>(null)
  const [chainlinkV3OracleFactory, setChainlinkV3OracleFactory] = useState<{ address: string; version: string } | null>(null)
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [useSecondaryAggregator0, setUseSecondaryAggregator0] = useState(false)
  const [useSecondaryAggregator1, setUseSecondaryAggregator1] = useState(false)

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
        const response = await fetch('https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deploy/_oraclesDeployments.json')
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

  // Fetch OracleScalerFactory address for current chain
  useEffect(() => {
    const fetchScalerFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/OracleScalerFactory.sol.json`
        )
        if (!response.ok) {
          setOracleScalerFactory(null)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setOracleScalerFactory(address ? { address, version: '' } : null)
      } catch {
        setOracleScalerFactory(null)
      }
    }
    fetchScalerFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch ChainlinkV3OracleFactory address for current chain (master only)
  useEffect(() => {
    const fetchChainlinkFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/ChainlinkV3OracleFactory.sol.json`
        )
        if (!response.ok) {
          setChainlinkV3OracleFactory(null)
          return
        }
        const data = await response.json()
        const address = data.address && ethers.isAddress(data.address) ? data.address : ''
        setChainlinkV3OracleFactory(address ? { address, version: '' } : null)
      } catch {
        setChainlinkV3OracleFactory(null)
      }
    }
    fetchChainlinkFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch SiloLens address for current chain (same pattern as Step10)
  useEffect(() => {
    const fetchLens = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloLens.sol.json`
        )
        if (response.ok) {
          const data = await response.json()
          const address = data.address && ethers.isAddress(data.address) ? data.address : ''
          setSiloLensAddress(address)
        } else {
          setSiloLensAddress('')
        }
      } catch {
        setSiloLensAddress('')
      }
    }
    fetchLens()
  }, [wizardData.networkInfo?.chainId])

  // Fetch OracleScalerFactory version via Silo Lens (cached per chainId+address)
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!oracleScalerFactory?.address || !siloLensAddress || !chainId) return
    const cached = getCachedVersion(chainId, oracleScalerFactory.address)
    if (cached != null) {
      setOracleScalerFactory(prev => prev ? { ...prev, version: cached } : null)
      return
    }
    const fetchFactoryVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const lensContract = new ethers.Contract(siloLensAddress, siloLensAbi, provider)
        const version = String(await lensContract.getVersion(oracleScalerFactory!.address))
        setCachedVersion(chainId, oracleScalerFactory!.address, version)
        setOracleScalerFactory(prev => prev ? { ...prev, version } : null)
      } catch (err) {
        console.warn('Failed to fetch OracleScalerFactory version from Silo Lens:', err)
        const fallback = '—'
        setCachedVersion(chainId, oracleScalerFactory!.address, fallback)
        setOracleScalerFactory(prev => prev ? { ...prev, version: fallback } : null)
      }
    }
    fetchFactoryVersion()
    // Intentionally narrow deps: only re-fetch when factory address or chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oracleScalerFactory?.address, siloLensAddress, wizardData.networkInfo?.chainId])

  // Fetch ChainlinkV3OracleFactory version via Silo Lens (cached per chainId+address)
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!chainlinkV3OracleFactory?.address || !siloLensAddress || !chainId) return
    const cached = getCachedVersion(chainId, chainlinkV3OracleFactory.address)
    if (cached != null) {
      setChainlinkV3OracleFactory(prev => prev ? { ...prev, version: cached } : null)
      return
    }
    const fetchFactoryVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const lensContract = new ethers.Contract(siloLensAddress, siloLensAbi, provider)
        const version = String(await lensContract.getVersion(chainlinkV3OracleFactory!.address))
        setCachedVersion(chainId, chainlinkV3OracleFactory!.address, version)
        setChainlinkV3OracleFactory(prev => prev ? { ...prev, version } : null)
      } catch (err) {
        console.warn('Failed to fetch ChainlinkV3OracleFactory version from Silo Lens:', err)
        const fallback = '—'
        setCachedVersion(chainId, chainlinkV3OracleFactory!.address, fallback)
        setChainlinkV3OracleFactory(prev => prev ? { ...prev, version: fallback } : null)
      }
    }
    fetchFactoryVersion()
    // Intentionally narrow deps: only re-fetch when factory address or chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainlinkV3OracleFactory?.address, siloLensAddress, wizardData.networkInfo?.chainId])

  // When no pre-deployed scalers for token0 but we have factory, set custom scaler (quote = token0)
  useEffect(() => {
    if (
      wizardData.oracleType0?.type === 'scaler' &&
      availableScalers.token0.length === 0 &&
      oracleScalerFactory &&
      wizardData.token0
    ) {
      const quoteToken = wizardData.token0.address
      setSelectedScalers(prev => {
        if (prev.token0?.customCreate && prev.token0.customCreate.factoryAddress === oracleScalerFactory.address && prev.token0.customCreate.quoteToken === quoteToken) return prev
        return {
          ...prev,
          token0: {
            name: 'PLACEHOLDER',
            address: '',
            scaleFactor: '1',
            valid: true,
            customCreate: { factoryAddress: oracleScalerFactory.address, quoteToken }
          }
        }
      })
    }
    // Intentionally narrow: only react to type, list length, factory and token0 address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType0?.type, availableScalers.token0.length, oracleScalerFactory, wizardData.token0?.address])

  // When no pre-deployed scalers for token1 but we have factory, set custom scaler (quote = token1)
  useEffect(() => {
    if (
      wizardData.oracleType1?.type === 'scaler' &&
      availableScalers.token1.length === 0 &&
      oracleScalerFactory &&
      wizardData.token1
    ) {
      const quoteToken = wizardData.token1.address
      setSelectedScalers(prev => {
        if (prev.token1?.customCreate && prev.token1.customCreate.factoryAddress === oracleScalerFactory.address && prev.token1.customCreate.quoteToken === quoteToken) return prev
        return {
          ...prev,
          token1: {
            name: 'PLACEHOLDER',
            address: '',
            scaleFactor: '1',
            valid: true,
            customCreate: { factoryAddress: oracleScalerFactory.address, quoteToken }
          }
        }
      })
    }
    // Intentionally narrow: only react to type, list length, factory and token1 address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType1?.type, availableScalers.token1.length, oracleScalerFactory, wizardData.token1?.address])

  // Fetch Chainlink primary aggregator: description, latestRoundData (answer), decimals; compute normalization (token0)
  useEffect(() => {
    if (wizardData.oracleType0?.type !== 'chainlink' || !wizardData.token0 || !wizardData.token1) return
    const token0 = wizardData.token0
    const token1 = wizardData.token1
    const addr = chainlink0.primaryAggregator?.trim()
    if (!addr || !ethers.isAddress(addr)) {
      setChainlink0(prev => ({
        ...prev,
        primaryAggregatorDecimals: undefined,
        mathLineMultiplier: undefined,
        mathLineDivider: undefined,
        normalizationDivider: '0',
        normalizationMultiplier: '0',
        aggregatorDescription: undefined,
        aggregatorLatestAnswer: undefined
      }))
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        if (!window.ethereum) return
        const provider = new ethers.BrowserProvider(window.ethereum)
        const agg = new ethers.Contract(addr, aggregatorV3Abi, provider)
        const [description, roundData, dec] = await Promise.all([
          agg.description(),
          agg.latestRoundData(),
          agg.decimals()
        ])
        const aggregatorDecimals = Number(dec)
        if (cancelled) return
        const answerFormatted = ethers.formatUnits(roundData.answer, aggregatorDecimals)
        const base = token0.decimals
        const quote = token1.decimals
        const { divider, multiplier, mathLineMultiplier, mathLineDivider } = computeChainlinkNormalization(base, quote, aggregatorDecimals)
        if (cancelled) return
        setChainlink0(prev => ({
          ...prev,
          primaryAggregatorDecimals: aggregatorDecimals,
          mathLineMultiplier,
          mathLineDivider,
          normalizationDivider: divider,
          normalizationMultiplier: multiplier,
          aggregatorDescription: String(description ?? ''),
          aggregatorLatestAnswer: answerFormatted
        }))
      } catch {
        if (!cancelled) setChainlink0(prev => ({
          ...prev,
          primaryAggregatorDecimals: undefined,
          mathLineMultiplier: undefined,
          mathLineDivider: undefined,
          normalizationDivider: '0',
          normalizationMultiplier: '0',
          aggregatorDescription: undefined,
          aggregatorLatestAnswer: undefined
        }))
      }
    }
    run()
    return () => { cancelled = true }
    // Intentionally narrow: avoid re-running on every wizardData reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType0?.type, wizardData.token0?.decimals, wizardData.token1?.decimals, chainlink0.primaryAggregator])

  // Fetch Chainlink primary aggregator: description, latestRoundData (answer), decimals; compute normalization (token1)
  useEffect(() => {
    if (wizardData.oracleType1?.type !== 'chainlink' || !wizardData.token0 || !wizardData.token1) return
    const token0 = wizardData.token0
    const token1 = wizardData.token1
    const addr = chainlink1.primaryAggregator?.trim()
    if (!addr || !ethers.isAddress(addr)) {
      setChainlink1(prev => ({
        ...prev,
        primaryAggregatorDecimals: undefined,
        mathLineMultiplier: undefined,
        mathLineDivider: undefined,
        normalizationDivider: '0',
        normalizationMultiplier: '0',
        aggregatorDescription: undefined,
        aggregatorLatestAnswer: undefined
      }))
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        if (!window.ethereum) return
        const provider = new ethers.BrowserProvider(window.ethereum)
        const agg = new ethers.Contract(addr, aggregatorV3Abi, provider)
        const [description, roundData, dec] = await Promise.all([
          agg.description(),
          agg.latestRoundData(),
          agg.decimals()
        ])
        const aggregatorDecimals = Number(dec)
        if (cancelled) return
        const answerFormatted = ethers.formatUnits(roundData.answer, aggregatorDecimals)
        const base = token1.decimals
        const quote = token0.decimals
        const { divider, multiplier, mathLineMultiplier, mathLineDivider } = computeChainlinkNormalization(base, quote, aggregatorDecimals)
        if (cancelled) return
        setChainlink1(prev => ({
          ...prev,
          primaryAggregatorDecimals: aggregatorDecimals,
          mathLineMultiplier,
          mathLineDivider,
          normalizationDivider: divider,
          normalizationMultiplier: multiplier,
          aggregatorDescription: String(description ?? ''),
          aggregatorLatestAnswer: answerFormatted
        }))
      } catch {
        if (!cancelled) setChainlink1(prev => ({
          ...prev,
          primaryAggregatorDecimals: undefined,
          mathLineMultiplier: undefined,
          mathLineDivider: undefined,
          normalizationDivider: '0',
          normalizationMultiplier: '0',
          aggregatorDescription: undefined,
          aggregatorLatestAnswer: undefined
        }))
      }
    }
    run()
    return () => { cancelled = true }
    // Intentionally narrow: avoid re-running on every wizardData reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleType1?.type, wizardData.token0?.decimals, wizardData.token1?.decimals, chainlink1.primaryAggregator])

  // Sync chainlink state from wizard when returning to step
  useEffect(() => {
    const c0 = wizardData.oracleConfiguration?.token0?.chainlinkOracle
    if (c0) {
      setChainlink0(prev => ({
        ...prev,
        baseToken: c0.baseToken,
        primaryAggregator: c0.primaryAggregator,
        secondaryAggregator: c0.secondaryAggregator || '',
        normalizationDivider: c0.normalizationDivider,
        normalizationMultiplier: c0.normalizationMultiplier,
        invertSecondPrice: c0.invertSecondPrice
      }))
      const hasSecondary = !!(c0.secondaryAggregator && c0.secondaryAggregator !== ethers.ZeroAddress && c0.secondaryAggregator.trim() !== '')
      setUseSecondaryAggregator0(hasSecondary)
    }
    const c1 = wizardData.oracleConfiguration?.token1?.chainlinkOracle
    if (c1) {
      setChainlink1(prev => ({
        ...prev,
        baseToken: c1.baseToken,
        primaryAggregator: c1.primaryAggregator,
        secondaryAggregator: c1.secondaryAggregator || '',
        normalizationDivider: c1.normalizationDivider,
        normalizationMultiplier: c1.normalizationMultiplier,
        invertSecondPrice: c1.invertSecondPrice
      }))
      const hasSecondary = !!(c1.secondaryAggregator && c1.secondaryAggregator !== ethers.ZeroAddress && c1.secondaryAggregator.trim() !== '')
      setUseSecondaryAggregator1(hasSecondary)
    }
    // Intentionally narrow: sync only when saved chainlink config refs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.oracleConfiguration?.token0?.chainlinkOracle, wizardData.oracleConfiguration?.token1?.chainlinkOracle])

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

      // Validate selections (pre-deployed or custom create)
      if (wizardData.oracleType0.type === 'scaler' && (!selectedScalers.token0 || (!selectedScalers.token0.customCreate && !selectedScalers.token0.valid))) {
        throw new Error('Please select or configure a scaler oracle for Token 0')
      }
      if (wizardData.oracleType1.type === 'scaler' && (!selectedScalers.token1 || (!selectedScalers.token1.customCreate && !selectedScalers.token1.valid))) {
        throw new Error('Please select or configure a scaler oracle for Token 1')
      }
      if (wizardData.oracleType0.type === 'chainlink') {
        if (!chainlink0.primaryAggregator?.trim() || !ethers.isAddress(chainlink0.primaryAggregator)) {
          throw new Error('Please enter a valid primary aggregator address for Token 0 Chainlink oracle')
        }
        if (!chainlink0.normalizationDivider || !chainlink0.normalizationMultiplier) {
          throw new Error('Chainlink normalization not computed for Token 0. Enter a valid primary aggregator.')
        }
      }
      if (wizardData.oracleType1.type === 'chainlink') {
        if (!chainlink1.primaryAggregator?.trim() || !ethers.isAddress(chainlink1.primaryAggregator)) {
          throw new Error('Please enter a valid primary aggregator address for Token 1 Chainlink oracle')
        }
        if (!chainlink1.normalizationDivider || !chainlink1.normalizationMultiplier) {
          throw new Error('Chainlink normalization not computed for Token 1. Enter a valid primary aggregator.')
        }
      }

      // Create oracle configuration
      const config: OracleConfiguration = {
        token0: {
          type: wizardData.oracleType0.type,
          scalerOracle: wizardData.oracleType0.type === 'scaler' ? selectedScalers.token0! : undefined,
          chainlinkOracle: wizardData.oracleType0.type === 'chainlink' ? {
            baseToken: 'token0',
            primaryAggregator: chainlink0.primaryAggregator!.trim(),
            secondaryAggregator: chainlink0.secondaryAggregator?.trim() || ethers.ZeroAddress,
            normalizationDivider: chainlink0.normalizationDivider ?? '0',
            normalizationMultiplier: chainlink0.normalizationMultiplier ?? '0',
            invertSecondPrice: chainlink0.invertSecondPrice ?? false
          } : undefined
        },
        token1: {
          type: wizardData.oracleType1.type,
          scalerOracle: wizardData.oracleType1.type === 'scaler' ? selectedScalers.token1! : undefined,
          chainlinkOracle: wizardData.oracleType1.type === 'chainlink' ? {
            baseToken: 'token1',
            primaryAggregator: chainlink1.primaryAggregator!.trim(),
            secondaryAggregator: chainlink1.secondaryAggregator?.trim() || ethers.ZeroAddress,
            normalizationDivider: chainlink1.normalizationDivider ?? '0',
            normalizationMultiplier: chainlink1.normalizationMultiplier ?? '0',
            invertSecondPrice: chainlink1.invertSecondPrice ?? false
          } : undefined
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
            Oracle Type: {wizardData.oracleType0.type === 'none' ? 'No Oracle' : wizardData.oracleType0.type === 'scaler' ? 'Scaler Oracle' : 'Chainlink'}
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
          ) : wizardData.oracleType0.type === 'chainlink' ? (
            <div className="space-y-4">
              {chainlinkV3OracleFactory ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-1">ChainlinkV3OracleFactory</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={getBlockExplorerUrl(chainlinkV3OracleFactory.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all"
                    >
                      {chainlinkV3OracleFactory.address}
                    </a>
                    <CopyButton value={chainlinkV3OracleFactory.address} title="Copy address" />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Version</p>
                  <p className="text-sm text-gray-300">{chainlinkV3OracleFactory.version || '…'}</p>
                </div>
              ) : (
                <p className="text-sm text-yellow-400">Loading ChainlinkV3OracleFactory for this chain…</p>
              )}
              <p className="text-sm text-gray-400">
                Base token: <span className="text-white font-medium">{wizardData.token0.symbol}</span>
                {' · '}
                Quote token: <span className="text-white font-medium">{wizardData.token1.symbol}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Primary aggregator address *</label>
                <input
                  type="text"
                  value={chainlink0.primaryAggregator}
                  onChange={(e) => setChainlink0(prev => ({ ...prev, primaryAggregator: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                />
                {(chainlink0.aggregatorDescription != null || chainlink0.aggregatorLatestAnswer != null || chainlink0.primaryAggregatorDecimals != null) && (
                  <div className="mt-2 p-3 bg-gray-800/80 border border-gray-700 rounded-lg text-sm space-y-1">
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Aggregator verification</p>
                    {chainlink0.aggregatorDescription != null && (
                      <p><span className="text-gray-500">Description:</span> <span className="text-gray-300">{chainlink0.aggregatorDescription || '—'}</span></p>
                    )}
                    {chainlink0.primaryAggregatorDecimals != null && (
                      <p><span className="text-gray-500">Decimals:</span> <span className="text-gray-300">{chainlink0.primaryAggregatorDecimals}</span></p>
                    )}
                    {chainlink0.aggregatorLatestAnswer != null && (
                      <p><span className="text-gray-500">Latest answer (with decimals):</span> <span className="text-gray-300 font-mono">{chainlink0.aggregatorLatestAnswer}</span></p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id="useSecondary0"
                    checked={useSecondaryAggregator0}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setUseSecondaryAggregator0(checked)
                      if (!checked) setChainlink0(prev => ({ ...prev, secondaryAggregator: '', invertSecondPrice: false }))
                    }}
                    className="rounded"
                  />
                  <label htmlFor="useSecondary0" className="text-sm font-medium text-gray-300">Secondary aggregator (optional)</label>
                </div>
                {useSecondaryAggregator0 && (
                  <input
                    type="text"
                    value={chainlink0.secondaryAggregator}
                    onChange={(e) => setChainlink0(prev => ({ ...prev, secondaryAggregator: e.target.value }))}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                  />
                )}
              </div>
              {useSecondaryAggregator0 && chainlink0.secondaryAggregator?.trim() && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="invert0"
                    checked={chainlink0.invertSecondPrice}
                    onChange={(e) => setChainlink0(prev => ({ ...prev, invertSecondPrice: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="invert0" className="text-sm text-gray-300">Invert second price</label>
                </div>
              )}
              {(chainlink0.normalizationDivider !== '0' || chainlink0.normalizationMultiplier !== '0') && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <div className={chainlink0.normalizationMultiplier === '0' ? 'opacity-60' : ''}>
                    <p className={`text-sm font-medium text-gray-300 mb-0.5 ${chainlink0.normalizationMultiplier === '0' ? 'line-through' : ''}`}>normalizationMultiplier</p>
                    <p className="text-sm text-white font-mono">{formatPowerOfTen(chainlink0.normalizationMultiplier ?? '0')}</p>
                    {chainlink0.normalizationMultiplier !== '0' && chainlink0.mathLineMultiplier && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{chainlink0.mathLineMultiplier}</p>
                    )}
                  </div>
                  <div className={chainlink0.normalizationDivider === '0' ? 'opacity-60' : ''}>
                    <p className={`text-sm font-medium text-gray-300 mb-0.5 ${chainlink0.normalizationDivider === '0' ? 'line-through' : ''}`}>normalizationDivider</p>
                    <p className="text-sm text-white font-mono">{formatPowerOfTen(chainlink0.normalizationDivider ?? '0')}</p>
                    {chainlink0.normalizationDivider !== '0' && chainlink0.mathLineDivider && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{chainlink0.mathLineDivider}</p>
                    )}
                  </div>
                </div>
              )}
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
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-gray-300">
                    No pre-defined scaler found for this token. The scaler will be deployed together with the market.
                  </p>
                  {oracleScalerFactory ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">OracleScalerFactory</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={getBlockExplorerUrl(oracleScalerFactory.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all"
                          >
                            {oracleScalerFactory.address}
                          </a>
                          <CopyButton value={oracleScalerFactory.address} title="Copy address" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Version</p>
                        <p className="text-sm text-gray-300">{oracleScalerFactory.version || '…'}</p>
                      </div>
                      <p className="text-xs text-gray-500">Quote token: Token 0 ({wizardData.token0.symbol})</p>
                    </>
                  ) : (
                    <p className="text-sm text-yellow-400">Loading OracleScalerFactory for this chain…</p>
                  )}
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
                            <span className="text-sm text-gray-400">
                              Factor:{' '}
                              <a
                                href={getBlockExplorerUrl(oracle.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {oracle.scaleFactor}
                              </a>
                            </span>
                            {oracle.valid ? (
                              <span className="text-green-400 text-xs">✓ Valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ Invalid</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={getBlockExplorerUrl(oracle.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            {oracle.address.slice(0, 6)}...{oracle.address.slice(-4)}
                          </a>
                          <span onClick={(e) => e.stopPropagation()}>
                            <CopyButton value={oracle.address} title="Copy address" />
                          </span>
                        </div>
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
            Oracle Type: {wizardData.oracleType1.type === 'none' ? 'No Oracle' : wizardData.oracleType1.type === 'scaler' ? 'Scaler Oracle' : 'Chainlink'}
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
          ) : wizardData.oracleType1.type === 'chainlink' ? (
            <div className="space-y-4">
              {chainlinkV3OracleFactory ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-1">ChainlinkV3OracleFactory</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={getBlockExplorerUrl(chainlinkV3OracleFactory.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all"
                    >
                      {chainlinkV3OracleFactory.address}
                    </a>
                    <CopyButton value={chainlinkV3OracleFactory.address} title="Copy address" />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Version</p>
                  <p className="text-sm text-gray-300">{chainlinkV3OracleFactory.version || '…'}</p>
                </div>
              ) : (
                <p className="text-sm text-yellow-400">Loading ChainlinkV3OracleFactory for this chain…</p>
              )}
              <p className="text-sm text-gray-400">
                Base token: <span className="text-white font-medium">{wizardData.token1.symbol}</span>
                {' · '}
                Quote token: <span className="text-white font-medium">{wizardData.token0.symbol}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Primary aggregator address *</label>
                <input
                  type="text"
                  value={chainlink1.primaryAggregator}
                  onChange={(e) => setChainlink1(prev => ({ ...prev, primaryAggregator: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                />
                {(chainlink1.aggregatorDescription != null || chainlink1.aggregatorLatestAnswer != null || chainlink1.primaryAggregatorDecimals != null) && (
                  <div className="mt-2 p-3 bg-gray-800/80 border border-gray-700 rounded-lg text-sm space-y-1">
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Aggregator verification</p>
                    {chainlink1.aggregatorDescription != null && (
                      <p><span className="text-gray-500">Description:</span> <span className="text-gray-300">{chainlink1.aggregatorDescription || '—'}</span></p>
                    )}
                    {chainlink1.primaryAggregatorDecimals != null && (
                      <p><span className="text-gray-500">Decimals:</span> <span className="text-gray-300">{chainlink1.primaryAggregatorDecimals}</span></p>
                    )}
                    {chainlink1.aggregatorLatestAnswer != null && (
                      <p><span className="text-gray-500">Latest answer (with decimals):</span> <span className="text-gray-300 font-mono">{chainlink1.aggregatorLatestAnswer}</span></p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id="useSecondary1"
                    checked={useSecondaryAggregator1}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setUseSecondaryAggregator1(checked)
                      if (!checked) setChainlink1(prev => ({ ...prev, secondaryAggregator: '', invertSecondPrice: false }))
                    }}
                    className="rounded"
                  />
                  <label htmlFor="useSecondary1" className="text-sm font-medium text-gray-300">Secondary aggregator (optional)</label>
                </div>
                {useSecondaryAggregator1 && (
                  <input
                    type="text"
                    value={chainlink1.secondaryAggregator}
                    onChange={(e) => setChainlink1(prev => ({ ...prev, secondaryAggregator: e.target.value }))}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                  />
                )}
              </div>
              {useSecondaryAggregator1 && chainlink1.secondaryAggregator?.trim() && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="invert1"
                    checked={chainlink1.invertSecondPrice}
                    onChange={(e) => setChainlink1(prev => ({ ...prev, invertSecondPrice: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="invert1" className="text-sm text-gray-300">Invert second price</label>
                </div>
              )}
              {(chainlink1.normalizationDivider !== '0' || chainlink1.normalizationMultiplier !== '0') && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <div className={chainlink1.normalizationMultiplier === '0' ? 'opacity-60' : ''}>
                    <p className={`text-sm font-medium text-gray-300 mb-0.5 ${chainlink1.normalizationMultiplier === '0' ? 'line-through' : ''}`}>normalizationMultiplier</p>
                    <p className="text-sm text-white font-mono">{formatPowerOfTen(chainlink1.normalizationMultiplier ?? '0')}</p>
                    {chainlink1.normalizationMultiplier !== '0' && chainlink1.mathLineMultiplier && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{chainlink1.mathLineMultiplier}</p>
                    )}
                  </div>
                  <div className={chainlink1.normalizationDivider === '0' ? 'opacity-60' : ''}>
                    <p className={`text-sm font-medium text-gray-300 mb-0.5 ${chainlink1.normalizationDivider === '0' ? 'line-through' : ''}`}>normalizationDivider</p>
                    <p className="text-sm text-white font-mono">{formatPowerOfTen(chainlink1.normalizationDivider ?? '0')}</p>
                    {chainlink1.normalizationDivider !== '0' && chainlink1.mathLineDivider && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{chainlink1.mathLineDivider}</p>
                    )}
                  </div>
                </div>
              )}
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
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-gray-300">
                    No pre-defined scaler found for this token. The scaler will be deployed together with the market.
                  </p>
                  {oracleScalerFactory ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">OracleScalerFactory</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={getBlockExplorerUrl(oracleScalerFactory.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all"
                          >
                            {oracleScalerFactory.address}
                          </a>
                          <CopyButton value={oracleScalerFactory.address} title="Copy address" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Version</p>
                        <p className="text-sm text-gray-300">{oracleScalerFactory.version || '…'}</p>
                      </div>
                      <p className="text-xs text-gray-500">Quote token: Token 1 ({wizardData.token1.symbol})</p>
                    </>
                  ) : (
                    <p className="text-sm text-yellow-400">Loading OracleScalerFactory for this chain…</p>
                  )}
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
                            <span className="text-sm text-gray-400">
                              Factor:{' '}
                              <a
                                href={getBlockExplorerUrl(oracle.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {oracle.scaleFactor}
                              </a>
                            </span>
                            {oracle.valid ? (
                              <span className="text-green-400 text-xs">✓ Valid</span>
                            ) : (
                              <span className="text-red-400 text-xs">✗ Invalid</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={getBlockExplorerUrl(oracle.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            {oracle.address.slice(0, 6)}...{oracle.address.slice(-4)}
                          </a>
                          <span onClick={(e) => e.stopPropagation()}>
                            <CopyButton value={oracle.address} title="Copy address" />
                          </span>
                        </div>
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
              (wizardData.oracleType0.type === 'scaler' && (!selectedScalers.token0 || (!selectedScalers.token0.customCreate && !selectedScalers.token0.valid))) || 
              (wizardData.oracleType1.type === 'scaler' && (!selectedScalers.token1 || (!selectedScalers.token1.customCreate && !selectedScalers.token1.valid))) ||
              (wizardData.oracleType0.type === 'chainlink' && (!chainlink0.primaryAggregator?.trim() || !ethers.isAddress(chainlink0.primaryAggregator) || (chainlink0.normalizationDivider === '0' && chainlink0.normalizationMultiplier === '0'))) ||
              (wizardData.oracleType1.type === 'chainlink' && (!chainlink1.primaryAggregator?.trim() || !ethers.isAddress(chainlink1.primaryAggregator) || (chainlink1.normalizationDivider === '0' && chainlink1.normalizationMultiplier === '0')))}
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
