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
