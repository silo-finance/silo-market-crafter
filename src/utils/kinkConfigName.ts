/**
 * Finds the Kink IRM configuration name by comparing on-chain config with JSON configs.
 * Only matches against the "config" part (DKinkIRMConfigs.json); immutables (timelock/rcompCap) are ignored.
 */
export type KinkConfigItem = { name: string; config: Record<string, unknown> }

export function findKinkConfigName(
  irm: { type?: string; config?: Record<string, unknown> | undefined } | undefined,
  cfgJson: KinkConfigItem[]
): string | null {
  if (!irm || irm.type !== 'DynamicKinkModel' || !irm.config) return null
  const irmCfg = irm.config as Record<string, unknown>

  for (const cfg of cfgJson) {
    let matches = true
    for (const [key, val] of Object.entries(cfg.config)) {
      if (String(irmCfg[key]) !== String(val)) {
        matches = false
        break
      }
    }
    if (!matches) continue

    return cfg.name
  }
  return null
}

const ONE_E18 = BigInt('1000000000000000000')
const SECONDS_PER_YEAR = BigInt(31_536_000)

function toBigIntSafe(value: unknown): bigint | null {
  try {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') return BigInt(value)
    if (typeof value === 'string' && value.trim() !== '') return BigInt(value)
    return null
  } catch {
    return null
  }
}

/**
 * Detects a "custom static" DynamicKink configuration shape where the rate is a
 * constant APR encoded solely via `rmin`, with `u2 == ucrit == 1e18` and every
 * other parameter equal to zero. When the pattern is detected, returns the APR
 * computed as `rmin * SECONDS_PER_YEAR / 1e18`, formatted with one decimal of
 * percentage precision (e.g. "2.0%", "10.0%"). Returns null otherwise.
 */
export function detectCustomStaticKinkConfig(
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config) return null

  const zeroKeys = ['ulow', 'u1', 'kmin', 'kmax', 'alpha', 'cminus', 'cplus', 'c1', 'c2', 'dmax'] as const
  for (const key of zeroKeys) {
    const v = toBigIntSafe(config[key])
    if (v === null || v !== BigInt(0)) return null
  }

  const u2 = toBigIntSafe(config.u2)
  const ucrit = toBigIntSafe(config.ucrit)
  if (u2 !== ONE_E18 || ucrit !== ONE_E18) return null

  const rmin = toBigIntSafe(config.rmin)
  if (rmin === null || rmin < BigInt(0)) return null

  // annualRate (18 decimals) = rmin * secondsPerYear
  // deciPercent = round(annualRate * 1000 / 1e18)  (integer: percent * 10)
  // Rounding (not truncation) is used because on-chain `rmin` values are
  // integer-truncated from an exact target (e.g. rmin=3170979198 for 10% APR
  // actually yields 9.9999999...e16, which should display as "10.0%").
  const annualRate = rmin * SECONDS_PER_YEAR
  const deciPercent = (annualRate * BigInt(1000) + ONE_E18 / BigInt(2)) / ONE_E18
  const integerPart = deciPercent / BigInt(10)
  const fractionalDigit = deciPercent % BigInt(10)

  return `${integerPart.toString()}.${fractionalDigit.toString()}%`
}
