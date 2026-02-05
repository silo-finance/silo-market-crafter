import { ethers } from 'ethers'
import siloConfigAbi from '@/abis/silo/ISiloConfig.json'
import dynamicKinkModelAbi from '@/abis/silo/IDynamicKinkModelConfig.json'
import chainlinkV3OracleAbi from '@/abis/oracle/IChainlinkV3Oracle.json'
import oracleScalerAbi from '@/abis/oracle/OracleScaler.json'
import erc20Abi from '@/abis/IERC20.json'

const BP2DP_NORMALIZATION = BigInt(10 ** 14) // basis points to 18 decimals

export interface MarketConfig {
  siloConfig: string
  siloId: bigint | null
  silo0: SiloConfig
  silo1: SiloConfig
}

export interface TokenMeta {
  symbol?: string
  decimals?: number
}

export interface SiloConfig {
  silo: string
  token: string
  tokenSymbol?: string
  tokenDecimals?: number
  protectedShareToken: string
  protectedShareTokenSymbol?: string
  protectedShareTokenDecimals?: number
  collateralShareToken: string
  collateralShareTokenSymbol?: string
  collateralShareTokenDecimals?: number
  debtShareToken: string
  debtShareTokenSymbol?: string
  debtShareTokenDecimals?: number
  solvencyOracle: OracleInfo
  maxLtvOracle: OracleInfo
  interestRateModel: IRMInfo
  maxLtv: bigint
  lt: bigint
  liquidationTargetLtv: bigint
  liquidationFee: bigint
  flashloanFee: bigint
  daoFee: bigint
  deployerFee: bigint
  hookReceiver: string
  callBeforeQuote: boolean
}

export interface OracleInfo {
  address: string
  type?: string
  config?: Record<string, unknown>
}

export interface IRMInfo {
  address: string
  type?: string
  config?: Record<string, unknown>
}

export async function fetchMarketConfig(
  provider: ethers.Provider,
  siloConfigAddress: string
): Promise<MarketConfig> {
  const siloConfigContract = new ethers.Contract(
    siloConfigAddress,
    siloConfigAbi.abi as ethers.InterfaceAbi,
    provider
  )

  // Get silo ID
  let siloId: bigint | null = null
  try {
    siloId = await siloConfigContract.SILO_ID()
  } catch {
    // SILO_ID might not exist in older versions
  }

  // Get silos
  const [silo0Address, silo1Address] = await siloConfigContract.getSilos()

  // Get configs for both silos
  const [config0, config1] = await Promise.all([
    fetchSiloConfig(provider, siloConfigContract, silo0Address),
    fetchSiloConfig(provider, siloConfigContract, silo1Address)
  ])

  return {
    siloConfig: siloConfigAddress,
    siloId,
    silo0: config0,
    silo1: config1
  }
}

async function fetchSiloConfig(
  provider: ethers.Provider,
  siloConfigContract: ethers.Contract,
  siloAddress: string
): Promise<SiloConfig> {
  const config = await siloConfigContract.getConfig(siloAddress)

  // Fetch oracle info
  const solvencyOracle = await fetchOracleInfo(provider, config.solvencyOracle)
  const maxLtvOracle = await fetchOracleInfo(provider, config.maxLtvOracle)

  // Fetch IRM info
  const interestRateModel = await fetchIRMInfo(provider, config.interestRateModel)

  // Fetch symbol and decimals for token and share tokens (ERC20)
  const fetchSymbolDecimals = async (address: string): Promise<{ symbol?: string; decimals?: number }> => {
    if (!address || address === ethers.ZeroAddress) return {}
    try {
      const contract = new ethers.Contract(address, erc20Abi.abi as ethers.InterfaceAbi, provider)
      const [sym, dec] = await Promise.all([contract.symbol(), contract.decimals()])
      return {
        symbol: typeof sym === 'string' ? sym : String(sym),
        decimals: typeof dec === 'number' ? dec : Number(dec)
      }
    } catch {
      return {}
    }
  }

  const [tokenMeta, protectedMeta, collateralMeta, debtMeta] = await Promise.all([
    fetchSymbolDecimals(config.token),
    fetchSymbolDecimals(config.protectedShareToken),
    fetchSymbolDecimals(config.collateralShareToken),
    fetchSymbolDecimals(config.debtShareToken)
  ])

  return {
    silo: siloAddress,
    token: config.token,
    tokenSymbol: tokenMeta.symbol,
    tokenDecimals: tokenMeta.decimals,
    protectedShareToken: config.protectedShareToken,
    protectedShareTokenSymbol: protectedMeta.symbol,
    protectedShareTokenDecimals: protectedMeta.decimals,
    collateralShareToken: config.collateralShareToken,
    collateralShareTokenSymbol: collateralMeta.symbol,
    collateralShareTokenDecimals: collateralMeta.decimals,
    debtShareToken: config.debtShareToken,
    debtShareTokenSymbol: debtMeta.symbol,
    debtShareTokenDecimals: debtMeta.decimals,
    solvencyOracle,
    maxLtvOracle,
    interestRateModel,
    maxLtv: config.maxLtv,
    lt: config.lt,
    liquidationTargetLtv: config.liquidationTargetLtv,
    liquidationFee: config.liquidationFee,
    flashloanFee: config.flashloanFee,
    daoFee: config.daoFee,
    deployerFee: config.deployerFee,
    hookReceiver: config.hookReceiver,
    callBeforeQuote: config.callBeforeQuote
  }
}

async function fetchOracleInfo(
  provider: ethers.Provider,
  oracleAddress: string
): Promise<OracleInfo> {
  if (!oracleAddress || oracleAddress === ethers.ZeroAddress) {
    return { address: oracleAddress }
  }

  const info: OracleInfo = { address: oracleAddress }

  try {
    // Try Chainlink V3 Oracle
    const chainlinkContract = new ethers.Contract(
      oracleAddress,
      chainlinkV3OracleAbi.abi as ethers.InterfaceAbi,
      provider
    )
    try {
      const configAddress = await chainlinkContract.config()
      info.type = 'ChainlinkV3'
      info.config = { configAddress }
    } catch {
      // Not Chainlink V3
    }
  } catch {
    // Not Chainlink V3
  }

  try {
    // Try Oracle Scaler
    const scalerContract = new ethers.Contract(
      oracleAddress,
      oracleScalerAbi.abi as ethers.InterfaceAbi,
      provider
    )
    try {
      const scaleFactor = await scalerContract.SCALE_FACTOR()
      const quoteToken = await scalerContract.QUOTE_TOKEN()
      info.type = 'OracleScaler'
      info.config = {
        scaleFactor: scaleFactor.toString(),
        quoteToken
      }
    } catch {
      // Not Oracle Scaler
    }
  } catch {
    // Not Oracle Scaler
  }

  return info
}

async function fetchIRMInfo(
  provider: ethers.Provider,
  irmAddress: string
): Promise<IRMInfo> {
  if (!irmAddress || irmAddress === ethers.ZeroAddress) {
    return { address: irmAddress }
  }

  const info: IRMInfo = { address: irmAddress }

  try {
    // Try Dynamic Kink Model
    const dynamicKinkContract = new ethers.Contract(
      irmAddress,
      dynamicKinkModelAbi.abi as ethers.InterfaceAbi,
      provider
    )
    try {
      const [config, immutableConfig] = await dynamicKinkContract.getConfig()
      info.type = 'DynamicKinkModel'
      info.config = {
        ulow: config.ulow.toString(),
        u1: config.u1.toString(),
        u2: config.u2.toString(),
        ucrit: config.ucrit.toString(),
        rmin: config.rmin.toString(),
        kmin: config.kmin.toString(),
        kmax: config.kmax.toString(),
        alpha: config.alpha.toString(),
        cminus: config.cminus.toString(),
        cplus: config.cplus.toString(),
        c1: config.c1.toString(),
        c2: config.c2.toString(),
        dmax: config.dmax.toString(),
        timelock: immutableConfig.timelock.toString(),
        rcompCapPerSecond: immutableConfig.rcompCapPerSecond.toString()
      }
    } catch {
      // Not Dynamic Kink Model
    }
  } catch {
    // Not Dynamic Kink Model or error fetching
  }

  return info
}

export function formatPercentage(value: bigint): string {
  // Convert from 18 decimals to percentage
  // Values are stored as: percentage * 100 * 10^14 = percentage * 10^16
  // So to get percentage back: divide by 10^16
  const percentage = Number(value) / Number(BigInt(10 ** 16))
  return `${percentage.toFixed(2)}%`
}

export function formatAddress(address: string): string {
  if (!address || address === ethers.ZeroAddress) return 'Zero Address'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
