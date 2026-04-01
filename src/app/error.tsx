'use client'

import { useCallback } from 'react'
import Button from '@/components/Button'
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
          <Button type="button" variant="primary" size="md" onClick={reset}>
            Try Again
          </Button>
          <Button type="button" variant="orange" size="md" onClick={handleClearCache}>
            Clear Cache
          </Button>
        </div>
      </div>
    </div>
  )
}
