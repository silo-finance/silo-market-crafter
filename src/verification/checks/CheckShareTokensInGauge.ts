import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { gaugeHookReceiverAbi, incentivesControllerAbi } from '../abis'
import { isZeroAddress, toAddress } from '../utils'

const factory: VerificationCheckFactory = {
  id: 'CheckShareTokensInGauge',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckShareTokensInGauge:${suffix}`,
        order: baseOffset + 110,
        checkName: `${siloName} hookReceiver.configuredGauges(shareToken).shareToken == shareToken`,
        sourceFile: '',
        run: async () => {
          const hookReceiver = new ethers.Contract(config.hookReceiver, gaugeHookReceiverAbi, context.provider)

          const protectedGauge = (await hookReceiver.configuredGauges(config.protectedShareToken)) as string
          const collateralGauge = (await hookReceiver.configuredGauges(config.collateralShareToken)) as string
          const debtGauge = (await hookReceiver.configuredGauges(config.debtShareToken)) as string

          const checksToRun = [
            { gauge: protectedGauge, shareToken: config.protectedShareToken },
            { gauge: collateralGauge, shareToken: config.collateralShareToken },
            { gauge: debtGauge, shareToken: config.debtShareToken }
          ]

          for (const { gauge, shareToken } of checksToRun) {
            if (isZeroAddress(gauge)) continue
            const controller = new ethers.Contract(gauge, incentivesControllerAbi, context.provider)
            const shareTokenFromGauge = (await controller.SHARE_TOKEN()) as string
            if (toAddress(shareTokenFromGauge) !== toAddress(shareToken)) {
              return {
                status: 'failed',
                message: `property does not hold for share token ${toAddress(shareToken)}`
              }
            }
          }

          return { status: 'success', message: 'property holds' }
        }
      }
    })
  }
}

export default factory
