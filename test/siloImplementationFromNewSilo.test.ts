import { Interface, getAddress, type Provider, type TransactionReceipt } from 'ethers'
import factoryArtifact from '@/abis/silo/ISiloFactory.json'
import { getAbi } from '@/utils/abiArtifact'
import { parseDeployTxReceipt } from '@/utils/parseDeployTxEvents'
import { verifySiloImplementation } from '@/utils/verification/siloImplementationVerification'
import {
  fetchSiloImplementationFromNewSilo,
  implementationFromDeployReceipt,
  matchNewSiloLogs,
  parseFactoryDeployBlock
} from '@/utils/verification/fetchSiloImplementationFromNewSilo'

const factoryIface = new Interface(getAbi(factoryArtifact))
function requireNewSiloEvent() {
  const event = factoryIface.getEvent('NewSilo')
  if (!event) {
    throw new Error('NewSilo event missing from ISiloFactory ABI')
  }
  return event
}
const newSiloFragment = requireNewSiloEvent()

const IMPL_A = getAddress('0x1111111111111111111111111111111111111111')
const IMPL_B = getAddress('0x2222222222222222222222222222222222222222')
const TOKEN0 = getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
const TOKEN1 = getAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
const SILO0 = getAddress('0x3333333333333333333333333333333333333333')
const SILO1 = getAddress('0x4444444444444444444444444444444444444444')
const SILO_CONFIG_A = getAddress('0x5555555555555555555555555555555555555555')
const SILO_CONFIG_B = getAddress('0x6666666666666666666666666666666666666666')
const FACTORY = getAddress('0x7777777777777777777777777777777777777777')
const TX_A = `0x${'aa'.repeat(32)}`
const TX_B = `0x${'bb'.repeat(32)}`

function encodeNewSiloLog(params: {
  implementation: string
  token0: string
  token1: string
  silo0: string
  silo1: string
  siloConfig: string
  transactionHash: string
}) {
  const encoded = factoryIface.encodeEventLog(newSiloFragment, [
    params.implementation,
    params.token0,
    params.token1,
    params.silo0,
    params.silo1,
    params.siloConfig
  ])
  return {
    address: FACTORY,
    topics: encoded.topics,
    data: encoded.data,
    transactionHash: params.transactionHash,
    index: 0,
    blockNumber: 100,
    blockHash: `0x${'11'.repeat(32)}`
  }
}

function mockReceipt(logs: ReturnType<typeof encodeNewSiloLog>[]): TransactionReceipt {
  return {
    hash: TX_A,
    logs,
    status: 1
  } as unknown as TransactionReceipt
}

function mockProvider(params: {
  blockNumber?: number
  getLogsImpl: (filter: { fromBlock?: number; toBlock?: number | string }) => Promise<ReturnType<typeof encodeNewSiloLog>[]>
}): Provider {
  return {
    getBlockNumber: async () => params.blockNumber ?? 200_000,
    getLogs: params.getLogsImpl
  } as unknown as Provider
}

describe('matchNewSiloLogs', () => {
  const samePairLogs = [
    encodeNewSiloLog({
      implementation: IMPL_A,
      token0: TOKEN0,
      token1: TOKEN1,
      silo0: SILO0,
      silo1: SILO1,
      siloConfig: SILO_CONFIG_A,
      transactionHash: TX_A
    }),
    encodeNewSiloLog({
      implementation: IMPL_B,
      token0: TOKEN0,
      token1: TOKEN1,
      silo0: getAddress('0x8888888888888888888888888888888888888888'),
      silo1: getAddress('0x9999999999999999999999999999999999999999'),
      siloConfig: SILO_CONFIG_B,
      transactionHash: TX_B
    })
  ]

  it('returns the implementation for the matching siloConfig when the token pair is reused', () => {
    const match = matchNewSiloLogs(samePairLogs, { siloConfig: SILO_CONFIG_B })
    expect(match).toEqual({
      implementation: IMPL_B,
      transactionHash: TX_B
    })
  })

  it('matches by silo0 when siloConfig is not the discriminator used', () => {
    const match = matchNewSiloLogs(samePairLogs, {
      siloConfig: getAddress('0x0000000000000000000000000000000000000001'),
      silo0: SILO0
    })
    expect(match).toEqual({
      implementation: IMPL_A,
      transactionHash: TX_A
    })
  })

  it('returns null when no log belongs to the market', () => {
    expect(
      matchNewSiloLogs(samePairLogs, {
        siloConfig: getAddress('0x0000000000000000000000000000000000000001')
      })
    ).toBeNull()
  })
})

describe('implementationFromDeployReceipt', () => {
  it('decodes NewSilo.implementation from a deploy receipt', () => {
    const receipt = mockReceipt([
      encodeNewSiloLog({
        implementation: IMPL_A,
        token0: TOKEN0,
        token1: TOKEN1,
        silo0: SILO0,
        silo1: SILO1,
        siloConfig: SILO_CONFIG_A,
        transactionHash: TX_A
      })
    ])
    expect(parseDeployTxReceipt(receipt).implementation).toBe(IMPL_A)
    expect(implementationFromDeployReceipt(receipt)).toEqual({
      implementation: IMPL_A,
      transactionHash: TX_A
    })
  })
})

describe('fetchSiloImplementationFromNewSilo', () => {
  it('uses the receipt path and does not query logs', async () => {
    let getLogsCalls = 0
    const provider = mockProvider({
      getLogsImpl: async () => {
        getLogsCalls += 1
        return []
      }
    })
    const receipt = mockReceipt([
      encodeNewSiloLog({
        implementation: IMPL_A,
        token0: TOKEN0,
        token1: TOKEN1,
        silo0: SILO0,
        silo1: SILO1,
        siloConfig: SILO_CONFIG_A,
        transactionHash: TX_A
      })
    ])

    const match = await fetchSiloImplementationFromNewSilo({
      provider,
      receipt,
      factoryAddress: FACTORY,
      token0: TOKEN0,
      token1: TOKEN1,
      siloConfig: SILO_CONFIG_A,
      silo0: SILO0,
      silo1: SILO1
    })

    expect(match).toEqual({ implementation: IMPL_A, transactionHash: TX_A })
    expect(getLogsCalls).toBe(0)
  })

  it('queries factory logs and keeps the NewSilo for this siloConfig', async () => {
    const provider = mockProvider({
      blockNumber: 150,
      getLogsImpl: async () => [
        encodeNewSiloLog({
          implementation: IMPL_A,
          token0: TOKEN0,
          token1: TOKEN1,
          silo0: SILO0,
          silo1: SILO1,
          siloConfig: SILO_CONFIG_A,
          transactionHash: TX_A
        }),
        encodeNewSiloLog({
          implementation: IMPL_B,
          token0: TOKEN0,
          token1: TOKEN1,
          silo0: getAddress('0x8888888888888888888888888888888888888888'),
          silo1: getAddress('0x9999999999999999999999999999999999999999'),
          siloConfig: SILO_CONFIG_B,
          transactionHash: TX_B
        })
      ]
    })

    const match = await fetchSiloImplementationFromNewSilo({
      provider,
      factoryAddress: FACTORY,
      token0: TOKEN0,
      token1: TOKEN1,
      siloConfig: SILO_CONFIG_B,
      fromBlock: 1
    })

    expect(match).toEqual({ implementation: IMPL_B, transactionHash: TX_B })
  })
})

describe('verifySiloImplementation', () => {
  it('fails when the event address is missing from the repository list', () => {
    expect(verifySiloImplementation(IMPL_A, null)).toBe(false)
  })

  it('passes when the event address matches the repository address', () => {
    expect(verifySiloImplementation(IMPL_A, IMPL_A.toLowerCase())).toBe(true)
  })
})

describe('parseFactoryDeployBlock', () => {
  it('reads receipt.blockNumber when present', () => {
    expect(parseFactoryDeployBlock({ receipt: { blockNumber: 12345 } })).toBe(12345)
    expect(parseFactoryDeployBlock({ receipt: { blockNumber: '0x10' } })).toBe(16)
  })
})
