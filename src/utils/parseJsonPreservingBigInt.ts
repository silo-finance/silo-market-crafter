/**
 * Parse JSON while preserving large integers (e.g. 18-decimal config values).
 * JavaScript Number loses precision for integers beyond 2^53-1; contract IRM configs
 * use values like 920000000000000001 which would round to 920000000000000000.
 * This replaces 16+ digit numbers in the raw string with quoted form before parsing,
 * so they become strings and can be passed to BigInt() correctly.
 */
const LARGE_INTEGER_DIGITS = 16

export function parseJsonPreservingBigInt<T = unknown>(rawText: string): T {
  const withStrings = rawText.replace(
    new RegExp(`:(\\s*)(-?\\d{${LARGE_INTEGER_DIGITS},})`, 'g'),
    ':$1"$2"'
  )
  return JSON.parse(withStrings) as T
}
