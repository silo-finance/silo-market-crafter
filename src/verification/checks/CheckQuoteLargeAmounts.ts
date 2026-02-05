import type { VerificationCheckFactory } from '../types'
import { quote, getTokenDecimals } from './helpers'
import { getOracleOrder } from './oracleOrder'
import { isZeroAddress } from '../utils'

type OracleCheckInput = {
  oracle: string
  token: string
  oracleName: string
}

const factory: VerificationCheckFactory = {
  id: 'CheckQuoteLargeAmounts',
  build: (context) => {
    const inputs: OracleCheckInput[] = []

    if (!isZeroAddress(context.config0.solvencyOracle)) {
      inputs.push({
        oracle: context.config0.solvencyOracle,
        token: context.config0.token,
        oracleName: 'solvencyOracle0'
      })
    }

    if (
      !isZeroAddress(context.config0.maxLtvOracle) &&
      context.config0.maxLtvOracle.toLowerCase() !== context.config0.solvencyOracle.toLowerCase()
    ) {
      inputs.push({
        oracle: context.config0.maxLtvOracle,
        token: context.config0.token,
        oracleName: 'maxLtvOracle0'
      })
    }

    if (!isZeroAddress(context.config1.solvencyOracle)) {
      inputs.push({
        oracle: context.config1.solvencyOracle,
        token: context.config1.token,
        oracleName: 'solvencyOracle1'
      })
    }

    if (
      !isZeroAddress(context.config1.maxLtvOracle) &&
      context.config1.maxLtvOracle.toLowerCase() !== context.config1.solvencyOracle.toLowerCase()
    ) {
      inputs.push({
        oracle: context.config1.maxLtvOracle,
        token: context.config1.token,
        oracleName: 'maxLtvOracle1'
      })
    }

    return inputs.map((input) => ({
      id: `CheckQuoteLargeAmounts:${input.oracleName}`,
      order: getOracleOrder(input.oracleName, 2),
      checkName: `${input.oracleName} quote must not revert for large amounts quote(10**36 wei + 10**20 tokens in own decimals)`,
      sourceFile: '',
      run: async () => {
        const decimals = await getTokenDecimals(context.provider, input.token)
        const toQuote = 10n ** 36n + 10n ** 20n * 10n ** BigInt(decimals)
        const result = await quote(context.provider, input.oracle, input.token, toQuote)
        return result.success
          ? { status: 'success', message: 'oracle does not revert' }
          : { status: 'failed', message: 'oracle reverts' }
      }
    }))
  }
}

export default factory
