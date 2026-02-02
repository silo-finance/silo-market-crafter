/**
 * Unit test: same pipeline as UI to turn step-9 JSON into deploy calldata.
 * Uses only: parseJSONConfigToWizardData, prepareDeployArgs, generateDeployCalldata.
 */

import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'
import { parseJSONConfigToWizardData } from '@/utils/parseJSONConfig'
import { prepareDeployArgs, generateDeployCalldata } from '@/utils/deployArgs'
import type { WizardData } from '@/contexts/WizardContext'
import type { SiloCoreDeployments } from '@/utils/deployArgs'
import deployerArtifact from '@/abis/silo/ISiloDeployer.json'
import irmV2Artifact from '@/abis/silo/IInterestRateModelV2.json'

type FoundryArtifact = { abi: ethers.InterfaceAbi }
const deployerAbi = (deployerArtifact as FoundryArtifact).abi
const irmV2Abi = (irmV2Artifact as FoundryArtifact).abi

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const JSON_FIXTURE = path.join(FIXTURES_DIR, 'Silo_LBTC_WBTC.json')
const TX_FIXTURE = path.join(FIXTURES_DIR, 'Silo_LBTC_WBTC_tx.txt')

function irmEncodedBytesToConfigObject(encoded: string): { [key: string]: string } {
  const getConfigFn = (irmV2Abi as ethers.Fragment[]).find(
    (x): x is ethers.FunctionFragment => x.type === 'function' && (x as ethers.FunctionFragment).name === 'getConfig'
  )
  const configParamType = getConfigFn?.outputs?.[0]
  if (!configParamType) throw new Error('IInterestRateModelV2.Config type not found in ABI')
  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const decoded = abiCoder.decode([configParamType], encoded) as [unknown[]]
  const arr = decoded[0] as unknown[]
  const keys = ['uopt', 'ucrit', 'ulow', 'ki', 'kcrit', 'klow', 'klin', 'beta', 'ri', 'Tcrit']
  const obj: { [key: string]: string } = {}
  keys.forEach((key, i) => {
    const v = arr[i]
    obj[key] = typeof v === 'bigint' ? String(v) : String(v ?? 0)
  })
  return obj
}

describe('deploy calldata from step-9 JSON', () => {
  it('produces the same calldata as the fixture when using only UI functions', () => {
    const jsonString = fs.readFileSync(JSON_FIXTURE, 'utf-8')
    const txContent = fs.readFileSync(TX_FIXTURE, 'utf-8').trim()
    const expectedCalldata = txContent.split('\n')[0].trim()
    if (!expectedCalldata.startsWith('0x')) throw new Error('Fixture tx must start with 0x')

    const iface = new ethers.Interface(deployerAbi as ethers.InterfaceAbi)
    const decoded = iface.decodeFunctionData('deploy', expectedCalldata as `0x${string}`)
    const args = decoded

    const _irmConfigData0 = args[1] as string
    const _irmConfigData1 = args[2] as string
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
      const decoded = abiCoder.decode(['address'], data)
      return decoded[0] as string
    })()

    const irmConfig0 = irmEncodedBytesToConfigObject(_irmConfigData0)
    const irmConfig1 = irmEncodedBytesToConfigObject(_irmConfigData1)

    const wizardData: WizardData = parseJSONConfigToWizardData(jsonString)
    wizardData.token0 = wizardData.token0
      ? { ...wizardData.token0, address: _siloInitData.token0 }
      : { address: _siloInitData.token0, symbol: '', decimals: 18, name: '' }
    wizardData.token1 = wizardData.token1
      ? { ...wizardData.token1, address: _siloInitData.token1 }
      : { address: _siloInitData.token1, symbol: '', decimals: 18, name: '' }
    wizardData.hookOwnerAddress = hookOwnerAddress
    if (wizardData.selectedIRM0) wizardData.selectedIRM0.config = irmConfig0
    if (wizardData.selectedIRM1) wizardData.selectedIRM1.config = irmConfig1

    const siloCoreDeployments: SiloCoreDeployments = {
      'InterestRateModelV2Factory.sol': _siloInitData.interestRateModel0,
      'SiloHookV1.sol': _clonableHookReceiver.implementation,
    }

    const deployArgs = prepareDeployArgs(wizardData, siloCoreDeployments)
    const deployerAddress = ethers.ZeroAddress
    const generatedCalldata = generateDeployCalldata(deployerAddress, deployArgs)

    expect(generatedCalldata).toBe(expectedCalldata)
  })
})
