'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import { parseDeployTxReceipt } from '@/utils/parseDeployTxEvents'
import { fetchMarketConfig, MarketConfig } from '@/utils/fetchMarketConfig'
import MarketConfigTree from '@/components/MarketConfigTree'
import CopyButton from '@/components/CopyButton'
import ContractInfo from '@/components/ContractInfo'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { verifySiloAddress } from '@/utils/verification/siloAddressVerification'
import { verifySiloImplementation } from '@/utils/verification/siloImplementationVerification'
import { verifyAddressInJson } from '@/utils/verification/addressInJsonVerification'
import { displayNumberToBigint } from '@/utils/verification/normalization'
import { getChainName, getExplorerBaseUrl } from '@/utils/networks'

export default function Step11Verification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { wizardData, setVerificationFromWizard } = useWizard()
  const [input, setInput] = useState<string>('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [config, setConfig] = useState<MarketConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [siloFactory, setSiloFactory] = useState<{ address: string; version: string } | null>(null)
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [detectedChainId, setDetectedChainId] = useState<string>('')
  const [siloVerification, setSiloVerification] = useState<{ silo0: boolean | null; silo1: boolean | null; error: string | null }>({
    silo0: null,
    silo1: null,
    error: null
  })
  const [implementationFromEvent, setImplementationFromEvent] = useState<string | null>(null)
  const [implementationFromRepo, setImplementationFromRepo] = useState<{ address: string; version: string; description?: string } | null>(null)
  const [implementationVerified, setImplementationVerified] = useState<boolean | null>(null)
  const [hookOwnerVerification, setHookOwnerVerification] = useState<{ onChainOwner: string | null; wizardOwner: string | null; isInAddressesJson: boolean | null }>({
    onChainOwner: null,
    wizardOwner: null,
    isInAddressesJson: null
  })
  const [irmOwnerVerification, setIrmOwnerVerification] = useState<{ onChainOwner: string | null; wizardOwner: string | null; isInAddressesJson: boolean | null }>({
    onChainOwner: null,
    wizardOwner: null,
    isInAddressesJson: null
  })
  const [tokenVerification, setTokenVerification] = useState<{ 
    token0: { onChainToken: string | null; wizardToken: string | null } | null
    token1: { onChainToken: string | null; wizardToken: string | null } | null
  }>({
    token0: null,
    token1: null
  })
  const [numericValueVerification, setNumericValueVerification] = useState<{
    silo0: {
      maxLtv: bigint | null
      lt: bigint | null
      liquidationTargetLtv: bigint | null
      liquidationFee: bigint | null
      flashloanFee: bigint | null
    } | null
    silo1: {
      maxLtv: bigint | null
      lt: bigint | null
      liquidationTargetLtv: bigint | null
      liquidationFee: bigint | null
      flashloanFee: bigint | null
    } | null
  }>({
    silo0: null,
    silo1: null
  })
  // Address in JSON verification - always performed regardless of wizard data
  const [addressInJsonVerification, setAddressInJsonVerification] = useState<Map<string, boolean>>(new Map())
  const [addressVersions, setAddressVersions] = useState<Map<string, string>>(new Map())

  const chainId = wizardData.networkInfo?.chainId || detectedChainId
  const explorerUrl = chainId ? getExplorerBaseUrl(chainId) : 'https://etherscan.io'

  // Fetch Silo Factory address and version
  // Always fetch - this is independent verification that doesn't require wizard data
  useEffect(() => {
    if (!chainId || !config) return

    const fetchSiloFactory = async () => {
      const chainName = getChainName(chainId)
      const factoryContractName = 'SiloFactory.sol'
      
      try {
        // Fetch Silo Factory address
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${factoryContractName}.json`
        )
        if (response.ok) {
          const data = await response.json()
          const address = data.address || ''
          if (address && ethers.isAddress(address)) {
            setSiloFactory(prev => {
              if (prev && prev.address.toLowerCase() === address.toLowerCase()) {
                return prev
              }
              return { address, version: '—' }
            })
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Silo Factory:', err)
      }

      // Fetch SiloLens address
      try {
        const lensResponse = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloLens.sol.json`
        )
        if (lensResponse.ok) {
          const lensData = await lensResponse.json()
          const lensAddr = lensData.address || ''
          if (lensAddr && ethers.isAddress(lensAddr)) {
            setSiloLensAddress(lensAddr)
          } else {
            setSiloLensAddress('')
          }
        } else {
          // Missing deployment file is non-fatal (e.g. chain not deployed yet).
          setSiloLensAddress('')
        }
      } catch (err) {
        // Network errors must not block other verification logic.
        console.warn('Failed to fetch SiloLens (non-fatal):', err)
        setSiloLensAddress('')
      }
    }

    fetchSiloFactory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, config])

  // Fetch Silo Implementation addresses from repository (_siloImplementations.json)
  // Only run verification if we have wizard data (verificationFromWizard is true)
  useEffect(() => {
    if (!wizardData.verificationFromWizard || !chainId || !implementationFromEvent) {
      // Reset implementation verification state if we don't have wizard data
      if (!wizardData.verificationFromWizard) {
        setImplementationFromRepo(null)
        setImplementationVerified(null)
      }
      return
    }

    const fetchImplementation = async () => {
      const chainName = getChainName(chainId)
      
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/silo/_siloImplementations.json`
        )
        if (response.ok) {
          const data = await response.json()
          const chainImplementations = data[chainName] || []
          
          // Find matching implementation address
          const normalizedEventAddress = ethers.getAddress(implementationFromEvent).toLowerCase()
          const matchingImpl = chainImplementations.find((impl: { implementation: string }) => 
            ethers.getAddress(impl.implementation).toLowerCase() === normalizedEventAddress
          )
          
          if (matchingImpl) {
            const repoAddress = matchingImpl.implementation
            
            // Use centralized verification function
            // implementationFromEvent: Implementation address from NewSilo event (on-chain)
            // repoAddress: Implementation address from repository JSON file
            const verified = verifySiloImplementation(implementationFromEvent, repoAddress)
            
            setImplementationFromRepo({ 
              address: repoAddress, 
              version: '',
              description: matchingImpl.description
            })
            setImplementationVerified(verified)
          } else {
            // If not found in repo, still show the event address but mark as not verified
            // Use centralized verification function (will return false since repoAddress is null)
            const verified = verifySiloImplementation(implementationFromEvent, null)
            
            setImplementationFromRepo({ 
              address: implementationFromEvent, 
              version: '',
              description: undefined
            })
            setImplementationVerified(verified)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Silo Implementation:', err)
        // Only set error state if we have wizard data
        if (wizardData.verificationFromWizard) {
          setImplementationVerified(false)
        }
      }
    }

    fetchImplementation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.verificationFromWizard, chainId, implementationFromEvent])

  // Fetch Silo Factory + verified implementation versions via one bulk Silo Lens getVersions call.
  useEffect(() => {
    if (!siloLensAddress || !chainId) return
    if (typeof window === 'undefined' || !window.ethereum) return

    const factoryAddress = siloFactory?.address
    const shouldFetchImplementation =
      wizardData.verificationFromWizard &&
      implementationVerified === true &&
      !!implementationFromRepo?.address
    const implementationAddress = shouldFetchImplementation ? implementationFromRepo!.address : undefined

    const addresses = [factoryAddress, implementationAddress].filter(
      (value): value is string => !!value
    )
    if (addresses.length === 0) return

    const fetchVersions = async () => {
      const ethereum = window.ethereum
      if (!ethereum) return
      const provider = new ethers.BrowserProvider(ethereum)

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const versionsByAddress = await fetchSiloLensVersionsWithCache({
            provider,
            lensAddress: siloLensAddress,
            chainId,
            addresses
          })

          const getVersion = (address?: string) =>
            address ? versionsByAddress.get(address.toLowerCase()) ?? '' : ''

          const factoryVersion = factoryAddress ? getVersion(factoryAddress) : ''
          const implementationVersion = implementationAddress ? getVersion(implementationAddress) : ''

          if (factoryAddress && factoryVersion !== '') {
            setSiloFactory(prev => (prev ? { ...prev, version: factoryVersion } : null))
          }

          if (implementationAddress && implementationVersion !== '') {
            setImplementationFromRepo(prev =>
              prev ? { ...prev, version: implementationVersion } : null
            )
          }

          const needsFactoryRetry = !!factoryAddress && factoryVersion === ''
          const needsImplementationRetry = !!implementationAddress && implementationVersion === ''

          if (!needsFactoryRetry && !needsImplementationRetry) return
        } catch (err) {
          if (attempt === 3) {
            console.warn('Failed to fetch Silo Factory/Implementation versions:', err)
          }
        }

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 800 * attempt))
        }
      }

      if (factoryAddress) {
        setSiloFactory(prev => (prev ? { ...prev, version: '—' } : null))
      }
      if (implementationAddress) {
        setImplementationFromRepo(prev => (prev ? { ...prev, version: '—' } : null))
      }
    }

    fetchVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wizardData.verificationFromWizard,
    implementationVerified,
    implementationFromRepo?.address,
    siloFactory?.address,
    siloLensAddress,
    chainId
  ])

  // Verify silo addresses using Silo Factory isSilo method
  // Always run verification - this is independent verification that doesn't require wizard data
  useEffect(() => {
    if (!siloFactory?.address || !config || typeof window === 'undefined' || !window.ethereum) {
      return
    }

    const verifySilos = async () => {
      try {
        const ethereum = window.ethereum
        if (!ethereum) return
        const provider = new ethers.BrowserProvider(ethereum)

        // Use centralized verification function from src/utils/verification/siloAddressVerification.ts
        // config.silo0.silo: Silo address from on-chain config
        // config.silo1.silo: Silo address from on-chain config
        // siloFactory.address: Silo Factory contract address (from repository deployment JSON)
        // provider: Ethers.js provider for making on-chain contract calls
        const [silo0Verified, silo1Verified] = await Promise.all([
          verifySiloAddress(config.silo0.silo, siloFactory.address, provider),
          verifySiloAddress(config.silo1.silo, siloFactory.address, provider)
        ])

        setSiloVerification({
          silo0: silo0Verified,
          silo1: silo1Verified,
          error: null
        })
      } catch (err) {
        console.error('Failed to verify silo addresses:', err)
        setSiloVerification({
          silo0: null,
          silo1: null,
          error: err instanceof Error ? err.message : 'Failed to verify silo addresses'
        })
      }
    }

    verifySilos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siloFactory?.address, config])

  // Fetch versions for all addresses displayed in market configuration tree.
  // Keep existing behavior where addresses with known versions keep their own value.
  useEffect(() => {
    if (!config || !siloLensAddress || !chainId) {
      setAddressVersions(new Map())
      return
    }
    if (typeof window === 'undefined' || !window.ethereum) return

    const fetchTreeAddressVersions = async () => {
      try {
        const ethereum = window.ethereum
        if (!ethereum) return

        const provider = new ethers.BrowserProvider(ethereum)

        const addresses = new Set<string>()
        const addAddress = (value?: string | null) => {
          if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) return
          addresses.add(ethers.getAddress(value).toLowerCase())
        }

        addAddress(config.siloConfig)
        addAddress(config.silo0.silo)
        addAddress(config.silo1.silo)
        addAddress(config.silo0.token)
        addAddress(config.silo1.token)
        addAddress(config.silo0.protectedShareToken)
        addAddress(config.silo0.collateralShareToken)
        addAddress(config.silo0.debtShareToken)
        addAddress(config.silo1.protectedShareToken)
        addAddress(config.silo1.collateralShareToken)
        addAddress(config.silo1.debtShareToken)
        addAddress(config.silo0.hookReceiver)
        addAddress(config.silo1.hookReceiver)
        addAddress(config.silo0.solvencyOracle.address)
        addAddress(config.silo0.maxLtvOracle.address)
        addAddress(config.silo1.solvencyOracle.address)
        addAddress(config.silo1.maxLtvOracle.address)
        addAddress(config.silo0.interestRateModel.address)
        addAddress(config.silo1.interestRateModel.address)
        addAddress(config.silo0.factory)
        addAddress(config.silo1.factory)
        addAddress(config.silo0.hookReceiverOwner)
        addAddress(config.silo1.hookReceiverOwner)
        addAddress(config.silo0.interestRateModel.owner)
        addAddress(config.silo1.interestRateModel.owner)

        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses: Array.from(addresses)
        })

        const versions = new Map<string, string>()
        versionsByAddress.forEach((version, address) => {
          if (version !== '') versions.set(address, version)
        })

        setAddressVersions(versions)
      } catch (err) {
        console.warn('Failed to fetch tree address versions:', err)
      }
    }

    fetchTreeAddressVersions()
  }, [config, siloLensAddress, chainId])

  // If factory version was fetched through the general addressVersions flow, sync it to the top SiloFactory card.
  useEffect(() => {
    if (!siloFactory?.address) return
    const versionFromMap = addressVersions.get(siloFactory.address.toLowerCase())
    if (!versionFromMap || versionFromMap === '') return
    setSiloFactory(prev => (prev ? { ...prev, version: versionFromMap } : null))
  }, [siloFactory?.address, addressVersions])
  const handleVerify = useCallback(async (value: string, isTxHash: boolean) => {
    if (!value.trim()) {
      setError('Please enter a Silo Config address or transaction hash')
      return
    }

    if (!window.ethereum) {
      setError('Wallet not available. Please connect MetaMask.')
      return
    }

    setLoading(true)
    setError(null)
    setConfig(null)
    setShowForm(false)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      setDetectedChainId(network.chainId.toString())
      let siloConfigAddress: string

      if (isTxHash) {
        // Check that the transaction exists on the current network first
        const receipt = await provider.getTransactionReceipt(value.trim())
        if (!receipt) {
          setError(
            'Transaction not found on the current network. You might be connected to the wrong network, or the transaction hash is invalid.'
          )
          setShowForm(true)
          return
        }
        if (receipt.status !== 1) {
          throw new Error('Transaction failed or not yet confirmed.')
        }
        const parsed = parseDeployTxReceipt(receipt)
        if (!parsed.siloConfig) {
          throw new Error('Silo Config address not found in transaction events.')
        }
        siloConfigAddress = parsed.siloConfig
        setTxHash(value.trim())
        // Extract implementation address from NewSilo event
        if (parsed.implementation) {
          setImplementationFromEvent(parsed.implementation)
        }
      } else {
        // Validate address format
        if (!ethers.isAddress(value.trim())) {
          throw new Error('Invalid address format')
        }
        siloConfigAddress = ethers.getAddress(value.trim())
        // Check that the address is a contract on the current network before calling it
        const code = await provider.getCode(siloConfigAddress)
        if (!code || code === '0x' || code === '0x0') {
          setError(
            'This address is not a contract on the current network. You might be connected to the wrong network, or the address is invalid.'
          )
          setShowForm(true)
          return
        }
        setTxHash(null)
      }

      // Fetch market configuration
      const marketConfig = await fetchMarketConfig(provider, siloConfigAddress)
      setConfig(marketConfig)
      
      // Get chain ID - use wizard data if available, otherwise get from provider
      const chainIdForVerification = wizardData.networkInfo?.chainId || network.chainId.toString()
      
      // Verify addresses in JSON - ALWAYS performed regardless of wizard data
      // This verification is independent and can be done for any address
      const addressesToCheck: string[] = []
      
      // Collect all owner addresses and token addresses to check
      if (marketConfig.silo0.hookReceiverOwner) {
        addressesToCheck.push(marketConfig.silo0.hookReceiverOwner)
      }
      if (marketConfig.silo0.interestRateModel.owner) {
        addressesToCheck.push(marketConfig.silo0.interestRateModel.owner)
      }
      if (marketConfig.silo1.interestRateModel.owner) {
        addressesToCheck.push(marketConfig.silo1.interestRateModel.owner)
      }
      // Add token addresses for JSON verification
      if (marketConfig.silo0.token) {
        addressesToCheck.push(marketConfig.silo0.token)
      }
      if (marketConfig.silo1.token) {
        addressesToCheck.push(marketConfig.silo1.token)
      }
      
      // Check all addresses using centralized verification function from src/utils/verification/addressInJsonVerification.ts
      const jsonVerificationMap = new Map<string, boolean>()
      for (const address of addressesToCheck) {
        const isInJson = await verifyAddressInJson(address, chainIdForVerification)
        jsonVerificationMap.set(address.toLowerCase(), isInJson)
      }
      setAddressInJsonVerification(jsonVerificationMap)
      
      // Verify hook owner - always check on-chain address, wizard data is optional
      // Hook owner address is always available from on-chain config
      if (marketConfig.silo0.hookReceiverOwner) {
        const onChainOwner = marketConfig.silo0.hookReceiverOwner // Hook owner address from on-chain contract
        const wizardOwner = wizardData.hookOwnerAddress ?? null // Hook owner address from wizard state (optional)
        
        // Verification is performed in MarketConfigTree component using verifyAddress()
        // from src/utils/verification/addressVerification.ts
        
        // Get JSON verification result from the map (already checked above)
        const isInJson = jsonVerificationMap.get(onChainOwner.toLowerCase()) ?? null
        
        setHookOwnerVerification({
          onChainOwner,
          wizardOwner,
          isInAddressesJson: isInJson
        })
      } else {
        // Reset verification state if we don't have on-chain address
        setHookOwnerVerification({
          onChainOwner: null,
          wizardOwner: null,
          isInAddressesJson: null
        })
      }

      // Verify IRM owner - always check on-chain address, wizard data is optional
      // IRM owner address is always available from on-chain config (for kink models)
      if (marketConfig.silo0.interestRateModel.owner) {
        const onChainOwner = marketConfig.silo0.interestRateModel.owner // IRM owner address from on-chain contract
        const wizardOwner = wizardData.hookOwnerAddress ?? null // IRM owner address from wizard state (optional)
        
        // Verification is performed in MarketConfigTree component using verifyAddress()
        // from src/utils/verification/addressVerification.ts
        
        // Get JSON verification result from the map (already checked above)
        const isInJson = jsonVerificationMap.get(onChainOwner.toLowerCase()) ?? null
        
        setIrmOwnerVerification({
          onChainOwner,
          wizardOwner,
          isInAddressesJson: isInJson
        })
      } else {
        // Reset verification state if we don't have on-chain address
        setIrmOwnerVerification({
          onChainOwner: null,
          wizardOwner: null,
          isInAddressesJson: null
        })
      }

      // Verify tokens - check if we have wizard data (token0 and token1 addresses exist)
      if (wizardData.token0?.address && marketConfig.silo0.token) {
        const onChainToken0 = marketConfig.silo0.token // Token 0 address from on-chain contract
        const wizardToken0 = wizardData.token0.address // Token 0 address from wizard state
        
        setTokenVerification(prev => ({
          ...prev,
          token0: {
            onChainToken: onChainToken0,
            wizardToken: wizardToken0
          }
        }))
      } else {
        setTokenVerification(prev => ({
          ...prev,
          token0: null
        }))
      }

      if (wizardData.token1?.address && marketConfig.silo1.token) {
        const onChainToken1 = marketConfig.silo1.token // Token 1 address from on-chain contract
        const wizardToken1 = wizardData.token1.address // Token 1 address from wizard state
        
        setTokenVerification(prev => ({
          ...prev,
          token1: {
            onChainToken: onChainToken1,
            wizardToken: wizardToken1
          }
        }))
      } else {
        setTokenVerification(prev => ({
          ...prev,
          token1: null
        }))
      }

      // Verify numeric values - check if we have wizard data
      // Only perform verification if wizard data is available (verificationFromWizard will be set later)
      if (wizardData.borrowConfiguration && wizardData.feesConfiguration) {
        // Silo 0 numeric values
        setNumericValueVerification({
          silo0: {
            maxLtv: wizardData.borrowConfiguration.token0?.maxLTV ?? null,
            lt: wizardData.borrowConfiguration.token0?.liquidationThreshold ?? null,
            liquidationTargetLtv: wizardData.borrowConfiguration.token0?.liquidationTargetLTV ?? null,
            liquidationFee: wizardData.feesConfiguration.token0?.liquidationFee ?? null,
            flashloanFee: wizardData.feesConfiguration.token0?.flashloanFee ?? null
          },
          silo1: {
            maxLtv: wizardData.borrowConfiguration.token1?.maxLTV ?? null,
            lt: wizardData.borrowConfiguration.token1?.liquidationThreshold ?? null,
            liquidationTargetLtv: wizardData.borrowConfiguration.token1?.liquidationTargetLTV ?? null,
            liquidationFee: wizardData.feesConfiguration.token1?.liquidationFee ?? null,
            flashloanFee: wizardData.feesConfiguration.token1?.flashloanFee ?? null
          }
        })
      } else {
        // Reset verification state if we don't have wizard data
        setNumericValueVerification({
          silo0: null,
          silo1: null
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch market configuration')
      setShowForm(true)
    } finally {
      setLoading(false)
    }
  }, [
    wizardData.borrowConfiguration,
    wizardData.feesConfiguration,
    wizardData.hookOwnerAddress,
    wizardData.networkInfo?.chainId,
    wizardData.token0?.address,
    wizardData.token1?.address
  ])

  // Whether we're verifying the wizard's deployment (show summary) or standalone (hide summary)
  useEffect(() => {
    const fromWizard =
      wizardData.lastDeployTxHash != null &&
      wizardData.lastDeployTxHash !== '' &&
      txHash != null &&
      txHash.toLowerCase() === wizardData.lastDeployTxHash.toLowerCase()
    if (wizardData.verificationFromWizard !== fromWizard) {
      setVerificationFromWizard(fromWizard)
    }
  }, [txHash, wizardData.lastDeployTxHash, wizardData.verificationFromWizard, setVerificationFromWizard])

  // Extract hash from URL if present
  useEffect(() => {
    const urlHash = searchParams.get('tx')
    if (urlHash) {
      setInput(urlHash)
      handleVerify(urlHash, true)
    } else {
      // Check if we have saved transaction hash
      const savedHash = wizardData.lastDeployTxHash
      if (savedHash) {
        setTxHash(savedHash)
        handleVerify(savedHash, true)
      } else {
        setShowForm(true)
        setVerificationFromWizard(false)
      }
    }
  }, [searchParams, wizardData.lastDeployTxHash, handleVerify, setVerificationFromWizard])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    
    // Check if input looks like a transaction hash (66 chars starting with 0x)
    // or if it's a valid address (42 chars starting with 0x)
    const isTxHash = trimmed.length === 66 && trimmed.startsWith('0x') && /^0x[a-fA-F0-9]{64}$/.test(trimmed)
    const isAddress = ethers.isAddress(trimmed)
    
    if (!isTxHash && !isAddress) {
      setError('Invalid input. Please provide a valid Silo Config address or transaction hash.')
      return
    }
    
    handleVerify(trimmed, isTxHash)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setError(null)
    
    // Auto-detect if it's a URL with hash or address
    if (value.includes('tx/') || value.includes('transaction/')) {
      const hashMatch = value.match(/0x[a-fA-F0-9]{64}/)
      if (hashMatch) {
        setInput(hashMatch[0])
      }
    } else if (value.includes('address/')) {
      const addressMatch = value.match(/0x[a-fA-F0-9]{40}/)
      if (addressMatch) {
        setInput(addressMatch[0])
      }
    }
  }

  const goToDeployment = () => router.push('/wizard?step=10')
  const goToNewMarket = () => router.push('/')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 11: Verification
        </h1>
        <p className="text-gray-300 text-lg">
          View complete market configuration tree
        </p>
      </div>

      {showForm && !loading && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <label htmlFor="input" className="block text-sm font-medium text-white mb-2">
              Silo Config Address or Transaction Hash
            </label>
            <div className="flex gap-2">
              <input
                id="input"
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="0x... or transaction hash or explorer URL"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-700"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-lime-800 hover:bg-lime-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
              >
                {loading ? 'Loading...' : 'Verify'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Paste a Silo Config address, transaction hash, or explorer URL with transaction hash
            </p>
          </div>
        </form>
      )}

      {txHash && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Transaction</h3>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`${explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-600 hover:text-lime-500 font-mono text-sm break-all"
            >
              {txHash}
            </a>
            <CopyButton value={txHash} title="Copy transaction hash" />
          </div>
        </div>
      )}

      {config && siloFactory && (
        <div className="mb-6">
          <ContractInfo
            contractName="SiloFactory"
            address={siloFactory.address}
            version={siloFactory.version || '—'}
            chainId={chainId}
            isOracle={false}
          />
        </div>
      )}

      {wizardData.verificationFromWizard && implementationFromRepo && implementationFromEvent && (
        <div className="mb-6">
          <ContractInfo
            contractName="SILO implementation used for market deployment"
            address={implementationFromRepo.address}
            version={implementationFromRepo.version || '…'}
            chainId={chainId}
            isOracle={false}
            isImplementation={true}
            verificationIcon={implementationVerified === true ? (
              <div className="relative group inline-block">
                <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Implementation address verified: matches event from deployment transaction and exists in repository
                </div>
              </div>
            ) : implementationVerified === false ? (
              <div className="relative group inline-block">
                <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="absolute left-0 top-full mt-2 w-80 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Implementation address not found in repository: event value {implementationFromEvent} is not listed in _siloImplementations.json
                </div>
              </div>
            ) : undefined}
          />
        </div>
      )}

      {siloVerification.error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400">Silo verification error: {siloVerification.error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <svg className="animate-spin h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading market configuration...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 text-lime-600 hover:text-lime-500 text-sm"
            >
              Try again with different input
            </button>
          )}
        </div>
      )}

      {config && !loading && (() => {
        const ptOracleBaseDiscountVerification = {
          silo0: (config.silo0.solvencyOracle.type === 'PT-Linear' || config.silo0.solvencyOracle.type === 'PTLinear') && config.silo0.solvencyOracle.config && typeof (config.silo0.solvencyOracle.config as Record<string, unknown>).baseDiscountPerYear !== 'undefined'
            ? {
                onChain: BigInt(String((config.silo0.solvencyOracle.config as Record<string, unknown>).baseDiscountPerYear)),
                wizard: wizardData.verificationFromWizard && wizardData.oracleConfiguration?.token0?.ptLinearOracle?.maxYieldPercent != null
                  ? displayNumberToBigint(Number(wizardData.oracleConfiguration.token0.ptLinearOracle.maxYieldPercent))
                  : null
              }
            : undefined,
          silo1: (config.silo1.solvencyOracle.type === 'PT-Linear' || config.silo1.solvencyOracle.type === 'PTLinear') && config.silo1.solvencyOracle.config && typeof (config.silo1.solvencyOracle.config as Record<string, unknown>).baseDiscountPerYear !== 'undefined'
            ? {
                onChain: BigInt(String((config.silo1.solvencyOracle.config as Record<string, unknown>).baseDiscountPerYear)),
                wizard: wizardData.verificationFromWizard && wizardData.oracleConfiguration?.token1?.ptLinearOracle?.maxYieldPercent != null
                  ? displayNumberToBigint(Number(wizardData.oracleConfiguration.token1.ptLinearOracle.maxYieldPercent))
                  : null
              }
            : undefined
        }
        return (
          <>
            <MarketConfigTree 
              config={config} 
              explorerUrl={explorerUrl}
              chainId={chainId}
              currentSiloFactoryAddress={siloFactory?.address}
              wizardDaoFee={wizardData.feesConfiguration?.daoFee ?? null}
              wizardDeployerFee={wizardData.feesConfiguration?.deployerFee ?? null}
              siloVerification={siloVerification}
              hookOwnerVerification={hookOwnerVerification}
              irmOwnerVerification={irmOwnerVerification}
              tokenVerification={tokenVerification}
              numericValueVerification={numericValueVerification}
              addressInJsonVerification={addressInJsonVerification}
              addressVersions={addressVersions}
              ptOracleBaseDiscountVerification={ptOracleBaseDiscountVerification}
              callBeforeQuoteVerification={wizardData.verificationFromWizard 
                ? { 
                    silo0: { wizard: null }, // TODO: Add callBeforeQuote to wizardData if needed
                    silo1: { wizard: null } 
                  }
                : undefined
              }
            />
          </>
        )
      })()}

      <div className="flex justify-between mt-8">
        {wizardData.verificationFromWizard ? (
          <button
            type="button"
            onClick={goToDeployment}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <span>Back to Deployment</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={goToNewMarket}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <span>Deploy New Market</span>
          </button>
        )}
      </div>
    </div>
  )
}
