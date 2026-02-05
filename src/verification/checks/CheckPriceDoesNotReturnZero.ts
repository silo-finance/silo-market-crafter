import type { VerificationCheckFactory } from '../types'
import { quote } from './helpers'
import { getOracleOrder } from './oracleOrder'
import { isZeroAddress } from '../utils'

type OracleCheckInput = {
  oracle: string
  token: string
  oracleName: string
}

const factory: VerificationCheckFactory = {
  id: 'CheckPriceDoesNotReturnZero',
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
      id: `CheckPriceDoesNotReturnZero:${input.oracleName}`,
      order: getOracleOrder(input.oracleName, 0),
      checkName: `${input.oracleName} price > 0 when quote(0)`,
      sourceFile: '',
      run: async () => {
        const result = await quote(context.provider, input.oracle, input.token, 0n)
        if (!result.success) {
          return { status: 'success', message: 'quote(0) reverts' }
        }

        return result.price !== 0n
          ? { status: 'success', message: `quote(0) = ${result.price.toString()}` }
          : { status: 'failed', message: 'quote(0) = 0' }
      }
    }))
  }
}

export default factory
