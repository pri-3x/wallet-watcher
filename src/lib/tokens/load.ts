import { blockscoutOrigin, findChain } from "@/lib/chains/catalog";
import { buildOverview, type TokenOverview } from "@/lib/tokens/overview";

type AddressRecord = {
  hash?: string;
  name?: string | null;
  metadata?: { tags?: Array<{ name?: string; tagType?: string }> } | null;
};

type HolderItem = {
  address?: AddressRecord;
  value?: string;
};

type TransferItem = {
  from?: AddressRecord;
  to?: AddressRecord;
  total?: { value?: string; decimals?: string };
};

type TokenRecord = {
  type?: string;
  name?: string;
  symbol?: string;
  decimals?: string;
  exchange_rate?: string | null;
  total_supply?: string;
  holders_count?: string;
};

export async function loadTokenOverview(chainId: string, rawAddress: string): Promise<TokenOverview> {
  const chain = findChain(chainId);
  const origin = chain ? blockscoutOrigin(chain.id) : null;
  if (!chain || !origin) {
    throw new Error("Holder balances are available on Ethereum, Sepolia, Polygon, Base, and Arbitrum.");
  }
  const address = rawAddress.trim();
  const token = await getJson<TokenRecord>(`${origin}/api/v2/tokens/${address}`);
  if (token.type !== "ERC-20") {
    throw new Error("That address isn't an ERC-20 token on this chain.");
  }
  const decimals = Number(token.decimals ?? 18);
  const holders = await fetchHolders(origin, address, decimals);
  const transfers = await fetchTransfers(origin, address);
  return buildOverview({
    address,
    chainId: chain.id,
    name: token.name || token.symbol || "Token",
    symbol: token.symbol || "TOKEN",
    price: Number(token.exchange_rate) || 0,
    totalSupply: human(token.total_supply ?? "0", decimals),
    holdersCount: Number(token.holders_count) || holders.length,
    holders,
    transfers,
  });
}

export async function identifyToken(chainId: string, rawAddress: string) {
  const origin = blockscoutOrigin(chainId);
  if (!origin) return null;
  try {
    const token = await getJson<TokenRecord>(`${origin}/api/v2/tokens/${rawAddress.trim()}`);
    if (token.type !== "ERC-20" || !token.symbol) return null;
    return { symbol: token.symbol, name: token.name || token.symbol };
  } catch {
    return null;
  }
}

async function fetchHolders(origin: string, address: string, decimals: number) {
  const collected: Array<{ address: string; label: string; amount: number }> = [];
  let url = `${origin}/api/v2/tokens/${address}/holders`;
  for (let page = 0; page < 2; page += 1) {
    const json = await getJson<{ items?: HolderItem[]; next_page_params?: Record<string, string | number> | null }>(url);
    for (const item of json.items ?? []) {
      const hash = item.address?.hash;
      if (!hash || !item.value) continue;
      collected.push({ address: hash, label: labelFor(item.address), amount: human(item.value, decimals) });
    }
    if (!json.next_page_params) break;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(json.next_page_params)) params.set(key, String(value));
    url = `${origin}/api/v2/tokens/${address}/holders?${params.toString()}`;
  }
  return collected;
}

async function fetchTransfers(origin: string, address: string) {
  const json = await getJson<{ items?: TransferItem[] }>(`${origin}/api/v2/tokens/${address}/transfers`);
  return (json.items ?? []).flatMap((item) => {
    const from = item.from?.hash;
    const to = item.to?.hash;
    const raw = item.total?.value;
    if (!from || !to || !raw) return [];
    return [{ from, to, amount: human(raw, Number(item.total?.decimals ?? 18)) }];
  });
}

function labelFor(address: AddressRecord | undefined) {
  if (!address) return "Wallet";
  if (address.name) return address.name;
  const named = address.metadata?.tags?.find((tag) => tag.tagType === "name" && tag.name);
  return named?.name || "Wallet";
}

function human(raw: string, decimals: number) {
  try {
    const value = BigInt(raw);
    const scale = decimals > 0 ? BigInt(10) ** BigInt(decimals) : BigInt(1);
    const whole = value / scale;
    const fraction = value % scale;
    return Number(whole) + Number(fraction) / Number(scale);
  } catch {
    return 0;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "wallet-watch" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Holder data returned ${response.status}.`);
  }
  return (await response.json()) as T;
}
