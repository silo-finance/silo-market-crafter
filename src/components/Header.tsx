'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useWizard } from '@/contexts/WizardContext'
import { normalizeAddress } from '@/utils/addressValidation'
import { getNetworkDisplayName } from '@/utils/networks'
import packageJson from '../../package.json'
import CopyButton from '@/components/CopyButton'

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
    <header className="bg-black/90 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo + Market Crafter version */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <Link href="/" className="flex items-center">
              <Image 
                src="https://cdn.prod.website-files.com/684669826f2b6c83c65f3f7c/684669826f2b6c83c65f3f86_Frame%2010169.svg" 
                alt="Silo"
                width={32}
                height={32}
                className="h-8 w-auto"
                style={{ width: 'auto' }}
              />
            </Link>
            <span className="text-gray-300 text-sm font-medium">
              Market Crafter v{packageJson.version}
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex space-x-8">
            <Link 
              href="/wizard?step=11"
              className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Verify Market
            </Link>
            <Link 
              href="https://silo.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Silo Finance
            </Link>
            <Link 
              href="https://app.silo.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              Silo App
            </Link>
          </nav>

          {/* MetaMask Connect / Disconnect */}
          <div className="flex items-center">
            {isConnected ? (
              <div className="flex items-center space-x-4">
                <div className="text-right flex items-center gap-2 justify-end">
                  <div
                    className="text-sm text-gray-300 font-mono"
                    title={normalizeAddress(account) ?? account}
                  >
                    {formatAddress(account)}
                  </div>
                  <CopyButton value={normalizeAddress(account) ?? account} iconClassName="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-gray-400">
                  {networkName} ({networkId})
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
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
