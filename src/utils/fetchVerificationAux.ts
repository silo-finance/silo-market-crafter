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
const KINK_IMMUTABLE_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMImmutable.json'

type KinkImmutableItem = { name: string; timelock: unknown; rcompCap: unknown }

let kinkConfigCache: KinkConfigItem[] | null = null
let kinkConfigPromise: Promise<KinkConfigItem[] | null> | null = null

async function getKinkConfigCache(): Promise<KinkConfigItem[] | null> {
  if (kinkConfigCache) return kinkConfigCache
  if (kinkConfigPromise) return kinkConfigPromise
  kinkConfigPromise = (async () => {
    const [cfgRes, immRes] = await Promise.all([
      fetch(KINK_CONFIGS_URL),
      fetch(KINK_IMMUTABLE_URL)
    ])
    if (!cfgRes.ok || !immRes.ok) return null
    const cfgJson: KinkConfigItem[] = parseJsonPreservingBigInt(await cfgRes.text())
    parseJsonPreservingBigInt(await immRes.text()) as KinkImmutableItem[]
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
  const empty: IrmDisplayAux = {
    irmConfigNames: { silo0: null, silo1: null },
    pendingIrmInfo: { silo0: null, silo1: null },
    irmConfigHistory: { silo0: null, silo1: null }
  }

  try {
    const cfgJson = await getKinkConfigCache()
    if (!cfgJson) return empty

    const name0 = resolveKinkConfigDisplayName(marketConfig.silo0.interestRateModel, cfgJson)
    const name1 = resolveKinkConfigDisplayName(marketConfig.silo1.interestRateModel, cfgJson)

    type PendingInput = {
      irmAddress: string
      version: string | undefined
    }
    type PendingSlot =
      | { kind: 'skip' }
      | { kind: 'fetch'; pendingIdx: number; activateIdx: number }

    const pendingInputs: PendingInput[] = [
      {
        irmAddress: marketConfig.silo0.interestRateModel.address,
        version: marketConfig.silo0.interestRateModel.version
      },
      {
        irmAddress: marketConfig.silo1.interestRateModel.address,
        version: marketConfig.silo1.interestRateModel.version
      }
    ]

    const pendingL1Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
    const slots: PendingSlot[] = pendingInputs.map((input) => {
      if (!input.irmAddress || input.irmAddress === ethers.ZeroAddress || !input.version) {
        return { kind: 'skip' }
      }
      const [contractName] = input.version.split(' ')
      if (contractName !== 'DynamicKinkModel') return { kind: 'skip' }

      const pendingIdx = pendingL1Calls.length
      pendingL1Calls.push(
        buildReadMulticallCall<unknown>({
          target: input.irmAddress as `0x${string}`,
          abi: dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
          functionName: 'pendingIrmConfig',
          allowFailure: true
        })
      )
      const activateIdx = pendingL1Calls.length
      pendingL1Calls.push(
        buildReadMulticallCall<unknown>({
          target: input.irmAddress as `0x${string}`,
          abi: dynamicKinkModelAbi as unknown as ethers.InterfaceAbi,
          functionName: 'activateConfigAt',
          allowFailure: true
        })
      )
      return { kind: 'fetch', pendingIdx, activateIdx }
    })

    const pendingL1Results = pendingL1Calls.length > 0
      ? await executeReadMulticall<unknown>(provider, pendingL1Calls, { debugLabel: 'irmPendingL1' })
      : []

    type L2Slot = { kind: 'skip'; activateAt: number | null } | {
      kind: 'fetch'
      activateAt: number | null
      getConfigIdx: number
    }

    const pendingL2Calls: ReturnType<typeof buildReadMulticallCall<unknown>>[] = []
    const l2Slots: L2Slot[] = slots.map((slot) => {
      if (slot.kind === 'skip') return { kind: 'skip', activateAt: null }
      const pendingRaw = pendingL1Results[slot.pendingIdx]
      const activateRaw = pendingL1Results[slot.activateIdx]
      const pendingAddr = pendingRaw != null ? String(pendingRaw) : ''
      if (!pendingAddr || pendingAddr === ethers.ZeroAddress) {
        return { kind: 'skip', activateAt: null }
      }
      const activateAt = activateRaw != null
        ? Number(BigInt(String(activateRaw)))
        : null
      const getConfigIdx = pendingL2Calls.length
      pendingL2Calls.push(
        buildReadMulticallCall<unknown>({
          target: pendingAddr as `0x${string}`,
          abi: dynamicKinkModelConfigAbi as unknown as ethers.InterfaceAbi,
          functionName: 'getConfig',
          allowFailure: true
        })
      )
      return { kind: 'fetch', activateAt, getConfigIdx }
    })

    const pendingL2Results = pendingL2Calls.length > 0
      ? await executeReadMulticall<unknown>(provider, pendingL2Calls, { debugLabel: 'irmPendingL2' })
      : []

    const pendingResults = l2Slots.map((slot) => {
      if (slot.kind === 'skip') return { name: null, activateAt: slot.activateAt }
      const configTuple = pendingL2Results[slot.getConfigIdx] as unknown[] | null | undefined
      const configObj = toKinkConfigObject(configTuple?.[0])
      if (!configObj) return { name: null, activateAt: slot.activateAt }
      const pendingName = resolveKinkConfigDisplayName(
        { type: 'DynamicKinkModel', config: configObj },
        cfgJson
      )
      return { name: pendingName, activateAt: slot.activateAt }
    })

    const fetchHistoryForSilo = async (
      irmAddress: string,
      version: string | undefined,
      currentConfigAddress: string | undefined
    ): Promise<string[]> => {
      if (!irmAddress || irmAddress === ethers.ZeroAddress || !version || !currentConfigAddress || currentConfigAddress === ethers.ZeroAddress) {
        return []
      }
      const [contractName] = version.split(' ')
      if (contractName !== 'DynamicKinkModel') return []

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
          const historyName = resolveKinkConfigDisplayName(
            { type: 'DynamicKinkModel', config: configObj },
            cfgJson
          )
          names.push(historyName ?? 'not able to match')
          currentAddr = prevAddrStr
        }
        return names
      } catch {
        return []
      }
    }

    const [history0, history1] = await Promise.all([
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

    return {
      irmConfigNames: { silo0: name0, silo1: name1 },
      pendingIrmInfo: {
        silo0: pendingResults[0] ?? { name: null, activateAt: null },
        silo1: pendingResults[1] ?? { name: null, activateAt: null }
      },
      irmConfigHistory: { silo0: history0, silo1: history1 }
    }
  } catch {
    return empty
  }
}
