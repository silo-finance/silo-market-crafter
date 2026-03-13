'use client'

import React, { useState, useEffect } from 'react'
import { getKinkConfigSourceUrl } from '@/utils/kinkConfigSourceUrl'

export interface IrmConfigNameWithLinkProps {
  /** Config name (e.g. "static-2.4-6") */
  configName: string
  /** emphasized = chip style (visible label), normal = darker font for history/pending */
  variant?: 'emphasized' | 'normal'
}

export default function IrmConfigNameWithLink({ configName, variant = 'emphasized' }: IrmConfigNameWithLinkProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!configName || configName === 'not able to match') {
      setSourceUrl(null)
      return
    }
    getKinkConfigSourceUrl(configName).then(setSourceUrl)
  }, [configName])

  const nameClassName = variant === 'emphasized' ? 'irm-config-name-chip' : 'irm-history-config-name'

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={nameClassName}>{configName}</span>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View config in repository"
          className="inline-flex items-center justify-center text-gray-400 hover:text-lime-500 transition-colors"
          aria-label="View config in repository"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </span>
  )
}
