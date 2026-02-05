import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'
import { fetchSiloImplementations } from '../repo'

const factory: VerificationCheckFactory = {
  id: 'CheckSiloImplementation',
  build: (context) => {
    const checks = [
      { config: context.config0, siloName: 'silo0', suffix: 'silo0' },
      { config: context.config1, siloName: 'silo1', suffix: 'silo1' }
    ]

    return checks.map(({ config, siloName, suffix }, index) => {
      const baseOffset = index === 0 ? 0 : 200
      return {
        id: `CheckSiloImplementation:${suffix}`,
        order: baseOffset + 120,
        checkName: `${siloName} Silo implementation is known`,
        sourceFile: '',
        run: async () => {
          const bytecode = await context.provider.getCode(config.silo)
          const bytes = ethers.getBytes(bytecode)
          if (bytes.length !== 45) {
            return { status: 'failed', message: 'Silo implementation is NOT our deployment' }
          }

          const implBytes = bytes.slice(10, 30)
          const impl = ethers.getAddress(ethers.hexlify(implBytes))
          const implementations = await fetchSiloImplementations(context.chainAlias)
          const found = implementations.some((addr) => ethers.getAddress(addr) === impl)

          return found
            ? { status: 'success', message: 'Silo implementation is our deployment' }
            : { status: 'failed', message: 'Silo implementation is NOT our deployment' }
        }
      }
    })
  }
}

export default factory
