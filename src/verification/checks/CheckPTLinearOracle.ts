import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { tryGetChainlinkAggregators, tryGetPT } from './helpers'
import { isZeroAddress, toAddress } from '../utils'

const factory: VerificationCheckFactory = {
  id: 'CheckPTLinearOracle',
  build: (context) => {
    const checks = [
      { config: context.config0, suffix: 'silo0' },
      { config: context.config1, suffix: 'silo1' }
    ]

    return checks.map(({ config, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckPTLinearOracle:${suffix}`,
        order: baseOffset + 130,
        checkName: "PT linear aggregator's PT token is equal to Silo's PT token",
        sourceFile: '',
        run: async () => {
          const { primary, secondary } = await tryGetChainlinkAggregators(context.provider, config.solvencyOracle)

          let ptLinearAggregator = ethers.ZeroAddress
          const primaryPT = await tryGetPT(context.provider, primary)
          if (!isZeroAddress(primaryPT)) {
            ptLinearAggregator = primary
          } else {
            const secondaryPT = await tryGetPT(context.provider, secondary)
            if (!isZeroAddress(secondaryPT)) {
              ptLinearAggregator = secondary
            }
          }

          if (isZeroAddress(ptLinearAggregator)) {
            return { status: 'success', message: 'aggregator is NOT PT linear aggregator' }
          }

          const pt = await tryGetPT(context.provider, ptLinearAggregator)
          const result = toAddress(pt) === toAddress(config.token)
          return result
            ? { status: 'success', message: 'PT() token from aggregator is equal to Silo asset' }
            : { status: 'failed', message: 'PT() token from aggregator is NOT equal to Silo asset' }
        }
      }
    })
  }
}

export default factory
