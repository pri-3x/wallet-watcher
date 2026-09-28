import { isAddress, shortAddress } from "@/lib/address";
import { formatAmount } from "@/lib/format";
import { ETH_USD, KNOWN_PROTOCOLS, partyFor } from "@/lib/parties";
import type { ActivityEvent, ActivityType, Party, WalletView } from "@/lib/types";

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

export class ChainError extends Error {
  readonly technical?: string;

  constructor(message: string, technical?: string) {
    super(message);
    this.name = "ChainError";
    this.technical = technical;
  }
}

const STABLES = new Set(["USDC", "USDT", "DAI", "USDS", "USDE"]);
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

type Network = {
  id: "mainnet" | "sepolia";
  label: string;
  rpc: string | null;
  explorer: string;
  history: string | null;
};

export function activeNetwork(): Network {
  if (process.env.ETHEREUM_NETWORK === "sepolia") {
    return {
      id: "sepolia",
      label: "Sepolia",
      rpc: process.env.ETHEREUM_RPC_URL || SEPOLIA_RPC,
      explorer: "https://sepolia.etherscan.io",
      history: process.env.ETHERSCAN_API_KEY
        ? "https://api-sepolia.etherscan.io/api"
        : "https://eth-sepolia.blockscout.com/api",
    };
  }
  return {
    id: "mainnet",
    label: "Ethereum",
    rpc: process.env.ETHEREUM_RPC_URL || null,
    explorer: "https://etherscan.io",
    history: process.env.ETHERSCAN_API_KEY ? "https://api.etherscan.io/api" : null,
  };
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
    if (usesAlchemy()) return alchemyActivity(address);
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

export function getChainAdapter(chain = "ethereum"): ChainAdapter {
  if (chain !== "ethereum") {
    throw new ChainError("That chain isn't available yet.", chain);
  }
  return ethereum;
}

export function hasChainProvider() {
  const network = activeNetwork();
  return Boolean(network.rpc || network.history);
}

export async function loadLiveWallet(address: string): Promise<WalletView> {
  const network = activeNetwork();
  try {
    const balance = network.rpc
      ? await ethereum.getWalletBalance(address)
      : { address, eth: "—", wei: "0", usd: 0 };
    const countHex = network.rpc
      ? await rpc<string>("eth_getTransactionCount", [address, "latest"])
      : "0x0";
    const events = network.history ? await ethereum.getTransactions(address) : [];
    const ordered = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const txCount = Number(BigInt(countHex));
    const notes = [
      network.id === "sepolia" ? "Testnet" : null,
      network.rpc ? null : "Add an RPC URL to read the live balance.",
      network.history ? null : "Add an Etherscan API key to load transfers.",
    ].filter((note): note is string => Boolean(note));
    return {
      address,
      chain: "ethereum",
      chainLabel: network.label,
      explorer: network.explorer,
      ensName: null,
      source: "live",
      balanceUsd: Math.round(balance.usd),
      balanceEth: balance.eth,
      holdings:
        balance.eth === "—" ? [] : [{ symbol: "ETH", amount: balance.eth, usd: Math.round(balance.usd) }],
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

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const network = activeNetwork();
  const url = network.rpc;
  if (!url) {
    throw new ChainError(`We couldn't reach ${network.label} right now.`, "ETHEREUM_RPC_URL is not set");
  }
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
    throw new ChainError(`We couldn't reach ${network.label} right now.`, technical);
  }
  const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) {
    throw new ChainError(`We couldn't reach ${network.label} right now.`, json.error.message);
  }
  return json.result as T;
}

async function etherscan(address: string, action: string): Promise<RpcTx[]> {
  const network = activeNetwork();
  if (!network.history) return [];
  const url = new URL(network.history);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", action);
  url.searchParams.set("address", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "40");
  url.searchParams.set("sort", "desc");
  if (process.env.ETHERSCAN_API_KEY) url.searchParams.set("apikey", process.env.ETHERSCAN_API_KEY);
  const response = await fetch(url, {
    headers: { "user-agent": "wallet-watch" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ChainError("Transaction history is busy right now.", `${response.status} from the history API`);
  }
  const json = (await response.json()) as { status?: string; message?: string; result?: RpcTx[] | string };
  if (!Array.isArray(json.result)) {
    const technical = typeof json.result === "string" ? json.result : json.message;
    if (technical && /rate limit/i.test(technical)) {
      throw new ChainError("Ethereum is busy right now.", technical);
    }
    return [];
  }
  return json.result;
}

function usesAlchemy() {
  return (activeNetwork().rpc ?? "").includes("alchemy.com");
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

  return events;
}

function fromNative(focus: string, tx: RpcTx, price: number): ActivityEvent {
  const from = tx.from ?? "";
  const to = tx.to ?? "";
  const direction = from.toLowerCase() === focus.toLowerCase() ? "out" : "in";
  const wei = BigInt(tx.value ?? "0");
  const amount = formatWei(wei);
  const usd = Number(amount) * price;
  const known = partyFor(direction === "out" ? to : from);
  const type: ActivityType = wei === BigInt(0) ? "contract" : known?.kind === "protocol" ? "defi" : "transfer";
  const summary =
    type === "contract"
      ? "Called a contract"
      : direction === "out"
        ? `Sent ${formatAmount(amount)} ETH`
        : `Received ${formatAmount(amount)} ETH`;
  return baseEvent(focus, tx, {
    type,
    direction,
    asset: "ETH",
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
  if (STABLES.has(symbol.toUpperCase())) return value;
  if (symbol.toUpperCase() === "ETH" || symbol.toUpperCase() === "WETH") return value * price;
  return 0;
}

async function ethPrice() {
  const override = Number(process.env.ETH_USD);
  if (Number.isFinite(override) && override > 0) return override;
  try {
    const response = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const json = (await response.json()) as { coins?: Record<string, { price?: number }> };
    const price = json.coins?.["coingecko:ethereum"]?.price;
    if (typeof price === "number" && price > 0) return price;
  } catch {
    return ETH_USD;
  }
  return ETH_USD;
}

function formatWei(wei: bigint) {
  return formatUnits(wei, 18);
}

function formatUnits(value: bigint, decimals: number) {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === BigInt(0)) return whole.toString();
  const digits = fraction.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return digits ? `${whole.toString()}.${digits}` : whole.toString();
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
