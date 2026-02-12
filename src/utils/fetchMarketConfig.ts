import { ethers } from 'ethers'
import siloConfigAbi from '@/abis/silo/ISiloConfig.json'
import dynamicKinkModelAbi from '@/abis/silo/IDynamicKinkModelConfig.json'
import chainlinkV3OracleAbi from '@/abis/oracle/IChainlinkV3Oracle.json'
import oracleScalerAbi from '@/abis/oracle/OracleScaler.json'
import siloOracleAbi from '@/abis/oracle/ISiloOracle.json'
import erc20Abi from '@/abis/IERC20.json'
import siloLensAbi from '@/abis/silo/ISiloLens.json'
import { ADDRESSES_JSON_BASE, getChainNameForAddresses } from '@/utils/symbolToAddress'
import { getChainName } from '@/utils/networks'

async function fetchSiloLensAddress(chainName: string): Promise<string | null> {
  const lensContractName = 'SiloLens.sol'
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${lensContractName}.json`
    )
    if (response.ok) {
      const data = await response.json()
      const address = data.address || ''
      if (address && ethers.isAddress(address)) return address
    }
  } catch {
    // ignore
  }
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/_deployments.json`
    )
    if (response.ok) {
      const data = await response.json()
      if (typeof data === 'object' && data !== null) {
        let address = data[lensContractName] || data['SiloLens'] || data.SiloLens || ''
        if (!address || !ethers.isAddress(address)) {
          for (const key in data) {
            if (key.includes('SiloLens') && typeof data[key] === 'string' && ethers.isAddress(data[key])) {
              address = data[key]
              break
            }
            if (typeof data[key] === 'object' && data[key]?.address && ethers.isAddress(data[key].address)) {
              address = data[key].address
              break
            }
          }
        }
        if (address && ethers.isAddress(address)) return address
      }
    }
  } catch {
    // ignore
  }
  return null
}

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
  hookReceiverVersion?: string
  hookReceiverOwner?: string
  hookReceiverOwnerIsContract?: boolean
  hookReceiverOwnerName?: string
  callBeforeQuote: boolean
}

export interface OracleInfo {
  address: string
  type?: string
  config?: Record<string, unknown>
  version?: string
  /** quote(1 base token, baseToken) result as raw string (display as 18 decimals) */
  quotePrice?: string
  /** Symbol of the token in which quote price is denominated (when available, e.g. from QUOTE_TOKEN) */
  quoteTokenSymbol?: string
}

export interface IRMInfo {
  address: string
  type?: string
  config?: Record<string, unknown>
  version?: string
  /** Set only for DynamicKinkModel (kink) when contract has owner() */
  owner?: string
  ownerIsContract?: boolean
  ownerName?: string
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

  // Fetch versions for oracles and IRMs via SiloLens (bulk: one getVersion per unique address)
  const chainId = (await provider.getNetwork()).chainId.toString()
  const chainName = getChainName(chainId)
  const siloLensAddress = await fetchSiloLensAddress(chainName)
  if (siloLensAddress) {
    const uniqueAddresses = new Set<string>()
    for (const c of [config0, config1]) {
      if (c.solvencyOracle.address && c.solvencyOracle.address !== ethers.ZeroAddress) uniqueAddresses.add(c.solvencyOracle.address.toLowerCase())
      if (c.maxLtvOracle.address && c.maxLtvOracle.address !== ethers.ZeroAddress) uniqueAddresses.add(c.maxLtvOracle.address.toLowerCase())
      if (c.interestRateModel.address && c.interestRateModel.address !== ethers.ZeroAddress) uniqueAddresses.add(c.interestRateModel.address.toLowerCase())
      if (c.hookReceiver && c.hookReceiver !== ethers.ZeroAddress) uniqueAddresses.add(c.hookReceiver.toLowerCase())
    }
    const lensContract = new ethers.Contract(siloLensAddress, siloLensAbi.abi as ethers.InterfaceAbi, provider)
    const addresses = Array.from(uniqueAddresses)
    const versions = await Promise.all(addresses.map(addr => lensContract.getVersion(addr)))
    const versionByAddress = new Map<string, string>()
    addresses.forEach((addr, i) => versionByAddress.set(addr, String(versions[i] ?? '')))
    const getVersion = (address: string) => versionByAddress.get(address.toLowerCase()) ?? undefined
    config0.solvencyOracle.version = getVersion(config0.solvencyOracle.address)
    config0.maxLtvOracle.version = getVersion(config0.maxLtvOracle.address)
    config0.interestRateModel.version = getVersion(config0.interestRateModel.address)
    config0.hookReceiverVersion = getVersion(config0.hookReceiver)
    config1.solvencyOracle.version = getVersion(config1.solvencyOracle.address)
    config1.maxLtvOracle.version = getVersion(config1.maxLtvOracle.address)
    config1.interestRateModel.version = getVersion(config1.interestRateModel.address)
    config1.hookReceiverVersion = getVersion(config1.hookReceiver)
  }

  // Fetch hook owners (deduplicate: same hook address can be used in both silos)
  const ownerAbi = [
    { type: 'function' as const, name: 'owner', inputs: [], outputs: [{ name: '', type: 'address', internalType: 'address' }], stateMutability: 'view' as const }
  ]
  const uniqueHooks = new Set<string>()
  for (const c of [config0, config1]) {
    if (c.hookReceiver && c.hookReceiver !== ethers.ZeroAddress) uniqueHooks.add(c.hookReceiver.toLowerCase())
  }
  const hookOwnerByAddress = new Map<string, string>()
  await Promise.all(Array.from(uniqueHooks).map(async (addr) => {
    try {
      const contract = new ethers.Contract(addr, ownerAbi as ethers.InterfaceAbi, provider)
      const owner = await contract.owner()
      if (owner && owner !== ethers.ZeroAddress) hookOwnerByAddress.set(addr, typeof owner === 'string' ? owner : owner.toString())
    } catch {
      // hook may not implement Ownable
    }
  }))
  const getHookOwner = (address: string) => address ? hookOwnerByAddress.get(address.toLowerCase()) : undefined
  config0.hookReceiverOwner = getHookOwner(config0.hookReceiver)
  config1.hookReceiverOwner = getHookOwner(config1.hookReceiver)

  // IRM owner only for kink models, determined by version (no try/catch, no extra RPC unless we know it's kink)
  const isKinkByVersion = (v: string | undefined) => v != null && v !== '' && v.toLowerCase().includes('kink')
  const uniqueKinkIrms = new Set<string>()
  for (const c of [config0, config1]) {
    if (c.interestRateModel.address && c.interestRateModel.address !== ethers.ZeroAddress && isKinkByVersion(c.interestRateModel.version)) {
      uniqueKinkIrms.add(c.interestRateModel.address.toLowerCase())
    }
  }
  const irmOwnerByAddress = new Map<string, string>()
  await Promise.all(Array.from(uniqueKinkIrms).map(async (addr) => {
    const contract = new ethers.Contract(addr, ownerAbi as ethers.InterfaceAbi, provider)
    const owner = await contract.owner()
    if (owner && owner !== ethers.ZeroAddress) irmOwnerByAddress.set(addr, typeof owner === 'string' ? owner : owner.toString())
  }))
  const getIrmOwner = (address: string, version: string | undefined) =>
    address && isKinkByVersion(version) ? irmOwnerByAddress.get(address.toLowerCase()) : undefined
  config0.interestRateModel.owner = getIrmOwner(config0.interestRateModel.address, config0.interestRateModel.version)
  config1.interestRateModel.owner = getIrmOwner(config1.interestRateModel.address, config1.interestRateModel.version)

  // Owner meta: isContract (getCode) + name from addresses JSON (per chain).
  // Deduplicate by owner address so we only fetch once when hook and IRM share the same owner.
  const allOwnerAddresses = new Set<string>()
  for (const owner of [
    config0.hookReceiverOwner,
    config1.hookReceiverOwner,
    config0.interestRateModel.owner,
    config1.interestRateModel.owner
  ]) {
    if (owner && owner !== ethers.ZeroAddress) allOwnerAddresses.add(owner.toLowerCase())
  }
  const addressToName = new Map<string, string>()
  try {
    const chainNameForAddresses = getChainNameForAddresses(chainId)
    const res = await fetch(`${ADDRESSES_JSON_BASE}/${chainNameForAddresses}.json`)
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>
      for (const [name, addr] of Object.entries(data)) {
        if (typeof addr === 'string' && addr.startsWith('0x')) addressToName.set(addr.toLowerCase(), name)
      }
    }
  } catch {
    // ignore
  }
  const ownerMetaByAddress = new Map<string, { isContract: boolean; name?: string }>()
  await Promise.all(Array.from(allOwnerAddresses).map(async (addr) => {
    const code = await provider.getCode(addr)
    const isContract = code !== '0x' && code !== '0x0'
    const name = addressToName.get(addr)
    ownerMetaByAddress.set(addr, { isContract, name })
  }))
  const getOwnerMeta = (address: string) => address ? ownerMetaByAddress.get(address.toLowerCase()) : undefined
  const m0 = getOwnerMeta(config0.hookReceiverOwner ?? '')
  if (m0) {
    config0.hookReceiverOwnerIsContract = m0.isContract
    config0.hookReceiverOwnerName = m0.name
  }
  const m1 = getOwnerMeta(config1.hookReceiverOwner ?? '')
  if (m1) {
    config1.hookReceiverOwnerIsContract = m1.isContract
    config1.hookReceiverOwnerName = m1.name
  }
  const irm0 = getOwnerMeta(config0.interestRateModel.owner ?? '')
  if (irm0) {
    config0.interestRateModel.ownerIsContract = irm0.isContract
    config0.interestRateModel.ownerName = irm0.name
  }
  const irm1 = getOwnerMeta(config1.interestRateModel.owner ?? '')
  if (irm1) {
    config1.interestRateModel.ownerIsContract = irm1.isContract
    config1.interestRateModel.ownerName = irm1.name
  }

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

  // ISiloOracle.quote(_baseAmount, _baseToken) - fetch price for 1 token
  const decimals = tokenMeta.decimals ?? 18
  const oneBaseAmount = BigInt(10 ** decimals)
  const quoteAbi = [
    {
      type: 'function',
      name: 'quote',
      inputs: [
        { name: '_baseAmount', type: 'uint256', internalType: 'uint256' },
        { name: '_baseToken', type: 'address', internalType: 'address' }
      ],
      outputs: [{ name: 'quoteAmount', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view'
    }
  ] as const
  const fetchQuote = async (oracleAddress: string): Promise<string | undefined> => {
    if (!oracleAddress || oracleAddress === ethers.ZeroAddress) return undefined
    try {
      const oracle = new ethers.Contract(oracleAddress, quoteAbi as ethers.InterfaceAbi, provider)
      const quoteAmount = await oracle.quote(oneBaseAmount, config.token)
      return quoteAmount != null ? String(quoteAmount) : undefined
    } catch {
      return undefined
    }
  }
  const [solvencyQuote, maxLtvQuote] = await Promise.all([
    fetchQuote(config.solvencyOracle),
    config.maxLtvOracle && config.maxLtvOracle !== ethers.ZeroAddress && config.maxLtvOracle.toLowerCase() !== config.solvencyOracle?.toLowerCase()
      ? fetchQuote(config.maxLtvOracle)
      : Promise.resolve(undefined)
  ])
  if (solvencyQuote != null) solvencyOracle.quotePrice = solvencyQuote
  if (maxLtvQuote != null) maxLtvOracle.quotePrice = maxLtvQuote

  // Every oracle implements ISiloOracle.quoteToken() – fetch quote token address and resolve symbol
  const oracleAddresses = [
    solvencyOracle.address,
    maxLtvOracle.address && maxLtvOracle.address !== ethers.ZeroAddress && maxLtvOracle.address.toLowerCase() !== solvencyOracle.address?.toLowerCase()
      ? maxLtvOracle.address
      : null
  ].filter((a): a is string => !!a && a !== ethers.ZeroAddress)
  const quoteTokenByOracle = new Map<string, string>()
  await Promise.all(Array.from(new Set(oracleAddresses)).map(async (oracleAddr) => {
    try {
      const oracleContract = new ethers.Contract(oracleAddr, siloOracleAbi.abi as ethers.InterfaceAbi, provider)
      const qt = await oracleContract.quoteToken()
      const addr = typeof qt === 'string' ? qt : qt?.toString?.() ?? ''
      if (addr && addr !== ethers.ZeroAddress) quoteTokenByOracle.set(oracleAddr.toLowerCase(), addr.toLowerCase())
    } catch {
      // ignore
    }
  }))
  const quoteTokenAddresses = new Set(quoteTokenByOracle.values())
  const quoteSymbolByAddress = new Map<string, string>()
  await Promise.all(Array.from(quoteTokenAddresses).map(async (addr) => {
    try {
      const contract = new ethers.Contract(addr, erc20Abi.abi as ethers.InterfaceAbi, provider)
      const sym = await contract.symbol()
      quoteSymbolByAddress.set(addr, typeof sym === 'string' ? sym : String(sym))
    } catch {
      // ignore
    }
  }))
  for (const oracle of [solvencyOracle, maxLtvOracle]) {
    const addr = oracle.address?.toLowerCase()
    if (!addr) continue
    const qtAddr = quoteTokenByOracle.get(addr)
    if (qtAddr) {
      const sym = quoteSymbolByAddress.get(qtAddr)
      if (sym) oracle.quoteTokenSymbol = sym
    }
  }

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

  if (!info.type) {
    // Try PT-Linear Oracle (has baseDiscountPerYear)
    const ptLinearAbi = [
      { type: 'function' as const, name: 'baseDiscountPerYear', inputs: [], outputs: [{ type: 'uint256', internalType: 'uint256' }], stateMutability: 'view' as const }
    ]
    try {
      const ptContract = new ethers.Contract(oracleAddress, ptLinearAbi as ethers.InterfaceAbi, provider)
      const baseDiscountPerYear = await ptContract.baseDiscountPerYear()
      info.type = 'PTLinear'
      info.config = { baseDiscountPerYear: baseDiscountPerYear.toString() }
    } catch {
      // Not PT-Linear
    }
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

/** Format raw quote amount as string with 18 decimal places */
export function formatQuotePriceAs18Decimals(quotePriceRaw: string): string {
  const v = BigInt(quotePriceRaw)
  const div = BigInt(10 ** 18)
  const intPart = v / div
  const fracPart = (v % div).toString().padStart(18, '0').replace(/0+$/, '') || '0'
  return fracPart ? `${intPart}.${fracPart}` : String(intPart)
}

/** Format raw 18-decimal rate (1e18 = 100%) as percentage with exactly 18 decimal places */
export function formatRate18AsPercent(raw: string): string {
  const v = BigInt(raw)
  const e18 = BigInt(10 ** 18)
  const scaled = v * BigInt(100)
  const intPart = scaled / e18
  const fracPart = (scaled % e18).toString().padStart(18, '0')
  const decimalStr = `${intPart}.${fracPart}`
  return `${decimalStr} %`
}
