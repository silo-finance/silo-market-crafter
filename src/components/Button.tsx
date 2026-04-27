'use client'

/**
 * Reusable Button component with consistent styling across the app.
 * Use variant/size props instead of inline Tailwind classes.
 *
 * Variants: primary | primaryDark | primaryLightDisabled | secondary | destructive | orange | outline | outlineLight | ghost
 * Sizes: sm | md | mdWide | lg | icon
 */
import React from 'react'

const variantStyles = {
  primary:
    'bg-[var(--silo-accent)] hover:bg-[#8a9cf0] disabled:bg-[var(--silo-border)] disabled:text-[var(--silo-text-faint)] disabled:opacity-60 disabled:cursor-not-allowed text-[var(--silo-surface-strong)]',
  primaryDark:
    'bg-[var(--silo-deep-purple)] hover:bg-[#8898e8] text-[var(--silo-black)]',
  primaryLightDisabled:
    'bg-[var(--silo-deep-purple)] hover:bg-[#8898e8] disabled:bg-[var(--silo-border)] disabled:cursor-not-allowed text-[var(--silo-black)] disabled:text-[var(--silo-text-faint)]',
  secondary:
    'bg-[var(--silo-surface)] hover:bg-[var(--silo-surface-2)] text-[var(--silo-text)] border border-[var(--silo-border)]',
  destructive:
    'bg-[#e76969] hover:bg-[#dc5a5a] text-white',
  orange:
    'bg-[#f4b24b] hover:bg-[#efaa39] text-[#3d2a00]',
  outline:
    'bg-transparent hover:bg-[var(--silo-surface-2)] border border-[var(--silo-border)] text-[var(--silo-text)] font-semibold',
  outlineLight:
    'bg-[var(--silo-surface)] hover:bg-[var(--silo-surface-2)] border border-[var(--silo-border)] text-[var(--silo-text)] font-medium',
  ghost:
    'border border-[var(--silo-border)] text-[var(--silo-text-soft)] hover:bg-[var(--silo-surface-2)] hover:text-[var(--silo-text)]',
} as const

const sizeStyles = {
  sm: 'py-2 px-4 rounded-lg',
  md: 'py-3 px-6 rounded-lg',
  mdWide: 'py-2 px-6 rounded-lg',
  lg: 'py-3 px-8 rounded-lg',
  icon: 'p-3 rounded-full',
} as const

export type ButtonVariant = keyof typeof variantStyles
export type ButtonSize = keyof typeof sizeStyles

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'font-semibold transition-colors duration-200 flex items-center justify-center gap-2',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'flex-1 w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
