import { ethers } from 'ethers'
import siloFactoryArtifact from '@/abis/silo/ISiloFactory.json'

const siloFactoryAbi = (siloFactoryArtifact as { abi: ethers.InterfaceAbi }).abi

/**
 * Silo Address Verification
 * 
 * Verifies that a silo address exists in the Silo Factory contract by calling
 * SiloFactory.isSilo(siloAddress) on-chain.
 * 
 * @param siloAddress - Silo address to verify (from on-chain config: config.silo0.silo or config.silo1.silo)
 * @param siloFactoryAddress - Silo Factory contract address (from repository deployment JSON)
 * @param provider - Ethers.js provider for making on-chain contract calls
 * @returns Promise<boolean> - true if address is verified as a silo, false otherwise
 */
export async function verifySiloAddress(
  siloAddress: string,
  siloFactoryAddress: string,
  provider: ethers.Provider
): Promise<boolean> {
  try {
    // Create Silo Factory contract instance
    const factoryContract = new ethers.Contract(siloFactoryAddress, siloFactoryAbi, provider)
    
    // Call SiloFactory.isSilo(siloAddress) on-chain
    const isSiloResult = await factoryContract.isSilo(siloAddress)
    
    // Return the result (convert to boolean if needed)
    return Boolean(isSiloResult)
  } catch (error) {
    console.error('Failed to verify silo address:', error)
    return false
  }
}
