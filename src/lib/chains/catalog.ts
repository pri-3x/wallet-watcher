import { isAddress, isSolanaAddress } from "@/lib/address";

export type ChainFamily = "evm" | "solana";

export type ChainDef = {
  id: string;
  name: string;
  family: ChainFamily;
  /** EVM chain id. Solana stores 101 because the column is numeric. */
  chainId: number;
  nativeSymbol: string;
  wrappedSymbol: string;
  explorer: string;
  defaultRpc: string;
  /** Etherscan-compatible history. Unused for Solana. */
  history: string;
  /** Tried when the primary RPC or history API fails. */
  fallbackRpcs?: string[];
  historyFallbacks?: string[];
  priceId: string;
  fallbackPrice: number;
  rpcEnv?: string;
  /** ENS names resolve on this chain. */
  ens?: boolean;
};

export const CHAINS: ChainDef[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    family: "evm",
    chainId: 1,
    nativeSymbol: "ETH",
    wrappedSymbol: "WETH",
    explorer: "https://etherscan.io",
    defaultRpc: "https://ethereum-rpc.publicnode.com",
    fallbackRpcs: ["https://eth.drpc.org"],
    history: "https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api",
    historyFallbacks: ["https://eth.blockscout.com/api"],
    priceId: "coingecko:ethereum",
    fallbackPrice: 3296,
    ens: true,
  },
  {
    id: "sepolia",
    name: "Sepolia",
    family: "evm",
    chainId: 11155111,
    nativeSymbol: "ETH",
    wrappedSymbol: "WETH",
    explorer: "https://sepolia.etherscan.io",
    defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com",
    history: "https://api.routescan.io/v2/network/testnet/evm/11155111/etherscan/api",
    historyFallbacks: ["https://eth-sepolia.blockscout.com/api"],
    priceId: "coingecko:ethereum",
    fallbackPrice: 3296,
    ens: true,
  },
  {
    id: "polygon",
    name: "Polygon",
    family: "evm",
    chainId: 137,
    nativeSymbol: "POL",
    wrappedSymbol: "WPOL",
    explorer: "https://polygonscan.com",
    defaultRpc: "https://polygon-bor-rpc.publicnode.com",
    history: "https://polygon.blockscout.com/api",
    priceId: "coingecko:polygon-ecosystem-token",
    fallbackPrice: 0.4,
    rpcEnv: "POLYGON_RPC_URL",
  },
  {
    id: "base",
    name: "Base",
    family: "evm",
    chainId: 8453,
    nativeSymbol: "ETH",
    wrappedSymbol: "WETH",
    explorer: "https://basescan.org",
    defaultRpc: "https://base-rpc.publicnode.com",
    history: "https://base.blockscout.com/api",
    priceId: "coingecko:ethereum",
    fallbackPrice: 3296,
    rpcEnv: "BASE_RPC_URL",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    family: "evm",
    chainId: 42161,
    nativeSymbol: "ETH",
    wrappedSymbol: "WETH",
    explorer: "https://arbiscan.io",
    defaultRpc: "https://arbitrum-one-rpc.publicnode.com",
    history: "https://arbitrum.blockscout.com/api",
    priceId: "coingecko:ethereum",
    fallbackPrice: 3296,
    rpcEnv: "ARBITRUM_RPC_URL",
  },
  {
    id: "solana",
    name: "Solana",
    family: "solana",
    chainId: 101,
    nativeSymbol: "SOL",
    wrappedSymbol: "WSOL",
    explorer: "https://solscan.io",
    defaultRpc: "https://solana-rpc.publicnode.com",
    history: "",
    priceId: "coingecko:solana",
    fallbackPrice: 150,
    rpcEnv: "SOLANA_RPC_URL",
  },
];

const NATIVE_ASSETS = new Set(["ETH", "WETH", "POL", "WPOL", "MATIC", "WMATIC", "SOL", "WSOL"]);

export function isNativeAsset(symbol: string) {
  return NATIVE_ASSETS.has(symbol.toUpperCase());
}

export function addressOk(chainId: string, value: string) {
  const chain = findChain(chainId);
  if (!chain) return false;
  return chain.family === "solana" ? isSolanaAddress(value) : isAddress(value);
}

export function findChain(id: string | null | undefined): ChainDef | null {
  if (!id) return null;
  return CHAINS.find((chain) => chain.id === id) ?? null;
}

/** The chain used when a request does not name one. Sepolia when ETHEREUM_NETWORK=sepolia. */
export function defaultChainId() {
  return process.env.ETHEREUM_NETWORK === "sepolia" ? "sepolia" : "ethereum";
}

export function rpcUrl(chain: ChainDef) {
  const specific = chain.rpcEnv ? process.env[chain.rpcEnv]?.trim() : "";
  if (specific) return specific;
  if (chain.id === "ethereum" || chain.id === "sepolia") {
    const selected = process.env.ETHEREUM_NETWORK === "sepolia" ? "sepolia" : "ethereum";
    const shared = process.env.ETHEREUM_RPC_URL?.trim();
    if (shared && chain.id === selected) return shared;
  }
  return chain.defaultRpc;
}

/** Etherscan v2 when a key is set. Otherwise a public explorer API. Solana has no EVM history API. */
export function historyUrl(chain: ChainDef) {
  const urls = historyUrls(chain);
  return urls[0] ?? null;
}

export function historyUrls(chain: ChainDef) {
  if (chain.family !== "evm") return [];
  const urls: string[] = [];
  if (process.env.ETHERSCAN_API_KEY?.trim()) urls.push("https://api.etherscan.io/v2/api");
  if (chain.history) urls.push(chain.history);
  for (const extra of chain.historyFallbacks ?? []) urls.push(extra);
  return [...new Set(urls)];
}

/** Primary RPC, then the public default, then backups. A Sepolia Alchemy URL stays on Sepolia. */
export function rpcCandidates(chain: ChainDef) {
  return [...new Set([rpcUrl(chain), chain.defaultRpc, ...(chain.fallbackRpcs ?? [])].filter((url) => url.length > 0))];
}

export function addressUrl(chainId: string, address: string) {
  const chain = findChain(chainId);
  if (!chain) return address;
  const segment = chain.family === "solana" ? "account" : "address";
  return `${chain.explorer}/${segment}/${address}`;
}

export function txUrl(chainId: string, hash: string) {
  const chain = findChain(chainId);
  if (!chain) return hash;
  return `${chain.explorer}/tx/${hash}`;
}

const BLOCKSCOUT: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  sepolia: "https://eth-sepolia.blockscout.com",
  polygon: "https://polygon.blockscout.com",
  base: "https://base.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
};

export function blockscoutOrigin(chainId: string) {
  return BLOCKSCOUT[chainId] ?? null;
}

export function tokenHref(address: string, chainId: string) {
  const params = new URLSearchParams({ chain: chainId });
  return `/token/${encodeURIComponent(address)}?${params.toString()}`;
}

export function walletHref(address: string, chainId: string, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  params.set("chain", chainId);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  return `/wallet/${encodeURIComponent(address)}?${params.toString()}`;
}
