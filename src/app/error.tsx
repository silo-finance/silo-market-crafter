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
    <div className="light-market-theme min-h-screen flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-[#f6fbf2] rounded-lg border border-lime-200 p-8">
        <h2 className="text-2xl font-semibold text-emerald-950 mb-3">
          Application error
        </h2>
        <p className="text-emerald-800 mb-6">
          A client-side exception has occurred. If this persists, clear cache and try again.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="bg-lime-800 hover:bg-lime-700 text-white cta-strong-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleClearCache}
            className="bg-orange-600 hover:bg-orange-500 text-white cta-strong-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Clear Cache
          </button>
        </div>
      </div>
    </div>
  )
}
