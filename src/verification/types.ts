import type { ethers } from 'ethers'
import type { WizardData } from '@/contexts/WizardContext'

export type VerificationStatus = 'pending' | 'running' | 'success' | 'failed' | 'warning'

export interface VerificationResult {
  status: Exclude<VerificationStatus, 'pending' | 'running'>
  message: string
  checkName?: string
}

export interface VerificationCheck {
  id: string
  checkName: string
  sourceFile: string
  order: number
  requiresFork?: boolean
  requiresTransaction?: boolean
  run: () => Promise<VerificationResult>
}

export interface VerificationCheckFactory {
  id: string
  build: (context: VerificationContext) => VerificationCheck[]
}

export interface SiloConfigData {
  daoFee: bigint
  deployerFee: bigint
  silo: string
  token: string
  protectedShareToken: string
  collateralShareToken: string
  debtShareToken: string
  solvencyOracle: string
  maxLtvOracle: string
  interestRateModel: string
  maxLtv: bigint
  lt: bigint
  liquidationTargetLtv: bigint
  liquidationFee: bigint
  flashloanFee: bigint
  hookReceiver: string
}

export interface VerificationContext {
  provider: ethers.Provider
  chainId: string
  chainAlias: string
  siloConfigAddress: string
  silo0: string
  silo1: string
  config0: SiloConfigData
  config1: SiloConfigData
  externalPrice0: bigint
  externalPrice1: bigint
  wizardData?: WizardData
}
