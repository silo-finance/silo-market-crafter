import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { fetchAddresses } from '../repo'
import { gaugeHookReceiverAbi, ownableAbi } from '../abis'
import { isZeroAddress, toAddress } from '../utils'

const factory: VerificationCheckFactory = {
  id: 'CheckIncentivesOwner',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckIncentivesOwner:${suffix}`,
        order: baseOffset + 100,
        checkName: `${siloName} incentives owner is a growth multisig`,
        sourceFile: '',
        run: async () => {
          const addresses = await fetchAddresses(context.chainId)
          const growthMultisig = toAddress(addresses.GROWTH_MULTISIG || '')
          const hookReceiver = new ethers.Contract(config.hookReceiver, gaugeHookReceiverAbi, context.provider)

          const protectedGauge = (await hookReceiver.configuredGauges(config.protectedShareToken)) as string
          const collateralGauge = (await hookReceiver.configuredGauges(config.collateralShareToken)) as string
          const debtGauge = (await hookReceiver.configuredGauges(config.debtShareToken)) as string

          const gauges = [protectedGauge, collateralGauge, debtGauge]
          const allZero = gauges.every((g) => isZeroAddress(g))
          if (allZero) {
            return { status: 'success', message: 'incentives are not set' }
          }

          for (const gauge of gauges) {
            if (isZeroAddress(gauge)) continue
            const gaugeOwner = (await new ethers.Contract(gauge, ownableAbi, context.provider).owner()) as string
            const normalizedOwner = toAddress(gaugeOwner)
            if (normalizedOwner !== growthMultisig) {
              return {
                status: 'failed',
                message: `owner of ${toAddress(gauge)} is NOT known ${normalizedOwner}`
              }
            }
          }

          return { status: 'success', message: 'owner is a growth multisig' }
        }
      }
    })
  }
}

export default factory
