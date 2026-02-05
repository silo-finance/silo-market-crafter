import type { VerificationCheckFactory } from '../types'
import { quote } from './helpers'
import { getOracleOrder } from './oracleOrder'
import { formatNumberInE } from '../utils'
import { isZeroAddress } from '../utils'

type OracleCheckInput = {
  oracle: string
  token: string
  oracleName: string
}

const factory: VerificationCheckFactory = {
  id: 'CheckQuoteIsLinearFunction',
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
      id: `CheckQuoteIsLinearFunction:${input.oracleName}`,
      order: getOracleOrder(input.oracleName, 1),
      checkName: `${input.oracleName} quote is a linear function (quote(10x) = 10*quote(x))`,
      sourceFile: '',
      run: async () => {
        let previousQuote: bigint | null = null
        const maxAmount = 10n ** 36n

        for (let amount = maxAmount; amount >= 100n; amount /= 10n) {
          if (previousQuote === null) {
            const firstQuote = await quote(context.provider, input.oracle, input.token, amount)
            if (!firstQuote.success) {
              return { status: 'success', message: 'quote() reverted during linear function check' }
            }
            previousQuote = firstQuote.price
            continue
          }

          const currentQuoteResult = await quote(context.provider, input.oracle, input.token, amount)
          const currentQuote = currentQuoteResult.success ? currentQuoteResult.price : 0n

          if (currentQuote !== previousQuote / 10n) {
            return {
              status: 'failed',
              message: `property does not hold, breaks at amount ${formatNumberInE(amount)}`
            }
          }

          previousQuote = currentQuote
        }

        return { status: 'success', message: 'property holds' }
      }
    }))
  }
}

export default factory
