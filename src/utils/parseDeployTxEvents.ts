import { ethers } from 'ethers'
import deployerArtifact from '@/abis/silo/ISiloDeployer.json'
import factoryArtifact from '@/abis/silo/ISiloFactory.json'

type FoundryArtifact = { abi: ethers.InterfaceAbi }
const deployerAbi = (deployerArtifact as FoundryArtifact).abi
const factoryAbi = (factoryArtifact as FoundryArtifact).abi

const deployerInterface = new ethers.Interface(deployerAbi as ethers.InterfaceAbi)
const factoryInterface = new ethers.Interface(factoryAbi as ethers.InterfaceAbi)

export interface DeployTxParsed {
  siloConfig: string | null
  silo0: string | null
  silo1: string | null
  token0: string | null
  token1: string | null
  implementation: string | null
  shareTokens0: { protectedShareToken: string; collateralShareToken: string; debtShareToken: string } | null
  shareTokens1: { protectedShareToken: string; collateralShareToken: string; debtShareToken: string } | null
  hook0: string | null
  hook1: string | null
}

export function parseDeployTxReceipt(receipt: ethers.TransactionReceipt): DeployTxParsed {
  const result: DeployTxParsed = {
    siloConfig: null,
    silo0: null,
    silo1: null,
    token0: null,
    token1: null,
    implementation: null,
    shareTokens0: null,
    shareTokens1: null,
    hook0: null,
    hook1: null
  }

  let shareTokenIndex = 0
  let hookIndex = 0

  for (const log of receipt.logs) {
    try {
      const parsedDeployer = deployerInterface.parseLog({ topics: log.topics as string[], data: log.data })
      if (parsedDeployer?.name === 'SiloCreated') {
        result.siloConfig = parsedDeployer.args[0] as string
        continue
      }
    } catch {
      // not deployer event
    }

    try {
      const parsed = factoryInterface.parseLog({ topics: log.topics as string[], data: log.data })
      if (!parsed) continue

      if (parsed.name === 'NewSilo') {
        result.implementation = parsed.args[0] as string
        result.token0 = parsed.args[1] as string
        result.token1 = parsed.args[2] as string
        result.silo0 = parsed.args[3] as string
        result.silo1 = parsed.args[4] as string
        if (!result.siloConfig) result.siloConfig = parsed.args[5] as string
      } else if (parsed.name === 'NewSiloShareTokens') {
        const entry = {
          protectedShareToken: parsed.args[0] as string,
          collateralShareToken: parsed.args[1] as string,
          debtShareToken: parsed.args[2] as string
        }
        if (shareTokenIndex === 0) result.shareTokens0 = entry
        else result.shareTokens1 = entry
        shareTokenIndex++
      } else if (parsed.name === 'NewSiloHook') {
        const silo = parsed.args[0] as string
        const hook = parsed.args[1] as string
        if (hookIndex === 0) result.hook0 = hook
        else result.hook1 = hook
        hookIndex++
      }
    } catch {
      // skip unparseable logs
    }
  }

  return result
}
