import { ethers } from 'ethers'
import siloConfigAbi from '@/abis/silo/ISiloConfig.json'
import dynamicKinkModelAbi from '@/abis/silo/DynamicKinkModel.json'
import chainlinkV3OracleAbi from '@/abis/oracle/IChainlinkV3Oracle.json'
import oracleScalerAbi from '@/abis/oracle/OracleScaler.json'
import siloOracleAbi from '@/abis/oracle/ISiloOracle.json'
import erc20Abi from '@/abis/IERC20.json'
import iShareTokenAbi from '@/abis/silo/IShareToken.json'
import { ADDRESSES_JSON_BASE, getChainNameForAddresses } from '@/utils/symbolToAddress'
import { getChainName } from '@/utils/networks'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'

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
  factory?: string
  token: string
  tokenSymbol?: string
  tokenDecimals?: number
  protectedShareToken: string
  protectedShareTokenSymbol?: string
  protectedShareTokenDecimals?: number
  protectedShareTokenOffset?: number
  collateralShareToken: string
  collateralShareTokenSymbol?: string
  collateralShareTokenDecimals?: number
  collateralShareTokenOffset?: number
  debtShareToken: string
  debtShareTokenSymbol?: string
  debtShareTokenDecimals?: number
  debtShareTokenOffset?: number
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
  /** Set only for ManageableOracle wrappers when contract has owner() */
  owner?: string
  ownerIsContract?: boolean
  ownerName?: string
  /** For ManageableOracle: underlying oracle address + version (from SiloLens) */
  underlying?: { address: string; version?: string }
  /** For ManageableOracle: timelock duration in seconds (from contract timelock()) */
  timelockSeconds?: number
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

  // Get silos – if this reverts, the address is likely not a Silo Config or contract state is invalid
  let silo0Address: string
  let silo1Address: string
  try {
    const silos = await siloConfigContract.getSilos()
    silo0Address = silos[0]
    silo1Address = silos[1]
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('CALL_EXCEPTION') || msg.includes('revert') || msg.includes('require(false)')) {
      throw new Error(
        'This address does not appear to be a valid Silo Config contract, or the contract reverted. ' +
          'Check that the address is a Silo Config on this network and that the contract is initialized.'
      )
    }
    throw err
  }

  // Get configs for both silos
  const [config0, config1] = await Promise.all([
    fetchSiloConfig(provider, siloConfigContract, silo0Address),
    fetchSiloConfig(provider, siloConfigContract, silo1Address)
  ])

  // Fetch versions for oracles and IRMs via SiloLens (bulk getVersions per unique address set)
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
    const addresses = Array.from(uniqueAddresses)
    const versionByAddress = await fetchSiloLensVersionsWithCache({
      provider,
      lensAddress: siloLensAddress,
      chainId,
      addresses
    })
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

  // Derive IRM type from version string when available (e.g. "DynamicKinkModel 1.2.3")
  const getIrmTypeFromVersion = (version: string | undefined): string | undefined => {
    if (!version) return undefined
    const [contractName] = version.split(' ')
    if (contractName === 'DynamicKinkModel') return 'DynamicKinkModel'
    return undefined
  }

  config0.interestRateModel.type = config0.interestRateModel.type ?? getIrmTypeFromVersion(config0.interestRateModel.version)
  config1.interestRateModel.type = config1.interestRateModel.type ?? getIrmTypeFromVersion(config1.interestRateModel.version)

  // After versions are known, fetch Dynamic Kink IRM configuration (config + immutables)
  const [irm0Details, irm1Details] = await Promise.all([
    fetchIRMInfo(provider, config0.interestRateModel.address, config0.interestRateModel.version),
    fetchIRMInfo(provider, config1.interestRateModel.address, config1.interestRateModel.version)
  ])
  if (irm0Details.type || irm0Details.config) {
    config0.interestRateModel.type = irm0Details.type ?? config0.interestRateModel.type
    config0.interestRateModel.config = irm0Details.config ?? config0.interestRateModel.config
  }
  if (irm1Details.type || irm1Details.config) {
    config1.interestRateModel.type = irm1Details.type ?? config1.interestRateModel.type
    config1.interestRateModel.config = irm1Details.config ?? config1.interestRateModel.config
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

  // Manageable oracle owner – determined by oracle version including "ManageableOracle"
  const isManageableOracleByVersion = (v: string | undefined) => v != null && v !== '' && v.toLowerCase().includes('manageableoracle')
  const uniqueManageableOracles = new Set<string>()
  for (const c of [config0, config1]) {
    if (c.solvencyOracle.address && c.solvencyOracle.address !== ethers.ZeroAddress && isManageableOracleByVersion(c.solvencyOracle.version)) {
      uniqueManageableOracles.add(c.solvencyOracle.address.toLowerCase())
    }
    if (c.maxLtvOracle.address && c.maxLtvOracle.address !== ethers.ZeroAddress && isManageableOracleByVersion(c.maxLtvOracle.version)) {
      uniqueManageableOracles.add(c.maxLtvOracle.address.toLowerCase())
    }
  }
  const manageableOracleAbi = [
    { type: 'function' as const, name: 'owner', inputs: [], outputs: [{ name: '', type: 'address', internalType: 'address' }], stateMutability: 'view' as const },
    { type: 'function' as const, name: 'oracle', inputs: [], outputs: [{ name: '', type: 'address', internalType: 'address' }], stateMutability: 'view' as const },
    { type: 'function' as const, name: 'timelock', inputs: [], outputs: [{ name: '', type: 'uint32', internalType: 'uint32' }], stateMutability: 'view' as const }
  ]
  const oracleOwnerByAddress = new Map<string, string>()
  const underlyingByManageable = new Map<string, string>()
  const timelockByManageable = new Map<string, number>()
  await Promise.all(Array.from(uniqueManageableOracles).map(async (addr) => {
    try {
      const contract = new ethers.Contract(addr, manageableOracleAbi as ethers.InterfaceAbi, provider)
      const owner = await contract.owner()
      if (owner && owner !== ethers.ZeroAddress) oracleOwnerByAddress.set(addr, typeof owner === 'string' ? owner : owner.toString())
      try {
        const underlying = await contract.oracle?.()
        if (underlying && underlying !== ethers.ZeroAddress) {
          const u = typeof underlying === 'string' ? underlying : underlying.toString()
          underlyingByManageable.set(addr, u)
        }
      } catch {
        // Some oracle variants may not expose oracle(); ignore gracefully.
      }
      try {
        const tl = await contract.timelock?.()
        if (tl != null) timelockByManageable.set(addr, Number(tl))
      } catch {
        // timelock() may not exist on some variants; ignore.
      }
    } catch {
      // Oracle may not implement ManageableOracle; ignore gracefully
    }
  }))
  const getOracleOwner = (address: string, version: string | undefined) =>
    address && isManageableOracleByVersion(version) ? oracleOwnerByAddress.get(address.toLowerCase()) : undefined
  const getOracleTimelock = (address: string, version: string | undefined) =>
    address && isManageableOracleByVersion(version) ? timelockByManageable.get(address.toLowerCase()) : undefined
  config0.solvencyOracle.owner = getOracleOwner(config0.solvencyOracle.address, config0.solvencyOracle.version)
  config0.solvencyOracle.timelockSeconds = getOracleTimelock(config0.solvencyOracle.address, config0.solvencyOracle.version)
  config1.solvencyOracle.owner = getOracleOwner(config1.solvencyOracle.address, config1.solvencyOracle.version)
  config1.solvencyOracle.timelockSeconds = getOracleTimelock(config1.solvencyOracle.address, config1.solvencyOracle.version)
  config0.maxLtvOracle.owner = getOracleOwner(config0.maxLtvOracle.address, config0.maxLtvOracle.version)
  config0.maxLtvOracle.timelockSeconds = getOracleTimelock(config0.maxLtvOracle.address, config0.maxLtvOracle.version)
  config1.maxLtvOracle.owner = getOracleOwner(config1.maxLtvOracle.address, config1.maxLtvOracle.version)
  config1.maxLtvOracle.timelockSeconds = getOracleTimelock(config1.maxLtvOracle.address, config1.maxLtvOracle.version)

  // Underlying oracle versions for ManageableOracle (when SiloLens is available)
  if (siloLensAddress && underlyingByManageable.size > 0) {
    const underlyingAddresses = Array.from(
      new Set(Array.from(underlyingByManageable.values()).map((a) => a.toLowerCase()))
    )
    if (underlyingAddresses.length > 0) {
      const versionByUnderlying = await fetchSiloLensVersionsWithCache({
        provider,
        lensAddress: siloLensAddress,
        chainId,
        addresses: underlyingAddresses
      })
      const getUnderlyingVersion = (address: string) =>
        versionByUnderlying.get(address.toLowerCase()) ?? undefined

      const setUnderlying = (oracle: OracleInfo) => {
        const key = oracle.address?.toLowerCase?.() ?? ''
        const underlyingAddr = underlyingByManageable.get(key)
        if (underlyingAddr) {
          oracle.underlying = {
            address: underlyingAddr,
            version: getUnderlyingVersion(underlyingAddr)
          }
        }
      }

      setUnderlying(config0.solvencyOracle)
      setUnderlying(config1.solvencyOracle)
      setUnderlying(config0.maxLtvOracle)
      setUnderlying(config1.maxLtvOracle)
    }
  }

  // Owner meta: isContract (getCode) + name from addresses JSON (per chain).
  // Deduplicate by owner address so we only fetch once when hook and IRM share the same owner.
  const allOwnerAddresses = new Set<string>()
  for (const owner of [
    config0.hookReceiverOwner,
    config1.hookReceiverOwner,
    config0.interestRateModel.owner,
    config1.interestRateModel.owner,
    config0.solvencyOracle.owner,
    config1.solvencyOracle.owner,
    config0.maxLtvOracle.owner,
    config1.maxLtvOracle.owner
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

  const oracle0Solvency = getOwnerMeta(config0.solvencyOracle.owner ?? '')
  if (oracle0Solvency) {
    config0.solvencyOracle.ownerIsContract = oracle0Solvency.isContract
    config0.solvencyOracle.ownerName = oracle0Solvency.name
  }
  const oracle1Solvency = getOwnerMeta(config1.solvencyOracle.owner ?? '')
  if (oracle1Solvency) {
    config1.solvencyOracle.ownerIsContract = oracle1Solvency.isContract
    config1.solvencyOracle.ownerName = oracle1Solvency.name
  }
  const oracle0MaxLtv = getOwnerMeta(config0.maxLtvOracle.owner ?? '')
  if (oracle0MaxLtv) {
    config0.maxLtvOracle.ownerIsContract = oracle0MaxLtv.isContract
    config0.maxLtvOracle.ownerName = oracle0MaxLtv.name
  }
  const oracle1MaxLtv = getOwnerMeta(config1.maxLtvOracle.owner ?? '')
  if (oracle1MaxLtv) {
    config1.maxLtvOracle.ownerIsContract = oracle1MaxLtv.isContract
    config1.maxLtvOracle.ownerName = oracle1MaxLtv.name
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
  let factoryAddress: string | undefined
  try {
    const siloContract = new ethers.Contract(
      siloAddress,
      [
        {
          type: 'function',
          name: 'factory',
          inputs: [],
          outputs: [{ name: '', type: 'address' }],
          stateMutability: 'view'
        }
      ] as const,
      provider
    )
    const factory = await siloContract.factory()
    if (factory && typeof factory === 'string' && factory !== ethers.ZeroAddress) {
      factoryAddress = factory
    }
  } catch {
    // Some silo variants may not expose factory(); keep undefined.
  }

  // Fetch oracle info
  const solvencyOracle = await fetchOracleInfo(provider, config.solvencyOracle)
  const maxLtvOracle = await fetchOracleInfo(provider, config.maxLtvOracle)

  // IRM: basic info (address only) - detailed DynamicKink config fetched later,
  // after global getVersions via SiloLens in fetchMarketConfig.
  const interestRateModel: IRMInfo = {
    address: config.interestRateModel
  }

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

  const fetchShareTokenOffset = async (address: string): Promise<number | undefined> => {
    if (!address || address === ethers.ZeroAddress) return undefined
    try {
      const contract = new ethers.Contract(address, iShareTokenAbi.abi as ethers.InterfaceAbi, provider)
      const offset = await contract.decimalsOffset()
      return typeof offset === 'number' ? offset : Number(offset)
    } catch {
      return undefined
    }
  }

  const [
    tokenMeta,
    protectedMeta,
    collateralMeta,
    debtMeta,
    protectedOffset,
    collateralOffset,
    debtOffset
  ] = await Promise.all([
    fetchSymbolDecimals(config.token),
    fetchSymbolDecimals(config.protectedShareToken),
    fetchSymbolDecimals(config.collateralShareToken),
    fetchSymbolDecimals(config.debtShareToken),
    fetchShareTokenOffset(config.protectedShareToken),
    fetchShareTokenOffset(config.collateralShareToken),
    fetchShareTokenOffset(config.debtShareToken)
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
    factory: factoryAddress,
    token: config.token,
    tokenSymbol: tokenMeta.symbol,
    tokenDecimals: tokenMeta.decimals,
    protectedShareToken: config.protectedShareToken,
    protectedShareTokenSymbol: protectedMeta.symbol,
    protectedShareTokenDecimals: protectedMeta.decimals,
    protectedShareTokenOffset: protectedOffset,
    collateralShareToken: config.collateralShareToken,
    collateralShareTokenSymbol: collateralMeta.symbol,
    collateralShareTokenDecimals: collateralMeta.decimals,
    collateralShareTokenOffset: collateralOffset,
    debtShareToken: config.debtShareToken,
    debtShareTokenSymbol: debtMeta.symbol,
    debtShareTokenDecimals: debtMeta.decimals,
    debtShareTokenOffset: debtOffset,
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
  irmAddress: string,
  version: string | undefined
): Promise<Pick<IRMInfo, 'type' | 'config'>> {
  // Only fetch details when version indicates DynamicKinkModel; do nothing otherwise.
  if (!irmAddress || irmAddress === ethers.ZeroAddress || !version) {
    return {}
  }
  const [contractName] = version.split(' ')
  if (contractName !== 'DynamicKinkModel') return {}

  try {
    const dynamicKinkContract = new ethers.Contract(
      irmAddress,
      dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
      provider
    )

    try {
      // DynamicKinkModel exposes getModelStateAndConfig(bool includeState)
      // We only need config + immutableConfig, so we pass false to omit state.
      const [, config, immutableConfig] = await dynamicKinkContract.getModelStateAndConfig(false)
      const result: Pick<IRMInfo, 'type' | 'config'> = {
        type: 'DynamicKinkModel',
        config: {
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
      }

      return result
    } catch {
      // Method missing or call failed – treat as no extra info
      return {}
    }
  } catch {
    // Not DynamicKinkModel or error constructing contract – treat as no extra info
    return {}
  }
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
