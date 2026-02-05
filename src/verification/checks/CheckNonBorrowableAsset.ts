import type { VerificationCheckFactory } from '../types'
import { isTokenERC4626, isTokenLPT, isTokenPT } from './helpers'

const factory: VerificationCheckFactory = {
  id: 'CheckNonBorrowableAsset',
  build: (context) => [
    {
      id: 'CheckNonBorrowableAsset',
      order: 400,
      checkName: 'token0 is LPT/PT/ERC4626 -> token0 is non-borrowable',
      sourceFile: '',
      run: async () => {
        let token0Type = 'regular asset'
        let assetIsRegular = true

        if (await isTokenERC4626(context.provider, context.config0.token)) {
          token0Type = 'ERC4626'
          assetIsRegular = false
        } else if (await isTokenPT(context.provider, context.config0.token)) {
          token0Type = 'PT'
          assetIsRegular = false
        } else if (await isTokenLPT(context.provider, context.config0.token)) {
          token0Type = 'LPT'
          assetIsRegular = false
        }

        if (assetIsRegular) {
          return { status: 'success', message: `property holds for ${token0Type}` }
        }

        const result = context.config1.maxLtv === 0n && context.config1.lt === 0n
        return result
          ? { status: 'success', message: `property holds for ${token0Type}` }
          : { status: 'failed', message: `property DOES NOT hold for ${token0Type}` }
      }
    }
  ]
}

export default factory
