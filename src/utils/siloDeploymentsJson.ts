/**
 * Build the deployment key for one market: Silo_<sym0>_<sym1>_id_<id>
 * Symbols are used as-is (e.g. PT-USDai-19FEB2026, USDC).
 */
export function buildSiloDeploymentKey(symbol0: string, symbol1: string, siloId: bigint): string {
  const s0 = (symbol0 || 'ASSET0').trim()
  const s1 = (symbol1 || 'ASSET1').trim()
  return `Silo_${s0}_${s1}_id_${siloId}`
}
