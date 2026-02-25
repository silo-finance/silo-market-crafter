'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'
import { prepareDeployArgs, generateDeployCalldata, type DeployArgs, type SiloCoreDeployments, type OracleDeployments } from '@/utils/deployArgs'
import { getChainName, getExplorerBaseUrl } from '@/utils/networks'
import CopyButton from '@/components/CopyButton'
import ContractInfo from '@/components/ContractInfo'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
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
  const [siloCoreDeployments, setSiloCoreDeployments] = useState<SiloCoreDeployments>({})
  const [oracleDeployments, setOracleDeployments] = useState<OracleDeployments>({})
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState('')
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
      try {
        setLoading(true)
        setError('')
        // Don't clear warnings here - they should persist
        
        if (!wizardData.networkInfo?.chainId) {
          throw new Error(
            'Chain ID is missing — deployment addresses for SiloDeployer and SiloLens could not be loaded. ' +
            'Connect a wallet and ensure a network is selected in Step 1 (e.g. Ethereum, Polygon, Arbitrum).'
          )
        }

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
            if (address && ethers.isAddress(address)) {
              console.log(`Loaded SiloDeployer from ${deployerContractName}.json:`, address)
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ${deployerContractName}.json:`, err)
        }
        
        // Fallback: try to get from _deployments.json if available
        if (!address) {
          try {
            const response = await fetch(
              `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/_deployments.json`
            )
            if (response.ok) {
              const data = await response.json()
              // Try different possible keys in _deployments.json
              if (typeof data === 'object' && data !== null) {
                address = data[deployerContractName] || data['SiloDeployer'] || data.SiloDeployer || ''
                // If nested structure, try to extract
                if (!address || !ethers.isAddress(address)) {
                  for (const key in data) {
                    if (key.includes('SiloDeployer') && typeof data[key] === 'string' && ethers.isAddress(data[key])) {
                      address = data[key]
                      break
                    } else if (typeof data[key] === 'object' && data[key]?.address && ethers.isAddress(data[key].address)) {
                      address = data[key].address
                      break
                    }
                  }
                }
                if (address && ethers.isAddress(address)) {
                  console.log(`Loaded SiloDeployer from _deployments.json:`, address)
                }
              }
            }
          } catch (err) {
            console.warn('Failed to fetch from _deployments.json:', err)
          }
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
              console.log(`Loaded SiloLens from ${lensContractName}.json:`, lensAddress)
              setSiloLensAddress(lensAddress)
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ${lensContractName}.json:`, err)
        }
        
        // Fallback: try to get from _deployments.json if available
        if (!lensAddress) {
          try {
            const response = await fetch(
              `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/_deployments.json`
            )
            if (response.ok) {
              const data = await response.json()
              if (typeof data === 'object' && data !== null) {
                lensAddress = data[lensContractName] || data['SiloLens'] || data.SiloLens || ''
                if (!lensAddress || !ethers.isAddress(lensAddress)) {
                  for (const key in data) {
                    if (key.includes('SiloLens') && typeof data[key] === 'string' && ethers.isAddress(data[key])) {
                      lensAddress = data[key]
                      break
                    } else if (typeof data[key] === 'object' && data[key]?.address && ethers.isAddress(data[key].address)) {
                      lensAddress = data[key].address
                      break
                    }
                  }
                }
                if (lensAddress && ethers.isAddress(lensAddress)) {
                  console.log(`Loaded SiloLens from _deployments.json:`, lensAddress)
                  setSiloLensAddress(lensAddress)
                }
              }
            }
          } catch (err) {
            console.warn('Failed to fetch SiloLens from _deployments.json:', err)
          }
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
      
      // Try to fetch _deployments.json first
      // The structure might be an object with contract names as keys, or nested
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/_deployments.json`
        )
        if (response.ok) {
          const data = await response.json()
          // Handle different possible structures
          if (typeof data === 'object' && data !== null) {
            // If it's already a flat object with contract names as keys
            if (data['SiloHookV1.sol'] || data['InterestRateModelV2Factory.sol']) {
              setSiloCoreDeployments(data as SiloCoreDeployments)
              return
            }
            // If it's nested, try to extract addresses
            // Some deployments might have nested structure
            const flatDeployments: SiloCoreDeployments = {}
            for (const key in data) {
              if (typeof data[key] === 'string' && data[key].startsWith('0x')) {
                flatDeployments[key] = data[key]
              } else if (typeof data[key] === 'object' && data[key]?.address) {
                flatDeployments[key] = data[key].address
              }
            }
            if (Object.keys(flatDeployments).length > 0) {
              console.log('Loaded deployments from _deployments.json:', flatDeployments)
              setSiloCoreDeployments(flatDeployments)
              return
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch _deployments.json:', err)
      }

      // Fallback: fetch individual contract addresses
      // Contract names match SiloCoreContracts constants (the actual .sol file names)
      const contractsToFetch = [
        'SiloHookV1.sol',
        'SiloHookV2.sol', 
        'SiloHookV3.sol',
        'InterestRateModelV2Factory.sol',
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
              console.log(`Loaded ${contractName}:`, address)
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ${contractName}:`, err)
        }
      }
      if (Object.keys(deployments).length > 0) {
        console.log('Loaded individual deployments:', deployments)
        setSiloCoreDeployments(deployments)
      }
    }

    const fetchOracleDeployments = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      const result: OracleDeployments = {}
      try {
        const chainlinkRes = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/ChainlinkV3OracleFactory.sol.json`
        )
        if (chainlinkRes.ok) {
          const data = await chainlinkRes.json()
          const address = data.address || ''
          if (address && ethers.isAddress(address)) result.chainlinkV3OracleFactory = address
        }
      } catch (err) {
        console.warn('Failed to fetch ChainlinkV3OracleFactory:', err)
      }
      try {
        const ptLinearRes = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/PTLinearOracleFactory.sol.json`
        )
        if (ptLinearRes.ok) {
          const data = await ptLinearRes.json()
          const address = data.address || ''
          if (address && ethers.isAddress(address)) result.ptLinearOracleFactory = address
        }
      } catch (err) {
        console.warn('Failed to fetch PTLinearOracleFactory:', err)
      }
      try {
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
  }, [wizardData.networkInfo?.chainId])

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
        console.log(`SiloDeployer version: ${version}`)
      } catch (err) {
        console.warn('Failed to fetch SiloDeployer version:', err)
        setDeployerVersion('—')
      }
    }
    fetchDeployerVersion()
  }, [deployerAddress, siloLensAddress, wizardData.networkInfo?.chainId])

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
      const irmFactoryName = wizardData.irmModelType === 'kink'
        ? 'DynamicKinkModelFactory.sol'
        : 'InterestRateModelV2Factory.sol'
      const irmFactoryAddress = siloCoreDeployments[irmFactoryName] || ethers.ZeroAddress

      console.log(`Looking up hook implementation: ${hookImplementationName}`, {
        found: hookReceiverImplementation !== ethers.ZeroAddress,
        address: hookReceiverImplementation,
        availableDeployments: Object.keys(siloCoreDeployments)
      })

      console.log(`Looking up IRM factory: ${irmFactoryName}`, {
        found: irmFactoryAddress !== ethers.ZeroAddress,
        address: irmFactoryAddress
      })

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

      // Validate Manageable Oracle owner when manageable is enabled
      if (wizardData.manageableOracle && (!wizardData.manageableOracleOwnerAddress || !ethers.isAddress(wizardData.manageableOracleOwnerAddress))) {
        validationWarnings.push('Manageable Oracle owner is not set. Please complete Step 4 (Manageable Oracle) and select an owner.')
      }

      // Update warnings list - replace validation warnings but keep others
      setWarnings(prevWarnings => {
        // Keep warnings from other sources (like fetchDeploymentData) that are not validation warnings
        const otherWarnings = prevWarnings.filter(w => 
          !w.includes('Hook implementation address') &&
          !w.includes('address not found') &&
          !w.includes('Hook owner address') &&
          !w.includes('Manageable Oracle owner') &&
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

    if (wizardData.manageableOracle && (!wizardData.manageableOracleOwnerAddress || !ethers.isAddress(wizardData.manageableOracleOwnerAddress))) {
      validationErrors.push('Manageable Oracle owner is not set. Please complete Step 4 (Manageable Oracle) and select an owner.')
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
    setTxHash('')

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

      // Prepare transaction data object for detailed logging
      // This matches exactly the arguments passed to deploy() function
      const transactionData = {
        functionName: 'deploy',
        arguments: {
          _oracles: {
            solvencyOracle0: {
              deployed: txOracles.solvencyOracle0.deployed,
              factory: txOracles.solvencyOracle0.factory,
              txInput: txOracles.solvencyOracle0.txInput
            },
            maxLtvOracle0: {
              deployed: txOracles.maxLtvOracle0.deployed,
              factory: txOracles.maxLtvOracle0.factory,
              txInput: txOracles.maxLtvOracle0.txInput
            },
            solvencyOracle1: {
              deployed: txOracles.solvencyOracle1.deployed,
              factory: txOracles.solvencyOracle1.factory,
              txInput: txOracles.solvencyOracle1.txInput
            },
            maxLtvOracle1: {
              deployed: txOracles.maxLtvOracle1.deployed,
              factory: txOracles.maxLtvOracle1.factory,
              txInput: txOracles.maxLtvOracle1.txInput
            }
          },
          _irmConfigData0: txIrmConfigData0,
          _irmConfigData1: txIrmConfigData1,
          _clonableHookReceiver: {
            implementation: txClonableHookReceiver.implementation,
            initializationData: txClonableHookReceiver.initializationData
          },
          _siloInitData: {
            deployer: txSiloInitData.deployer,
            hookReceiver: txSiloInitData.hookReceiver,
            daoFee: txSiloInitData.daoFee.toString(),
            deployerFee: txSiloInitData.deployerFee.toString(),
            token0: txSiloInitData.token0,
            solvencyOracle0: txSiloInitData.solvencyOracle0,
            maxLtvOracle0: txSiloInitData.maxLtvOracle0,
            interestRateModel0: txSiloInitData.interestRateModel0,
            maxLtv0: txSiloInitData.maxLtv0.toString(),
            lt0: txSiloInitData.lt0.toString(),
            liquidationTargetLtv0: txSiloInitData.liquidationTargetLtv0.toString(),
            liquidationFee0: txSiloInitData.liquidationFee0.toString(),
            flashloanFee0: txSiloInitData.flashloanFee0.toString(),
            callBeforeQuote0: txSiloInitData.callBeforeQuote0,
            token1: txSiloInitData.token1,
            solvencyOracle1: txSiloInitData.solvencyOracle1,
            maxLtvOracle1: txSiloInitData.maxLtvOracle1,
            interestRateModel1: txSiloInitData.interestRateModel1,
            maxLtv1: txSiloInitData.maxLtv1.toString(),
            lt1: txSiloInitData.lt1.toString(),
            liquidationTargetLtv1: txSiloInitData.liquidationTargetLtv1.toString(),
            liquidationFee1: txSiloInitData.liquidationFee1.toString(),
            flashloanFee1: txSiloInitData.flashloanFee1.toString(),
            callBeforeQuote1: txSiloInitData.callBeforeQuote1
          }
        },
        deployerAddress: deployerAddress,
        contractAddress: deployerAddress
      }

      // Log transaction data as formatted JSON for easy inspection
      console.log('=== DEPLOY TRANSACTION DATA ===')
      console.log(JSON.stringify(transactionData, null, 2))
      console.log('=== END TRANSACTION DATA ===')

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

      markStepCompleted(11)
      const argsHash =
        deployArgs && deployerAddress
          ? ethers.keccak256(generateDeployCalldata(deployerAddress, deployArgs) as `0x${string}`)
          : null
      setLastDeployTxHash(tx.hash, argsHash)
      setError('')
    } catch (err: unknown) {
      console.error('Deployment error:', err)
      const errorMessage = formatContractError(err, deployerInterface)
      setError(errorMessage)
      setTxHash('')
    } finally {
      setDeploying(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=10')
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
          Step 11: Market Deployment
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
          <ContractInfo
            contractName="SiloDeployer"
            address={deployerAddress}
            version={deployerVersion || '…'}
            chainId={wizardData.networkInfo?.chainId}
            isOracle={false}
          />
        ) : (
          <p className="text-white font-mono text-sm">Not available</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mb-6">
        <button
          type="button"
          onClick={goToPreviousStep}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>JSON Config</span>
        </button>
        
        {!configUnchangedAfterDeploy && (
          <button
            onClick={handleDeploy}
            disabled={
              deploying ||
              !deployerAddress ||
              !deployArgs ||
              !wizardData.hookOwnerAddress ||
              !ethers.isAddress(wizardData.hookOwnerAddress) ||
              (wizardData.manageableOracle && (!wizardData.manageableOracleOwnerAddress || !ethers.isAddress(wizardData.manageableOracleOwnerAddress))) ||
              (deployArgs && (
                deployArgs._clonableHookReceiver.implementation === ethers.ZeroAddress ||
                deployArgs._siloInitData.interestRateModel0 === ethers.ZeroAddress ||
                deployArgs._siloInitData.interestRateModel1 === ethers.ZeroAddress
              ))
            }
            className="bg-emerald-900 hover:bg-emerald-800 disabled:bg-emerald-900 disabled:opacity-55 disabled:cursor-not-allowed text-white cta-strong-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
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
          </button>
        )}
      </div>

      {/* Warnings and Errors */}
      {warnings.length > 0 && (
        <div className="bg-yellow-900/50 border border-yellow-500 rounded-lg p-4 mb-6">
          <div className="text-yellow-400 text-sm font-semibold mb-2">
            ⚠ Warnings:
          </div>
          <ol className="list-decimal list-inside space-y-1 text-yellow-300 text-sm ml-4">
            {warnings.map((warning, index) => (
              <li key={index} className="mb-1">{warning}</li>
            ))}
          </ol>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <div className="text-red-400 text-sm">
            ✗ {error}
          </div>
        </div>
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
            <CopyButton value={txHash} iconClassName="w-3.5 h-3.5" title="Copy transaction hash" />
          </div>
          <button
            type="button"
            onClick={() => router.push(`/wizard?step=12&tx=${txHash}`)}
            className="bg-lime-800 hover:bg-lime-700 text-white cta-strong-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Go to verification
          </button>
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
