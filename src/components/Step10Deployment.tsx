'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Button from '@/components/Button'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import { prepareDeployArgs, generateDeployCalldata, type DeployArgs, type SiloCoreDeployments, type OracleDeployments } from '@/utils/deployArgs'
import { getChainName, getExplorerBaseUrl, getExplorerAddressUrl } from '@/utils/networks'
import CopyButton from '@/components/CopyButton'
import ContractInfo from '@/components/ContractInfo'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import { VersionStatus } from '@/components/VersionStatus'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { fetchOracleFactoryAddress } from '@/utils/oracleFactoryAvailability'
import deployerArtifact from '@/abis/silo/ISiloDeployer.json'
import customErrorsSelectors from '@/data/customErrorsSelectors.json'

/** Foundry artifact: ABI under "abi" key – use as-is, never modify */
type FoundryArtifact = { abi: ethers.InterfaceAbi }
const deployerAbi = (deployerArtifact as FoundryArtifact).abi
const deployerInterface = new ethers.Interface(deployerAbi as ethers.InterfaceAbi)

/**
 * Format contract/RPC errors for display. Uses ethers v6 isError, CallExceptionError.revert/data,
 * and Interface.parseError() so custom Solidity errors show name or selector only.
 */
function formatContractError(err: unknown, contractInterface: ethers.Interface): string {
  if (ethers.isError(err, 'ACTION_REJECTED')) {
    return 'Transaction rejected in wallet.'
  }
  if (ethers.isError(err, 'CALL_EXCEPTION')) {
    const ex = err as ethers.CallExceptionError
    const action =
      ex.action === 'estimateGas'
        ? ' (estimateGas validation)'
        : ex.action === 'sendTransaction'
          ? ' (sendTransaction)'
          : ''
    if (ex.revert) {
      const argsStr =
        ex.revert.args && ex.revert.args.length > 0
          ? '\nArguments: ' + JSON.stringify(ex.revert.args, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
          : ''
      return `Revert${action}: ${ex.revert.signature}${argsStr}`
    }
    if (ex.data && typeof ex.data === 'string' && ex.data.startsWith('0x') && ex.data.length >= 10) {
      try {
        const parsed = contractInterface.parseError(ex.data)
        if (parsed) {
          return parsed.signature
        }
      } catch {
        // parseError can throw on malformed data
      }
      const selectorHex = ex.data.slice(0, 10)
      const knownSignature = (customErrorsSelectors as { bySelector: Record<string, string> }).bySelector[selectorHex]
      if (knownSignature) {
        return knownSignature
      }
      return selectorHex
    }
    if (ex.reason) return `Revert${action}: ${ex.reason}`
    if (ex.shortMessage) return ex.shortMessage
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export default function Step10Deployment() {
  const router = useRouter()
  const { wizardData, markStepCompleted, setLastDeployTxHash } = useWizard()
  
  const [deployerAddress, setDeployerAddress] = useState<string>('')
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [deployerVersion, setDeployerVersion] = useState<string>('')
  const [siloImplementationAddress, setSiloImplementationAddress] = useState<string | null>(null)
  const [siloImplementationVersion, setSiloImplementationVersion] = useState<string>('')
  const [siloCoreDeployments, setSiloCoreDeployments] = useState<SiloCoreDeployments>({})
  const [oracleDeployments, setOracleDeployments] = useState<OracleDeployments>({})
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState('')
  const [txErrorDebug, setTxErrorDebug] = useState<{ to: string; data: string } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [txHash, setTxHash] = useState<string>('')
  const [deployArgs, setDeployArgs] = useState<DeployArgs | null>(null)

  // Hash of current deploy arguments; used to allow re-deploy when config changes after a previous deploy
  const currentArgsHash = useMemo(() => {
    if (!deployArgs || !deployerAddress) return null
    try {
      const calldata = generateDeployCalldata(deployerAddress, deployArgs)
      return ethers.keccak256(calldata as `0x${string}`)
    } catch {
      return null
    }
  }, [deployArgs, deployerAddress])

  const configUnchangedAfterDeploy =
    !!txHash &&
    !!wizardData.lastDeployArgsHash &&
    !!currentArgsHash &&
    currentArgsHash === wizardData.lastDeployArgsHash

  // Chain ID to chain name mapping - using centralized network config
  // getChainName is imported from @/utils/networks



  // Restore txHash from context when returning to step 10 after a deploy (e.g. after refresh)
  useEffect(() => {
    if (wizardData.lastDeployTxHash && !txHash) {
      setTxHash(wizardData.lastDeployTxHash)
    }
  }, [wizardData.lastDeployTxHash, txHash])

  // Fetch SiloDeployer address and SiloCore deployments
  useEffect(() => {
    const fetchDeploymentData = async () => {
      if (!wizardData.networkInfo?.chainId) {
        // Step can mount before network info is hydrated; skip without noisy console errors.
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError('')
        setTxErrorDebug(null)
        // Don't clear warnings here - they should persist

        // Clear stale "Chain ID missing" warning from an earlier run (e.g. before wallet returned chainId)
        setWarnings(prev => prev.filter(w => !w.includes('Chain ID is missing') && !w.includes('deployment data')))

        const chainName = getChainName(wizardData.networkInfo.chainId)
        
        // Fetch SiloDeployer address
        // Contract names match SiloCoreContracts constants (the actual .sol file names)
        // Same pattern as other contracts: SiloDeployer.sol.json
        const deployerContractName = 'SiloDeployer.sol'
        let address = ''
        
        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${deployerContractName}.json`
          )
          if (response.ok) {
            const data = await response.json()
            address = data.address || ''
          }
        } catch (err) {
          console.warn(`Failed to fetch ${deployerContractName}.json:`, err)
        }

        if (!address) {
          // Don't throw - just set warning and continue
          setWarnings(prev => [...prev.filter(w => !w.includes('SiloDeployer address')), `Failed to fetch SiloDeployer address for ${chainName}. Arguments will still be displayed.`])
        } else {
          setDeployerAddress(address)
          // Don't clear error here - there might be other warnings
        }

        // Fetch Silo Lens address
        const lensContractName = 'SiloLens.sol'
        let lensAddress = ''
        
        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${lensContractName}.json`
          )
          if (response.ok) {
            const data = await response.json()
            lensAddress = data.address || ''
            if (lensAddress && ethers.isAddress(lensAddress)) {
              setSiloLensAddress(lensAddress)
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ${lensContractName}.json:`, err)
        }

      } catch (err) {
        console.error('Error fetching deployment data:', err)
        const message = err instanceof Error ? err.message : 'Failed to load some deployment data.'
        const suffix = ' Arguments (e.g. init data) will still be displayed; you may need to enter SiloDeployer/SiloLens addresses manually if deployment fails.'
        const fullWarning = `${message} ${suffix}`
        setWarnings(prev => {
          const withoutNetwork = prev.filter(w => !w.includes('deployment data') && !w.includes('Chain ID is missing'))
          if (withoutNetwork.some(w => w === fullWarning)) return withoutNetwork
          return [...withoutNetwork, fullWarning]
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDeploymentData()
  }, [wizardData.networkInfo?.chainId])

  // Fetch SiloCore deployments
  useEffect(() => {
    const fetchSiloCoreDeployments = async () => {
      if (!wizardData.networkInfo?.chainId) return

      const chainName = getChainName(wizardData.networkInfo.chainId)

      // Fetch individual contract addresses from per-contract JSON files
      // Contract names match SiloCoreContracts constants (the actual .sol file names)
      const contractsToFetch = [
        'SiloHookV1.sol',
        'SiloHookV2.sol',
        'SiloHookV3.sol',
        'DynamicKinkModelFactory.sol'
      ]

      const deployments: SiloCoreDeployments = {}
      for (const contractName of contractsToFetch) {
        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${contractName}.json`
          )
          if (response.ok) {
            const data = await response.json()
            const address = data.address || ''
            if (address) {
              deployments[contractName] = address
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ${contractName}:`, err)
        }
      }
      if (Object.keys(deployments).length > 0) {
        setSiloCoreDeployments(deployments)
      }
    }

    const fetchOracleDeployments = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const result: OracleDeployments = {}
      const chainId = wizardData.networkInfo.chainId
      const selectedTypes = new Set([
        wizardData.oracleConfiguration?.token0.type,
        wizardData.oracleConfiguration?.token1.type
      ])
      try {
        if (selectedTypes.has('chainlink')) {
          const address = await fetchOracleFactoryAddress(chainId, 'chainlink')
          if (address) result.chainlinkV3OracleFactory = address
        }
        if (selectedTypes.has('ptLinear')) {
          const address = await fetchOracleFactoryAddress(chainId, 'ptLinear')
          if (address) result.ptLinearOracleFactory = address
        }
        if (selectedTypes.has('vault')) {
          const address = await fetchOracleFactoryAddress(chainId, 'vault')
          if (address) result.erc4626OracleFactory = address
        }
        if (selectedTypes.has('customMethod')) {
          const address = await fetchOracleFactoryAddress(chainId, 'customMethod')
          if (address) result.customMethodOracleFactory = address
        }
        if (selectedTypes.has('supraSValue')) {
          const address = await fetchOracleFactoryAddress(chainId, 'supraSValue')
          if (address) result.supraSValueOracleFactory = address
        }
      } catch (err) {
        console.warn('Failed to fetch selected oracle factory deployments:', err)
      }
      try {
        const chainName = getChainName(chainId)
        const manageableRes = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/ManageableOracleFactory.sol.json`
        )
        if (manageableRes.ok) {
          const data = await manageableRes.json()
          const address = data.address || ''
          if (address && ethers.isAddress(address)) result.manageableOracleFactory = address
        }
      } catch (err) {
        console.warn('Failed to fetch ManageableOracleFactory:', err)
      }
      setOracleDeployments(result)
    }

    if (wizardData.networkInfo?.chainId) {
      fetchSiloCoreDeployments()
      fetchOracleDeployments()
    }
  }, [wizardData.networkInfo?.chainId, wizardData.oracleConfiguration?.token0.type, wizardData.oracleConfiguration?.token1.type])

  // Fetch SiloDeployer version using Silo Lens (cached per chainId+address)
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!deployerAddress || !siloLensAddress || !chainId) return
    const fetchDeployerVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses: [deployerAddress]
        })
        const version = versionsByAddress.get(deployerAddress.toLowerCase()) ?? ''
        setDeployerVersion(version)
      } catch (err) {
        console.warn('Failed to fetch SiloDeployer version:', err)
        setDeployerVersion('—')
      }
    }
    fetchDeployerVersion()
  }, [deployerAddress, siloLensAddress, wizardData.networkInfo?.chainId])

  // Fetch SILO_IMPL from SiloDeployer contract (SiloDeployer has public immutable SILO_IMPL)
  useEffect(() => {
    if (!deployerAddress || !window.ethereum) return

    const siloImplAbi = ['function SILO_IMPL() view returns (address)']

    const fetchSiloImpl = async () => {
      const eth = window.ethereum
      if (!eth) return
      try {
        const provider = new ethers.BrowserProvider(eth)
        const contract = new ethers.Contract(deployerAddress, siloImplAbi, provider)
        const impl = await contract.SILO_IMPL()
        if (impl && ethers.isAddress(impl)) {
          setSiloImplementationAddress(ethers.getAddress(impl))
        } else {
          setSiloImplementationAddress(null)
        }
      } catch (err) {
        console.warn('Failed to fetch SILO_IMPL from SiloDeployer:', err)
        setSiloImplementationAddress(null)
      }
    }
    fetchSiloImpl()
  }, [deployerAddress])

  // Fetch Silo Implementation version via Silo Lens
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!siloLensAddress || !chainId || !siloImplementationAddress) return

    const fetchImplVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses: [siloImplementationAddress]
        })
        const version = versionsByAddress.get(siloImplementationAddress.toLowerCase()) ?? ''
        setSiloImplementationVersion(version || '—')
      } catch (err) {
        console.warn('Failed to fetch Silo Implementation version:', err)
        setSiloImplementationVersion('—')
      }
    }
    fetchImplVersion()
  }, [siloImplementationAddress, siloLensAddress, wizardData.networkInfo?.chainId])

  // Prepare deploy arguments from JSON config (matching Solidity script logic)
  // Always prepare arguments even if deployer address is not available
  useEffect(() => {
    if (!wizardData.token0 || !wizardData.token1) return

    try {
      // Use the extracted utility function
      const args = prepareDeployArgs(wizardData, siloCoreDeployments, oracleDeployments)
      setDeployArgs(args)

      // Validate critical addresses and set warnings (but don't prevent argument preparation)
      const hookImplementationName = wizardData.selectedHook 
        ? `${wizardData.selectedHook}.sol` 
        : 'SiloHookV1.sol'
      const hookReceiverImplementation = siloCoreDeployments[hookImplementationName] || ethers.ZeroAddress
      const irmFactoryName = 'DynamicKinkModelFactory.sol'
      const irmFactoryAddress = siloCoreDeployments[irmFactoryName] || ethers.ZeroAddress

      let validationWarnings: string[] = []
      if (hookReceiverImplementation === ethers.ZeroAddress) {
        validationWarnings.push(`Hook implementation address not found for ${hookImplementationName}. Deployment may fail.`)
      }

      if (irmFactoryAddress === ethers.ZeroAddress) {
        validationWarnings.push(`${irmFactoryName} address not found. Deployment may fail.`)
      }

      // Validate hook owner address is set
      if (!wizardData.hookOwnerAddress || !ethers.isAddress(wizardData.hookOwnerAddress)) {
        validationWarnings.push('Hook owner address is not set. Please complete Step 8 (Hook Owner Selection) first.')
      }

      // Validate Oracle & IRM owner when manageable Oracle or Kink IRM is used
      const needsOracleIrmOwner = wizardData.manageableOracle || true
      if (needsOracleIrmOwner && (!wizardData.manageableOracleOwnerAddress || !ethers.isAddress(wizardData.manageableOracleOwnerAddress))) {
        validationWarnings.push('Oracle & IRM owner is not set. Please complete Step 4 and enter the owner address.')
      }

      // Update warnings list - replace validation warnings but keep others
      setWarnings(prevWarnings => {
        // Keep warnings from other sources (like fetchDeploymentData) that are not validation warnings
        const otherWarnings = prevWarnings.filter(w => 
          !w.includes('Hook implementation address') &&
          !w.includes('address not found') &&
          !w.includes('Hook owner address') &&
          !w.includes('Oracle & IRM owner') &&
          !w.includes('SiloDeployer address') &&
          !w.includes('deployment data')
        )
        // Combine with new validation warnings
        const newWarnings = [...otherWarnings, ...validationWarnings]
        // Only update if there are actually warnings to show
        return newWarnings
      })
    } catch (error) {
      console.error('Error preparing deploy args:', error)
      setDeployArgs(null)
      setTxErrorDebug(null)
      setError(error instanceof Error ? error.message : 'Failed to prepare deployment arguments')
    }
  }, [wizardData, siloCoreDeployments, oracleDeployments])

  const handleDeploy = async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.')
      return
    }

    if (!deployerAddress) {
      setError('SiloDeployer address not loaded')
      return
    }

    if (!deployArgs) {
      setError('Deployment arguments not ready')
      return
    }

    // Validate all required data before attempting deployment
    const validationErrors: string[] = []
    
    if (!wizardData.hookOwnerAddress || !ethers.isAddress(wizardData.hookOwnerAddress)) {
      validationErrors.push('Hook owner address is not set. Please complete Step 8 (Hook Owner Selection) first.')
    }

    const needsOracleIrmOwner = wizardData.manageableOracle || true
    if (needsOracleIrmOwner && (!wizardData.manageableOracleOwnerAddress || !ethers.isAddress(wizardData.manageableOracleOwnerAddress))) {
      validationErrors.push('Oracle & IRM owner is not set. Please complete Step 4 and enter the owner address.')
    }
    
    if (deployArgs._clonableHookReceiver.implementation === ethers.ZeroAddress) {
      validationErrors.push('Hook implementation address is missing. Please ensure the hook is properly configured.')
    }
    
    if (deployArgs._siloInitData.interestRateModel0 === ethers.ZeroAddress) {
      validationErrors.push('Interest Rate Model 0 address is missing. Please ensure IRM is properly configured.')
    }
    
    if (deployArgs._siloInitData.interestRateModel1 === ethers.ZeroAddress) {
      validationErrors.push('Interest Rate Model 1 address is missing. Please ensure IRM is properly configured.')
    }
    
    if (!deployArgs._irmConfigData0.encoded || deployArgs._irmConfigData0.encoded === '0x') {
      validationErrors.push('IRM Config Data 0 is empty. Please ensure IRM configuration is properly set.')
    }
    
    if (!deployArgs._irmConfigData1.encoded || deployArgs._irmConfigData1.encoded === '0x') {
      validationErrors.push('IRM Config Data 1 is empty. Please ensure IRM configuration is properly set.')
    }
    
    if (!deployArgs._clonableHookReceiver.initializationData || deployArgs._clonableHookReceiver.initializationData === '0x') {
      validationErrors.push('Hook initialization data is empty. Please ensure hook owner is properly set.')
    }
    
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '))
      return
    }

    setDeploying(true)
    setError('')
    setTxErrorDebug(null)
    setTxHash('')

    // For debugging deployment issues (eg. FailedToCreateAnOracle)
    let debugCalldata: string | null = null

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Ensure initialization data is properly encoded
      let hookReceiverInitializationData = deployArgs._clonableHookReceiver.initializationData
      if (!hookReceiverInitializationData || hookReceiverInitializationData === '0x') {
        // Re-encode if needed
        if (wizardData.hookOwnerAddress && ethers.isAddress(wizardData.hookOwnerAddress)) {
          const normalizedAddress = ethers.getAddress(wizardData.hookOwnerAddress)
          hookReceiverInitializationData = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [normalizedAddress])
        } else {
          throw new Error('Hook owner address is not set or invalid')
        }
      }
      
      // Use clonableHookReceiver from deployArgs - exact structure matching contract
      const clonableHookReceiver = {
        implementation: deployArgs._clonableHookReceiver.implementation,
        initializationData: hookReceiverInitializationData
      }
      
      // Validate all addresses are valid before sending
      if (!ethers.isAddress(clonableHookReceiver.implementation) || clonableHookReceiver.implementation === ethers.ZeroAddress) {
        throw new Error('Hook implementation address is invalid')
      }
      
      if (!ethers.isAddress(deployArgs._siloInitData.token0) || deployArgs._siloInitData.token0 === ethers.ZeroAddress) {
        throw new Error('Token0 address is invalid')
      }
      
      if (!ethers.isAddress(deployArgs._siloInitData.token1) || deployArgs._siloInitData.token1 === ethers.ZeroAddress) {
        throw new Error('Token1 address is invalid')
      }
      
      if (!ethers.isAddress(deployArgs._siloInitData.interestRateModel0) || deployArgs._siloInitData.interestRateModel0 === ethers.ZeroAddress) {
        throw new Error('Interest Rate Model 0 address is invalid')
      }
      
      if (!ethers.isAddress(deployArgs._siloInitData.interestRateModel1) || deployArgs._siloInitData.interestRateModel1 === ethers.ZeroAddress) {
        throw new Error('Interest Rate Model 1 address is invalid')
      }

      const deployerContract = new ethers.Contract(deployerAddress, deployerAbi, signer)

      // Prepare exact transaction arguments - ensure no extra fields
      // These must match exactly what's shown in JSON
      const txOracles = deployArgs._oracles
      const txIrmConfigData0 = deployArgs._irmConfigData0.encoded
      const txIrmConfigData1 = deployArgs._irmConfigData1.encoded
      const txClonableHookReceiver = clonableHookReceiver
      const txSiloInitData = deployArgs._siloInitData

      // Precompute full calldata for debugging purposes
      try {
        debugCalldata = generateDeployCalldata(deployerAddress, deployArgs)
      } catch (encodeErr) {
        console.warn('Failed to generate debug calldata for deploy():', encodeErr)
      }

      // Validate with estimateGas first so we get a clear revert reason without sending tx
      try {
        await deployerContract.deploy.estimateGas(
          txOracles,
          txIrmConfigData0,
          txIrmConfigData1,
          txClonableHookReceiver,
          txSiloInitData
        )
      } catch (estimateErr: unknown) {
        const msg = formatContractError(estimateErr, deployerInterface)
        // Helpful debug info for on-chain reverts
        console.error('Silo deploy estimateGas failed', {
          to: deployerAddress,
          data: debugCalldata,
          error: estimateErr
        })
        setTxErrorDebug({ to: deployerAddress ?? '', data: debugCalldata ?? '0x' })
        setError('Transaction validation failed:\n' + msg)
        setDeploying(false)
        return
      }

      // Execute deploy transaction - use exact arguments matching contract interface
      const tx = await deployerContract.deploy(
        txOracles,
        txIrmConfigData0,
        txIrmConfigData1,
        txClonableHookReceiver,
        txSiloInitData
      )

      setTxHash(tx.hash)

      // Wait for transaction confirmation
      await tx.wait()

      markStepCompleted(12)
      const argsHash =
        deployArgs && deployerAddress
          ? ethers.keccak256(generateDeployCalldata(deployerAddress, deployArgs) as `0x${string}`)
          : null
      setLastDeployTxHash(tx.hash, argsHash)
      setError('')
      setTxErrorDebug(null)
    } catch (err: unknown) {
      console.error('Deployment error:', err)
      if (debugCalldata) {
        console.error('Silo deploy debug data', {
          to: deployerAddress,
          data: debugCalldata
        })
      }
      setTxErrorDebug({ to: deployerAddress ?? '', data: debugCalldata ?? '0x' })
      const errorMessage = formatContractError(err, deployerInterface)
      setError(errorMessage)
      setTxHash('')
    } finally {
      setDeploying(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=11')
  }

  const getBlockExplorerUrl = (hash: string, isAddress: boolean = false) => {
    if (!wizardData.networkInfo?.chainId) return '#'
    const chainId = wizardData.networkInfo.chainId
    const baseUrl = getExplorerBaseUrl(chainId)
    const path = isAddress ? 'address' : 'tx'
    return `${baseUrl}/${path}/${hash}`
  }

  // Don't block rendering - show arguments even while loading

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 12: Market Deployment
        </h1>
        <p className="text-gray-300 text-lg">
          Review deployment arguments and deploy your market
        </p>
      </div>

      {/* Network Information */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
        <p className="text-sm font-medium text-gray-300 mb-4">
          Current Network: <span className="text-white">{wizardData.networkInfo?.networkName || 'Unknown'}</span> <span className="text-gray-400">({wizardData.networkInfo?.chainId || '—'})</span>
        </p>
        {loading && (
          <div className="mb-4 flex items-center space-x-2 text-lime-500">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">Loading deployment data...</span>
          </div>
        )}
        {loading ? (
          <p className="text-white font-mono text-sm">Loading...</p>
        ) : deployerAddress ? (
          <>
            <ContractInfo
              contractName="Silo Deployer"
              address={deployerAddress}
              version={deployerVersion || '…'}
              chainId={wizardData.networkInfo?.chainId}
              isOracle={false}
              renderVersion={<VersionStatus version={deployerVersion || null} />}
            />
            {siloImplementationAddress && (
              <div className="mt-4 bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">Silo Implementation</p>
                  <span className="text-xs text-gray-400">
                    Source (SiloDeployer): {' '}
                    <a
                      href={getExplorerAddressUrl(wizardData.networkInfo?.chainId ?? 1, deployerAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-300 underline"
                    >
                      source
                    </a>
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <AddressDisplayLong
                      address={siloImplementationAddress}
                      chainId={wizardData.networkInfo?.chainId}
                    />
                  </div>
                  <div className="text-sm text-gray-300 whitespace-nowrap">
                    version: <VersionStatus version={siloImplementationVersion || null} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-white font-mono text-sm">Not available</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mb-6">
        <Button variant="secondary" size="lg" onClick={goToPreviousStep}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          JSON Config
        </Button>
        {!configUnchangedAfterDeploy && (
          <Button
            onClick={handleDeploy}
            disabled={
              deploying ||
              !deployerAddress ||
              !deployArgs ||
              !wizardData.hookOwnerAddress ||
              !ethers.isAddress(wizardData.hookOwnerAddress) ||
              ((wizardData.manageableOracle || true) && (!wizardData.manageableOracleOwnerAddress || !ethers.isAddress(wizardData.manageableOracleOwnerAddress))) ||
              (deployArgs && (
                deployArgs._clonableHookReceiver.implementation === ethers.ZeroAddress ||
                deployArgs._siloInitData.interestRateModel0 === ethers.ZeroAddress ||
                deployArgs._siloInitData.interestRateModel1 === ethers.ZeroAddress
              ))
            }
            variant="primary"
            size="lg"
          >
            {deploying ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Deploying...</span>
              </>
            ) : (
              <>
                <span>Execute Transaction</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Warnings and Errors */}
      {warnings.length > 0 && (
        <div className="silo-alert silo-alert-warning mb-6">
          <div className="text-sm font-semibold mb-2">
            ⚠ Warnings:
          </div>
          <ol className="list-decimal list-inside space-y-1 text-sm ml-4">
            {warnings.map((warning, index) => (
              <li key={index} className="mb-1">{warning}</li>
            ))}
          </ol>
        </div>
      )}

      {error && (
        <>
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <div className="text-red-400 text-sm">
              ✗ {error}
            </div>
          </div>
          {txErrorDebug && (
            <div className="bg-amber-100 border border-amber-600 rounded-lg p-4 mb-6 text-amber-950">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">Provide this to developer for debugging purposes</span>
                <CopyButton
                  value={JSON.stringify({ to: txErrorDebug.to, data: txErrorDebug.data })}
                  iconClassName="w-3.5 h-3.5"
                  title="Copy to + data as JSON"
                  className="ml-0"
                />
              </div>
              <ul className="list-disc list-inside text-sm space-y-1 font-mono break-all">
                <li><span className="font-medium">to:</span> {txErrorDebug.to || '—'}</li>
                <li><span className="font-medium">data:</span> {txErrorDebug.data || '0x'}</li>
              </ul>
            </div>
          )}
        </>
      )}

      {configUnchangedAfterDeploy && txHash && (
        <div className="bg-[#f6fbf2] border border-lime-300 rounded-lg p-4 mb-6">
          <div className="text-emerald-800 text-sm font-semibold mb-2">
            ✓ Transaction submitted successfully!
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <a
              href={getBlockExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:text-emerald-900 text-sm underline"
            >
              View on block explorer: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
            <CopyButton value={txHash} iconClassName="w-3.5 h-3.5" title="Copy transaction hash" className="ml-0" />
          </div>
          <Button
            variant="primaryDark"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams()
              params.set('step', 'verification')
              params.set('tx', txHash)
              if (wizardData.networkInfo?.chainId) {
                params.set('chain', wizardData.networkInfo.chainId)
              }
              router.push(`/wizard?${params.toString()}`)
            }}
          >
            Go to verification
          </Button>
        </div>
      )}

      {/* Deploy Arguments as JSON */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Deploy Arguments</h3>
        <p className="text-sm text-gray-400 mb-4">
          Arguments for <span className="font-mono">deploy(Oracles calldata _oracles, bytes calldata _irmConfigData0, bytes calldata _irmConfigData1, ClonableHookReceiver calldata _clonableHookReceiver, ISiloConfig.InitData memory _siloInitData)</span>
        </p>
        {deployArgs ? (
          <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
              <code>{JSON.stringify(deployArgs, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}</code>
            </pre>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">
              {!wizardData.token0 || !wizardData.token1 
                ? 'Please complete previous steps to generate deployment arguments.'
                : 'Preparing deployment arguments...'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
