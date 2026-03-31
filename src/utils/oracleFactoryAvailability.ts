import { ethers } from 'ethers'
import { getChainName } from '@/utils/networks'

export type OracleFactoryType = 'scaler' | 'chainlink' | 'ptLinear' | 'vault' | 'customMethod' | 'supraSValue'

interface FactoryDescriptor {
  contractName: string
  fileName: string
}

const FACTORY_DESCRIPTORS: Record<OracleFactoryType, FactoryDescriptor> = {
  scaler: {
    contractName: 'OracleScalerFactory',
    fileName: 'OracleScalerFactory.sol.json',
  },
  chainlink: {
    contractName: 'ChainlinkV3OracleFactory',
    fileName: 'ChainlinkV3OracleFactory.sol.json',
  },
  ptLinear: {
    contractName: 'PTLinearOracleFactory',
    fileName: 'PTLinearOracleFactory.sol.json',
  },
  vault: {
    contractName: 'ERC4626OracleHardcodeQuoteFactory',
    fileName: 'ERC4626OracleHardcodeQuoteFactory.sol.json',
  },
  customMethod: {
    contractName: 'CustomMethodOracleFactory',
    fileName: 'CustomMethodOracleFactory.sol.json',
  },
  supraSValue: {
    contractName: 'SupraSValueOracleFactory',
    fileName: 'SupraSValueOracleFactory.sol.json',
  },
}

const FACTORY_FETCH_CACHE = new Map<string, Promise<string | null>>()

function chainIdToString(chainId: string | number): string {
  return typeof chainId === 'string' ? chainId : String(chainId)
}

function buildFactoryUrl(chainName: string, factoryType: OracleFactoryType): string {
  const descriptor = FACTORY_DESCRIPTORS[factoryType]
  return `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/${descriptor.fileName}`
}

export function getOracleFactoryContractName(factoryType: OracleFactoryType): string {
  return FACTORY_DESCRIPTORS[factoryType].contractName
}

export function getOracleFactoryMissingMessage(factoryType: OracleFactoryType, chainId: string | number): string {
  const chainName = getChainName(chainIdToString(chainId))
  return `${getOracleFactoryContractName(factoryType)} is not available on ${chainName}.`
}

export async function fetchOracleFactoryAddress(
  chainId: string | number,
  factoryType: OracleFactoryType
): Promise<string | null> {
  const chainName = getChainName(chainIdToString(chainId))
  const cacheKey = `${chainName}:${factoryType}`
  const cached = FACTORY_FETCH_CACHE.get(cacheKey)
  if (cached) return cached

  const pending = (async () => {
    try {
      const response = await fetch(buildFactoryUrl(chainName, factoryType))
      if (!response.ok) return null
      const data = await response.json()
      const address = data?.address
      if (!address || !ethers.isAddress(address)) return null
      return ethers.getAddress(address)
    } catch {
      return null
    }
  })()

  FACTORY_FETCH_CACHE.set(cacheKey, pending)
  return pending
}

export async function fetchOracleFactoryAvailability(
  chainId: string | number,
  factoryTypes: OracleFactoryType[]
): Promise<Record<OracleFactoryType, boolean>> {
  const result: Record<OracleFactoryType, boolean> = {
    scaler: false,
    chainlink: false,
    ptLinear: false,
    vault: false,
    customMethod: false,
    supraSValue: false,
  }

  await Promise.all(
    factoryTypes.map(async (type) => {
      const address = await fetchOracleFactoryAddress(chainId, type)
      result[type] = !!address
    })
  )

  return result
}
