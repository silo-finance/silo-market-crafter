'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { useWizard } from '@/contexts/WizardContext'
import { normalizeAddress } from '@/utils/addressValidation'
import { getNetworkDisplayName, getWalletAddEthereumChainParams, NETWORK_CONFIGS } from '@/utils/networks'
import packageJson from '../../package.json'
import CopyButton from '@/components/CopyButton'
import { useTheme } from '@/contexts/ThemeContext'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

export default function Header() {
  const { clearNetworkInfo } = useWizard()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState<string>('')
  const [networkId, setNetworkId] = useState<string>('')
  const [networkName, setNetworkName] = useState<string>('')
  const [switchingNetwork, setSwitchingNetwork] = useState(false)
  const sortedNetworkOptions = [...NETWORK_CONFIGS].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  )
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') || ''
  const unionLogoSrc = `${basePath}/Union.svg`
  const pathWithoutBase =
    basePath && pathname.startsWith(basePath)
      ? (pathname.slice(basePath.length) || '/')
      : pathname
  const isWizardPath = pathWithoutBase === '/wizard' || pathWithoutBase === '/wizard/'
  const isIrmVerificationPath = pathWithoutBase === '/irm-verification' || pathWithoutBase === '/irm-verification/'
  const currentStep = searchParams.get('step')
  const isNewMarketActive = isWizardPath && currentStep !== 'verification'
  const isVerifyMarketActive = isWizardPath && currentStep === 'verification'
  const isVerifyIrmActive = isIrmVerificationPath
  const verificationChainParam = searchParams.get('chain') || networkId || ''
  const verifyMarketHref = verificationChainParam
    ? `/wizard?step=verification&chain=${verificationChainParam}`
    : '/wizard?step=verification'

  const getNetworkInfo = async (chainId: string) => {
    const id = parseInt(chainId, 16)
    const name = getNetworkDisplayName(id)
    setNetworkId(id.toString())
    setNetworkName(name)
  }

  useEffect(() => {
    // Check if already connected
    if (window.ethereum) {
      const checkConnection = async () => {
        try {
          const accounts = await window.ethereum!.request({ method: 'eth_accounts' }) as string[]
          if (accounts.length > 0) {
            setIsConnected(true)
            setAccount(accounts[0])
            
            // Get network info
            const chainId = await window.ethereum!.request({ method: 'eth_chainId' }) as string
            getNetworkInfo(chainId)
          } else {
            setIsConnected(false)
            setAccount('')
            setNetworkId('')
            setNetworkName('')
          }
        } catch (error) {
          console.error('Error checking connection:', error)
        }
      }

      checkConnection()

      // Listen for account changes
      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as string[]
        if (accounts.length > 0) {
          setIsConnected(true)
          setAccount(accounts[0])
        } else {
          setIsConnected(false)
          setAccount('')
          setNetworkId('')
          setNetworkName('')
        }
      }

      // Listen for network changes
      const handleChainChanged = (...args: unknown[]) => {
        const chainId = args[0] as string
        getNetworkInfo(chainId)
      }

      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      // Cleanup function
      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
          window.ethereum.removeListener('chainChanged', handleChainChanged)
        }
      }
    }
  }, [])

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install MetaMask to continue.')
      return
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[]
      
      if (accounts.length > 0) {
        setIsConnected(true)
        setAccount(accounts[0])
        
        // Get network info
        const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
        getNetworkInfo(chainId)
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error)
    }
  }

  const formatAddress = (address: string) => {
    const checksummed = normalizeAddress(address) ?? address
    return `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    setAccount('')
    setNetworkId('')
    setNetworkName('')
    clearNetworkInfo()
  }

  const switchNetwork = async (targetChainId: number) => {
    if (!window.ethereum) return
    if (Number(networkId) === targetChainId) return

    setSwitchingNetwork(true)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      })
      const updatedChainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
      await getNetworkInfo(updatedChainId)
    } catch (error) {
      const walletError = error as { code?: number; message?: string }
      if (walletError.code === 4001) {
        // User rejected the request.
      } else if (walletError.code === -32002) {
        alert('Network switch request is already pending in wallet.')
      } else if (
        walletError.code === 4902 ||
        walletError.message?.toLowerCase().includes('unrecognized chain') ||
        walletError.message?.toLowerCase().includes('unknown chain') ||
        walletError.message?.toLowerCase().includes('not added')
      ) {
        const addParams = getWalletAddEthereumChainParams(targetChainId)
        if (!addParams) {
          alert('This network is not available in your wallet yet and cannot be auto-added because RPC metadata is missing.')
          return
        }
        const shouldAdd = window.confirm(
          `${addParams.chainName} is not available in your wallet. Do you want to add it now?`
        )
        if (!shouldAdd) return
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [addParams]
        })

        // Some wallets add the network without switching or without emitting
        // `chainChanged` immediately, so we explicitly request the switch.
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }]
        })
      } else {
        alert(`Failed to switch network.${walletError.message ? ` ${walletError.message}` : ''}`)
      }
      const updatedChainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
      await getNetworkInfo(updatedChainId)
    } finally {
      setSwitchingNetwork(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="header-shell rounded-[26px] border px-5 py-2.5 shadow-[0_8px_24px_rgba(15,20,31,0.08)] backdrop-blur-md flex justify-between items-center min-h-16">
          {/* Logo + Market Crafter version */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={unionLogoSrc}
                alt="Union"
                width={92}
                height={32}
                className="header-logo h-8 w-auto"
              />
              <div className="flex flex-col leading-tight gap-[3px]">
                <span className="header-text text-[11px] font-semibold uppercase tracking-[0.14em]">Market Crafter</span>
                <span className="header-text-soft text-[10px]">v{packageJson.version}</span>
              </div>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/wizard?step=1"
              className={`header-link px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 hover:bg-[var(--silo-surface-2)] ${
                isNewMarketActive ? 'header-link-active bg-[var(--silo-accent-soft)] border border-[var(--header-toggle-border)]' : ''
              }`}
              aria-current={isNewMarketActive ? 'page' : undefined}
            >
              New Market
            </Link>
            <Link 
              href={verifyMarketHref}
              className={`header-link px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 hover:bg-[var(--silo-surface-2)] ${
                isVerifyMarketActive ? 'header-link-active bg-[var(--silo-accent-soft)] border border-[var(--header-toggle-border)]' : ''
              }`}
              aria-current={isVerifyMarketActive ? 'page' : undefined}
            >
              Verify Market
            </Link>
            <Link
              href="/irm-verification"
              className={`header-link px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 hover:bg-[var(--silo-surface-2)] ${
                isVerifyIrmActive ? 'header-link-active bg-[var(--silo-accent-soft)] border border-[var(--header-toggle-border)]' : ''
              }`}
              aria-current={isVerifyIrmActive ? 'page' : undefined}
            >
              IRM Update
            </Link>
            <Link
              href="https://silo-finance.github.io/actions/"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 hover:bg-[var(--silo-surface-2)]"
            >
              Actions
            </Link>
            <Link 
              href="https://app.silo.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="header-link px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 hover:bg-[var(--silo-surface-2)]"
            >
              App
            </Link>
          </nav>

          {/* MetaMask Connect / Disconnect */}
          <div className="flex items-center gap-3">
            <div className="header-theme-toggle flex items-center rounded-full overflow-hidden p-0.5">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className="header-theme-toggle-button px-3 py-1.5 text-xs font-semibold rounded-full"
                aria-pressed={theme === 'light'}
                title="Switch to light theme"
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className="header-theme-toggle-button px-3 py-1.5 text-xs font-semibold rounded-full"
                aria-pressed={theme === 'dark'}
                title="Switch to dark theme"
              >
                Dark
              </button>
            </div>
            {isConnected ? (
              <div className="flex flex-col items-end gap-1">
                <div className="text-right flex items-center gap-2 justify-end">
                  <div
                    className="header-text text-xs font-mono"
                    title={normalizeAddress(account) ?? account}
                  >
                    {formatAddress(account)}
                  </div>
                  <CopyButton value={normalizeAddress(account) ?? account} iconClassName="w-3.5 h-3.5" className="ml-0" />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={networkId}
                    onChange={(e) => {
                      const nextChainId = Number(e.target.value)
                      if (!Number.isNaN(nextChainId)) {
                        void switchNetwork(nextChainId)
                      }
                    }}
                    disabled={switchingNetwork || networkId === ''}
                    className="header-text-soft text-[11px] bg-transparent border border-[var(--header-toggle-border)] rounded-md px-2 py-1"
                    title={networkName ? `Current network: ${networkName}` : 'Select network'}
                  >
                    {sortedNetworkOptions.map((network) => (
                      <option key={network.chainId} value={network.chainId.toString()}>
                        {network.displayName} ({network.chainId})
                      </option>
                    ))}
                  </select>
                  <div className="w-2 h-2 rounded-full bg-[var(--silo-signal-green)] ring-1 ring-[var(--silo-border)]" />
                </div>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="header-link text-[10px] font-semibold uppercase tracking-wide transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={connectWallet}
                  className="header-connect-button font-semibold py-2 px-4 rounded-full transition-colors duration-200 text-xs"
                >
                  Connect MetaMask
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
