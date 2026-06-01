/**
 * Build custom errors list and selector map from canonical IErrors.sol.
 *
 * Usage:
 *   node scripts/buildCustomErrorsSelectors.mjs
 *   SILO_IERRORS_URL=https://.../IErrors.sol node scripts/buildCustomErrorsSelectors.mjs
 *
 * Output:
 *   - src/data/customErrorsList.json      – signatures with source URL
 *   - src/data/customErrorsSelectors.json – selectorHex → signature, list with selectorDecimal
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ethers } from 'ethers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const IERRORS_URL =
  process.env.SILO_IERRORS_URL ||
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v3/refs/heads/develop/common/utils/interfaces/IErrors.sol'

const DATA_DIR = path.join(ROOT, 'src', 'data')
const OUT_LIST = path.join(DATA_DIR, 'customErrorsList.json')
const OUT_SELECTORS = path.join(DATA_DIR, 'customErrorsSelectors.json')

/** Match: error Name(); or error Name(type param); */
const ERROR_RE = /error\s+(\w+)\s*\(([^)]*)\)\s*;/g

/**
 * Canonical Solidity signature: only types, no param names.
 * e.g. "address _factory" -> "address", "uint256 amount" -> "uint256"
 */
function canonicalParams(paramsRaw) {
  if (!paramsRaw.trim()) return ''
  return paramsRaw
    .split(',')
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean)
    .join(', ')
}

function extractErrorsFromContent(content, sourceFile) {
  const entries = []
  let m
  ERROR_RE.lastIndex = 0
  while ((m = ERROR_RE.exec(content)) !== null) {
    const name = m[1]
    const paramsRaw = m[2]
    const paramsCanonical = canonicalParams(paramsRaw)
    const signature = paramsCanonical ? `${name}(${paramsCanonical})` : `${name}()`
    entries.push({ signature, sourceFile })
  }
  return entries
}

function computeSelector(signature) {
  const hash = ethers.id(signature)
  const selectorHex = hash.slice(0, 10)
  const selectorDecimal = parseInt(selectorHex.slice(2), 16)
  return { selectorHex, selectorDecimal }
}

async function fetchCanonicalIErrors() {
  const response = await fetch(IERRORS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch IErrors.sol (${response.status} ${response.statusText}) from ${IERRORS_URL}`)
  }
  return response.text()
}

async function main() {
  const bySignature = new Map()
  const iErrorsSol = await fetchCanonicalIErrors()
  for (const entry of extractErrorsFromContent(iErrorsSol, IERRORS_URL)) {
    if (!bySignature.has(entry.signature)) {
      bySignature.set(entry.signature, { signature: entry.signature, sourceFiles: [] })
    }
    const rec = bySignature.get(entry.signature)
    if (!rec.sourceFiles.includes(entry.sourceFile)) rec.sourceFiles.push(entry.sourceFile)
  }

  const list = []
  const bySelector = {}

  for (const rec of bySignature.values()) {
    const { selectorHex, selectorDecimal } = computeSelector(rec.signature)
    list.push({
      signature: rec.signature,
      selectorHex,
      selectorDecimal,
      sourceFiles: rec.sourceFiles
    })
    bySelector[selectorHex] = rec.signature
  }

  list.sort((a, b) => a.signature.localeCompare(b.signature))

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  fs.writeFileSync(
    OUT_LIST,
    JSON.stringify(
      list.map(({ signature, sourceFiles }) => ({ signature, sourceFiles })),
      null,
      2
    ),
    'utf8'
  )

  fs.writeFileSync(
    OUT_SELECTORS,
    JSON.stringify(
      {
        bySelector,
        list: list.map(({ signature, selectorHex, selectorDecimal }) => ({
          signature,
          selectorHex,
          selectorDecimal
        }))
      },
      null,
      2
    ),
    'utf8'
  )

  console.log('Custom errors:', list.length)
  console.log('Source:', IERRORS_URL)
  console.log('Written:', OUT_LIST)
  console.log('Written:', OUT_SELECTORS)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
