'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWizard, IRMConfig } from '@/contexts/WizardContext'
import { parseJsonPreservingBigInt } from '@/utils/parseJsonPreservingBigInt'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import ContractInfo from '@/components/ContractInfo'
import { getChainName } from '@/utils/networks'
import { formatToE18 } from '@/utils/formatting'
import dynamicKinkModelFactoryArtifact from '@/abis/silo/DynamicKinkModelFactory.json'
import Button from '@/components/Button'
import { wizardSansInputClass } from '@/constants/formStyles'

type FoundryArtifact = { abi: ethers.InterfaceAbi }
const dynamicKinkModelFactoryAbi = (dynamicKinkModelFactoryArtifact as FoundryArtifact).abi

interface KinkConfigItem {
  name: string
  config: Record<string, number>
}

interface KinkImmutableItem {
  name: string
  timelock: number
  rcompCap: number
}

const KINK_CONFIGS_URL = 'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'
const KINK_IMMUTABLE_URL = 'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMImmutable.json'
const KINK_FACTORY_NAME = 'DynamicKinkModelFactory.sol'

export default function Step4IRMSelection() {
  const router = useRouter()
  const { wizardData, updateSelectedIRM0, updateSelectedIRM1, markStepCompleted } = useWizard()

  const [kinkConfigs, setKinkConfigs] = useState<KinkConfigItem[]>([])
  const [kinkImmutables, setKinkImmutables] = useState<KinkImmutableItem[]>([])
  const [filteredKinkConfigs, setFilteredKinkConfigs] = useState<KinkConfigItem[]>([])
  const [filteredKinkImmutables, setFilteredKinkImmutables] = useState<KinkImmutableItem[]>([])
  const [kinkConfigSearch, setKinkConfigSearch] = useState('')
  const [kinkImmutableSearch, setKinkImmutableSearch] = useState('')
  const [kinkFactory, setKinkFactory] = useState<{ address: string; version: string } | null>(null)
  const [kinkImplementation, setKinkImplementation] = useState<{ address: string; version: string } | null>(null)
  const [siloLensAddress, setSiloLensAddress] = useState<string>('')
  const [kinkToken0Config, setKinkToken0Config] = useState<KinkConfigItem | null>(null)
  const [kinkToken0Immutable, setKinkToken0Immutable] = useState<KinkImmutableItem | null>(null)
  const [kinkToken1Config, setKinkToken1Config] = useState<KinkConfigItem | null>(null)
  const [kinkToken1Immutable, setKinkToken1Immutable] = useState<KinkImmutableItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Rehydrate Kink selection from context when returning to step (lists must be loaded first)
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

  // Fetch Kink configs and immutables from repo once on mount
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

  // Fetch Kink factory address + Silo Lens once when chainId is set
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!chainId) return
    const chainName = getChainName(chainId)
    const fetchAll = async () => {
      try {
        const [kinkResResult, lensResResult] = await Promise.allSettled([
          fetch(`https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/${KINK_FACTORY_NAME}.json`),
          fetch(`https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deployments/${chainName}/SiloLens.sol.json`)
        ])
        const kinkRes = kinkResResult.status === 'fulfilled' ? kinkResResult.value : null
        const lensRes = lensResResult.status === 'fulfilled' ? lensResResult.value : null

        let kinkAddr = ''
        if (kinkRes?.ok) {
          const data = await kinkRes.json()
          kinkAddr = data.address && ethers.isAddress(data.address) ? data.address : ''
        }
        setKinkFactory(kinkAddr ? { address: kinkAddr, version: '' } : null)

        let lensAddr = ''
        if (lensRes?.ok) {
          const data = await lensRes.json()
          lensAddr = data.address && ethers.isAddress(data.address) ? data.address : ''
        }
        setSiloLensAddress(lensAddr)
      } catch (err) {
        console.warn('Failed to fetch factory or Lens:', err)
        setKinkFactory(null)
        setSiloLensAddress('')
      }
    }
    fetchAll()
  }, [wizardData.networkInfo?.chainId])

  // Fetch IRM implementation address from factory (factory.IRM())
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!kinkFactory?.address || !eth) {
      setKinkImplementation(null)
      return
    }
    const fetchImplementation = async () => {
      try {
        const provider = new ethers.BrowserProvider(eth)
        const factoryContract = new ethers.Contract(kinkFactory.address, dynamicKinkModelFactoryAbi, provider)
        const implAddress = await factoryContract.IRM()
        const addr = typeof implAddress === 'string' ? implAddress : (implAddress as { toString: () => string }).toString()
        if (addr && ethers.isAddress(addr)) {
          setKinkImplementation({ address: ethers.getAddress(addr), version: '' })
        } else {
          setKinkImplementation(null)
        }
      } catch (err) {
        console.warn('Failed to fetch IRM implementation from factory:', err)
        setKinkImplementation(null)
      }
    }
    fetchImplementation()
  }, [kinkFactory?.address])

  // Fetch Kink factory version and IRM implementation version via Silo Lens getVersions
  useEffect(() => {
    const chainId = wizardData.networkInfo?.chainId
    if (!siloLensAddress || !chainId) return
    const addresses: string[] = []
    if (kinkFactory?.address) addresses.push(kinkFactory.address)
    if (kinkImplementation?.address) addresses.push(kinkImplementation.address)
    if (addresses.length === 0) return

    const fetchVersions = async () => {
      if (!window.ethereum) return
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const versionsByAddress = await fetchSiloLensVersionsWithCache({
          provider,
          lensAddress: siloLensAddress,
          chainId,
          addresses
        })
        if (kinkFactory?.address) {
          const factoryVersion = versionsByAddress.get(kinkFactory.address.toLowerCase()) ?? ''
          setKinkFactory(prev => prev ? { ...prev, version: factoryVersion || '—' } : null)
        }
        if (kinkImplementation?.address) {
          const implVersion = versionsByAddress.get(kinkImplementation.address.toLowerCase()) ?? ''
          setKinkImplementation(prev => prev ? { ...prev, version: implVersion || '—' } : null)
        }
      } catch (err) {
        console.warn('Failed to fetch versions from Silo Lens:', err)
        setKinkFactory(prev => (prev ? { ...prev, version: '—' } : null))
        setKinkImplementation(prev => (prev ? { ...prev, version: '—' } : null))
      }
    }
    fetchVersions()
  }, [kinkFactory?.address, kinkImplementation?.address, siloLensAddress, wizardData.networkInfo?.chainId])

  // Kink filters
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

  // Sync Kink selection to context when selections change
  useEffect(() => {
    const irm0 = buildKinkIRMConfig(kinkToken0Config, kinkToken0Immutable)
    const irm1 = buildKinkIRMConfig(kinkToken1Config, kinkToken1Immutable)
    const existing0 = wizardData.selectedIRM0?.name ?? ''
    const existing1 = wizardData.selectedIRM1?.name ?? ''
    if (irm0) updateSelectedIRM0(irm0)
    else if (!existing0.includes(':')) updateSelectedIRM0({ name: '', config: {} })
    if (irm1) updateSelectedIRM1(irm1)
    else if (!existing1.includes(':')) updateSelectedIRM1({ name: '', config: {} })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when kink selection state changes
  }, [kinkToken0Config, kinkToken0Immutable, kinkToken1Config, kinkToken1Immutable])

  useEffect(() => {
    setLoading(!(kinkConfigs.length > 0 && kinkImmutables.length > 0))
  }, [kinkConfigs.length, kinkImmutables.length])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []
    if (!kinkToken0Config || !kinkToken0Immutable) errors.push('Please select Config and Immutable for Token 0')
    if (!kinkToken1Config || !kinkToken1Immutable) errors.push('Please select Config and Immutable for Token 1')
    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }
    setError('')
    markStepCompleted(5)
    router.push('/wizard?step=6')
  }

  const goToPreviousStep = () => {
    router.push('/wizard?step=4')
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">
          Step 5: Interest Rate Model Selection
        </h1>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400 font-medium mb-2">Please fix the following:</p>
          <ul className="list-disc list-inside text-red-400 text-sm space-y-1">
            {error.split('\n').map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Interest Rate Model (implementation from factory.IRM()) */}
            <div className="mb-6">
              {kinkImplementation?.address && wizardData.networkInfo?.chainId ? (
                <ContractInfo
                  contractName="Interest Rate Model"
                  address={kinkImplementation.address}
                  version={kinkImplementation.version === '' ? 'Loading…' : kinkImplementation.version}
                  chainId={wizardData.networkInfo.chainId}
                  isOracle={false}
                  sourceContractName="DynamicKinkModelFactory"
                />
              ) : wizardData.networkInfo?.chainId && kinkFactory?.address ? (
                <div className="silo-panel p-4">
                  <p className="text-xs text-amber-400">Loading Interest Rate Model implementation from factory…</p>
                </div>
              ) : wizardData.networkInfo?.chainId ? (
                <div className="silo-panel p-4">
                  <p className="text-xs text-amber-400">Factory address not found for this network. Deploy may require manual config.</p>
                </div>
              ) : null}
            </div>

            {/* Two search boxes for Kink */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="silo-panel p-4">
                <label htmlFor="kink-config-search" className="block text-sm font-medium text-gray-300 mb-2">
                  Search Dynamic IRM configs (name / params)
                </label>
                <input
                  type="text"
                  id="kink-config-search"
                  value={kinkConfigSearch}
                  onChange={e => setKinkConfigSearch(e.target.value)}
                  placeholder="e.g. static-2.4-6"
                  className={wizardSansInputClass}
                />
                <p className="text-xs text-gray-400 mt-1">{filteredKinkConfigs.length} config(s)</p>
              </div>
              <div className="silo-panel p-4">
                <label htmlFor="kink-immutable-search" className="block text-sm font-medium text-gray-300 mb-2">
                  Search Dynamic IRM immutables (timelock / rcompCap)
                </label>
                <input
                  type="text"
                  id="kink-immutable-search"
                  value={kinkImmutableSearch}
                  onChange={e => setKinkImmutableSearch(e.target.value)}
                  placeholder="e.g. T1day_C200"
                  className={wizardSansInputClass}
                />
                <p className="text-xs text-gray-400 mt-1">{filteredKinkImmutables.length} immutable(s)</p>
              </div>
            </div>

            {/* Token 0 & Token 1: each with Config + Immutable selector in separate boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Token 0 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">
                  <span className="text-[var(--silo-accent)] font-bold">{wizardData.token0?.symbol || 'Token 0'}</span>
                </h3>

                <div className="silo-panel p-4">
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
                          className={`border rounded-lg p-2 cursor-pointer text-sm transition-colors ${
                            kinkToken0Config?.name === cfg.name
                              ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_52%,var(--silo-surface))] text-[var(--silo-text)]'
                              : 'border-[var(--silo-border)] bg-[var(--silo-surface)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))]'
                          }`}
                          onClick={() => setKinkToken0Config(cfg)}
                        >
                          <span className="font-medium text-white">{cfg.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="silo-panel p-4">
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
                          className={`border rounded-lg p-2 cursor-pointer text-sm transition-colors ${
                            kinkToken0Immutable?.name === imm.name
                              ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_52%,var(--silo-surface))] text-[var(--silo-text)]'
                              : 'border-[var(--silo-border)] bg-[var(--silo-surface)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))]'
                          }`}
                          onClick={() => setKinkToken0Immutable(imm)}
                        >
                          <span className="font-medium text-white">{imm.name}</span>
                          <span className="text-gray-400 text-xs ml-2">timelock: {imm.timelock}, rcompCap: {formatToE18(imm.rcompCap)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {kinkToken0Config && kinkToken0Immutable && (
                  <p className="text-xs status-muted-success">
                    Combined: {kinkToken0Config.name}:{kinkToken0Immutable.name}
                  </p>
                )}
              </div>

              {/* Token 1 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">
                  <span className="text-[var(--silo-accent)] font-bold">{wizardData.token1?.symbol || 'Token 1'}</span>
                </h3>

                <div className="silo-panel p-4">
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
                          className={`border rounded-lg p-2 cursor-pointer text-sm transition-colors ${
                            kinkToken1Config?.name === cfg.name
                              ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_52%,var(--silo-surface))] text-[var(--silo-text)]'
                              : 'border-[var(--silo-border)] bg-[var(--silo-surface)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))]'
                          }`}
                          onClick={() => setKinkToken1Config(cfg)}
                        >
                          <span className="font-medium text-white">{cfg.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="silo-panel p-4">
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
                          className={`border rounded-lg p-2 cursor-pointer text-sm transition-colors ${
                            kinkToken1Immutable?.name === imm.name
                              ? 'border-[var(--silo-accent)] bg-[color-mix(in_srgb,var(--silo-accent-soft)_52%,var(--silo-surface))] text-[var(--silo-text)]'
                              : 'border-[var(--silo-border)] bg-[var(--silo-surface)] hover:border-[color-mix(in_srgb,var(--silo-accent)_45%,var(--silo-border))]'
                          }`}
                          onClick={() => setKinkToken1Immutable(imm)}
                        >
                          <span className="font-medium text-white">{imm.name}</span>
                          <span className="text-gray-400 text-xs ml-2">timelock: {imm.timelock}, rcompCap: {formatToE18(imm.rcompCap)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {kinkToken1Config && kinkToken1Immutable && (
                  <p className="text-xs status-muted-success">
                    Combined: {kinkToken1Config.name}:{kinkToken1Immutable.name}
                  </p>
                )}
              </div>
            </div>

        <div className="flex justify-between">
          <Button type="button" variant="secondary" size="lg" onClick={goToPreviousStep}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Manageable Oracle</span>
          </Button>
          <Button type="submit" variant="primary" size="lg">
            <span>Oracle/IRM Owner</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </form>
    </div>
  )
}
