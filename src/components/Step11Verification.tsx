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
import { getCachedVersion, setCachedVersion } from '@/utils/versionCache'
import siloLensArtifact from '@/abis/silo/ISiloLens.json'
import siloFactoryArtifact from '@/abis/silo/ISiloFactory.json'

const siloLensAbi = (siloLensArtifact as { abi: ethers.InterfaceAbi }).abi
const siloFactoryAbi = (siloFactoryArtifact as { abi: ethers.InterfaceAbi }).abi

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
  const [siloVerification, setSiloVerification] = useState<{ silo0: boolean | null; silo1: boolean | null; error: string | null }>({
    silo0: null,
    silo1: null,
    error: null
  })
  const [implementationFromEvent, setImplementationFromEvent] = useState<string | null>(null)
  const [implementationFromRepo, setImplementationFromRepo] = useState<{ address: string; version: string; description?: string } | null>(null)
  const [implementationVerified, setImplementationVerified] = useState<boolean | null>(null)

  const chainId = wizardData.networkInfo?.chainId
  const explorerMap: { [key: number]: string } = {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    42161: 'https://arbiscan.io',
    43114: 'https://snowtrace.io',
    146: 'https://sonicscan.org'
  }
  const explorerUrl = chainId ? (explorerMap[parseInt(chainId, 10)] || 'https://etherscan.io') : 'https://etherscan.io'

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

  // Fetch Silo Factory address and version
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
            setSiloFactory({ address, version: '' })
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
          }
        }
      } catch (err) {
        console.warn('Failed to fetch SiloLens:', err)
      }
    }

    fetchSiloFactory()
  }, [chainId, config])

  // Fetch Silo Implementation addresses from repository (_siloImplementations.json)
  useEffect(() => {
    if (!chainId || !implementationFromEvent) return

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
            setImplementationFromRepo({ 
              address: matchingImpl.implementation, 
              version: '',
              description: matchingImpl.description
            })
            setImplementationVerified(true)
          } else {
            // If not found in repo, still show the event address but mark as not verified
            setImplementationFromRepo({ 
              address: implementationFromEvent, 
              version: '',
              description: undefined
            })
            setImplementationVerified(false)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Silo Implementation:', err)
        setImplementationVerified(false)
      }
    }

    fetchImplementation()
  }, [chainId, implementationFromEvent])

  // Fetch Silo Implementation version via Silo Lens (only if verified)
  useEffect(() => {
    if (!implementationFromRepo?.address || !siloLensAddress || !chainId || implementationVerified !== true) return
    if (typeof window === 'undefined' || !window.ethereum) return

    const fetchImplementationVersion = async () => {
      const implAddress = implementationFromRepo.address
      const cached = getCachedVersion(chainId, implAddress)
      if (cached != null) {
        setImplementationFromRepo(prev => prev ? { ...prev, version: cached } : null)
        return
      }

      try {
        const ethereum = window.ethereum
        if (!ethereum) return
        const provider = new ethers.BrowserProvider(ethereum)
        const lensContract = new ethers.Contract(siloLensAddress, siloLensAbi, provider)
        const version = String(await lensContract.getVersion(implAddress))
        setCachedVersion(chainId, implAddress, version)
        setImplementationFromRepo(prev => prev ? { ...prev, version } : null)
      } catch (err) {
        console.warn('Failed to fetch Silo Implementation version:', err)
        const fallback = '—'
        setCachedVersion(chainId, implAddress, fallback)
        setImplementationFromRepo(prev => prev ? { ...prev, version: fallback } : null)
      }
    }

    fetchImplementationVersion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [implementationFromRepo?.address, siloLensAddress, chainId, implementationVerified])

  // Fetch Silo Factory version via Silo Lens
  useEffect(() => {
    if (!siloFactory?.address || !siloLensAddress || !chainId) return
    if (typeof window === 'undefined' || !window.ethereum) return

    const fetchFactoryVersion = async () => {
      const factoryAddress = siloFactory.address
      const cached = getCachedVersion(chainId, factoryAddress)
      if (cached != null) {
        setSiloFactory(prev => prev ? { ...prev, version: cached } : null)
        return
      }

      try {
        const ethereum = window.ethereum
        if (!ethereum) return
        const provider = new ethers.BrowserProvider(ethereum)
        const lensContract = new ethers.Contract(siloLensAddress, siloLensAbi, provider)
        const version = String(await lensContract.getVersion(factoryAddress))
        setCachedVersion(chainId, factoryAddress, version)
        setSiloFactory(prev => prev ? { ...prev, version } : null)
      } catch (err) {
        console.warn('Failed to fetch Silo Factory version:', err)
        const fallback = '—'
        setCachedVersion(chainId, factoryAddress, fallback)
        setSiloFactory(prev => prev ? { ...prev, version: fallback } : null)
      }
    }

    fetchFactoryVersion()
    // Intentionally narrow deps: only re-fetch when factory address or chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siloFactory?.address, siloLensAddress, chainId])

  // Verify silo addresses using Silo Factory isSilo method
  useEffect(() => {
    if (!siloFactory?.address || !config || typeof window === 'undefined' || !window.ethereum) return

    const verifySilos = async () => {
      try {
        const ethereum = window.ethereum
        if (!ethereum) return
        const provider = new ethers.BrowserProvider(ethereum)
        const factoryContract = new ethers.Contract(siloFactory.address, siloFactoryAbi, provider)
        
        const [isSilo0, isSilo1] = await Promise.all([
          factoryContract.isSilo(config.silo0.silo),
          factoryContract.isSilo(config.silo1.silo)
        ])

        setSiloVerification({
          silo0: Boolean(isSilo0),
          silo1: Boolean(isSilo1),
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch market configuration')
      setShowForm(true)
    } finally {
      setLoading(false)
    }
  }, [])

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
  const goToNewMarket = () => router.push('/wizard?step=0')

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
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
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
              className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
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
            version={siloFactory.version || '…'}
            chainId={chainId}
            isOracle={false}
          />
        </div>
      )}

      {implementationFromRepo && implementationFromEvent && (
        <div className="mb-6">
          <ContractInfo
            contractName="Silo Implementation"
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
              className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
            >
              Try again with different input
            </button>
          )}
        </div>
      )}

      {config && !loading && (
        <MarketConfigTree 
          config={config} 
          explorerUrl={explorerUrl}
          wizardDaoFee={wizardData.verificationFromWizard && wizardData.feesConfiguration?.daoFee != null ? wizardData.feesConfiguration.daoFee : null}
          siloVerification={siloVerification}
        />
      )}

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
