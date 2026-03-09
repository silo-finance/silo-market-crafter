import { isHexAddress } from '@/utils/addressValidation'

/**
 * Extracts a hex address or transaction hash from a free-form user input.
 *
 * Behavior:
 * - If the string is a plain 0x + 64 hex (tx hash) or 0x + 40 hex (address), returns as-is.
 * - Otherwise looks for 0x + 64 hex (tx hash) or 0x + 40 hex (address) in the string (e.g. explorer URL).
 * - If there is no match, returns the trimmed original string (no truncation).
 *
 * This is intentionally lenient: it never throws, just returns the best candidate.
 */
export function extractHexAddressLike(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  // Fast path: already a plain tx hash (0x + 64 hex) or address (0x + 40 hex)
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed
  if (isHexAddress(trimmed)) return trimmed

  // Generic path: look for 0x + 64 hex (tx hash) first, then 0x + 40 hex (address)
  const txHashMatch = trimmed.match(/0x[a-fA-F0-9]{64}/)
  if (txHashMatch) return txHashMatch[0]
  const addressMatch = trimmed.match(/0x[a-fA-F0-9]{40}/)
  if (addressMatch) return addressMatch[0]

  return trimmed
}

