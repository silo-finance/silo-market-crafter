/**
 * Hard‑coded mapping from contract "name" (prefix from Silo Lens version string)
 * to Solidity source file path inside the Silo contracts monorepo.
 *
 * The base repository is always:
 *   https://github.com/silo-finance/silo-contracts-v2 (branch: master)
 *
 * IMPORTANT:
 * - Keys MUST match the contract name part of the Silo Lens version string,
 *   e.g. "DynamicKinkModel 1.2.3" → key "DynamicKinkModel".
 * - Values are repository‑relative Solidity paths.
 *
 * This mapping is intentionally hard‑coded so the verifier can jump directly
 * to the correct file without any repository search at runtime.
 */
const CONTRACT_SOURCE_PATHS: Record<string, string> = {
  // Core IRM
  DynamicKinkModel: 'silo-core/contracts/interestRateModel/kink/DynamicKinkModel.sol',

  // Core hooks
  SiloHookV2: 'silo-core/contracts/hooks/SiloHookV2.sol',
  SiloHookV3: 'silo-core/contracts/hooks/SiloHookV3.sol',

  // Core factory + lens (included for completeness – versions are shown in UI)
  SiloFactory: 'silo-core/contracts/SiloFactory.sol',
  Silo: 'silo-core/contracts/Silo.sol',
  ShareProtectedCollateralToken: 'silo-core/contracts/utils/ShareProtectedCollateralToken.sol',
  ShareDebtToken: 'silo-core/contracts/utils/ShareDebtToken.sol',

  // Oracles package (Silo V3 repo layout)
  ChainlinkV3Oracle: 'silo-oracles/contracts/chainlinkV3/ChainlinkV3Oracle.sol',
  OracleScaler: 'silo-oracles/contracts/scaler/OracleScaler.sol',
  ERC4626OracleHardcodeQuote: 'silo-oracles/contracts/erc4626/ERC4626OracleHardcodeQuote.sol',
  CustomMethodOracle: 'silo-oracles/contracts/custom-method/CustomMethodOracle.sol',

  // Manageable oracle wrapper
  ManageableOracle: 'silo-oracles/contracts/manageable/ManageableOracle.sol',
  SiloIncentivesController: 'silo-core/contracts/incentives/SiloIncentivesController.sol',
  SiloDeployer: 'silo-core/contracts/SiloDeployer.sol',
  PTLinearOracle: 'silo-oracles/contracts/pendle/linear/PTLinearOracle.sol'
}

// Base URLs for Silo contracts V3 repository.
// raw: used internally for fetching Solidity source;
// ui:  used in the wizard UI so users get nice GitHub view.
const SILO_REPO_RAW_BASE =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v3/master/'
const SILO_REPO_UI_BASE =
  'https://github.com/silo-finance/silo-contracts-v3/blob/master/'

export interface ReleaseVersionCheckResult {
  /** Full version string from Silo Lens, e.g. "DynamicKinkModel 1.2.3" */
  onChainVersion: string
  /** Extracted release part from on-chain version, e.g. "1.2.3" */
  onChainRelease: string | null
  /** Release parsed from Solidity source, e.g. "1.2.3" */
  sourceRelease: string | null
  /**
   * Verification outcome:
   * - 'match'    → on-chain release is exactly equal to Solidity release
   * - 'mismatch' → both sides parsed, but releases are different
   * - 'unknown'  → could not determine one side or fetch source
   */
  status: 'match' | 'mismatch' | 'unknown'
  /** Direct link to Solidity source file in the repository (always master branch) */
  sourceUrl?: string
  /**
   * When true, this contract name does not have a hard-coded Solidity path
   * in CONTRACT_SOURCE_PATHS – we cannot perform source-based verification yet.
   */
  unknownContract?: boolean
}

/**
 * Extract contract name and release part from a Silo Lens version string.
 *
 * Example:
 *   "DynamicKinkModel 1.2.3" → { contractName: "DynamicKinkModel", release: "1.2.3" }
 */
function parseOnChainVersion(version: string | undefined | null): {
  contractName: string
  release: string | null
} | null {
  if (!version) return null
  const trimmed = version.trim()
  if (!trimmed) return null

  const [contractName, ...rest] = trimmed.split(' ')
  if (!contractName) return null
  const release = rest.join(' ').trim()
  return { contractName, release: release || null }
}

async function fetchSourceRelease(contractName: string): Promise<{
  sourceContents: string | null
  sourceUrl?: string
  unknownContract: boolean
}> {
  const repoPath = CONTRACT_SOURCE_PATHS[contractName]
  if (!repoPath) {
    return { sourceContents: null, unknownContract: true }
  }

  const rawUrl = `${SILO_REPO_RAW_BASE}${repoPath}`
  const uiUrl = `${SILO_REPO_UI_BASE}${repoPath}`

  try {
    const res = await fetch(rawUrl)
    if (!res.ok) {
      return { sourceContents: null, sourceUrl: uiUrl, unknownContract: false }
    }
    const text = await res.text()
    return { sourceContents: text, sourceUrl: uiUrl, unknownContract: false }
  } catch {
    return { sourceContents: null, sourceUrl: uiUrl, unknownContract: false }
  }
}

/**
 * Verify that a Silo Lens version string (e.g. "DynamicKinkModel 1.2.3")
 * matches the release version encoded in the corresponding Solidity file
 * in the silo‑contracts‑v2 monorepo (master branch).
 *
 * This function is intentionally side‑effect‑free apart from a single fetch
 * to the raw GitHub URL derived from CONTRACT_SOURCE_PATHS.
 */
export async function verifyReleaseVersion(
  version: string | undefined | null
): Promise<ReleaseVersionCheckResult | null> {
  const parsed = parseOnChainVersion(version)
  if (!parsed) return null

  const { contractName, release: onChainRelease } = parsed

  const { sourceContents, sourceUrl, unknownContract } = await fetchSourceRelease(contractName)

  let status: ReleaseVersionCheckResult['status'] = 'unknown'

  const fullVersion = version?.trim() ?? ''
  const needle = fullVersion ? `"${fullVersion}"` : ''

  if (sourceContents && needle) {
    status = sourceContents.includes(needle) ? 'match' : 'mismatch'
  }

  return {
    onChainVersion: version ?? '',
    onChainRelease: onChainRelease,
    sourceRelease: null,
    status,
    sourceUrl,
    unknownContract
  }
}

/**
 * Convenience helper for batch verification – accepts an array of version strings
 * and returns a Map keyed by the original version string. This is useful for
 * wiring verification results into the UI where we only have the raw display
 * version string available.
 */
export async function verifyReleaseVersionsBatch(
  versions: Array<string | undefined | null>
): Promise<Map<string, ReleaseVersionCheckResult>> {
  const unique = Array.from(new Set(versions.filter((v): v is string => !!v && v.trim() !== '')))

  const entries = await Promise.all(
    unique.map(async (v) => {
      const result = await verifyReleaseVersion(v)
      return result ? [v, result] : null
    })
  )

  const map = new Map<string, ReleaseVersionCheckResult>()
  for (const entry of entries) {
    if (!entry) continue
    const [v, result] = entry as [string, ReleaseVersionCheckResult]
    // Normalize key to the exact string we got from Silo Lens.
    map.set(v, result)
  }
  return map
}

