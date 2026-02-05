'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useWizard } from '@/contexts/WizardContext'
import { normalizeAddress } from '@/utils/addressValidation'
import packageJson from '../../package.json'

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
    const networkMap: { [key: number]: string } = {
      // Ethereum
      1: 'Ethereum Mainnet',
      3: 'Ropsten',
      4: 'Rinkeby',
      5: 'Goerli',
      42: 'Kovan',
      11155111: 'Sepolia',
      
      // Polygon
      137: 'Polygon',
      80001: 'Polygon Mumbai',
      1101: 'Polygon zkEVM',
      1442: 'Polygon zkEVM Testnet',
      
      // Optimism
      10: 'Optimism',
      420: 'Optimism Goerli',
      11155420: 'Optimism Sepolia',
      
      // Arbitrum
      42161: 'Arbitrum One',
      421613: 'Arbitrum Goerli',
      421614: 'Arbitrum Sepolia',
      42170: 'Arbitrum Nova',
      
      // BSC (Binance Smart Chain)
      56: 'BSC',
      97: 'BSC Testnet',
      
      // Avalanche
      43114: 'Avalanche C-Chain',
      43113: 'Avalanche Fuji',
      
      // Fantom
      250: 'Fantom Opera',
      4002: 'Fantom Testnet',
      
      // Base
      8453: 'Base',
      84532: 'Base Sepolia',
      84531: 'Base Goerli',
      
      // Linea
      59144: 'Linea',
      59140: 'Linea Goerli',
      59141: 'Linea Sepolia',
      
      // Scroll
      534352: 'Scroll',
      534351: 'Scroll Sepolia',
      
      // Mantle
      5000: 'Mantle',
      5001: 'Mantle Sepolia',
      
      // Celo
      42220: 'Celo',
      44787: 'Celo Alfajores',
      
      // Gnosis
      100: 'Gnosis',
      10200: 'Gnosis Chiado',
      
      // Moonbeam
      1284: 'Moonbeam',
      1287: 'Moonbase Alpha',
      
      // Harmony
      1666600000: 'Harmony One',
      1666700000: 'Harmony Testnet',
      
      // Cronos
      25: 'Cronos',
      338: 'Cronos Testnet',
      
      // Klaytn
      8217: 'Klaytn',
      1001: 'Klaytn Baobab',
      
      // Aurora
      1313161554: 'Aurora',
      1313161555: 'Aurora Testnet',
      
      // Metis
      1088: 'Metis Andromeda',
      599: 'Metis Goerli',
      
      // Boba
      288: 'Boba Network',
      28882: 'Boba Goerli',
      
      // ZkSync Era
      324: 'zkSync Era',
      300: 'zkSync Era Testnet',
      
      // Immutable X
      13371: 'Immutable X',
      
      // Sonic
      146: 'Sonic',
      653: 'Sonic Testnet',
    }
    
    const id = parseInt(chainId, 16)
    const name = networkMap[id] || `Unknown Network (${id})`
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
                <div className="text-right">
                  <div
                    className="text-sm text-gray-300 font-mono"
                    title={normalizeAddress(account) ?? account}
                  >
                    {formatAddress(account)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {networkName} ({networkId})
                  </div>
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
