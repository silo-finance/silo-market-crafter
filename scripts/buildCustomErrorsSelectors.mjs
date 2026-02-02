/**
 * Build custom errors list and selector map from Silo contracts (.sol).
 *
 * Scans:
 *   - SILO_CONTRACTS_V2/silo-core/contracts
 *   - SILO_CONTRACTS_V2/silo-oracles/contracts
 *
 * Usage:
 *   node scripts/buildCustomErrorsSelectors.mjs
 *   SILO_CONTRACTS_V2=/path/to/silo-contracts-v2 node scripts/buildCustomErrorsSelectors.mjs
 *
 * Output:
 *   - src/data/customErrorsList.json   – full list (signature, sourceFile)
 *   - src/data/customErrorsSelectors.json – selectorHex → signature, list with selectorDecimal
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ethers } from 'ethers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SILO_CONTRACTS_V2 = process.env.SILO_CONTRACTS_V2 || path.join(ROOT, '..', 'silo-contracts-v2')
const SCAN_DIRS = [
  path.join(SILO_CONTRACTS_V2, 'silo-core', 'contracts'),
  path.join(SILO_CONTRACTS_V2, 'silo-oracles', 'contracts')
]

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

function* walkSolFiles(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walkSolFiles(full)
    else if (e.isFile() && e.name.endsWith('.sol')) yield full
  }
}

function extractErrorsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const relativePath = path.relative(ROOT, filePath)
  const entries = []
  let m
  ERROR_RE.lastIndex = 0
  while ((m = ERROR_RE.exec(content)) !== null) {
    const name = m[1]
    const paramsRaw = m[2]
    const paramsCanonical = canonicalParams(paramsRaw)
    const signature = paramsCanonical ? `${name}(${paramsCanonical})` : `${name}()`
    entries.push({ signature, sourceFile: relativePath })
  }
  return entries
}

function computeSelector(signature) {
  const hash = ethers.id(signature)
  const selectorHex = hash.slice(0, 10)
  const selectorDecimal = parseInt(selectorHex.slice(2), 16)
  return { selectorHex, selectorDecimal }
}

function main() {
  const bySignature = new Map()

  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) {
      console.warn('Skip (not found):', dir)
      continue
    }
    for (const file of walkSolFiles(dir)) {
      for (const entry of extractErrorsFromFile(file)) {
        if (!bySignature.has(entry.signature)) {
          bySignature.set(entry.signature, { signature: entry.signature, sourceFiles: [] })
        }
        const rec = bySignature.get(entry.signature)
        if (!rec.sourceFiles.includes(entry.sourceFile)) rec.sourceFiles.push(entry.sourceFile)
      }
    }
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
  console.log('Written:', OUT_LIST)
  console.log('Written:', OUT_SELECTORS)
}

main()
