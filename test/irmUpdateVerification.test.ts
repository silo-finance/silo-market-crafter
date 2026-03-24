import {
  decodeUpdateConfigCalldata,
  extractIrmUpdateCandidates,
  getMatchingIrmTargetLabel,
  isUpdateConfigCalldata,
} from '@/utils/verification/irmUpdateConfigTx'
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
    expect(getSafeTxServiceBaseUrl('eth')).toBe('https://safe-transaction-mainnet.safe.global')
  })

  it('resolves chainId and chainId hex for eth prefix', () => {
    expect(getSafeChainId('eth')).toBe(1)
    expect(getSafeChainIdHex('eth')).toBe('0x1')
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
