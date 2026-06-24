import { ethers } from 'ethers'
import { type MarketConfig } from '@/utils/fetchMarketConfig'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { verifyAddress } from '@/utils/verification/addressVerification'
import { parseJsonPreservingBigInt } from '@/utils/parseJsonPreservingBigInt'
import { resolveKinkConfigDisplayName, type KinkConfigItem } from '@/utils/kinkConfigName'
import dynamicKinkModelAbi from '@/abis/silo/DynamicKinkModel.json'
import dynamicKinkModelConfigAbi from '@/abis/silo/IDynamicKinkModelConfig.json'
import siloHookV2Abi from '@/abis/silo/ISiloHookV2.json'
import siloIncentiveControllerAbi from '@/abis/silo/ISiloIncentiveController.json'

export type HookGaugeInfo = {
  hasDefaultingHook: boolean
  onlyOneBorrowable: boolean | null
  borrowableSilo: 0 | 1 | null
  borrowableTokenSymbol: string | null
  gaugeAddress: string | null
  gaugeVersion: string | null
  ltMarginForDefaultingRaw: string | null
  gaugeVerification?: {
    owner: string | null
    ownerName: string | null
    ownerInJson: boolean | null
    ownerMatchesHookOwner: boolean | null
    ownerMatchesWizard: boolean | null
    notifierEqualsHook: boolean | null
  } | null
} | null

export type IrmDisplayAux = {
  irmConfigNames: { silo0: string | null; silo1: string | null }
  pendingIrmInfo: {
    silo0: { name: string | null; activateAt: number | null } | null
    silo1: { name: string | null; activateAt: number | null } | null
  }
  irmConfigHistory: {
    silo0: string[] | null
    silo1: string[] | null
  }
}

const KINK_CONFIGS_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'

let kinkConfigCache: KinkConfigItem[] | null = null
let kinkConfigPromise: Promise<KinkConfigItem[] | null> | null = null

async function getKinkConfigCache(): Promise<KinkConfigItem[] | null> {
  if (kinkConfigCache) return kinkConfigCache
  if (kinkConfigPromise) return kinkConfigPromise
  kinkConfigPromise = (async () => {
    const cfgRes = await fetch(KINK_CONFIGS_URL)
    if (!cfgRes.ok) return null
    const cfgJson: KinkConfigItem[] = parseJsonPreservingBigInt(await cfgRes.text())
    kinkConfigCache = cfgJson
    return cfgJson
  })().finally(() => {
    kinkConfigPromise = null
  })
  return kinkConfigPromise
}

type FetchHookGaugeInfoParams = {
  provider: ethers.Provider
  marketConfig: MarketConfig
  chainId: string
  siloLensAddress?: string
  hookOwnerWizard?: string | null
}

export async function fetchHookGaugeInfo({
  provider,
  marketConfig,
  chainId,
  siloLensAddress,
  hookOwnerWizard
}: FetchHookGaugeInfoParams): Promise<HookGaugeInfo> {
  const lt0NonZero = marketConfig.silo0.lt != null && String(marketConfig.silo0.lt) !== '0'
  const lt1NonZero = marketConfig.silo1.lt != null && String(marketConfig.silo1.lt) !== '0'
  let borrowableSilo: 0 | 1 | null = null
  if (lt0NonZero && !lt1NonZero) borrowableSilo = 1
  else if (lt1NonZero && !lt0NonZero) borrowableSilo = 0
  const onlyOneBorrowable = borrowableSilo !== null
  const borrowableTokenSymbol = (borrowableSilo === 0
    ? marketConfig.silo0.tokenSymbol
    : borrowableSilo === 1
      ? marketConfig.silo1.tokenSymbol
      : null) ?? null

  const hookVersion = marketConfig.silo0.hookReceiverVersion || marketConfig.silo1.hookReceiverVersion || ''
  const hookName = hookVersion.split(' ')[0] || ''
  if (hookName !== 'SiloHookV2' && hookName !== 'SiloHookV3') {
    return {
      hasDefaultingHook: false,
      onlyOneBorrowable,
      borrowableSilo,
      borrowableTokenSymbol,
      gaugeAddress: null,
      gaugeVersion: null,
      ltMarginForDefaultingRaw: null
    }
  }

  let result: HookGaugeInfo = {
    hasDefaultingHook: true,
    onlyOneBorrowable,
    borrowableSilo,
    borrowableTokenSymbol,
    gaugeAddress: null,
    gaugeVersion: null,
    ltMarginForDefaultingRaw: null
  }

  try {
    const hookAddress = marketConfig.silo0.hookReceiver || marketConfig.silo1.hookReceiver
    if (!hookAddress || !ethers.isAddress(hookAddress)) return result

    const siloAddressForGauge = onlyOneBorrowable
      ? (borrowableSilo === 0 ? marketConfig.silo0.silo : marketConfig.silo1.silo)
      : null

    const hookCalls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = [
      buildReadMulticallCall<unknown>({
        target: hookAddress as `0x${string}`,
        abi: siloHookV2Abi as unknown as ethers.InterfaceAbi,
        functionName: 'LT_MARGIN_FOR_DEFAULTING',
        allowFailure: true
      })
    ]

    if (siloAddressForGauge && ethers.isAddress(siloAddressForGauge)) {
      hookCalls.push(
        buildReadMulticallCall<unknown>({
          target: hookAddress as `0x${string}`,
          abi: siloHookV2Abi as unknown as ethers.InterfaceAbi,
          functionName: 'configuredGauges',
          args: [siloAddressForGauge],
          allowFailure: true
        })
      )
    }

    const hookResults = await executeReadMulticall<unknown>(provider, hookCalls, {
      debugLabel: 'hookMarginAndGauge'
    })
    const margin = hookResults[0]
    const gaugeAddrRaw = hookCalls.length > 1 ? hookResults[1] : null

    if (margin != null) {
      result = {
        ...result,
        ltMarginForDefaultingRaw: String(margin)
      }
    }

    if (onlyOneBorrowable && siloAddressForGauge && ethers.isAddress(siloAddressForGauge)) {
      const gaugeAddr = gaugeAddrRaw != null ? String(gaugeAddrRaw) : ''
      if (gaugeAddr && gaugeAddr !== ethers.ZeroAddress) {
        const normalizedGauge = ethers.getAddress(gaugeAddr)
        result = {
          ...result,
          gaugeAddress: normalizedGauge,
          gaugeVersion: null
        }
        if (siloLensAddress && chainId) {
          try {
            const versionsByAddress = await fetchSiloLensVersionsWithCache({
              provider,
              lensAddress: siloLensAddress,
              chainId,
              addresses: [normalizedGauge]
            })
            const version = versionsByAddress.get(normalizedGauge.toLowerCase()) ?? null
            result = {
              ...result,
              gaugeVersion: version
            }
          } catch (err) {
            console.warn('Failed to fetch gauge version from SiloLens:', err)
          }
        }
        try {
          const [gaugeOwner, gaugeNotifier] = await executeReadMulticall<string>(
            provider,
            [
              buildReadMulticallCall<string>({
                target: normalizedGauge as `0x${string}`,
                abi: siloIncentiveControllerAbi as unknown as ethers.InterfaceAbi,
                functionName: 'owner',
                allowFailure: true,
                decodeResult: (v) => String(v)
              }),
              buildReadMulticallCall<string>({
                target: normalizedGauge as `0x${string}`,
                abi: siloIncentiveControllerAbi as unknown as ethers.InterfaceAbi,
                functionName: 'NOTIFIER',
                allowFailure: true,
                decodeResult: (v) => String(v)
              })
            ],
            { debugLabel: 'gaugeOwnerNotifier' }
          )
          const hookOwnerOnChain = marketConfig.silo0.hookReceiverOwner ?? marketConfig.silo1.hookReceiverOwner ?? null
          result = {
            ...result,
            gaugeVerification: {
              owner: gaugeOwner && gaugeOwner !== ethers.ZeroAddress ? String(gaugeOwner) : null,
              ownerName: null,
              ownerInJson: null,
              ownerMatchesHookOwner: hookOwnerOnChain && gaugeOwner
                ? verifyAddress(String(gaugeOwner), hookOwnerOnChain)
                : null,
              ownerMatchesWizard: hookOwnerWizard != null && gaugeOwner
                ? verifyAddress(String(gaugeOwner), hookOwnerWizard)
                : null,
              notifierEqualsHook: gaugeNotifier != null && hookAddress
                ? ethers.getAddress(String(gaugeNotifier)).toLowerCase() === ethers.getAddress(hookAddress).toLowerCase()
                : null
            }
          }
        } catch (err) {
          console.warn('Failed to fetch gauge owner/notifier:', err)
        }
      } else {
        result = {
          ...result,
          gaugeAddress: ethers.ZeroAddress,
          gaugeVersion: null
        }
      }
    }
  } catch (err) {
    console.warn('Failed to verify configured gauge on hook:', err)
  }

  return result
}

function toKinkConfigObject(configRaw: unknown): Record<string, unknown> | null {
  if (!configRaw || typeof configRaw !== 'object') return null
  const config = configRaw as Record<string, { toString: () => string }>
  try {
    return {
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
      dmax: config.dmax.toString()
    }
  } catch {
    return null
  }
}

export async function fetchIrmDisplayAux(provider: ethers.Provider, marketConfig: MarketConfig): Promise<IrmDisplayAux> {
  const isDynamicKink = (version: string | undefined): boolean => {
    if (!version) return false
    return version.split(' ')[0] === 'DynamicKinkModel'
  }
  const silo0IsKink = isDynamicKink(marketConfig.silo0.interestRateModel.version)
  const silo1IsKink = isDynamicKink(marketConfig.silo1.interestRateModel.version)

  // Config catalog is best-effort: a failed/rejected fetch must not blank out pending/history.
  // When unavailable, names resolve to null ("not able to match") but on-chain data still loads.
  let cfgJson: KinkConfigItem[] | null = null
  try {
    cfgJson = await getKinkConfigCache()
  } catch {
    cfgJson = null
  }
  const resolveName = (irm: { type?: string; config?: Record<string, unknown> | undefined } | undefined): string | null =>
    cfgJson ? resolveKinkConfigDisplayName(irm, cfgJson) : null

  const name0 = silo0IsKink ? resolveName(marketConfig.silo0.interestRateModel) : null
  const name1 = silo1IsKink ? resolveName(marketConfig.silo1.interestRateModel) : null

  type PendingResult = { name: string | null; activateAt: number | null }

  // Pending config detection mirrors the `actions` repo (readDynamicKinkIrmState): use the
  // contract's own `pendingConfigExists()` flag plus `getModelStateAndConfig(true)` to read the
  // pending config directly, rather than relying on `pendingIrmConfig()` returning an address.
  // Fetched independently so any failure degrades to "no pending config" for kink silos rather
  // than hiding the whole IRM section.
  const fetchPending = async (): Promise<(PendingResult | null)[]> => {
    type PendingInput = { irmAddress: string; isKink: boolean }
    type PendingSlot =
      | { kind: 'skip' }
      | { kind: 'fetch'; existsIdx: number; configIdx: number; activateIdx: number }

    const pendingInputs: PendingInput[] = [
      { irmAddress: marketConfig.silo0.interestRateModel.address, isKink: silo0IsKink },
      { irmAddress: marketConfig.silo1.interestRateModel.address, isKink: silo1IsKink }
    ]

    const calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
    const slots: PendingSlot[] = pendingInputs.map((input) => {
      if (!input.isKink || !input.irmAddress || input.irmAddress === ethers.ZeroAddress) {
        return { kind: 'skip' }
      }

      const existsIdx = calls.length
      calls.push(
        buildReadMulticallCall<unknown>({
          target: input.irmAddress as `0x${string}`,
          abi: dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
          functionName: 'pendingConfigExists',
          allowFailure: true
        })
      )
      const configIdx = calls.length
      calls.push(
        buildReadMulticallCall<unknown>({
          target: input.irmAddress as `0x${string}`,
          abi: dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
          functionName: 'getModelStateAndConfig',
          args: [true],
          allowFailure: true
        })
      )
      const activateIdx = calls.length
      calls.push(
        buildReadMulticallCall<unknown>({
          target: input.irmAddress as `0x${string}`,
          abi: dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
          functionName: 'activateConfigAt',
          allowFailure: true
        })
      )
      return { kind: 'fetch', existsIdx, configIdx, activateIdx }
    })

    const results = calls.length > 0
      ? await executeReadMulticall<unknown>(provider, calls, { debugLabel: 'irmPending' })
      : []

    return slots.map((slot) => {
      if (slot.kind === 'skip') return null
      const pendingExists = results[slot.existsIdx] === true
      if (!pendingExists) return { name: null, activateAt: null }

      // getModelStateAndConfig returns (state, config, immutable); config is index 1.
      const bundle = results[slot.configIdx] as unknown[] | null | undefined
      const configObj = toKinkConfigObject(bundle?.[1])
      const name = configObj ? resolveName({ type: 'DynamicKinkModel', config: configObj }) : null

      const activateRaw = results[slot.activateIdx]
      const activateAt = activateRaw != null ? Number(BigInt(String(activateRaw))) : null
      return { name, activateAt }
    })
  }

  const fetchHistoryForSilo = async (
    irmAddress: string,
    version: string | undefined,
    currentConfigAddress: string | undefined
  ): Promise<string[]> => {
    if (!irmAddress || irmAddress === ethers.ZeroAddress || !isDynamicKink(version) || !currentConfigAddress || currentConfigAddress === ethers.ZeroAddress) {
      return []
    }

    try {
      const irmContract = new ethers.Contract(
        irmAddress,
        dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
        provider
      )
      let currentAddr: string = ethers.getAddress(currentConfigAddress)
      const names: string[] = []
      while (currentAddr && currentAddr !== ethers.ZeroAddress) {
        const result = await irmContract.configsHistory(currentAddr)
        const prevAddr = result[1] ?? result.irmConfig
        const prevAddrStr = prevAddr != null ? String(prevAddr) : ''
        if (!prevAddrStr || prevAddrStr === ethers.ZeroAddress) break

        const configContract = new ethers.Contract(
          prevAddrStr,
          dynamicKinkModelConfigAbi as unknown as ethers.InterfaceAbi,
          provider
        )
        const [config] = await configContract.getConfig()
        const configObj = toKinkConfigObject(config)
        if (!configObj) break
        const historyName = resolveName({ type: 'DynamicKinkModel', config: configObj })
        names.push(historyName ?? 'not able to match')
        currentAddr = prevAddrStr
      }
      return names
    } catch {
      return []
    }
  }

  const [pendingSettled, history0Settled, history1Settled] = await Promise.allSettled([
    fetchPending(),
    fetchHistoryForSilo(
      marketConfig.silo0.interestRateModel.address,
      marketConfig.silo0.interestRateModel.version,
      marketConfig.silo0.interestRateModel.irmConfigAddress
    ),
    fetchHistoryForSilo(
      marketConfig.silo1.interestRateModel.address,
      marketConfig.silo1.interestRateModel.version,
      marketConfig.silo1.interestRateModel.irmConfigAddress
    )
  ])

  const pendingResults = pendingSettled.status === 'fulfilled' ? pendingSettled.value : []
  const history0 = history0Settled.status === 'fulfilled' ? history0Settled.value : []
  const history1 = history1Settled.status === 'fulfilled' ? history1Settled.value : []

  // For kink silos, always surface a (possibly empty) pending/history value so the UI renders
  // the section; for non-kink IRMs leave null so the section is omitted entirely.
  const emptyPending: PendingResult = { name: null, activateAt: null }
  return {
    irmConfigNames: { silo0: name0, silo1: name1 },
    pendingIrmInfo: {
      silo0: silo0IsKink ? (pendingResults[0] ?? emptyPending) : null,
      silo1: silo1IsKink ? (pendingResults[1] ?? emptyPending) : null
    },
    irmConfigHistory: {
      silo0: silo0IsKink ? history0 : null,
      silo1: silo1IsKink ? history1 : null
    }
  }
}
