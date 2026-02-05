import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { fetchIrmV2Configs, fetchKinkConfigs, fetchKinkImmutable, fetchSiloCoreDeploymentAddress } from '../repo'
import { dynamicKinkModelAbi, dynamicKinkModelFactoryAbi, interestRateModelV2Abi, interestRateModelV2ConfigAbi } from '../abis'
import { secondsPerYear } from '../utils'
import kinkConfigArtifact from '@/abis/silo/IDynamicKinkModelConfig.json'

type FoundryArtifact = { abi: ethers.InterfaceAbi }
const kinkConfigAbi = (kinkConfigArtifact as FoundryArtifact).abi
const coder = ethers.AbiCoder.defaultAbiCoder()

const KINK_FACTORY_NAME = 'DynamicKinkModelFactory.sol'

const configTypes = [
  'int256',
  'int256',
  'int256',
  'int256',
  'int256',
  'int96',
  'int96',
  'int256',
  'int256',
  'int256',
  'int256',
  'int256',
  'int256'
]

const immutableTypes = ['uint32', 'int96']

const irmV2Types = ['int256', 'int256', 'int256', 'int256', 'int256', 'int256', 'int256', 'int256', 'int112', 'int112']

function toInt(value: string | number): bigint {
  return BigInt(value)
}

function hashConfig(values: bigint[]): string {
  return ethers.keccak256(coder.encode(configTypes, values))
}

function hashImmutable(values: bigint[]): string {
  return ethers.keccak256(coder.encode(immutableTypes, values))
}

function hashIrmV2(values: bigint[]): string {
  return ethers.keccak256(coder.encode(irmV2Types, values))
}

const factory: VerificationCheckFactory = {
  id: 'CheckIrmConfig',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckIrmConfig:${suffix}`,
        order: baseOffset + 60,
        checkName: `${siloName} IRM config should be known`,
        sourceFile: '',
        run: async () => {
          const provider = context.provider
          let kinkFactoryAddress: string | null = null
          try {
            kinkFactoryAddress = await fetchSiloCoreDeploymentAddress(context.chainAlias, KINK_FACTORY_NAME)
          } catch {
            kinkFactoryAddress = null
          }
          let isKinkIrm = false
          if (kinkFactoryAddress) {
            try {
              const factoryContract = new ethers.Contract(kinkFactoryAddress, dynamicKinkModelFactoryAbi, provider)
              isKinkIrm = (await factoryContract.createdByFactory(config.interestRateModel)) as boolean
            } catch {
              isKinkIrm = false
            }
          }

          if (isKinkIrm) {
            const irm = new ethers.Contract(config.interestRateModel, dynamicKinkModelAbi, provider)
            const irmConfigAddress = (await irm.irmConfig()) as string
            const irmConfigContract = new ethers.Contract(irmConfigAddress, kinkConfigAbi, provider)
            const [configData, immutableConfig] = (await irmConfigContract.getConfig()) as [
              {
                ulow: bigint
                u1: bigint
                u2: bigint
                ucrit: bigint
                rmin: bigint
                kmin: bigint
                kmax: bigint
                alpha: bigint
                cminus: bigint
                cplus: bigint
                c1: bigint
                c2: bigint
                dmax: bigint
              },
              { timelock: bigint; rcompCapPerSecond: bigint }
            ]

            const deployedConfigHash = hashConfig([
              configData.ulow,
              configData.u1,
              configData.u2,
              configData.ucrit,
              configData.rmin,
              BigInt.asIntN(96, configData.kmin),
              BigInt.asIntN(96, configData.kmax),
              configData.alpha,
              configData.cminus,
              configData.cplus,
              configData.c1,
              configData.c2,
              configData.dmax
            ])

            const deployedImmutableHash = hashImmutable([
              BigInt(immutableConfig.timelock),
              BigInt.asIntN(96, immutableConfig.rcompCapPerSecond)
            ])

            const allConfigs = await fetchKinkConfigs()
            const allImmutable = await fetchKinkImmutable()

            let configName = ''
            let immutableName = ''

            for (const entry of allConfigs) {
              const cfg = entry.config
              const hash = hashConfig([
                toInt(cfg.ulow as string | number),
                toInt(cfg.u1 as string | number),
                toInt(cfg.u2 as string | number),
                toInt(cfg.ucrit as string | number),
                toInt(cfg.rmin as string | number),
                BigInt.asIntN(96, toInt(cfg.kmin as string | number)),
                BigInt.asIntN(96, toInt(cfg.kmax as string | number)),
                toInt(cfg.alpha as string | number),
                toInt(cfg.cminus as string | number),
                toInt(cfg.cplus as string | number),
                toInt(cfg.c1 as string | number),
                toInt(cfg.c2 as string | number),
                toInt(cfg.dmax as string | number)
              ])
              if (hash === deployedConfigHash) {
                configName = entry.name
                break
              }
            }

            for (const entry of allImmutable) {
              const rcompCapPerSecond = BigInt(entry.rcompCap) / secondsPerYear()
              const hash = hashImmutable([
                BigInt.asUintN(32, BigInt(entry.timelock)),
                BigInt.asIntN(96, rcompCapPerSecond)
              ])
              if (hash === deployedImmutableHash) {
                immutableName = entry.name
                break
              }
            }

            if (configName && immutableName) {
              const irmName = `${configName}:${immutableName}`
              return { status: 'success', message: `IRM is \`${irmName}\` (KINK)` }
            }

            return { status: 'failed', message: 'IRM is NOT known' }
          }

          const irm = new ethers.Contract(config.interestRateModel, interestRateModelV2Abi, provider)
          const irmConfigAddress = (await irm.irmConfig()) as string
          const irmConfigContract = new ethers.Contract(irmConfigAddress, interestRateModelV2ConfigAbi, provider)
          const irmConfig = (await irmConfigContract.getConfig()) as {
            uopt: bigint
            ucrit: bigint
            ulow: bigint
            ki: bigint
            kcrit: bigint
            klow: bigint
            klin: bigint
            beta: bigint
            ri: bigint
            Tcrit: bigint
          }

          const deployedHash = hashIrmV2([
            irmConfig.uopt,
            irmConfig.ucrit,
            irmConfig.ulow,
            irmConfig.ki,
            irmConfig.kcrit,
            irmConfig.klow,
            irmConfig.klin,
            irmConfig.beta,
            BigInt.asIntN(112, irmConfig.ri),
            BigInt.asIntN(112, irmConfig.Tcrit)
          ])

          const allConfigs = await fetchIrmV2Configs()
          for (const entry of allConfigs) {
            const cfg = entry.config
            const hash = hashIrmV2([
              toInt(cfg.uopt as string | number),
              toInt(cfg.ucrit as string | number),
              toInt(cfg.ulow as string | number),
              toInt(cfg.ki as string | number),
              toInt(cfg.kcrit as string | number),
              toInt(cfg.klow as string | number),
              toInt(cfg.klin as string | number),
              toInt(cfg.beta as string | number),
              BigInt.asIntN(112, toInt(cfg.ri as string | number)),
              BigInt.asIntN(112, toInt(cfg.Tcrit as string | number))
            ])

            if (hash === deployedHash) {
              const irmName = entry.name
              return { status: 'success', message: `IRM is \`${irmName}\`🚨 OLD IRM ` }
            }
          }

          return { status: 'failed', message: 'IRM is NOT known' }
        }
      }
    })
  }
}

export default factory
