'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard, IRMConfig, IRMModelType } from '@/contexts/WizardContext'
import { parseJsonPreservingBigInt } from '@/utils/parseJsonPreservingBigInt'
import { getCachedVersion, setCachedVersion } from '@/utils/versionCache'
import ContractInfo from '@/components/ContractInfo'
import siloLensArtifact from '@/abis/silo/ISiloLens.json'

const siloLensAbi = (siloLensArtifact as { abi: ethers.InterfaceAbi }).abi

interface IRMConfigItem {
  name: string
  config: {
    [key: string]: string | number | boolean
  }
}

type IRMDeployments = IRMConfigItem[]

interface KinkConfigItem {
  name: string
  config: Record<string, number>
}

interface KinkImmutableItem {
  name: string
  timelock: number
  rcompCap: number
}

// Kink configs: always fetched from repo (do not copy locally – they may change).
const KINK_CONFIGS_URL = 'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'
const KINK_IMMUTABLE_URL = 'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMImmutable.json'
const KINK_FACTORY_NAME = 'DynamicKinkModelFactory.sol'
const IRM_V2_FACTORY_NAME = 'InterestRateModelV2Factory.sol'

const getChainName = (chainId: string): string => {
  const chainMap: { [key: string]: string } = {
    '1': 'mainnet',
    '137': 'polygon',
    '42161': 'arbitrum_one',
    '43114': 'avalanche',
    '8453': 'base',
    '11155111': 'sepolia',
    '31337': 'anvil',
    '146': 'sonic',
    '653': 'sonic_testnet'
  }
  return chainMap[chainId] || `chain_${chainId}`
}



/** Format rcompCap (18 decimals) as e18 notation, e.g. 2e18 instead of 2000000000000000000 */
function formatRcompCapE18(val: number | bigint | string): string {
  const n = typeof val === 'bigint' ? Number(val) : typeof val === 'string' ? Number(val) : val
  const coeff = n / 1e18
  if (Number.isInteger(coeff)) return `${coeff}e18`
  const rounded = Math.round(coeff * 100) / 100
  return `${rounded}e18`
}

export default function Step4IRMSelection() {
  const router = useRouter()
  const { wizardData, updateSelectedIRM0, updateSelectedIRM1, updateIRMModelType, markStepCompleted } = useWizard()

  // Tab: Kink (default) | IRM
  const [activeTab, setActiveTab] = useState<IRMModelType>(wizardData.irmModelType)

  // ----- IRM (legacy) state -----
  const [, setIrmDeployments] = useState<IRMDeployments | null>(null)
  const [availableIRMs, setAvailableIRMs] = useState<IRMConfig[]>([])
  const [filteredIRMs, setFilteredIRMs] = useState<IRMConfig[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIRM0, setSelectedIRM0] = useState<IRMConfig | null>(wizardData.selectedIRM0)
  const [selectedIRM1, setSelectedIRM1] = useState<IRMConfig | null>(wizardData.selectedIRM1)
  const [irmV2Factory, setIrmV2Factory] = useState<{ address: string; version: string } | null>(null)
  const [irmV2SiloLensAddress, setIrmV2SiloLensAddress] = useState<string>('')

  // ----- Kink state -----
  const [kinkConfigs, setKinkConfigs] = useState<KinkConfigItem[]>([])
  const [kinkImmutables, setKinkImmutables] = useState<KinkImmutableItem[]>([])
  const [filteredKinkConfigs, setFilteredKinkConfigs] = useState<KinkConfigItem[]>([])
  const [filteredKinkImmutables, setFilteredKinkImmutables] = useState<KinkImmutableItem[]>([])
  const [kinkConfigSearch, setKinkConfigSearch] = useState('')
  const [kinkImmutableSearch, setKinkImmutableSearch] = useState('')
  const [kinkFactory, setKinkFactory] = useState<{ address: string; version: string } | null>(null)
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [kinkToken0Config, setKinkToken0Config] = useState<KinkConfigItem | null>(null)
  const [kinkToken0Immutable, setKinkToken0Immutable] = useState<KinkImmutableItem | null>(null)
  const [kinkToken1Config, setKinkToken1Config] = useState<KinkConfigItem | null>(null)
  const [kinkToken1Immutable, setKinkToken1Immutable] = useState<KinkImmutableItem | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Sync tab with context
  useEffect(() => {
    if (activeTab !== wizardData.irmModelType) {
      updateIRMModelType(activeTab)
    }
  }, [activeTab, updateIRMModelType, wizardData.irmModelType])

  // Sync local IRM selection with context when on IRM tab (and when returning to step – restore from context)
  useEffect(() => {
    if (activeTab === 'irm') {
      setSelectedIRM0(wizardData.selectedIRM0)
      setSelectedIRM1(wizardData.selectedIRM1)
    }
  }, [activeTab, wizardData.selectedIRM0, wizardData.selectedIRM1])

  // Rehydrate Kink selection from context when returning to step 4 (lists must be loaded first)
  useEffect(() => {
    if (kinkConfigs.length === 0 || kinkImmutables.length === 0) return
    const name0 = wizardData.selectedIRM0?.name ?? ''
    const name1 = wizardData.selectedIRM1?.name ?? ''
    if (name0.includes(':')) {
      const [configName0, immutableName0] = name0.split(':')
      const cfg0 = kinkConfigs.find(c => c.name === configName0)
      const imm0 = kinkImmutables.find(i => i.name === immutableName0)
      if (cfg0 && imm0) {
        setKinkToken0Config(cfg0)
        setKinkToken0Immutable(imm0)
      }
    }
    if (name1.includes(':')) {
      const [configName1, immutableName1] = name1.split(':')
      const cfg1 = kinkConfigs.find(c => c.name === configName1)
      const imm1 = kinkImmutables.find(i => i.name === immutableName1)
      if (cfg1 && imm1) {
        setKinkToken1Config(cfg1)
        setKinkToken1Immutable(imm1)
      }
    }
  }, [kinkConfigs, kinkImmutables, wizardData.selectedIRM0?.name, wizardData.selectedIRM1?.name])

  // ----- Fetch IRM (legacy) configs from repo once on mount (so IRM tab has data when switching) -----
  useEffect(() => {
    const fetchIRMConfigs = async () => {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/InterestRateModelConfigs.json'
        )
        if (!response.ok) throw new Error(`Failed to fetch IRM configs: ${response.statusText}`)
        const rawText = await response.text()
        const data: IRMDeployments = parseJsonPreservingBigInt(rawText)
        setIrmDeployments(data)
        const irmConfigs: IRMConfig[] = data.map(item => ({
          name: item.name,
          config: item.config
        }))
        setAvailableIRMs(irmConfigs)
        setFilteredIRMs(irmConfigs)
      } catch (err) {
        console.error('Error fetching IRM configs:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch IRM configurations')
      }
    }
    fetchIRMConfigs()
  }, [])

  // ----- Fetch Kink configs and immutables from repo once on mount (so both tabs have data when switching) -----
  useEffect(() => {
    const fetchKink = async () => {
      try {
        const [configRes, immRes] = await Promise.all([
          fetch(KINK_CONFIGS_URL),
          fetch(KINK_IMMUTABLE_URL)
        ])
        if (!configRes.ok || !immRes.ok) throw new Error('Failed to fetch Kink configs')
        const configs: KinkConfigItem[] = parseJsonPreservingBigInt(await configRes.text())
        const immutables: KinkImmutableItem[] = parseJsonPreservingBigInt(await immRes.text())
        setKinkConfigs(configs)
        setKinkImmutables(immutables)
        setFilteredKinkConfigs(configs)
        setFilteredKinkImmutables(immutables)
      } catch (err) {
        console.error('Error fetching Kink configs:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch Kink configurations')
      }
    }
    fetchKink()
  }, [])

  // ----- Fetch both factory addresses + Silo Lens once when chainId is set (so both tabs have data when switching) -----
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!chainId) return
    const chainName = getChainName(chainId)
    const fetchAll = async () => {
      try {
        const [kinkRes, irmV2Res, lensRes] = await Promise.all([
          fetch(`https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${KINK_FACTORY_NAME}.json`),
          fetch(`https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${IRM_V2_FACTORY_NAME}.json`),
          fetch(`https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloLens.sol.json`)
        ])
        let kinkAddr = ''
        if (kinkRes.ok) {
          const data = await kinkRes.json()
          kinkAddr = data.address && ethers.isAddress(data.address) ? data.address : ''
        }
        setKinkFactory(kinkAddr ? { address: kinkAddr, version: '' } : null)
        let irmV2Addr = ''
        if (irmV2Res.ok) {
          const data = await irmV2Res.json()
          irmV2Addr = data.address && ethers.isAddress(data.address) ? data.address : ''
        }
        setIrmV2Factory(irmV2Addr ? { address: irmV2Addr, version: '' } : null)
        let lensAddr = ''
        if (lensRes.ok) {
          const data = await lensRes.json()
          lensAddr = data.address && ethers.isAddress(data.address) ? data.address : ''
        }
        setSiloLensAddress(lensAddr)
        setIrmV2SiloLensAddress(lensAddr)
      } catch (err) {
        console.warn('Failed to fetch factory or Lens:', err)
        setKinkFactory(null)
        setIrmV2Factory(null)
        setSiloLensAddress('')
        setIrmV2SiloLensAddress('')
      }
    }
    fetchAll()
  }, [wizardData.networkInfo?.chainId])

  // ----- Fetch Kink factory version via Silo Lens (cached per chainId+address) -----
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!kinkFactory?.address || !siloLensAddress || !chainId) return
    const cached = getCachedVersion(chainId, kinkFactory.address)
    if (cached != null) {
      setKinkFactory(prev => prev ? { ...prev, version: cached } : null)
      return
    }
    const fetchVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const lensContract = new ethers.Contract(siloLensAddress, siloLensAbi, provider)
        const version = String(await lensContract.getVersion(kinkFactory!.address))
        setCachedVersion(chainId, kinkFactory!.address, version)
        setKinkFactory(prev => prev ? { ...prev, version } : null)
      } catch (err) {
        console.warn('Failed to fetch Kink factory version from Silo Lens:', err)
        const fallback = '—'
        setCachedVersion(chainId, kinkFactory!.address, fallback)
        setKinkFactory(prev => prev ? { ...prev, version: fallback } : null)
      }
    }
    fetchVersion()
    // Intentionally narrow deps: only re-fetch when factory address or chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kinkFactory?.address, siloLensAddress, wizardData.networkInfo?.chainId])

  // ----- Fetch IRM V2 factory version via Silo Lens (cached per chainId+address) -----
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!irmV2Factory?.address || !irmV2SiloLensAddress || !chainId) return
    const cached = getCachedVersion(chainId, irmV2Factory.address)
    if (cached != null) {
      setIrmV2Factory(prev => prev ? { ...prev, version: cached } : null)
      return
    }
    const fetchVersion = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const lensContract = new ethers.Contract(irmV2SiloLensAddress, siloLensAbi, provider)
        const version = String(await lensContract.getVersion(irmV2Factory!.address))
        setCachedVersion(chainId, irmV2Factory!.address, version)
        setIrmV2Factory(prev => prev ? { ...prev, version } : null)
      } catch (err) {
        console.warn('Failed to fetch IRM V2 factory version from Silo Lens:', err)
        const fallback = '—'
        setCachedVersion(chainId, irmV2Factory!.address, fallback)
        setIrmV2Factory(prev => prev ? { ...prev, version: fallback } : null)
      }
    }
    fetchVersion()
    // Intentionally narrow deps: only re-fetch when factory address or chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irmV2Factory?.address, irmV2SiloLensAddress, wizardData.networkInfo?.chainId])

  // ----- Kink filters -----
  useEffect(() => {
    const c = kinkConfigSearch.trim().toLowerCase()
    const i = kinkImmutableSearch.trim().toLowerCase()
    setFilteredKinkConfigs(
      c ? kinkConfigs.filter(k => k.name.toLowerCase().includes(c)) : kinkConfigs
    )
    setFilteredKinkImmutables(
      i ? kinkImmutables.filter(k => k.name.toLowerCase().includes(i)) : kinkImmutables
    )
  }, [kinkConfigSearch, kinkImmutableSearch, kinkConfigs, kinkImmutables])

  // ----- IRM filter -----
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredIRMs(availableIRMs)
    } else {
      const filtered = availableIRMs.filter(irm =>
        irm.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      const selectedItems = []
      if (selectedIRM0 && !filtered.find(irm => irm.name === selectedIRM0.name)) selectedItems.push(selectedIRM0)
      if (selectedIRM1 && !filtered.find(irm => irm.name === selectedIRM1.name)) selectedItems.push(selectedIRM1)
      setFilteredIRMs([...filtered, ...selectedItems])
    }
  }, [searchTerm, availableIRMs, selectedIRM0, selectedIRM1])

  // ----- Sync Kink selection to context -----
  const buildKinkIRMConfig = (config: KinkConfigItem | null, immutable: KinkImmutableItem | null): IRMConfig | null => {
    if (!config || !immutable) return null
    const name = `${config.name}:${immutable.name}`
    const merged = {
      ...config.config,
      timelock: immutable.timelock,
      rcompCap: immutable.rcompCap
    } as { [key: string]: string | number | boolean }
    return { name, config: merged }
  }

  // Sync Kink selection to context when Kink selections change. Do not overwrite context with empty when returning to step (context still has valid "config:immutable" – rehydration will restore local state).
  useEffect(() => {
    if (activeTab !== 'kink') return
    const irm0 = buildKinkIRMConfig(kinkToken0Config, kinkToken0Immutable)
    const irm1 = buildKinkIRMConfig(kinkToken1Config, kinkToken1Immutable)
    const existing0 = wizardData.selectedIRM0?.name ?? ''
    const existing1 = wizardData.selectedIRM1?.name ?? ''
    if (irm0) updateSelectedIRM0(irm0)
    else if (!existing0.includes(':')) updateSelectedIRM0({ name: '', config: {} })
    if (irm1) updateSelectedIRM1(irm1)
    else if (!existing1.includes(':')) updateSelectedIRM1({ name: '', config: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when kink selection state changes
  }, [activeTab, kinkToken0Config, kinkToken0Immutable, kinkToken1Config, kinkToken1Immutable])

  // Loading per tab (for inline "Loading…" in lists only; we no longer block the whole page)
  useEffect(() => {
    const irmReady = availableIRMs.length > 0
    const kinkReady = kinkConfigs.length > 0 && kinkImmutables.length > 0
    setLoading(activeTab === 'irm' ? !irmReady : !kinkReady)
  }, [activeTab, availableIRMs.length, kinkConfigs.length, kinkImmutables.length])

  const handleIRMSelection = (tokenIndex: 0 | 1, irm: IRMConfig) => {
    if (tokenIndex === 0) {
      setSelectedIRM0(irm)
      updateSelectedIRM0(irm)
    } else {
      setSelectedIRM1(irm)
      updateSelectedIRM1(irm)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeTab === 'kink') {
      if (!kinkToken0Config || !kinkToken0Immutable || !kinkToken1Config || !kinkToken1Immutable) {
        setError('Please select both Config and Immutable for Token 0 and Token 1')
        return
      }
    } else {
      if (!selectedIRM0 || !selectedIRM1) {
        setError('Please select Interest Rate Models for both tokens')
        return
      }
    }
    setError('')
    markStepCompleted(4)
    router.push('/wizard?step=5')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=3')
  }

  const formatParameterValue = (value: string | number | boolean): string => {
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const canProceedKink = kinkToken0Config && kinkToken0Immutable && kinkToken1Config && kinkToken1Immutable
  const canProceedIRM = selectedIRM0 && selectedIRM1
  const canProceed = activeTab === 'kink' ? canProceedKink : canProceedIRM

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">
          Step 4: Interest Rate Model Selection
        </h1>
      </div>

      {/* Tabs: Dynamic IRM (default) | IRM V2 */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          type="button"
          onClick={() => { setActiveTab('kink'); setError('') }}
          className={`px-6 py-3 font-medium rounded-t-lg transition-colors ${
            activeTab === 'kink'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Dynamic IRM
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('irm'); setError('') }}
          className={`px-6 py-3 font-medium rounded-t-lg transition-colors ${
            activeTab === 'irm'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          IRM V2 (old)
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <div className="text-red-400 text-sm">✗ {error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {activeTab === 'kink' && (
          <>
            {/* Dynamic IRM factory + address (explorer link) + version at top */}
            <div className="mb-6">
              {kinkFactory?.address && wizardData.networkInfo?.chainId ? (
                <ContractInfo
                  contractName={KINK_FACTORY_NAME}
                  address={kinkFactory.address}
                  version={kinkFactory.version === '' ? 'Loading…' : kinkFactory.version}
                  chainId={wizardData.networkInfo.chainId}
                  isOracle={false}
                />
              ) : wizardData.networkInfo?.chainId ? (
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <p className="text-xs text-amber-400">Factory address not found for this network. Deploy may require manual config.</p>
                </div>
              ) : null}
            </div>

            {/* Two search boxes for Kink */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <label htmlFor="kink-config-search" className="block text-sm font-medium text-gray-300 mb-2">
                  Search Dynamic IRM configs (name / params)
                </label>
                <input
                  type="text"
                  id="kink-config-search"
                  value={kinkConfigSearch}
                  onChange={e => setKinkConfigSearch(e.target.value)}
                  placeholder="e.g. static-2.4-6"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">{filteredKinkConfigs.length} config(s)</p>
              </div>
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <label htmlFor="kink-immutable-search" className="block text-sm font-medium text-gray-300 mb-2">
                  Search Dynamic IRM immutables (timelock / rcompCap)
                </label>
                <input
                  type="text"
                  id="kink-immutable-search"
                  value={kinkImmutableSearch}
                  onChange={e => setKinkImmutableSearch(e.target.value)}
                  placeholder="e.g. T1day_C200"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">{filteredKinkImmutables.length} immutable(s)</p>
              </div>
            </div>

            {/* Token 0 & Token 1: each with Config + Immutable selector in separate boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Token 0 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">
                  <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
                </h3>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h4 className="text-base font-medium text-white mb-3">Config</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredKinkConfigs.length === 0 ? (
                      <div className="border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                        {loading ? 'Loading configs…' : 'No configs match the search.'}
                      </div>
                    ) : (
                      filteredKinkConfigs.map((cfg) => (
                        <div
                          key={`t0-cfg-${cfg.name}`}
                          className={`border rounded-lg p-2 cursor-pointer text-sm ${
                            kinkToken0Config?.name === cfg.name ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => setKinkToken0Config(cfg)}
                        >
                          <span className="font-medium text-white">{cfg.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h4 className="text-base font-medium text-white mb-3">Immutable</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredKinkImmutables.length === 0 ? (
                      <div className="border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                        {loading ? 'Loading immutables…' : 'No immutables match the search.'}
                      </div>
                    ) : (
                      filteredKinkImmutables.map((imm) => (
                        <div
                          key={`t0-imm-${imm.name}`}
                          className={`border rounded-lg p-2 cursor-pointer text-sm ${
                            kinkToken0Immutable?.name === imm.name ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => setKinkToken0Immutable(imm)}
                        >
                          <span className="font-medium text-white">{imm.name}</span>
                          <span className="text-gray-400 text-xs ml-2">timelock: {imm.timelock}, rcompCap: {formatRcompCapE18(imm.rcompCap)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {kinkToken0Config && kinkToken0Immutable && (
                  <p className="text-xs text-green-400">
                    Combined: {kinkToken0Config.name}:{kinkToken0Immutable.name}
                  </p>
                )}
              </div>

              {/* Token 1 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">
                  <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
                </h3>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h4 className="text-base font-medium text-white mb-3">Config</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredKinkConfigs.length === 0 ? (
                      <div className="border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                        {loading ? 'Loading configs…' : 'No configs match the search.'}
                      </div>
                    ) : (
                      filteredKinkConfigs.map((cfg) => (
                        <div
                          key={`t1-cfg-${cfg.name}`}
                          className={`border rounded-lg p-2 cursor-pointer text-sm ${
                            kinkToken1Config?.name === cfg.name ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => setKinkToken1Config(cfg)}
                        >
                          <span className="font-medium text-white">{cfg.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h4 className="text-base font-medium text-white mb-3">Immutable</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredKinkImmutables.length === 0 ? (
                      <div className="border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                        {loading ? 'Loading immutables…' : 'No immutables match the search.'}
                      </div>
                    ) : (
                      filteredKinkImmutables.map((imm) => (
                        <div
                          key={`t1-imm-${imm.name}`}
                          className={`border rounded-lg p-2 cursor-pointer text-sm ${
                            kinkToken1Immutable?.name === imm.name ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => setKinkToken1Immutable(imm)}
                        >
                          <span className="font-medium text-white">{imm.name}</span>
                          <span className="text-gray-400 text-xs ml-2">timelock: {imm.timelock}, rcompCap: {formatRcompCapE18(imm.rcompCap)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {kinkToken1Config && kinkToken1Immutable && (
                  <p className="text-xs text-green-400">
                    Combined: {kinkToken1Config.name}:{kinkToken1Immutable.name}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'irm' && (
          <>
            {/* IRM V2 (old) factory + address (explorer link) + version at top */}
            <div className="mb-6">
              {irmV2Factory?.address && wizardData.networkInfo?.chainId ? (
                <ContractInfo
                  contractName={IRM_V2_FACTORY_NAME}
                  address={irmV2Factory.address}
                  version={irmV2Factory.version === '' ? 'Loading…' : irmV2Factory.version}
                  chainId={wizardData.networkInfo.chainId}
                  isOracle={false}
                />
              ) : wizardData.networkInfo?.chainId ? (
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <p className="text-xs text-amber-400">Factory address not found for this network.</p>
                </div>
              ) : null}
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
              <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
                Search Interest Rate Models
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name (case insensitive)..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-2">
                Found {filteredIRMs.length} IRM{filteredIRMs.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* IRM Token 0 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Interest Rate Model for <span className="text-blue-400 font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
                </h3>
                {loading && filteredIRMs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    Loading configurations…
                  </div>
                ) : filteredIRMs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {searchTerm ? 'No IRMs found matching your search.' : 'No IRMs available.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredIRMs.map((irm) => {
                      const isSelected = selectedIRM0?.name === irm.name
                      return (
                        <div
                          key={`token0-${irm.name}`}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => handleIRMSelection(0, irm)}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="radio"
                              name="irm0"
                              value={irm.name}
                              checked={isSelected}
                              onChange={() => handleIRMSelection(0, irm)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-white">{irm.name}</h4>
                              {isSelected && (
                                <div className="mt-3 bg-gray-800 rounded p-3 text-xs text-gray-300 space-y-1">
                                  {Object.entries(irm.config).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-blue-400">{key}:</span>
                                      <span className="text-gray-200">{formatParameterValue(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* IRM Token 1 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Interest Rate Model for <span className="text-blue-400 font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
                </h3>
                {loading && filteredIRMs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    Loading configurations…
                  </div>
                ) : filteredIRMs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {searchTerm ? 'No IRMs found matching your search.' : 'No IRMs available.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredIRMs.map((irm) => {
                      const isSelected = selectedIRM1?.name === irm.name
                      return (
                        <div
                          key={`token1-${irm.name}`}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => handleIRMSelection(1, irm)}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="radio"
                              name="irm1"
                              value={irm.name}
                              checked={isSelected}
                              onChange={() => handleIRMSelection(1, irm)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-white">{irm.name}</h4>
                              {isSelected && (
                                <div className="mt-3 bg-gray-800 rounded p-3 text-xs text-gray-300 space-y-1">
                                  {Object.entries(irm.config).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-blue-400">{key}:</span>
                                      <span className="text-gray-200">{formatParameterValue(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={goToPreviousStep}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Oracle Configuration</span>
          </button>
          <button
            type="submit"
            disabled={!canProceed}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <span>Borrow Setup</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
