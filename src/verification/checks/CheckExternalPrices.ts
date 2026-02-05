import type { VerificationCheckFactory } from '../types'
import { quote, getTokenDecimals } from './helpers'
import { isZeroAddress } from '../utils'

const factory: VerificationCheckFactory = {
  id: 'CheckExternalPrices',
  build: (context) => [
    {
      id: 'CheckExternalPrices',
      order: 500,
      checkName: 'Difference of price1/price2 with external price source must be <1%',
      sourceFile: '',
      run: async () => {
        const precision = 10n ** 18n
        const solvencyOracle0 = context.config0.solvencyOracle
        const solvencyOracle1 = context.config1.solvencyOracle
        const token0 = context.config0.token
        const token1 = context.config1.token
        const externalPrice0 = context.externalPrice0
        const externalPrice1 = context.externalPrice1

        const noOracleCase = isZeroAddress(solvencyOracle0) && isZeroAddress(solvencyOracle1)
        let contractsRatio = 0n
        let externalRatio = 0n

        let reverted = false
        let oracleReturnsZero = false
        let wrongDecimalsForNoOracleCase = false

        const token0Decimals = BigInt(await getTokenDecimals(context.provider, token0))
        const token1Decimals = BigInt(await getTokenDecimals(context.provider, token1))
        const oneToken0 = 10n ** token0Decimals
        const oneToken1 = 10n ** token1Decimals

        if (externalPrice0 === 0n || externalPrice1 === 0n) {
          return { status: 'failed', message: 'external price is not provided' }
        }

        if (noOracleCase) {
          if (token0Decimals !== token1Decimals) {
            wrongDecimalsForNoOracleCase = true
            return { status: 'failed', message: 'no oracles case: decimals of tokens are not equal' }
          }

          if (externalPrice0 === externalPrice1) {
            return {
              status: 'success',
              message: 'No oracles case: provided external prices are equal as expected'
            }
          }

          return {
            status: 'failed',
            message: 'external prices are not equal for no oracles case, prices must be 1:1'
          }
        }

        externalRatio = (externalPrice0 * precision) / externalPrice1

        if (isZeroAddress(solvencyOracle1)) {
          const quoteResult = await quote(context.provider, solvencyOracle0, token0, oneToken0)
          contractsRatio = (quoteResult.price * precision) / oneToken1
        } else {
          let price0 = oneToken0
          let success0 = true
          if (!isZeroAddress(solvencyOracle0)) {
            const quote0 = await quote(context.provider, solvencyOracle0, token0, oneToken0)
            success0 = quote0.success
            price0 = quote0.price
          }

          const quote1 = await quote(context.provider, solvencyOracle1, token1, oneToken1)
          if (!success0 || !quote1.success) {
            reverted = true
          } else if (quote1.price === 0n) {
            oracleReturnsZero = true
          } else {
            contractsRatio = (price0 * precision) / quote1.price
          }
        }

        if (reverted) {
          return { status: 'failed', message: 'oracles revert' }
        }

        if (oracleReturnsZero) {
          return { status: 'failed', message: 'oracle returns zero' }
        }

        if (wrongDecimalsForNoOracleCase) {
          return { status: 'failed', message: 'no oracles case: decimals of tokens are not equal' }
        }

        const maxRatio = externalRatio > contractsRatio ? externalRatio : contractsRatio
        const minRatio = externalRatio > contractsRatio ? contractsRatio : externalRatio
        const ratioDiff = maxRatio - minRatio

        if (minRatio === 0n || (ratioDiff * precision) / maxRatio > precision / 100n) {
          return {
            status: 'failed',
            message: `Price1/Price2 from contracts ${contractsRatio.toString()} is NOT close to external source ${externalRatio.toString()}`
          }
        }

        return {
          status: 'success',
          message: `Price1/Price2 from contracts ${contractsRatio.toString()} is close to external source ${externalRatio.toString()}`
        }
      }
    }
  ]
}

export default factory
