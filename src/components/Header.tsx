'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useWizard } from '@/contexts/WizardContext'
import { normalizeAddress } from '@/utils/addressValidation'
import { getNetworkDisplayName } from '@/utils/networks'
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
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState<string>('')
  const [networkId, setNetworkId] = useState<string>('')
  const [networkName, setNetworkName] = useState<string>('')

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

  return (
    <header className="header-shell backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          {/* Logo + Market Crafter version */}
          <div className="min-w-0 flex items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center">
              <Image 
                src="https://cdn.prod.website-files.com/684669826f2b6c83c65f3f7c/684669826f2b6c83c65f3f86_Frame%2010169.svg" 
                alt="Silo"
                width={32}
                height={32}
                className="header-logo h-8 w-auto"
                style={{
                  width: 'auto',
                }}
              />
            </Link>
            <span className="header-text hidden sm:inline text-sm font-medium">
              Market Crafter v{packageJson.version}
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden lg:flex space-x-8">
            <Link 
              href="/wizard?step=11"
              className="header-link px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Verify Market
            </Link>
            <Link 
              href="https://silo.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="header-link px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Silo Finance
            </Link>
            <Link 
              href="https://app.silo.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="header-link px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Silo App
            </Link>
          </nav>

          {/* MetaMask Connect / Disconnect */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <div className="header-theme-toggle flex items-center rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className="header-theme-toggle-button px-2.5 py-1.5 text-xs font-semibold"
                aria-pressed={theme === 'light'}
                title="Switch to light theme"
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className="header-theme-toggle-button px-2.5 py-1.5 text-xs font-semibold"
                aria-pressed={theme === 'dark'}
                title="Switch to dark theme"
              >
                Dark
              </button>
            </div>
            {isConnected ? (
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
                <div className="text-right flex items-center gap-2 justify-end min-w-0">
                  <div
                    className="header-text text-xs sm:text-sm font-mono"
                    title={normalizeAddress(account) ?? account}
                  >
                    {formatAddress(account)}
                  </div>
                  <CopyButton value={normalizeAddress(account) ?? account} iconClassName="w-3.5 h-3.5" />
                </div>
                <div className="header-text-soft hidden md:block text-xs">
                  {networkName} ({networkId})
                </div>
                <div className="hidden sm:block w-2 h-2 bg-lime-500 rounded-full"></div>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="header-link text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="header-connect-button font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm whitespace-nowrap"
              >
                Connect MetaMask
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
