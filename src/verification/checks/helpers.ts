import { ethers } from 'ethers'
import {
  chainlinkV3OracleAbi,
  chainlinkV3OracleConfigAbi,
  erc20MetadataAbi,
  erc4626Abi,
  isiloOracleAbi,
  pendleLpWrapperAbi,
  ptLinearAggregatorAbi
} from '../abis'
import { isZeroAddress } from '../utils'

const chainlinkConfigInterface = new ethers.Interface(chainlinkV3OracleConfigAbi)

export async function quote(
  provider: ethers.Provider,
  oracleAddress: string,
  token: string,
  amount: bigint
): Promise<{ success: boolean; price: bigint }> {
  if (isZeroAddress(oracleAddress)) return { success: false, price: 0n }
  try {
    const oracle = new ethers.Contract(oracleAddress, isiloOracleAbi, provider)
    const price = (await oracle.quote(amount, token)) as bigint
    return { success: true, price }
  } catch {
    return { success: false, price: 0n }
  }
}

export async function getTokenDecimals(provider: ethers.Provider, token: string): Promise<number> {
  const contract = new ethers.Contract(token, erc20MetadataAbi, provider)
  const decimals = (await contract.decimals()) as number
  return Number(decimals)
}

export async function getTokenSymbol(provider: ethers.Provider, token: string): Promise<string> {
  try {
    const contract = new ethers.Contract(token, erc20MetadataAbi, provider)
    return (await contract.symbol()) as string
  } catch {
    return 'Symbol reverted'
  }
}

export async function tryGetChainlinkAggregators(
  provider: ethers.Provider,
  oracleAddress: string
): Promise<{ primary: string; secondary: string }> {
  if (isZeroAddress(oracleAddress)) {
    return { primary: ethers.ZeroAddress, secondary: ethers.ZeroAddress }
  }

  try {
    const oracle = new ethers.Contract(oracleAddress, chainlinkV3OracleAbi, provider)
    const configAddress = (await oracle.oracleConfig()) as string
    if (isZeroAddress(configAddress)) {
      return { primary: ethers.ZeroAddress, secondary: ethers.ZeroAddress }
    }

    const data = await provider.call({
      to: configAddress,
      data: chainlinkConfigInterface.encodeFunctionData('getConfig', [])
    })

    const bytesLength = (data.length - 2) / 2
    if (bytesLength !== 320) {
      return { primary: ethers.ZeroAddress, secondary: ethers.ZeroAddress }
    }

    const [config] = chainlinkConfigInterface.decodeFunctionResult('getConfig', data) as [
      {
        primaryAggregator: string
        secondaryAggregator: string
      }
    ]

    return {
      primary: config.primaryAggregator ?? ethers.ZeroAddress,
      secondary: config.secondaryAggregator ?? ethers.ZeroAddress
    }
  } catch {
    return { primary: ethers.ZeroAddress, secondary: ethers.ZeroAddress }
  }
}

export async function tryGetPT(provider: ethers.Provider, aggregator: string): Promise<string> {
  if (isZeroAddress(aggregator)) return ethers.ZeroAddress
  try {
    const contract = new ethers.Contract(aggregator, ptLinearAggregatorAbi, provider)
    const pt = (await contract.PT()) as string
    return pt ?? ethers.ZeroAddress
  } catch {
    return ethers.ZeroAddress
  }
}

export async function isTokenERC4626(provider: ethers.Provider, token: string): Promise<boolean> {
  try {
    const contract = new ethers.Contract(token, erc4626Abi, provider)
    const decimals = await getTokenDecimals(provider, token)
    const amount = 1000n * 10n ** BigInt(decimals)
    const assets = (await contract.convertToAssets(amount)) as bigint
    return assets !== 0n
  } catch {
    return false
  }
}

export async function isTokenLPT(provider: ethers.Provider, token: string): Promise<boolean> {
  try {
    const contract = new ethers.Contract(token, pendleLpWrapperAbi, provider)
    const lp = (await contract.LP()) as string
    return !isZeroAddress(lp)
  } catch {
    return false
  }
}

export async function isTokenPT(provider: ethers.Provider, token: string): Promise<boolean> {
  try {
    const symbol = await getTokenSymbol(provider, token)
    return symbol.startsWith('PT-')
  } catch {
    return false
  }
}
