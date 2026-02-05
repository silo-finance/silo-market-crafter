import type { VerificationCheckFactory } from '../types'

const factory: VerificationCheckFactory = {
  id: 'CheckDaoFee',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckDaoFee:${suffix}`,
        order: baseOffset + 20,
        checkName: `${siloName} dao fee is >0.01% or <25%`,
        sourceFile: '',
        run: async () => {
          const min = 10n ** 18n / 10_000n
          const max = 10n ** 18n / 4n
          const result = config.daoFee > min && config.daoFee < max
          return result
            ? { status: 'success', message: 'dao fee is within the expected range' }
            : {
                status: 'failed',
                message: `${config.daoFee.toString()} dao fee is NOT within the expected range`
              }
        }
      }
    })
  }
}

export default factory
