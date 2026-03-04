import { isHexAddress } from '@/utils/addressValidation'

/**
 * Extracts a hex address from a free-form user input.
 *
 * Behavior:
 * - If the string contains a 0x + 40 hex chars sequence, returns the first match.
 * - This covers URLs from any explorer (Etherscan, Arbiscan, etc.).
 * - If there is no hex address inside, returns the trimmed original string.
 *
 * This is intentionally lenient: it never throws, just returns the best candidate.
 */
export function extractHexAddressLike(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  // Fast path: already a plain hex address
  if (isHexAddress(trimmed)) {
    return trimmed
  }

  // Generic path: look for 0x + 40 hex chars anywhere in the string (URL, log line, etc.)
  const match = trimmed.match(/0x[a-fA-F0-9]{40}/)
  if (match) {
    return match[0]
  }

  return trimmed
}

