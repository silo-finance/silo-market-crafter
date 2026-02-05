import { ethers } from 'ethers'
import type { VerificationContext, SiloConfigData } from './types'
import { getChainAlias, toAddress } from './utils'
import siloConfigArtifact from '@/abis/silo/ISiloConfig.json'

type FoundryArtifact = { abi: ethers.InterfaceAbi }
const siloConfigAbi = (siloConfigArtifact as FoundryArtifact).abi

function normalizeConfigData(raw: Record<string, unknown>): SiloConfigData {
  return {
    daoFee: BigInt(raw.daoFee as bigint),
    deployerFee: BigInt(raw.deployerFee as bigint),
    silo: toAddress(raw.silo as string),
    token: toAddress(raw.token as string),
    protectedShareToken: toAddress(raw.protectedShareToken as string),
    collateralShareToken: toAddress(raw.collateralShareToken as string),
    debtShareToken: toAddress(raw.debtShareToken as string),
    solvencyOracle: toAddress(raw.solvencyOracle as string),
    maxLtvOracle: toAddress(raw.maxLtvOracle as string),
    interestRateModel: toAddress(raw.interestRateModel as string),
    maxLtv: BigInt(raw.maxLtv as bigint),
    lt: BigInt(raw.lt as bigint),
    liquidationTargetLtv: BigInt(raw.liquidationTargetLtv as bigint),
    liquidationFee: BigInt(raw.liquidationFee as bigint),
    flashloanFee: BigInt(raw.flashloanFee as bigint),
    hookReceiver: toAddress(raw.hookReceiver as string)
  }
}

export async function buildVerificationContext(params: {
  provider: ethers.Provider
  chainId: string
  siloConfigAddress: string
  externalPrice0: bigint
  externalPrice1: bigint
  wizardData?: VerificationContext['wizardData']
}): Promise<VerificationContext> {
  const { provider, chainId, siloConfigAddress, externalPrice0, externalPrice1, wizardData } = params
  const chainAlias = getChainAlias(chainId)

  const siloConfig = new ethers.Contract(siloConfigAddress, siloConfigAbi, provider)
  const [silo0, silo1] = (await siloConfig.getSilos()) as [string, string]
  const config0Raw = (await siloConfig.getConfig(silo0)) as Record<string, unknown>
  const config1Raw = (await siloConfig.getConfig(silo1)) as Record<string, unknown>

  return {
    provider,
    chainId,
    chainAlias,
    siloConfigAddress: ethers.getAddress(siloConfigAddress),
    silo0: ethers.getAddress(silo0),
    silo1: ethers.getAddress(silo1),
    config0: normalizeConfigData(config0Raw),
    config1: normalizeConfigData(config1Raw),
    externalPrice0,
    externalPrice1,
    wizardData
  }
}
