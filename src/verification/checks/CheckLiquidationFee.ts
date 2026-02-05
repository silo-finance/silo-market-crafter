import type { VerificationCheckFactory } from '../types'

const factory: VerificationCheckFactory = {
  id: 'CheckLiquidationFee',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckLiquidationFee:${suffix}`,
        order: baseOffset + 40,
        checkName: `${siloName} liquidation fee is <15%`,
        sourceFile: '',
        run: async () => {
          const result = config.liquidationFee < (10n ** 18n * 15n) / 100n
          return result
            ? { status: 'success', message: 'liquidation fee is within the expected range' }
            : {
                status: 'failed',
                message: `${config.liquidationFee.toString()} liquidation fee is NOT within the expected range`
              }
        }
      }
    })
  }
}

export default factory
