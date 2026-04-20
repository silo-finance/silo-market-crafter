/**
 * Pure helpers for classifying an IRM updateConfig row in the verification UI.
 *
 * `matchTxToSiloInPair` resolves which silo of a SiloConfig pair the transaction
 * IRM target belongs to, with a "silo1 first, silo0 fallback" preference when the
 * intended silo cannot be inferred from the user input (i.e. user pasted a
 * SiloConfig address) or when the intended silo's IRM does not match the tx
 * target (i.e. user pasted the wrong silo of a pair).
 *
 * `classifyRowStatus` collapses (siloMatch, configRecognition) into a single
 * pass / warning / fail badge per the verification spec.
 */

export type SiloSlot = 'silo0' | 'silo1'
export type SiloMatchKind = 'direct' | 'fallback' | 'none'
export type RowStatus = 'pass' | 'warning' | 'fail'

export interface PairIrmTargets {
  silo0: { irm: string; tokenSymbol?: string }
  silo1: { irm: string; tokenSymbol?: string }
}

export interface SiloMatchResult {
  kind: SiloMatchKind
  matchedSlot: SiloSlot | null
}

function eqAddress(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

export function matchTxToSiloInPair(
  txTo: string,
  pair: PairIrmTargets,
  intendedSilo: SiloSlot | null
): SiloMatchResult {
  if (intendedSilo && eqAddress(pair[intendedSilo].irm, txTo)) {
    return { kind: 'direct', matchedSlot: intendedSilo }
  }

  // Fallback order: silo1 first, then silo0 (per verification spec).
  if (eqAddress(pair.silo1.irm, txTo)) {
    return { kind: 'fallback', matchedSlot: 'silo1' }
  }
  if (eqAddress(pair.silo0.irm, txTo)) {
    return { kind: 'fallback', matchedSlot: 'silo0' }
  }

  return { kind: 'none', matchedSlot: null }
}

export function classifyRowStatus(
  matchKind: SiloMatchKind,
  matchedConfigName: string | null,
  customStaticRate: string | null
): RowStatus {
  if (matchKind === 'none') return 'fail'

  const configRecognized = matchedConfigName != null || customStaticRate != null
  if (!configRecognized) return 'fail'

  if (matchKind === 'direct') {
    return matchedConfigName != null ? 'pass' : 'warning'
  }

  // matchKind === 'fallback'
  return 'warning'
}
