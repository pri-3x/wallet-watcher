import { readFile } from "fs/promises";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_COOLDOWN_MS } from "../src/lib/alerts/quiet";

process.loadEnvFile?.(".env");

type FileUser = { id: string; email: string; plan: string; createdAt: number };
type FileWatch = {
  id: string;
  userId: string;
  address: string;
  createdAt: number;
  cursor?: number;
  cooldownMs?: number;
  lastNotifiedAt?: number;
};
type FileAlert = {
  id: string;
  watchId: string;
  eventType: string;
  asset?: string | null;
  threshold?: number | null;
  direction?: string | null;
  enabled?: boolean;
};
type FileChannel = { id: string; watchId: string; type: string; target: string };
type FileEvent = {
  id: string;
  alertId: string;
  hash: string;
  summary: string;
  detail: string;
  amountUsd: number;
  timestamp: number;
};
type FileNote = {
  id: string;
  userId: string;
  alertEventId?: string;
  channel: string;
  target: string;
  status: string;
  payload: string;
  error?: string;
  attempts?: number;
  nextAttemptAt?: number;
  createdAt: number;
};
type FileDb = {
  users: FileUser[];
  watches: FileWatch[];
  alerts: FileAlert[];
  channels: FileChannel[];
  alertEvents: FileEvent[];
  notifications: FileNote[];
};

function chainRecord() {
  if (process.env.ETHEREUM_NETWORK === "sepolia") {
    return { id: "sepolia", name: "Sepolia", chainId: 11155111, nativeSymbol: "ETH" };
  }
  return { id: "ethereum", name: "Ethereum", chainId: 1, nativeSymbol: "ETH" };
}

function at(value?: number) {
  return value ? new Date(value) : null;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log(`Database already has ${existing} users. Leaving it as it is.`);
      return;
    }

    const db = JSON.parse(await readFile("data/store.json", "utf8")) as FileDb;
    const chain = chainRecord();

    await prisma.$transaction(
      async (tx) => {
        await tx.chain.create({ data: chain });
        await tx.user.createMany({
          data: db.users.map((user) => ({
            id: user.id,
            email: user.email.toLowerCase(),
            plan: user.plan,
            createdAt: new Date(user.createdAt),
          })),
        });

        const addresses = [...new Set(db.watches.map((watch) => watch.address))];
        await tx.wallet.createMany({
          data: addresses.map((address) => ({ chainId: chain.id, address })),
        });
        const wallets = await tx.wallet.findMany({ where: { chainId: chain.id } });
        const walletId = new Map(wallets.map((wallet) => [wallet.address.toLowerCase(), wallet.id]));

        await tx.walletWatch.createMany({
          data: db.watches.map((watch) => {
            const id = walletId.get(watch.address.toLowerCase());
            if (!id) throw new Error(`No wallet row for ${watch.address}`);
            return {
              id: watch.id,
              userId: watch.userId,
              walletId: id,
              cursor: at(watch.cursor),
              cooldownMs: watch.cooldownMs ?? DEFAULT_COOLDOWN_MS,
              lastNotifiedAt: at(watch.lastNotifiedAt),
              createdAt: new Date(watch.createdAt),
            };
          }),
        });

        await tx.alert.createMany({
          data: db.alerts.map((alert) => ({
            id: alert.id,
            watchId: alert.watchId,
            eventType: alert.eventType,
            asset: alert.asset ?? null,
            threshold: alert.threshold ?? null,
            direction: alert.direction ?? "ANY",
            enabled: alert.enabled ?? true,
          })),
        });
        await tx.notificationChannel.createMany({
          data: db.channels.map((channel) => ({
            id: channel.id,
            watchId: channel.watchId,
            type: channel.type,
            target: channel.target,
          })),
        });
        await tx.alertEvent.createMany({
          data: db.alertEvents.map((event) => ({
            id: event.id,
            alertId: event.alertId,
            transactionHash: event.hash,
            summary: event.summary,
            detail: event.detail,
            amountUsd: event.amountUsd,
            timestamp: new Date(event.timestamp),
          })),
        });
        await tx.notification.createMany({
          data: db.notifications.map((note) => ({
            id: note.id,
            userId: note.userId,
            alertEventId: note.alertEventId,
            channel: note.channel,
            target: note.target,
            status: note.status,
            payload: note.payload,
            error: note.error,
            attempts: note.attempts ?? 0,
            nextAttemptAt: at(note.nextAttemptAt),
            createdAt: new Date(note.createdAt),
            sentAt: note.status === "delivered" || note.status === "logged" ? new Date(note.createdAt) : null,
          })),
        });
      },
      { timeout: 60_000 },
    );

    console.log(
      `Imported ${db.users.length} users, ${db.watches.length} watches, ${db.alertEvents.length} alerts, ${db.notifications.length} notifications.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
