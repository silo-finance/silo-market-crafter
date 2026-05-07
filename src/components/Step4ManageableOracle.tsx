'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard, type OracleType, type WizardData } from '@/contexts/WizardContext'
import { getChainName, getExplorerAddressUrl } from '@/utils/networks'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { ethers } from 'ethers'
import ContractInfo from '@/components/ContractInfo'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import manageableOracleFactoryAbi from '@/abis/oracle/IManageableOracleFactory.json'
import Button from '@/components/Button'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'
import { prepareDeployArgs, type OracleDeployments } from '@/utils/deployArgs'
import { fetchOracleFactoryAddress } from '@/utils/oracleFactoryAvailability'
import customErrorsSelectors from '@/data/customErrorsSelectors.json'
import NewFeatureBadge from '@/components/NewFeatureBadge'

const MANAGEABLE_ORACLE_FACTORY_NAME = 'ManageableOracleFactory'

/** eth_call omits explicit gas unless set; simulations that deploy contracts can exhaust that cap and revert with payload 0x. */
const MANAGE_ORACLE_SIMULATION_CALL_GAS = BigInt(50000000)

function callExceptionRevertPayloadEmpty(ex: ethers.CallExceptionError): boolean {
  const d = ex.data
  return d === null || d === undefined || d === '' || d === '0x'
}

function getOracleTypeDisplayName(oracleType: OracleType | null | undefined): string {
  const t = oracleType?.type ?? 'none'
  switch (t) {
    case 'none':
      return 'No Oracle'
    case 'scaler':
      return 'Scaler Oracle'
    case 'ptLinear':
      return 'PT-Linear'
    case 'vault':
      return 'Vault Oracle'
    case 'vaultWithUnderlying':
      return 'Vault Oracle With Underlying'
    case 'customMethod':
      return 'Custom Method Oracle'
    case 'supraSValue':
      return 'Supra s-value Oracle'
    case 'flatPrice':
      return 'FlatPrice Oracle'
    case 'chainlink':
      return 'Chainlink'
  }
}

const SOLIDITY_PANIC_SELECTOR = '0x4e487b71'

function describeSolidityPanicData(data: string): string | null {
  if (!data.startsWith('0x') || data.length < 10) return null
  if (data.slice(0, 10).toLowerCase() !== SOLIDITY_PANIC_SELECTOR) return null
  const payload = `0x${data.slice(10)}`
  try {
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], payload)
    const code = decoded[0] as bigint
    const n = Number(code)
    const labels: Record<number, string> = {
      0x01: 'assert / internal check failed (often wrong arguments or illegal state)',
      0x11: 'arithmetic underflow or overflow',
      0x12: 'division or modulo by zero',
      0x21: 'enum conversion out of bounds',
      0x22: 'incorrect storage byte array access',
      0x31: 'pop on empty array',
      0x32: 'out-of-bounds array access',
      0x41: 'too much memory allocated',
      0x51: 'zero-initialized variable of internal type',
    }
    const label = labels[n]
    const hexCode = `0x${n.toString(16)}`
    return label ? `Solidity panic ${hexCode}: ${label}` : `Solidity panic ${hexCode}`
  } catch {
    return null
  }
}

/** 10^n for n in [0, 36] — avoid BigInt ** under legacy TS target */
function pow10BigInt(n: number): bigint {
  let r = BigInt(1)
  for (let i = 0; i < n; i++) r *= BigInt(10)
  return r
}

const MANAGEABLE_ORACLE_UNDERLYING_ABI = [
  'function baseToken() view returns (address)',
  'function quote(uint256 baseAmount, address baseToken) view returns (uint256)',
] as const

const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'] as const

function summarizeWalletProviderInfo(info: unknown): Record<string, unknown> {
  if (info === undefined) return {}
  try {
    return JSON.parse(
      JSON.stringify(info, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))
    ) as Record<string, unknown>
  } catch {
    const out: Record<string, unknown> = {}
    const o = info as { error?: { code?: unknown; message?: unknown; data?: unknown } }
    if (o.error) {
      out.errorCode = o.error.code
      out.errorMessage = o.error.message
      out.errorData = o.error.data
    }
    return out
  }
}

function tokenDecimalsFromWizard(wizardData: WizardData, tokenAddress: string): number | undefined {
  const normalized = ethers.getAddress(tokenAddress)
  if (
    wizardData.token0?.address &&
    ethers.getAddress(wizardData.token0.address) === normalized
  )
    return wizardData.token0.decimals
  if (
    wizardData.token1?.address &&
    ethers.getAddress(wizardData.token1.address) === normalized
  )
    return wizardData.token1.decimals
  return undefined
}

/**
 * ManageableOracle.initialize runs oracleVerification: dust quote against base token.
 * Run the same probe in isolation so users see a reverting payload even when wallet omits factory revert data.
 */
async function diagnoseManageableWrappedOracleQuote(
  provider: ethers.BrowserProvider,
  wizardData: WizardData,
  underlyingOracleAddress: string,
  fromAddress: string
): Promise<string | null> {
  const addr = ethers.getAddress(underlyingOracleAddress)
  const iface = new ethers.Interface(MANAGEABLE_ORACLE_UNDERLYING_ABI)
  const oracle = new ethers.Contract(addr, MANAGEABLE_ORACLE_UNDERLYING_ABI, provider)
  let baseToken: string
  try {
    baseToken = ethers.getAddress(await oracle.baseToken())
  } catch (e) {
    return (
      `Isolated check: baseToken() on underlying oracle ${addr} failed (ManageableOracle reads this first):\n` +
      formatOracleSimulationError(e)
    )
  }
  let dec = tokenDecimalsFromWizard(wizardData, baseToken)
  if (dec === undefined) {
    try {
      const erc = new ethers.Contract(baseToken, ERC20_DECIMALS_ABI, provider)
      dec = Number(await erc.decimals())
    } catch (e) {
      return (
        `Isolated check: could not read decimals for base token ${baseToken} (needed to match ManageableOracle initialize dust quote):\n` +
        formatOracleSimulationError(e)
      )
    }
  }
  if (!Number.isInteger(dec) || dec < 0 || dec > 36) {
    return 'Isolated check: invalid decimals for base token — cannot synthesize `10 ** decimals`.'
  }
  const dust = pow10BigInt(dec)
  const quoteCalldata = iface.encodeFunctionData('quote', [dust, baseToken])
  try {
    const ret = await provider.call({
      to: addr,
      data: quoteCalldata,
      from: fromAddress,
      gasLimit: MANAGE_ORACLE_SIMULATION_CALL_GAS
    })
    const decoded = iface.decodeFunctionResult('quote', ret)
    const price = decoded[0] as bigint
    if (price === BigInt(0)) {
      return (
        `Isolated check: quote(10**${dec}, ${baseToken}) on ${addr} returned 0. ` +
          `ManageableOracle.initialize() rejects zero quotes during oracleVerification.`
      )
    }
    return (
      `Isolated check: quote(10**${dec}, ${baseToken}) on ${addr} returned a non-zero value. ` +
        `The factory revert is likely not this dust quote alone (timelock bounds, CREATE2/nonce, base-token decimals assert, or RPC hid the real revert).`
    )
  } catch (e) {
    return (
      `Isolated check: ManageableOracle.initialize() calls underlying quote(10**${dec}, ${baseToken}) — that call fails in isolation:\n` +
      formatOracleSimulationError(e)
    )
  }
}

function formatRevertArgValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') {
    if (ethers.isAddress(value)) {
      try {
        return ethers.getAddress(value)
      } catch {
        return value
      }
    }
    return value
  }
  return String(value)
}

function serializeCallExceptionForRpcLog(ex: ethers.CallExceptionError): Record<string, unknown> {
  const ext = ex as ethers.CallExceptionError & { info?: unknown }
  return {
    code: ex.code,
    action: ex.action,
    reason: ex.reason ?? undefined,
    shortMessage: ex.shortMessage ?? undefined,
    message: ex.message ?? undefined,
    data: ex.data ?? undefined,
    transaction: ex.transaction ?? undefined,
    invocation: ex.invocation ?? undefined,
    revert: ex.revert
      ? {
          name: ex.revert.name,
          signature: ex.revert.signature,
          args: ex.revert.args?.map((a) => (typeof a === 'bigint' ? a.toString() : a)),
        }
      : undefined,
    walletProviderEcho: summarizeWalletProviderInfo(ext.info),
  }
}

/**
 * Readable contract revert for oracle factory static calls — decoded custom errors with
 * comma-separated args (no JSON dump). Falls back to selector map / RPC messages.
 */
function formatOracleSimulationError(err: unknown): string {
  if (ethers.isError(err, 'ACTION_REJECTED')) {
    return 'Action rejected.'
  }
  if (ethers.isError(err, 'CALL_EXCEPTION')) {
    const ex = err as ethers.CallExceptionError
    const parts: string[] = []

    if (ex.revert) {
      const name =
        typeof ex.revert.name === 'string' && ex.revert.name.length > 0
          ? ex.revert.name
          : typeof ex.revert.signature === 'string' && ex.revert.signature.includes('(')
            ? ex.revert.signature.split('(')[0]!
            : 'Revert'
      const args = ex.revert.args
      const argStr =
        Array.isArray(args) && args.length > 0 ? args.map(formatRevertArgValue).join(', ') : ''
      parts.push(argStr.length > 0 ? `${name}(${argStr})` : `${name}()`)
    } else if (ex.data && typeof ex.data === 'string' && ex.data.startsWith('0x')) {
      const panicLine = describeSolidityPanicData(ex.data)
      if (panicLine) {
        parts.push(panicLine)
      } else if (ex.data.length >= 10) {
        const selectorHex = ex.data.slice(0, 10)
        const known = (customErrorsSelectors as { bySelector: Record<string, string> }).bySelector[selectorHex]
        parts.push(known ?? `Unknown revert (selector ${selectorHex})`)
      }
    }

    if (typeof ex.reason === 'string' && ex.reason.length > 0) {
      const reason = ex.reason
      if (!parts.some((p) => p.includes(reason))) {
        parts.push(reason)
      }
    }

    if (parts.some((p) => p.includes('require(false)'))) {
      parts.push(
        'Note: ethers uses require(false) as a fallback label when revert data is missing.'
      )
    }

    if (callExceptionRevertPayloadEmpty(ex)) {
      parts.push(
        [
          '',
          'Empty revert blob (`data`: "0x"): usually OOG/default eth_call gas, bare revert(), or the wallet/RPC omitting ABI errors.',
          'Silo: ManageableOracle.initialize() runs oracleVerification on the WRAPPED oracle — quote(10**baseDecimals, baseToken) must succeed and be non-zero; failures here often correlate with scaler issues even when factory data is omitted.',
          'Technical block includes walletProviderEcho (raw JSON-RPC-ish echo) when ethers captured it.',
        ].join('\n')
      )
    }

    let human = ''
    if (parts.length > 0) human = parts.join('\n')
    else if (ex.shortMessage) human = ex.shortMessage
    else human = 'Simulation call reverted'

    try {
      const technical = JSON.stringify(serializeCallExceptionForRpcLog(ex), null, 2)
      return `${human}\n\nTechnical (RPC):\n${technical}`
    } catch {
      return human
    }
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export default function Step4ManageableOracle() {
  const router = useRouter()
  const { wizardData, updateManageableOracle, updateManageableOracleTimelock, markStepCompleted } = useWizard()

  const [manageableEnabled, setManageableEnabled] = useState(
    wizardData.manageableOracle ?? true
  )
  const [manageableFactory, setManageableFactory] = useState<{
    address: string
    version: string
  } | null>(null)
  const [oracleImplementation, setOracleImplementation] = useState<string | null>(null)
  const [oracleImplementationVersion, setOracleImplementationVersion] = useState<string>('')
  const [timelockRange, setTimelockRange] = useState<{ minDays: number; maxDays: number } | null>(null)
  const [selectedTimelockDays, setSelectedTimelockDays] = useState<number | undefined>(undefined)
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [simulate0State, setSimulate0State] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [simulate1State, setSimulate1State] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [simulate0Error, setSimulate0Error] = useState<string>('')
  const [simulate1Error, setSimulate1Error] = useState<string>('')

  const SECONDS_PER_DAY = 86400

  // Sync from wizard when returning to step
  useEffect(() => {
    setManageableEnabled(wizardData.manageableOracle ?? true)
  }, [wizardData.manageableOracle])

  useEffect(() => {
    const tl = wizardData.manageableOracleTimelock
    if (tl !== undefined && tl > 0) {
      setSelectedTimelockDays(Math.round(tl / SECONDS_PER_DAY))
    } else {
      setSelectedTimelockDays(undefined)
    }
  }, [wizardData.manageableOracleTimelock])

  // Clamp selected timelock when range loads (if selection is out of range)
  useEffect(() => {
    if (timelockRange && selectedTimelockDays !== undefined && (selectedTimelockDays < timelockRange.minDays || selectedTimelockDays > timelockRange.maxDays)) {
      setSelectedTimelockDays(undefined)
    }
  }, [timelockRange, selectedTimelockDays])

  useEffect(() => {
    setSimulate0State('idle')
    setSimulate1State('idle')
    setSimulate0Error('')
    setSimulate1Error('')
  }, [
    manageableEnabled,
    selectedTimelockDays,
    wizardData.oracleConfiguration,
    wizardData.manageableOracleOwnerAddress,
    wizardData.networkInfo?.chainId
  ])

  // Fetch ManageableOracleFactory address
  useEffect(() => {
    const fetchFactory = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-oracles/deployments/${chainName}/${MANAGEABLE_ORACLE_FACTORY_NAME}.sol.json`
        )
        if (response.ok) {
          const data = await response.json()
          const address = data.address && ethers.isAddress(data.address) ? data.address : ''
          setManageableFactory(address ? { address, version: '' } : null)
        } else {
          setManageableFactory(null)
        }
      } catch {
        setManageableFactory(null)
      }
    }
    fetchFactory()
  }, [wizardData.networkInfo?.chainId])

  // Fetch SiloLens address
  useEffect(() => {
    const fetchLens = async () => {
      if (!wizardData.networkInfo?.chainId) return
      const chainName = getChainName(wizardData.networkInfo.chainId)
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloLens.sol.json`
        )
        if (response.ok) {
          const data = await response.json()
          const address = data.address && ethers.isAddress(data.address) ? data.address : ''
          setSiloLensAddress(address)
        } else {
          setSiloLensAddress('')
        }
      } catch {
        setSiloLensAddress('')
      }
    }
    fetchLens()
  }, [wizardData.networkInfo?.chainId])

  // Fetch ManageableOracleFactory version via Silo Lens
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!siloLensAddress || !chainId || !manageableFactory?.address) return

    const fetchVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses: [manageableFactory.address]
        })
        const version = versionsByAddress.get(manageableFactory.address.toLowerCase()) ?? ''
        setManageableFactory(prev =>
          prev ? { ...prev, version: version || '—' } : null
        )
      } catch (err) {
        console.warn('Failed to fetch ManageableOracleFactory version:', err)
        setManageableFactory(prev =>
          prev ? { ...prev, version: '—' } : null
        )
      }
    }
    fetchVersion()
  }, [manageableFactory?.address, siloLensAddress, wizardData.networkInfo?.chainId])

  // Fetch ORACLE_IMPLEMENTATION from ManageableOracleFactory
  useEffect(() => {
    if (!manageableFactory?.address || !window.ethereum) return

    const fetchOracleImplementation = async () => {
      try {
        const eth = window.ethereum
        if (!eth) {
          setOracleImplementation(null)
          return
        }
        const provider = new ethers.BrowserProvider(eth)
        const contract = new ethers.Contract(
          manageableFactory.address,
          (manageableOracleFactoryAbi as { abi: ethers.InterfaceAbi }).abi,
          provider
        )
        const impl = await contract.ORACLE_IMPLEMENTATION()
        if (impl && ethers.isAddress(impl)) {
          setOracleImplementation(ethers.getAddress(impl))
        } else {
          setOracleImplementation(null)
        }
      } catch (err) {
        console.warn('Failed to fetch ORACLE_IMPLEMENTATION:', err)
        setOracleImplementation(null)
      }
    }
    fetchOracleImplementation()
  }, [manageableFactory?.address])

  // Fetch MIN_TIMELOCK and MAX_TIMELOCK from Oracle Implementation
  useEffect(() => {
    if (!oracleImplementation || !window.ethereum) return

    const implTimelockAbi = [
      {
        type: 'function' as const,
        name: 'MIN_TIMELOCK',
        inputs: [],
        outputs: [{ type: 'uint32' }],
        stateMutability: 'view' as const
      },
      {
        type: 'function' as const,
        name: 'MAX_TIMELOCK',
        inputs: [],
        outputs: [{ type: 'uint32' }],
        stateMutability: 'view' as const
      }
    ] as const

    const fetchTimelockRange = async () => {
      try {
        const eth = window.ethereum
        if (!eth) {
          setTimelockRange(null)
          return
        }
        const provider = new ethers.BrowserProvider(eth)
        const [minSec, maxSec] = await executeReadMulticall<unknown>(
          provider,
          [
            buildReadMulticallCall<unknown>({
              target: oracleImplementation as `0x${string}`,
              abi: implTimelockAbi,
              functionName: 'MIN_TIMELOCK'
            }),
            buildReadMulticallCall<unknown>({
              target: oracleImplementation as `0x${string}`,
              abi: implTimelockAbi,
              functionName: 'MAX_TIMELOCK'
            })
          ],
          { debugLabel: 'manageableOracleTimelockRange' }
        )
        const minDays = Math.round(Number(minSec) / SECONDS_PER_DAY)
        const maxDays = Math.round(Number(maxSec) / SECONDS_PER_DAY)
        setTimelockRange({ minDays: Math.max(1, minDays), maxDays: Math.max(minDays, maxDays) })
      } catch (err) {
        console.warn('Failed to fetch MIN_TIMELOCK/MAX_TIMELOCK:', err)
        setTimelockRange(null)
      }
    }
    fetchTimelockRange()
  }, [oracleImplementation])

  // Fetch Oracle Implementation version via Silo Lens
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!siloLensAddress || !chainId || !oracleImplementation) return

    const fetchImplVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses: [oracleImplementation]
        })
        const version = versionsByAddress.get(oracleImplementation.toLowerCase()) ?? ''
        setOracleImplementationVersion(version || '—')
      } catch (err) {
        console.warn('Failed to fetch Oracle Implementation version:', err)
        setOracleImplementationVersion('—')
      }
    }
    fetchImplVersion()
  }, [oracleImplementation, siloLensAddress, wizardData.networkInfo?.chainId])

  const timelockDayOptions = timelockRange
    ? Array.from(
        { length: timelockRange.maxDays - timelockRange.minDays + 1 },
        (_, i) => timelockRange.minDays + i
      )
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []
    if (manageableEnabled) {
      if (timelockDayOptions.length === 0) errors.push('Timelock options not loaded yet – please wait')
      else if (selectedTimelockDays === undefined) errors.push('Please select a timelock duration (days)')
    }
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])
    updateManageableOracle(manageableEnabled)
    if (manageableEnabled && selectedTimelockDays !== undefined) {
      updateManageableOracleTimelock(selectedTimelockDays * SECONDS_PER_DAY)
    }
    markStepCompleted(4)
    router.push('/wizard?step=5')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=3')
  }

  const resolveSelectedOracleDeployments = async (): Promise<OracleDeployments> => {
    const chainId = wizardData.networkInfo?.chainId
    if (!chainId) return {}
    const result: OracleDeployments = {}
    const selectedTypes = new Set([
      wizardData.oracleConfiguration?.token0?.type,
      wizardData.oracleConfiguration?.token1?.type
    ])
    if (selectedTypes.has('chainlink')) {
      const address = await fetchOracleFactoryAddress(chainId, 'chainlink')
      if (address) result.chainlinkV3OracleFactory = address
    }
    if (selectedTypes.has('ptLinear')) {
      const address = await fetchOracleFactoryAddress(chainId, 'ptLinear')
      if (address) result.ptLinearOracleFactory = address
    }
    if (selectedTypes.has('vault')) {
      const address = await fetchOracleFactoryAddress(chainId, 'vault')
      if (address) result.erc4626OracleFactory = address
    }
    if (selectedTypes.has('vaultWithUnderlying')) {
      const address = await fetchOracleFactoryAddress(chainId, 'vaultWithUnderlying')
      if (address) result.erc4626OracleWithUnderlyingFactory = address
    }
    if (selectedTypes.has('customMethod')) {
      const address = await fetchOracleFactoryAddress(chainId, 'customMethod')
      if (address) result.customMethodOracleFactory = address
    }
    if (selectedTypes.has('supraSValue')) {
      const address = await fetchOracleFactoryAddress(chainId, 'supraSValue')
      if (address) result.supraSValueOracleFactory = address
    }
    if (selectedTypes.has('flatPrice')) {
      const address = await fetchOracleFactoryAddress(chainId, 'flatPrice')
      if (address) result.flatPriceOracleFactory = address
    }
    if (manageableFactory?.address) {
      result.manageableOracleFactory = manageableFactory.address
    }
    return result
  }

  const simulateManageableOracle = async (tokenSide: 0 | 1) => {
    const setState = tokenSide === 0 ? setSimulate0State : setSimulate1State
    const setError = tokenSide === 0 ? setSimulate0Error : setSimulate1Error
    if (!manageableEnabled) return
    if (!window.ethereum) {
      setState('error')
      setError('Wallet provider is not available.')
      return
    }
    if (!wizardData.token0 || !wizardData.token1 || !wizardData.oracleConfiguration) {
      setState('error')
      setError('Missing wizard configuration.')
      return
    }
    if (!manageableFactory?.address) {
      setState('error')
      setError('ManageableOracleFactory is not available.')
      return
    }
    const timelockSeconds =
      selectedTimelockDays !== undefined
        ? selectedTimelockDays * SECONDS_PER_DAY
        : wizardData.manageableOracleTimelock
    if (!timelockSeconds || timelockSeconds <= 0) {
      setState('error')
      setError('Select timelock first.')
      return
    }

    setState('loading')
    setError('')
    let ownerForSim = ''
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const rawOwner = wizardData.manageableOracleOwnerAddress?.trim()
      if (
        rawOwner &&
        ethers.isAddress(rawOwner) &&
        ethers.getAddress(rawOwner) !== ethers.ZeroAddress
      ) {
        ownerForSim = ethers.getAddress(rawOwner)
      } else {
        try {
          ownerForSim = ethers.getAddress(await (await provider.getSigner()).getAddress())
        } catch {
          setState('error')
          setError(
            'Oracle/IRM owner is not set yet (Step 6) and no wallet account is available — cannot simulate ManageableOracle with a valid owner. Connect your wallet or complete Step 6 first.'
          )
          return
        }
      }

      const oracleDeployments = await resolveSelectedOracleDeployments()
      const simulationWizardData = {
        ...wizardData,
        manageableOracle: true,
        manageableOracleTimelock: timelockSeconds,
        manageableOracleOwnerAddress: ownerForSim,
      }
      const deployArgs = prepareDeployArgs(simulationWizardData, {}, oracleDeployments)
      const txData =
        tokenSide === 0
          ? deployArgs._oracles.solvencyOracle0
          : deployArgs._oracles.solvencyOracle1
      if (!txData.factory || txData.factory === ethers.ZeroAddress || !txData.txInput || txData.txInput === '0x') {
        throw new Error('Manageable oracle tx payload is empty.')
      }
      await provider.call({
        to: txData.factory,
        data: txData.txInput,
        from: ownerForSim,
        gasLimit: MANAGE_ORACLE_SIMULATION_CALL_GAS,
      })
      setState('success')
    } catch (err) {
      let msg = formatOracleSimulationError(err)
      if (
        ownerForSim &&
        ethers.isError(err, 'CALL_EXCEPTION') &&
        callExceptionRevertPayloadEmpty(err as ethers.CallExceptionError)
      ) {
        const ot = tokenSide === 0 ? wizardData.oracleType0 : wizardData.oracleType1
        const scaler =
          tokenSide === 0
            ? wizardData.oracleConfiguration?.token0?.scalerOracle
            : wizardData.oracleConfiguration?.token1?.scalerOracle
        if (
          ot?.type === 'scaler' &&
          scaler &&
          !scaler.customCreate &&
          scaler.address &&
          ethers.isAddress(scaler.address)
        ) {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const isolated = await diagnoseManageableWrappedOracleQuote(
            provider,
            wizardData,
            scaler.address,
            ownerForSim
          )
          if (isolated) msg += `\n\n${isolated}`
        }
      }
      setState('error')
      setError(msg)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 4: Manageable Oracle
        </h1>
        <p className="text-gray-300 text-lg">
          Choose whether the Oracle can be updated in the future
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="silo-panel p-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={manageableEnabled}
              onChange={(e) => {
                const checked = e.target.checked
                setManageableEnabled(checked)
                if (!checked) {
                  setSelectedTimelockDays(undefined)
                  setValidationErrors([])
                  updateManageableOracleTimelock(undefined)
                }
              }}
              className="mt-1 w-5 h-5 rounded border-[var(--silo-border)] bg-[var(--silo-surface)] text-[var(--silo-accent)] focus:ring-[var(--silo-accent)] focus:ring-offset-[var(--silo-surface)]"
            />
            <div>
              <span className="text-lg font-medium text-white group-hover:text-[var(--silo-text)]">
                Allow Oracle updates in the future
              </span>
              <p className="mt-2 text-sm text-gray-400">
                If this option is checked, the Oracle will be wrapped in ManageableOracle.
                In the future, the owner will be able to change the underlying Oracle (e.g. after
                migrating to a newer Chainlink feed) via the timelock mechanism.
              </p>
            </div>
          </label>
        </div>

        {/* Manageable Oracle Factory info */}
        {manageableEnabled && manageableFactory?.address && wizardData.networkInfo?.chainId && (
          <div className="mb-6 space-y-4">
            <ContractInfo
              contractName={MANAGEABLE_ORACLE_FACTORY_NAME}
              address={manageableFactory.address}
              version={manageableFactory.version === '' ? 'Loading…' : manageableFactory.version}
              chainId={wizardData.networkInfo.chainId}
              isOracle={true}
            />
            {/* Oracle Implementation - source link points to Factory deployment */}
            {oracleImplementation && (
              <div className="silo-panel p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium silo-text-main">Oracle Implementation</p>
                  <span className="text-xs silo-text-soft">
                    Source (Factory): {' '}
                    <a
                      href={getExplorerAddressUrl(wizardData.networkInfo!.chainId, manageableFactory.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--silo-accent)] hover:opacity-90 underline"
                    >
                      source
                    </a>
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <AddressDisplayLong
                      address={oracleImplementation}
                      chainId={wizardData.networkInfo.chainId}
                      linkClassName="text-[var(--silo-accent)] hover:text-[#7f91ff]"
                    />
                  </div>
                  <div className="text-sm silo-text-soft whitespace-nowrap">
                    version: <span className="text-version-muted">{oracleImplementationVersion || 'Loading…'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Timelock selection */}
            {manageableEnabled && oracleImplementation && timelockDayOptions.length > 0 && (
              <div className="silo-panel p-4 space-y-3">
                <p className="text-sm font-medium silo-text-main">Timelock (days)</p>
                <p className="text-xs silo-text-soft">
                  Duration before oracle changes can take effect. Owner can propose changes; they execute after this period.
                </p>
                <div className="flex flex-wrap gap-2">
                  {timelockDayOptions.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedTimelockDays(days)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-normal border transition-colors ${
                        selectedTimelockDays === days
                          ? 'border-[var(--silo-accent)] bg-[var(--silo-accent-soft)] text-[var(--silo-text)]'
                          : 'border-[var(--silo-border)] bg-[var(--silo-surface)] text-[var(--silo-text-soft)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))]'
                      }`}
                    >
                      {days} {days === 1 ? 'day' : 'days'}
                    </button>
                  ))}
                </div>
                {selectedTimelockDays !== undefined && (
                  <p className="text-xs silo-text-soft pt-1">
                    Used in transaction: <span className="silo-text-main font-medium">{selectedTimelockDays * SECONDS_PER_DAY} seconds</span>
                  </p>
                )}
              </div>
            )}

            {manageableEnabled && (
              <>
                <p className="text-xs silo-text-soft">
                  Until Oracle/IRM Owner is set in Step 6, simulations use your connected wallet address as the
                  manageable oracle owner so the ManageableOracleFactory call matches a real deployment payload.
                </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="silo-panel p-4 flex flex-col gap-3 h-full">
                  <p className="text-sm silo-text-main leading-relaxed">
                    Simulation for Manageable Oracle with{' '}
                    <span className="font-medium">{getOracleTypeDisplayName(wizardData.oracleType0)}</span>
                    {' '}and for{' '}
                    <span className="font-medium">{wizardData.token0?.symbol ?? 'token 0'}</span>
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => void simulateManageableOracle(0)}
                      disabled={simulate0State === 'loading' || simulate0State === 'success'}
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        simulate0State === 'success'
                          ? 'silo-panel-soft border border-[color-mix(in_srgb,var(--silo-accent)_28%,var(--silo-border))] status-muted-success cursor-not-allowed'
                          : simulate0State === 'loading'
                          ? 'bg-[var(--silo-surface-2)] text-[var(--silo-text-soft)] border border-[var(--silo-border)] cursor-wait'
                          : 'bg-[var(--silo-accent)] text-[#141a3c] hover:opacity-90 border border-transparent'
                      }`}
                    >
                      {simulate0State === 'success' && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--silo-accent)] text-[10px] text-[#141a3c]">✓</span>
                      )}
                      {simulate0State === 'loading' ? 'Simulating…' : 'Simulate'}
                      <NewFeatureBadge compact className="ml-1" />
                    </button>
                  </div>
                  {simulate0State === 'error' && (
                    <pre className="text-xs text-red-400 whitespace-pre-wrap break-words font-sans silo-panel-soft border border-[var(--silo-border)] rounded-md p-2 mt-1">
                      {simulate0Error}
                    </pre>
                  )}
                </div>

                <div className="silo-panel p-4 flex flex-col gap-3 h-full">
                  <p className="text-sm silo-text-main leading-relaxed">
                    Simulation for Manageable Oracle with{' '}
                    <span className="font-medium">{getOracleTypeDisplayName(wizardData.oracleType1)}</span>
                    {' '}and for{' '}
                    <span className="font-medium">{wizardData.token1?.symbol ?? 'token 1'}</span>
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => void simulateManageableOracle(1)}
                      disabled={simulate1State === 'loading' || simulate1State === 'success'}
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        simulate1State === 'success'
                          ? 'silo-panel-soft border border-[color-mix(in_srgb,var(--silo-accent)_28%,var(--silo-border))] status-muted-success cursor-not-allowed'
                          : simulate1State === 'loading'
                          ? 'bg-[var(--silo-surface-2)] text-[var(--silo-text-soft)] border border-[var(--silo-border)] cursor-wait'
                          : 'bg-[var(--silo-accent)] text-[#141a3c] hover:opacity-90 border border-transparent'
                      }`}
                    >
                      {simulate1State === 'success' && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--silo-accent)] text-[10px] text-[#141a3c]">✓</span>
                      )}
                      {simulate1State === 'loading' ? 'Simulating…' : 'Simulate'}
                      <NewFeatureBadge compact className="ml-1" />
                    </button>
                  </div>
                  {simulate1State === 'error' && (
                    <pre className="text-xs text-red-400 whitespace-pre-wrap break-words font-sans silo-panel-soft border border-[var(--silo-border)] rounded-md p-2 mt-1">
                      {simulate1Error}
                    </pre>
                  )}
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-red-400 text-sm space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {manageableEnabled && !manageableFactory?.address && wizardData.networkInfo?.chainId && (
          <div className="silo-alert silo-alert-warning mb-6">
            <p className="text-sm">
              ManageableOracleFactory address was not found for this network. Deployment may require manual configuration.
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="secondary" size="lg" onClick={goToPreviousStep}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Oracle Config</span>
          </Button>
          <Button type="submit" variant="primary" size="lg">
            <span>IRM Selection</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </form>
    </div>
  )
}
