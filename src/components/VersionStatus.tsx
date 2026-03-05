'use client'

import React, { useEffect, useState } from 'react'
import { ReleaseVersionCheckResult, verifyReleaseVersion } from '@/utils/verification/releaseVersionVerification'

export function VersionStatus({ version }: { version?: string | null }) {
  const trimmed = version?.trim()
  const [result, setResult] = useState<ReleaseVersionCheckResult | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const res = await verifyReleaseVersion(trimmed)
        if (!cancelled) {
          setResult(res)
        }
      } catch {
        if (!cancelled) {
          setResult(null)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [trimmed])

  // Nothing to render when version is missing or placeholder
  if (!trimmed || trimmed === '—') {
    return (
      <span className="text-version-muted text-sm ml-1">
        {' '}
        ({trimmed ?? '—'})
      </span>
    )
  }

  const hasResult = result != null
  const sourceUrl = result?.sourceUrl
  const unknown = result?.unknownContract || result?.status === 'unknown'

  return (
    <span className="inline-flex items-center gap-1.5 text-version-muted text-sm ml-1">
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {' '}
          ({trimmed})
        </a>
      ) : (
        <span>
          {' '}
          ({trimmed})
        </span>
      )}

      {/* No mapping / cannot verify against source → Unverified version (yellow triangle) */}
      {hasResult && unknown && (
        <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium ml-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2zm0 4.8L18.4 20H5.6L12 6.8zm-1 5.2v4h2v-4h-2zm0 5v2h2v-2h-2z" />
          </svg>
          <span>Unverified version</span>
        </span>
      )}

      {/* Mapping + versions match → "version" + green check */}
      {hasResult && !unknown && result?.status === 'match' && (
        <span className="inline-flex items-center gap-1 text-green-500 text-xs font-medium ml-1">
          <span>version</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      {/* Mapping + versions mismatch → "invalid version" + red cross */}
      {hasResult && !unknown && result?.status === 'mismatch' && (
        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium ml-1">
          <span>invalid version</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )}
    </span>
  )
}
