import { isAddress, isEnsName, isSolanaAddress, isTxHash, shortAddress } from "@/lib/address";
import { CHAINS, defaultChainId, walletHref } from "@/lib/chains/catalog";
import { getStore } from "@/lib/store";
import { loadWalletView } from "@/lib/wallet-service";
import { DEMO_ADDRESS, DEMO_ENS, ENS_BOOK, KNOWN_PROTOCOLS, PARTIES } from "@/lib/parties";
import type { SearchHit } from "@/lib/types";

const TOKENS = ["ETH", "WETH", "USDC", "USDT", "DAI"];

export async function searchAll(query: string, now: number): Promise<SearchHit[]> {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  if (isAddress(raw)) {
    for (const chain of CHAINS.filter((item) => item.family === "evm")) {
      hits.push(walletHit(raw, chain.name, chain.id));
    }
  }
  if (isSolanaAddress(raw)) {
    hits.push(walletHit(raw, "Solana", "solana"));
  }

  for (const [name, address] of Object.entries(ENS_BOOK)) {
    if (name.includes(q) || address.toLowerCase() === q) {
      hits.push({
        kind: "ens",
        title: name,
        subtitle: shortAddress(address),
        href: walletHref(address, "ethereum"),
      });
    }
  }

  for (const token of TOKENS) {
    if (token.toLowerCase().includes(q)) {
      hits.push({
        kind: "token",
        title: token,
        subtitle: "Token",
        href: walletHref(DEMO_ADDRESS, "ethereum", { asset: token }),
      });
    }
  }

  for (const protocol of KNOWN_PROTOCOLS) {
    if (protocol.name.toLowerCase().includes(q) || protocol.slug.includes(q)) {
      const filter = protocol.kind === "dex" ? "swap" : protocol.kind === "nft" ? "nft" : protocol.kind === "lending" ? "defi" : "transfer";
      hits.push({
        kind: "protocol",
        title: protocol.name,
        subtitle: protocol.kind,
        href: walletHref(DEMO_ADDRESS, "ethereum", { filter }),
      });
    }
  }

  const parties = [PARTIES.binance, PARTIES.coinbase, PARTIES.walletA, PARTIES.walletB, PARTIES.walletC];
  for (const party of parties) {
    if (party.label.toLowerCase().includes(q) || party.address.toLowerCase().includes(q)) {
      hits.push(walletHit(party.address, party.label));
    }
  }

  if (q.length >= 3) {
    const store = await getStore();
    const stored = await store.listActivity();
    const demo = await loadWalletView(DEMO_ADDRESS, now);
    const events = [...demo.events, ...stored];
    const seen = new Set<string>();
    for (const event of events) {
      const haystack = `${event.hash} ${event.summary} ${event.asset} ${event.from.label} ${event.to.label}`.toLowerCase();
      if (!haystack.includes(q) && !(isTxHash(q) && event.hash.toLowerCase() === q)) continue;
      if (seen.has(event.hash)) continue;
      seen.add(event.hash);
      const wallet = event.direction === "out" ? event.from.address : event.to.address;
      hits.push({
        kind: "transaction",
        title: event.summary,
        subtitle: shortAddress(event.hash, 8, 6),
        href: walletHref(wallet, event.chain ?? defaultChainId(), { tx: event.hash }),
      });
    }
  }

  if (isEnsName(q) && !hits.some((hit) => hit.kind === "ens")) {
    hits.unshift({
      kind: "ens",
      title: q,
      subtitle: "Resolve name",
      href: walletHref(q, "ethereum"),
    });
  }

  if (hits.length === 0 && q === "vault") {
    hits.push({ kind: "ens", title: DEMO_ENS, subtitle: shortAddress(DEMO_ADDRESS), href: walletHref(DEMO_ADDRESS, "ethereum") });
  }

  const unique = new Map<string, SearchHit>();
  for (const hit of hits) unique.set(`${hit.kind}:${hit.href}:${hit.title}`, hit);
  return [...unique.values()].slice(0, 12);
}

function walletHit(address: string, subtitle: string, chainId = "ethereum"): SearchHit {
  return {
    kind: "wallet",
    title: shortAddress(address),
    subtitle,
    href: walletHref(address, chainId),
  };
}
