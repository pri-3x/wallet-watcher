import { AsyncLocalStorage } from "node:async_hooks";
import { isAddress, shortAddress } from "@/lib/address";
import { defaultChainId, findChain, historyUrl, historyUrls, rpcCandidates, rpcUrl, type ChainDef } from "@/lib/chains/catalog";
import { ChainError } from "@/lib/chains/error";
import { loadSolanaWallet } from "@/lib/chains/solana";
import { formatAmount } from "@/lib/format";
import { KNOWN_PROTOCOLS, partyFor } from "@/lib/parties";
import type { ActivityEvent, ActivityType, Party, WalletView } from "@/lib/types";

export { ChainError };

export type Balance = {
  address: string;
  eth: string;
  wei: string;
  usd: number;
};

export type Block = {
  number: number;
  hash: string;
  timestamp: number;
};

export type TokenTransfer = {
  hash: string;
  from: string;
  to: string;
  tokenAddress: string;
  symbol: string;
  amount: string;
  amountUsd: number;
  timestamp: number;
  blockNumber: number;
};

export interface ChainAdapter {
  id: string;
  name: string;
  getWalletBalance(address: string): Promise<Balance>;
  getTransactions(address: string): Promise<ActivityEvent[]>;
  getTokenTransfers(address: string): Promise<TokenTransfer[]>;
  getBlock(number: number): Promise<Block>;
  subscribeToAddress(address: string): Promise<void>;
}

const STABLES = new Set(["USDC", "USDT", "DAI", "USDS", "USDE"]);

type Network = {
  id: string;
  label: string;
  rpc: string | null;
  explorer: string;
  history: string | null;
  nativeSymbol: string;
  wrappedSymbol: string;
  priceId: string;
  fallbackPrice: number;
  numericId: number;
};

const currentChain = new AsyncLocalStorage<Network>();

function networkFor(chain: ChainDef): Network {
  return {
    id: chain.id,
    label: chain.name,
    rpc: rpcUrl(chain),
    explorer: chain.explorer,
    history: historyUrl(chain),
    nativeSymbol: chain.nativeSymbol,
    wrappedSymbol: chain.wrappedSymbol,
    priceId: chain.priceId,
    fallbackPrice: chain.fallbackPrice,
    numericId: chain.chainId,
  };
}

export function activeNetwork(): Network {
  return currentChain.getStore() ?? networkFor(findChain(defaultChainId())!);
}

function runOnChain<T>(chainId: string, fn: () => Promise<T>) {
  const chain = findChain(chainId);
  if (!chain) return Promise.reject(new ChainError("That chain isn't available.", chainId));
  return currentChain.run(networkFor(chain), fn);
}

type RpcTx = {
  hash?: string;
  from?: string;
  to?: string | null;
  value?: string;
  input?: string;
  blockNumber?: string;
  timeStamp?: string;
  gasUsed?: string;
  gasPrice?: string;
  isError?: string;
  functionName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  tokenID?: string;
  contractAddress?: string;
};

export const ethereum: ChainAdapter = {
  id: "ethereum",
  name: "Ethereum",

  async getWalletBalance(address) {
    assertAddress(address);
    const wei = BigInt(await rpc<string>("eth_getBalance", [address, "latest"]));
    const price = await ethPrice();
    const eth = formatWei(wei);
    return {
      address,
      eth,
      wei: wei.toString(),
      usd: Number(eth) * price,
    };
  },

  async getTransactions(address) {
    assertAddress(address);
    if (await usesAlchemy()) return alchemyActivity(address);
    const [normal, tokens, nfts] = await Promise.all([
      etherscan(address, "txlist"),
      etherscan(address, "tokentx"),
      etherscan(address, "tokennfttx").catch(() => [] as RpcTx[]),
    ]);
    return normalizeActivity(address, normal, tokens, nfts, await ethPrice());
  },

  async getTokenTransfers(address) {
    assertAddress(address);
    const rows = await etherscan(address, "tokentx");
    const price = await ethPrice();
    return rows.map((row) => {
      const decimals = Number(row.tokenDecimal ?? 18);
      const amount = formatUnits(BigInt(row.value ?? "0"), decimals);
      const symbol = row.tokenSymbol ?? "TOKEN";
      return {
        hash: row.hash ?? "",
        from: row.from ?? "",
        to: row.to ?? "",
        tokenAddress: row.contractAddress ?? "",
        symbol,
        amount,
        amountUsd: usdValue(symbol, amount, price),
        timestamp: Number(row.timeStamp ?? 0) * 1000,
        blockNumber: Number(row.blockNumber ?? 0),
      };
    });
  },

  async getBlock(number) {
    const record = await rpc<{ hash?: string; timestamp?: string }>("eth_getBlockByNumber", [
      `0x${number.toString(16)}`,
      false,
    ]);
    if (!record || typeof record !== "object") {
      throw new ChainError("We couldn't read that block.", `Missing block ${number}`);
    }
    return {
      number,
      hash: record.hash ?? "",
      timestamp: Number(BigInt(record.timestamp ?? "0x0")) * 1000,
    };
  },

  async subscribeToAddress(address) {
    assertAddress(address);
    if (!activeNetwork().rpc) return;
    await rpc<string>("eth_getBalance", [address, "latest"]);
  },
};

export function getChainAdapter(chain = defaultChainId()): ChainAdapter {
  const def = findChain(chain);
  if (!def || def.family !== "evm") {
    throw new ChainError("That chain isn't available on this adapter.", chain);
  }
  return {
    id: def.id,
    name: def.name,
    getWalletBalance: (address) => runOnChain(def.id, () => ethereum.getWalletBalance(address)),
    getTransactions: (address) => runOnChain(def.id, () => ethereum.getTransactions(address)),
    getTokenTransfers: (address) => runOnChain(def.id, () => ethereum.getTokenTransfers(address)),
    getBlock: (number) => runOnChain(def.id, () => ethereum.getBlock(number)),
    subscribeToAddress: (address) => runOnChain(def.id, () => ethereum.subscribeToAddress(address)),
  };
}

export function hasChainProvider(chainId = defaultChainId()) {
  const chain = findChain(chainId);
  if (!chain) return false;
  return Boolean(rpcUrl(chain) || historyUrl(chain));
}

export async function loadLiveWallet(address: string, chainId = defaultChainId()): Promise<WalletView> {
  const chain = findChain(chainId);
  if (!chain) throw new ChainError("That chain isn't available.", chainId);
  if (chain.family === "solana") return loadSolanaWallet(address, chain);
  return runOnChain(chain.id, () => loadEvmWallet(address));
}

async function loadEvmWallet(address: string): Promise<WalletView> {
  const network = activeNetwork();
  try {
    const balance = network.rpc
      ? await ethereum.getWalletBalance(address)
      : { address, eth: "—", wei: "0", usd: 0 };
    const countHex = network.rpc
      ? await rpc<string>("eth_getTransactionCount", [address, "latest"])
      : "0x0";
    let events: ActivityEvent[] = [];
    let historyNote: string | null = null;
    if (network.history) {
      try {
        events = await ethereum.getTransactions(address);
      } catch (error) {
        historyNote = error instanceof ChainError ? error.message : "Activity is temporarily unavailable.";
      }
    }
    const ordered = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const txCount = Number(BigInt(countHex));
    const notes = [
      network.id === "sepolia" ? "Testnet" : null,
      network.rpc ? null : "Add an RPC URL to read the live balance.",
      network.history ? historyNote : "Add an Etherscan API key to load transfers.",
    ].filter((note): note is string => Boolean(note));
    return {
      address,
      chain: network.id,
      chainLabel: network.label,
      explorer: network.explorer,
      nativeSymbol: network.nativeSymbol,
      ensName: null,
      source: "live",
      balanceUsd: Math.round(balance.usd),
      balanceEth: balance.eth,
      holdings:
        balance.eth === "—" ? [] : [{ symbol: network.nativeSymbol, amount: balance.eth, usd: Math.round(balance.usd) }],
      txCount: Number.isFinite(txCount) && txCount > 0 ? txCount : ordered.length,
      firstSeen: ordered.at(-1)?.timestamp ?? Date.now(),
      lastActive: ordered[0]?.timestamp ?? Date.now(),
      events: ordered,
      note: notes.length ? notes.join(" ") : null,
      error: null,
    };
  } catch (error) {
    if (error instanceof ChainError) throw error;
    const technical = error instanceof Error ? error.message : "Unknown chain error";
    throw new ChainError(`We couldn't reach ${network.label} right now.`, technical);
  }
}

const verifiedChainIds = new Map<string, number>();

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const network = activeNetwork();
  const chain = findChain(network.id);
  const urls = chain ? rpcCandidates(chain) : network.rpc ? [network.rpc] : [];
  if (urls.length === 0) {
    throw new ChainError(`We couldn't reach ${network.label} right now.`, "ETHEREUM_RPC_URL is not set");
  }
  let last = "RPC request failed";
  for (const url of urls) {
    const reported = await endpointChainId(url);
    // A Sepolia Alchemy URL answers successfully for Ethereum requests and returns the wrong balances.
    if (reported !== network.numericId) {
      last = reported === null ? `No response from ${new URL(url).host}` : `${new URL(url).host} is chain ${reported}`;
      continue;
    }
    try {
      return await postRpc<T>(url, method, params);
    } catch (error) {
      last = error instanceof Error ? error.message : "RPC request failed";
    }
  }
  throw new ChainError(`We couldn't reach ${network.label} right now.`, last);
}

async function endpointChainId(url: string) {
  const cached = verifiedChainIds.get(url);
  if (cached !== undefined) return cached;
  try {
    const hex = await postRpc<string>(url, "eth_chainId", []);
    const id = Number(BigInt(hex));
    verifiedChainIds.set(url, id);
    return id;
  } catch {
    return null;
  }
}

async function postRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
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
    throw new Error(technical);
  }
  const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "RPC request failed");
  return json.result as T;
}

async function etherscan(address: string, action: string): Promise<RpcTx[]> {
  const network = activeNetwork();
  const chain = findChain(network.id);
  const urls = chain ? historyUrls(chain) : [];
  if (urls.length === 0) return [];
  let last = "History request failed";
  for (const history of urls) {
    try {
      const rows = await etherscanAt(history, address, action, network.numericId);
      if (rows) return rows;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new ChainError(`${network.label} activity is busy right now.`, last);
}

async function etherscanAt(history: string, address: string, action: string, chainId: number): Promise<RpcTx[] | null> {
  const url = new URL(history);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", action);
  url.searchParams.set("address", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "40");
  url.searchParams.set("sort", "desc");
  if (url.hostname === "api.etherscan.io") url.searchParams.set("chainid", String(chainId));
  if (process.env.ETHERSCAN_API_KEY) url.searchParams.set("apikey", process.env.ETHERSCAN_API_KEY);
  const response = await fetch(url, {
    headers: { "user-agent": "wallet-watch" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${response.status} from ${url.host}`);
  const json = (await response.json()) as { status?: string; message?: string; result?: RpcTx[] | string };
  if (!Array.isArray(json.result)) {
    const technical = typeof json.result === "string" ? json.result : json.message;
    if (technical && /rate limit|max rate|busy/i.test(technical)) throw new Error(technical);
    return null;
  }
  return json.result;
}

async function usesAlchemy() {
  const url = activeNetwork().rpc ?? "";
  if (!url.includes("alchemy.com")) return false;
  return (await endpointChainId(url)) === activeNetwork().numericId;
}

type AlchemyTransfer = {
  hash?: string;
  from?: string;
  to?: string | null;
  value?: number | null;
  asset?: string | null;
  category?: string;
  blockNum?: string;
  erc721TokenId?: string | null;
  metadata?: { blockTimestamp?: string };
  rawContract?: { value?: string | null; address?: string | null; decimal?: string | null };
};

async function alchemyActivity(address: string) {
  const [outgoing, incoming] = await Promise.all([
    alchemyTransfers({ fromAddress: address }),
    alchemyTransfers({ toAddress: address }),
  ]);
  const seen = new Set<string>();
  const rows = [...outgoing, ...incoming].filter((row) => {
    const key = `${row.hash}:${row.category}:${row.from}:${row.to}:${row.rawContract?.value ?? row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const normal: RpcTx[] = [];
  const tokens: RpcTx[] = [];
  const nfts: RpcTx[] = [];
  for (const row of rows) {
    const tx = toRpcTx(row);
    if (row.category === "erc721" || row.category === "erc1155") nfts.push(tx);
    else if (row.category === "erc20") tokens.push(tx);
    else normal.push(tx);
  }
  return normalizeActivity(address, normal, tokens, nfts, await ethPrice());
}

async function alchemyTransfers(filter: { fromAddress?: string; toAddress?: string }) {
  const result = await rpc<{ transfers?: AlchemyTransfer[] }>("alchemy_getAssetTransfers", [
    {
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["external", "internal", "erc20", "erc721", "erc1155"],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: "0x64",
      order: "desc",
      ...filter,
    },
  ]);
  return result?.transfers ?? [];
}

function toRpcTx(row: AlchemyTransfer): RpcTx {
  const timestamp = row.metadata?.blockTimestamp ? Date.parse(row.metadata.blockTimestamp) : 0;
  const decimals = row.rawContract?.decimal ? Number(BigInt(row.rawContract.decimal)) : 18;
  return {
    hash: row.hash,
    from: row.from,
    to: row.to,
    value: row.rawContract?.value ?? "0x0",
    blockNumber: row.blockNum ? String(Number(BigInt(row.blockNum))) : "0",
    timeStamp: String(Math.floor(timestamp / 1000)),
    tokenSymbol: row.asset ?? undefined,
    tokenDecimal: String(Number.isFinite(decimals) ? decimals : 18),
    tokenID: row.erc721TokenId ?? undefined,
    contractAddress: row.rawContract?.address ?? undefined,
  };
}

function normalizeActivity(
  focus: string,
  normal: RpcTx[],
  tokens: RpcTx[],
  nfts: RpcTx[],
  price: number,
): ActivityEvent[] {
  const tokensByHash = group(tokens);
  const nftsByHash = group(nfts);
  const seen = new Set<string>();
  const events: ActivityEvent[] = [];

  for (const tx of normal) {
    if (!tx.hash || tx.isError === "1") continue;
    seen.add(tx.hash);
    const tokenRows = tokensByHash.get(tx.hash) ?? [];
    const nftRows = nftsByHash.get(tx.hash) ?? [];
    if (tokenRows.length > 0) {
      events.push(...fromTokenRows(focus, tx, tokenRows, price, false));
      continue;
    }
    if (nftRows.length > 0) {
      events.push(...fromTokenRows(focus, tx, nftRows, price, true));
      continue;
    }
    events.push(fromNative(focus, tx, price));
  }

  for (const [hash, rows] of tokensByHash) {
    if (seen.has(hash)) continue;
    const tx = rows[0];
    if (!tx) continue;
    events.push(...fromTokenRows(focus, tx, rows, price, false));
  }

  return uniqueIds(events);
}

// One transaction can carry two identical transfers of the same token between the
// same two parties. Keep both, but give the second one its own id.
function uniqueIds(events: ActivityEvent[]) {
  const counts = new Map<string, number>();
  return events.map((event) => {
    const count = counts.get(event.id) ?? 0;
    counts.set(event.id, count + 1);
    return count === 0 ? event : { ...event, id: `${event.id}:${count}` };
  });
}

function fromNative(focus: string, tx: RpcTx, price: number): ActivityEvent {
  const from = tx.from ?? "";
  const to = tx.to ?? "";
  const direction = from.toLowerCase() === focus.toLowerCase() ? "out" : "in";
  const wei = BigInt(tx.value ?? "0");
    const network = activeNetwork();
  const amount = formatWei(wei);
  const usd = Number(amount) * price;
  const known = partyFor(direction === "out" ? to : from);
  const type: ActivityType = wei === BigInt(0) ? "contract" : known?.kind === "protocol" ? "defi" : "transfer";
  const symbol = network.nativeSymbol;
  const summary =
    type === "contract"
      ? "Called a contract"
      : direction === "out"
        ? `Sent ${formatAmount(amount)} ${symbol}`
        : `Received ${formatAmount(amount)} ${symbol}`;
  return baseEvent(focus, tx, {
    type,
    direction,
    asset: symbol,
    amount,
    amountUsd: Math.round(usd),
    from,
    to,
    summary,
    protocol: known?.kind === "protocol" ? known.label : undefined,
  });
}

function fromTokenRows(focus: string, tx: RpcTx, rows: RpcTx[], price: number, nft: boolean): ActivityEvent[] {
  const outgoing = rows.filter((row) => row.from?.toLowerCase() === focus.toLowerCase());
  const incoming = rows.filter((row) => row.to?.toLowerCase() === focus.toLowerCase());
  const protocol = protocolAt(tx.to ?? rows[0]?.to ?? "");
  if (!nft && outgoing.length > 0 && incoming.length > 0) {
    const sent = outgoing[0];
    const got = incoming[0];
    if (!sent || !got) return [];
    const sentAmount = tokenAmount(sent);
    const gotAmount = tokenAmount(got);
    return [
      baseEvent(focus, tx, {
        type: "swap",
        direction: "out",
        asset: sent.tokenSymbol ?? "TOKEN",
        amount: sentAmount,
        amountUsd: Math.round(usdValue(sent.tokenSymbol ?? "", sentAmount, price) || usdValue(got.tokenSymbol ?? "", gotAmount, price)),
        from: sent.from ?? focus,
        to: tx.to ?? sent.to ?? "",
        counterAsset: got.tokenSymbol,
        counterAmount: gotAmount,
        summary: "Swapped",
        detail: `${formatAmount(sentAmount)} ${sent.tokenSymbol ?? ""} → ${formatAmount(gotAmount)} ${got.tokenSymbol ?? ""}`.trim(),
        protocol: protocol?.name ?? "DEX",
      }),
    ];
  }

  return rows.slice(0, 4).map((row) => {
    const amount = nft ? "1" : tokenAmount(row);
    const symbol = nft ? row.tokenSymbol ?? "NFT" : row.tokenSymbol ?? "TOKEN";
    const direction = row.from?.toLowerCase() === focus.toLowerCase() ? "out" : "in";
    const usd = nft ? 0 : usdValue(symbol, amount, price);
    const kind = nft ? "nft" : protocol?.kind === "lending" ? "defi" : "transfer";
    const summary = nft
      ? direction === "out"
        ? "Sent an NFT"
        : "Received an NFT"
      : direction === "out"
        ? `Sent ${formatAmount(amount)} ${symbol}`
        : `Received ${formatAmount(amount)} ${symbol}`;
    return baseEvent(focus, tx.hash ? tx : row, {
      type: kind,
      direction,
      asset: symbol,
      amount,
      amountUsd: Math.round(usd),
      from: row.from ?? "",
      to: row.to ?? "",
      summary,
      protocol: protocol?.name,
    });
  });
}

function baseEvent(
  focus: string,
  tx: RpcTx,
  fields: {
    type: ActivityType;
    direction: "in" | "out";
    asset: string;
    amount: string;
    amountUsd: number;
    from: string;
    to: string;
    summary: string;
    detail?: string;
    counterAsset?: string;
    counterAmount?: string;
    protocol?: string;
  },
): ActivityEvent {
  const hash = tx.hash ?? "";
  const gasEth = gasToEth(tx.gasUsed, tx.gasPrice);
  return {
    id: `${hash}:${fields.asset}:${fields.from}:${fields.to}`,
    hash,
    timestamp: Number(tx.timeStamp ?? 0) * 1000,
    type: fields.type,
    direction: fields.direction,
    asset: fields.asset,
    amount: fields.amount,
    amountUsd: fields.amountUsd,
    from: asParty(fields.from, focus),
    to: asParty(fields.to, focus),
    counterAsset: fields.counterAsset,
    counterAmount: fields.counterAmount,
    blockNumber: Number(tx.blockNumber ?? 0),
    gasEth,
    protocol: fields.protocol,
    summary: fields.summary,
    detail: fields.detail,
  };
}

function asParty(address: string, focus: string): Party {
  if (address.toLowerCase() === focus.toLowerCase()) {
    return { address, label: shortAddress(address), kind: "wallet" };
  }
  return (
    partyFor(address) ?? {
      address,
      label: shortAddress(address || "Contract"),
      kind: address ? "wallet" : "contract",
    }
  );
}

function protocolAt(address: string) {
  return KNOWN_PROTOCOLS.find((protocol) =>
    protocol.addresses.some((item) => item.toLowerCase() === address.toLowerCase()),
  );
}

function group(rows: RpcTx[]) {
  const map = new Map<string, RpcTx[]>();
  for (const row of rows) {
    if (!row.hash) continue;
    const list = map.get(row.hash) ?? [];
    list.push(row);
    map.set(row.hash, list);
  }
  return map;
}

function tokenAmount(row: RpcTx) {
  return formatUnits(BigInt(row.value ?? "0"), Number(row.tokenDecimal ?? 18));
}

function usdValue(symbol: string, amount: string, price: number) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  const upper = symbol.toUpperCase();
  if (STABLES.has(upper)) return value;
  const network = activeNetwork();
  if (upper === network.nativeSymbol || upper === network.wrappedSymbol) return value * price;
  return 0;
}

const priceCache = new Map<string, { at: number; price: number }>();

async function ethPrice() {
  const network = activeNetwork();
  const cached = priceCache.get(network.priceId);
  if (cached && Date.now() - cached.at < 60_000) return cached.price;
  const override = network.nativeSymbol === "ETH" ? Number(process.env.ETH_USD) : Number.NaN;
  if (Number.isFinite(override) && override > 0) return override;
  let price = network.fallbackPrice;
  try {
    const response = await fetch(`https://coins.llama.fi/prices/current/${network.priceId}`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const json = (await response.json()) as { coins?: Record<string, { price?: number }> };
    const live = json.coins?.[network.priceId]?.price;
    if (typeof live === "number" && live > 0) price = live;
  } catch {
    price = network.fallbackPrice;
  }
  priceCache.set(network.priceId, { at: Date.now(), price });
  return price;
}

function formatWei(wei: bigint) {
  return formatUnits(wei, 18);
}

function formatUnits(value: bigint, decimals: number) {
  const base = decimals > 0 ? BigInt(10) ** BigInt(decimals) : BigInt(1);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === BigInt(0) || decimals === 0) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const head = padded.slice(0, 4);
  if (/[1-9]/.test(head)) return `${whole.toString()}.${head.replace(/0+$/, "")}`;
  const start = padded.search(/[1-9]/);
  return `${whole.toString()}.${padded.slice(0, start + 2)}`;
}

function gasToEth(gasUsed?: string, gasPrice?: string) {
  if (!gasUsed || !gasPrice) return "0";
  try {
    const wei = BigInt(gasUsed) * BigInt(gasPrice);
    return formatWei(wei);
  } catch {
    return "0";
  }
}

function assertAddress(address: string) {
  if (!isAddress(address)) {
    throw new ChainError("That address doesn't look right.");
  }
}
