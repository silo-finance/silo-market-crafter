import type { VerificationCheckFactory } from '../types'

const factory: VerificationCheckFactory = {
  id: 'CheckMaxLtvLtLiquidationFee',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckMaxLtvLtLiquidationFee:${suffix}`,
        order: baseOffset + 80,
        checkName: `${siloName} maxLtv == 0 <=> lt == 0 <=> liquidationFee == 0`,
        sourceFile: '',
        run: async () => {
          const allZero = config.maxLtv === 0n && config.lt === 0n && config.liquidationFee === 0n
          const allNonZero = config.maxLtv !== 0n && config.lt !== 0n && config.liquidationFee !== 0n
          const result = allZero || allNonZero
          return result
            ? { status: 'success', message: 'property holds' }
            : { status: 'failed', message: 'property DOES NOT hold' }
        }
      }
    })
  }
}

export default factory
