const ORACLE_ORDER: Record<string, number> = {
  solvencyOracle0: 0,
  maxLtvOracle0: 1,
  solvencyOracle1: 2,
  maxLtvOracle1: 3
}

export function getOracleOrder(oracleName: string, offset: number): number {
  const base = ORACLE_ORDER[oracleName] ?? 0
  return 450 + base * 10 + offset
}
