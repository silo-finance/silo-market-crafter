import {
  detectCustomStaticKinkConfig,
  findKinkConfigName,
  KinkConfigItem,
} from '@/utils/kinkConfigName'

const JSON_CONFIGS: KinkConfigItem[] = [
  {
    name: 'fixed-10',
    config: {
      ulow: '0',
      u1: '0',
      u2: '1000000000000000000',
      ucrit: '1000000000000000000',
      rmin: '3170979198',
      kmin: '0',
      kmax: '0',
      alpha: '0',
      cminus: '0',
      cplus: '0',
      c1: '0',
      c2: '0',
      dmax: '0',
    },
  },
]

function staticConfig(rmin: string): Record<string, string> {
  return {
    ulow: '0',
    u1: '0',
    u2: '1000000000000000000',
    ucrit: '1000000000000000000',
    rmin,
    kmin: '0',
    kmax: '0',
    alpha: '0',
    cminus: '0',
    cplus: '0',
    c1: '0',
    c2: '0',
    dmax: '0',
  }
}

describe('detectCustomStaticKinkConfig', () => {
  it('returns formatted percentage for 2% fixed rate (rmin=634195840)', () => {
    expect(detectCustomStaticKinkConfig(staticConfig('634195840'))).toBe('2.0%')
  })

  it('returns formatted percentage for 10% fixed rate (rmin=3170979198)', () => {
    expect(detectCustomStaticKinkConfig(staticConfig('3170979198'))).toBe('10.0%')
  })

  it('returns formatted percentage for 20% fixed rate (rmin=6341958396)', () => {
    expect(detectCustomStaticKinkConfig(staticConfig('6341958396'))).toBe('20.0%')
  })

  it('preserves one decimal of precision (rmin=4756468797 ≈ 15%)', () => {
    expect(detectCustomStaticKinkConfig(staticConfig('4756468797'))).toBe('15.0%')
  })

  it('formats a non-integer APR with one decimal (e.g. 12.5%)', () => {
    // 12.5% = 0.125e18 / secondsPerYear = 3963723997.717... per second
    // Using rmin=3963723998 -> 12.5000000009e16 -> rounds to "12.5%"
    expect(detectCustomStaticKinkConfig(staticConfig('3963723998'))).toBe('12.5%')
  })

  it('returns null when u2 is not exactly 1e18', () => {
    const cfg = staticConfig('634195840')
    cfg.u2 = '999999999999999999'
    expect(detectCustomStaticKinkConfig(cfg)).toBeNull()
  })

  it('returns null when ucrit is not exactly 1e18', () => {
    const cfg = staticConfig('634195840')
    cfg.ucrit = '950000000000000000'
    expect(detectCustomStaticKinkConfig(cfg)).toBeNull()
  })

  it('returns null when any other parameter is non-zero', () => {
    const cfg = staticConfig('634195840')
    cfg.kmax = '1'
    expect(detectCustomStaticKinkConfig(cfg)).toBeNull()
  })

  it('returns null when ulow is non-zero', () => {
    const cfg = staticConfig('634195840')
    cfg.ulow = '650000000000000000'
    expect(detectCustomStaticKinkConfig(cfg)).toBeNull()
  })

  it('returns null for undefined or missing config', () => {
    expect(detectCustomStaticKinkConfig(undefined)).toBeNull()
    expect(detectCustomStaticKinkConfig(null)).toBeNull()
    expect(detectCustomStaticKinkConfig({})).toBeNull()
  })

  it('accepts bigint and number inputs', () => {
    const cfg: Record<string, unknown> = {
      ulow: 0,
      u1: 0,
      u2: BigInt('1000000000000000000'),
      ucrit: BigInt('1000000000000000000'),
      rmin: 634195840,
      kmin: 0,
      kmax: 0,
      alpha: 0,
      cminus: 0,
      cplus: 0,
      c1: 0,
      c2: 0,
      dmax: 0,
    }
    expect(detectCustomStaticKinkConfig(cfg)).toBe('2.0%')
  })

  it('does not collide with fixed-10 JSON match (integration sanity)', () => {
    // The same shape is found in JSON as "fixed-10", so callers should prefer
    // findKinkConfigName first; detectCustomStaticKinkConfig is only a fallback.
    expect(findKinkConfigName(
      { type: 'DynamicKinkModel', config: staticConfig('3170979198') },
      JSON_CONFIGS
    )).toBe('fixed-10')
    // But the detector itself still recognizes the shape and computes 10.0%.
    expect(detectCustomStaticKinkConfig(staticConfig('3170979198'))).toBe('10.0%')
  })
})
