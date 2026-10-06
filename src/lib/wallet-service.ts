import { cache } from "react";
import { isAddress, isEnsName } from "@/lib/address";
import { addressOk, defaultChainId, findChain, type ChainDef } from "@/lib/chains/catalog";
import { ChainError, hasChainProvider, loadLiveWallet } from "@/lib/chains/ethereum";
import { buildDemoView } from "@/lib/demo/dataset";
import { canonicalAddress, DEMO_ADDRESS, ENS_BOOK } from "@/lib/parties";
import type { WalletView } from "@/lib/types";

async function loadWalletView(raw: string, now: number, chainInput?: string): Promise<WalletView> {
  const chain = chainInput ? findChain(chainInput) : findChain(defaultChainId());
  const input = decodeURIComponent(raw).trim();
  if (!chain) {
    return blank(input, null, {
      title: "That chain isn't available.",
      body: "Choose Ethereum, Sepolia, Polygon, Base, Arbitrum, or Solana.",
    });
  }
  if (chain.ens && isEnsName(input)) {
    const resolved = await resolveEns(input);
    if (!resolved) {
      return blank(input, chain, {
        title: "We couldn't resolve that name.",
        body: "Check the spelling, or paste the 0x address.",
      });
    }
    return loadAddress(resolved, chain, now, input);
  }
  if (!addressOk(chain.id, input)) {
    return blank(input, chain, {
      title: "That address doesn't look right.",
      body:
        chain.family === "solana"
          ? "Solana addresses are 32–44 characters."
          : "EVM addresses are 42 characters and start with 0x.",
    });
  }
  const address = chain.family === "evm" ? canonicalAddress(input) : input;
  return loadAddress(address, chain, now);
}

export const getWalletView = cache(loadWalletView);
export { loadWalletView };

export async function openWallet(raw: string, chainId?: string) {
  const now = Date.now();
  const view = await getWalletView(raw, now, chainId);
  return { view, now };
}

async function loadAddress(address: string, chain: ChainDef, now: number, ensName?: string): Promise<WalletView> {
  if (chain.id === "ethereum" && address.toLowerCase() === DEMO_ADDRESS.toLowerCase()) {
    const view = buildDemoView(address, now);
    return ensName ? { ...view, ensName } : view;
  }
  if (!hasChainProvider(chain.id)) {
    const view = buildDemoView(address, now);
    return ensName ? { ...view, ensName, chain: chain.id, chainLabel: chain.name } : { ...view, chain: chain.id, chainLabel: chain.name };
  }
  try {
    const view = await loadLiveWallet(address, chain.id);
    return ensName ? { ...view, ensName } : view;
  } catch (error) {
    const technical = error instanceof ChainError ? error.technical : error instanceof Error ? error.message : undefined;
    return blank(address, chain, {
      title: `We couldn't reach ${chain.name} right now.`,
      body: "Try again in a moment.",
      technical,
    });
  }
}

async function resolveEns(name: string) {
  const local = ENS_BOOK[name.toLowerCase()];
  if (local) return local;
  if (process.env.ENABLE_ENS !== "true") return null;
  try {
    const response = await fetch(`https://api.ensdata.net/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { address?: string };
    if (json.address && isAddress(json.address)) return canonicalAddress(json.address);
  } catch {
    return null;
  }
  return null;
}

function blank(address: string, chain: ChainDef | null, error: NonNullable<WalletView["error"]>): WalletView {
  const resolved = chain ?? findChain(defaultChainId()) ?? findChain("ethereum")!;
  const now = Date.now();
  return {
    address,
    chain: resolved.id,
    chainLabel: resolved.name,
    explorer: resolved.explorer,
    nativeSymbol: resolved.nativeSymbol,
    source: "demo",
    balanceUsd: 0,
    balanceEth: "0",
    holdings: [],
    txCount: 0,
    firstSeen: now,
    lastActive: now,
    events: [],
    error,
  };
}
