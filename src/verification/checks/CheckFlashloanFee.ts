import type { VerificationCheckFactory } from '../types'

const factory: VerificationCheckFactory = {
  id: 'CheckFlashloanFee',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckFlashloanFee:${suffix}`,
        order: baseOffset + 50,
        checkName: `${siloName} flashloan fee is <1%`,
        sourceFile: '',
        run: async () => {
          const result = config.flashloanFee < 10n ** 18n / 100n
          return result
            ? { status: 'success', message: 'flashloan fee is within the expected range' }
            : {
                status: 'failed',
                message: `${config.flashloanFee.toString()} flashloan fee is NOT within the expected range`
              }
        }
      }
    })
  }
}

export default factory
