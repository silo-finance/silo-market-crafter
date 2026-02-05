/**
 * Unit test: same pipeline as UI to turn step-9 JSON into deploy calldata.
 * Uses only: parseJSONConfigToWizardData, prepareDeployArgs, generateDeployCalldata.
 * Fixture JSON must contain irmConfig0/irmConfig1 when full config is needed (parser fills wizardData from JSON).
 * We only decode the tx to get: expectedCalldata, token addresses, hook owner, siloCoreDeployments, oracleDeployments.
 */

import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'
import { parseJSONConfigToWizardData } from '@/utils/parseJSONConfig'
import { prepareDeployArgs, generateDeployCalldata } from '@/utils/deployArgs'
import type { WizardData } from '@/contexts/WizardContext'
import type { SiloCoreDeployments, OracleDeployments } from '@/utils/deployArgs'
import deployerArtifact from '@/abis/silo/ISiloDeployer.json'

type FoundryArtifact = { abi: ethers.InterfaceAbi }
const deployerAbi = (deployerArtifact as FoundryArtifact).abi

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const JSON_FIXTURE = path.join(FIXTURES_DIR, 'Silo_LBTC_WBTC.json')
const TX_FIXTURE = path.join(FIXTURES_DIR, 'Silo_LBTC_WBTC_tx.txt')
const JSON_FIXTURE_WZETH = path.join(FIXTURES_DIR, 'Silo_wzETH_WETH.json')
const TX_FIXTURE_WZETH = path.join(FIXTURES_DIR, 'Silo_wzETH_WETH_tx.txt')

describe('deploy calldata from step-9 JSON', () => {
  it('produces the same calldata as the fixture when using only UI functions', () => {
    const jsonString = fs.readFileSync(JSON_FIXTURE, 'utf-8')
    const txContent = fs.readFileSync(TX_FIXTURE, 'utf-8').trim()
    const expectedCalldata = txContent.split('\n')[0].trim()
    if (!expectedCalldata.startsWith('0x')) throw new Error('Fixture tx must start with 0x')

    const iface = new ethers.Interface(deployerAbi as ethers.InterfaceAbi)
    const decoded = iface.decodeFunctionData('deploy', expectedCalldata as `0x${string}`)
    const args = decoded

    const _clonableHookReceiver = args[3] as { implementation: string; initializationData: string }
    const _siloInitData = args[4] as {
      token0: string
      token1: string
      interestRateModel0: string
      interestRateModel1: string
      [k: string]: unknown
    }

    const hookOwnerAddress = (() => {
      const data = _clonableHookReceiver.initializationData
      if (!data || data === '0x' || data.length < 66) return ethers.ZeroAddress
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const decodedInit = abiCoder.decode(['address'], data)
      return decodedInit[0] as string
    })()

    const wizardData: WizardData = parseJSONConfigToWizardData(jsonString)
    wizardData.token0 = wizardData.token0
      ? { ...wizardData.token0, address: _siloInitData.token0 }
      : { address: _siloInitData.token0, symbol: '', decimals: 18, name: '' }
    wizardData.token1 = wizardData.token1
      ? { ...wizardData.token1, address: _siloInitData.token1 }
      : { address: _siloInitData.token1, symbol: '', decimals: 18, name: '' }
    wizardData.hookOwnerAddress = hookOwnerAddress

    const siloCoreDeployments: SiloCoreDeployments = {
      'InterestRateModelV2Factory.sol': _siloInitData.interestRateModel0,
      'SiloHookV1.sol': _clonableHookReceiver.implementation,
    }

    const deployArgs = prepareDeployArgs(wizardData, siloCoreDeployments)
    const deployerAddress = ethers.ZeroAddress
    const generatedCalldata = generateDeployCalldata(deployerAddress, deployArgs)

    expect(generatedCalldata).toBe(expectedCalldata)
  })

  it('produces the same calldata as the wzETH/WETH fixture (Chainlink + Dynamic Kink)', () => {
    const jsonString = fs.readFileSync(JSON_FIXTURE_WZETH, 'utf-8')
    const txContent = fs.readFileSync(TX_FIXTURE_WZETH, 'utf-8').trim()
    const expectedCalldata = txContent.split('\n')[0].trim()
    if (!expectedCalldata.startsWith('0x')) throw new Error('Fixture tx must start with 0x')

    const iface = new ethers.Interface(deployerAbi as ethers.InterfaceAbi)
    const decoded = iface.decodeFunctionData('deploy', expectedCalldata as `0x${string}`)
    const args = decoded

    const _oracles = args[0] as {
      solvencyOracle0: { deployed: string; factory: string; txInput: string }
      [k: string]: unknown
    }
    const _clonableHookReceiver = args[3] as { implementation: string; initializationData: string }
    const _siloInitData = args[4] as {
      token0: string
      token1: string
      interestRateModel0: string
      interestRateModel1: string
      [k: string]: unknown
    }

    const hookOwnerAddress = (() => {
      const data = _clonableHookReceiver.initializationData
      if (!data || data === '0x' || data.length < 66) return ethers.ZeroAddress
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const decodedInit = abiCoder.decode(['address'], data)
      return decodedInit[0] as string
    })()

    const wizardData: WizardData = parseJSONConfigToWizardData(jsonString)
    wizardData.token0 = wizardData.token0
      ? { ...wizardData.token0, address: _siloInitData.token0 }
      : { address: _siloInitData.token0, symbol: '', decimals: 18, name: '' }
    wizardData.token1 = wizardData.token1
      ? { ...wizardData.token1, address: _siloInitData.token1 }
      : { address: _siloInitData.token1, symbol: '', decimals: 18, name: '' }
    wizardData.hookOwnerAddress = hookOwnerAddress

    const siloCoreDeployments: SiloCoreDeployments = {
      'DynamicKinkModelFactory.sol': _siloInitData.interestRateModel0,
      'SiloHookV1.sol': _clonableHookReceiver.implementation,
    }

    const oracleDeployments: OracleDeployments = {}
    if (_oracles.solvencyOracle0.factory && _oracles.solvencyOracle0.factory !== ethers.ZeroAddress) {
      oracleDeployments.chainlinkV3OracleFactory = _oracles.solvencyOracle0.factory
    }

    const deployArgs = prepareDeployArgs(wizardData, siloCoreDeployments, oracleDeployments)
    const deployerAddress = ethers.ZeroAddress
    const generatedCalldata = generateDeployCalldata(deployerAddress, deployArgs)

    expect(generatedCalldata).toBe(expectedCalldata)
  })
})

