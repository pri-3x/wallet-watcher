import type { Party } from "@/lib/types";

export const DEMO_ADDRESS = "0x7A91c4E8b2D15F6a903C81E4d7B291F0a8c3e91F";
export const DEMO_ENS = "vault.eth";
export const DEMO_EMAIL = "demo@walletwatch.dev";

export const ETH_USD = 3296;

export const PARTIES = {
  binance: {
    address: "0x4f2A91c0b87E55d3a1C6e9048B17d2F6a0C91E33",
    label: "Binance",
    kind: "exchange",
  },
  coinbase: {
    address: "0x8C21dE44a0b91F77c3A55e12d04B88a91C0dE771",
    label: "Coinbase",
    kind: "exchange",
  },
  uniswap: {
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    label: "Uniswap",
    kind: "protocol",
  },
  aave: {
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    label: "Aave",
    kind: "protocol",
  },
  seaport: {
    address: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC",
    label: "Seaport",
    kind: "protocol",
  },
  walletA: {
    address: "0x82ABc4E19d7F12a903C81E44d7B291F0a8c3eD91",
    label: "0x82AB…eD91",
    kind: "wallet",
  },
  walletB: {
    address: "0x19c3A01e88d24F6b70a91C55e12d04B88a01C0dE",
    label: "0x19c3…C0dE",
    kind: "wallet",
  },
  walletC: {
    address: "0x91C0a55e12d04B88a01C0dE19c3A01e88d24F6b7",
    label: "0x91C0…F6b7",
    kind: "wallet",
  },
  unknown: {
    address: "0x5a91C0dE44a0b91F77c3A55e12d04B88a91C0771",
    label: "Contract",
    kind: "contract",
  },
} as const satisfies Record<string, Party>;

export const ENS_BOOK: Record<string, string> = {
  [DEMO_ENS]: DEMO_ADDRESS,
  "binance.eth": PARTIES.binance.address,
  "ops.eth": PARTIES.walletA.address,
};

export const KNOWN_PROTOCOLS: Array<{
  slug: string;
  name: string;
  kind: "dex" | "lending" | "nft" | "exchange";
  addresses: string[];
}> = [
  { slug: "uniswap", name: "Uniswap", kind: "dex", addresses: [PARTIES.uniswap.address] },
  { slug: "aave", name: "Aave", kind: "lending", addresses: [PARTIES.aave.address] },
  { slug: "seaport", name: "Seaport", kind: "nft", addresses: [PARTIES.seaport.address] },
  { slug: "binance", name: "Binance", kind: "exchange", addresses: [PARTIES.binance.address] },
  { slug: "coinbase", name: "Coinbase", kind: "exchange", addresses: [PARTIES.coinbase.address] },
];

const CANONICAL = [
  DEMO_ADDRESS,
  ...Object.values(PARTIES).map((party) => party.address),
];

export function canonicalAddress(address: string) {
  const found = CANONICAL.find((item) => item.toLowerCase() === address.toLowerCase());
  return found ?? address;
}

export function partyFor(address: string): Party | null {
  const found = Object.values(PARTIES).find(
    (party) => party.address.toLowerCase() === address.toLowerCase(),
  );
  return found ?? null;
}
