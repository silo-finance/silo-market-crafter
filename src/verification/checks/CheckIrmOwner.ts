import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { fetchAddresses } from '../repo'
import { ownableAbi } from '../abis'
import { isZeroAddress, toAddress } from '../utils'

const factory: VerificationCheckFactory = {
  id: 'CheckIrmOwner',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckIrmOwner:${suffix}`,
        order: baseOffset + 70,
        checkName: `${siloName} IRM owner should be a DAO`,
        sourceFile: '',
        run: async () => {
          const addresses = await fetchAddresses(context.chainId)
          const daoAddress = toAddress(addresses.DAO || '')

          const irm = new ethers.Contract(config.interestRateModel, ownableAbi, context.provider)
          try {
            const owner = (await irm.owner()) as string
            const normalizedOwner = toAddress(owner)
            const result = !isZeroAddress(normalizedOwner) && normalizedOwner === daoAddress
            return result
              ? { status: 'success', message: `owner is a DAO ${normalizedOwner}` }
              : { status: 'failed', message: `owner is NOT a DAO ${normalizedOwner}` }
          } catch {
            return { status: 'success', message: 'IRM is NOT ownable, N/A' }
          }
        }
      }
    })
  }
}

export default factory
