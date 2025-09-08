'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

declare global {
  interface Window {
    ethereum?: any
  }
}

export default function Header() {
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState<string>('')
  const [networkId, setNetworkId] = useState<string>('')
  const [networkName, setNetworkName] = useState<string>('')

  const getNetworkInfo = async (chainId: string) => {
    const networkMap: { [key: string]: string } = {
      // Ethereum
      '0x1': 'Ethereum Mainnet',
      '0x3': 'Ropsten',
      '0x4': 'Rinkeby',
      '0x5': 'Goerli',
      '0x2a': 'Kovan',
      '0xaa36a7': 'Sepolia',
      
      // Polygon
      '0x89': 'Polygon',
      '0x13881': 'Polygon Mumbai',
      '0x44d': 'Polygon zkEVM',
      '0x5a2': 'Polygon zkEVM Testnet',
      
      // Optimism
      '0xa': 'Optimism',
      '0x420': 'Optimism Goerli',
      '0x1a4': 'Optimism Sepolia',
      
      // Arbitrum
      '0xa4b1': 'Arbitrum One',
      '0x66eed': 'Arbitrum Goerli',
      '0x66eee': 'Arbitrum Sepolia',
      '0x66eeb': 'Arbitrum Nova',
      
      // BSC (Binance Smart Chain)
      '0x38': 'BSC',
      '0x61': 'BSC Testnet',
      
      // Avalanche
      '0xa86a': 'Avalanche C-Chain',
      '0xa869': 'Avalanche Fuji',
      
      // Fantom
      '0xfa': 'Fantom Opera',
      '0xfa2': 'Fantom Testnet',
      
      // Base
      '0x2105': 'Base',
      '0x14a33': 'Base Sepolia',
      '0x14a34': 'Base Goerli',
      
      // Linea
      '0xe708': 'Linea',
      '0xe704': 'Linea Goerli',
      '0xe705': 'Linea Sepolia',
      
      // Scroll
      '0x82750': 'Scroll',
      '0x8274f': 'Scroll Sepolia',
      
      // Mantle
      '0x1388': 'Mantle',
      '0x1389': 'Mantle Sepolia',
      
      // Celo
      '0xa4ec': 'Celo',
      '0x44787': 'Celo Alfajores',
      
      // Gnosis
      '0x64': 'Gnosis',
      '0x27d8': 'Gnosis Chiado',
      
      // Moonbeam
      '0x504': 'Moonbeam',
      '0x507': 'Moonbase Alpha',
      
      // Harmony
      '0x63564c40': 'Harmony One',
      '0x6357d2e0': 'Harmony Testnet',
      
      // Cronos
      '0x19': 'Cronos',
      '0x152': 'Cronos Testnet',
      
      // Klaytn
      '0x2019': 'Klaytn',
      '0x3e9': 'Klaytn Baobab',
      
      // Aurora
      '0x4e454152': 'Aurora',
      '0x4e454153': 'Aurora Testnet',
      
      // Metis
      '0x440': 'Metis Andromeda',
      '0x28a': 'Metis Goerli',
      
      // Boba
      '0x120': 'Boba Network',
      '0x28a': 'Boba Goerli',
      
      // ZkSync Era
      '0x144': 'zkSync Era',
      '0x12c': 'zkSync Era Testnet',
      
      // Immutable X
      '0x1a4': 'Immutable X',
      
      // Sonic
      '0x92': 'Sonic',
      '0x28d': 'Sonic Testnet',
    }
    
    const id = parseInt(chainId, 16).toString()
    const name = networkMap[chainId] || `Unknown Network (${id})`
    setNetworkId(id)
    setNetworkName(name)
  }

  useEffect(() => {
    // Check if already connected
    if (window.ethereum) {
      const checkConnection = async () => {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts.length > 0) {
            setIsConnected(true)
            setAccount(accounts[0])
            
            // Get network info
            const chainId = await window.ethereum.request({ method: 'eth_chainId' })
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
      const handleAccountsChanged = (accounts: string[]) => {
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
      const handleChainChanged = (chainId: string) => {
        getNetworkInfo(chainId)
      }

      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      // Cleanup function
      return () => {
        if (window.ethereum.removeListener) {
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
      })
      
      if (accounts.length > 0) {
        setIsConnected(true)
        setAccount(accounts[0])
        
        // Get network info
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        getNetworkInfo(chainId)
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <header className="bg-black/90 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <img 
                src="https://cdn.prod.website-files.com/684669826f2b6c83c65f3f7c/684669826f2b6c83c65f3f86_Frame%2010169.svg" 
                alt="Silo" 
                className="h-8 w-auto"
              />
            </Link>
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

          {/* MetaMask Connect Button */}
          <div className="flex items-center">
            {isConnected ? (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-300">
                    {formatAddress(account)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {networkName} ({networkId})
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
