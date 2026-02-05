import { getChainNameForAddresses, ADDRESSES_JSON_BASE } from '@/utils/symbolToAddress'

const REPO_BASE = 'https://raw.githubusercontent.com/silo-finance/silo-contracts-v2/master'

async function fetchJsonNoCache<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' }
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`)
  }
  return (await res.json()) as T
}

export async function fetchAddresses(chainId: string): Promise<Record<string, string>> {
  const chainName = getChainNameForAddresses(chainId)
  const url = `${ADDRESSES_JSON_BASE}/${chainName}.json`
  return fetchJsonNoCache<Record<string, string>>(url)
}

export async function fetchSiloCoreDeploymentAddress(
  chainAlias: string,
  contractName: string
): Promise<string | null> {
  const url = `${REPO_BASE}/silo-core/deployments/${chainAlias}/${contractName}.json`
  const data = await fetchJsonNoCache<{ address?: string }>(url)
  return data?.address ?? null
}

export async function fetchSiloImplementations(chainAlias: string): Promise<string[]> {
  const url = `${REPO_BASE}/silo-core/deploy/silo/_siloImplementations.json`
  const data = await fetchJsonNoCache<Record<string, { implementation: string }[]>>(url)
  const entries = data?.[chainAlias] ?? []
  return entries.map((entry) => entry.implementation)
}

export async function fetchKinkConfigs(): Promise<
  { name: string; config: Record<string, string | number> }[]
> {
  const url = `${REPO_BASE}/silo-core/deploy/input/irmConfigs/kink/DKinkIRMConfigs.json`
  return fetchJsonNoCache(url)
}

export async function fetchKinkImmutable(): Promise<
  { name: string; timelock: number; rcompCap: number }[]
> {
  const url = `${REPO_BASE}/silo-core/deploy/input/irmConfigs/kink/DKinkIRMImmutable.json`
  return fetchJsonNoCache(url)
}

export async function fetchIrmV2Configs(): Promise<
  { name: string; config: Record<string, string | number> }[]
> {
  const url = `${REPO_BASE}/silo-core/deploy/input/irmConfigs/InterestRateModelConfigs.json`
  return fetchJsonNoCache(url)
}
