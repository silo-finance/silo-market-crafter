'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { getChainName, getExplorerAddressUrl } from '@/utils/networks'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { ethers } from 'ethers'
import ContractInfo from '@/components/ContractInfo'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import OwnerSelectionBlock from '@/components/OwnerSelectionBlock'
import manageableOracleFactoryAbi from '@/abis/oracle/IManageableOracleFactory.json'

const MANAGEABLE_ORACLE_FACTORY_NAME = 'ManageableOracleFactory'

export default function Step4ManageableOracle() {
  const router = useRouter()
  const { wizardData, updateManageableOracle, updateManageableOracleTimelock, updateManageableOracleOwnerAddress, markStepCompleted } = useWizard()

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
        const provider = new ethers.BrowserProvider(window.ethereum)
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
      'function MIN_TIMELOCK() view returns (uint32)',
      'function MAX_TIMELOCK() view returns (uint32)'
    ]

    const fetchTimelockRange = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(oracleImplementation, implTimelockAbi, provider)
        const [minSec, maxSec] = await Promise.all([
          contract.MIN_TIMELOCK(),
          contract.MAX_TIMELOCK()
        ])
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
    if (manageableEnabled && (timelockDayOptions.length === 0 || selectedTimelockDays === undefined || !hasValidOwner)) return
    updateManageableOracle(manageableEnabled)
    if (manageableEnabled && selectedTimelockDays !== undefined) {
      updateManageableOracleTimelock(selectedTimelockDays * SECONDS_PER_DAY)
    }
    markStepCompleted(4)
    router.push('/wizard?step=5')
  }

  const hasValidOwner = !!(wizardData.manageableOracleOwnerAddress && ethers.isAddress(wizardData.manageableOracleOwnerAddress) && wizardData.manageableOracleOwnerAddress !== ethers.ZeroAddress)
  const canProceed = !manageableEnabled || (timelockDayOptions.length > 0 && selectedTimelockDays !== undefined && hasValidOwner)

  const goToPreviousStep = () => {
    router.push('/wizard?step=3')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Step 4: Manageable Oracle
        </h1>
        <p className="text-gray-300 text-lg">
          Choose whether the Oracle can be updated in the future
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={manageableEnabled}
              onChange={(e) => {
                const checked = e.target.checked
                setManageableEnabled(checked)
                if (!checked) {
                  setSelectedTimelockDays(undefined)
                  updateManageableOracleTimelock(undefined)
                  updateManageableOracleOwnerAddress(null)
                }
              }}
              className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800 text-lime-600 focus:ring-lime-500 focus:ring-offset-gray-900"
            />
            <div>
              <span className="text-lg font-medium text-white group-hover:text-lime-50">
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

        {/* Manageable Oracle Owner selection */}
        {manageableEnabled && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-3">Manageable Oracle Owner</h3>
            <p className="text-sm text-gray-400 mb-4">
              The owner of the ManageableOracle contract. Only this address can propose oracle updates (subject to the timelock).
            </p>
            <OwnerSelectionBlock
              value={wizardData.manageableOracleOwnerAddress}
              onChange={updateManageableOracleOwnerAddress}
              chainId={wizardData.networkInfo?.chainId}
              networkName={wizardData.networkInfo?.networkName}
            />
          </div>
        )}

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
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">Oracle Implementation</p>
                  <span className="text-xs text-gray-400">
                    Source (Factory): {' '}
                    <a
                      href={getExplorerAddressUrl(wizardData.networkInfo!.chainId, manageableFactory.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-300 underline"
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
                      linkClassName="text-lime-600 hover:text-lime-500"
                    />
                  </div>
                  <div className="text-sm text-gray-300 whitespace-nowrap">
                    version: <span className="text-gray-400">{oracleImplementationVersion || 'Loading…'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Timelock selection */}
            {manageableEnabled && oracleImplementation && timelockDayOptions.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-white">Timelock (days)</p>
                <p className="text-xs text-gray-400">
                  Duration before oracle changes can take effect. Owner can propose changes; they execute after this period.
                </p>
                <div className="flex flex-wrap gap-2">
                  {timelockDayOptions.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedTimelockDays(days)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedTimelockDays === days
                          ? 'bg-lime-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {days} {days === 1 ? 'day' : 'days'}
                    </button>
                  ))}
                </div>
                {selectedTimelockDays !== undefined && (
                  <p className="text-xs text-gray-400 pt-1">
                    Used in transaction: <span className="text-gray-300 font-medium">{selectedTimelockDays * SECONDS_PER_DAY} seconds</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {manageableEnabled && !manageableFactory?.address && wizardData.networkInfo?.chainId && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-200">
              ManageableOracleFactory address was not found for this network. Deployment may require manual configuration.
            </p>
          </div>
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
            <span>Oracle Config</span>
          </button>
          <button
            type="submit"
            disabled={!canProceed}
            className="bg-lime-700 hover:bg-lime-600 disabled:bg-gray-600 disabled:opacity-55 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
          >
            IRM Selection
          </button>
        </div>
      </form>
    </div>
  )
}
