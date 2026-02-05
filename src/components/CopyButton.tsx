'use client'

import React, { useState, useCallback } from 'react'

const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m0 0V4a2 2 0 012-2h4a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

interface CopyButtonProps {
  value: string
  className?: string
  title?: string
  iconClassName?: string
}

export default function CopyButton({ value, className = '', title = 'Copy', iconClassName = 'w-4 h-4' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      const t = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(t)
    } catch {
      setCopied(false)
    }
  }, [value])

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : title}
      className={`inline-flex items-center justify-center shrink-0 rounded p-1 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors ${className}`}
      aria-label={copied ? 'Copied' : title}
    >
      {copied ? (
        <CheckIcon className={`${iconClassName} text-green-400`} />
      ) : (
        <ClipboardIcon className={iconClassName} />
      )}
    </button>
  )
}
