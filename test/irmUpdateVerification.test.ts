import {
  decodeUpdateConfigCalldata,
  extractIrmUpdateCandidates,
  getMatchingIrmTargetLabel,
  isUpdateConfigCalldata,
} from '@/utils/verification/irmUpdateConfigTx'
import {
  classifyRowStatus,
  matchTxToSiloInPair,
  PairIrmTargets,
} from '@/utils/verification/irmRowClassification'
import {
  getSafeChainId,
  getSafeChainIdHex,
  getSafeTxServiceBaseUrl,
  parseSafeQueueUrl,
  parseSiloConfigAddressesInput,
} from '@/utils/verification/safeQueue'

const SAMPLE_UPDATE_CONFIG_DATA =
  '0x4b3734cf0000000000000000000000000000000000000000000000000b1a2bc2ec50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000d2f13f7789f0000000000000000000000000000000000000000000000000000000000005e80a6bf00000000000000000000000000000000000000000000000000000000bd014d7e00000000000000000000000000000000000000000000000000000000bd014d7e0000000000000000000000000000000000000000000000006f05b59d3b1ffcbf00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

describe('Safe queue parser', () => {
  it('parses safe queue URL with chain prefix and address', () => {
    const parsed = parseSafeQueueUrl(
      'https://app.safe.global/transactions/queue?safe=eth:0xEB9F19C58B6Ab9bCBaFCFFA082F721B4ddd86f25'
    )

    expect(parsed.chainPrefix).toBe('eth')
    expect(parsed.safeAddress).toBe('0xEB9F19C58B6Ab9bCBaFCFFA082F721B4ddd86f25')
  })

  it('resolves tx service base URL for eth prefix', () => {
    expect(getSafeTxServiceBaseUrl('eth')).toBe('https://api.safe.global/tx-service/eth')
  })

  it('resolves chainId and chainId hex for eth prefix', () => {
    expect(getSafeChainId('eth')).toBe(1)
    expect(getSafeChainIdHex('eth')).toBe('0x1')
  })

  it('resolves Safe prefixes for all app-supported chains', () => {
    expect(getSafeTxServiceBaseUrl('oeth')).toBe('https://api.safe.global/tx-service/oeth')
    expect(getSafeChainId('oeth')).toBe(10)

    expect(getSafeTxServiceBaseUrl('bnb')).toBe('https://api.safe.global/tx-service/bnb')
    expect(getSafeChainId('bnb')).toBe(56)

    expect(getSafeTxServiceBaseUrl('arb1')).toBe('https://api.safe.global/tx-service/arb1')
    expect(getSafeChainId('arb1')).toBe(42161)

    expect(getSafeTxServiceBaseUrl('avax')).toBe('https://api.safe.global/tx-service/avax')
    expect(getSafeChainId('avax')).toBe(43114)

    expect(getSafeTxServiceBaseUrl('sonic')).toBe('https://api.safe.global/tx-service/sonic')
    expect(getSafeChainId('sonic')).toBe(146)

    expect(getSafeTxServiceBaseUrl('xlayer')).toBe('https://api.safe.global/tx-service/okb')
    expect(getSafeChainId('xlayer')).toBe(196)
  })

  it('supports common aliases for selected networks', () => {
    expect(getSafeChainId('optimism')).toBe(10)
    expect(getSafeChainId('arbitrum')).toBe(42161)
    expect(getSafeChainId('avalanche')).toBe(43114)
    expect(getSafeChainId('okx')).toBe(196)
  })

  it('parses injective Safe URL and resolves network config', () => {
    const parsed = parseSafeQueueUrl(
      'https://multisig.injective.network/transactions/queue?safe=injective:0xb889683D4608cDDad705640731C72B47B3529D97'
    )

    expect(parsed.chainPrefix).toBe('injective')
    expect(parsed.safeAddress).toBe('0xb889683D4608cDDad705640731C72B47B3529D97')
    expect(getSafeTxServiceBaseUrl(parsed.chainPrefix)).toBe('https://prod.injective.keypersafe.xyz')
    expect(getSafeChainId(parsed.chainPrefix)).toBe(1776)
    expect(getSafeChainIdHex(parsed.chainPrefix)).toBe('0x6f0')
  })

  it('supports inj alias for Injective network config', () => {
    expect(getSafeTxServiceBaseUrl('inj')).toBe('https://prod.injective.keypersafe.xyz')
    expect(getSafeChainId('inj')).toBe(1776)
    expect(getSafeChainIdHex('inj')).toBe('0x6f0')
  })

  it('throws for unsupported chain prefix', () => {
    expect(() => getSafeChainId('unknown')).toThrow('Unsupported Safe chain prefix: unknown')
    expect(() => getSafeChainIdHex('unknown')).toThrow('Unsupported Safe chain prefix: unknown')
  })

  it('parses multiple siloConfig addresses preserving order', () => {
    const values = parseSiloConfigAddressesInput(
      '0x1111111111111111111111111111111111111111\n0x2222222222222222222222222222222222222222'
    )

    expect(values).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222'
    ])
  })

  it('parses comma/space separated values and removes empties', () => {
    const values = parseSiloConfigAddressesInput(
      '0x1111111111111111111111111111111111111111,  0x2222222222222222222222222222222222222222   0x3333333333333333333333333333333333333333'
    )

    expect(values).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333'
    ])
  })

  it('extracts addresses from explorer URLs', () => {
    const values = parseSiloConfigAddressesInput(
      'https://etherscan.io/address/0x1111111111111111111111111111111111111111 https://arbiscan.io/address/0x2222222222222222222222222222222222222222'
    )

    expect(values).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222'
    ])
  })
})

describe('IRM updateConfig calldata helpers', () => {
  it('detects updateConfig selector', () => {
    expect(isUpdateConfigCalldata(SAMPLE_UPDATE_CONFIG_DATA)).toBe(true)
    expect(isUpdateConfigCalldata('0x12345678')).toBe(false)
    expect(isUpdateConfigCalldata(null)).toBe(false)
  })

  it('decodes updateConfig calldata into expected fields', () => {
    const decoded = decodeUpdateConfigCalldata(SAMPLE_UPDATE_CONFIG_DATA)

    expect(decoded.ulow).toBe('800000000000000000')
    expect(decoded.u1).toBe('0')
    expect(decoded.u2).toBe('1000000000000000000')
    expect(decoded.kmax).toBe('3170979198')
    expect(decoded.c1).toBe('0')
    expect(decoded.dmax).toBe('0')
  })

  it('extracts only updateConfig transactions', () => {
    const candidates = extractIrmUpdateCandidates([
      {
        safeTxHash: '0x1',
        nonce: 1,
        to: '0x05E46c0117F2Aa62A52f093FC41CE314a5bDe0a6',
        data: SAMPLE_UPDATE_CONFIG_DATA,
        submissionDate: '',
        isExecuted: false
      },
      {
        safeTxHash: '0x2',
        nonce: 2,
        to: '0x05E46c0117F2Aa62A52f093FC41CE314a5bDe0a6',
        data: '0x12345678',
        submissionDate: '',
        isExecuted: false
      }
    ])

    expect(candidates).toHaveLength(1)
    expect(candidates[0].tx.safeTxHash).toBe('0x1')
  })

  it('extracts two updateConfig candidates from a multiSend batch via valueDecoded', () => {
    const candidates = extractIrmUpdateCandidates([
      {
        safeTxHash: '0xbatch',
        nonce: 5,
        to: '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D',
        data: '0x8d80ff0a00',
        dataDecoded: {
          method: 'multiSend',
          parameters: [
            {
              name: 'transactions',
              type: 'bytes',
              valueDecoded: [
                {
                  operation: 0,
                  to: '0xB524283653E62e95B1776B646aC39b5cAAD87e64',
                  value: '0',
                  data: SAMPLE_UPDATE_CONFIG_DATA,
                  dataDecoded: null,
                },
                {
                  operation: 0,
                  to: '0x9A6beA616a21A185f698a5Ab10B15697375f1a23',
                  value: '0',
                  data: SAMPLE_UPDATE_CONFIG_DATA,
                  dataDecoded: null,
                },
              ],
            },
          ],
        },
        submissionDate: '',
        isExecuted: false
      }
    ])

    expect(candidates).toHaveLength(2)
    expect(candidates[0].tx.to).toBe('0xB524283653E62e95B1776B646aC39b5cAAD87e64')
    expect(candidates[1].tx.to).toBe('0x9A6beA616a21A185f698a5Ab10B15697375f1a23')
    expect(candidates[0].tx.safeTxHash).toBe('0xbatch#0')
    expect(candidates[1].tx.safeTxHash).toBe('0xbatch#1')
    expect(candidates[0].tx.nonce).toBe(5)
    expect(candidates[1].tx.nonce).toBe(5)
    expect(candidates[0].decodedConfig.ulow).toBe('800000000000000000')
    expect(candidates[1].decodedConfig.ulow).toBe('800000000000000000')
  })

  it('extracts updateConfig candidates from multiSend when only raw calldata is available', () => {
    const MULTISEND_BATCH_DATA =
      '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000003f200b524283653e62e95b1776b646ac39b5caad87e64000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a44b3734cf000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000025cd0f8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009a6bea616a21a185f698a5ab10b15697375f1a23000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a44b3734cf000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000025cd0f80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

    const candidates = extractIrmUpdateCandidates([
      {
        safeTxHash: '0xrawbatch',
        nonce: 7,
        to: '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D',
        data: MULTISEND_BATCH_DATA,
        submissionDate: '',
        isExecuted: false
      }
    ])

    expect(candidates).toHaveLength(2)
    expect(candidates[0].tx.to).toBe('0xB524283653E62e95B1776B646aC39b5cAAD87e64')
    expect(candidates[1].tx.to).toBe('0x9A6beA616a21A185f698a5Ab10B15697375f1a23')
    expect(candidates[0].tx.safeTxHash).toBe('0xrawbatch#0')
    expect(candidates[1].tx.safeTxHash).toBe('0xrawbatch#1')
    expect(candidates[0].decodedConfig.kmax).toBe(candidates[1].decodedConfig.kmax)
  })

  it('extracts updateConfig from dataDecoded when calldata is missing', () => {
    const candidates = extractIrmUpdateCandidates([
      {
        safeTxHash: '0xdecoded',
        nonce: 1,
        to: '0x05E46c0117F2Aa62A52f093FC41CE314a5bDe0a6',
        data: null,
        dataDecoded: {
          method: 'updateConfig',
          parameters: [
            {
              name: '_config',
              value: {
                ulow: '1',
                u1: '2',
                u2: '3',
                ucrit: '4',
                rmin: '5',
                kmin: '6',
                kmax: '7',
                alpha: '8',
                cminus: '9',
                cplus: '10',
                c1: '11',
                c2: '12',
                dmax: '13',
              }
            }
          ]
        },
        submissionDate: '',
        isExecuted: false
      }
    ])

    expect(candidates).toHaveLength(1)
    expect(candidates[0].tx.safeTxHash).toBe('0xdecoded')
    expect(candidates[0].decodedConfig.kmax).toBe('7')
    expect(candidates[0].decodedConfig.dmax).toBe('13')
  })
})

describe('IRM target matching', () => {
  const targets = {
    silo0: '0x1111111111111111111111111111111111111111',
    silo1: '0x2222222222222222222222222222222222222222'
  }

  it('returns silo0 or silo1 for matching target', () => {
    expect(getMatchingIrmTargetLabel('0x1111111111111111111111111111111111111111', targets)).toBe('silo0')
    expect(getMatchingIrmTargetLabel('0x2222222222222222222222222222222222222222', targets)).toBe('silo1')
  })

  it('returns null when target does not match', () => {
    expect(getMatchingIrmTargetLabel('0x3333333333333333333333333333333333333333', targets)).toBeNull()
  })
})

describe('matchTxToSiloInPair', () => {
  const IRM0 = '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAA0000'
  const IRM1 = '0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBB1111'
  const IRM_OTHER = '0xCCCCccccCCCCccccCCCCccccCCCCccccCCCC2222'
  const pair: PairIrmTargets = {
    silo0: { irm: IRM0, tokenSymbol: 'USDC' },
    silo1: { irm: IRM1, tokenSymbol: 'WETH' }
  }

  it('returns direct match when intended silo IRM equals tx.to', () => {
    expect(matchTxToSiloInPair(IRM0, pair, 'silo0')).toEqual({ kind: 'direct', matchedSlot: 'silo0' })
    expect(matchTxToSiloInPair(IRM1, pair, 'silo1')).toEqual({ kind: 'direct', matchedSlot: 'silo1' })
  })

  it('falls back to silo1 first when intendedSilo is null and silo1 matches', () => {
    expect(matchTxToSiloInPair(IRM1, pair, null)).toEqual({ kind: 'fallback', matchedSlot: 'silo1' })
  })

  it('falls back to silo0 when intendedSilo is null and only silo0 matches', () => {
    expect(matchTxToSiloInPair(IRM0, pair, null)).toEqual({ kind: 'fallback', matchedSlot: 'silo0' })
  })

  it('prefers silo1 over silo0 when both irms equal tx.to and intendedSilo is null', () => {
    const collidingPair: PairIrmTargets = {
      silo0: { irm: IRM0 },
      silo1: { irm: IRM0 }
    }
    expect(matchTxToSiloInPair(IRM0, collidingPair, null)).toEqual({ kind: 'fallback', matchedSlot: 'silo1' })
  })

  it('falls back to sibling silo1 when intendedSilo=silo0 but silo1 IRM matches', () => {
    expect(matchTxToSiloInPair(IRM1, pair, 'silo0')).toEqual({ kind: 'fallback', matchedSlot: 'silo1' })
  })

  it('falls back to sibling silo0 when intendedSilo=silo1 but silo0 IRM matches', () => {
    expect(matchTxToSiloInPair(IRM0, pair, 'silo1')).toEqual({ kind: 'fallback', matchedSlot: 'silo0' })
  })

  it('returns none when neither silo IRM matches', () => {
    expect(matchTxToSiloInPair(IRM_OTHER, pair, 'silo0')).toEqual({ kind: 'none', matchedSlot: null })
    expect(matchTxToSiloInPair(IRM_OTHER, pair, null)).toEqual({ kind: 'none', matchedSlot: null })
  })

  it('matches addresses case-insensitively', () => {
    expect(matchTxToSiloInPair(IRM0.toLowerCase(), pair, 'silo0')).toEqual({ kind: 'direct', matchedSlot: 'silo0' })
    expect(matchTxToSiloInPair(IRM1.toUpperCase(), pair, null)).toEqual({ kind: 'fallback', matchedSlot: 'silo1' })
  })
})

describe('classifyRowStatus', () => {
  it('direct + JSON match -> pass', () => {
    expect(classifyRowStatus('direct', 'PROD-1', null)).toBe('pass')
  })

  it('direct + custom static (no JSON) -> warning', () => {
    expect(classifyRowStatus('direct', null, '10.0%')).toBe('warning')
  })

  it('direct + neither -> fail', () => {
    expect(classifyRowStatus('direct', null, null)).toBe('fail')
  })

  it('fallback + JSON match -> warning', () => {
    expect(classifyRowStatus('fallback', 'PROD-1', null)).toBe('warning')
  })

  it('fallback + custom static -> warning', () => {
    expect(classifyRowStatus('fallback', null, '5.0%')).toBe('warning')
  })

  it('fallback + neither -> fail', () => {
    expect(classifyRowStatus('fallback', null, null)).toBe('fail')
  })

  it('none -> fail regardless of config recognition', () => {
    expect(classifyRowStatus('none', 'PROD-1', null)).toBe('fail')
    expect(classifyRowStatus('none', null, '5.0%')).toBe('fail')
    expect(classifyRowStatus('none', null, null)).toBe('fail')
  })
})
