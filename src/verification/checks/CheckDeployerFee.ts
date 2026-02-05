import type { VerificationCheckFactory } from '../types'

const factory: VerificationCheckFactory = {
  id: 'CheckDeployerFee',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckDeployerFee:${suffix}`,
        order: baseOffset + 30,
        checkName: `${siloName} deployer fee is == 0`,
        sourceFile: '',
        run: async () => {
          const result = config.deployerFee === 0n
          return result
            ? { status: 'success', message: 'deployer fee is zero' }
            : {
                status: 'failed',
                message: `${config.deployerFee.toString()} deployer fee is NOT zero`
              }
        }
      }
    })
  }
}

export default factory
