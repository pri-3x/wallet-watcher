import { cache } from "react";
import { isAddress, isEnsName } from "@/lib/address";
import { activeNetwork, ChainError, hasChainProvider, loadLiveWallet } from "@/lib/chains/ethereum";
import { buildDemoView } from "@/lib/demo/dataset";
import { canonicalAddress, DEMO_ADDRESS, ENS_BOOK } from "@/lib/parties";
import type { WalletView } from "@/lib/types";

async function loadWalletView(raw: string, now: number): Promise<WalletView> {
  const input = decodeURIComponent(raw).trim();
  if (isEnsName(input)) {
    const resolved = await resolveEns(input);
    if (!resolved) {
      return blank(input, {
        title: "We couldn't resolve that name.",
        body: "Check the spelling, or paste the 0x address.",
      });
    }
    return loadAddress(resolved, now, input);
  }
  if (!isAddress(input)) {
    return blank(input, {
      title: "That address doesn't look right.",
      body: "Ethereum addresses are 42 characters and start with 0x.",
    });
  }
  return loadAddress(canonicalAddress(input), now);
}

export const getWalletView = cache(loadWalletView);
export { loadWalletView };

export async function openWallet(raw: string) {
  const now = Date.now();
  const view = await getWalletView(raw, now);
  return { view, now };
}

async function loadAddress(address: string, now: number, ensName?: string): Promise<WalletView> {
  if (address.toLowerCase() === DEMO_ADDRESS.toLowerCase() || !hasChainProvider()) {
    const view = buildDemoView(address, now);
    return ensName ? { ...view, ensName } : view;
  }
  try {
    const view = await loadLiveWallet(address);
    return ensName ? { ...view, ensName } : view;
  } catch (error) {
    const technical = error instanceof ChainError ? error.technical : error instanceof Error ? error.message : undefined;
    return blank(address, {
      title: `We couldn't reach ${activeNetwork().label} right now.`,
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

function blank(address: string, error: NonNullable<WalletView["error"]>): WalletView {
  const now = Date.now();
  return {
    address,
    chain: "ethereum",
    chainLabel: activeNetwork().label,
    explorer: activeNetwork().explorer,
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
