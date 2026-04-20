import { isCustomStaticFlatRateLabel } from '@/utils/kinkConfigName'

const KINK_CONFIGS_RAW_URL =
  'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'
const KINK_CONFIGS_BLOB_URL =
  'https://github.com/silo-finance/silo-contracts-v2/blob/master/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json'

let cachedRawLines: string[] | null = null

async function fetchRawLines(): Promise<string[]> {
  if (cachedRawLines) return cachedRawLines
  const res = await fetch(KINK_CONFIGS_RAW_URL)
  if (!res.ok) return []
  const rawText = await res.text()
  cachedRawLines = rawText.split(/\r?\n/)
  return cachedRawLines
}

/**
 * Returns the 1-based line number in DKinkIRMConfigs.json where the config name is defined,
 * or null if not found.
 */
export async function getKinkConfigLineNumber(configName: string): Promise<number | null> {
  if (!configName || configName === 'not able to match' || isCustomStaticFlatRateLabel(configName)) return null
  try {
    const lines = await fetchRawLines()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('"name"') && line.includes(`"${configName}"`)) {
        return i + 1
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Returns the GitHub blob URL to the exact line in DKinkIRMConfigs.json for the config,
 * or null if line number cannot be resolved.
 */
export async function getKinkConfigSourceUrl(configName: string): Promise<string | null> {
  const line = await getKinkConfigLineNumber(configName)
  if (line == null) return null
  return `${KINK_CONFIGS_BLOB_URL}#L${line}`
}
