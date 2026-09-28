import { Prisma, PrismaClient } from "@prisma/client";
import type { AlertRule } from "@/lib/alerts/engine";
import { isPlanId, type PlanId } from "@/lib/plans";
import type { ActivityEvent } from "@/lib/types";
import {
  StoreError,
  type AppStore,
  type ChannelType,
  type NewAlertEvent,
  type StoredAlert,
  type StoredNotification,
  type StoreUser,
  type WatchRecord,
} from "@/lib/store/types";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const watchInclude = {
  alerts: true,
  channels: true,
  wallet: true,
} satisfies Prisma.WalletWatchInclude;

type WatchWithRelations = Prisma.WalletWatchGetPayload<{ include: typeof watchInclude }>;

function toUser(user: { id: string; email: string; plan: string; createdAt: Date }): StoreUser {
  return {
    id: user.id,
    email: user.email,
    plan: isPlanId(user.plan) ? user.plan : "observer",
    createdAt: user.createdAt.getTime(),
  };
}

function toWatch(watch: WatchWithRelations): WatchRecord {
  return {
    id: watch.id,
    userId: watch.userId,
    address: watch.wallet.address,
    createdAt: watch.createdAt.getTime(),
    cursor: watch.cursor?.getTime() ?? 0,
    rules: watch.alerts.map((alert) => ({
      id: alert.id,
      eventType: alert.eventType as AlertRule["eventType"],
      asset: alert.asset,
      threshold: alert.threshold,
      direction: alert.direction as AlertRule["direction"],
      enabled: alert.enabled,
    })),
    channels: watch.channels.map((channel) => ({
      id: channel.id,
      type: channel.type as ChannelType,
      target: channel.target,
    })),
  };
}

async function ensureChain() {
  await prisma.chain.upsert({
    where: { id: "ethereum" },
    update: {},
    create: { id: "ethereum", name: "Ethereum", chainId: 1, nativeSymbol: "ETH" },
  });
}

async function ensureWallet(address: string) {
  await ensureChain();
  return prisma.wallet.upsert({
    where: { chainId_address: { chainId: "ethereum", address } },
    update: {},
    create: { chainId: "ethereum", address },
  });
}

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaStore: AppStore = {
  async upsertUser(email) {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: { email: email.toLowerCase() },
    });
    return toUser(user);
  },

  async getUserById(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? toUser(user) : null;
  },

  async getUserByEmail(email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? toUser(user) : null;
  },

  async setPlan(userId, plan: PlanId) {
    if (!isPlanId(plan)) throw new StoreError("That plan isn't available.");
    const user = await prisma.user.update({ where: { id: userId }, data: { plan } });
    return toUser(user);
  },

  async listWatches(userId) {
    const watches = await prisma.walletWatch.findMany({
      where: { userId },
      include: watchInclude,
      orderBy: { createdAt: "desc" },
    });
    return watches.map(toWatch);
  },

  async listAllWatches() {
    const watches = await prisma.walletWatch.findMany({ include: watchInclude });
    return watches.map(toWatch);
  },

  async createWatch({ userId, address, rules, channels }) {
    const wallet = await ensureWallet(address);
    const existing = await prisma.walletWatch.findUnique({
      where: { userId_walletId: { userId, walletId: wallet.id } },
    });
    if (existing) throw new StoreError("You are already watching this wallet.");
    const watch = await prisma.walletWatch.create({
      data: {
        userId,
        walletId: wallet.id,
        alerts: {
          create: rules.map((rule) => ({
            eventType: rule.eventType,
            asset: rule.asset ?? null,
            threshold: rule.threshold ?? null,
            direction: rule.direction ?? "ANY",
            enabled: rule.enabled ?? true,
          })),
        },
        channels: {
          create: channels.map((channel) => ({ type: channel.type, target: channel.target })),
        },
      },
      include: watchInclude,
    });
    return toWatch(watch);
  },

  async deleteWatch(userId, watchId) {
    await prisma.walletWatch.deleteMany({ where: { id: watchId, userId } });
  },

  async updateCursor(watchId, cursor) {
    await prisma.walletWatch.update({ where: { id: watchId }, data: { cursor: new Date(cursor) } });
  },

  async listAlertEvents(userId, limit = 40) {
    const events = await prisma.alertEvent.findMany({
      where: { alert: { watch: { userId } } },
      include: {
        alert: { include: { watch: { include: { wallet: true } } } },
        notifications: true,
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return events.map((event) => ({
      id: event.id,
      watchId: event.alert.watchId,
      userId,
      address: event.alert.watch.wallet.address,
      ruleType: event.alert.eventType as StoredAlert["ruleType"],
      summary: event.summary,
      detail: event.detail,
      hash: event.transactionHash,
      amountUsd: event.amountUsd ?? 0,
      timestamp: event.timestamp.getTime(),
      delivery: event.notifications[0]?.status ?? "pending",
    }));
  },

  async insertAlertEvents(events: NewAlertEvent[]) {
    const created: StoredAlert[] = [];
    for (const event of events) {
      try {
        const row = await prisma.alertEvent.create({
          data: {
            alertId: event.alertId,
            transactionHash: event.hash,
            summary: event.summary,
            detail: event.detail,
            amountUsd: event.amountUsd,
            timestamp: new Date(event.timestamp),
          },
          include: { alert: { include: { watch: { include: { wallet: true } } } } },
        });
        created.push({
          id: row.id,
          watchId: row.alert.watchId,
          userId: row.alert.watch.userId,
          address: row.alert.watch.wallet.address,
          ruleType: row.alert.eventType as StoredAlert["ruleType"],
          summary: row.summary,
          detail: row.detail,
          hash: row.transactionHash,
          amountUsd: row.amountUsd ?? 0,
          timestamp: row.timestamp.getTime(),
          delivery: "pending",
        });
      } catch (error) {
        if (isUnique(error)) continue;
        throw error;
      }
    }
    return created;
  },

  async enqueueNotifications(items) {
    if (items.length === 0) return;
    await prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        alertEventId: item.alertEventId,
        channel: item.channel,
        target: item.target,
        status: item.status ?? "pending",
        payload: item.payload,
        error: item.error,
        sentAt: item.status === "logged" ? new Date() : null,
      })),
    });
  },

  async claimPendingNotifications(limit) {
    const pending = await prisma.notification.findMany({
      where: {
        OR: [
          { status: "pending" },
          { status: "retry", nextAttemptAt: { lte: new Date() } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    if (pending.length === 0) return [];
    await prisma.notification.updateMany({
      where: { id: { in: pending.map((note) => note.id) } },
      data: { status: "sending" },
    });
    return pending.map(toNotification);
  },

  async markNotification(id, status, error, retry) {
    await prisma.notification.update({
      where: { id },
      data: {
        status,
        error,
        sentAt: status === "delivered" || status === "logged" ? new Date() : null,
        attempts: retry?.attempts,
        nextAttemptAt: retry ? new Date(retry.nextAttemptAt) : undefined,
      },
    });
  },

  async upsertActivity(events) {
    if (events.length === 0) return;
    await ensureChain();
    for (const event of events) {
      const from = await ensureWallet(event.from.address);
      const to = event.to.address ? await ensureWallet(event.to.address) : null;
      const transaction = await prisma.transaction.upsert({
        where: {
          chainId_hash_asset_fromAddress_toAddress: {
            chainId: "ethereum",
            hash: event.hash,
            asset: event.asset,
            fromAddress: event.from.address,
            toAddress: event.to.address,
          },
        },
        update: { amountUsd: event.amountUsd, summary: event.summary },
        create: {
          chainId: "ethereum",
          hash: event.hash,
          blockNumber: event.blockNumber,
          timestamp: new Date(event.timestamp),
          fromWalletId: from.id,
          toWalletId: to?.id,
          fromAddress: event.from.address,
          toAddress: event.to.address,
          asset: event.asset,
          amount: event.amount,
          amountUsd: event.amountUsd,
          type: event.type,
          gasEth: event.gasEth,
          summary: event.summary,
        },
      });
      if (event.asset !== "ETH") {
        const existing = await prisma.tokenTransfer.findFirst({ where: { transactionId: transaction.id } });
        if (!existing) {
          await prisma.tokenTransfer.create({
            data: {
              transactionId: transaction.id,
              tokenAddress: event.to.address,
              tokenSymbol: event.asset,
              fromAddress: event.from.address,
              toAddress: event.to.address,
              amount: event.amount,
              amountUsd: event.amountUsd,
            },
          });
        }
      }
      if (event.type === "contract" || event.type === "defi" || event.type === "nft") {
        const contract = await prisma.contract.upsert({
          where: { chainId_address: { chainId: "ethereum", address: event.to.address } },
          update: { name: event.protocol },
          create: { chainId: "ethereum", address: event.to.address, name: event.protocol },
        });
        await prisma.contractInteraction.create({
          data: {
            walletId: event.direction === "out" ? from.id : (to?.id ?? from.id),
            contractId: contract.id,
            transactionHash: event.hash,
            method: event.summary,
            timestamp: new Date(event.timestamp),
          },
        });
      }
    }
  },

  async listActivity() {
    const rows = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: 100 });
    return rows.map((row) => ({
      id: row.id,
      hash: row.hash,
      timestamp: row.timestamp.getTime(),
      type: row.type as ActivityEvent["type"],
      direction: "out" as const,
      asset: row.asset,
      amount: row.amount,
      amountUsd: row.amountUsd,
      from: { address: row.fromAddress, label: row.fromAddress, kind: "wallet" as const },
      to: { address: row.toAddress, label: row.toAddress, kind: "wallet" as const },
      blockNumber: row.blockNumber,
      gasEth: row.gasEth ?? "0",
      summary: row.summary,
    }));
  },
};

function toNotification(note: {
  id: string;
  userId: string;
  alertEventId: string | null;
  channel: string;
  target: string;
  status: string;
  payload: string;
  error: string | null;
  attempts: number;
  nextAttemptAt: Date | null;
}): StoredNotification {
  return {
    id: note.id,
    userId: note.userId,
    alertEventId: note.alertEventId ?? undefined,
    channel: note.channel as ChannelType,
    target: note.target,
    status: note.status,
    payload: note.payload,
    error: note.error ?? undefined,
    attempts: note.attempts,
    nextAttemptAt: note.nextAttemptAt?.getTime(),
  };
}
