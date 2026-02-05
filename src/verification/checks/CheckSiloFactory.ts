import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { fetchSiloCoreDeploymentAddress } from '../repo'
import { siloAbi, siloFactoryAbi } from '../abis'
import { toAddress } from '../utils'

const SILO_FACTORY_NAME = 'SiloFactory.sol'

const factory: VerificationCheckFactory = {
  id: 'CheckSiloFactory',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckSiloFactory:${suffix}`,
        order: baseOffset + 10,
        checkName: `${siloName} expect factory to be 0x0000000000000000000000000000000000000000`,
        sourceFile: '',
        run: async () => {
          const deployedFactory =
            (await fetchSiloCoreDeploymentAddress(context.chainAlias, SILO_FACTORY_NAME)) ?? ethers.ZeroAddress
          const siloContract = new ethers.Contract(config.silo, siloAbi, context.provider)
          const siloFactory = (await siloContract.factory()) as string
          const checkName = `${siloName} expect factory to be ${toAddress(deployedFactory)}`

          if (toAddress(siloFactory) !== toAddress(deployedFactory)) {
            return {
              status: 'failed',
              message: `${toAddress(siloFactory)} DOES NOT match SiloFactory address or factory does not have the silo`,
              checkName
            }
          }

          const factoryContract = new ethers.Contract(siloFactory, siloFactoryAbi, context.provider)
          const isSilo = (await factoryContract.isSilo(config.silo)) as boolean
          return isSilo
            ? { status: 'success', message: 'factory() match SiloFactory address', checkName }
            : {
                status: 'failed',
                message: `${toAddress(siloFactory)} DOES NOT match SiloFactory address or factory does not have the silo`,
                checkName
              }
        }
      }
    })
  }
}

export default factory
