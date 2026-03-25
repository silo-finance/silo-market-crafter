'use client'

import { useCallback } from 'react'
import { WIZARD_CACHE_KEYS } from '@/contexts/WizardContext'
import { clearVersionCache } from '@/utils/versionCache'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const handleClearCache = useCallback(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const homePath = basePath ? `${basePath.replace(/\/$/, '')}/` : '/'

    try {
      clearVersionCache()
      WIZARD_CACHE_KEYS.forEach((key) => localStorage.removeItem(key))
    } catch {
      // no-op
    } finally {
      // Keep redirect within app base path (important for GitHub Pages deployments).
      window.location.replace(homePath)
    }
  }, [])

  return (
    <div className="silo-page min-h-screen flex items-center justify-center px-4">
      <div className="max-w-xl w-full silo-panel p-8">
        <h2 className="text-2xl font-semibold silo-text-main mb-3">
          Application error
        </h2>
        <p className="silo-text-soft mb-6">
          A client-side exception has occurred. If this persists, clear cache and try again.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="bg-[var(--silo-accent)] hover:bg-[#7688ff] text-[#141d43] font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleClearCache}
            className="bg-[#f4b24b] hover:bg-[#efaa39] text-[#3f2b00] font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Clear Cache
          </button>
        </div>
      </div>
    </div>
  )
}
