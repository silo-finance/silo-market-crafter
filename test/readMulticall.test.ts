import { Interface, getAddress, type Provider } from 'ethers'
import { buildReadMulticallCall, executeReadMulticall } from '@/utils/readMulticall'
import { findChainsMissingMulticall3 } from '@/config/multicall'

const multicallIface = new Interface([
  'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)',
])

const uintAbi = ['function readValue() view returns (uint256)'] as const
const uintIface = new Interface(uintAbi)

function mockProvider(params: {
  chainId?: number
  callImpl: (tx: { to: string; data: string }) => Promise<string>
}): Provider {
  const chainId = params.chainId ?? 1
  return {
    getNetwork: async () => ({ chainId: BigInt(chainId) }),
    call: params.callImpl,
  } as unknown as Provider
}

describe('multicall config', () => {
  it('has a Multicall3 entry for every supported chain', () => {
    expect(findChainsMissingMulticall3()).toEqual([])
  })
})

describe('executeReadMulticall (strict)', () => {
  it('decodes successful aggregate3 responses', async () => {
    const provider = mockProvider({
      callImpl: async ({ data }) => {
        const decodedCalls = multicallIface.decodeFunctionData('aggregate3', data)[0] as Array<{
          target: string
          allowFailure: boolean
          callData: string
        }>
        const encodedResults = decodedCalls.map((_, i) => ({
          success: true,
          returnData: uintIface.encodeFunctionResult('readValue', [BigInt(i + 1)]),
        }))
        return multicallIface.encodeFunctionResult('aggregate3', [encodedResults])
      },
    })

    const [a, b] = await executeReadMulticall(provider, [
      buildReadMulticallCall({
        target: getAddress('0x1111111111111111111111111111111111111111'),
        abi: uintAbi,
        functionName: 'readValue',
        decodeResult: (v) => BigInt(String(v)),
      }),
      buildReadMulticallCall({
        target: getAddress('0x2222222222222222222222222222222222222222'),
        abi: uintAbi,
        functionName: 'readValue',
        decodeResult: (v) => BigInt(String(v)),
      }),
    ])

    expect(a).toBe(BigInt(1))
    expect(b).toBe(BigInt(2))
  })

  it('returns null for allowFailure=true when a call fails', async () => {
    const provider = mockProvider({
      callImpl: async () => {
        const encodedResults = [{ success: false, returnData: '0x' }]
        return multicallIface.encodeFunctionResult('aggregate3', [encodedResults])
      },
    })
    const [value] = await executeReadMulticall(provider, [
      buildReadMulticallCall({
        target: getAddress('0x3333333333333333333333333333333333333333'),
        abi: uintAbi,
        functionName: 'readValue',
        allowFailure: true,
        decodeResult: (v) => BigInt(String(v)),
      }),
    ])
    expect(value).toBeNull()
  })

  it('throws in strict mode when aggregate3 rpc fails', async () => {
    const provider = mockProvider({
      callImpl: async () => {
        throw new Error('rpc rate limited')
      },
    })
    await expect(
      executeReadMulticall(provider, [
        buildReadMulticallCall({
          target: getAddress('0x4444444444444444444444444444444444444444'),
          abi: uintAbi,
          functionName: 'readValue',
          decodeResult: (v) => BigInt(String(v)),
        }),
      ])
    ).rejects.toThrow(/rpc rate limited/)
  })

  it('throws in strict mode when chain has no Multicall3 configured', async () => {
    const provider = mockProvider({
      chainId: 424242,
      callImpl: async () => '0x',
    })
    await expect(
      executeReadMulticall(provider, [
        buildReadMulticallCall({
          target: getAddress('0x5555555555555555555555555555555555555555'),
          abi: uintAbi,
          functionName: 'readValue',
          decodeResult: (v) => BigInt(String(v)),
        }),
      ])
    ).rejects.toThrow(/no Multicall3 configured/)
  })

  it('throws when a non-allowFailure sub-call reverts', async () => {
    const provider = mockProvider({
      callImpl: async ({ data }) => {
        const decodedCalls = multicallIface.decodeFunctionData('aggregate3', data)[0] as Array<{
          target: string
          allowFailure: boolean
          callData: string
        }>
        const encodedResults = decodedCalls.map((_, i) =>
          i === 0
            ? { success: false, returnData: '0x' }
            : { success: true, returnData: uintIface.encodeFunctionResult('readValue', [BigInt(9)]) }
        )
        return multicallIface.encodeFunctionResult('aggregate3', [encodedResults])
      },
    })
    await expect(
      executeReadMulticall(provider, [
        buildReadMulticallCall({
          target: getAddress('0x6666666666666666666666666666666666666666'),
          abi: uintAbi,
          functionName: 'readValue',
          decodeResult: (v) => BigInt(String(v)),
        }),
        buildReadMulticallCall({
          target: getAddress('0x7777777777777777777777777777777777777777'),
          abi: uintAbi,
          functionName: 'readValue',
          decodeResult: (v) => BigInt(String(v)),
        }),
      ])
    ).rejects.toThrow(/call 0 reverted and allowFailure=false/)
  })

  it('splits calls into chunks when chunkSize is set', async () => {
    const rpcCalls: string[] = []
    const provider = mockProvider({
      callImpl: async ({ data }) => {
        rpcCalls.push(data)
        const decodedCalls = multicallIface.decodeFunctionData('aggregate3', data)[0] as Array<{
          target: string
          allowFailure: boolean
          callData: string
        }>
        const encodedResults = decodedCalls.map(() => ({
          success: true,
          returnData: uintIface.encodeFunctionResult('readValue', [BigInt(1)]),
        }))
        return multicallIface.encodeFunctionResult('aggregate3', [encodedResults])
      },
    })
    const callA = buildReadMulticallCall({
      target: getAddress('0x6666666666666666666666666666666666666666'),
      abi: uintAbi,
      functionName: 'readValue',
      decodeResult: (v) => BigInt(String(v)),
    })
    const callB = buildReadMulticallCall({
      target: getAddress('0x7777777777777777777777777777777777777777'),
      abi: uintAbi,
      functionName: 'readValue',
      decodeResult: (v) => BigInt(String(v)),
    })
    const results = await executeReadMulticall(provider, [callA, callB], { chunkSize: 1 })
    expect(rpcCalls.length).toBe(2)
    expect(results).toEqual([BigInt(1), BigInt(1)])
  })
})
