import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { fetchAddresses } from '../repo'
import { ownableAbi } from '../abis'
import { isZeroAddress, toAddress } from '../utils'

const factory: VerificationCheckFactory = {
  id: 'CheckHookOwner',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckHookOwner:${suffix}`,
        order: baseOffset + 90,
        checkName: `${siloName} hook receiver owner is a DAO`,
        sourceFile: '',
        run: async () => {
          const addresses = await fetchAddresses(context.chainId)
          const daoAddress = toAddress(addresses.DAO || '')
          const hookReceiver = new ethers.Contract(config.hookReceiver, ownableAbi, context.provider)
          const realOwner = (await hookReceiver.owner()) as string
          const normalizedOwner = toAddress(realOwner)

          const result = !isZeroAddress(normalizedOwner) && normalizedOwner === daoAddress
          return result
            ? {
                status: 'success',
                message: `owner is a DAO ${daoAddress}`
              }
            : {
                status: 'failed',
                message: `owner is NOT a DAO ${normalizedOwner}`
              }
        }
      }
    })
  }
}

export default factory
