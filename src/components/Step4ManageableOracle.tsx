'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { getChainName, getExplorerAddressUrl } from '@/utils/networks'
import { fetchSiloLensVersionsWithCache } from '@/utils/siloLensVersions'
import { ethers } from 'ethers'
import ContractInfo from '@/components/ContractInfo'
import AddressDisplayLong from '@/components/AddressDisplayLong'
import manageableOracleFactoryAbi from '@/abis/oracle/IManageableOracleFactory.json'
import Button from '@/components/Button'

const MANAGEABLE_ORACLE_FACTORY_NAME = 'ManageableOracleFactory'

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
      'function MIN_TIMELOCK() view returns (uint32)',
      'function MAX_TIMELOCK() view returns (uint32)'
    ]

    const fetchTimelockRange = async () => {
      try {
        const eth = window.ethereum
        if (!eth) {
          setTimelockRange(null)
          return
        }
        const provider = new ethers.BrowserProvider(eth)
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
                      linkClassName="text-[var(--silo-accent)] hover:text-[#7f91ff]"
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
                  <p className="text-xs text-gray-400 pt-1">
                    Used in transaction: <span className="text-gray-300 font-medium">{selectedTimelockDays * SECONDS_PER_DAY} seconds</span>
                  </p>
                )}
              </div>
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
