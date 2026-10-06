import { createHash } from "crypto";
import { shortAddress } from "@/lib/address";
import { canonicalAddress, DEMO_ADDRESS, DEMO_ENS, ETH_USD, PARTIES, partyFor } from "@/lib/parties";
import type { ActivityEvent, ActivityType, Direction, Party, WalletView } from "@/lib/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TIP = 23_481_920;

type Spec = {
  seed: string;
  age: number;
  days?: number;
  hour?: number;
  minute?: number;
  type: ActivityType;
  direction: Direction;
  asset: string;
  amount: string;
  amountUsd: number;
  counterparty: Party;
  counterAsset?: string;
  counterAmount?: string;
  gasEth: string;
  protocol?: string;
  summary: string;
  detail?: string;
};

export function buildDemoView(addressInput: string, now: number): WalletView {
  const address = canonicalAddress(addressInput);
  if (address.toLowerCase() === DEMO_ADDRESS.toLowerCase()) {
    return curated(now);
  }
  return generated(address, now);
}

function curated(now: number): WalletView {
  const self = selfParty(DEMO_ADDRESS);
  const specs: Spec[] = [
    spec("sent-usdc", 2 * MINUTE, "transfer", "out", "USDC", "12400", 12400, PARTIES.walletA, "0.00041", "Sent 12,400 USDC"),
    spec("swap-eth", 18 * MINUTE, "swap", "out", "ETH", "4.2", 13842, PARTIES.uniswap, "0.00184", "Swapped", "4.2 ETH → 13,842 USDC", "USDC", "13842", "Uniswap"),
    spec("binance-in", 46 * MINUTE, "transfer", "in", "USDC", "42800", 42800, PARTIES.binance, "0.00028", "Received 42,800 USDC", "Binance"),
    spec("eth-out", 3.5 * HOUR, "transfer", "out", "ETH", "1.8", 5933, PARTIES.walletB, "0.00022", "Sent 1.8 ETH"),
    spec("aave-supply", 8 * HOUR, "defi", "out", "USDC", "22000", 22000, PARTIES.aave, "0.0021", "Supplied 22,000 USDC", "Aave", undefined, undefined, "Aave"),
    spec("coinbase-eth", 14 * HOUR, "transfer", "in", "ETH", "2.1", 6922, PARTIES.coinbase, "0.00019", "Received 2.1 ETH", "Coinbase"),
    spec("nft-out", 22 * HOUR, "nft", "out", "ETH", "1.1", 3626, PARTIES.seaport, "0.0014", "NFT purchase", "Seaport", undefined, undefined, "Seaport"),
    at("usdc-c", 2, 10, 12, "transfer", "out", "USDC", "18400", 18400, PARTIES.walletC, "0.00033", "Sent 18,400 USDC"),
    at("swap-mid", 3, 11, 40, "swap", "out", "ETH", "2.4", 7909, PARTIES.uniswap, "0.0016", "Swapped", "2.4 ETH → 7,840 USDC", "USDC", "7840", "Uniswap"),
    at("large-out", 4, 9, 20, "transfer", "out", "USDC", "284120", 284120, PARTIES.binance, "0.00052", "Sent 284,120 USDC", "Binance"),
    at("return-in", 5, 12, 5, "transfer", "in", "USDC", "9100", 9100, PARTIES.walletB, "0.00021", "Received 9,100 USDC"),
    at("aave-repay", 6, 10, 48, "defi", "out", "USDC", "15000", 15000, PARTIES.aave, "0.0019", "Repaid 15,000 USDC", "Aave", undefined, undefined, "Aave"),
    at("coinbase-usdc", 9, 11, 15, "transfer", "in", "USDC", "54000", 54000, PARTIES.coinbase, "0.00024", "Received 54,000 USDC", "Coinbase"),
    at("swap-small", 12, 13, 2, "swap", "out", "USDC", "3200", 3200, PARTIES.uniswap, "0.0011", "Swapped", "3,200 USDC → 0.96 ETH", "ETH", "0.96", "Uniswap"),
    at("new-contract", 15, 9, 40, "contract", "out", "ETH", "0", 0, PARTIES.unknown, "0.00088", "Called a contract"),
    at("eth-dust", 18, 10, 10, "transfer", "in", "ETH", "0.4", 1318, PARTIES.walletA, "0.00018", "Received 0.4 ETH"),
    at("usdc-back", 22, 12, 30, "transfer", "out", "USDC", "6400", 6400, PARTIES.walletA, "0.00026", "Sent 6,400 USDC"),
    at("nft-in", 28, 11, 5, "nft", "in", "ETH", "0", 0, PARTIES.seaport, "0.0012", "Received an NFT", "Seaport"),
    at("night", 7, 2, 14, "transfer", "out", "USDC", "800", 800, PARTIES.walletC, "0.0002", "Sent 800 USDC"),
    at("binance-small", 11, 18, 40, "transfer", "in", "USDC", "2100", 2100, PARTIES.binance, "0.00023", "Received 2,100 USDC", "Binance"),
  ];

  const events = specs
    .map((item) => toEvent(item, self, now))
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    address: DEMO_ADDRESS,
    chain: "ethereum",
    chainLabel: "Ethereum",
    explorer: "https://etherscan.io",
    nativeSymbol: "ETH",
    ensName: DEMO_ENS,
    source: "demo",
    balanceUsd: 84291,
    balanceEth: "8.42",
    holdings: [
      { symbol: "ETH", amount: "8.42", usd: 27752 },
      { symbol: "USDC", amount: "56,539", usd: 56539 },
    ],
    txCount: 18492,
    firstSeen: Date.UTC(2024, 7, 12),
    lastActive: events[0]?.timestamp ?? now,
    events,
    note: "Demo data",
    error: null,
  };
}

function generated(address: string, now: number): WalletView {
  const seed = hashCode(address.toLowerCase());
  const self = selfParty(address);
  const book = Object.values(PARTIES);
  const events: ActivityEvent[] = [];
  const count = 8 + (seed % 5);

  for (let index = 0; index < count; index += 1) {
    const roll = hashCode(`${address}:${index}`);
    const counterparty = book[roll % book.length] ?? PARTIES.walletA;
    const typeRoll = roll % 7;
    const type: ActivityType =
      typeRoll === 0 ? "swap" : typeRoll === 1 ? "defi" : typeRoll === 2 ? "nft" : typeRoll === 3 ? "contract" : "transfer";
    const direction: Direction = roll % 2 === 0 ? "out" : "in";
    const asset = type === "swap" || roll % 3 === 0 ? "ETH" : "USDC";
    const usd = 400 + (roll % 48000);
    const amount = asset === "ETH" ? (usd / ETH_USD).toFixed(2) : String(usd);
    const age = (index + 1) * (3 + (roll % 20)) * HOUR;
    const summary =
      type === "swap"
        ? "Swapped"
        : type === "defi"
          ? direction === "out"
            ? `Supplied ${amount} ${asset}`
            : `Withdrew ${amount} ${asset}`
          : type === "nft"
            ? "NFT transfer"
            : type === "contract"
              ? "Called a contract"
              : direction === "out"
                ? `Sent ${amount} ${asset}`
                : `Received ${amount} ${asset}`;

    events.push({
      id: txHash(`gen:${address}:${index}`),
      hash: txHash(`gen:${address}:${index}`),
      timestamp: now - age,
      type,
      direction,
      asset,
      amount,
      amountUsd: type === "contract" || type === "nft" ? Math.round(usd / 8) : usd,
      from: direction === "out" ? self : counterparty,
      to: direction === "out" ? counterparty : self,
      blockNumber: TIP - Math.round(age / 12_000),
      gasEth: (0.0002 + (roll % 20) / 10000).toFixed(5),
      protocol: counterparty.kind === "protocol" ? counterparty.label : undefined,
      summary,
      detail: counterparty.kind === "wallet" ? undefined : counterparty.label,
    });
  }

  events.sort((a, b) => b.timestamp - a.timestamp);
  const balance = 12000 + (seed % 140000);

  return {
    address,
    chain: "ethereum",
    chainLabel: "Ethereum",
    explorer: "https://etherscan.io",
    nativeSymbol: "ETH",
    ensName: null,
    source: "demo",
    balanceUsd: balance,
    balanceEth: (balance / ETH_USD / 3).toFixed(2),
    holdings: [
      { symbol: "ETH", amount: (balance / ETH_USD / 3).toFixed(2), usd: Math.round(balance / 3) },
      { symbol: "USDC", amount: Math.round((balance * 2) / 3).toLocaleString("en-US"), usd: Math.round((balance * 2) / 3) },
    ],
    txCount: 80 + (seed % 9000),
    firstSeen: now - (40 + (seed % 400)) * DAY,
    lastActive: events[0]?.timestamp ?? now,
    events,
    note: "Demo data. Connect an Ethereum provider to read this wallet from the chain.",
    error: null,
  };
}

function spec(
  seed: string,
  age: number,
  type: ActivityType,
  direction: Direction,
  asset: string,
  amount: string,
  amountUsd: number,
  counterparty: Party,
  gasEth: string,
  summary: string,
  detail?: string,
  counterAsset?: string,
  counterAmount?: string,
  protocol?: string,
): Spec {
  return { seed, age, type, direction, asset, amount, amountUsd, counterparty, gasEth, summary, detail, counterAsset, counterAmount, protocol };
}

function at(
  seed: string,
  days: number,
  hour: number,
  minute: number,
  type: ActivityType,
  direction: Direction,
  asset: string,
  amount: string,
  amountUsd: number,
  counterparty: Party,
  gasEth: string,
  summary: string,
  detail?: string,
  counterAsset?: string,
  counterAmount?: string,
  protocol?: string,
): Spec {
  return {
    seed,
    age: 0,
    days,
    hour,
    minute,
    type,
    direction,
    asset,
    amount,
    amountUsd,
    counterparty,
    gasEth,
    summary,
    detail,
    counterAsset,
    counterAmount,
    protocol,
  };
}

function toEvent(item: Spec, self: Party, now: number): ActivityEvent {
  const timestamp =
    item.hour == null ? now - item.age : utcDaysAgo(now, item.days ?? 1, item.hour, item.minute ?? 0);
  const hash = txHash(`curated:${item.seed}`);
  return {
    id: hash,
    hash,
    timestamp,
    type: item.type,
    direction: item.direction,
    asset: item.asset,
    amount: item.amount,
    amountUsd: item.amountUsd,
    from: item.direction === "out" ? self : item.counterparty,
    to: item.direction === "out" ? item.counterparty : self,
    counterAsset: item.counterAsset,
    counterAmount: item.counterAmount,
    blockNumber: TIP - Math.max(1, Math.round((now - timestamp) / 12_000)),
    gasEth: item.gasEth,
    protocol: item.protocol,
    summary: item.summary,
    detail: item.detail,
  };
}

function utcDaysAgo(now: number, days: number, hour: number, minute: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 12, 0);
  return date.getTime();
}

function selfParty(address: string): Party {
  return partyFor(address) ?? { address, label: shortAddress(address), kind: "wallet" };
}

function txHash(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

function hashCode(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
