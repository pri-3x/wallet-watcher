import { shortAddress } from "@/lib/address";
import { formatAmount } from "@/lib/format";
import type { ActivityEvent, WalletView } from "@/lib/types";
import type { ChainDef } from "@/lib/chains/catalog";
import { rpcUrl } from "@/lib/chains/catalog";
import { ChainError } from "@/lib/chains/error";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const WSOL = "So11111111111111111111111111111111111111112";
const MINTS: Record<string, string> = { [USDC]: "USDC", [USDT]: "USDT", [WSOL]: "WSOL" };

export type SolanaTransaction = {
  slot?: number;
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: SolTokenBalance[];
    postTokenBalances?: SolTokenBalance[];
  } | null;
  transaction?: {
    signatures?: string[];
    message?: {
      accountKeys?: Array<string | { pubkey: string }>;
    };
  };
};

type SolTokenBalance = {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string | null };
};

export function eventsFromSolanaTransaction(
  focus: string,
  tx: SolanaTransaction,
  solPrice: number,
): ActivityEvent[] {
  if (!tx.meta || tx.meta.err) return [];
  const signature = tx.transaction?.signatures?.[0] ?? "";
  if (!signature) return [];
  const keys = (tx.transaction?.message?.accountKeys ?? []).map(accountKey);
  const tokens = tokenEvents(focus, signature, tx, keys, solPrice);
  const native = nativeEvent(focus, signature, tx, keys, solPrice);
  if (tokens.length > 0) return [...tokens, ...(native && native.amount !== "0" ? [native] : [])].slice(0, 4);
  return native ? [native] : [];
}

export async function loadSolanaWallet(address: string, chain: ChainDef): Promise<WalletView> {
  const lamports = await rpc<number>(chain, "getBalance", [address]);
  const sol = formatLamports(lamports);
  const price = await solPrice(chain);
  const signatures =
    (await rpc<Array<{ signature: string }> | null>(chain, "getSignaturesForAddress", [address, { limit: 15 }])) ?? [];
  const parsed = await Promise.all(
    signatures.map(async (row) => {
      try {
        return await rpc<SolanaTransaction | null>(chain, "getTransaction", [
          row.signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ]);
      } catch {
        return null;
      }
    }),
  );
  const events = parsed
    .flatMap((tx) => (tx ? eventsFromSolanaTransaction(address, tx, price) : []))
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    address,
    chain: chain.id,
    chainLabel: chain.name,
    explorer: chain.explorer,
    nativeSymbol: chain.nativeSymbol,
    ensName: null,
    source: "live",
    balanceUsd: Math.round(Number(sol) * price),
    balanceEth: sol,
    holdings: [{ symbol: chain.nativeSymbol, amount: sol, usd: Math.round(Number(sol) * price) }],
    txCount: signatures.length,
    firstSeen: events.at(-1)?.timestamp ?? Date.now(),
    lastActive: events[0]?.timestamp ?? Date.now(),
    events,
    note: signatures.length === 15 ? "Latest 15 signatures." : null,
    error: null,
  };
}

function nativeEvent(focus: string, signature: string, tx: SolanaTransaction, keys: string[], solPrice: number): ActivityEvent | null {
  const index = keys.indexOf(focus);
  if (index < 0) return null;
  const pre = tx.meta?.preBalances?.[index] ?? 0;
  const post = tx.meta?.postBalances?.[index] ?? 0;
  const fee = index === 0 ? (tx.meta?.fee ?? 0) : 0;
  const adjusted = post - pre + fee;
  const slot = tx.slot ?? 0;
  const timestamp = (tx.blockTime ?? 0) * 1000;
  const feeSol = formatLamports(tx.meta?.fee ?? 0);
  if (adjusted === 0) {
    if (index !== 0) return null;
    return base(focus, signature, slot, timestamp, feeSol, {
      type: "contract",
      direction: "out",
      asset: "SOL",
      amount: "0",
      amountUsd: 0,
      from: focus,
      to: keys[1] ?? "",
      summary: "Called a program",
    });
  }
  const direction = adjusted > 0 ? "in" : "out";
  const amount = formatLamports(Math.abs(adjusted));
  if (amount === "0") {
    if (index !== 0) return null;
    return base(focus, signature, slot, timestamp, feeSol, {
      type: "contract",
      direction: "out",
      asset: "SOL",
      amount: "0",
      amountUsd: 0,
      from: focus,
      to: keys[1] ?? "",
      summary: "Called a program",
    });
  }
  const other = counterparty(keys, tx.meta?.preBalances ?? [], tx.meta?.postBalances ?? [], index, direction);
  return base(focus, signature, slot, timestamp, feeSol, {
    type: "transfer",
    direction,
    asset: "SOL",
    amount,
    amountUsd: Math.round(Number(amount) * solPrice),
    from: direction === "out" ? focus : other,
    to: direction === "out" ? other : focus,
    summary: direction === "out" ? `Sent ${formatAmount(amount)} SOL` : `Received ${formatAmount(amount)} SOL`,
  });
}

function tokenEvents(focus: string, signature: string, tx: SolanaTransaction, keys: string[], solPrice: number): ActivityEvent[] {
  const before = new Map<string, bigint>();
  const meta = new Map<string, { decimals: number; symbol: string }>();
  for (const row of tx.meta?.preTokenBalances ?? []) {
    if (row.owner !== focus || !row.mint) continue;
    before.set(row.mint, BigInt(row.uiTokenAmount?.amount ?? "0"));
    meta.set(row.mint, { decimals: row.uiTokenAmount?.decimals ?? 0, symbol: MINTS[row.mint] ?? "SPL" });
  }
  const after = new Map<string, bigint>();
  for (const row of tx.meta?.postTokenBalances ?? []) {
    if (row.owner !== focus || !row.mint) continue;
    after.set(row.mint, BigInt(row.uiTokenAmount?.amount ?? "0"));
    meta.set(row.mint, { decimals: row.uiTokenAmount?.decimals ?? 0, symbol: MINTS[row.mint] ?? "SPL" });
  }
  const mints = new Set([...before.keys(), ...after.keys()]);
  const events: ActivityEvent[] = [];
  for (const mint of mints) {
    const delta = (after.get(mint) ?? BigInt(0)) - (before.get(mint) ?? BigInt(0));
    if (delta === BigInt(0)) continue;
    const info = meta.get(mint) ?? { decimals: 0, symbol: "SPL" };
    const amount = formatUnits(delta < BigInt(0) ? -delta : delta, info.decimals);
    if (amount === "0") continue;
    const direction = delta > BigInt(0) ? "in" : "out";
    const usd = info.symbol === "USDC" || info.symbol === "USDT" ? Math.round(Number(amount)) : info.symbol === "WSOL" ? Math.round(Number(amount) * solPrice) : 0;
    events.push(
      base(focus, signature, tx.slot ?? 0, (tx.blockTime ?? 0) * 1000, formatLamports(tx.meta?.fee ?? 0), {
        type: "transfer",
        direction,
        asset: info.symbol,
        amount,
        amountUsd: usd,
        from: direction === "out" ? focus : mint,
        to: direction === "out" ? mint : focus,
        summary: direction === "out" ? `Sent ${formatAmount(amount)} ${info.symbol}` : `Received ${formatAmount(amount)} ${info.symbol}`,
      }),
    );
  }
  return events;
}

function base(
  focus: string,
  signature: string,
  slot: number,
  timestamp: number,
  feeSol: string,
  fields: {
    type: ActivityEvent["type"];
    direction: "in" | "out";
    asset: string;
    amount: string;
    amountUsd: number;
    from: string;
    to: string;
    summary: string;
  },
): ActivityEvent {
  return {
    id: `${signature}:${fields.asset}:${fields.from}:${fields.to}`,
    hash: signature,
    timestamp,
    type: fields.type,
    direction: fields.direction,
    asset: fields.asset,
    amount: fields.amount,
    amountUsd: fields.amountUsd,
    from: party(fields.from, focus),
    to: party(fields.to, focus),
    blockNumber: slot,
    gasEth: feeSol,
    summary: fields.summary,
  };
}

function party(address: string, focus: string) {
  return {
    address,
    label: address === focus ? shortAddress(address, 4, 4) : shortAddress(address || "Program", 4, 4),
    kind: "wallet" as const,
  };
}

function counterparty(keys: string[], pre: number[], post: number[], self: number, direction: "in" | "out") {
  let best = "";
  let bestDelta = 0;
  for (let index = 0; index < keys.length; index += 1) {
    if (index === self) continue;
    const delta = (post[index] ?? 0) - (pre[index] ?? 0);
    const score = direction === "out" ? delta : -delta;
    if (score > bestDelta) {
      bestDelta = score;
      best = keys[index] ?? "";
    }
  }
  return best;
}

function accountKey(key: string | { pubkey: string }) {
  return typeof key === "string" ? key : key.pubkey;
}

function formatLamports(lamports: number) {
  return formatUnits(BigInt(Math.max(0, Math.round(lamports))), 9);
}

function formatUnits(value: bigint, decimals: number) {
  const scale = decimals > 0 ? BigInt(10) ** BigInt(decimals) : BigInt(1);
  const whole = value / scale;
  const fraction = value % scale;
  if (fraction === BigInt(0) || decimals === 0) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const head = padded.slice(0, 4);
  if (/[1-9]/.test(head)) return `${whole.toString()}.${head.replace(/0+$/, "")}`;
  const start = padded.search(/[1-9]/);
  return `${whole.toString()}.${padded.slice(0, start + 2)}`;
}

async function solPrice(chain: ChainDef) {
  try {
    const response = await fetch(`https://coins.llama.fi/prices/current/${chain.priceId}`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const json = (await response.json()) as { coins?: Record<string, { price?: number }> };
    const price = json.coins?.[chain.priceId]?.price;
    if (typeof price === "number" && price > 0) return price;
  } catch {
    return chain.fallbackPrice;
  }
  return chain.fallbackPrice;
}

async function rpc<T>(chain: ChainDef, method: string, params: unknown[]): Promise<T> {
  const url = rpcUrl(chain);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "wallet-watch" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch (error) {
    const technical = error instanceof Error ? error.message : "RPC request failed";
    throw new ChainError(`We couldn't reach ${chain.name} right now.`, technical);
  }
  const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new ChainError(`We couldn't reach ${chain.name} right now.`, json.error.message);
  if (method === "getBalance") {
    const value = (json.result as { value?: number } | undefined)?.value;
    if (typeof value !== "number") throw new ChainError(`We couldn't reach ${chain.name} right now.`, "Missing balance");
    return value as T;
  }
  return json.result as T;
}
