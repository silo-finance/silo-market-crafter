'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard } from '@/contexts/WizardContext'

interface SiloCoreDeployments {
  [contractName: string]: string
}

interface DeployArgs {
  _oracles: {
    solvencyOracle0: {
      deployed: string
      factory: string
      txInput: string
    }
    maxLtvOracle0: {
      deployed: string
      factory: string
      txInput: string
    }
    solvencyOracle1: {
      deployed: string
      factory: string
      txInput: string
    }
    maxLtvOracle1: {
      deployed: string
      factory: string
      txInput: string
    }
  }
  _irmConfigData0: {
    note: string
    config: any
    encoded: string
  }
  _irmConfigData1: {
    note: string
    config: any
    encoded: string
  }
  _clonableHookReceiver: {
    implementation: string
    initializationData: string
  }
  _siloInitData: {
    deployer: string
    hookReceiver: string
    daoFee: string
    deployerFee: string
    token0: string
    solvencyOracle0: string
    maxLtvOracle0: string
    interestRateModel0: string
    maxLtv0: string
    lt0: string
    liquidationTargetLtv0: string
    liquidationFee0: string
    flashloanFee0: string
    callBeforeQuote0: boolean
    token1: string
    solvencyOracle1: string
    maxLtvOracle1: string
    interestRateModel1: string
    maxLtv1: string
    lt1: string
    liquidationTargetLtv1: string
    liquidationFee1: string
    flashloanFee1: string
    callBeforeQuote1: boolean
  }
}

export default function Step9Deployment() {
  const router = useRouter()
  const { wizardData, markStepCompleted } = useWizard()
  
  const [deployerAddress, setDeployerAddress] = useState<string>('')
  const [siloCoreDeployments, setSiloCoreDeployments] = useState<SiloCoreDeployments>({})
  const [signerAddress, setSignerAddress] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<string>('')
  const [deployArgs, setDeployArgs] = useState<DeployArgs | null>(null)

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

  // Get signer address from MetaMask (will be used as owner for hook initialization)
  useEffect(() => {
    const getSignerAddress = async () => {
      if (!window.ethereum) {
        return
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        setSignerAddress(address)
      } catch (err) {
        console.warn('Failed to get signer address:', err)
        // Don't set error here, just log - user might not be connected yet
      }
    }

    getSignerAddress()
  }, [])

  // Fetch SiloDeployer address and SiloCore deployments
  useEffect(() => {
    const fetchDeploymentData = async () => {
      try {
        setLoading(true)
        setError('')
        
        if (!wizardData.networkInfo?.chainId) {
          throw new Error('Network information not available')
        }

        const chainName = getChainName(wizardData.networkInfo.chainId)
        
        // Fetch SiloDeployer address
        const deployerPaths = [
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloDeployer.json`,
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}.json`
        ]

        let address = ''
        for (const path of deployerPaths) {
          try {
            const response = await fetch(path)
            if (response.ok) {
              const data = await response.json()
              address = data.address || data.SiloDeployer || ''
              if (address) break
            }
          } catch (err) {
            continue
          }
        }

        if (!address) {
          // Don't throw - just set warning and continue
          setError(prevError => {
            const warning = `Warning: Failed to fetch SiloDeployer address for ${chainName}. Arguments will still be displayed.`
            return prevError ? `${prevError}\n${warning}` : warning
          })
        } else {
          setDeployerAddress(address)
          // Don't clear error here - there might be other warnings
        }


      } catch (err) {
        console.error('Error fetching deployment data:', err)
        // Set warning but don't prevent argument preparation
        setError(`Warning: ${err instanceof Error ? err.message : 'Failed to load some deployment data'}. Arguments will still be displayed.`)
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
        'InterestRateModelV2Factory.sol'
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

    if (wizardData.networkInfo?.chainId) {
      fetchSiloCoreDeployments()
    }
  }, [wizardData.networkInfo?.chainId])

  // Prepare deploy arguments from JSON config (matching Solidity script logic)
  // Always prepare arguments even if deployer address is not available
  useEffect(() => {
    if (!wizardData.token0 || !wizardData.token1) return

    // Constants from Solidity
    const BP2DP_NORMALIZATION = BigInt(10 ** (18 - 4)) // 10^14

    // Resolve hook implementation address
    // The hookReceiverImplementation from config is used directly to look up in deployments
    // Matching: _resolveHookReceiverImpl(config.hookReceiverImplementation)
    const hookImplementationName = wizardData.selectedHook 
      ? `${wizardData.selectedHook}.sol` 
      : 'SiloHookV1.sol'
    
    // Look up the contract address using the exact contract name (e.g., "SiloHookV1.sol")
    // This matches how SiloCoreDeployments.get() works in Solidity
    const hookReceiverImplementation = siloCoreDeployments[hookImplementationName] || ethers.ZeroAddress
    
    console.log(`Looking up hook implementation: ${hookImplementationName}`, {
      found: hookReceiverImplementation !== ethers.ZeroAddress,
      address: hookReceiverImplementation,
      availableDeployments: Object.keys(siloCoreDeployments)
    })

    // Resolve IRM factory address using the exact contract name
    const irmFactoryAddress = siloCoreDeployments['InterestRateModelV2Factory.sol'] || ethers.ZeroAddress
    
    console.log(`Looking up IRM factory: InterestRateModelV2Factory.sol`, {
      found: irmFactoryAddress !== ethers.ZeroAddress,
      address: irmFactoryAddress
    })

    // Validate critical addresses and set warnings (but don't prevent argument preparation)
    let validationWarnings: string[] = []
    if (hookReceiverImplementation === ethers.ZeroAddress) {
      validationWarnings.push(`Hook implementation address not found for ${hookImplementationName}. Deployment may fail.`)
    }

    if (irmFactoryAddress === ethers.ZeroAddress) {
      validationWarnings.push('InterestRateModelV2Factory address not found. Deployment may fail.')
    }

    // Update error with warnings, but keep existing errors if any
    if (validationWarnings.length > 0) {
      const warningText = 'Warning: ' + validationWarnings.join(' | ')
      setError(prevError => {
        // Append to existing error if any, otherwise just set the warning
        return prevError ? `${prevError}\n${warningText}` : warningText
      })
    }

    // Prepare Oracles struct
    // For already deployed oracles, we only need the deployed address
    const getOracleTxData = (oracleAddress: string | undefined) => {
        if (!oracleAddress || oracleAddress === ethers.ZeroAddress) {
          return {
            deployed: ethers.ZeroAddress,
            factory: ethers.ZeroAddress,
            txInput: '0x'
          }
        }
        return {
          deployed: oracleAddress,
          factory: ethers.ZeroAddress, // Already deployed, no factory needed
          txInput: '0x' // Already deployed, no tx input needed
        }
      }

    const _oracles = {
      solvencyOracle0: getOracleTxData(wizardData.oracleConfiguration?.token0?.scalerOracle?.address),
      maxLtvOracle0: getOracleTxData(ethers.ZeroAddress), // Always NO_ORACLE in our case
      solvencyOracle1: getOracleTxData(wizardData.oracleConfiguration?.token1?.scalerOracle?.address),
      maxLtvOracle1: getOracleTxData(ethers.ZeroAddress) // Always NO_ORACLE in our case
    }

    // Prepare IRM config data as bytes
    // IRM config needs to be ABI encoded as IInterestRateModelV2.Config
    // Matching: abi.encode(irmModelData.getConfigData(_config.interestRateModelConfig0))
    const encodeIRMConfig = (irmConfig: any): string => {
        if (!irmConfig || !irmConfig.config) {
          return '0x'
        }

        const config = irmConfig.config
        // IInterestRateModelV2.Config structure - order matches interface declaration
        // All values are int256 except ri and Tcrit which are int112
        const irmConfigAbi = [
          'tuple(int256 uopt, int256 ucrit, int256 ulow, int256 ki, int256 kcrit, int256 klow, int256 klin, int256 beta, int112 ri, int112 Tcrit)'
        ]
        
        try {
          // Convert all values to BigInt, handling string or number inputs
          const toBigInt = (value: any): bigint => {
            if (value === null || value === undefined) return BigInt(0)
            if (typeof value === 'string') {
              // Handle string numbers
              try {
                return BigInt(value)
              } catch {
                return BigInt(0)
              }
            }
            return BigInt(Math.floor(Number(value) || 0))
          }

          const abiCoder = ethers.AbiCoder.defaultAbiCoder()
          const encoded = abiCoder.encode(irmConfigAbi, [[
            toBigInt(config.uopt),
            toBigInt(config.ucrit),
            toBigInt(config.ulow),
            toBigInt(config.ki),
            toBigInt(config.kcrit),
            toBigInt(config.klow),
            toBigInt(config.klin),
            toBigInt(config.beta),
            toBigInt(config.ri), // Will be cast to int112 by ABI encoder
            toBigInt(config.Tcrit) // Will be cast to int112 by ABI encoder
          ]])
          return encoded
        } catch (err) {
          console.error('Error encoding IRM config:', err)
          return '0x'
        }
      }

    const irmConfigData0Encoded = encodeIRMConfig(wizardData.selectedIRM0)
    const irmConfigData1Encoded = encodeIRMConfig(wizardData.selectedIRM1)

    // Prepare ClonableHookReceiver
    // Matching: _getClonableHookReceiverConfig(hookReceiverImplementation)
    // Initialization data is abi.encode(owner) where owner is the signer address
    // This matches: abi.encode(_getClonableHookReceiverOwner())
    let initializationData = '0x'
    if (signerAddress && signerAddress !== ethers.ZeroAddress) {
      try {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder()
        // Encode the owner address: abi.encode(address owner)
        initializationData = abiCoder.encode(['address'], [signerAddress])
      } catch (err) {
        console.error('Error encoding initialization data:', err)
        initializationData = '0x'
      }
    }

    const _clonableHookReceiver = {
      implementation: hookReceiverImplementation,
      initializationData: initializationData
    }

    // Prepare ISiloConfig.InitData
    // Convert basis points to 18 decimals (multiply by 10^14)
    const to18Decimals = (bp: number): bigint => {
      return BigInt(Math.round(bp * 100)) * BP2DP_NORMALIZATION
    }

    const _siloInitData = {
      deployer: ethers.ZeroAddress, // Can be set by user or left as zero
      hookReceiver: ethers.ZeroAddress, // CLONE_IMPLEMENTATION means zero, will use implementation
      daoFee: to18Decimals(wizardData.feesConfiguration?.daoFee || 0).toString(),
      deployerFee: to18Decimals(wizardData.feesConfiguration?.deployerFee || 0).toString(),
      token0: wizardData.token0.address,
      solvencyOracle0: _oracles.solvencyOracle0.deployed,
      maxLtvOracle0: ethers.ZeroAddress,
      interestRateModel0: irmFactoryAddress,
      maxLtv0: to18Decimals(wizardData.borrowConfiguration?.token0.maxLTV || 0).toString(),
      lt0: to18Decimals(wizardData.borrowConfiguration?.token0.liquidationThreshold || 0).toString(),
      liquidationTargetLtv0: to18Decimals(wizardData.borrowConfiguration?.token0.liquidationTargetLTV || 0).toString(),
      liquidationFee0: to18Decimals(wizardData.feesConfiguration?.token0.liquidationFee || 0).toString(),
      flashloanFee0: to18Decimals(wizardData.feesConfiguration?.token0.flashloanFee || 0).toString(),
      callBeforeQuote0: false,
      token1: wizardData.token1.address,
      solvencyOracle1: _oracles.solvencyOracle1.deployed,
      maxLtvOracle1: ethers.ZeroAddress,
      interestRateModel1: irmFactoryAddress,
      maxLtv1: to18Decimals(wizardData.borrowConfiguration?.token1.maxLTV || 0).toString(),
      lt1: to18Decimals(wizardData.borrowConfiguration?.token1.liquidationThreshold || 0).toString(),
      liquidationTargetLtv1: to18Decimals(wizardData.borrowConfiguration?.token1.liquidationTargetLTV || 0).toString(),
      liquidationFee1: to18Decimals(wizardData.feesConfiguration?.token1.liquidationFee || 0).toString(),
      flashloanFee1: to18Decimals(wizardData.feesConfiguration?.token1.flashloanFee || 0).toString(),
      callBeforeQuote1: false
    }

    const args: DeployArgs = {
      _oracles,
      _irmConfigData0: {
        note: 'ABI encoded IInterestRateModelV2.Config',
        config: wizardData.selectedIRM0?.config || {},
        encoded: irmConfigData0Encoded
      },
      _irmConfigData1: {
        note: 'ABI encoded IInterestRateModelV2.Config',
        config: wizardData.selectedIRM1?.config || {},
        encoded: irmConfigData1Encoded
      },
      _clonableHookReceiver,
      _siloInitData
    }

    setDeployArgs(args)
  }, [wizardData, siloCoreDeployments, signerAddress]) // Include signerAddress for initialization data

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

    setDeploying(true)
    setError('')
    setTxHash('')

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Use initialization data from deployArgs (already encoded with signer address)
      // If for some reason it's empty, encode it now
      let hookReceiverInitializationData = deployArgs._clonableHookReceiver.initializationData
      if (!hookReceiverInitializationData || hookReceiverInitializationData === '0x') {
        const signerAddress = await signer.getAddress()
        hookReceiverInitializationData = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [signerAddress])
      }
      
      // Use clonableHookReceiver from deployArgs with the initialization data
      const clonableHookReceiver = {
        implementation: deployArgs._clonableHookReceiver.implementation,
        initializationData: hookReceiverInitializationData
      }

      // ISiloDeployer ABI matching the interface
      const deployerAbi = [
        {
          inputs: [
            {
              name: '_oracles',
              type: 'tuple',
              components: [
                {
                  name: 'solvencyOracle0',
                  type: 'tuple',
                  components: [
                    { name: 'deployed', type: 'address' },
                    { name: 'factory', type: 'address' },
                    { name: 'txInput', type: 'bytes' }
                  ]
                },
                {
                  name: 'maxLtvOracle0',
                  type: 'tuple',
                  components: [
                    { name: 'deployed', type: 'address' },
                    { name: 'factory', type: 'address' },
                    { name: 'txInput', type: 'bytes' }
                  ]
                },
                {
                  name: 'solvencyOracle1',
                  type: 'tuple',
                  components: [
                    { name: 'deployed', type: 'address' },
                    { name: 'factory', type: 'address' },
                    { name: 'txInput', type: 'bytes' }
                  ]
                },
                {
                  name: 'maxLtvOracle1',
                  type: 'tuple',
                  components: [
                    { name: 'deployed', type: 'address' },
                    { name: 'factory', type: 'address' },
                    { name: 'txInput', type: 'bytes' }
                  ]
                }
              ]
            },
            { name: '_irmConfigData0', type: 'bytes' },
            { name: '_irmConfigData1', type: 'bytes' },
            {
              name: '_clonableHookReceiver',
              type: 'tuple',
              components: [
                { name: 'implementation', type: 'address' },
                { name: 'initializationData', type: 'bytes' }
              ]
            },
            {
              name: '_siloInitData',
              type: 'tuple',
              components: [
                { name: 'deployer', type: 'address' },
                { name: 'hookReceiver', type: 'address' },
                { name: 'daoFee', type: 'uint256' },
                { name: 'deployerFee', type: 'uint256' },
                { name: 'token0', type: 'address' },
                { name: 'solvencyOracle0', type: 'address' },
                { name: 'maxLtvOracle0', type: 'address' },
                { name: 'interestRateModel0', type: 'address' },
                { name: 'maxLtv0', type: 'uint256' },
                { name: 'lt0', type: 'uint256' },
                { name: 'liquidationTargetLtv0', type: 'uint256' },
                { name: 'liquidationFee0', type: 'uint256' },
                { name: 'flashloanFee0', type: 'uint256' },
                { name: 'callBeforeQuote0', type: 'bool' },
                { name: 'token1', type: 'address' },
                { name: 'solvencyOracle1', type: 'address' },
                { name: 'maxLtvOracle1', type: 'address' },
                { name: 'interestRateModel1', type: 'address' },
                { name: 'maxLtv1', type: 'uint256' },
                { name: 'lt1', type: 'uint256' },
                { name: 'liquidationTargetLtv1', type: 'uint256' },
                { name: 'liquidationFee1', type: 'uint256' },
                { name: 'flashloanFee1', type: 'uint256' },
                { name: 'callBeforeQuote1', type: 'bool' }
              ]
            }
          ],
          name: 'deploy',
          outputs: [{ name: 'siloConfig', type: 'address' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ]

      const deployerContract = new ethers.Contract(deployerAddress, deployerAbi, signer)

      // Execute deploy transaction
      const tx = await deployerContract.deploy(
        deployArgs._oracles,
        deployArgs._irmConfigData0.encoded,
        deployArgs._irmConfigData1.encoded,
        clonableHookReceiver,
        deployArgs._siloInitData
      )

      setTxHash(tx.hash)
      
      // Wait for transaction confirmation
      await tx.wait()
      
      markStepCompleted(10)
      setError('')
    } catch (err: any) {
      console.error('Deployment error:', err)
      setError(err?.message || 'Transaction failed. Please check your wallet and try again.')
      setTxHash('')
    } finally {
      setDeploying(false)
    }
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=9')
  }

  const getBlockExplorerUrl = (hash: string) => {
    if (!wizardData.networkInfo?.chainId) return '#'
    const chainId = parseInt(wizardData.networkInfo.chainId)
    const explorerMap: { [key: number]: string } = {
      1: 'https://etherscan.io',
      137: 'https://polygonscan.com',
      10: 'https://optimistic.etherscan.io',
      42161: 'https://arbiscan.io',
      43114: 'https://snowtrace.io',
      146: 'https://sonicscan.org'
    }
    const baseUrl = explorerMap[chainId] || 'https://etherscan.io'
    return `${baseUrl}/tx/${hash}`
  }

  // Don't block rendering - show arguments even while loading

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 10: Market Deployment
        </h1>
        <p className="text-gray-300 text-lg">
          Review deployment arguments and deploy your market
        </p>
      </div>

      {/* Network Information */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Network Information</h3>
        {loading && (
          <div className="mb-4 flex items-center space-x-2 text-blue-400">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">Loading deployment data...</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Network Name</p>
            <p className="text-white font-medium">{wizardData.networkInfo?.networkName || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">SiloDeployer Contract Address</p>
            <p className="text-white font-mono text-sm break-all">
              {loading ? 'Loading...' : (deployerAddress || 'Not available')}
            </p>
          </div>
        </div>
      </div>

      {/* Deploy Arguments as JSON */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Deploy Arguments</h3>
        <p className="text-sm text-gray-400 mb-4">
          Arguments for deploy(Oracles calldata _oracles, bytes calldata _irmConfigData0, bytes calldata _irmConfigData1, ClonableHookReceiver calldata _clonableHookReceiver, ISiloConfig.InitData memory _siloInitData)
        </p>
        {deployArgs ? (
          <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
              <code>{JSON.stringify(deployArgs, null, 2)}</code>
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

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <div className="text-red-400 text-sm">
            ✗ {error}
          </div>
        </div>
      )}

      {txHash && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-4 mb-6">
          <div className="text-green-400 text-sm mb-2">
            ✓ Transaction submitted successfully!
          </div>
          <a
            href={getBlockExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            View on block explorer: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        </div>
      )}

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
          <span>JSON Config</span>
        </button>
        
        <button
          onClick={handleDeploy}
          disabled={
            deploying || 
            !deployerAddress || 
            !deployArgs ||
            (deployArgs && (
              deployArgs._clonableHookReceiver.implementation === ethers.ZeroAddress ||
              deployArgs._siloInitData.interestRateModel0 === ethers.ZeroAddress ||
              deployArgs._siloInitData.interestRateModel1 === ethers.ZeroAddress
            ))
          }
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
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
              <span>Create Market</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
