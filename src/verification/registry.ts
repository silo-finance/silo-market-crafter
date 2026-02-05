import type { VerificationCheck, VerificationCheckFactory, VerificationContext } from './types'

const context = require.context('./checks', false, /\.ts$/)

export function buildVerificationChecks(verificationContext: VerificationContext): VerificationCheck[] {
  const checks: VerificationCheck[] = []

  context.keys().forEach((key) => {
    const mod = context(key) as { default?: VerificationCheckFactory }
    const factory = mod.default
    if (!factory || typeof factory.build !== 'function') return

    const builtChecks = factory.build(verificationContext)
    const sourceFile = key.replace('./', '')

    for (const check of builtChecks) {
      checks.push({ ...check, sourceFile })
    }
  })

  return checks.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    if (a.sourceFile !== b.sourceFile) return a.sourceFile.localeCompare(b.sourceFile)
    return a.checkName.localeCompare(b.checkName)
  })
}
