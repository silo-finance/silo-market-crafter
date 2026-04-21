import { Interface, getAddress, type Provider } from 'ethers'
import { verifySiloAddresses } from '@/utils/verification/siloAddressVerification'
import { resolveAddressesToSiloConfigs } from '@/utils/resolveAddressToSiloConfig'

const multicallIface = new Interface([
  'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)',
])

const isSiloIface = new Interface([
  'function isSilo(address) view returns (bool)',
])

const configIface = new Interface([
  'function config() view returns (address)',
])

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

describe('verifySiloAddresses (multicall)', () => {
  it('returns one boolean per input via a single aggregate3 round-trip', async () => {
    let aggregate3Calls = 0
    const provider = mockProvider({
      callImpl: async ({ data }) => {
        aggregate3Calls += 1
        const decodedCalls = multicallIface.decodeFunctionData('aggregate3', data)[0] as Array<{
          target: string
          allowFailure: boolean
          callData: string
        }>
        // First verified true, second verified false.
        const encodedResults = decodedCalls.map((_, i) => ({
          success: true,
          returnData: isSiloIface.encodeFunctionResult('isSilo', [i === 0]),
        }))
        return multicallIface.encodeFunctionResult('aggregate3', [encodedResults])
      },
    })

    const results = await verifySiloAddresses(
      [
        getAddress('0x1111111111111111111111111111111111111111'),
        getAddress('0x2222222222222222222222222222222222222222'),
      ],
      getAddress('0x3333333333333333333333333333333333333333'),
      provider
    )

    expect(results).toEqual([true, false])
    expect(aggregate3Calls).toBe(1)
  })

  it('returns all-false on batch failure, without throwing', async () => {
    const provider = mockProvider({
      callImpl: async () => {
        throw new Error('rpc down')
      },
    })
    const results = await verifySiloAddresses(
      [getAddress('0x1111111111111111111111111111111111111111')],
      getAddress('0x2222222222222222222222222222222222222222'),
      provider
    )
    expect(results).toEqual([false])
  })
})

describe('resolveAddressesToSiloConfigs (multicall)', () => {
  it('returns config() result for silos and the input address for SiloConfig (reverted call)', async () => {
    let aggregate3Calls = 0
    const inputs = [
      getAddress('0x1111111111111111111111111111111111111111'),
      getAddress('0x2222222222222222222222222222222222222222'),
    ]
    const siloConfigForFirst = getAddress('0x3333333333333333333333333333333333333333')

    const provider = mockProvider({
      callImpl: async ({ data }) => {
        aggregate3Calls += 1
        const decodedCalls = multicallIface.decodeFunctionData('aggregate3', data)[0] as Array<{
          target: string
          allowFailure: boolean
          callData: string
        }>
        const encodedResults = decodedCalls.map((_, i) =>
          i === 0
            ? { success: true, returnData: configIface.encodeFunctionResult('config', [siloConfigForFirst]) }
            : { success: false, returnData: '0x' }
        )
        return multicallIface.encodeFunctionResult('aggregate3', [encodedResults])
      },
    })

    const results = await resolveAddressesToSiloConfigs(provider, inputs)

    expect(results).toEqual([siloConfigForFirst, inputs[1]])
    expect(aggregate3Calls).toBe(1)
  })
})
